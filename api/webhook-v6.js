import crypto from 'node:crypto';
import sharp from 'sharp';

const PICK_SELECTED = 9101;
const PICK_EXCLUDED = 9102;
const MAX_SAVED_USERS = 20;

function telegramUrl(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function tg(token, method, body = {}) {
  const response = await fetch(telegramUrl(token, method), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || !data?.ok) {
    const err = new Error(`${method}: ${data?.description || response.statusText || response.status}`);
    err.telegram = data;
    throw err;
  }
  return data.result;
}

function originFromRequest(req) {
  const h = req.headers['x-forwarded-host'];
  const host = Array.isArray(h) ? h[0] : h || req.headers.host;
  const p = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(p) ? p[0] : p || 'https';
  return `${proto}://${host}`;
}

function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '');
}

function parseUsernames(text) {
  return [...new Set(String(text || '')
    .split(/[\s,;]+/)
    .map(normalizeUsername)
    .filter(Boolean))].slice(0, MAX_SAVED_USERS);
}

function mtprotoConfigured() {
  return Boolean(process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH);
}

function audienceLabel(mode, selected = []) {
  if (mode === 'all') return '🌍 Все';
  if (mode === 'contacts') return '👥 Мои контакты';
  if (mode === 'close') return '⭐ Близкие друзья';
  if (mode === 'selected') return `🎯 Выбранные (${selected.length})`;
  return '⚡ Стандарт Telegram';
}

function defaultSettings() {
  return {
    bc: null,
    audience: 'standard',
    selected: [],
    excluded: [],
    picking: '',
    panel: null,
    pickerMessage: null,
  };
}

function inlineMenu(settings = {}) {
  const active = settings.audience || 'standard';
  const mark = (mode, label) => active === mode ? `✅ ${label}` : label;
  const exc = settings.excluded?.length || 0;
  const connectionText = settings.bc ? '✅ Аккаунт подключён' : '🔗 Подключить аккаунт';
  return {
    inline_keyboard: [
      [
        { text: mark('all', '🌍 Все'), callback_data: 'aud:all' },
        { text: mark('contacts', '👥 Мои контакты'), callback_data: 'aud:contacts' },
      ],
      [
        { text: mark('close', '⭐ Близкие друзья'), callback_data: 'aud:close' },
        { text: mark('selected', '🎯 Выбранные'), callback_data: 'pick:selected' },
      ],
      [
        { text: `🚫 Исключить${exc ? ` (${exc})` : ''}`, callback_data: 'pick:exclude' },
        { text: '🧹 Очистить', callback_data: 'exclude:clear' },
      ],
      [{ text: connectionText, callback_data: 'view:connect' }],
      [
        { text: mark('standard', '⚡ Стандарт'), callback_data: 'aud:standard' },
        { text: '📊 Настройки', callback_data: 'view:settings' },
      ],
      [{ text: '📸 Как публиковать', callback_data: 'view:howto' }],
    ],
  };
}

function userPicker(kind) {
  const isExclude = kind === 'exclude';
  return {
    keyboard: [[{
      text: isExclude ? '🚫 Выбрать, кого исключить' : '🎯 Выбрать людей',
      request_users: {
        request_id: isExclude ? PICK_EXCLUDED : PICK_SELECTED,
        user_is_bot: false,
        max_quantity: 10,
        request_name: true,
        request_username: true,
        request_photo: true,
      },
    }], [{ text: '✖️ Отмена' }]],
    resize_keyboard: true,
    one_time_keyboard: true,
    input_field_placeholder: 'Нажми кнопку — откроется список людей',
  };
}

async function getStoredSettings(token, chatId) {
  try {
    const menu = await tg(token, 'getChatMenuButton', { chat_id: chatId });
    if (menu?.type === 'web_app' && menu?.web_app?.url) {
      const url = new URL(menu.web_app.url);
      return {
        bc: url.searchParams.get('bc') || null,
        audience: url.searchParams.get('aud') || 'standard',
        selected: (url.searchParams.get('sel') || '').split(',').map(normalizeUsername).filter(Boolean).slice(0, MAX_SAVED_USERS),
        excluded: (url.searchParams.get('exc') || '').split(',').map(normalizeUsername).filter(Boolean).slice(0, MAX_SAVED_USERS),
        picking: url.searchParams.get('pick') || '',
        panel: Number(url.searchParams.get('panel') || 0) || null,
        pickerMessage: Number(url.searchParams.get('pm') || 0) || null,
      };
    }
  } catch {}
  return defaultSettings();
}

