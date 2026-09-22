import crypto from 'node:crypto';
import { openJson, sealJson } from '../lib/viewer-sync-crypto.js';
import {
  viewerDbConfigured,
  getViewerSession,
  upsertViewerSession,
  deleteViewerSession,
  getAuthChallenge,
  saveAuthChallenge,
  deleteAuthChallenge,
  getViewerStoryData,
  getViewerAnalytics,
  getViewerExportData,
  trackPublishedStory,
} from '../lib/viewer-sync-store.js';
import {
  beginUserAuth,
  verifyUserCode,
  verifyUserPassword,
  revokeUserSession,
} from '../lib/viewer-sync-telegram.js';

const AUTH_TTL_MS = 10 * 60 * 1000;

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

function configState() {
  const storage = viewerDbConfigured();
  const telegram = Boolean(
    process.env.TELEGRAM_API_ID
    && process.env.TELEGRAM_API_HASH
    && process.env.TELEGRAM_BOT_TOKEN
  );

  return {
    configured: storage && telegram,
    backgroundReady: storage && telegram,
    scheduler: 'supabase_pg_cron',
    missing: [
      !process.env.TELEGRAM_API_ID ? 'TELEGRAM_API_ID' : null,
      !process.env.TELEGRAM_API_HASH ? 'TELEGRAM_API_HASH' : null,
      !process.env.TELEGRAM_BOT_TOKEN ? 'TELEGRAM_BOT_TOKEN' : null,
    ].filter(Boolean),
  };
}

function safeSession(row) {
  if (!row) return null;
  return {
    connected: row.status === 'active',
    status: row.status,
    account: {
      id: row.telegram_account_user_id || null,
      username: row.telegram_account_username || '',
      firstName: row.telegram_account_first_name || '',
    },
    preferences: {
      notifyEnabled: row.notify_enabled !== false,
      notifyAnonymousGap: row.notify_anonymous_gap !== false,
    },
    lastPollAt: row.last_poll_at || null,
    lastError: row.last_error || null,
  };
}

function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function csvCell(value) {
  if (value === null || value === undefined) return '""';
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function viewerEvidenceCsv(data) {
  const stories = Array.isArray(data?.stories) ? data.stories : [];
  const viewers = Array.isArray(data?.viewers) ? data.viewers : [];
  const storyMap = new Map(stories.map(story => [String(story.story_id), story]));

  const columns = [
    'row_type','story_id','story_posted_at','story_audience','story_protected',
    'total_views','identified_views','unattributed_views','reactions_count','forwards_count',
    'viewer_user_id','username','display_name','viewed_at','is_contact','reaction',
    'confirmed_at','exported_at'
  ];

  const rows = [columns.map(csvCell).join(',')];

  for (const story of stories) {
    const total = Number(story.last_views_count || 0);
    const identified = Number(story.last_identified_count || 0);
    rows.push([
      'story',
      story.story_id,
      story.posted_at,
      story.audience || '',
      Boolean(story.protected),
      total,
      identified,
      Math.max(0, total - identified),
      Number(story.last_reactions_count || 0),
      Number(story.last_forwards_count || 0),
      '','','','','','','',
      data?.generatedAt || new Date().toISOString(),
    ].map(csvCell).join(','));
  }

  for (const viewer of viewers) {
    const story = storyMap.get(String(viewer.story_id)) || {};
    const total = Number(story.last_views_count || 0);
    const identified = Number(story.last_identified_count || 0);
    rows.push([
      'viewer',
      viewer.story_id,
      story.posted_at || '',
      story.audience || '',
      Boolean(story.protected),
      total,
      identified,
      Math.max(0, total - identified),
      Number(story.last_reactions_count || 0),
      Number(story.last_forwards_count || 0),
      viewer.viewer_user_id,
      viewer.username || '',
      viewer.display_name || '',
      viewer.viewed_at || '',
      Boolean(viewer.is_contact),
      viewer.reaction_json || '',
      viewer.confirmed_at || '',
      data?.generatedAt || new Date().toISOString(),
    ].map(csvCell).join(','));
  }

  return '\uFEFF' + rows.join('\r\n');
}

async function sendTestViewerAlert(token, userId) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type':'application/json' },
    body: JSON.stringify({
      chat_id: String(userId),
      text: '⚡ Story Pilot Fast Alerts работают.\n\nНовый просмотр активной Story будет замечен фоновым watcher обычно до ~30 секунд. Если Telegram позже скроет связь просмотра с аккаунтом, Story Pilot анонимизирует запись и пришлёт отдельный privacy-сигнал.',
      disable_notification: false,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    throw new Error(`Не удалось отправить тест: ${data?.description || response.statusText}`);
  }
  return data.result;
}

async function sendEvidenceCsv(token, userId, data) {
  const csv = viewerEvidenceCsv(data);
  const date = new Date().toISOString().slice(0, 10);
  const form = new FormData();
  form.append('chat_id', String(userId));
  form.append(
    'document',
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    `story-pilot-evidence-${date}.csv`,
  );
  form.append(
    'caption',
    'Story Pilot · Viewer Intelligence export\nТолько подтверждённые Telegram viewers + агрегированные Story counters.',
  );

  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    body: form,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.ok) {
    throw new Error(`Не удалось отправить CSV: ${result?.description || response.statusText}`);
  }
  return result.result;
}

