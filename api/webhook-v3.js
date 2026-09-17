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

function parseUsernames(text) {
  return [...new Set(String(text || '')
    .split(/[\s,;]+/)
    .map(normalizeUsername)
    .filter(Boolean))].slice(0, 50);
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

function inlineMenu(settings = {}) {
  const active = settings.audience || 'standard';
  const excludedCount = settings.excluded?.length || 0;
  const mark = (mode, label) => (active === mode ? `✅ ${label}` : label);
  return {
    inline_keyboard: [
      [{ text: '🚀 Старт', callback_data: 'home' }],
      [
        { text: mark('all', '🌍 Все'), callback_data: 'aud:all' },
        { text: mark('contacts', '👥 Мои контакты'), callback_data: 'aud:contacts' },
      ],
      [
        { text: mark('close', '⭐ Близкие друзья'), callback_data: 'aud:close' },
        { text: mark('selected', '🎯 Выбранные'), callback_data: 'aud:selected' },
      ],
      [
        { text: `🚫 Исключить${excludedCount ? ` (${excludedCount})` : ''}`, callback_data: 'exclude:set' },
        { text: '🧹 Очистить исключения', callback_data: 'exclude:clear' },
      ],
      [
        { text: mark('standard', '⚡ Стандарт'), callback_data: 'aud:standard' },
        { text: '📊 Настройки', callback_data: 'settings' },
      ],
      [{ text: '📸 Как публиковать', callback_data: 'howto' }],
    ],
  };
}

async function sendMessage(token, chatId, text, settings = null, extra = {}) {
  return tg(token, 'sendMessage', {
    chat_id: chatId,
    text,
    disable_notification: true,
    disable_web_page_preview: true,
    ...(settings ? { reply_markup: inlineMenu(settings) } : {}),
    ...extra,
  });
}

async function getStoredSettings(token, chatId) {
  try {
    const menu = await tg(token, 'getChatMenuButton', { chat_id: chatId });
    if (menu?.type === 'web_app' && menu?.web_app?.url) {
      const url = new URL(menu.web_app.url);
      const rawPick = url.searchParams.get('pick') || '';
      return {
        bc: url.searchParams.get('bc') || null,
        audience: url.searchParams.get('aud') || 'standard',
        selected: (url.searchParams.get('sel') || '').split(',').map(normalizeUsername).filter(Boolean),
        excluded: (url.searchParams.get('exc') || '').split(',').map(normalizeUsername).filter(Boolean),
        picking: rawPick === '1' ? 'selected' : rawPick,
      };
    }
  } catch {}
  return { bc: null, audience: 'standard', selected: [], excluded: [], picking: '' };
}

async function saveSettings(token, chatId, origin, settings) {
  const url = new URL('/studio.html', origin);
  if (settings.bc) url.searchParams.set('bc', settings.bc);
  url.searchParams.set('aud', settings.audience || 'standard');
  if (settings.selected?.length) url.searchParams.set('sel', settings.selected.join(','));
  if (settings.excluded?.length) url.searchParams.set('exc', settings.excluded.join(','));
  if (settings.picking) url.searchParams.set('pick', settings.picking);

  await tg(token, 'setChatMenuButton', {
    chat_id: chatId,
    menu_button: {
      type: 'web_app',
      text: '🚀 Старт',
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

async function resolveUsers(client, Api, usernames) {
  const users = [];
  for (const username of usernames.slice(0, 50)) {
    const resolved = await client.invoke(new Api.contacts.ResolveUsername({ username }));
    const user = resolved?.users?.find((item) => item?.accessHash !== undefined) || resolved?.users?.[0];
    if (!user?.id) throw new Error(`Не удалось найти @${username}`);
    users.push(new Api.InputUser({ userId: user.id, accessHash: user.accessHash ?? BigInt(0) }));
  }
  return users;
}

async function buildPrivacyRules(client, Api, audience, selectedUsernames, excludedUsernames) {
  const rules = [];
  if (excludedUsernames?.length) {
    const excluded = await resolveUsers(client, Api, excludedUsernames);
    if (excluded.length) rules.push(new Api.InputPrivacyValueDisallowUsers({ users: excluded }));
  }
  if (audience === 'all') {
    rules.push(new Api.InputPrivacyValueAllowAll({}));
    return rules;
  }
  if (audience === 'contacts') {
    rules.push(new Api.InputPrivacyValueAllowContacts({}));
    return rules;
  }
  if (audience === 'close') {
    rules.push(new Api.InputPrivacyValueAllowCloseFriends({}));
    return rules;
  }
  if (audience === 'selected') {
    if (!selectedUsernames.length) throw new Error('Список выбранных контактов пуст');
    const selected = await resolveUsers(client, Api, selectedUsernames);
    rules.push(new Api.InputPrivacyValueAllowUsers({ users: selected }));
    return rules;
  }
  throw new Error(`Unknown audience mode: ${audience}`);
}

async function postPhotoStoryMtproto(token, businessConnectionId, imageBuffer, caption, audience, selectedUsernames, excludedUsernames) {
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
    const privacyRules = await buildPrivacyRules(client, Api, audience, selectedUsernames, excludedUsernames);
    const randomId = BigInt.asIntN(64, BigInt(`0x${crypto.randomBytes(8).toString('hex')}`));

    const result = await client.invoke(new Api.stories.SendStory({
      peer,
      media: new Api.InputMediaUploadedPhoto({ file: uploaded }),
      caption: caption ? caption.slice(0, 2048) : undefined,
      privacyRules,
      randomId,
      period: 86400,
    }));

    const storyUpdate = result?.updates?.find(
      (item) => item?.className === 'UpdateStoryID' || item?.randomId?.toString?.() === randomId.toString()
    );
    return { id: storyUpdate?.id ?? 'ok', transport: 'mtproto' };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

async function setAudience(token, chatId, origin, audience) {
  const settings = await getStoredSettings(token, chatId);
  if (audience !== 'standard' && !mtprotoConfigured()) {
    await sendMessage(token, chatId, '⚠️ Расширенная аудитория пока недоступна: MTProto не настроен.', settings);
    return settings;
  }
  if (audience === 'selected') {
    const next = { ...settings, picking: 'selected' };
    await saveSettings(token, chatId, origin, next);
    await sendMessage(token, chatId, '🎯 Напиши одним сообщением @username людей, которым можно видеть Story.\n\nНапример: @anna @david @maria', next);
    return next;
  }
  const next = { ...settings, audience, picking: '' };
  await saveSettings(token, chatId, origin, next);
  await sendMessage(token, chatId, `✅ Аудитория: ${audienceLabel(audience, next.selected)}\n\nТеперь просто отправь фото.`, next);
  return next;
}

async function beginExclusions(token, chatId, origin) {
  const settings = await getStoredSettings(token, chatId);
  if (settings.audience === 'standard') {
    await sendMessage(token, chatId, '🚫 Исключения работают в режимах «Все», «Мои контакты», «Близкие друзья» и «Выбранные». Сначала выбери аудиторию.', settings);
    return settings;
  }
  const next = { ...settings, picking: 'exclude' };
  await saveSettings(token, chatId, origin, next);
  await sendMessage(token, chatId, `🚫 Кого НЕ показывать?\n\nНапиши @username через пробел.\nНапример: @anna @david @maria\n\nТекущие исключения: ${settings.excluded?.length ? settings.excluded.map((u) => `@${u}`).join(', ') : 'нет'}`, next);
  return next;
}

async function showHome(token, chatId, settings) {
  const excluded = settings.excluded?.length ? `\n🚫 Не увидят: ${settings.excluded.map((u) => `@${u}`).join(', ')}` : '';
  await sendMessage(token, chatId, `✨ Story Pilot\n\n📸 Отправь фото — оно сразу публикуется в Story на 24 часа.\n\nСейчас видят: ${audienceLabel(settings.audience, settings.selected)}${excluded}\n\nВыбирай настройки кнопками ниже 👇`, settings);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true, service: 'telegram-story-bot-v3' });
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
      await showHome(token, bc.user_chat_id, settings);
      res.status(200).json({ ok: true });
      return;
    }

    if (update?.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message?.chat?.id;
      const action = String(callback.data || '');
      if (!chatId) {
        res.status(200).json({ ok: true, ignored: true });
        return;
      }

      await tg(token, 'answerCallbackQuery', { callback_query_id: callback.id }).catch(() => {});
      let settings = await getStoredSettings(token, chatId);
      await saveSettings(token, chatId, origin, settings).catch(() => {});

      if (action === 'home') {
        settings = await getStoredSettings(token, chatId);
        await showHome(token, chatId, settings);
        res.status(200).json({ ok: true });
        return;
      }
      if (action.startsWith('aud:')) {
        await setAudience(token, chatId, origin, action.slice(4));
        res.status(200).json({ ok: true, action });
        return;
      }
      if (action === 'exclude:set') {
        await beginExclusions(token, chatId, origin);
        res.status(200).json({ ok: true });
        return;
      }
      if (action === 'exclude:clear') {
        const next = { ...settings, excluded: [], picking: '' };
        await saveSettings(token, chatId, origin, next);
        await sendMessage(token, chatId, '🧹 Исключения очищены.', next);
        res.status(200).json({ ok: true });
        return;
      }
      if (action === 'settings') {
        await sendMessage(token, chatId, `📊 Текущие настройки\n\nАудитория: ${audienceLabel(settings.audience, settings.selected)}\n🚫 Исключения: ${settings.excluded?.length ? settings.excluded.map((u) => `@${u}`).join(', ') : 'нет'}\nBusiness connection: ${settings.bc ? '✅ подключён' : '❌ не найден'}\nMTProto: ${mtprotoConfigured() ? '✅ готов' : '❌ не настроен'}`, settings);
        res.status(200).json({ ok: true });
        return;
      }
      if (action === 'howto') {
        await sendMessage(token, chatId, '📸 Как публиковать\n\n1. Выбери аудиторию.\n2. Если надо — нажми «🚫 Исключить» и укажи @username тех, кто не должен видеть Story.\n3. Отправь фото обычным сообщением.\n\nНикаких reply и forward не нужно.', settings);
        res.status(200).json({ ok: true });
        return;
      }

      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    const message = update?.message;
    if (!message) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    const chatId = message.chat.id;
    const text = String(message.text || '').trim();
    let settings = await getStoredSettings(token, chatId);
    await saveSettings(token, chatId, origin, settings).catch(() => {});

    if (text === '/start' || text === '/help') {
      settings = await getStoredSettings(token, chatId);
      await showHome(token, chatId, settings);
      res.status(200).json({ ok: true });
      return;
    }

    if (settings.picking && text) {
      const usernames = parseUsernames(text);
      if (!usernames.length) {
        await sendMessage(token, chatId, 'Нужны @username. Например: @anna @david', settings);
        res.status(200).json({ ok: true });
        return;
      }
      if (settings.picking === 'exclude') {
        const next = { ...settings, excluded: usernames, picking: '' };
        await saveSettings(token, chatId, origin, next);
        await sendMessage(token, chatId, `✅ Исключения сохранены: ${usernames.map((u) => `@${u}`).join(', ')}\n\nЭти люди не увидят следующие Stories в выбранном режиме.`, next);
        res.status(200).json({ ok: true, excluded: usernames });
        return;
      }
      const next = { ...settings, audience: 'selected', selected: usernames, picking: '' };
      await saveSettings(token, chatId, origin, next);
      await sendMessage(token, chatId, `✅ Выбранные сохранены: ${usernames.map((u) => `@${u}`).join(', ')}\n\nТеперь просто отправь фото.`, next);
      res.status(200).json({ ok: true, selected: usernames });
      return;
    }

    if (message.photo?.length) {
      const current = await getStoredSettings(token, chatId);
      const connectionId = message.business_connection_id || current.bc;
      if (!connectionId) {
        await sendMessage(token, chatId, 'Нужно один раз переподключить Story Pilot: Настройки → Автоматизация чатов → выключить/включить бота с правом «Управление историями».', current);
        res.status(200).json({ ok: true, needs_rebind: true });
        return;
      }

      const connection = await tg(token, 'getBusinessConnection', { business_connection_id: connectionId });
      if (!connection.is_enabled) throw new Error('Business connection is disabled');
      if (!connection.rights?.can_manage_stories) throw new Error('Нет права can_manage_stories');

      const largestPhoto = message.photo[message.photo.length - 1];
      const original = await downloadTelegramFile(token, largestPhoto.file_id);

      if (current.audience === 'standard' && current.excluded?.length) {
        await sendMessage(token, chatId, '⚠️ В режиме «Стандарт Telegram» исключения не применяются. Выбери «Мои контакты», «Все», «Близкие друзья» или «Выбранные».', current);
        res.status(200).json({ ok: true, needs_custom_audience: true });
        return;
      }

      const story = current.audience === 'standard'
        ? await postPhotoStoryBotApi(token, connectionId, original, message.caption || '')
        : await postPhotoStoryMtproto(token, connectionId, original, message.caption || '', current.audience, current.selected, current.excluded);

      const excludedText = current.excluded?.length ? `\n🚫 Кроме: ${current.excluded.map((u) => `@${u}`).join(', ')}` : '';
      await sendMessage(token, chatId, `✅ В Story\n👁 ${audienceLabel(current.audience, current.selected)}${excludedText}\n#${story.id}`, current);
      res.status(200).json({ ok: true, story_id: story.id, transport: story.transport });
      return;
    }

    await showHome(token, chatId, settings);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error', error?.telegram || error);
    const chatId = update?.callback_query?.message?.chat?.id || update?.message?.chat?.id || update?.business_connection?.user_chat_id;
    const description = error?.telegram?.description || error?.message || String(error);
    if (chatId) {
      const settings = await getStoredSettings(token, chatId).catch(() => null);
      let text = `❌ Telegram отклонил действие.\n\n${description}`;
      if (/PREMIUM_ACCOUNT_REQUIRED/i.test(description)) text += '\n\nTelegram сервером требует Premium для этой публикации.';
      await sendMessage(token, chatId, text, settings).catch(() => {});
    }
    res.status(200).json({ ok: false, error: description });
  }
}
