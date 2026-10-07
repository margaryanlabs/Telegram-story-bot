import { viewerCryptoHealth, viewerStoreHealth } from '../lib/viewer-sync-store.js';

function telegramUrl(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function tg(token, method) {
  const response = await fetch(telegramUrl(token, method));
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || response.statusText);
  return data.result;
}

export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const status = {
    ok: false,
    service: 'telegram-story-bot',
    version: 'v8',
    token_configured: Boolean(token),
    mtproto_configured: Boolean(process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH),
    background_trigger: 'supabase-signed',
    vercel_cron_required: false,
    secure_session_crypto: 'checking',
    store: 'checking',
    store_direct_db_circuit_open: null,
    store_postgrest_fallback: null,
    bot: null,
    webhook: null,
    pending_updates: null,
    last_error: null,
  };

  if (!token) {
    res.status(503).json(status);
    return;
  }

  try {
    try {
      const [secureCrypto, storeHealth] = await Promise.all([
        viewerCryptoHealth(),
        viewerStoreHealth(),
      ]);
      status.secure_session_crypto =
        secureCrypto?.ready === true && secureCrypto?.version === 'v3'
          ? 'ready'
          : 'unavailable';
      status.store = storeHealth?.storage === 'ok' ? 'ready' : 'degraded';
      status.store_direct_db_circuit_open = Boolean(storeHealth?.directDbCircuitOpen);
      status.store_postgrest_fallback = storeHealth?.postgrestFallback === true;
    } catch {
      status.secure_session_crypto = 'unavailable';
      status.store = 'degraded';
    }

    const [bot, webhook] = await Promise.all([
      tg(token, 'getMe'),
      tg(token, 'getWebhookInfo'),
    ]);
    status.bot = bot?.username ? `@${bot.username}` : null;
    status.webhook = webhook?.url || null;
    status.pending_updates = webhook?.pending_update_count ?? null;
    status.last_error = webhook?.last_error_message || null;
    status.ok = Boolean(
      bot?.username
      && webhook?.url?.includes('/api/webhook-v8')
      && !status.last_error
      && status.secure_session_crypto === 'ready'
      && status.store === 'ready'
    );
    res.status(status.ok ? 200 : 503).json(status);
  } catch (error) {
    status.last_error = error.message || String(error);
    res.status(503).json(status);
  }
}
