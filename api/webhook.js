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

function signFile(token, fileId) {
  return crypto.createHmac('sha256', token).update(fileId).digest('hex');
}

function connectionMarker(id) {
  return `STORY_CONNECTION:${id}`;
}

function draftMarker(id) {
  return `STORY_DRAFT_CONNECTION:${id}`;
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

function extractDraftConnectionId(message) {
  const match = String(message?.text || message?.caption || '').match(/STORY_DRAFT_CONNECTION:([^\s]+)/);
  return match?.[1] || null;
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
    '1) Подключи бота через «Автоматизация чатов».',
    '2) Дай право «Управление историями».',
    '3) Ответь фотографией на сообщение STORY_CONNECTION.',
    '4) Перед публикацией я покажу выбор:',
    '   • быстро опубликовать;',
    '   • запретить сохранение/скриншоты;',
    '   • открыть родной редактор Telegram и выбрать аудиторию.',
    '',
    'Сообщения самого бота отправляются без звука.',
  ].join('\n');
}

async function handleCallback(token, callbackQuery) {
  const action = callbackQuery.data;
  const draftMessage = callbackQuery.message;
  const chatId = draftMessage?.chat?.id;

  await tg(token, 'answerCallbackQuery', {
    callback_query_id: callbackQuery.id,
    text: action === 'cancel' ? 'Отменено' : 'Публикую…',
  }).catch(() => {});

  if (action === 'cancel') {
    if (chatId) await sendMessage(token, chatId, '🗑 Черновик отменён.');
    return;
  }

  if (action !== 'publish' && action !== 'publish_protected') return;

  const connectionId = extractDraftConnectionId(draftMessage);
  const source = draftMessage?.reply_to_message;
  const largestPhoto = source?.photo?.[source.photo.length - 1];

  if (!connectionId || !largestPhoto) {
    throw new Error('Не удалось восстановить черновик. Отправь фото ещё раз ответом на STORY_CONNECTION.');
  }

  const connection = await tg(token, 'getBusinessConnection', {
    business_connection_id: connectionId,
  });
  if (!connection.is_enabled) throw new Error('Business connection is disabled');
  if (!connection.rights?.can_manage_stories) {
    throw new Error('Business connection does not have can_manage_stories permission');
  }

  if (chatId) await sendMessage(token, chatId, '⏳ Готовлю Story 1080×1920…');

  const original = await downloadTelegramFile(token, largestPhoto.file_id);
  const story = await postPhotoStory(
    token,
    connectionId,
    original,
    source.caption || '',
    action === 'publish_protected'
  );

  if (chatId) {
    await sendMessage(
      token,
      chatId,
      `✅ Story опубликована. story_id: ${story.id}${action === 'publish_protected' ? '\n🔒 Сохранение, пересылка и скриншоты запрещены Telegram.' : ''}`
    );
  }
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
    if (update?.callback_query) {
      await handleCallback(token, update.callback_query);
      res.status(200).json({ ok: true });
      return;
    }

    if (update?.business_connection) {
      const bc = update.business_connection;
      if (!bc.is_enabled) {
        await sendMessage(token, bc.user_chat_id, '⚠️ Business-подключение отключено. Подключи бота снова.');
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

      await sendMessage(
        token,
        bc.user_chat_id,
        `${connectionMarker(bc.id)}\n\n✅ Business-подключение готово.\n\nОтветь НА ЭТО СООБЩЕНИЕ фотографией. Ничего сразу публиковаться не будет — сначала появится экран подтверждения и выбор аудитории.`
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
          'Фото получил, но не вижу Business Connection ID. Ответь фотографией именно на сообщение STORY_CONNECTION.'
        );
        res.status(200).json({ ok: true });
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
      const origin = originFromRequest(req);
      const sig = signFile(token, largestPhoto.file_id);
      const studioUrl = new URL('/studio.html', origin);
      studioUrl.searchParams.set('file_id', largestPhoto.file_id);
      studioUrl.searchParams.set('sig', sig);
      if (message.caption) studioUrl.searchParams.set('caption', message.caption.slice(0, 180));

      await sendMessage(
        token,
        message.chat.id,
        `${draftMarker(connectionId)}\n\n📸 Фото готово. Пока ничего не опубликовано.\n\nВыбери способ публикации:\n\n⚡ «Опубликовать» — сразу через бота.\n🔒 «Опубликовать защищённо» — без пересылки, сохранения и скриншотов.\n👥 «Выбрать аудиторию» — откроется родной редактор Telegram: Все / Мои контакты / Близкие друзья / Выбранные контакты.\n\n🔕 Важно: Telegram не даёт API-флаг, который гарантированно отключает уведомления о самой Story у зрителей. Но сообщения Story Pilot тебе приходят без звука.`,
        {
          reply_parameters: { message_id: message.message_id },
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚡ Опубликовать', callback_data: 'publish' }],
              [{ text: '🔒 Опубликовать защищённо', callback_data: 'publish_protected' }],
              [{ text: '👥 Выбрать аудиторию', web_app: { url: studioUrl.toString() } }],
              [{ text: '✖️ Отмена', callback_data: 'cancel' }],
            ],
          },
        }
      );

      res.status(200).json({ ok: true, draft: true });
      return;
    }

    await sendMessage(token, message.chat.id, 'Отправь /start. Для Story нужна фотография ответом на сообщение STORY_CONNECTION.');
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error', error?.telegram || error);

    const chatId = update?.callback_query?.message?.chat?.id || update?.message?.chat?.id || update?.business_connection?.user_chat_id;
    const description = error?.telegram?.description || error?.message || String(error);

    if (chatId) {
      let text = `❌ Telegram отклонил действие.\n\n${description}`;
      if (/PREMIUM_ACCOUNT_REQUIRED/i.test(description)) {
        text += '\n\nTelegram на сервере требует Premium для этого действия на данном аккаунте.';
      }
      await sendMessage(token, chatId, text).catch(() => {});
    }

    res.status(200).json({ ok: false, error: description });
  }
}
