import { openJson } from '../lib/viewer-sync-crypto.js';
import { verifyEdgeSignature } from '../lib/viewer-sync-signing.js';
import {
  viewerDbConfigured,
  listActiveViewerSessions,
  listStoriesForOwner,
  updateViewerSession,
  updateStoryStats,
  listViewerRows,
  upsertViewerRow,
  deleteViewerRow,
  insertSnapshot,
} from '../lib/viewer-sync-store.js';
import {
  createViewerClient,
  fetchStoryViewState,
} from '../lib/viewer-sync-telegram.js';

const RECONCILE_SECONDS = Math.max(60, Number(process.env.VIEWER_RECONCILE_SECONDS || 360));
const OWNER_LIMIT = Math.max(1, Math.min(10, Number(process.env.VIEWER_WATCH_OWNER_LIMIT || 4)));
const STORY_LIMIT = Math.max(1, Math.min(10, Number(process.env.VIEWER_WATCH_STORY_LIMIT || 4)));
const EDGE_TRIGGER_PUBLIC_KEY = '8sAlE7n-envFOB-8bisnYwBONXPe8M6GRtos_6UsoAg';

function telegramUrl(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function tg(token, method, body) {
  const response = await fetch(telegramUrl(token, method), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(`${method}: ${data?.description || response.statusText || response.status}`);
  }
  return data.result;
}

async function sendGenericViewNotice(token, chatId, storyId, viewedAt) {
  const when = viewedAt
    ? new Date(Number(viewedAt) * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : 'только что';
  return tg(token, 'sendMessage', {
    chat_id: chatId,
    text: `🔔 Новый просмотр Story #${storyId}\n\nВремя: ${when}\nПроверяю просмотр после окна приватности Telegram…`,
    disable_notification: false,
  });
}

async function editConfirmedNotice(token, chatId, messageId, storyId, viewer) {
  if (!messageId) return;
  const identity = viewer.user?.username
    ? `@${viewer.user.username}`
    : viewer.user?.displayName || 'Пользователь Telegram';
  const when = viewer.viewedAt
    ? new Date(Number(viewer.viewedAt) * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const reaction = viewer.reaction?.value ? `\nРеакция: ${viewer.reaction.value}` : '';
  await tg(token, 'editMessageText', {
    chat_id: chatId,
    message_id: Number(messageId),
    text: `👁 ${identity} посмотрел Story #${storyId}\n\nВремя: ${when}${reaction}\nСтатус: подтверждён после окна приватности Telegram`,
  }).catch(() => {});
}

async function editAnonymousNotice(token, chatId, messageId, storyId) {
  if (!messageId) return;
  await tg(token, 'editMessageText', {
    chat_id: chatId,
    message_id: Number(messageId),
    text: `👁 Просмотр Story #${storyId}\n\nTelegram больше не связывает этот просмотр с конкретным аккаунтом. В Story Pilot он сохранён только как неатрибутированный просмотр.`,
  }).catch(() => {});
}

async function sendAnonymousGapNotice(token, chatId, storyId, delta) {
  if (delta <= 0) return;
  await tg(token, 'sendMessage', {
    chat_id: chatId,
    text: `👁 Story #${storyId}: +${delta} неатрибутированн${delta === 1 ? 'ый просмотр' : 'ых просмотра'}\n\nTelegram увеличил общий счётчик, но не предоставляет личности этих зрителей.`,
    disable_notification: false,
  }).catch(() => {});
}

function isoFromUnix(value) {
  const seconds = Number(value || 0);
  return seconds > 0 ? new Date(seconds * 1000).toISOString() : new Date().toISOString();
}

async function syncStory({ token, ownerId, story, client, preferences }) {
  const snapshot = await fetchStoryViewState(client, story.story_id);
  const rows = await listViewerRows(ownerId, story.story_id);
  const existing = new Map(rows.map(row => [String(row.viewer_user_id), row]));
  const visible = new Map(snapshot.viewers.map(view => [String(view.viewerUserId), view]));
  const now = Date.now();
  let disappearedCount = 0;
  let newCount = 0;
  let confirmedCount = 0;

  // First sync establishes a baseline without flooding the owner with alerts
  // for viewers that existed before Viewer Sync was connected.
  if (!story.last_sync_at) {
    for (const viewer of snapshot.viewers) {
      const viewedAt = isoFromUnix(viewer.viewedAt);
      await upsertViewerRow({
        telegram_user_id: String(ownerId),
        story_id: Number(story.story_id),
        viewer_user_id: String(viewer.viewerUserId),
        status: 'confirmed',
        first_seen_at: viewedAt,
        last_seen_at: new Date().toISOString(),
        viewed_at: viewedAt,
        confirmed_at: new Date().toISOString(),
        username: viewer.user?.username || null,
        display_name: viewer.user?.displayName || null,
        is_contact: Boolean(viewer.user?.isContact),
        reaction_json: viewer.reaction || null,
        notification_message_id: null,
      });
    }

    const baselineGap = Math.max(0, Number(snapshot.totalViews || 0) - Number(snapshot.identifiedViews || 0));

    await insertSnapshot({
      telegram_user_id: String(ownerId),
      story_id: Number(story.story_id),
      observed_at: new Date().toISOString(),
      total_views: Number(snapshot.totalViews || 0),
      identified_views: Number(snapshot.identifiedViews || 0),
      forwards_count: Number(snapshot.forwardsCount || 0),
      reactions_count: Number(snapshot.reactionsCount || 0),
    });

    await updateStoryStats(ownerId, story.story_id, {
      last_views_count: Number(snapshot.totalViews || 0),
      last_identified_count: Number(snapshot.identifiedViews || 0),
      last_forwards_count: Number(snapshot.forwardsCount || 0),
      last_reactions_count: Number(snapshot.reactionsCount || 0),
      last_sync_at: new Date().toISOString(),
      last_error: null,
    });

    return {
      storyId: story.story_id,
      baseline: true,
      totalViews: snapshot.totalViews,
      identifiedViews: snapshot.identifiedViews,
      anonymousGap: baselineGap,
      newCount: 0,
      confirmedCount: snapshot.identifiedViews,
      disappearedCount: 0,
    };
  }

  for (const row of rows) {
    const viewerId = String(row.viewer_user_id);
    if (!visible.has(viewerId) && ['provisional', 'confirmed'].includes(row.status)) {
      disappearedCount += 1;
      await editAnonymousNotice(token, ownerId, row.notification_message_id, story.story_id);
      await deleteViewerRow(ownerId, story.story_id, viewerId);
    }
  }

  for (const viewer of snapshot.viewers) {
    const viewerId = String(viewer.viewerUserId);
    const row = existing.get(viewerId);
    const viewedAt = isoFromUnix(viewer.viewedAt);

    if (!row) {
      const notice = preferences?.notifyEnabled === false
        ? null
        : await sendGenericViewNotice(token, ownerId, story.story_id, viewer.viewedAt);
      await upsertViewerRow({
        telegram_user_id: String(ownerId),
        story_id: Number(story.story_id),
        viewer_user_id: viewerId,
        status: 'provisional',
        first_seen_at: viewedAt,
        last_seen_at: new Date().toISOString(),
        viewed_at: viewedAt,
        username: viewer.user?.username || null,
        display_name: viewer.user?.displayName || null,
        is_contact: Boolean(viewer.user?.isContact),
        reaction_json: viewer.reaction || null,
        notification_message_id: notice?.message_id || null,
      });
      newCount += 1;
      continue;
    }

    const firstSeenMs = new Date(row.first_seen_at || row.viewed_at || Date.now()).getTime();
    const oldEnough = Number.isFinite(firstSeenMs) && now - firstSeenMs >= RECONCILE_SECONDS * 1000;

    if (row.status === 'provisional' && oldEnough) {
      await editConfirmedNotice(token, ownerId, row.notification_message_id, story.story_id, viewer);
      await upsertViewerRow({
        ...row,
        telegram_user_id: String(ownerId),
        story_id: Number(story.story_id),
        viewer_user_id: viewerId,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        viewed_at: viewedAt,
        username: viewer.user?.username || null,
        display_name: viewer.user?.displayName || null,
        is_contact: Boolean(viewer.user?.isContact),
        reaction_json: viewer.reaction || null,
      });
      confirmedCount += 1;
    } else {
      await upsertViewerRow({
        ...row,
        telegram_user_id: String(ownerId),
        story_id: Number(story.story_id),
        viewer_user_id: viewerId,
        last_seen_at: new Date().toISOString(),
        username: row.status === 'confirmed' ? (viewer.user?.username || row.username || null) : (viewer.user?.username || null),
        display_name: row.status === 'confirmed' ? (viewer.user?.displayName || row.display_name || null) : (viewer.user?.displayName || null),
        is_contact: Boolean(viewer.user?.isContact),
        reaction_json: viewer.reaction || null,
      });
    }
  }

  const gap = Math.max(0, Number(snapshot.totalViews || 0) - Number(snapshot.identifiedViews || 0));
  const previousGap = Math.max(
    0,
    Number(story.last_views_count || 0) - Number(story.last_identified_count || 0),
  );
  const anonymousDelta = Math.max(0, gap - previousGap - disappearedCount);
  if (preferences?.notifyEnabled !== false && preferences?.notifyAnonymousGap !== false) {
    await sendAnonymousGapNotice(token, ownerId, story.story_id, anonymousDelta);
  }

  await insertSnapshot({
    telegram_user_id: String(ownerId),
    story_id: Number(story.story_id),
    observed_at: new Date().toISOString(),
    total_views: Number(snapshot.totalViews || 0),
    identified_views: Number(snapshot.identifiedViews || 0),
    forwards_count: Number(snapshot.forwardsCount || 0),
    reactions_count: Number(snapshot.reactionsCount || 0),
  });

  await updateStoryStats(ownerId, story.story_id, {
    last_views_count: Number(snapshot.totalViews || 0),
    last_identified_count: Number(snapshot.identifiedViews || 0),
    last_forwards_count: Number(snapshot.forwardsCount || 0),
    last_reactions_count: Number(snapshot.reactionsCount || 0),
    last_sync_at: new Date().toISOString(),
    last_error: null,
  });

  return {
    storyId: story.story_id,
    totalViews: snapshot.totalViews,
    identifiedViews: snapshot.identifiedViews,
    newCount,
    confirmedCount,
    disappearedCount,
    anonymousGap: gap,
  };
}

function authorized(req) {
  const timestamp = String(req.headers['x-story-trigger-timestamp'] || '');
  const signature = String(req.headers['x-story-trigger-signature'] || '');
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});

  return verifyEdgeSignature({
    publicKey: EDGE_TRIGGER_PUBLIC_KEY,
    timestamp,
    body,
    signature,
    maxAgeMs: 120000,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  if (!viewerDbConfigured()) {
    res.status(503).json({ ok: false, error: 'Viewer Sync storage signing is not configured' });
    return;
  }

  if (!authorized(req)) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  const token = String(process.env.TELEGRAM_BOT_TOKEN || '');
  if (!token) {
    res.status(503).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' });
    return;
  }

  const sessions = await listActiveViewerSessions(OWNER_LIMIT);
  const results = [];

  for (const row of sessions) {
    const ownerId = String(row.telegram_user_id);
    let client = null;
    try {
      const decrypted = openJson(row.session_ciphertext, `session:${ownerId}`);
      client = await createViewerClient(decrypted.session);
      const stories = await listStoriesForOwner(ownerId, STORY_LIMIT);

      const ownerResult = [];
      for (const story of stories) {
        try {
          ownerResult.push(await syncStory({
            token,
            ownerId,
            story,
            client,
            preferences: {
              notifyEnabled: row.notify_enabled !== false,
              notifyAnonymousGap: row.notify_anonymous_gap !== false,
            },
          }));
        } catch (error) {
          const description = error?.errorMessage || error?.message || String(error);
          await updateStoryStats(ownerId, story.story_id, {
            last_sync_at: new Date().toISOString(),
            last_error: description.slice(0, 500),
          }).catch(() => {});
          ownerResult.push({ storyId: story.story_id, error: description });
        }
      }

      await updateViewerSession(ownerId, {
        last_poll_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      });
      results.push({ ownerId, stories: ownerResult });
    } catch (error) {
      const description = error?.errorMessage || error?.message || String(error);
      await updateViewerSession(ownerId, {
        last_poll_at: new Date().toISOString(),
        last_error: description.slice(0, 500),
        status: /AUTH_KEY|SESSION_REVOKED|not authorized/i.test(description) ? 'reauth_required' : 'active',
        updated_at: new Date().toISOString(),
      }).catch(() => {});
      results.push({ ownerId, error: description });
    } finally {
      if (client) await client.disconnect().catch(() => {});
    }
  }

  res.status(200).json({
    ok: true,
    reconcileSeconds: RECONCILE_SECONDS,
    ownersProcessed: sessions.length,
    results,
  });
}
