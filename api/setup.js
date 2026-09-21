import crypto from 'node:crypto';

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

    await tg(token, 'setMyCommands', {
      commands: [
        { command: 'start', description: '🚀 Открыть Story Pilot' },
        { command: 'status', description: '📊 Проверить подключение и настройки' },
        { command: 'delete', description: '🗑 Удалить последнюю Story' },
        { command: 'reset', description: '♻️ Сбросить аудиторию и исключения' },
        { command: 'help', description: '📸 Как публиковать Story' },
      ],
    });

    await tg(token, 'setMyShortDescription', {
      short_description: 'Подключи Telegram один раз и публикуй Stories прямо из чата.',
    }).catch(() => {});

    await tg(token, 'setMyDescription', {
      description: 'Story Pilot публикует Stories в твоём Telegram-профиле. Один раз подключи бота через Telegram Business, разреши управление Stories, выбери аудиторию и просто отправляй фото.',
    }).catch(() => {});

    await tg(token, 'setChatMenuButton', {
      menu_button: { type: 'commands' },
    }).catch(() => {});

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
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
}
