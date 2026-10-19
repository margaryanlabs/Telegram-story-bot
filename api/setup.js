import {
  listActiveViewerSessions,
  listBusinessConnectionCandidates,
  upsertBusinessConnectionState,
} from '../lib/viewer-sync-store.js';
import crypto from 'node:crypto';
import sharp from 'sharp';

function telegramUrl(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function tg(token, method, body = {}) {
  const response = await fetch(telegramUrl(token, method), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(`${method}: ${data.description || response.statusText}`);
  return data.result;
}

const CONTROL_BUILD = '20261016-veto-smart-inbox-v1';

const VETO_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" role="img" aria-label="VETO">
  <defs>
    <linearGradient id="vetoCase" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#202a3c"/>
      <stop offset=".50" stop-color="#101726"/>
      <stop offset="1" stop-color="#080b13"/>
    </linearGradient>
    <radialGradient id="vetoHalo" cx=".80" cy=".18" r=".86">
      <stop offset="0" stop-color="#ff715b" stop-opacity=".20"/>
      <stop offset=".60" stop-color="#314b77" stop-opacity=".12"/>
      <stop offset="1" stop-color="#314b77" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="vetoSilver" x1="0" y1="0" x2=".8" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".45" stop-color="#f0f6ff"/>
      <stop offset="1" stop-color="#c0d3ed"/>
    </linearGradient>
    <linearGradient id="vetoFlame" x1=".1" y1="1" x2=".85" y2="0">
      <stop offset="0" stop-color="#d94343"/>
      <stop offset=".50" stop-color="#ff624f"/>
      <stop offset="1" stop-color="#ff9a74"/>
    </linearGradient>
  </defs>
  <rect x=".7" y=".7" width="38.6" height="38.6" rx="11.4" fill="url(#vetoCase)" stroke="#42506a" stroke-width="1.1"/>
  <rect x="1.8" y="1.8" width="36.4" height="36.4" rx="10.4" fill="url(#vetoHalo)"/>
  <path d="M8.5 11.5 19.7 29 15 29 6.8 16.1Z" fill="url(#vetoSilver)"/>
  <path d="M31.5 11.5 20.3 29H25l8.2-12.9Z" fill="url(#vetoFlame)"/>
  <path d="M18.25 22.3h3.5" stroke="#111927" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M6.8 6.4c2.8-2 6.5-3 10.9-3.1" fill="none" stroke="#ffffff" stroke-opacity=".17" stroke-width=".7" stroke-linecap="round"/>
</svg>`;

async function setVetoBotProfilePhoto(token) {
  const jpg = await sharp(Buffer.from(VETO_MARK_SVG))
    .resize(640, 640, { fit: 'cover' })
    .flatten({ background: '#000000' })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toBuffer();

  const form = new FormData();
  form.append('photo', JSON.stringify({
    type: 'static',
    photo: 'attach://veto_logo',
  }));
  form.append('veto_logo', new Blob([jpg], { type: 'image/jpeg' }), 'veto-telegram.jpg');

  const response = await fetch(telegramUrl(token, 'setMyProfilePhoto'), {
    method: 'POST',
    body: form,
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`setMyProfilePhoto: ${data.description || response.statusText}`);
  }
  return Boolean(data.result);
}


function controlAppUrl(baseUrl) {
  const url = new URL('/studio.html', baseUrl);
  url.searchParams.set('v', CONTROL_BUILD);
  return url.toString();
}

function versionExistingControlUrl(menu, baseUrl) {
  const raw = String(menu?.web_app?.url || '').trim();
  if (!raw) return controlAppUrl(baseUrl);
  try {
    const url = new URL(raw);
    url.searchParams.set('v', CONTROL_BUILD);
    return url.toString();
  } catch {
    return controlAppUrl(baseUrl);
  }
}

function productionBaseUrl(req) {
  const configured = String(process.env.STORY_PILOT_BASE_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');

  const productionHost = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  if (productionHost) {
    return `https://${productionHost.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  }

  const forwardedHost = req.headers['x-forwarded-host'];
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host;
  return `https://${host}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    res.status(500).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is missing' });
    return;
  }

  if (req.method === 'GET') {
    try {
      const [bot, webhook] = await Promise.all([
        tg(token, 'getMe'),
        tg(token, 'getWebhookInfo'),
      ]);
      res.status(200).json({
        ok: true,
        service: 'veto-telegram-setup',
        mode: 'read-only',
        protected: Boolean(process.env.SETUP_SECRET),
        bot: bot?.username ? `@${bot.username}` : null,
        webhook: webhook?.url || null,
        pending_updates: webhook?.pending_update_count ?? null,
        last_error: webhook?.last_error_message || null,
        last_error_at: webhook?.last_error_date ? new Date(webhook.last_error_date * 1000).toISOString() : null,
        control_build: CONTROL_BUILD,
      });
    } catch (error) {
      res.status(503).json({ ok: false, error: error?.message || String(error) });
    }
    return;
  }

  const setupSecret = String(process.env.SETUP_SECRET || '');
  const authorization = String(req.headers.authorization || '');
  const providedSecret = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : String(req.headers['x-veto-setup-secret'] || '');

  if (!setupSecret) {
    res.status(503).json({ ok: false, error: 'SETUP_SECRET is not configured' });
    return;
  }

  const expectedBuffer = Buffer.from(setupSecret);
  const providedBuffer = Buffer.from(providedSecret);
  const setupAuthorized = expectedBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  if (!setupAuthorized) {
    res.status(401).json({ ok: false, error: 'Unauthorized setup request' });
    return;
  }

  try {
    const baseUrl = productionBaseUrl(req);
    const webhookUrl = `${baseUrl}/api/webhook-v8`;
    const secretToken = crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);

    const bot = await tg(token, 'getMe');
    const webhook = await tg(token, 'setWebhook', {
      url: webhookUrl,
      allowed_updates: [
        'message',
        'callback_query',
        'business_connection',
        'business_message',
        'edited_business_message',
        'deleted_business_messages',
      ],
      secret_token: secretToken,
      drop_pending_updates: false,
    });

    for (const languageCode of [null, 'ru', 'en']) {
      await tg(token, 'setMyName', {
        name: 'VETO Telegram',
        ...(languageCode ? { language_code: languageCode } : {}),
      }).catch(() => {});
    }

    const profilePhotoUpdated = await setVetoBotProfilePhoto(token).catch(error => {
      console.warn('VETO Telegram profile photo update skipped', error?.message || String(error));
      return false;
    });

    await tg(token, 'setMyCommands', {
      commands: [
        { command: 'start', description: '🚀 Открыть VETO Telegram' },
        { command: 'ghost', description: '🛡 VETO Privacy · Anti-Delete' },
        { command: 'deleted', description: '↶ Последние удалённые сообщения' },
        { command: 'edits', description: '≋ История изменённых сообщений' },
        { command: 'stories', description: '📸 Stories и приватность' },
        { command: 'studio', description: '✦ Emoji, stickers и brand packs' },
        { command: 'sharepack', description: '↗ Проверить и поделиться emoji pack' },
        { command: 'viewers', description: '👁 Intelligence' },
        { command: 'status', description: '📊 Connection Center' },
        { command: 'help', description: '❔ Возможности и помощь' },
      ],
    });

    const shortDescriptions = [
      [null, 'VETO Telegram: secure Stories, Privacy, Intelligence и Automations в одном Mini App.'],
      ['ru', 'VETO Telegram: Stories, Privacy, Intelligence и Automations — безопасно и понятно.'],
      ['en', 'VETO Telegram: secure Stories, Privacy, Intelligence and Automations in one Mini App.'],
    ];
    for (const [languageCode, shortDescription] of shortDescriptions) {
      await tg(token, 'setMyShortDescription', {
        short_description: shortDescription,
        ...(languageCode ? { language_code: languageCode } : {}),
      }).catch(() => {});
    }

    const descriptions = [
      [null, 'VETO Telegram — Private Telegram OS. Connect your account securely, publish Stories, understand viewers, and optionally enable Business privacy tools.'],
      ['ru', 'VETO Telegram — приватный Telegram OS: безопасное подключение аккаунта, Stories, Intelligence и optional Business Privacy.'],
      ['en', 'VETO Telegram — Private Telegram OS: secure account link, Stories, Intelligence, and optional Business Privacy.'],
    ];
    for (const [languageCode, description] of descriptions) {
      await tg(token, 'setMyDescription', {
        description,
        ...(languageCode ? { language_code: languageCode } : {}),
      }).catch(() => {});
    }

    await tg(token, 'setChatMenuButton', {
      menu_button: {
        type: 'web_app',
        text: 'VETO Telegram',
        web_app: { url: controlAppUrl(baseUrl) },
      },
    }).catch(() => {});

    // Recover Business Connection state from archived Business messages.
    // This is especially important after menu-button refreshes because navigation
    // URLs are not a reliable database for connection identity/rights.
    let recoveredBusinessConnections = 0;
    const menuOwnerIds = new Set();
    try {
      const candidates = await listBusinessConnectionCandidates(50);
      for (const candidate of candidates) {
        const userId = String(candidate?.telegramUserId || '');
        const connectionId = String(candidate?.businessConnectionId || '');
        if (!userId || !connectionId) continue;
        menuOwnerIds.add(userId);

        try {
          const connection = await tg(token, 'getBusinessConnection', {
            business_connection_id: connectionId,
          });
          const live = Boolean(connection?.is_enabled);
          const rights = Boolean(connection?.rights?.can_manage_stories);
          const readRights = Boolean(connection?.rights?.can_read_messages);
          const connectionUserChatId = String(connection?.user_chat_id || userId);

          await upsertBusinessConnectionState({
            telegramUserId: connectionUserChatId,
            businessConnectionId: live ? connectionId : null,
            isEnabled: live,
            canManageStories: live && rights,
            canReadMessages: live && readRights,
            source: 'setup_archive_recovery',
            lastVerifiedAt: new Date().toISOString(),
          });
          recoveredBusinessConnections += 1;
        } catch (error) {
          console.warn('Business connection recovery candidate skipped', {
            user_id: userId,
            error: error?.message || String(error),
          });
        }
      }
    } catch (error) {
      console.warn('Business connection recovery skipped', error?.message || String(error));
    }

    // Telegram supports per-chat menu buttons. Refresh active owners while
    // preserving every existing URL parameter; only the build token changes.
    let refreshedOwnerMenus = 0;
    try {
      const owners = await listActiveViewerSessions(20);
      for (const owner of owners) {
        const chatId = String(owner?.telegram_user_id || '');
        if (chatId) menuOwnerIds.add(chatId);
      }

      for (const chatId of menuOwnerIds) {
        const currentMenu = await tg(token, 'getChatMenuButton', { chat_id: chatId }).catch(() => null);
        const nextUrl = versionExistingControlUrl(currentMenu, baseUrl);
        await tg(token, 'setChatMenuButton', {
          chat_id: chatId,
          menu_button: {
            type: 'web_app',
            text: 'VETO Telegram',
            web_app: { url: nextUrl },
          },
        }).catch(() => {});
        refreshedOwnerMenus += 1;
      }
    } catch (error) {
      console.warn('Active owner menu refresh skipped', error?.message || String(error));
    }

    const activeName = await tg(token, 'getMyName').catch(() => null);
    const profilePhotos = await tg(token, 'getUserProfilePhotos', {
      user_id: bot.id,
      limit: 1,
    }).catch(() => null);
    const webhookInfo = await tg(token, 'getWebhookInfo').catch(() => null);

    res.status(200).json({
      ok: true,
      bot: `@${bot.username}`,
      webhook,
      webhook_url: webhookUrl,
      active_webhook: webhookInfo?.url || null,
      pending_updates: webhookInfo?.pending_update_count ?? null,
      ui: 'single editable panel + temporary native user picker',
      mtproto_configured: Boolean(process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH),
      public_bot: true,
      version: 'v8',
      control_build: CONTROL_BUILD,
      brand: 'VETO Telegram v2',
      active_name: activeName?.name || null,
      profile_photo_updated: Boolean(profilePhotoUpdated),
      profile_photo_count: Number(profilePhotos?.total_count || 0),
      refreshed_owner_menus: refreshedOwnerMenus,
      recovered_business_connections: recoveredBusinessConnections,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
}
