import crypto from 'node:crypto';
import sharp from 'sharp';

const PICK_SELECTED = 7101;
const PICK_EXCLUDED = 7102;

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
  return [...new Set(String(text || '').split(/[\s,;]+/).map(normalizeUsername).filter(Boolean))].slice(0, 50);
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

function inlineMenu(settings = {}) {
  const active = settings.audience || 'standard';
  const mark = (mode, label) => active === mode ? `✅ ${label}` : label;
  const exc = settings.excluded?.length || 0;
  return {
    inline_keyboard: [
      [{ text: '🚀 Старт', callback_data: 'home' }],
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
      [
        { text: mark('standard', '⚡ Стандарт'), callback_data: 'aud:standard' },
        { text: '📊 Настройки', callback_data: 'settings' },
      ],
      [{ text: '📸 Как публиковать', callback_data: 'howto' }],
    ],
  };
}

function userPicker(kind) {
  const isExclude = kind === 'exclude';
  return {
    keyboard: [
      [{
        text: isExclude ? '🚫 Выбрать, кого исключить' : '🎯 Выбрать людей',
        request_users: {
          request_id: isExclude ? PICK_EXCLUDED : PICK_SELECTED,
          user_is_bot: false,
          max_quantity: 10,
          request_name: true,
          request_username: true,
          request_photo: true,
        },
      }],
      [{ text: '✖️ Отмена выбора' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
    input_field_placeholder: 'Нажми кнопку — откроется список людей',
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

async function removePicker(token, chatId, text = '✅ Готово') {
  await tg(token, 'sendMessage', {
    chat_id: chatId,
    text,
    disable_notification: true,
    reply_markup: { remove_keyboard: true },
  }).catch(() => {});
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
        excluded: (url.searchParams.get('exc') || '').split(',').map(normalizeUsername).filter(Boolean),
        picking: url.searchParams.get('pick') || '',
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

async function rememberConnection(token, chatId, connectionId, origin) {
  const settings = await getStoredSettings(token, chatId);
  await saveSettings(token, chatId, origin, { ...settings, bc: connectionId });
}

async function showHome(token, chatId, settings) {
  const exc = settings.excluded?.length ? `\n🚫 Не увидят: ${settings.excluded.map(u => `@${u}`).join(', ')}` : '';
  await sendMessage(
    token,
    chatId,
    `✨ Story Pilot\n\n📸 Просто отправь фото — оно публикуется на 24 часа.\n\nСейчас: ${audienceLabel(settings.audience, settings.selected)}${exc}\n\nДля «Мои контакты, кроме…»: нажми «👥 Мои контакты» → «🚫 Исключить».`,
    settings
  );
}

async function beginNativePicker(token, chatId, origin, kind) {
  const settings = await getStoredSettings(token, chatId);
  if (kind === 'exclude' && settings.audience === 'standard') {
    await sendMessage(token, chatId, 'Сначала выбери «Все», «Мои контакты», «Близкие друзья» или «Выбранные», затем нажми «🚫 Исключить».', settings);
    return;
  }
  const next = { ...settings, picking: kind };
  await saveSettings(token, chatId, origin, next);
  await tg(token, 'sendMessage', {
    chat_id: chatId,
    text: kind === 'exclude'
      ? '🚫 Нажми кнопку ниже — Telegram откроет родной список людей. Выбери тех, кому Story показывать НЕ надо.'
      : '🎯 Нажми кнопку ниже — Telegram откроет родной список людей. Выбери, кому показать Story.',
    disable_notification: true,
    reply_markup: userPicker(kind),
  });
}

async function downloadTelegramFile(token, fileId) {
  const file = await tg(token, 'getFile', { file_id: fileId });
  const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  if (!response.ok) throw new Error(`Unable to download Telegram file: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function preparePhoto(buffer) {
  const out = await sharp(buffer)
    .rotate()
    .resize(1080, 1920, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  if (out.length > 10 * 1024 * 1024) throw new Error('Prepared story image exceeds Telegram 10 MB limit');
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
  for (const username of usernames.slice(0, 50)) {
    const resolved = await client.invoke(new Api.contacts.ResolveUsername({ username }));
    const user = resolved?.users?.find(item => item?.accessHash !== undefined) || resolved?.users?.[0];
    if (!user?.id) throw new Error(`Не удалось найти @${username}`);
    users.push(new Api.InputUser({ userId: user.id, accessHash: user.accessHash ?? BigInt(0) }));
  }
  return users;
}

async function buildPrivacyRules(client, Api, audience, selectedUsernames, excludedUsernames) {
  const rules = [];
  if (excludedUsernames?.length) {
    const users = await resolveUsers(client, Api, excludedUsernames);
    if (users.length) rules.push(new Api.InputPrivacyValueDisallowUsers({ users }));
  }
  if (audience === 'all') rules.push(new Api.InputPrivacyValueAllowAll({}));
  else if (audience === 'contacts') rules.push(new Api.InputPrivacyValueAllowContacts({}));
  else if (audience === 'close') rules.push(new Api.InputPrivacyValueAllowCloseFriends({}));
  else if (audience === 'selected') {
    if (!selectedUsernames?.length) throw new Error('Список выбранных людей пуст');
    rules.push(new Api.InputPrivacyValueAllowUsers({ users: await resolveUsers(client, Api, selectedUsernames) }));
  } else throw new Error(`Unknown audience mode: ${audience}`);
  return rules;
}

async function postPhotoStoryMtproto(token, connectionId, imageBuffer, caption, audience, selected, excluded) {
  if (!mtprotoConfigured()) throw new Error('MTProto не настроен');
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
    if (!userId) throw new Error('Не удалось определить business account');
    const businessUser = updates?.users?.find(item => String(item?.id) === String(userId));
    const peer = new Api.InputPeerUser({ userId, accessHash: businessUser?.accessHash ?? BigInt(0) });
    const prepared = await preparePhoto(imageBuffer);
    const uploaded = await client.uploadFile({ file: new CustomFile('story.jpg', prepared.length, '', prepared), workers: 1 });
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

async function applyAudience(token, chatId, origin, audience) {
  const settings = await getStoredSettings(token, chatId);
  if (audience !== 'standard' && !mtprotoConfigured()) {
    await sendMessage(token, chatId, '⚠️ Расширенная аудитория пока недоступна.', settings);
    return;
  }
  const next = { ...settings, audience, picking: '' };
  await saveSettings(token, chatId, origin, next);
  await sendMessage(token, chatId, `✅ Аудитория: ${audienceLabel(audience, next.selected)}\n\nТеперь просто отправь фото.`, next);
}

function sharedUsernames(usersShared) {
  return [...new Set((usersShared?.users || []).map(u => normalizeUsername(u.username)).filter(Boolean))];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true, service: 'telegram-story-bot-v4' });
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
        await sendMessage(token, bc.user_chat_id, 'Включи «Управление историями» в «Автоматизация чатов».');
        res.status(200).json({ ok: true });
        return;
      }
      await rememberConnection(token, bc.user_chat_id, bc.id, origin);
      await showHome(token, bc.user_chat_id, await getStoredSettings(token, bc.user_chat_id));
      res.status(200).json({ ok: true });
      return;
    }

    if (update?.callback_query) {
      const q = update.callback_query;
      const chatId = q.message?.chat?.id;
      const action = String(q.data || '');
      if (!chatId) {
        res.status(200).json({ ok: true, ignored: true });
        return;
      }
      await tg(token, 'answerCallbackQuery', { callback_query_id: q.id }).catch(() => {});
      let settings = await getStoredSettings(token, chatId);

      if (action === 'home') await showHome(token, chatId, settings);
      else if (action === 'pick:selected') await beginNativePicker(token, chatId, origin, 'selected');
      else if (action === 'pick:exclude') await beginNativePicker(token, chatId, origin, 'exclude');
      else if (action.startsWith('aud:')) await applyAudience(token, chatId, origin, action.slice(4));
      else if (action === 'exclude:clear') {
        settings = { ...settings, excluded: [], picking: '' };
        await saveSettings(token, chatId, origin, settings);
        await sendMessage(token, chatId, '🧹 Исключения очищены.', settings);
      } else if (action === 'settings') {
        await sendMessage(token, chatId, `📊 Настройки\n\nАудитория: ${audienceLabel(settings.audience, settings.selected)}\n🚫 Исключения: ${settings.excluded?.length ? settings.excluded.map(u => `@${u}`).join(', ') : 'нет'}\nBusiness: ${settings.bc ? '✅' : '❌'}\nMTProto: ${mtprotoConfigured() ? '✅' : '❌'}`, settings);
      } else if (action === 'howto') {
        await sendMessage(token, chatId, '📸 Быстрый путь:\n\n1. Выбери аудиторию.\n2. Для «контакты, кроме…» нажми «🚫 Исключить» → «Выбрать, кого исключить».\n3. Telegram откроет родной список людей.\n4. Отправь фото — Story публикуется автоматически.', settings);
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

    if (message.web_app_data?.data === 'storypilot:home') {
      await showHome(token, chatId, settings);
      res.status(200).json({ ok: true, home: true });
      return;
    }

    if (text === '/start' || text === '/help' || text === '🚀 Старт') {
      await showHome(token, chatId, settings);
      res.status(200).json({ ok: true });
      return;
    }

    if (text === '✖️ Отмена выбора') {
      settings = { ...settings, picking: '' };
      await saveSettings(token, chatId, origin, settings);
      await removePicker(token, chatId, '✖️ Выбор отменён');
      await showHome(token, chatId, settings);
      res.status(200).json({ ok: true });
      return;
    }

    if (message.users_shared) {
      const usernames = sharedUsernames(message.users_shared);
      const total = message.users_shared.users?.length || 0;
      const missing = total - usernames.length;
      const requestId = Number(message.users_shared.request_id);
      await removePicker(token, chatId, '✅ Люди выбраны');

      if (!usernames.length) {
        await sendMessage(token, chatId, 'Telegram открыл список, но у выбранных людей нет доступных @username. Для автоматической публикации боту нужен username. Можешь прислать @username вручную или использовать родной редактор Telegram.', settings);
        res.status(200).json({ ok: true, missing_usernames: total });
        return;
      }

      if (requestId === PICK_EXCLUDED) {
        const merged = [...new Set([...(settings.excluded || []), ...usernames])].slice(0, 50);
        const next = { ...settings, excluded: merged, picking: '' };
        await saveSettings(token, chatId, origin, next);
        await sendMessage(token, chatId, `✅ Не увидят: ${merged.map(u => `@${u}`).join(', ')}${missing ? `\n\n⚠️ ${missing} выбранных без @username не добавлены автоматически.` : ''}`, next);
      } else {
        const next = { ...settings, audience: 'selected', selected: usernames.slice(0, 50), picking: '' };
        await saveSettings(token, chatId, origin, next);
        await sendMessage(token, chatId, `✅ Увидят: ${next.selected.map(u => `@${u}`).join(', ')}${missing ? `\n\n⚠️ ${missing} выбранных без @username не добавлены автоматически.` : ''}`, next);
      }
      res.status(200).json({ ok: true, usernames });
      return;
    }

    if (settings.picking && text) {
      const usernames = parseUsernames(text);
      if (usernames.length) {
        await removePicker(token, chatId, '✅ Сохранено');
        if (settings.picking === 'exclude') {
          const next = { ...settings, excluded: [...new Set([...(settings.excluded || []), ...usernames])].slice(0, 50), picking: '' };
          await saveSettings(token, chatId, origin, next);
          await sendMessage(token, chatId, `✅ Не увидят: ${next.excluded.map(u => `@${u}`).join(', ')}`, next);
        } else {
          const next = { ...settings, audience: 'selected', selected: usernames, picking: '' };
          await saveSettings(token, chatId, origin, next);
          await sendMessage(token, chatId, `✅ Увидят: ${next.selected.map(u => `@${u}`).join(', ')}`, next);
        }
        res.status(200).json({ ok: true });
        return;
      }
    }

    if (message.photo?.length) {
      const current = await getStoredSettings(token, chatId);
      const connectionId = message.business_connection_id || current.bc;
      if (!connectionId) {
        await sendMessage(token, chatId, 'Нужно один раз переподключить Story Pilot в «Автоматизация чатов» с правом «Управление историями».', current);
        res.status(200).json({ ok: true, needs_rebind: true });
        return;
      }
      const connection = await tg(token, 'getBusinessConnection', { business_connection_id: connectionId });
      if (!connection.is_enabled) throw new Error('Business connection is disabled');
      if (!connection.rights?.can_manage_stories) throw new Error('Нет права can_manage_stories');
      if (current.audience === 'standard' && current.excluded?.length) {
        await sendMessage(token, chatId, '⚠️ Исключения работают только в режимах «Все», «Мои контакты», «Близкие друзья» или «Выбранные».', current);
        res.status(200).json({ ok: true });
        return;
      }
      const photo = message.photo[message.photo.length - 1];
      const original = await downloadTelegramFile(token, photo.file_id);
      const story = current.audience === 'standard'
        ? await postPhotoStoryBotApi(token, connectionId, original, message.caption || '')
        : await postPhotoStoryMtproto(token, connectionId, original, message.caption || '', current.audience, current.selected, current.excluded);
      const exc = current.excluded?.length ? `\n🚫 Кроме: ${current.excluded.map(u => `@${u}`).join(', ')}` : '';
      await sendMessage(token, chatId, `✅ В Story\n👁 ${audienceLabel(current.audience, current.selected)}${exc}\n#${story.id}`, current);
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
