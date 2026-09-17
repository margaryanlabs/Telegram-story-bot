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

function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '');
}

function audienceLabel(audience, selected = []) {
  if (audience === 'all') return '🌍 Все';
  if (audience === 'contacts') return '👥 Мои контакты';
  if (audience === 'close') return '⭐ Близкие друзья';
  if (audience === 'selected') return `🎯 Выбранные (${selected.length})`;
  return '⚡ Стандарт Telegram';
}

function mtprotoConfigured() {
  return Boolean(process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH);
}

async function getStoredSettings(token, chatId) {
  try {
    const menu = await tg(token, 'getChatMenuButton', { chat_id: chatId });
    if (menu?.type === 'web_app' && menu?.web_app?.url) {
      const url = new URL(menu.web_app.url);
      return {
        bc: url.searchParams.get('bc') || null,
        audience: url.searchParams.get('aud') || 'standard',
        selected: (url.searchParams.get('sel') || '')
          .split(',')
          .map(normalizeUsername)
          .filter(Boolean),
      };
    }
  } catch {
    // Ignore and return defaults below.
  }
  return { bc: null, audience: 'standard', selected: [] };
}

async function saveSettings(token, chatId, origin, settings) {
  const url = new URL('/studio.html', origin);
  if (settings.bc) url.searchParams.set('bc', settings.bc);
  url.searchParams.set('aud', settings.audience || 'standard');
  if (settings.selected?.length) url.searchParams.set('sel', settings.selected.join(','));

  await tg(token, 'setChatMenuButton', {
    chat_id: chatId,
    menu_button: {
      type: 'web_app',
      text: 'Story Studio',
      web_app: { url: url.toString() },
    },
  });
}

async function rememberBusinessConnection(token, chatId, connectionId, origin) {
  const current = await getStoredSettings(token, chatId);
  await saveSettings(token, chatId, origin, {
    ...current,
    bc: connectionId,
  });
}

async function resolveBusinessConnectionId(token, message, origin) {
  if (message?.business_connection_id) return message.business_connection_id;

  const fromReply = extractConnectionIdFromReply(message);
  if (fromReply) {
    await rememberBusinessConnection(token, message.chat.id, fromReply, origin).catch(() => {});
    return fromReply;
  }

  const stored = await getStoredSettings(token, message.chat.id);
  return stored.bc || null;
}

