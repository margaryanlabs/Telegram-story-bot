import crypto from 'node:crypto';
const CONTROL_BUILD = '20260926-1117';
import sharp from 'sharp';
import { trackPublishedStory, markStoryDeleted } from '../lib/viewer-sync-store.js';
import {
  archiveBusinessMediaVault,
  archiveBusinessMessage,
  archiveDeletedBusinessMessages,
} from '../lib/privacy-business.js';

const PICK_SELECTED = 10101;
const PICK_EXCLUDED = 10102;
const MAX_SAVED_USERS = 100;
const MAX_HISTORY = 12;
const MAX_STORY_BYTES = 10 * 1024 * 1024;
const STORY_PERIOD_SECONDS = 86400;

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

const AUDIENCE_CODE = {
  standard: 's',
  all: 'a',
  contacts: 'c',
  close: 'f',
  selected: 'u',
};

const CODE_AUDIENCE = Object.fromEntries(Object.entries(AUDIENCE_CODE).map(([key, value]) => [value, key]));

function encodeHistory(history = []) {
  return history.slice(0, MAX_HISTORY).map(item => [
    String(item.id || ''),
    Math.max(0, Number(item.ts || 0)).toString(36),
    AUDIENCE_CODE[item.audience] || 's',
    Math.max(0, Number(item.excluded || 0)),
    Math.max(0, Number(item.selected || 0)),
    item.protect ? 1 : 0,
    item.deleted ? 1 : 0,
  ].join('.')).join('~');
}

function decodeHistory(value) {
  return String(value || '').split('~').filter(Boolean).slice(0, MAX_HISTORY).map(chunk => {
    const [id, ts36, audienceCode, excluded, selected, protect, deleted] = chunk.split('.');
    return {
      id: String(id || ''),
      ts: parseInt(ts36 || '0', 36) || 0,
      audience: CODE_AUDIENCE[audienceCode] || 'standard',
      excluded: Number(excluded || 0) || 0,
      selected: Number(selected || 0) || 0,
      protect: protect === '1',
      deleted: deleted === '1',
    };
  }).filter(item => item.id);
}

function appendHistory(settings, story) {
  const record = {
    id: String(story.id),
    ts: Math.floor(Date.now() / 1000),
    audience: settings.audience || 'standard',
    excluded: settings.excluded?.length || 0,
    selected: settings.selected?.length || 0,
    protect: Boolean(settings.protect),
    deleted: false,
  };
  return [
    record,
    ...(settings.history || []).filter(item => String(item.id) !== record.id),
  ].slice(0, MAX_HISTORY);
}

function markHistoryDeleted(history, storyId) {
  return (history || []).map(item => String(item.id) === String(storyId) ? { ...item, deleted: true } : item);
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
    canStories: false,
    canReadMessages: false,
    audience: 'standard',
    selected: [],
    excluded: [],
    picking: '',
    panel: null,
    pickerMessage: null,
    lastMessage: null,
    lastStory: null,
    history: [],
    processing: false,
    protect: false,
  };
}

function inlineMenu(settings = {}, origin = '') {
  const active = settings.audience || 'standard';
  const mark = (mode, label) => active === mode ? `✅ ${label}` : label;
  const exc = settings.excluded?.length || 0;
  const ready = Boolean(settings.bc && settings.canStories);

  if (!ready) {
    return {
      inline_keyboard: [
        [{ text: settings.bc ? '⚠️ Разрешить управление Stories' : '🔗 Подключить Telegram', callback_data: 'view:connect' }],
        ...(origin ? [[
          { text: '👻 Ghost', web_app: { url: ghostAppUrl(origin, { screen:'privacy' }) } },
          { text: '↶ Удалённые', web_app: { url: ghostAppUrl(origin, { screen:'chats', filter:'deleted' }) } },
        ]] : []),
        [{ text: '✅ Я подключил — проверить', callback_data: 'connect:check' }],
        [{ text: '📸 Как это работает', callback_data: 'view:howto' }],
      ],
    };
  }

  const connectionText = '✅ Telegram подключён';
  return {
    inline_keyboard: [
      [
        { text: mark('all', '🌍 Все'), callback_data: 'aud:all' },
        { text: mark('contacts', '👥 Мои контакты'), callback_data: 'aud:contacts' },
      ],
      [
        { text: mark('close', '⭐ Близкие друзья'), callback_data: 'aud:close' },
        { text: mark('selected', `🎯 Выбранные${settings.selected?.length ? ` (${settings.selected.length})` : ''}`), callback_data: 'pick:selected' },
      ],
      [
        { text: `🚫 Исключить${exc ? ` (${exc})` : ''}`, callback_data: 'pick:exclude' },
        { text: '🧹 Очистить', callback_data: 'exclude:clear' },
      ],
      [
        { text: settings.protect ? '🛡 Защита: ВКЛ' : '🛡 Защита: ВЫКЛ', callback_data: 'protect:toggle' },
        { text: settings.lastStory ? '🗑 Удалить Story' : '🗑 Нет Story', callback_data: 'story:delete' },
      ],
      [{ text: connectionText, callback_data: 'view:connect' }],
      ...(origin ? [[
        { text: '👻 Ghost', web_app: { url: ghostAppUrl(origin, { screen:'privacy' }) } },
        { text: '↶ Удалённые', web_app: { url: ghostAppUrl(origin, { screen:'chats', filter:'deleted' }) } },
      ]] : []),
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
      text: isExclude ? '🚫 Добавить людей (до 10)' : '🎯 Добавить людей (до 10)',
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
      const bc = url.searchParams.get('bc') || null;
      const canStoriesParam = url.searchParams.get('cs');
      const canReadMessagesParam = url.searchParams.get('cr');
      return {
        bc,
        canStories: canStoriesParam === null ? Boolean(bc) : canStoriesParam === '1',
        canReadMessages: canReadMessagesParam === '1',
        audience: url.searchParams.get('aud') || 'standard',
        selected: (url.searchParams.get('sel') || '').split(',').map(normalizeUsername).filter(Boolean).slice(0, MAX_SAVED_USERS),
        excluded: (url.searchParams.get('exc') || '').split(',').map(normalizeUsername).filter(Boolean).slice(0, MAX_SAVED_USERS),
        picking: url.searchParams.get('pick') || '',
        panel: Number(url.searchParams.get('panel') || 0) || null,
        pickerMessage: Number(url.searchParams.get('pm') || 0) || null,
        lastMessage: Number(url.searchParams.get('lm') || 0) || null,
        lastStory: url.searchParams.get('ls') || null,
        history: decodeHistory(url.searchParams.get('hist')),
        processing: url.searchParams.get('pr') === '1',
        protect: url.searchParams.get('prot') === '1',
      };
    }
  } catch {}
  return defaultSettings();
}

