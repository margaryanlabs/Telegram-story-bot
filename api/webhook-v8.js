import v7Handler from './webhook-v7.js';

function telegramUrl(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function tg(token, method, body = {}) {
  if (!token) return null;
  try {
    const response = await fetch(telegramUrl(token, method), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    return data?.ok ? data.result : null;
  } catch {
    return null;
  }
}

async function deleteMessage(token, chatId, messageId) {
  if (!chatId || !messageId) return;
  await tg(token, 'deleteMessage', { chat_id: chatId, message_id: messageId });
}

async function editMessage(token, chatId, messageId, text) {
  if (!chatId || !messageId) return;
  await tg(token, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    disable_web_page_preview: true,
  });
}

function parseStoredState(menu) {
  if (menu?.type !== 'web_app' || !menu?.web_app?.url) return {};
  try {
    const url = new URL(menu.web_app.url);
    return {
      pickerMessage: Number(url.searchParams.get('pm') || 0) || null,
      audience: url.searchParams.get('aud') || 'standard',
      selectedCount: (url.searchParams.get('sel') || '').split(',').filter(Boolean).length,
      excludedCount: (url.searchParams.get('exc') || '').split(',').filter(Boolean).length,
      lastStory: url.searchParams.get('ls') || null,
      lastMessage: Number(url.searchParams.get('lm') || 0) || null,
      processing: url.searchParams.get('pr') === '1',
      protect: url.searchParams.get('prot') === '1',
    };
  } catch {
    return {};
  }
}

async function getStoredState(token, chatId) {
  if (!chatId) return {};
  const menu = await tg(token, 'getChatMenuButton', { chat_id: chatId });
  return parseStoredState(menu);
}

function isSupportedImageMessage(message) {
  if (message?.photo?.length) return true;
  const mime = String(message?.document?.mime_type || '').toLowerCase();
  return Boolean(message?.document?.file_id && ['image/jpeg', 'image/png', 'image/webp'].includes(mime));
}

function audienceLabel(state = {}) {
  if (state.audience === 'all') return '🌍 Все';
  if (state.audience === 'contacts') return '👥 Мои контакты';
  if (state.audience === 'close') return '⭐ Близкие друзья';
  if (state.audience === 'selected') return `🎯 Выбранные${state.selectedCount ? ` (${state.selectedCount})` : ''}`;
  return '⚡ Стандарт Telegram';
}

export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  let update = req.body;
  if (typeof update === 'string') {
    try { update = JSON.parse(update); } catch { update = null; }
  }

  const message = req.method === 'POST' ? update?.message : null;
  const chatId = message?.chat?.id || update?.callback_query?.message?.chat?.id || null;
  const text = String(message?.text || '').trim();
  const pickerResult = Boolean(message?.users_shared);
  const pickerCancel = text === '✖️ Отмена' || text === '✖️ Отмена выбора';
  const imageMessage = isSupportedImageMessage(message);

  // Capture picker prompt before v7 clears its state, so cleanup remains reliable.
  const before = (pickerResult || pickerCancel || imageMessage)
    ? await getStoredState(token, chatId)
    : {};

  let progressMessage = null;
  if (imageMessage && chatId) {
    progressMessage = await tg(token, 'sendMessage', {
      chat_id: chatId,
      text: '⏳ Публикую Story…',
      disable_notification: true,
    });
  }

  // Capture the v7 JSON result without changing the HTTP response Telegram receives.
  let resultPayload = null;
  const originalJson = typeof res.json === 'function' ? res.json.bind(res) : null;
  if (originalJson) {
    res.json = (payload) => {
      resultPayload = payload;
      return originalJson(payload);
    };
  }

  await v7Handler(req, res);

  // Native picker is useful, but its helper messages should disappear after the choice.
  if ((pickerResult || pickerCancel) && chatId) {
    await deleteMessage(token, chatId, before.pickerMessage);
    await deleteMessage(token, chatId, message?.message_id);
  }

  // The main panel can sit far above the newly sent photo. Keep immediate feedback near the photo.
  if (imageMessage && chatId && progressMessage?.message_id) {
    const after = await getStoredState(token, chatId);
    const success = Boolean(resultPayload?.ok && resultPayload?.story_id);

    if (success) {
      const parts = [
        '✅ Story опубликована',
        `👁 ${audienceLabel(after)}`,
      ];
      if (after.excludedCount) parts.push(`🚫 Исключений: ${after.excludedCount}`);
      if (after.protect) parts.push('🛡 Защита включена');
      await editMessage(token, chatId, progressMessage.message_id, parts.join('\n'));
    } else if (resultPayload?.duplicate) {
      await editMessage(token, chatId, progressMessage.message_id, '✅ Эта Story уже обработана — дубликат не создаю.');
    } else {
      await editMessage(token, chatId, progressMessage.message_id, '❌ Story не опубликована. Причина показана в панели Story Pilot.');
    }
  }
}