async function downloadTelegramFile(token, fileId) {
  const file = await tg(token, 'getFile', { file_id: fileId });
  const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to download Telegram file: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function preparePhoto(imageBuffer) {
  const prepared = await sharp(imageBuffer)
    .rotate()
    .resize(1080, 1920, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  if (prepared.length > 10 * 1024 * 1024) {
    throw new Error('Prepared story image exceeds Telegram 10 MB limit');
  }
  return prepared;
}

async function postPhotoStoryBotApi(token, businessConnectionId, imageBuffer, caption = '') {
  const prepared = await preparePhoto(imageBuffer);

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
  return { id: data.result.id, transport: 'bot-api' };
}

async function buildPrivacyRules(client, Api, audience, selectedUsernames) {
  if (audience === 'all') {
    return [new Api.InputPrivacyValueAllowAll({})];
  }
  if (audience === 'contacts') {
    return [new Api.InputPrivacyValueAllowContacts({})];
  }
  if (audience === 'close') {
    return [new Api.InputPrivacyValueAllowCloseFriends({})];
  }
  if (audience === 'selected') {
    if (!selectedUsernames.length) {
      throw new Error('Список выбранных контактов пуст. Используй /selected @username1 @username2');
    }

    const users = [];
    for (const username of selectedUsernames.slice(0, 100)) {
      const resolved = await client.invoke(
        new Api.contacts.ResolveUsername({ username })
      );
      const user = resolved?.users?.find((item) => item?.accessHash !== undefined) || resolved?.users?.[0];
      if (!user?.id) throw new Error(`Не удалось найти @${username}`);
      users.push(
        new Api.InputUser({
          userId: user.id,
          accessHash: user.accessHash ?? BigInt(0),
        })
      );
    }

    return [new Api.InputPrivacyValueAllowUsers({ users })];
  }

  throw new Error(`Unknown audience mode: ${audience}`);
}

async function postPhotoStoryMtproto(token, businessConnectionId, imageBuffer, caption, audience, selectedUsernames) {
  if (!mtprotoConfigured()) {
    throw new Error(
      'Для автоматического выбора аудитории нужно один раз добавить TELEGRAM_API_ID и TELEGRAM_API_HASH в Vercel. После этого настройка аудитории будет применяться автоматически.'
    );
  }

  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = String(process.env.TELEGRAM_API_HASH);
  if (!Number.isInteger(apiId) || !apiHash) throw new Error('Некорректные TELEGRAM_API_ID / TELEGRAM_API_HASH');

  const [{ TelegramClient, Api }, { StringSession }, { CustomFile }] = await Promise.all([
    import('telegram'),
    import('telegram/sessions'),
    import('telegram/client/uploads'),
  ]);

  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 3,
    useWSS: false,
  });

  try {
    await client.start({
      botAuthToken: token,
      onError: (error) => console.error('MTProto auth error', error),
    });

    const connectionUpdates = await client.invoke(
      new Api.account.GetBotBusinessConnection({ connectionId: businessConnectionId })
    );

    const businessUpdate = connectionUpdates?.updates?.find(
      (item) => item?.connection?.connectionId === businessConnectionId
    );
    const businessUserId = businessUpdate?.connection?.userId;
    if (!businessUserId) throw new Error('MTProto не вернул пользователя Business Connection');

    const businessUser = connectionUpdates?.users?.find(
      (item) => String(item?.id) === String(businessUserId)
    );
    const peer = new Api.InputPeerUser({
      userId: businessUserId,
      accessHash: businessUser?.accessHash ?? BigInt(0),
    });

    const prepared = await preparePhoto(imageBuffer);
    const uploaded = await client.uploadFile({
      file: new CustomFile('story.jpg', prepared.length, '', prepared),
      workers: 1,
    });

    const privacyRules = await buildPrivacyRules(client, Api, audience, selectedUsernames);
    const randomId = BigInt.asIntN(64, BigInt(`0x${crypto.randomBytes(8).toString('hex')}`));

    const result = await client.invoke(
      new Api.stories.SendStory({
        peer,
        media: new Api.InputMediaUploadedPhoto({ file: uploaded }),
        caption: caption ? caption.slice(0, 2048) : undefined,
        privacyRules,
        randomId,
        period: 86400,
      })
    );

    const storyUpdate = result?.updates?.find(
      (item) => item?.className === 'UpdateStoryID' || item?.randomId?.toString?.() === randomId.toString()
    );

    return {
      id: storyUpdate?.id ?? 'ok',
      transport: 'mtproto',
    };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

async function showAudienceMenu(token, chatId, settings) {
  const current = audienceLabel(settings.audience, settings.selected);
  const explicitReady = mtprotoConfigured();
  await sendMessage(
    token,
    chatId,
    `Кто будет видеть следующие Stories?\n\nСейчас: ${current}\n\nВыбираешь один раз — дальше просто отправляешь фото, и Story публикуется с этой аудиторией автоматически.${explicitReady ? '' : '\n\n⚠️ Для режимов Все / Контакты / Близкие / Выбранные осталось добавить TELEGRAM_API_ID и TELEGRAM_API_HASH в Vercel.'}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚡ Стандарт Telegram', callback_data: 'aud:standard' }],
          [{ text: '🌍 Все', callback_data: 'aud:all' }],
          [{ text: '👥 Мои контакты', callback_data: 'aud:contacts' }],
          [{ text: '⭐ Близкие друзья', callback_data: 'aud:close' }],
          [{ text: '🎯 Выбранные', callback_data: 'aud:selected' }],
        ],
      },
    }
  );
}

function startText(settings) {
  return [
    '👋 Story Pilot готов.',
    '',
    '📸 Просто отправляешь фото → оно сразу идёт в Story.',
    '',
    `Аудитория: ${audienceLabel(settings.audience, settings.selected)}`,
    'Чтобы один раз изменить её: /audience',
    '',
    'Для «Выбранных»: /selected @username1 @username2',
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
    if (update?.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message?.chat?.id;
      const action = String(callback.data || '');

      if (chatId && action.startsWith('aud:')) {
        const audience = action.slice(4);
        const settings = await getStoredSettings(token, chatId);

        if (audience === 'selected' && !settings.selected.length) {
          await tg(token, 'answerCallbackQuery', {
            callback_query_id: callback.id,
            text: 'Сначала добавь людей командой /selected @username1 @username2',
            show_alert: true,
          });
          await sendMessage(token, chatId, '🎯 Отправь команду, например:\n/selected @durov @username2\n\nПосле этого режим «Выбранные» сохранится автоматически.');
          res.status(200).json({ ok: true });
          return;
        }

        if (audience !== 'standard' && !mtprotoConfigured()) {
          await tg(token, 'answerCallbackQuery', {
            callback_query_id: callback.id,
            text: 'Нужно добавить TELEGRAM_API_ID и TELEGRAM_API_HASH в Vercel',
            show_alert: true,
          });
          res.status(200).json({ ok: true, needs_mtproto: true });
          return;
        }

        await saveSettings(token, chatId, origin, { ...settings, audience });
        await tg(token, 'answerCallbackQuery', {
          callback_query_id: callback.id,
          text: `Сохранено: ${audienceLabel(audience, settings.selected)}`,
        });
        await sendMessage(token, chatId, `✅ Аудитория сохранена: ${audienceLabel(audience, settings.selected)}\n\nТеперь просто отправляй фотографии.`);
        res.status(200).json({ ok: true });
        return;
      }

      await tg(token, 'answerCallbackQuery', { callback_query_id: callback.id }).catch(() => {});
      res.status(200).json({ ok: true });
      return;
    }

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
        await sendMessage(token, bc.user_chat_id, 'Подключение есть, но права «Управление историями» нет. Включи его в «Автоматизация чатов».');
        res.status(200).json({ ok: true });
        return;
      }

      await rememberBusinessConnection(token, bc.user_chat_id, bc.id, origin);
      const settings = await getStoredSettings(token, bc.user_chat_id);
      await sendMessage(
        token,
        bc.user_chat_id,
        `✅ Готово. Привязка сохранена.\n\nТеперь просто отправляй фотографию — она сразу уйдёт в Story.\nАудитория: ${audienceLabel(settings.audience, settings.selected)}\nИзменить один раз: /audience\n\n${connectionMarker(bc.id)}`
      );

      res.status(200).json({ ok: true });
      return;
    }

    const message = update?.message;
    if (!message) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    const settings = await getStoredSettings(token, message.chat.id);

    if (message.text === '/start' || message.text === '/help') {
      await sendMessage(token, message.chat.id, startText(settings));
      res.status(200).json({ ok: true });
      return;
    }

    if (message.text === '/audience') {
      await showAudienceMenu(token, message.chat.id, settings);
      res.status(200).json({ ok: true });
      return;
    }

    if (message.text?.startsWith('/selected')) {
      const selected = message.text
        .replace(/^\/selected(?:@\w+)?\s*/i, '')
        .split(/[\s,;]+/)
        .map(normalizeUsername)
        .filter(Boolean)
        .slice(0, 100);

      if (!selected.length) {
        await sendMessage(token, message.chat.id, 'Пример:\n/selected @username1 @username2\n\nМожно указать до 100 публичных @username.');
        res.status(200).json({ ok: true });
        return;
      }
      if (!mtprotoConfigured()) {
        await sendMessage(token, message.chat.id, 'Список понял, но для автоматической аудитории сначала нужны TELEGRAM_API_ID и TELEGRAM_API_HASH в Vercel. После добавления повтори /selected.');
        res.status(200).json({ ok: true, needs_mtproto: true });
        return;
      }

      await saveSettings(token, message.chat.id, origin, {
        ...settings,
        audience: 'selected',
        selected,
      });
      await sendMessage(token, message.chat.id, `✅ Сохранено. Следующие Stories увидят только выбранные: ${selected.map((u) => `@${u}`).join(', ')}`);
      res.status(200).json({ ok: true });
      return;
    }

    if (message.photo?.length) {
      const connectionId = await resolveBusinessConnectionId(token, message, origin);
      if (!connectionId) {
        await sendMessage(token, message.chat.id, 'Нужна одноразовая перепривязка: Настройки → Автоматизация чатов → Story Pilot → выключи и снова включи подключение с правом «Управление историями».');
        res.status(200).json({ ok: true, needs_rebind: true });
        return;
      }

      const connection = await tg(token, 'getBusinessConnection', {
        business_connection_id: connectionId,
      });
      if (!connection.is_enabled) throw new Error('Business connection is disabled');
      if (!connection.rights?.can_manage_stories) throw new Error('Business connection does not have can_manage_stories permission');

      const largestPhoto = message.photo[message.photo.length - 1];
      const original = await downloadTelegramFile(token, largestPhoto.file_id);
      const freshSettings = await getStoredSettings(token, message.chat.id);

      let story;
      if (freshSettings.audience === 'standard') {
        story = await postPhotoStoryBotApi(token, connectionId, original, message.caption || '');
      } else {
        story = await postPhotoStoryMtproto(
          token,
          connectionId,
          original,
          message.caption || '',
          freshSettings.audience,
          freshSettings.selected
        );
      }

      await sendMessage(token, message.chat.id, `✅ В Story. Аудитория: ${audienceLabel(freshSettings.audience, freshSettings.selected)}`);
      res.status(200).json({ ok: true, story_id: story.id, transport: story.transport });
      return;
    }

    await sendMessage(token, message.chat.id, `📸 Просто отправь фотографию — я сразу опубликую её в Story.\nАудитория: ${audienceLabel(settings.audience, settings.selected)}\nИзменить: /audience`);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error', error?.telegram || error);

    const chatId = update?.callback_query?.message?.chat?.id || update?.message?.chat?.id || update?.business_connection?.user_chat_id;
    const description = error?.telegram?.description || error?.message || String(error);

    if (chatId) {
      let text = `❌ Telegram отклонил действие.\n\n${description}`;
      if (/PREMIUM_ACCOUNT_REQUIRED/i.test(description)) text += '\n\nTelegram на сервере требует Premium для публикации Story на этом аккаунте.';
      await sendMessage(token, chatId, text).catch(() => {});
    }

    res.status(200).json({ ok: false, error: description });
  }
}