async function saveSettings(token, chatId, origin, settings) {
  const url = new URL('/studio.html', origin);
  url.searchParams.set('v', CONTROL_BUILD);
  url.searchParams.set('v', CONTROL_BUILD);
  if (settings.bc) {
    url.searchParams.set('bc', settings.bc);
    url.searchParams.set('cs', settings.canStories ? '1' : '0');
    url.searchParams.set('cr', settings.canReadMessages ? '1' : '0');
  }
  url.searchParams.set('aud', settings.audience || 'standard');
  if (settings.selected?.length) url.searchParams.set('sel', settings.selected.slice(0, MAX_SAVED_USERS).join(','));
  if (settings.excluded?.length) url.searchParams.set('exc', settings.excluded.slice(0, MAX_SAVED_USERS).join(','));
  if (settings.picking) url.searchParams.set('pick', settings.picking);
  if (settings.panel) url.searchParams.set('panel', String(settings.panel));
  if (settings.pickerMessage) url.searchParams.set('pm', String(settings.pickerMessage));
  if (settings.lastMessage) url.searchParams.set('lm', String(settings.lastMessage));
  if (settings.lastStory) url.searchParams.set('ls', String(settings.lastStory));
  if (settings.history?.length) url.searchParams.set('hist', encodeHistory(settings.history));
  if (settings.processing) url.searchParams.set('pr', '1');
  if (settings.protect) url.searchParams.set('prot', '1');

  await tg(token, 'setChatMenuButton', {
    chat_id: chatId,
    menu_button: {
      type: 'web_app',
      text: 'Открыть Control',
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
  if (!settings.bc) {
    return '◉ Telegram Control\n\nPrivacy, Messages, Stories и Intelligence — в одном центре.\n\nЕсли подключаешься впервые:\n1️⃣ Telegram → Настройки → Telegram Business / «Автоматизация чатов».\n2️⃣ Добавь @Storypilotlab_bot.\n3️⃣ Включи «Управление историями» и доступ к сообщениям / чтению сообщений.\n4️⃣ Разреши нужные чаты.\n5️⃣ Вернись и нажми «✅ Я подключил — проверить».\n\nУже подключён, но бот этого не видит? Измени одно из разрешений и сохрани — Telegram пришлёт боту свежий статус подключения.';
  }

  if (!settings.canStories) {
    return '⚠️ Почти готово\n\nTelegram видит подключение бота, но ему не разрешено управлять Stories.\n\nОткрой Telegram → Настройки → Telegram Business / Автоматизация чатов → @Storypilotlab_bot и включи «Управление историями».\n\nПотом нажми «✅ Я подключил — проверить».';
  }

  const excluded = settings.excluded?.length
    ? `\n🚫 Не увидят: ${settings.excluded.map(u => `@${u}`).join(', ')}`
    : '';
  return `◉ Telegram Control\n\n✅ Telegram подключён\n👁 ${audienceLabel(settings.audience, settings.selected)}${excluded}\n🛡 Защита: ${settings.protect ? 'ВКЛ' : 'ВЫКЛ'}\n\n📸 Отправь фото или JPG/PNG/WEBP — опубликую его как Story.`;
}

function settingsText(settings, live = null) {
  let connection = settings.bc
    ? (settings.canStories ? '✅ активно, Stories разрешены' : '⚠️ подключено, но без доступа к Stories')
    : '⚪ ID подключения ещё не получен';
  if (live === false) connection = '❌ неактивно';
  return `📊 Telegram Control\n\n👁 Аудитория: ${audienceLabel(settings.audience, settings.selected)}\n🚫 Исключения: ${settings.excluded?.length ? settings.excluded.map(u => `@${u}`).join(', ') : 'нет'}\n🛡 Защита от пересылки/сохранения: ${settings.protect ? '✅ ВКЛ' : '❌ ВЫКЛ'}\n🔌 Telegram: ${connection}\n👻 Доступ к сообщениям для Ghost: ${settings.canReadMessages ? '✅ есть' : '⚠️ не выдан'}\n🧠 Расширенная приватность: ${mtprotoConfigured() ? '✅ готова' : '❌ не настроена'}\n\nНастройки сохраняются для следующих Stories.`;
}

function connectText(settings, live = null) {
  if (settings.bc && settings.canStories && live !== false) {
    return `✅ Telegram подключён\n\nTelegram Control готов управлять Stories.\n${settings.canReadMessages ? '👻 Ghost: доступ к сообщениям тоже включён.' : '👻 Ghost: для Anti-Delete и удалённых сообщений ещё включи доступ к сообщениям / чтению сообщений в настройках Business-бота.'}\n\n📸 Для Story просто отправь фото в этот чат.`;
  }

  if (settings.bc && live !== false) {
    return '⚠️ Подключение найдено, но не хватает разрешения\n\nTelegram → Настройки → Telegram Business / «Автоматизация чатов» → Telegram Control → включи «Управление историями».\n\nПосле сохранения вернись сюда и нажми «✅ Я подключил — проверить».';
  }

  return '🔗 Подключить Telegram\n\nЭто делается один раз для каждого пользователя:\n\n1️⃣ Telegram → Настройки → Telegram Business / «Автоматизация чатов».\n2️⃣ Добавь @Storypilotlab_bot.\n3️⃣ Разреши «Управление историями».\n4️⃣ Для Ghost включи доступ к сообщениям / чтению сообщений и выбери нужные чаты.\n5️⃣ Сохрани и вернись сюда.\n6️⃣ Нажми «✅ Я подключил — проверить».\n\nЕсли @Storypilotlab_bot уже выбран в Telegram, а здесь подключение не найдено: измени одно разрешение и сохрани. Это заставит Telegram прислать боту актуальный Business Connection.\n\nBusiness-функции работают через официальное подключение Telegram. Deep Intelligence подключается отдельно и добровольно.';
}

function howToText(settings) {
  if (!settings.bc || !settings.canStories) {
    return '◉ Как работает Telegram Control\n\n1. Один раз подключаешь @Storypilotlab_bot через Telegram Business / «Автоматизация чатов».\n2. Для Stories разрешаешь управление историями; для Ghost — доступ к сообщениям и нужным чатам.\n3. Возвращаешься в Control Center: Home, Ghost, Chats, Stories и Intelligence.\n4. Deep Intelligence подключается отдельно, только если нужны viewer analytics и alerts.\n5. Для Story можешь также просто отправить фото в этот чат.\n\nStories и Ghost используют Telegram Business; Deep Intelligence — отдельную защищённую приватную сессию.';
  }

  return `◉ Telegram Control\n\n📸 Stories: выбери аудиторию и отправь фото или публикуй из Mini App.\n👻 Ghost: открой Mini App → Ghost; нужен доступ к сообщениям в Telegram Business.\n👁 Intelligence: подключается отдельно для viewer analytics и alerts.\n💬 Chats: Ghost archive, поиск, edits и deleted messages.\n\nСейчас аудитория Stories: ${audienceLabel(settings.audience, settings.selected)}.`;
}

async function editPanel(token, chatId, messageId, text, settings, origin = '') {
  try {
    await tg(token, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      disable_web_page_preview: true,
      reply_markup: inlineMenu(settings, origin),
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
      const id = await editPanel(token, chatId, target, text || homeText(settings), settings, origin);
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
    reply_markup: inlineMenu(settings, origin),
  });
  const next = { ...settings, panel: message.message_id };
  await saveSettings(token, chatId, origin, next);
  return next;
}

async function showFreshPanel(token, chatId, origin, settings, text = null) {
  // Explicit slash commands must produce visible feedback next to the user's command.
  // Reusing an older editable panel can make the bot look dead when that panel is days above.
  const fresh = { ...settings, panel: null };
  await saveSettings(token, chatId, origin, fresh);
  return showPanel(token, chatId, origin, fresh, text);
}

async function removePicker(token, chatId, settings) {
  await clearReplyKeyboard(token, chatId);
  if (settings.pickerMessage) {
    await tg(token, 'deleteMessage', { chat_id: chatId, message_id: settings.pickerMessage }).catch(() => {});
  }
}

async function beginNativePicker(token, chatId, origin, settings, kind) {
  if (kind === 'exclude' && !['all', 'contacts'].includes(settings.audience)) {
    return showPanel(token, chatId, origin, settings, '⚠️ Исключения работают для режимов «🌍 Все» и «👥 Мои контакты». Выбери один из них, затем нажми «🚫 Исключить».', settings.panel);
  }

  await clearReplyKeyboard(token, chatId);
  const prompt = await tg(token, 'sendMessage', {
    chat_id: chatId,
    text: kind === 'exclude'
      ? `🚫 Добавь людей, которым Story показывать НЕ надо.\n\nСейчас исключено: ${settings.excluded?.length || 0}. Telegram даёт выбрать до 10 за один раз — можно открывать выбор повторно и добавлять ещё.`
      : `🎯 Добавь людей, которым нужно показать Story.\n\nСейчас выбрано: ${settings.selected?.length || 0}. Telegram даёт выбрать до 10 за один раз — можно открывать выбор повторно и добавлять ещё.`,
    disable_notification: true,
    reply_markup: userPicker(kind),
  });
  const next = { ...settings, picking: kind, pickerMessage: prompt.message_id };
  await saveSettings(token, chatId, origin, next);
  return next;
}

async function refreshConnection(token, chatId, origin, settings) {
  if (!settings.bc) return { settings: { ...settings, canStories: false, canReadMessages: false }, live: false, rights: false, readRights: false };
  try {
    const connection = await tg(token, 'getBusinessConnection', { business_connection_id: settings.bc });
    const live = Boolean(connection?.is_enabled);
    const rights = Boolean(connection?.rights?.can_manage_stories);
    const readRights = Boolean(connection?.rights?.can_read_messages);
    if (!live) {
      const next = { ...settings, bc: null, canStories: false, canReadMessages: false };
      await saveSettings(token, chatId, origin, next);
      return { settings: next, live: false, rights: false, readRights: false };
    }
    const next = {
      ...settings,
      canStories: rights,
      canReadMessages: readRights,
    };
    if (
      next.canStories !== settings.canStories
      || next.canReadMessages !== settings.canReadMessages
    ) {
      await saveSettings(token, chatId, origin, next);
    }
    return { settings: next, live: true, rights, readRights };
  } catch {
    const next = { ...settings, bc: null, canStories: false, canReadMessages: false };
    await saveSettings(token, chatId, origin, next).catch(() => {});
    return { settings: next, live: false, rights: false, readRights: false };
  }
}

async function persistBusinessConnection(token, origin, connection, { notify = false } = {}) {
  const chatId = connection?.user_chat_id;
  if (!chatId) return null;

  const settings = await getStoredSettings(token, chatId);
  const live = Boolean(connection?.is_enabled);
  const rights = Boolean(connection?.rights?.can_manage_stories);
  const readRights = Boolean(connection?.rights?.can_read_messages);
  const next = {
    ...settings,
    bc: live ? connection.id : null,
    canStories: live && rights,
    canReadMessages: live && readRights,
    processing: false,
    ...(live && rights ? { picking: '', pickerMessage: null } : {}),
  };

  await saveSettings(token, chatId, origin, next);

  console.log('Story Pilot business connection sync', {
    chat_id: chatId,
    connection_present: Boolean(connection?.id),
    enabled: live,
    can_manage_stories: rights,
    can_read_messages: readRights,
    source: notify ? 'business_connection_update' : 'business_activity_recovery',
  });

  if (notify) {
    const text = live
      ? connectText(next, true)
      : '⚠️ Telegram Control отключён от Telegram Business. Подключи бота снова, чтобы публиковать Stories.';
    await showFreshPanel(token, chatId, origin, next, text);
  }

  return next;
}

function ghostAppUrl(origin, options = {}) {
  const url = new URL('/studio.html', origin);
  url.searchParams.set('v', CONTROL_BUILD);

  const chatId = options.chatId ? String(options.chatId) : '';
  const messageId = Number(options.messageId || 0);
  const mode = String(options.mode || '');
  const filter = String(options.filter || '');

  url.searchParams.set('screen', chatId ? 'chats' : (options.screen || 'privacy'));
  if (chatId) url.searchParams.set('chat', chatId);
  if (messageId > 0) url.searchParams.set('message', String(messageId));
  if (mode) url.searchParams.set('mode', mode);
  if (filter) url.searchParams.set('filter', filter);
  return url.toString();
}

function ghostMessagePreview(row = {}) {
  const value = row.text_content || row.caption || (row.media_type ? `[${row.media_type}]` : 'Сообщение');
  return String(value || 'Сообщение').replace(/\s+/g, ' ').trim().slice(0, 180);
}

async function sendGhostDeleteAlert(token, ownerChatId, origin, events = [], settings = {}, mediaRecoveryResults = []) {
  const allIncoming = (Array.isArray(events) ? events : [])
    .filter(event => event?.direction !== 'outgoing');
  const incoming = allIncoming.slice(0, 5);
  if (!ownerChatId || !incoming.length) return false;

  const lines = incoming.map(event => {
    const sender = event.sender || event.chatTitle || 'Telegram user';
    const preview = String(event.preview || 'Сообщение').replace(/\s+/g, ' ').trim().slice(0, 180);
    return `• ${sender}: ${preview}`;
  });

  const extra = allIncoming.length > incoming.length
    ? `\n+ ещё ${allIncoming.length - incoming.length}`
    : '';

  const mediaResults = Array.isArray(mediaRecoveryResults) ? mediaRecoveryResults : [];
  const mediaRecovered = mediaResults.filter(item => item?.archived).length;
  const mediaStatus = mediaResults.length
    ? mediaRecovered === mediaResults.length
      ? `\n\n▣ Media Vault: сохранено ${mediaRecovered}/${mediaResults.length}`
      : `\n\n⚠ Media Vault: сохранено ${mediaRecovered}/${mediaResults.length}. Текст и метаданные Ghost всё равно сохранены.`
    : '';

  await tg(token, 'sendMessage', {
    chat_id: ownerChatId,
    text: `👻 Anti-Delete\n\nУдалено ${incoming.length === 1 ? 'сообщение' : 'сообщения'}:\n${lines.join('\n')}${extra}\n\nКопия сохранена в Ghost.${mediaStatus}`,
    disable_notification: false,
    reply_markup: {
      inline_keyboard: [
        ...(settings?.ghostFocus !== false && incoming[0]?.chatId && incoming[0]?.messageId
          ? [[{
              text: '👻 Открыть это удалённое',
              web_app: {
                url: ghostAppUrl(origin, {
                  chatId: incoming[0].chatId,
                  messageId: incoming[0].messageId,
                  mode: 'focus',
                }),
              },
            }]]
          : []),
        [{
          text: '↶ Все удалённые',
          web_app: { url: ghostAppUrl(origin, { screen:'chats', filter:'deleted' }) },
        }],
      ],
    },
  });
  return true;
}

async function sendGhostEditAlert(token, ownerChatId, origin, row = {}, settings = {}) {
  if (!ownerChatId || !row || row.direction === 'outgoing') return false;
  const sender = row.sender_display_name || (row.sender_username ? `@${row.sender_username}` : null) || row.chat_title || 'Telegram user';
  await tg(token, 'sendMessage', {
    chat_id: ownerChatId,
    text: `✏️ Edit History\n\n${sender} изменил сообщение:\n${ghostMessagePreview(row)}\n\nВерсия сохранена в Ghost.`,
    disable_notification: false,
    reply_markup: {
      inline_keyboard: [
        ...(settings?.ghostFocus !== false && row?.chat_id && row?.message_id
          ? [[{
              text: '✏️ Открыть это изменение',
              web_app: {
                url: ghostAppUrl(origin, {
                  chatId: row.chat_id,
                  messageId: row.message_id,
                  mode: 'edit',
                }),
              },
            }]]
          : []),
        [{
          text: '≋ Все изменённые',
          web_app: { url: ghostAppUrl(origin, { screen:'chats', filter:'edited' }) },
        }],
      ],
    },
  });
  return true;
}

async function sendAppShortcut(token, chatId, origin, screen, text, buttonText) {
  const url = new URL('/studio.html', origin);
  url.searchParams.set('v', CONTROL_BUILD);
  url.searchParams.set('screen', screen);
  await tg(token, 'sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{ text: buttonText, web_app: { url: url.toString() } }]],
    },
  });
}

function businessConnectionIdFromActivity(update) {
  return update?.business_message?.business_connection_id
    || update?.edited_business_message?.business_connection_id
    || update?.deleted_business_messages?.business_connection_id
    || null;
}

async function downloadTelegramFile(token, fileId) {
  const file = await tg(token, 'getFile', { file_id: fileId });
  const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  if (!response.ok) throw new Error(`Не удалось скачать изображение: HTTP ${response.status}`);
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

  if (out.length > MAX_STORY_BYTES) throw new Error('Готовое фото превышает лимит Telegram 10 MB');
  return out;
}

async function postPhotoStoryBotApi(token, businessConnectionId, imageBuffer, caption = '', protect = false) {
  const prepared = await preparePhoto(imageBuffer);
  const form = new FormData();
  form.set('business_connection_id', businessConnectionId);
  form.set('content', JSON.stringify({ type: 'photo', photo: 'attach://story' }));
  form.set('active_period', String(STORY_PERIOD_SECONDS));
  if (caption) form.set('caption', caption.slice(0, 2048));
  if (protect) form.set('protect_content', 'true');
  form.set('story', new Blob([prepared], { type: 'image/jpeg' }), 'story.jpg');

  const response = await fetch(telegramUrl(token, 'postStory'), { method: 'POST', body: form });
  let data;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || !data?.ok) {
    const err = new Error(data?.description || `postStory failed: ${response.status}`);
    err.telegram = data;
    throw err;
  }
  return { id: data.result.id, transport: 'bot-api' };
}