async function saveSettings(token, chatId, origin, settings) {
  const url = new URL('/studio.html', origin);
  if (settings.bc) url.searchParams.set('bc', settings.bc);
  url.searchParams.set('aud', settings.audience || 'standard');
  if (settings.selected?.length) url.searchParams.set('sel', settings.selected.slice(0, MAX_SAVED_USERS).join(','));
  if (settings.excluded?.length) url.searchParams.set('exc', settings.excluded.slice(0, MAX_SAVED_USERS).join(','));
  if (settings.picking) url.searchParams.set('pick', settings.picking);
  if (settings.panel) url.searchParams.set('panel', String(settings.panel));
  if (settings.pickerMessage) url.searchParams.set('pm', String(settings.pickerMessage));

  await tg(token, 'setChatMenuButton', {
    chat_id: chatId,
    menu_button: {
      type: 'web_app',
      text: '🚀 Старт',
      web_app: { url: url.toString() },
    },
  });
}

async function clearReplyKeyboard(token, chatId) {
  try {
    const m = await tg(token, 'sendMessage', {
      chat_id: chatId,
      text: '·',
      disable_notification: true,
      reply_markup: { remove_keyboard: true },
    });
    if (m?.message_id) {
      await tg(token, 'deleteMessage', { chat_id: chatId, message_id: m.message_id }).catch(() => {});
    }
  } catch {}
}

function homeText(settings) {
  const connected = settings.bc ? '✅ подключён' : '❌ не подключён';
  const excluded = settings.excluded?.length
    ? `\n🚫 Не увидят: ${settings.excluded.map(u => `@${u}`).join(', ')}`
    : '';
  const hint = settings.bc
    ? '\n\n📸 Просто отправь фото обычным сообщением.'
    : '\n\n🔗 Сначала подключи аккаунт кнопкой ниже.';
  return `✨ Story Pilot\n\n👁 ${audienceLabel(settings.audience, settings.selected)}${excluded}\n🔌 Аккаунт: ${connected}${hint}`;
}

function settingsText(settings) {
  return `📊 Настройки Story Pilot\n\n👁 Аудитория: ${audienceLabel(settings.audience, settings.selected)}\n🚫 Исключения: ${settings.excluded?.length ? settings.excluded.map(u => `@${u}`).join(', ') : 'нет'}\n🔌 Business connection: ${settings.bc ? '✅ подключён' : '❌ не найден'}\n🧠 Расширенная приватность: ${mtprotoConfigured() ? '✅ готова' : '❌ не настроена'}\n\nНастройки сохраняются для следующих Stories.`;
}

function connectText(settings) {
  if (settings.bc) {
    return `✅ Аккаунт подключён\n\nStory Pilot получил право управлять Stories.\n\nЕсли публикация перестанет работать: Настройки Telegram → Автоматизация чатов → Story Pilot → проверь «Управление историями».`;
  }
  return `🔗 Подключение аккаунта\n\n1. Telegram → Настройки.\n2. Открой «Автоматизация чатов».\n3. Подключи @Storypilotlab_bot.\n4. Включи «Управление историями».\n5. Сохрани.\n\nПосле подключения эта панель сама обновится.`;
}

function howToText(settings) {
  return `📸 Как публиковать\n\n1. Выбери аудиторию.\n2. Для «Мои контакты, кроме…» выбери «👥 Мои контакты» → «🚫 Исключить».\n3. Для конкретных людей нажми «🎯 Выбранные».\n4. Отправь фото обычным сообщением.\n\nБез reply, без forward, без подтверждений.\n\nСейчас: ${audienceLabel(settings.audience, settings.selected)}.`;
}

async function editPanel(token, chatId, messageId, text, settings) {
  try {
    await tg(token, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      disable_web_page_preview: true,
      reply_markup: inlineMenu(settings),
    });
    return messageId;
  } catch (error) {
    if (/message is not modified/i.test(error?.message || '')) return messageId;
    throw error;
  }
}

