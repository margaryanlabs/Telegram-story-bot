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
    disable_notification: true,
    disable_web_page_preview: true,
    ...extra,
  });
}

function originFromRequest(req) {
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host;
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || 'https';
  return `${proto}://${host}`;
}

function connectionMarker(id) {
  return `STORY_CONNECTION:${id}`;
}

function extractConnectionIdFromReply(message) {
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

async function rememberBusinessConnection(token, chatId, connectionId, origin) {
  const url = new URL('/studio.html', origin);
  // Telegram stores this menu button per private chat. We use the URL as a tiny,
  // persistent per-user session so future photos do not need replies/forwards.
  url.searchParams.set('bc', connectionId);

  await tg(token, 'setChatMenuButton', {
    chat_id: chatId,
    menu_button: {
      type: 'web_app',
      text: 'Story Studio',
      web_app: { url: url.toString() },
    },
  });
}

async function resolveBusinessConnectionId(token, message, origin) {
  if (message?.business_connection_id) return message.business_connection_id;

  const fromReply = extractConnectionIdFromReply(message);
  if (fromReply) {
    await rememberBusinessConnection(token, message.chat.id, fromReply, origin).catch(() => {});
    return fromReply;
  }

  try {
    const menu = await tg(token, 'getChatMenuButton', { chat_id: message.chat.id });
    if (menu?.type === 'web_app' && menu?.web_app?.url) {
      const saved = new URL(menu.web_app.url).searchParams.get('bc');
      if (saved) return saved;
    }
  } catch {
    // Fall through to the one-time reconnect instruction below.
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

async function postPhotoStory(token, businessConnectionId, imageBuffer, caption = '', protectContent = false) {
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
  form.set('protect_content', protectContent ? 'true' : 'false');
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
    '👋 Story Pilot готов.',
    '',
    'Главный режим теперь максимально простой:',
    '📸 отправляешь мне фото обычным сообщением → я сразу публикую его в твою Story.',
    '',
    'Никаких ответов на STORY_CONNECTION, форвардов и подтверждений после первичной привязки.',
    '',
    'Если бот ещё не сохранил твоё Business-подключение, один раз выключи и снова включи Story Pilot в «Автоматизация чатов». После этого всё работает автоматически.',
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

  const origin = originFromRequest(req);

  try {
    if (update?.business_connection) {
      const bc = update.business_connection;

      if (!bc.is_enabled) {
        await tg(token, 'setChatMenuButton', {
          chat_id: bc.user_chat_id,
          menu_button: { type: 'default' },
        }).catch(() => {});
        await sendMessage(token, bc.user_chat_id, '⚠️ Story Pilot отключён от аккаунта.');
        res.status(200).json({ ok: true });
        return;
      }

      if (!bc.rights?.can_manage_stories) {
        await sendMessage(
          token,
          bc.user_chat_id,
          'Подключение есть, но права «Управление историями» нет. Включи его в «Автоматизация чатов».'
        );
        res.status(200).json({ ok: true });
        return;
      }

      await rememberBusinessConnection(token, bc.user_chat_id, bc.id, origin);

      await sendMessage(
        token,
        bc.user_chat_id,
        `✅ Готово. Привязка сохранена.\n\nТеперь просто отправляй сюда фотографию — без ответа, без форварда, без кнопок. Фото сразу уйдёт в Story на 24 часа.\n\n${connectionMarker(bc.id)}`
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
      const connectionId = await resolveBusinessConnectionId(token, message, origin);
      if (!connectionId) {
        await sendMessage(
          token,
          message.chat.id,
          'Нужна одноразовая перепривязка: Настройки → Автоматизация чатов → Story Pilot → выключи и снова включи подключение (с правом «Управление историями»). Потом просто присылай фото — больше никаких ответов/форвардов не потребуется.'
        );
        res.status(200).json({ ok: true, needs_rebind: true });
        return;
      }

      const connection = await tg(token, 'getBusinessConnection', {
        business_connection_id: connectionId,
      });
      if (!connection.is_enabled) throw new Error('Business connection is disabled');
      if (!connection.rights?.can_manage_stories) {
        throw new Error('Business connection does not have can_manage_stories permission');
      }

      const largestPhoto = message.photo[message.photo.length - 1];
      const original = await downloadTelegramFile(token, largestPhoto.file_id);
      const story = await postPhotoStory(token, connectionId, original, message.caption || '', false);

      await sendMessage(token, message.chat.id, `✅ В Story. #${story.id}`);
      res.status(200).json({ ok: true, story_id: story.id });
      return;
    }

    await sendMessage(token, message.chat.id, '📸 Просто отправь фотографию — я сразу опубликую её в Story.');
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error', error?.telegram || error);

    const chatId = update?.message?.chat?.id || update?.business_connection?.user_chat_id;
    const description = error?.telegram?.description || error?.message || String(error);

    if (chatId) {
      let text = `❌ Telegram отклонил публикацию.\n\n${description}`;
      if (/PREMIUM_ACCOUNT_REQUIRED/i.test(description)) {
        text += '\n\nTelegram на сервере требует Premium для публикации Story на этом аккаунте.';
      }
      await sendMessage(token, chatId, text).catch(() => {});
    }

    res.status(200).json({ ok: false, error: description });
  }
}
