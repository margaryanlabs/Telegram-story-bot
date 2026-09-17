import crypto from 'node:crypto';
import sharp from 'sharp';

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
  if (!response.ok || !data.ok) {
    const err = new Error(`${method}: ${data.description || response.statusText}`);
    err.telegram = data;
    throw err;
  }
  return data.result;
}

async function sendMessage(token, chatId, text, extra = {}) {
  return tg(token, 'sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...extra,
  });
}

function connectionMarker(id) {
  return `STORY_CONNECTION:${id}`;
}

function extractConnectionId(message) {
  const candidates = [
    message?.reply_to_message?.text,
    message?.reply_to_message?.caption,
    message?.text,
    message?.caption,
  ].filter(Boolean);

  for (const text of candidates) {
    const match = String(text).match(/STORY_CONNECTION:([^\s]+)/);
    if (match) return match[1];
  }
  return null;
}

async function downloadTelegramFile(token, fileId) {
  const file = await tg(token, 'getFile', { file_id: fileId });
  const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to download Telegram file: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function postPhotoStory(token, businessConnectionId, imageBuffer, caption = '') {
  const prepared = await sharp(imageBuffer)
    .rotate()
    .resize(1080, 1920, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  if (prepared.length > 10 * 1024 * 1024) {
    throw new Error('Prepared story image exceeds Telegram 10 MB limit');
  }

  const form = new FormData();
  form.set('business_connection_id', businessConnectionId);
  form.set('content', JSON.stringify({ type: 'photo', photo: 'attach://story' }));
  form.set('active_period', '86400');
  if (caption) form.set('caption', caption.slice(0, 2048));
  form.set('story', new Blob([prepared], { type: 'image/jpeg' }), 'story.jpg');

  const response = await fetch(telegramUrl(token, 'postStory'), {
    method: 'POST',
    body: form,
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    const err = new Error(data.description || `postStory failed: ${response.status}`);
    err.telegram = data;
    throw err;
  }
  return data.result;
}

function startText() {
  return [
    '👋 Story Pilot готов к тесту.',
    '',
    'Наша цель — проверить, разрешит ли Telegram аккаунту без Premium опубликовать Story через Business Bot.',
    '',
    '1) Подключи этого бота в Telegram Business / Chatbots.',
    '2) Обязательно дай право Manage Stories.',
    '3) После подключения бот пришлёт специальное сообщение.',
    '4) Ответь НА ТО СООБЩЕНИЕ фотографией.',
    '',
    'Фото автоматически будет подготовлено в 1080×1920 и отправлено через официальный postStory API.',
  ].join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true, service: 'telegram-story-bot' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    res.status(500).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' });
    return;
  }

  const expectedSecret = crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
  const incomingSecret = req.headers['x-telegram-bot-api-secret-token'];
  if (incomingSecret !== expectedSecret) {
    res.status(401).json({ ok: false, error: 'Invalid webhook secret' });
    return;
  }

  let update = req.body;
  if (typeof update === 'string') {
    try {
      update = JSON.parse(update);
    } catch {
      res.status(400).json({ ok: false, error: 'Invalid JSON' });
      return;
    }
  }

  try {
    if (update?.business_connection) {
      const bc = update.business_connection;
      if (!bc.is_enabled) {
        await sendMessage(token, bc.user_chat_id, '⚠️ Business-подключение отключено. Подключи бота снова, чтобы тестировать Stories.');
        res.status(200).json({ ok: true });
        return;
      }

      if (!bc.rights?.can_manage_stories) {
        await sendMessage(
          token,
          bc.user_chat_id,
          'Подключение есть, но права Manage Stories нет. Открой настройки Business-бота и разреши управление Stories.'
        );
        res.status(200).json({ ok: true });
        return;
      }

      await sendMessage(
        token,
        bc.user_chat_id,
        `${connectionMarker(bc.id)}\n\n✅ Business-подключение готово.\n\nТеперь ОТВЕТЬ НА ЭТО СООБЩЕНИЕ фотографией. Я приведу её к формату Story и попробую опубликовать на твоём аккаунте на 24 часа.\n\nВажно: не отправляй фото отдельным сообщением — именно ответом на это.`
      );

      res.status(200).json({ ok: true });
      return;
    }

    const message = update?.message;
    if (!message) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    if (message.text === '/start' || message.text === '/help') {
      await sendMessage(token, message.chat.id, startText());
      res.status(200).json({ ok: true });
      return;
    }

    if (message.photo?.length) {
      const connectionId = extractConnectionId(message);
      if (!connectionId) {
        await sendMessage(
          token,
          message.chat.id,
          'Фото получил. Но мне нужен Business Connection ID. После подключения Business-бота я пришлю сообщение с пометкой STORY_CONNECTION — ответь фотографией именно на него.'
        );
        res.status(200).json({ ok: true });
        return;
      }

      const connection = await tg(token, 'getBusinessConnection', {
        business_connection_id: connectionId,
      });

      if (!connection.is_enabled) {
        throw new Error('Business connection is disabled');
      }
      if (!connection.rights?.can_manage_stories) {
        throw new Error('Business connection does not have can_manage_stories permission');
      }

      await sendMessage(token, message.chat.id, '⏳ Готовлю фото 1080×1920 и отправляю через Telegram postStory…');

      const largestPhoto = message.photo[message.photo.length - 1];
      const original = await downloadTelegramFile(token, largestPhoto.file_id);
      const story = await postPhotoStory(token, connectionId, original, message.caption || '');

      await sendMessage(
        token,
        message.chat.id,
        `✅ Telegram принял Story. story_id: ${story.id}\n\nПроверь свой профиль — это и есть наш главный тест.`
      );

      res.status(200).json({ ok: true, story_id: story.id });
      return;
    }

    await sendMessage(token, message.chat.id, 'Отправь /start. Для теста Story нужна фотография, отправленная ответом на сообщение STORY_CONNECTION.');
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error', error?.telegram || error);

    const message = update?.message;
    const chatId = message?.chat?.id || update?.business_connection?.user_chat_id;
    const description = error?.telegram?.description || error?.message || String(error);

    if (chatId) {
      let text = `❌ Telegram отклонил публикацию.\n\n${description}`;
      if (/PREMIUM_ACCOUNT_REQUIRED/i.test(description)) {
        text += '\n\nРЕЗУЛЬТАТ ТЕСТА: Telegram на сервере требует Premium для этого аккаунта. Значит официальный Business Bot не может снять это ограничение.';
      }
      await sendMessage(token, chatId, text).catch(() => {});
    }

    // Always acknowledge Telegram updates so the same update is not retried forever.
    res.status(200).json({ ok: false, error: description });
  }
}
