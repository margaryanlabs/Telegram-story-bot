import v7Handler from './webhook-v7.js';

function telegramUrl(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function deleteMessage(token, chatId, messageId) {
  if (!token || !chatId || !messageId) return;
  try {
    await fetch(telegramUrl(token, 'deleteMessage'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
  } catch {}
}

export default async function handler(req, res) {
  let cleanup = null;
  if (req.method === 'POST') {
    let update = req.body;
    if (typeof update === 'string') {
      try { update = JSON.parse(update); } catch { update = null; }
    }
    const message = update?.message;
    const text = String(message?.text || '').trim();
    if (message?.users_shared || text === '✖️ Отмена' || text === '✖️ Отмена выбора') {
      cleanup = {
        chatId: message?.chat?.id,
        messageId: message?.message_id,
      };
    }
  }

  await v7Handler(req, res);

  if (cleanup) {
    await deleteMessage(process.env.TELEGRAM_BOT_TOKEN, cleanup.chatId, cleanup.messageId);
  }
}