async function showPanel(token, chatId, origin, settings, text = null, preferredMessageId = null) {
  const target = preferredMessageId || settings.panel;
  if (target) {
    try {
      const id = await editPanel(token, chatId, target, text || homeText(settings), settings);
      const next = { ...settings, panel: id };
      await saveSettings(token, chatId, origin, next);
      return next;
    } catch {}
  }

  const message = await tg(token, 'sendMessage', {
    chat_id: chatId,
    text: text || homeText(settings),
    disable_notification: true,
    disable_web_page_preview: true,
    reply_markup: inlineMenu(settings),
  });
  const next = { ...settings, panel: message.message_id };
  await saveSettings(token, chatId, origin, next);
  return next;
}

async function removePicker(token, chatId, settings) {
  await clearReplyKeyboard(token, chatId);
  if (settings.pickerMessage) {
    await tg(token, 'deleteMessage', { chat_id: chatId, message_id: settings.pickerMessage }).catch(() => {});
  }
}

async function beginNativePicker(token, chatId, origin, settings, kind) {
  if (kind === 'exclude' && settings.audience === 'standard') {
    return showPanel(token, chatId, origin, settings, '⚠️ Сначала выбери аудиторию — например «👥 Мои контакты» — затем нажми «🚫 Исключить».', settings.panel);
  }

  // Reply keyboards are required by Telegram for request_users. They appear only during selection.
  await clearReplyKeyboard(token, chatId);
  const prompt = await tg(token, 'sendMessage', {
    chat_id: chatId,
    text: kind === 'exclude'
      ? '🚫 Выбери людей, которым Story показывать НЕ надо.'
      : '🎯 Выбери людей, которым нужно показать Story.',
    disable_notification: true,
    reply_markup: userPicker(kind),
  });
  const next = { ...settings, picking: kind, pickerMessage: prompt.message_id };
  await saveSettings(token, chatId, origin, next);
  return next;
}

