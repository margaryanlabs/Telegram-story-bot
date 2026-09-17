import crypto from 'node:crypto';

function telegramUrl(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function tg(token, method, body) {
  const response = await fetch(telegramUrl(token, method), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(`${method}: ${data.description || response.statusText}`);
  return data.result;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    res.status(500).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is missing in Vercel Environment Variables' });
    return;
  }

  try {
    const forwardedHost = req.headers['x-forwarded-host'];
    const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host;
    const protoHeader = req.headers['x-forwarded-proto'];
    const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || 'https';
    const webhookUrl = `${proto}://${host}/api/webhook-v3`;
    const secretToken = crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);

    const bot = await tg(token, 'getMe');
    const webhook = await tg(token, 'setWebhook', {
      url: webhookUrl,
      allowed_updates: ['message', 'business_connection', 'callback_query'],
      secret_token: secretToken,
      drop_pending_updates: false,
    });

    await tg(token, 'setMyCommands', {
      commands: [
        { command: 'start', description: '🚀 Открыть Story Pilot' },
        { command: 'help', description: '📸 Как публиковать Story' },
      ],
    });

    await tg(token, 'setChatMenuButton', {
      menu_button: { type: 'commands' },
    }).catch(() => {});

    res.status(200).json({
      ok: true,
      bot: `@${bot.username}`,
      webhook,
      webhook_url: webhookUrl,
      ui: 'inline controls + persistent Start menu',
      mtproto_configured: Boolean(process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH),
      next: 'Use My Contacts, then Exclude to create “contacts except these people”.',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
}