async function resolveUsers(client, Api, usernames) {
  const users = [];
  const valid = [];
  const skipped = [];
  const unique = [...new Set((usernames || []).map(normalizeUsername).filter(Boolean))].slice(0, MAX_SAVED_USERS);
  const batchSize = 5;

  for (let offset = 0; offset < unique.length; offset += batchSize) {
    const batch = unique.slice(offset, offset + batchSize);
    const results = await Promise.all(batch.map(async (username) => {
      try {
        const resolved = await client.invoke(new Api.contacts.ResolveUsername({ username }));
        const user = resolved?.users?.find(item => item?.accessHash !== undefined) || resolved?.users?.[0];
        if (!user?.id) throw new Error(`Не удалось найти @${username}`);
        return {
          username,
          input: new Api.InputUser({ userId: user.id, accessHash: user.accessHash ?? BigInt(0) }),
        };
      } catch (error) {
        const description = error?.errorMessage || error?.message || String(error);
        if (/USERNAME_NOT_OCCUPIED|USERNAME_INVALID|Не удалось найти/i.test(description)) {
          console.warn('Story Pilot skipped stale privacy username', { username });
          return { username, skipped: true };
        }
        throw error;
      }
    }));

    for (const result of results) {
      if (result.skipped) skipped.push(result.username);
      else {
        users.push(result.input);
        valid.push(result.username);
      }
    }
  }

  return { users, valid, skipped };
}

