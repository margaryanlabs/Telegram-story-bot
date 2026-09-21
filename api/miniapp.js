import crypto from 'node:crypto';

const MAX_SAVED_USERS = 100;
const MAX_HISTORY = 12;
const PICK_SELECTED = 10101;
const PICK_EXCLUDED = 10102;

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
    const error = new Error(`${method}: ${data?.description || response.statusText || response.status}`);
    error.telegram = data;
    throw error;
  }
  return data.result;
}

function productionBaseUrl(req) {
  const configured = String(process.env.STORY_PILOT_BASE_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');

  const productionHost = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  if (productionHost) {
    return `https://${productionHost.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  }

  const forwardedHost = req.headers['x-forwarded-host'];
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host;
  return `https://${host}`;
}

function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '');
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

function markHistoryDeleted(history, storyId) {
  return (history || []).map(item => String(item.id) === String(storyId) ? { ...item, deleted: true } : item);
}

function analyticsFromHistory(history = []) {
  const active = history.filter(item => !item.deleted);
  const audienceCounts = active.reduce((acc, item) => {
    const key = item.audience || 'standard';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    storiesTracked: history.length,
    activeTracked: active.length,
    protectedStories: active.filter(item => item.protect).length,
    totalExcluded: active.reduce((sum, item) => sum + (Number(item.excluded) || 0), 0),
    audienceCounts,
    lastPublishedAt: active[0]?.ts || history[0]?.ts || null,
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

async function clearReplyKeyboard(token, chatId) {
  try {
    const message = await tg(token, 'sendMessage', {
      chat_id: chatId,
      text: '·',
      disable_notification: true,
      reply_markup: { remove_keyboard: true },
    });
    if (message?.message_id) {
      await tg(token, 'deleteMessage', { chat_id: chatId, message_id: message.message_id }).catch(() => {});
    }
  } catch {}
}

async function beginNativePicker(token, chatId, baseUrl, settings, kind) {
  if (kind === 'exclude' && !['all', 'contacts'].includes(settings.audience)) {
    throw new Error('Исключения работают для режимов «Все» и «Контакты»');
  }

  await clearReplyKeyboard(token, chatId);
  const prompt = await tg(token, 'sendMessage', {
    chat_id: chatId,
    text: kind === 'exclude'
      ? `🚫 Добавь людей, которым Story показывать НЕ надо.\n\nСейчас исключено: ${settings.excluded?.length || 0}. Telegram позволяет выбрать до 10 за один раз — потом можно добавить следующую группу.`
      : `🎯 Добавь людей, которым нужно показать Story.\n\nСейчас выбрано: ${settings.selected?.length || 0}. Telegram позволяет выбрать до 10 за один раз — потом можно добавить следующую группу.`,
    disable_notification: true,
    reply_markup: userPicker(kind),
  });

  const next = { ...settings, picking: kind, pickerMessage: prompt.message_id };
  await saveSettings(token, chatId, baseUrl, next);
  return next;
}

function defaultSettings() {
  return {
    bc: null,
    canStories: false,
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

function parseStoredSettings(menu) {
  if (menu?.type !== 'web_app' || !menu?.web_app?.url) return defaultSettings();
  try {
    const url = new URL(menu.web_app.url);
    const bc = url.searchParams.get('bc') || null;
    const canStoriesParam = url.searchParams.get('cs');
    return {
      bc,
      canStories: canStoriesParam === null ? Boolean(bc) : canStoriesParam === '1',
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
  } catch {
    return defaultSettings();
  }
}

async function getStoredSettings(token, chatId) {
  try {
    const menu = await tg(token, 'getChatMenuButton', { chat_id: chatId });
    return parseStoredSettings(menu);
  } catch {
    return defaultSettings();
  }
}

async function saveSettings(token, chatId, baseUrl, settings) {
  const url = new URL('/studio.html', baseUrl);
  if (settings.bc) {
    url.searchParams.set('bc', settings.bc);
    url.searchParams.set('cs', settings.canStories ? '1' : '0');
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
      text: '🚀 Старт',
      web_app: { url: url.toString() },
    },
  });
}

function validateInitData(initData, token) {
  if (!initData || !token) return null;

  const params = new URLSearchParams(initData);
  const hash = String(params.get('hash') || '');
  if (!/^[a-f0-9]{64}$/i.test(hash)) return null;

  params.delete('hash');
  const checkString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

  const actualBuffer = Buffer.from(hash, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  const authDate = Number(params.get('auth_date') || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate <= 0 || Math.abs(now - authDate) > 86400) {
    return null;
  }

  try {
    const user = JSON.parse(params.get('user') || '{}');
    if (!user?.id) return null;
    return user;
  } catch {
    return null;
  }
}

function publicState(settings, extra = {}) {
  const connection = !settings.bc
    ? 'unknown'
    : settings.canStories
      ? 'ready'
      : 'needs_permission';

  const history = settings.history?.length
    ? settings.history
    : settings.lastStory
      ? [{
          id: String(settings.lastStory),
          ts: 0,
          audience: settings.audience || 'standard',
          excluded: settings.excluded?.length || 0,
          selected: settings.selected?.length || 0,
          protect: Boolean(settings.protect),
          deleted: false,
        }]
      : [];

  return {
    connection,
    ready: connection === 'ready',
    audience: settings.audience || 'standard',
    selected: settings.selected || [],
    excluded: settings.excluded || [],
    protect: Boolean(settings.protect),
    lastStory: settings.lastStory || null,
    history,
    analytics: analyticsFromHistory(history),
    processing: Boolean(settings.processing),
    advancedPrivacy: Boolean(process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH),
    viewerSync: {
      available: false,
      requiresUserSession: true,
      reason: 'user_mtproto_session_required',
    },
    ...extra,
  };
}

async function refreshConnection(token, chatId, baseUrl, settings) {
  if (!settings.bc) {
    const next = { ...settings, canStories: false };
    return { settings: next, live: false, rights: false };
  }

  try {
    const connection = await tg(token, 'getBusinessConnection', {
      business_connection_id: settings.bc,
    });
    const live = Boolean(connection?.is_enabled);
    const rights = Boolean(connection?.rights?.can_manage_stories);

    if (!live) {
      const next = { ...settings, bc: null, canStories: false };
      await saveSettings(token, chatId, baseUrl, next);
      return { settings: next, live: false, rights: false };
    }

    const next = { ...settings, canStories: rights };
    if (next.canStories !== settings.canStories) {
      await saveSettings(token, chatId, baseUrl, next);
    }
    return { settings: next, live: true, rights };
  } catch {
    const next = { ...settings, bc: null, canStories: false };
    await saveSettings(token, chatId, baseUrl, next).catch(() => {});
    return { settings: next, live: false, rights: false };
  }
}

function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

export default async function handler(req, res) {
  setNoStore(res);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    res.status(500).json({ ok: false, error: 'Story Pilot is not configured' });
    return;
  }

  const initData = String(req.headers['x-telegram-init-data'] || '');
  const user = validateInitData(initData, token);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Open Story Pilot inside Telegram' });
    return;
  }

  const chatId = user.id;
  const baseUrl = productionBaseUrl(req);

  try {
    let settings = await getStoredSettings(token, chatId);

    if (req.method === 'GET') {
      const refreshed = await refreshConnection(token, chatId, baseUrl, settings);
      settings = refreshed.settings;
      res.status(200).json({
        ok: true,
        user: {
          id: user.id,
          firstName: user.first_name || '',
          username: user.username || '',
          photoUrl: user.photo_url || '',
        },
        state: publicState(settings, {
          live: refreshed.live,
          storyPermission: refreshed.rights,
        }),
      });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed' });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = String(body.action || '');

    if (action === 'check') {
      const refreshed = await refreshConnection(token, chatId, baseUrl, settings);
      res.status(200).json({
        ok: true,
        state: publicState(refreshed.settings, {
          live: refreshed.live,
          storyPermission: refreshed.rights,
        }),
      });
      return;
    }

    if (action === 'audience') {
      const audience = String(body.value || '');
      const allowed = ['standard', 'all', 'contacts', 'close'];
      if (!allowed.includes(audience)) {
        res.status(400).json({ ok: false, error: 'Unsupported audience' });
        return;
      }
      if (audience !== 'standard' && !(process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH)) {
        res.status(409).json({ ok: false, error: 'Расширенная аудитория пока недоступна' });
        return;
      }
      settings = { ...settings, audience, picking: '' };
      await saveSettings(token, chatId, baseUrl, settings);
    } else if (action === 'protect') {
      settings = { ...settings, protect: Boolean(body.value) };
      await saveSettings(token, chatId, baseUrl, settings);
    } else if (action === 'clear_excluded') {
      settings = { ...settings, excluded: [], picking: '' };
      await saveSettings(token, chatId, baseUrl, settings);
    } else if (action === 'clear_selected') {
      settings = {
        ...settings,
        selected: [],
        audience: settings.audience === 'selected' ? 'standard' : settings.audience,
        picking: '',
      };
      await saveSettings(token, chatId, baseUrl, settings);
    } else if (action === 'picker_selected' || action === 'picker_exclude') {
      const refreshed = await refreshConnection(token, chatId, baseUrl, settings);
      settings = refreshed.settings;
      if (!refreshed.live || !refreshed.rights) {
        res.status(409).json({ ok: false, error: 'Сначала подключи Telegram и разреши управление Stories' });
        return;
      }
      const kind = action === 'picker_exclude' ? 'exclude' : 'selected';
      settings = await beginNativePicker(token, chatId, baseUrl, settings, kind);
      res.status(200).json({
        ok: true,
        pickerOpened: true,
        state: publicState(settings, { live: true, storyPermission: true }),
      });
      return;
    } else if (action === 'reset') {
      settings = {
        ...settings,
        audience: 'standard',
        selected: [],
        excluded: [],
        picking: '',
        pickerMessage: null,
        protect: false,
      };
      await saveSettings(token, chatId, baseUrl, settings);
    } else if (action === 'delete_story') {
      const refreshed = await refreshConnection(token, chatId, baseUrl, settings);
      settings = refreshed.settings;
      const requestedId = Number(body.storyId || settings.lastStory);
      const knownStory = (settings.history || []).find(item => Number(item.id) === requestedId);
      if (!refreshed.live || !settings.bc) {
        res.status(409).json({ ok: false, error: 'Telegram Business подключение не найдено' });
        return;
      }
      if (!Number.isInteger(requestedId) || requestedId <= 0) {
        res.status(409).json({ ok: false, error: 'Нет сохранённой Story для удаления' });
        return;
      }
      if (body.storyId && !knownStory && String(settings.lastStory || '') !== String(requestedId)) {
        res.status(404).json({ ok: false, error: 'Этой Story нет в архиве Story Pilot' });
        return;
      }
      await tg(token, 'deleteStory', {
        business_connection_id: settings.bc,
        story_id: requestedId,
      });
      settings = {
        ...settings,
        lastStory: String(settings.lastStory || '') === String(requestedId) ? null : settings.lastStory,
        lastMessage: String(settings.lastStory || '') === String(requestedId) ? null : settings.lastMessage,
        processing: false,
        history: markHistoryDeleted(settings.history, requestedId),
      };
      await saveSettings(token, chatId, baseUrl, settings);
    } else {
      res.status(400).json({ ok: false, error: 'Unknown action' });
      return;
    }

    const refreshed = await refreshConnection(token, chatId, baseUrl, settings);
    res.status(200).json({
      ok: true,
      state: publicState(refreshed.settings, {
        live: refreshed.live,
        storyPermission: refreshed.rights,
      }),
    });
  } catch (error) {
    console.error('Mini App API error', error?.telegram || error);
    res.status(500).json({
      ok: false,
      error: error?.telegram?.description || error?.message || 'Unexpected error',
    });
  }
}