async function downloadTelegramFile(token, fileId) {
  const file = await tg(token, 'getFile', { file_id: fileId });
  const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  if (!response.ok) throw new Error(`Не удалось скачать фото: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function preparePhoto(buffer) {
  const rotated = await sharp(buffer).rotate().toBuffer();
  const background = await sharp(rotated)
    .resize(1080, 1920, { fit: 'cover', position: 'centre' })
    .blur(28)
    .modulate({ brightness: 0.72, saturation: 0.9 })
    .jpeg({ quality: 82 })
    .toBuffer();

  const foreground = await sharp(rotated)
    .resize(1080, 1920, { fit: 'inside', withoutEnlargement: false })
    .jpeg({ quality: 94, mozjpeg: true })
    .toBuffer();
  const meta = await sharp(foreground).metadata();
  const width = meta.width || 1080;
  const height = meta.height || 1920;

  const out = await sharp(background)
    .composite([{
      input: foreground,
      left: Math.max(0, Math.floor((1080 - width) / 2)),
      top: Math.max(0, Math.floor((1920 - height) / 2)),
    }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  if (out.length > 10 * 1024 * 1024) throw new Error('Готовое фото превышает лимит Telegram 10 MB');
  return out;
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
  for (const username of usernames.slice(0, MAX_SAVED_USERS)) {
    const resolved = await client.invoke(new Api.contacts.ResolveUsername({ username }));
    const user = resolved?.users?.find(item => item?.accessHash !== undefined) || resolved?.users?.[0];
    if (!user?.id) throw new Error(`Не удалось найти @${username}`);
    users.push(new Api.InputUser({ userId: user.id, accessHash: user.accessHash ?? BigInt(0) }));
  }
  return users;
}

async function buildPrivacyRules(client, Api, audience, selected, excluded) {
  const rules = [];
  if (excluded?.length) {
    const users = await resolveUsers(client, Api, excluded);
    if (users.length) rules.push(new Api.InputPrivacyValueDisallowUsers({ users }));
  }
  if (audience === 'all') rules.push(new Api.InputPrivacyValueAllowAll({}));
  else if (audience === 'contacts') rules.push(new Api.InputPrivacyValueAllowContacts({}));
  else if (audience === 'close') rules.push(new Api.InputPrivacyValueAllowCloseFriends({}));
  else if (audience === 'selected') {
    if (!selected?.length) throw new Error('Список выбранных людей пуст');
    rules.push(new Api.InputPrivacyValueAllowUsers({ users: await resolveUsers(client, Api, selected) }));
  } else throw new Error(`Unknown audience mode: ${audience}`);
  return rules;
}

async function postPhotoStoryMtproto(token, connectionId, imageBuffer, caption, audience, selected, excluded) {
  if (!mtprotoConfigured()) throw new Error('Расширенная приватность не настроена');
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = String(process.env.TELEGRAM_API_HASH || '');
  const [{ TelegramClient, Api }, { StringSession }, { CustomFile }] = await Promise.all([
    import('telegram'), import('telegram/sessions'), import('telegram/client/uploads'),
  ]);

  const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 3, useWSS: false });
  try {
    await client.start({ botAuthToken: token, onError: e => console.error('MTProto auth error', e) });
    const updates = await client.invoke(new Api.account.GetBotBusinessConnection({ connectionId }));
    const update = updates?.updates?.find(item => item?.connection?.connectionId === connectionId);
    const userId = update?.connection?.userId;
    if (!userId) throw new Error('Не удалось определить подключённый аккаунт');
    const businessUser = updates?.users?.find(item => String(item?.id) === String(userId));
    const peer = new Api.InputPeerUser({ userId, accessHash: businessUser?.accessHash ?? BigInt(0) });

    // Fail early on story limits before spending time uploading the image.
    await client.invoke(new Api.stories.CanSendStory({ peer }));

    const prepared = await preparePhoto(imageBuffer);
    const uploaded = await client.uploadFile({
      file: new CustomFile('story.jpg', prepared.length, '', prepared),
      workers: 1,
    });
    const privacyRules = await buildPrivacyRules(client, Api, audience, selected, excluded);
    const randomId = BigInt.asIntN(64, BigInt(`0x${crypto.randomBytes(8).toString('hex')}`));

    const result = await client.invoke(new Api.stories.SendStory({
      peer,
      media: new Api.InputMediaUploadedPhoto({ file: uploaded }),
      caption: caption ? caption.slice(0, 2048) : undefined,
      privacyRules,
      randomId,
      period: 86400,
    }));
    const idUpdate = result?.updates?.find(item => item?.className === 'UpdateStoryID' || item?.randomId?.toString?.() === randomId.toString());
    return { id: idUpdate?.id ?? 'ok', transport: 'mtproto' };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

function sharedUsernames(usersShared) {
  return [...new Set((usersShared?.users || []).map(u => normalizeUsername(u.username)).filter(Boolean))];
}

function friendlyError(description = '') {
  const d = String(description);
  if (/PREMIUM_ACCOUNT_REQUIRED/i.test(d)) return 'Telegram требует Premium для этой публикации на данном аккаунте.';
  if (/STORIES_TOO_MUCH/i.test(d)) return 'Достигнут лимит активных Stories. Удали одну Story или дождись, пока старая истечёт.';
  if (/STORY_SEND_FLOOD|FLOOD_WAIT/i.test(d)) return 'Telegram временно ограничил публикации. Нужно подождать до окончания лимита.';
  if (/BUSINESS_CONNECTION_INVALID|Business connection is disabled/i.test(d)) return 'Подключение Story Pilot устарело или отключено. Переподключи бота в «Автоматизация чатов».';
  if (/can_manage_stories|Нет права/i.test(d)) return 'Нет разрешения «Управление историями». Включи его в «Автоматизация чатов».';
  if (/PHOTO_INVALID_DIMENSIONS|IMAGE_PROCESS_FAILED/i.test(d)) return 'Telegram не принял изображение. Попробуй другое фото.';
  if (/BOT_ACCESS_FORBIDDEN/i.test(d)) return 'Telegram запретил эту операцию через текущее Business-подключение.';
  return d;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true, service: 'telegram-story-bot-v6' });
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
      const settings = await getStoredSettings(token, bc.user_chat_id);

      if (!bc.is_enabled) {
        const next = { ...settings, bc: null };
        await saveSettings(token, bc.user_chat_id, origin, next);
        await showPanel(token, bc.user_chat_id, origin, next, '⚠️ Story Pilot отключён от аккаунта. Нажми «🔗 Подключить аккаунт», чтобы вернуть публикацию Stories.');
        res.status(200).json({ ok: true });
        return;
      }
      if (!bc.rights?.can_manage_stories) {
        const next = { ...settings, bc: bc.id };
        await saveSettings(token, bc.user_chat_id, origin, next);
        await showPanel(token, bc.user_chat_id, origin, next, '⚠️ Аккаунт подключён, но нет разрешения «Управление историями». Включи его в «Автоматизация чатов».');
        res.status(200).json({ ok: true });
        return;
      }

      await clearReplyKeyboard(token, bc.user_chat_id);
      const next = { ...settings, bc: bc.id, picking: '', pickerMessage: null };
      await saveSettings(token, bc.user_chat_id, origin, next);
      await showPanel(token, bc.user_chat_id, origin, next);
      res.status(200).json({ ok: true });
      return;
    }

    if (update?.callback_query) {
      const q = update.callback_query;
      const chatId = q.message?.chat?.id;
      const messageId = q.message?.message_id;
      const action = String(q.data || '');
      if (!chatId || !messageId) {
        res.status(200).json({ ok: true, ignored: true });
        return;
      }
      await tg(token, 'answerCallbackQuery', { callback_query_id: q.id }).catch(() => {});
      let settings = await getStoredSettings(token, chatId);
      settings = { ...settings, panel: messageId };
      await saveSettings(token, chatId, origin, settings);

      if (action.startsWith('aud:')) {
        const audience = action.slice(4);
        if (audience !== 'standard' && !mtprotoConfigured()) {
          await showPanel(token, chatId, origin, settings, '⚠️ Расширенная аудитория временно недоступна.', messageId);
        } else {
          const next = { ...settings, audience, picking: '' };
          await saveSettings(token, chatId, origin, next);
          await showPanel(token, chatId, origin, next, homeText(next), messageId);
        }
      } else if (action === 'pick:selected') {
        await beginNativePicker(token, chatId, origin, settings, 'selected');
      } else if (action === 'pick:exclude') {
        await beginNativePicker(token, chatId, origin, settings, 'exclude');
      } else if (action === 'exclude:clear') {
        const next = { ...settings, excluded: [], picking: '' };
        await saveSettings(token, chatId, origin, next);
        await showPanel(token, chatId, origin, next, homeText(next), messageId);
      } else if (action === 'view:connect') {
        await showPanel(token, chatId, origin, settings, connectText(settings), messageId);
      } else if (action === 'view:settings') {
        await showPanel(token, chatId, origin, settings, settingsText(settings), messageId);
      } else if (action === 'view:howto') {
        await showPanel(token, chatId, origin, settings, howToText(settings), messageId);
      }

      res.status(200).json({ ok: true, action });
      return;
    }

    const message = update?.message;
    if (!message) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    const chatId = message.chat.id;
    let settings = await getStoredSettings(token, chatId);
    const text = String(message.text || '').trim();

    if (message.web_app_data?.data === 'storypilot:home' || text === '/start' || text === '🚀 Старт') {
      await clearReplyKeyboard(token, chatId);
      const next = { ...settings, picking: '', pickerMessage: null };
      await saveSettings(token, chatId, origin, next);
      await showPanel(token, chatId, origin, next);
      res.status(200).json({ ok: true });
      return;
    }

    if (text === '/help') {
      await showPanel(token, chatId, origin, settings, howToText(settings));
      res.status(200).json({ ok: true });
      return;
    }

    if (text === '/status') {
      await showPanel(token, chatId, origin, settings, settingsText(settings));
      res.status(200).json({ ok: true });
      return;
    }

    if (text === '✖️ Отмена') {
      await removePicker(token, chatId, settings);
      const next = { ...settings, picking: '', pickerMessage: null };
      await saveSettings(token, chatId, origin, next);
      await showPanel(token, chatId, origin, next);
      res.status(200).json({ ok: true });
      return;
    }

    if (message.users_shared) {
      const usernames = sharedUsernames(message.users_shared);
      const total = message.users_shared.users?.length || 0;
      const missing = total - usernames.length;
      const requestId = Number(message.users_shared.request_id);
      await removePicker(token, chatId, settings);

      if (!usernames.length) {
        const next = { ...settings, picking: '', pickerMessage: null };
        await saveSettings(token, chatId, origin, next);
        await showPanel(token, chatId, origin, next, '⚠️ У выбранных людей нет доступных @username. Telegram не даёт боту достаточно данных для автоматической Story-приватности. Пришли их @username одним сообщением.');
        res.status(200).json({ ok: true, missing_usernames: total });
        return;
      }

      if (requestId === PICK_EXCLUDED) {
        const merged = [...new Set([...(settings.excluded || []), ...usernames])].slice(0, MAX_SAVED_USERS);
        const next = { ...settings, excluded: merged, picking: '', pickerMessage: null };
        await saveSettings(token, chatId, origin, next);
        await showPanel(token, chatId, origin, next, `${homeText(next)}${missing ? `\n\n⚠️ ${missing} выбранных без @username не добавлены.` : ''}`);
      } else {
        const next = { ...settings, audience: 'selected', selected: usernames.slice(0, MAX_SAVED_USERS), picking: '', pickerMessage: null };
        await saveSettings(token, chatId, origin, next);
        await showPanel(token, chatId, origin, next, `${homeText(next)}${missing ? `\n\n⚠️ ${missing} выбранных без @username не добавлены.` : ''}`);
      }
      res.status(200).json({ ok: true, usernames });
      return;
    }

    if (settings.picking && text) {
      const usernames = parseUsernames(text);
      if (usernames.length) {
        await removePicker(token, chatId, settings);
        if (settings.picking === 'exclude') {
          const next = { ...settings, excluded: [...new Set([...(settings.excluded || []), ...usernames])].slice(0, MAX_SAVED_USERS), picking: '', pickerMessage: null };
          await saveSettings(token, chatId, origin, next);
          await showPanel(token, chatId, origin, next);
        } else {
          const next = { ...settings, audience: 'selected', selected: usernames, picking: '', pickerMessage: null };
          await saveSettings(token, chatId, origin, next);
          await showPanel(token, chatId, origin, next);
        }
        res.status(200).json({ ok: true });
        return;
      }
    }

    if (message.photo?.length) {
      const current = await getStoredSettings(token, chatId);
      const connectionId = message.business_connection_id || current.bc;
      if (!connectionId) {
        await showPanel(token, chatId, origin, current, '🔌 Сначала подключи аккаунт. Нажми «🔗 Подключить аккаунт» и выполни 4 коротких шага.');
        res.status(200).json({ ok: true, needs_rebind: true });
        return;
      }

      const connection = await tg(token, 'getBusinessConnection', { business_connection_id: connectionId });
      if (!connection.is_enabled) throw new Error('Business connection is disabled');
      if (!connection.rights?.can_manage_stories) throw new Error('Нет права can_manage_stories');
      if (current.audience === 'standard' && current.excluded?.length) {
        await showPanel(token, chatId, origin, current, '⚠️ Исключения не работают в режиме «Стандарт». Выбери «Все», «Мои контакты», «Близкие друзья» или «Выбранные».');
        res.status(200).json({ ok: true });
        return;
      }

      await showPanel(token, chatId, origin, current, '⏳ Публикую Story…');
      const photo = message.photo[message.photo.length - 1];
      const original = await downloadTelegramFile(token, photo.file_id);
      const story = current.audience === 'standard'
        ? await postPhotoStoryBotApi(token, connectionId, original, message.caption || '')
        : await postPhotoStoryMtproto(token, connectionId, original, message.caption || '', current.audience, current.selected, current.excluded);

      const next = { ...current, bc: connectionId };
      await saveSettings(token, chatId, origin, next);
      await showPanel(token, chatId, origin, next, `✅ Story опубликована\n\n👁 ${audienceLabel(next.audience, next.selected)}${next.excluded?.length ? `\n🚫 Кроме: ${next.excluded.map(u => `@${u}`).join(', ')}` : ''}\n\n📸 Отправь следующее фото — настройки сохранятся.`);
      res.status(200).json({ ok: true, story_id: story.id, transport: story.transport });
      return;
    }

    await showPanel(token, chatId, origin, settings);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error', error?.telegram || error);
    const chatId = update?.callback_query?.message?.chat?.id || update?.message?.chat?.id || update?.business_connection?.user_chat_id;
    const description = error?.telegram?.description || error?.message || String(error);
    if (chatId) {
      const settings = await getStoredSettings(token, chatId).catch(() => defaultSettings());
      await showPanel(token, chatId, origin, settings, `❌ Не получилось опубликовать\n\n${friendlyError(description)}`).catch(() => {});
    }
    res.status(200).json({ ok: false, error: description });
  }
}