async function buildPrivacyRules(client, Api, audience, selected, excluded) {
  const rules = [];
  let skippedExcluded = [];
  let skippedSelected = [];

  // Telegram's story clients compose PUBLIC/CONTACTS privacy as the base
  // allow rule first, followed by explicit disallow-user exceptions.
  // The previous implementation reversed this order, which Telegram accepted
  // but could cause the later allow rule to win over the exclusions.
  if (audience === 'all') {
    rules.push(new Api.InputPrivacyValueAllowAll({}));

    if (excluded?.length) {
      const resolved = await resolveUsers(client, Api, excluded);
      skippedExcluded = resolved.skipped;
      if (resolved.users.length) {
        rules.push(new Api.InputPrivacyValueDisallowUsers({ users: resolved.users }));
      }
    }
  } else if (audience === 'contacts') {
    rules.push(new Api.InputPrivacyValueAllowContacts({}));

    if (excluded?.length) {
      const resolved = await resolveUsers(client, Api, excluded);
      skippedExcluded = resolved.skipped;
      if (resolved.users.length) {
        rules.push(new Api.InputPrivacyValueDisallowUsers({ users: resolved.users }));
      }
    }
  } else if (audience === 'close') {
    rules.push(new Api.InputPrivacyValueAllowCloseFriends({}));
  } else if (audience === 'selected') {
    if (!selected?.length) throw new Error('Список выбранных людей пуст');
    const resolved = await resolveUsers(client, Api, selected);
    skippedSelected = resolved.skipped;
    if (!resolved.users.length) {
      throw new Error('Список выбранных людей больше не актуален. Выбери людей заново.');
    }
    rules.push(new Api.InputPrivacyValueAllowUsers({ users: resolved.users }));
  } else {
    throw new Error(`Неизвестный режим аудитории: ${audience}`);
  }

  console.log('Story Pilot privacy rules built', {
    audience,
    rule_order: rules.map(rule => rule?.className || rule?.constructor?.name || 'unknown'),
    excluded_requested: excluded?.length || 0,
    excluded_skipped: skippedExcluded.length,
    selected_requested: selected?.length || 0,
    selected_skipped: skippedSelected.length,
  });

  return { rules, skippedExcluded, skippedSelected };
}

