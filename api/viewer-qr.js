import QRCode from 'qrcode';
import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { sealJson } from '../lib/viewer-sync-crypto.js';
import {
  viewerCryptoHealth,
  getViewerSession,
  upsertViewerSession,
  saveAuthChallenge,
  deleteAuthChallenge,
} from '../lib/viewer-sync-store.js';
import { beginUserQrAuth } from '../lib/viewer-sync-telegram.js';

const AUTH_TTL_MS = 10 * 60 * 1000;
const QR_STREAM_MS = 52_000;

function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0, no-transform');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function jsonError(res, status, error) {
  noStore(res);
  res.status(status).json({ ok: false, error });
}

function expiresAtMs(expires) {
  const value = Number(expires || 0);
  if (!Number.isFinite(value) || value <= 0) return Date.now() + 30_000;
  return value > 1e12 ? value : value * 1000;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    jsonError(res, 405, 'Method not allowed');
    return;
  }

  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '');
  if (!botToken) {
    jsonError(res, 503, 'Telegram Control is not configured');
    return;
  }

  const user = validateTelegramMiniApp(
    String(req.headers['x-telegram-init-data'] || ''),
    botToken,
  );
  if (!user) {
    jsonError(res, 401, 'Открой Telegram Control внутри Telegram');
    return;
  }

  const userId = String(user.id);

  try {
    const cryptoHealth = await viewerCryptoHealth();
    if (cryptoHealth?.ready !== true || cryptoHealth?.version !== 'v3') {
      throw new Error('private_crypto_not_ready');
    }
  } catch {
    jsonError(
      res,
      503,
      'Безопасное хранилище Deep Intelligence пока недоступно. Новая приватная сессия не будет создана без защищённого ключа.',
    );
    return;
  }

  try {
    const existing = await getViewerSession(userId);
    if (existing?.status === 'active') {
      jsonError(res, 409, 'Deep Intelligence уже подключён');
      return;
    }
  } catch (error) {
    jsonError(res, 503, 'Не удалось проверить текущую Telegram-сессию');
    return;
  }

  await deleteAuthChallenge(userId).catch(() => {});

  noStore(res);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = payload => {
    if (res.writableEnded || res.destroyed) return;
    res.write(JSON.stringify(payload) + '\n');
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QR_STREAM_MS);
  res.on('close', () => controller.abort());

  try {
    send({ type: 'starting' });

    const result = await beginUserQrAuth({
      abortSignal: controller.signal,
      onQr: async ({ token, expires }) => {
        const uri = `tg://login?token=${token}`;
        const qrDataUrl = await QRCode.toDataURL(uri, {
          width: 232,
          margin: 1,
          errorCorrectionLevel: 'M',
        });
        send({
          type: 'qr',
          uri,
          qrDataUrl,
          expiresAt: expiresAtMs(expires),
        });
      },
    });

    if (result?.needsPassword) {
      const now = new Date();
      await saveAuthChallenge({
        telegram_user_id: userId,
        challenge_ciphertext: await sealJson(
          { session: result.session, qr: true },
          `auth:${userId}`,
        ),
        stage: 'qr_password',
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + AUTH_TTL_MS).toISOString(),
      });

      send({
        type: 'password_required',
        hint: result.passwordHint || '',
      });
      res.end();
      return;
    }

    if (!result?.connected || !result?.session || !result?.user) {
      throw new Error('Telegram QR authorization did not return a session');
    }

    await upsertViewerSession({
      telegram_user_id: userId,
      session_ciphertext: await sealJson(
        { session: result.session },
        `session:${userId}`,
      ),
      status: 'active',
      telegram_account_user_id: result.user.id || null,
      telegram_account_username: result.user.username || null,
      telegram_account_first_name: result.user.firstName || null,
      last_error: null,
      updated_at: new Date().toISOString(),
    });
    await deleteAuthChallenge(userId).catch(() => {});

    send({
      type: 'connected',
      account: {
        id: result.user.id || null,
        username: result.user.username || '',
        firstName: result.user.firstName || '',
      },
    });
    res.end();
  } catch (error) {
    const description = error?.errorMessage || error?.message || String(error);
    if (
      error?.name === 'AbortError'
      || /aborted|QR.*cancel/i.test(description)
    ) {
      send({ type: 'expired', error: 'QR-код истёк. Создай новый.' });
    } else {
      console.warn('Deep Intelligence QR login failed', {
        telegram_user_id: userId,
        error: description,
      });
      send({
        type: 'error',
        error: /FLOOD|API_ID|AUTH_KEY/i.test(description)
          ? 'Telegram временно не разрешил новое подключение. Попробуй позже.'
          : 'Не удалось завершить QR-подключение Telegram.',
      });
    }
    res.end();
  } finally {
    clearTimeout(timer);
  }
}