async function registerRecentStories(userId, stories) {
  const now = Date.now();
  const watchHours = Math.max(48, Number(process.env.VIEWER_WATCH_HOURS || 72));
  const accepted = [];

  for (const item of (Array.isArray(stories) ? stories : []).slice(0, 12)) {
    if (item?.deleted) continue;

    const storyId = Number(item?.id || 0);
    const ts = Number(item?.ts || 0);
    if (!Number.isInteger(storyId) || storyId <= 0 || !Number.isFinite(ts) || ts <= 0) continue;

    const postedAtMs = ts * 1000;
    const watchUntilMs = postedAtMs + watchHours * 60 * 60 * 1000;
    if (watchUntilMs <= now) continue;

    await trackPublishedStory({
      telegram_user_id: String(userId),
      story_id: storyId,
      posted_at: new Date(postedAtMs).toISOString(),
      expires_at: new Date(postedAtMs + 24 * 60 * 60 * 1000).toISOString(),
      watch_until: new Date(watchUntilMs).toISOString(),
      audience: String(item?.audience || 'standard').slice(0, 32),
      protected: Boolean(item?.protect),
      active: true,
      last_error: null,
    });
    accepted.push(storyId);
  }

  return accepted;
}

export default async function handler(req, res) {
  setNoStore(res);

  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '');
  if (!botToken) {
    res.status(500).json({ ok: false, error: 'Story Pilot is not configured' });
    return;
  }

  const user = validateInitData(String(req.headers['x-telegram-init-data'] || ''), botToken);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Open Story Pilot inside Telegram' });
    return;
  }

  const config = configState();
  const userId = String(user.id);

  if (!config.configured) {
    res.status(503).json({
      ok: false,
      error: 'Viewer Sync backend is not configured yet',
      config,
    });
    return;
  }

  try {
    if (req.method === 'GET') {
      let session;
      try {
        session = await getViewerSession(userId);
      } catch (error) {
        const description = error?.message || String(error);
        if (/Viewer Sync store|schema cache|timeout|temporar|fetch failed|network/i.test(description)) {
          res.status(200).json({
            ok: true,
            degraded: true,
            config,
            session: null,
            story: null,
            viewers: [],
            analytics: null,
            storageError: 'Viewer Sync временно восстанавливает соединение. Публикация Stories работает независимо.',
          });
          return;
        }
        throw error;
      }

      const rawStoryId = req.query?.storyId;
      const storyId = Number(Array.isArray(rawStoryId) ? rawStoryId[0] : rawStoryId || 0);
      const wantsAnalytics = String(req.query?.analytics || '') === '1';

      const [storyData, analytics] = await Promise.all([
        Number.isInteger(storyId) && storyId > 0
          ? getViewerStoryData(userId, storyId).catch(() => null)
          : Promise.resolve(null),
        wantsAnalytics && session?.status === 'active'
          ? getViewerAnalytics(userId).catch(() => null)
          : Promise.resolve(null),
      ]);

      res.status(200).json({
        ok: true,
        config,
        session: safeSession(session),
        story: storyData?.story || null,
        viewers: storyData?.viewers || [],
        analytics,
      });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed' });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = String(body.action || '');

    if (action === 'test_alert') {
      const session = await getViewerSession(userId);
      if (!session || session.status !== 'active') {
        res.status(409).json({ ok: false, error: 'Сначала подключи Viewer Sync' });
        return;
      }

      const message = await sendTestViewerAlert(botToken, userId);
      res.status(200).json({
        ok: true,
        sent: true,
        messageId: message?.message_id || null,
      });
      return;
    }

    if (action === 'export_csv') {
      const session = await getViewerSession(userId);
      if (!session || session.status !== 'active') {
        res.status(409).json({ ok: false, error: 'Сначала подключи Viewer Sync' });
        return;
      }

      const exportData = await getViewerExportData(userId);
      const storyCount = Array.isArray(exportData?.stories) ? exportData.stories.length : 0;
      const viewerCount = Array.isArray(exportData?.viewers) ? exportData.viewers.length : 0;
      if (!storyCount && !viewerCount) {
        res.status(409).json({ ok: false, error: 'Для экспорта пока нет данных Viewer Sync' });
        return;
      }

      const message = await sendEvidenceCsv(botToken, userId, exportData);
      res.status(200).json({
        ok: true,
        exported: true,
        storyCount,
        viewerCount,
        messageId: message?.message_id || null,
      });
      return;
    }

    if (action === 'preferences') {
      const session = await getViewerSession(userId);
      if (!session) {
        res.status(409).json({ ok: false, error: 'Viewer Sync ещё не подключён' });
        return;
      }

      const patch = {
        notify_enabled: body.notifyEnabled !== false,
        notify_anonymous_gap: body.notifyAnonymousGap !== false,
        updated_at: new Date().toISOString(),
      };
      const updated = await upsertViewerSession({
        ...session,
        ...patch,
        telegram_user_id: userId,
      });

      res.status(200).json({ ok: true, session: safeSession(updated) });
      return;
    }

    if (action === 'register_stories') {
      const session = await getViewerSession(userId);
      if (!session || session.status !== 'active') {
        res.status(409).json({ ok: false, error: 'Сначала подключи Viewer Sync' });
        return;
      }

      const registered = await registerRecentStories(userId, body.stories);
      res.status(200).json({ ok: true, registered });
      return;
    }

    if (action === 'send_code') {
      const existing = await getAuthChallenge(userId);
      if (existing?.created_at && Date.now() - new Date(existing.created_at).getTime() < 45_000) {
        res.status(429).json({ ok: false, error: 'Подожди немного перед повторной отправкой кода' });
        return;
      }

      const auth = await beginUserAuth(body.phone);
      const payload = sealJson(auth, `auth:${userId}`);
      const now = new Date();
      await saveAuthChallenge({
        telegram_user_id: userId,
        challenge_ciphertext: payload,
        stage: 'code',
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + AUTH_TTL_MS).toISOString(),
      });

      res.status(200).json({
        ok: true,
        stage: 'code',
        delivery: auth.isCodeViaApp ? 'telegram_app' : 'sms_or_other',
      });
      return;
    }

    if (action === 'verify_code') {
      const challenge = await getAuthChallenge(userId);
      if (!challenge || new Date(challenge.expires_at).getTime() < Date.now()) {
        await deleteAuthChallenge(userId).catch(() => {});
        res.status(410).json({ ok: false, error: 'Код устарел. Запроси новый.' });
        return;
      }

      const auth = openJson(challenge.challenge_ciphertext, `auth:${userId}`);
      const result = await verifyUserCode(auth, body.code);

      if (result.needsPassword) {
        const next = sealJson({ ...auth, session: result.session }, `auth:${userId}`);
        await saveAuthChallenge({
          telegram_user_id: userId,
          challenge_ciphertext: next,
          stage: 'password',
          created_at: challenge.created_at,
          expires_at: new Date(Date.now() + AUTH_TTL_MS).toISOString(),
        });
        res.status(200).json({ ok: true, stage: 'password', needsPassword: true });
        return;
      }

      await upsertViewerSession({
        telegram_user_id: userId,
        session_ciphertext: sealJson({ session: result.session }, `session:${userId}`),
        status: 'active',
        telegram_account_user_id: result.user?.id || null,
        telegram_account_username: result.user?.username || null,
        telegram_account_first_name: result.user?.firstName || null,
        last_error: null,
        updated_at: new Date().toISOString(),
      });
      await deleteAuthChallenge(userId);

      res.status(200).json({
        ok: true,
        stage: 'connected',
        session: {
          connected: true,
          status: 'active',
          account: result.user,
        },
      });
      return;
    }

    if (action === 'verify_password') {
      const challenge = await getAuthChallenge(userId);
      if (!challenge || challenge.stage !== 'password' || new Date(challenge.expires_at).getTime() < Date.now()) {
        await deleteAuthChallenge(userId).catch(() => {});
        res.status(410).json({ ok: false, error: 'Авторизация устарела. Начни подключение заново.' });
        return;
      }

      const auth = openJson(challenge.challenge_ciphertext, `auth:${userId}`);
      const result = await verifyUserPassword(auth, body.password);

      await upsertViewerSession({
        telegram_user_id: userId,
        session_ciphertext: sealJson({ session: result.session }, `session:${userId}`),
        status: 'active',
        telegram_account_user_id: result.user?.id || null,
        telegram_account_username: result.user?.username || null,
        telegram_account_first_name: result.user?.firstName || null,
        last_error: null,
        updated_at: new Date().toISOString(),
      });
      await deleteAuthChallenge(userId);

      res.status(200).json({
        ok: true,
        stage: 'connected',
        session: {
          connected: true,
          status: 'active',
          account: result.user,
        },
      });
      return;
    }

    if (action === 'disconnect') {
      const sessionRow = await getViewerSession(userId);
      if (sessionRow?.session_ciphertext) {
        try {
          const decrypted = openJson(sessionRow.session_ciphertext, `session:${userId}`);
          await revokeUserSession(decrypted.session);
        } catch (error) {
          console.warn('Viewer Sync session revoke failed', {
            telegram_user_id: userId,
            error: error?.message || String(error),
          });
        }
      }

      await deleteAuthChallenge(userId).catch(() => {});
      await deleteViewerSession(userId);
      res.status(200).json({ ok: true, disconnected: true });
      return;
    }

    res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (error) {
    const description = error?.errorMessage || error?.message || String(error);
    if (/Viewer Sync store|schema cache|timeout|temporar|fetch failed|network/i.test(description)) {
      console.warn('Viewer Sync API degraded', {
        telegram_user_id: userId,
        error: description,
      });
    } else {
      console.error('Viewer Sync API error', {
        telegram_user_id: userId,
        error: description,
      });
    }

    let message = description;
    if (/PHONE_CODE_INVALID/i.test(description)) message = 'Неверный код Telegram';
    else if (/PHONE_CODE_EXPIRED/i.test(description)) message = 'Код Telegram истёк. Запроси новый.';
    else if (/PASSWORD_HASH_INVALID/i.test(description)) message = 'Неверный пароль двухэтапной аутентификации';
    else if (/FLOOD_WAIT/i.test(description)) message = 'Telegram временно ограничил повторные попытки. Попробуй позже.';

    res.status(500).json({ ok: false, error: message });
  }
}