function deterministicRandomId(connectionId, messageId) {
  const digest = crypto.createHash('sha256')
    .update(`${connectionId}:${messageId}`)
    .digest();
  return digest.readBigInt64BE(0);
}

async function postPhotoStoryMtproto(token, connectionId, imageBuffer, caption, audience, selected, excluded, messageId, protect = false) {
  if (!mtprotoConfigured()) throw new Error('Расширенная приватность не настроена');
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = String(process.env.TELEGRAM_API_HASH || '');
  const [{ TelegramClient, Api }, { StringSession }, { CustomFile }] = await Promise.all([
    import('teleproto'), import('teleproto/sessions/index.js'), import('teleproto/client/uploads.js'),
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

    // Validate and clean privacy before doing image processing/upload work.
    const privacy = await buildPrivacyRules(client, Api, audience, selected, excluded);

    // stories.canSendStory is not available to bot sessions and returns BOT_METHOD_INVALID.
    // stories.sendStory itself is explicitly business-bot capable when the controlled
    // business user's peer is supplied directly.
    const prepared = await preparePhoto(imageBuffer);
    const uploaded = await client.uploadFile({
      file: new CustomFile('story.jpg', prepared.length, '', prepared),
      workers: 1,
    });
    const randomId = deterministicRandomId(connectionId, messageId);

    const result = await client.invoke(new Api.stories.SendStory({
      peer,
      media: new Api.InputMediaUploadedPhoto({ file: uploaded }),
      caption: caption ? caption.slice(0, 2048) : undefined,
      privacyRules: privacy.rules,
      randomId,
      period: STORY_PERIOD_SECONDS,
      noforwards: Boolean(protect),
    }));
    const idUpdate = result?.updates?.find(item => item?.className === 'UpdateStoryID' || item?.randomId?.toString?.() === randomId.toString());
    return {
      id: idUpdate?.id ?? 'ok',
      transport: 'mtproto',
      skippedExcluded: privacy.skippedExcluded,
      skippedSelected: privacy.skippedSelected,
    };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

function isTransientMtprotoError(error) {
  const description = String(error?.errorMessage || error?.message || error || '');
  return /ETIMEDOUT|ECONNRESET|EAI_AGAIN|socket hang up|connection closed|timed out|network error/i.test(description)
    && !/FLOOD_WAIT|STORY_SEND_FLOOD/i.test(description);
}

async function postPhotoStoryMtprotoWithRetry(...args) {
  try {
    return await postPhotoStoryMtproto(...args);
  } catch (error) {
    if (!isTransientMtprotoError(error)) throw error;
    console.warn('Story Pilot transient MTProto failure, retrying once', {
      error: error?.errorMessage || error?.message || String(error),
    });
    return postPhotoStoryMtproto(...args);
  }
}

function sharedUsernames(usersShared) {
  return [...new Set((usersShared?.users || []).map(u => normalizeUsername(u.username)).filter(Boolean))];
}

function friendlyError(description = '') {
  const d = String(description);
  if (/PREMIUM_ACCOUNT_REQUIRED/i.test(d)) return 'Telegram требует Premium для этой публикации на данном аккаунте.';
  if (/STORIES_TOO_MUCH/i.test(d)) return 'Достигнут лимит активных Stories. Удали одну Story или дождись, пока старая истечёт.';
  if (/STORY_SEND_FLOOD_WEEKLY/i.test(d)) return 'Достигнут недельный лимит Stories для этого аккаунта.';
  if (/STORY_SEND_FLOOD_MONTHLY/i.test(d)) return 'Достигнут месячный лимит Stories для этого аккаунта.';
  if (/STORY_SEND_FLOOD|FLOOD_WAIT/i.test(d)) return 'Telegram временно ограничил публикации. Нужно подождать до окончания лимита.';
  if (/BUSINESS_CONNECTION_INVALID|Business connection is disabled/i.test(d)) return 'Подключение Telegram Control устарело или отключено. Переподключи бота в «Автоматизация чатов».';
  if (/can_manage_stories|Нет права/i.test(d)) return 'Нет разрешения «Управление историями». Включи его в «Автоматизация чатов».';
  if (/PHOTO_INVALID_DIMENSIONS|IMAGE_PROCESS_FAILED|Input buffer contains unsupported image format/i.test(d)) return 'Telegram не принял изображение. Попробуй JPG, PNG или WEBP.';
  if (/USERNAME_NOT_OCCUPIED|USERNAME_INVALID/i.test(d)) return 'Один из сохранённых usernames больше не существует. Telegram Control очистит такие записи при следующей публикации.';
  if (/STORY_PRIVACY_INVALID|PRIVACY/i.test(d)) return 'Telegram не принял выбранную аудиторию. Попробуй заново выбрать людей.';
  if (/STORY_ID_INVALID|STORY_NOT_FOUND/i.test(d)) return 'Последняя Story уже удалена или больше недоступна.';
  if (/BOT_METHOD_INVALID.*CanSendStory/i.test(d)) return 'Внутренняя проверка Telegram была недоступна для business-бота. Telegram Control уже исправлен — отправь фото ещё раз.';
  if (/BOT_ACCESS_FORBIDDEN/i.test(d)) return 'Telegram запретил эту операцию через текущее Business-подключение.';
  return d;
}

function isSupportedImageDocument(message) {
  const mime = String(message?.document?.mime_type || '').toLowerCase();
  return Boolean(message?.document?.file_id && ['image/jpeg', 'image/png', 'image/webp'].includes(mime));
}

function extractImage(message) {
  if (message.photo?.length) {
    return {
      fileId: message.photo[message.photo.length - 1].file_id,
      caption: message.caption || '',
    };
  }
  if (isSupportedImageDocument(message)) {
    return {
      fileId: message.document.file_id,
      caption: message.caption || '',
    };
  }
  return null;
}

async function resetSettings(token, chatId, origin, settings) {
  const next = {
    ...defaultSettings(),
    bc: settings.bc,
    canStories: settings.canStories,
    panel: settings.panel,
    history: settings.history || [],
  };
  await saveSettings(token, chatId, origin, next);
  return next;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true, service: 'telegram-story-bot-v7' });
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
    const activityConnectionId = businessConnectionIdFromActivity(update);
    if (activityConnectionId) {
      try {
        const connection = await tg(token, 'getBusinessConnection', { business_connection_id: activityConnectionId });
        await persistBusinessConnection(token, origin, connection, { notify: false });
      } catch (error) {
        console.warn('Story Pilot business activity recovery failed', error?.telegram || error?.message || error);
      }
    }

    if (update?.business_connection) {
      await persistBusinessConnection(token, origin, update.business_connection, { notify: true });
      res.status(200).json({ ok: true, business_connection_synced: true });
      return;
    }

    const privacyBusinessMessage = update?.business_message || update?.edited_business_message;
    if (privacyBusinessMessage) {
      const connectionId = privacyBusinessMessage.business_connection_id;
      let result = null;
      try {
        const connection = await tg(token, 'getBusinessConnection', {
          business_connection_id: connectionId,
        });
        result = await archiveBusinessMessage(
          connection,
          privacyBusinessMessage,
          update?.edited_business_message ? 'edit' : 'new',
        );

        if (
          result?.captured
          && result?.settings?.antiDelete
          && result?.row?.media_file_id
        ) {
          result.mediaVault = await archiveBusinessMediaVault(token, result.row);
        }

        if (
          update?.edited_business_message
          && result?.captured
          && result?.settings?.editHistory
          && result?.settings?.notifyEdits !== false
          && result?.row?.direction !== 'outgoing'
        ) {
          result.editAlertSent = await sendGhostEditAlert(
            token,
            connection?.user_chat_id,
            origin,
            result.row,
            result.settings,
          ).catch(error => {
            console.warn('Story Pilot Ghost edit alert skipped', error?.message || error);
            return false;
          });
        }
      } catch (error) {
        // Privacy storage must never make Telegram retry the entire webhook update.
        console.warn('Story Pilot privacy message capture skipped', {
          connection_id: connectionId || null,
          message_id: privacyBusinessMessage.message_id || null,
          error: error?.message || String(error),
        });
      }

      res.status(200).json({
        ok: true,
        privacy_message_captured: Boolean(result?.captured),
        media_vault_archived: Boolean(result?.mediaVault?.archived),
        edited: Boolean(update?.edited_business_message),
        edit_alert_sent: Boolean(result?.editAlertSent),
      });
      return;
    }

    if (update?.deleted_business_messages) {
      const deleted = update.deleted_business_messages;
      let result = null;
      try {
        const connection = await tg(token, 'getBusinessConnection', {
          business_connection_id: deleted.business_connection_id,
        });
        result = await archiveDeletedBusinessMessages(connection, deleted);

        if (result?.retained && Array.isArray(result?.mediaRecovery) && result.mediaRecovery.length) {
          const recovery = [];
          for (const row of result.mediaRecovery.slice(0, 3)) {
            recovery.push(await archiveBusinessMediaVault(token, row).catch(error => ({
              archived: false,
              reason: error?.message || String(error),
            })));
          }
          result.mediaRecoveryResults = recovery;
        }

        if (
          result?.retained
          && result?.settings?.notifyDeletes !== false
          && Array.isArray(result?.events)
          && result.events.length
        ) {
          result.alertSent = await sendGhostDeleteAlert(
            token,
            connection?.user_chat_id,
            origin,
            result.events,
            result.settings,
            result.mediaRecoveryResults,
          ).catch(error => {
            console.warn('Story Pilot Ghost delete alert skipped', error?.message || error);
            return false;
          });
        }
      } catch (error) {
        console.warn('Story Pilot privacy delete capture skipped', {
          connection_id: deleted.business_connection_id || null,
          chat_id: deleted.chat?.id || null,
          message_count: deleted.message_ids?.length || 0,
          error: error?.message || String(error),
        });
      }

      res.status(200).json({
        ok: true,
        privacy_delete_captured: Boolean(result?.affected),
        retained: Boolean(result?.retained),
        affected: Number(result?.affected || 0),
        alert_sent: Boolean(result?.alertSent),
        media_recovery_attempted: Array.isArray(result?.mediaRecoveryResults) ? result.mediaRecoveryResults.length : 0,
        media_recovered: Array.isArray(result?.mediaRecoveryResults)
          ? result.mediaRecoveryResults.filter(item => item?.archived).length
          : 0,
      });
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
        const allowed = ['all', 'contacts', 'close', 'standard'];
        if (!allowed.includes(audience)) {
          await showPanel(token, chatId, origin, settings, '⚠️ Неизвестный режим аудитории.', messageId);
        } else if (audience !== 'standard' && !mtprotoConfigured()) {
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
      } else if (action === 'protect:toggle') {
        const next = { ...settings, protect: !settings.protect };
        await saveSettings(token, chatId, origin, next);
        await showPanel(token, chatId, origin, next, homeText(next), messageId);
      } else if (action === 'story:delete') {
        const refreshed = await refreshConnection(token, chatId, origin, settings);
        const current = refreshed.settings;
        const storyId = Number(current.lastStory);
        if (!refreshed.live || !current.bc) {
          await showPanel(token, chatId, origin, current, '🔌 Аккаунт не подключён. Сначала подключи Telegram Control.', messageId);
        } else if (!Number.isInteger(storyId) || storyId <= 0) {
          await showPanel(token, chatId, origin, current, '🗑 Нет сохранённой последней Story для удаления.', messageId);
        } else {
          await tg(token, 'deleteStory', { business_connection_id: current.bc, story_id: storyId });
          await markStoryDeleted(chatId, storyId).catch(error => {
            console.warn('Viewer Sync story delete tracking failed', error?.message || error);
          });
          const next = {
            ...current,
            lastStory: null,
            lastMessage: null,
            processing: false,
            history: markHistoryDeleted(current.history, storyId),
          };
          await saveSettings(token, chatId, origin, next);
          await showPanel(token, chatId, origin, next, '🗑 Последняя Story удалена.', messageId);
        }
      } else if (action === 'view:connect') {
        const refreshed = await refreshConnection(token, chatId, origin, settings);
        await showPanel(token, chatId, origin, refreshed.settings, connectText(refreshed.settings, refreshed.live), messageId);
      } else if (action === 'connect:check') {
        const refreshed = await refreshConnection(token, chatId, origin, settings);
        if (refreshed.live && refreshed.rights) {
          await showPanel(token, chatId, origin, refreshed.settings, connectText(refreshed.settings, true), messageId);
        } else if (refreshed.live) {
          await showPanel(token, chatId, origin, refreshed.settings, connectText(refreshed.settings, true), messageId);
        } else {
          await showPanel(token, chatId, origin, refreshed.settings, '⏳ Telegram Control пока не получил активный Business Connection.\n\nЕсли @Storypilotlab_bot уже выбран в Telegram, как на экране настроек: выключи «Управление историями», включи снова, сохрани и нажми проверить ещё раз. Переподключать весь бот не нужно.', messageId);
        }
      } else if (action === 'view:settings') {
        const refreshed = await refreshConnection(token, chatId, origin, settings);
        await showPanel(token, chatId, origin, refreshed.settings, settingsText(refreshed.settings, refreshed.live), messageId);
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
    const webAppData = String(message.web_app_data?.data || '');

    const command = text.split(/\s+/)[0].split('@')[0];

    if (webAppData === 'storypilot:picker:selected' || webAppData === 'storypilot:picker:exclude') {
      const refreshed = await refreshConnection(token, chatId, origin, settings);
      if (!refreshed.live || !refreshed.rights) {
        await showFreshPanel(token, chatId, origin, refreshed.settings, connectText(refreshed.settings, refreshed.live));
      } else {
        const kind = webAppData.endsWith(':exclude') ? 'exclude' : 'selected';
        await beginNativePicker(token, chatId, origin, refreshed.settings, kind);
      }
      res.status(200).json({ ok: true, miniapp_picker: true });
      return;
    }

    if (webAppData === 'storypilot:home' || command === '/start' || text === '🚀 Старт') {
      await clearReplyKeyboard(token, chatId);
      const refreshed = await refreshConnection(token, chatId, origin, settings);
      const next = { ...refreshed.settings, picking: '', pickerMessage: null, processing: false };
      await saveSettings(token, chatId, origin, next);
      await showFreshPanel(token, chatId, origin, next);
      res.status(200).json({ ok: true });
      return;
    }

    if (command === '/ghost') {
      await sendAppShortcut(
        token,
        chatId,
        origin,
        'privacy',
        '👻 Ghost\n\nAnti-Delete, Edit History, сохранённые медиа и поиск по приватному архиву.',
        '👻 Открыть Ghost',
      );
      res.status(200).json({ ok: true, screen: 'privacy' });
      return;
    }

    if (command === '/deleted') {
      const url = ghostAppUrl(origin, { screen:'chats', filter:'deleted' });
      await tg(token, 'sendMessage', {
        chat_id: chatId,
        text: '↶ Удалённые сообщения\n\nОткрываю Ghost Inbox сразу на сохранённых удалениях.',
        reply_markup: { inline_keyboard: [[{ text:'↶ Открыть удалённые', web_app:{ url } }]] },
      });
      res.status(200).json({ ok: true, screen:'chats', filter:'deleted' });
      return;
    }

    if (command === '/edits') {
      const url = ghostAppUrl(origin, { screen:'chats', filter:'edited' });
      await tg(token, 'sendMessage', {
        chat_id: chatId,
        text: '≋ Изменённые сообщения\n\nОткрываю Ghost Inbox на сообщениях с сохранённой историей правок.',
        reply_markup: { inline_keyboard: [[{ text:'≋ Открыть изменения', web_app:{ url } }]] },
      });
      res.status(200).json({ ok: true, screen:'chats', filter:'edited' });
      return;
    }

    if (command === '/stories') {
      await sendAppShortcut(
        token,
        chatId,
        origin,
        'publish',
        '📸 Stories\n\nПубликация, аудитория, исключения и защита контента.',
        '📸 Открыть Stories',
      );
      res.status(200).json({ ok: true, screen: 'publish' });
      return;
    }

    if (command === '/viewers') {
      await sendAppShortcut(
        token,
        chatId,
        origin,
        'viewers',
        '👁 Viewer Intelligence\n\nПросмотры, повторные зрители, реакции и история аудитории.',
        '👁 Открыть Intelligence',
      );
      res.status(200).json({ ok: true, screen: 'viewers' });
      return;
    }

    if (command === '/help') {
      await showFreshPanel(token, chatId, origin, settings, howToText(settings));
      res.status(200).json({ ok: true });
      return;
    }

    if (command === '/status') {
      const refreshed = await refreshConnection(token, chatId, origin, settings);
      const next = { ...refreshed.settings, processing: false };
      await saveSettings(token, chatId, origin, next);
      await showFreshPanel(token, chatId, origin, next, settingsText(next, refreshed.live));
      res.status(200).json({ ok: true });
      return;
    }

    if (command === '/delete') {
      const refreshed = await refreshConnection(token, chatId, origin, settings);
      const current = refreshed.settings;
      const storyId = Number(current.lastStory);
      if (!refreshed.live || !current.bc) {
        await showFreshPanel(token, chatId, origin, current, '🔌 Аккаунт не подключён. Сначала подключи Telegram Control.');
      } else if (!Number.isInteger(storyId) || storyId <= 0) {
        await showFreshPanel(token, chatId, origin, current, '🗑 Нет сохранённой последней Story для удаления.');
      } else {
        await tg(token, 'deleteStory', { business_connection_id: current.bc, story_id: storyId });
        await markStoryDeleted(chatId, storyId).catch(error => {
          console.warn('Viewer Sync story delete tracking failed', error?.message || error);
        });
        const next = {
          ...current,
          lastStory: null,
          lastMessage: null,
          processing: false,
          history: markHistoryDeleted(current.history, storyId),
        };
        await saveSettings(token, chatId, origin, next);
        await showFreshPanel(token, chatId, origin, next, '🗑 Последняя Story удалена.');
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (command === '/reset') {
      await removePicker(token, chatId, settings);
      const next = await resetSettings(token, chatId, origin, settings);
      await showFreshPanel(token, chatId, origin, next, '♻️ Настройки аудитории сброшены. Подключение аккаунта сохранено.');
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
      } else if (requestId === PICK_SELECTED) {
        const merged = [...new Set([...(settings.selected || []), ...usernames])].slice(0, MAX_SAVED_USERS);
        const next = { ...settings, audience: 'selected', selected: merged, picking: '', pickerMessage: null };
        await saveSettings(token, chatId, origin, next);
        await showPanel(token, chatId, origin, next, `${homeText(next)}\n\n➕ Добавлено: ${usernames.length}. Всего выбранных: ${merged.length}. Нажми «🎯 Выбранные» ещё раз, чтобы добавить следующую группу.${missing ? `\n⚠️ ${missing} выбранных без @username не добавлены.` : ''}`);
      } else {
        const next = { ...settings, picking: '', pickerMessage: null };
        await saveSettings(token, chatId, origin, next);
        await showPanel(token, chatId, origin, next, '⚠️ Не удалось определить тип выбора. Попробуй ещё раз.');
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
          const next = { ...settings, audience: 'selected', selected: [...new Set([...(settings.selected || []), ...usernames])].slice(0, MAX_SAVED_USERS), picking: '', pickerMessage: null };
          await saveSettings(token, chatId, origin, next);
          await showPanel(token, chatId, origin, next);
        }
        res.status(200).json({ ok: true });
        return;
      }
    }

    const image = extractImage(message);
    if (image) {
      const current = await getStoredSettings(token, chatId);
      const connectionId = message.business_connection_id || current.bc;
      if (!connectionId) {
        await showPanel(token, chatId, origin, current, '🔌 Сначала подключи аккаунт. Нажми «🔗 Подключить аккаунт» и выполни 4 коротких шага.');
        res.status(200).json({ ok: true, needs_rebind: true });
        return;
      }

      if (current.lastMessage === message.message_id) {
        const duplicateText = current.lastStory
          ? `✅ Эта Story уже опубликована (#${current.lastStory}). Дубликат не создаю.`
          : '⏳ Эта Story уже обрабатывается. Дубликат не создаю.';
        await showPanel(token, chatId, origin, current, duplicateText);
        res.status(200).json({ ok: true, duplicate: true, story_id: current.lastStory || null });
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

      const pre = {
        ...current,
        bc: connectionId,
        canStories: true,
        lastMessage: message.message_id,
        lastStory: null,
        processing: true,
      };
      await saveSettings(token, chatId, origin, pre);
      await showPanel(
        token,
        chatId,
        origin,
        pre,
        pre.audience === 'standard'
          ? '⏳ Публикую Story через Telegram…'
          : '⏳ Проверяю аудиторию и публикую Story…'
      );

      console.log('Story Pilot publish start', {
        chat_id: chatId,
        audience: pre.audience,
        selected_count: pre.selected?.length || 0,
        excluded_count: pre.excluded?.length || 0,
        transport: pre.audience === 'standard' ? 'bot-api' : 'mtproto',
      });

      const original = await downloadTelegramFile(token, image.fileId);
      const story = pre.audience === 'standard'
        ? await postPhotoStoryBotApi(token, connectionId, original, image.caption, pre.protect)
        : await postPhotoStoryMtprotoWithRetry(token, connectionId, original, image.caption, pre.audience, pre.selected, pre.excluded, message.message_id, pre.protect);

      console.log('Story Pilot publish success', {
        chat_id: chatId,
        audience: pre.audience,
        transport: story.transport,
        story_id: String(story.id),
      });

      const skippedExcluded = story.skippedExcluded || [];
      const skippedSelected = story.skippedSelected || [];
      const next = {
        ...pre,
        processing: false,
        lastStory: String(story.id),
        excluded: (pre.excluded || []).filter(u => !skippedExcluded.includes(u)),
        selected: (pre.selected || []).filter(u => !skippedSelected.includes(u)),
      };
      next.history = appendHistory(next, story);
      await saveSettings(token, chatId, origin, next);

      const postedAt = new Date();
      const watchHours = Math.max(48, Number(process.env.VIEWER_WATCH_HOURS || 72));
      await trackPublishedStory({
        telegram_user_id: String(chatId),
        story_id: Number(story.id),
        posted_at: postedAt.toISOString(),
        expires_at: new Date(postedAt.getTime() + STORY_PERIOD_SECONDS * 1000).toISOString(),
        watch_until: new Date(postedAt.getTime() + watchHours * 60 * 60 * 1000).toISOString(),
        audience: next.audience || 'standard',
        protected: Boolean(next.protect),
        active: true,
        last_error: null,
      }).catch(error => {
        console.warn('Viewer Sync story tracking skipped', error?.message || error);
      });
      const cleaned = [...skippedExcluded, ...skippedSelected];
      await showPanel(token, chatId, origin, next, `✅ Story опубликована\n\n👁 ${audienceLabel(next.audience, next.selected)}${next.excluded?.length ? `\n🚫 Кроме: ${next.excluded.map(u => `@${u}`).join(', ')}` : ''}${next.protect ? '\n🛡 Защита включена' : ''}${cleaned.length ? `\n\n🧹 Удалил из приватности неактуальные usernames: ${cleaned.map(u => `@${u}`).join(', ')}` : ''}\n\n📸 Отправь следующее фото — настройки сохранятся.`);
      res.status(200).json({ ok: true, story_id: story.id, transport: story.transport });
      return;
    }

    if (message.document?.file_id && String(message.document.mime_type || '').startsWith('image/')) {
      await showPanel(token, chatId, origin, settings, '⚠️ Поддерживаются JPG, PNG и WEBP. Отправь изображение в одном из этих форматов.');
      res.status(200).json({ ok: true, unsupported_image: true });
      return;
    }

    await showPanel(token, chatId, origin, settings);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error', error?.telegram || error);
    const chatId = update?.callback_query?.message?.chat?.id || update?.message?.chat?.id || update?.business_connection?.user_chat_id;
    if (update?.message && extractImage(update.message)) {
      console.error('Story Pilot publish failed', {
        chat_id: chatId || null,
        message_id: update.message.message_id || null,
        error: error?.telegram?.description || error?.message || String(error),
      });
    }
    const description = error?.telegram?.description || error?.message || String(error);
    if (chatId) {
      let settings = await getStoredSettings(token, chatId).catch(() => defaultSettings());
      if (update?.message?.message_id && settings.lastMessage === update.message.message_id) {
        settings = { ...settings, lastMessage: null, lastStory: null, processing: false };
        await saveSettings(token, chatId, origin, settings).catch(() => {});
      }
      try {
        await showPanel(token, chatId, origin, settings, `❌ Не получилось опубликовать\n\n${friendlyError(description)}\n\nПопробуй отправить фото ещё раз.`);
      } catch {
        await showFreshPanel(token, chatId, origin, { ...settings, panel: null }, `❌ Не получилось опубликовать\n\n${friendlyError(description)}\n\nПопробуй отправить фото ещё раз.`).catch(() => {});
      }
    }
    res.status(200).json({ ok: false, error: description });
  }
}
