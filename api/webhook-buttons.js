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

function originFromRequest(req) {
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host;
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || 'https';
  return `${proto}://${host}`;
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

function mainKeyboard() {
  return {
    keyboard: [
      [{ text: '🌍 Все' }, { text: '👥 Мои контакты' }],
      [{ text: '⭐ Близкие друзья' }, { text: '🎯 Выбранные' }],
      [{ text: '⚡ Стандарт' }, { text: '📊 Настройки' }],
      [{ text: '📸 Как публиковать' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: 'Отправь фото — оно сразу пойдёт в Story',
  };
}

async function sendMessage(token, chatId, text, extra = {}) {
  return tg(token, 'sendMessage', {
    chat_id: chatId,
    text,
    disable_notification: true,
    disable_web_page_preview: true,
    reply_markup: mainKeyboard(),
    ...extra,
  });
}

async function getStoredSettings(token, chatId) {
  try {
    const menu = await tg(token, 'getChatMenuButton', { chat_id: chatId });
    if (menu?.type === 'web_app' && menu?.web_app?.url) {
      const url = new URL(menu.web_app.url);
      return {
        bc: url.searchParams.get('bc') || null,
        audience: url.searchParams.get('aud') || 'standard',
        selected: (url.searchParams.get('sel') || '').split(',').map(normalizeUsername).filter(Boolean),
        picking: url.searchParams.get('pick') === '1',
      };
    }
  } catch {}
  return { bc: null, audience: 'standard', selected: [], picking: false };
}

async function saveSettings(token, chatId, origin, settings) {
  const url = new URL('/studio.html', origin);
  if (settings.bc) url.searchParams.set('bc', settings.bc);
  url.searchParams.set('aud', settings.audience || 'standard');
  if (settings.selected?.length) url.searchParams.set('sel', settings.selected.join(','));
  if (settings.picking) url.searchParams.set('pick', '1');

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
  await saveSettings(token, chatId, origin, { ...current, bc: connectionId });
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
  if (prepared.length > 10 * 1024 * 1024) throw new Error('Prepared story image exceeds Telegram 10 MB limit');
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

  const response = await fetch(telegramUrl(token, 'postStory'), { method: 'POST', body: form });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    const err = new Error(data.description || `postStory failed: ${response.status}`);
    err.telegram = data;
    throw err;
  }
  return { id: data.result.id, transport: 'bot-api' };
}

async function buildPrivacyRules(client, Api, audience, selectedUsernames) {
  if (audience === 'all') return [new Api.InputPrivacyValueAllowAll({})];
  if (audience === 'contacts') return [new Api.InputPrivacyValueAllowContacts({})];
  if (audience === 'close') return [new Api.InputPrivacyValueAllowCloseFriends({})];
  if (audience === 'selected') {
    if (!selectedUsernames.length) throw new Error('Список выбранных контактов пуст');
    const users = [];
    for (const username of selectedUsernames.slice(0, 100)) {
      const resolved = await client.invoke(new Api.contacts.ResolveUsername({ username }));
      const user = resolved?.users?.find((item) => item?.accessHash !== undefined) || resolved?.users?.[0];
      if (!user?.id) throw new Error(`Не удалось найти @${username}`);
      users.push(new Api.InputUser({ userId: user.id, accessHash: user.accessHash ?? BigInt(0) }));
    }
    return [new Api.InputPrivacyValueAllowUsers({ users })];
  }
  throw new Error(`Unknown audience mode: ${audience}`);
}

async function postPhotoStoryMtproto(token, businessConnectionId, imageBuffer, caption, audience, selectedUsernames) {
  if (!mtprotoConfigured()) throw new Error('MTProto не настроен');

  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = String(process.env.TELEGRAM_API_HASH || '');
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
    await client.start({ botAuthToken: token, onError: (error) => console.error('MTProto auth error', error) });

    const updates = await client.invoke(new Api.account.GetBotBusinessConnection({ connectionId: businessConnectionId }));
    const businessUpdate = updates?.updates?.find((item) => item?.connection?.connectionId === businessConnectionId);
    const businessUserId = businessUpdate?.connection?.userId;
    if (!businessUserId) throw new Error('Не удалось определить business account');

    const businessUser = updates?.users?.find((item) => String(item?.id) === String(businessUserId));
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

    const result = await client.invoke(new Api.stories.SendStory({
      peer,
      media: new Api.InputMediaUploadedPhoto({ file: uploaded }),
      caption: caption ? caption.slice(0, 2048) : undefined,
      privacyRules,
      randomId,
      period: 86400,
    }));

    const storyUpdate = result?.updates?.find((item) => item?.className === 'UpdateStoryID' || item?.randomId?.toString?.() === randomId.toString());
    return { id: storyUpdate?.id ?? 'ok', transport: 'mtproto' };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

async function chooseAudience(token, chatId, origin, audience) {
  const settings = await getStoredSettings(token, chatId);
  if (audience !== 'standard' && !mtprotoConfigured()) {
    await sendMessage(token, chatId, '⚠️ Расширенная аудитория пока недоступна: MTProto не настроен.');
    return;
  }

  if (audience === 'selected') {
    await saveSettings(token, chatId, origin, { ...settings, picking: true });
    await sendMessage(token, chatId, '🎯 Напиши одним сообщением @username людей, которым можно видеть Story.\n\nНапример: @anna @david @maria');
    return;
  }

  await saveSettings(token, chatId, origin, { ...settings, audience, picking: false });
  await sendMessage(token, chatId, `✅ Готово. Теперь аудитория: ${audienceLabel(audience, settings.selected)}\n\nПросто отправь фото.`);
}

function buttonToAudience(text) {
  if (text === '🌍 Все') return 'all';
  if (text === '👥 Мои контакты') return 'contacts';
  if (text === '⭐ Близкие друзья') return 'close';
  if (text === '🎯 Выбранные') return 'selected';
  if (text === '⚡ Стандарт') return 'standard';
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true, service: 'telegram-story-bot-buttons' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    res.status(500).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' });
    return;
  }

  const expectedSecret = crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
  if (req.headers['x-telegram-bot-api-secret-token'] !== expectedSecret) {
    res.status(401).json({ ok: false, error: 'Invalid webhook secret' });
    return;
  }

  let update = req.body;
  if (typeof update === 'string') {
    try { update = JSON.parse(update); } catch {
      res.status(400).json({ ok: false, error: 'Invalid JSON' });
      return;
    }
  }

  const origin = originFromRequest(req);

  try {
    if (update?.business_connection) {
      const bc = update.business_connection;
      if (!bc.is_enabled) {
        await sendMessage(token, bc.user_chat_id, '⚠️ Story Pilot отключён от аккаунта.');
        res.status(200).json({ ok: true });
        return;
      }
      if (!bc.rights?.can_manage_stories) {
        await sendMessage(token, bc.user_chat_id, 'Включи разрешение «Управление историями» в «Автоматизация чатов».');
        res.status(200).json({ ok: true });
        return;
      }

      await rememberBusinessConnection(token, bc.user_chat_id, bc.id, origin);
      const settings = await getStoredSettings(token, bc.user_chat_id);
      await sendMessage(
        token,
        bc.user_chat_id,
        `✅ Story Pilot подключён.\n\n📸 Отправляй фото — оно сразу идёт в Story.\n\nКто видит сейчас: ${audienceLabel(settings.audience, settings.selected)}\n\nАудиторию меняй кнопками снизу.`
      );
      res.status(200).json({ ok: true });
      return;
    }

    const message = update?.message;
    if (!message) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    const chatId = message.chat.id;
    const text = String(message.text || '').trim();
    const settings = await getStoredSettings(token, chatId);

    if (text === '/start' || text === '/help' || text === '📸 Как публиковать') {
      await sendMessage(
        token,
        chatId,
        `✨ Story Pilot\n\n📸 Отправь фото — оно сразу публикуется в Story на 24 часа.\n\nСейчас видят: ${audienceLabel(settings.audience, settings.selected)}\n\nНикаких команд не нужно — всё кнопками снизу.`
      );
      res.status(200).json({ ok: true });
      return;
    }

    if (text === '📊 Настройки') {
      await sendMessage(
        token,
        chatId,
        `📊 Текущие настройки\n\nАудитория: ${audienceLabel(settings.audience, settings.selected)}\nBusiness connection: ${settings.bc ? '✅ подключён' : '❌ не найден'}\nMTProto: ${mtprotoConfigured() ? '✅ готов' : '❌ не настроен'}\n\nПросто нажми нужную кнопку аудитории.`
      );
      res.status(200).json({ ok: true });
      return;
    }

    const audience = buttonToAudience(text);
    if (audience) {
      await chooseAudience(token, chatId, origin, audience);
      res.status(200).json({ ok: true, audience });
      return;
    }

    if (settings.picking && text) {
      const usernames = text.split(/[\s,;]+/).map(normalizeUsername).filter(Boolean);
      if (!usernames.length) {
        await sendMessage(token, chatId, '🎯 Нужны @username. Например: @anna @david');
        res.status(200).json({ ok: true });
        return;
      }
      await saveSettings(token, chatId, origin, {
        ...settings,
        audience: 'selected',
        selected: [...new Set(usernames)].slice(0, 100),
        picking: false,
      });
      await sendMessage(token, chatId, `✅ Выбранные сохранены: ${usernames.map((u) => `@${u}`).join(', ')}\n\nТеперь просто отправь фото.`);
      res.status(200).json({ ok: true, selected: usernames });
      return;
    }

    if (message.photo?.length) {
      const current = await getStoredSettings(token, chatId);
      const connectionId = message.business_connection_id || current.bc;
      if (!connectionId) {
        await sendMessage(token, chatId, 'Нужно один раз переподключить Story Pilot: Настройки → Автоматизация чатов → выключить/включить бота с правом «Управление историями».');
        res.status(200).json({ ok: true, needs_rebind: true });
        return;
      }

      const connection = await tg(token, 'getBusinessConnection', { business_connection_id: connectionId });
      if (!connection.is_enabled) throw new Error('Business connection is disabled');
      if (!connection.rights?.can_manage_stories) throw new Error('Нет права can_manage_stories');

      const largestPhoto = message.photo[message.photo.length - 1];
      const original = await downloadTelegramFile(token, largestPhoto.file_id);
      const story = current.audience === 'standard'
        ? await postPhotoStoryBotApi(token, connectionId, original, message.caption || '')
        : await postPhotoStoryMtproto(token, connectionId, original, message.caption || '', current.audience, current.selected);

      await sendMessage(token, chatId, `✅ В Story\n👁 ${audienceLabel(current.audience, current.selected)}\n#${story.id}`);
      res.status(200).json({ ok: true, story_id: story.id, transport: story.transport });
      return;
    }

    await sendMessage(token, chatId, '📸 Отправь фотографию или выбери аудиторию кнопками снизу.');
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error', error?.telegram || error);
    const chatId = update?.message?.chat?.id || update?.business_connection?.user_chat_id;
    const description = error?.telegram?.description || error?.message || String(error);
    if (chatId) {
      let text = `❌ Telegram отклонил действие.\n\n${description}`;
      if (/PREMIUM_ACCOUNT_REQUIRED/i.test(description)) text += '\n\nTelegram сервером требует Premium для этой публикации.';
      await sendMessage(token, chatId, text).catch(() => {});
    }
    res.status(200).json({ ok: false, error: description });
  }
}
