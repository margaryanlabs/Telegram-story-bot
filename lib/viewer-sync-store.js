import { signStoryPilotRequest } from './viewer-sync-signing.js';

const STORE_URL = 'https://xvtmgzzaomolnvkcgosk.supabase.co/functions/v1/story-pilot-store';

export function viewerDbConfigured() {
  return Boolean(process.env.TELEGRAM_API_HASH && process.env.TELEGRAM_BOT_TOKEN);
}

const STORE_TRANSIENT_RE = /schema cache|retrying|timeout|timed out|temporar|fetch failed|network|ECONN|EAI_AGAIN|502|503|504/i;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function callStore(op, args = {}, options = {}) {
  if (!viewerDbConfigured()) {
    throw new Error('Viewer Sync storage signing is not configured');
  }

  const payload = { op, args };
  const delays = Array.isArray(options.delays) && options.delays.length
    ? options.delays
    : [0, 180, 520];
  const timeoutMs = Math.max(800, Math.min(8000, Number(options.timeoutMs || 4500)));
  let lastError = null;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await wait(delays[attempt]);

    const signed = signStoryPilotRequest(payload);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(STORE_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-story-timestamp': signed.timestamp,
          'x-story-signature': signed.signature,
        },
        body: signed.body,
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.ok) return data.data;

      const error = new Error(
        `Viewer Sync store ${response.status}: ${data?.error || response.statusText || 'request failed'}`,
      );
      lastError = error;
      if (!STORE_TRANSIENT_RE.test(error.message) || attempt === delays.length - 1) throw error;
    } catch (error) {
      const normalized = error?.name === 'AbortError'
        ? new Error('Viewer Sync store timeout')
        : error;
      lastError = normalized;
      const message = normalized?.message || String(normalized);
      if (!STORE_TRANSIENT_RE.test(message) || attempt === delays.length - 1) throw normalized;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error('Viewer Sync store unavailable');
}

export async function viewerStoreHealth() {
  return callStore('health');
}

export async function getViewerSession(userId) {
  return callStore('get_session', { userId });
}

export async function upsertViewerSession(row) {
  return callStore('upsert_session', { row });
}

export async function updateViewerSession(userId, patch) {
  return callStore('update_session', { userId, patch });
}

export async function deleteViewerSession(userId) {
  return callStore('delete_session', { userId });
}

export async function getAuthChallenge(userId) {
  return callStore('get_challenge', { userId });
}

export async function saveAuthChallenge(row) {
  return callStore('save_challenge', { row });
}

export async function deleteAuthChallenge(userId) {
  return callStore('delete_challenge', { userId });
}

export async function trackPublishedStory(row) {
  if (!viewerDbConfigured()) return null;
  return callStore('track_story', { row });
}

export async function markStoryDeleted(userId, storyId) {
  if (!viewerDbConfigured()) return null;
  return callStore('mark_story_deleted', { userId, storyId });
}

export async function listActiveViewerSessions(limit = 10) {
  return (await callStore('list_active_sessions', {
    limit: Math.max(1, Math.min(50, Number(limit || 10))),
  })) || [];
}

export async function listStoryArchive(userId, limit = 50) {
  return (await callStore('list_story_archive', {
    userId,
    limit: Math.max(1, Math.min(100, Number(limit || 50))),
  }, {
    delays: [0],
    timeoutMs: 2400,
  })) || [];
}

export async function listStoriesForOwner(userId, limit = 8) {
  return (await callStore('list_stories', {
    userId,
    limit: Math.max(1, Math.min(20, Number(limit || 8))),
  })) || [];
}

export async function updateStoryStats(userId, storyId, patch) {
  return callStore('update_story_stats', { userId, storyId, patch });
}

export async function listViewerRows(userId, storyId) {
  return (await callStore('list_viewer_rows', { userId, storyId })) || [];
}

export async function upsertViewerRow(row) {
  return callStore('upsert_viewer', { row });
}

export async function deleteViewerRow(userId, storyId, viewerUserId) {
  return callStore('delete_viewer', { userId, storyId, viewerUserId });
}

export async function insertSnapshot(row) {
  return callStore('insert_snapshot', { row });
}

export async function getViewerStoryData(userId, storyId) {
  return (await callStore('get_story_data', { userId, storyId })) || { story: null, viewers: [] };
}

export async function getViewerAnalytics(userId) {
  return (await callStore('get_analytics', { userId })) || {
    storiesTracked: 0,
    totalViews: 0,
    identifiedViews: 0,
    unattributedViews: 0,
    uniqueViewers: 0,
    repeatViewers: 0,
    contacts: 0,
    nonContacts: 0,
    reactions: 0,
    forwards: 0,
    avgDelaySec: null,
    topPeople: [],
    storyPerformance: [],
    latestTimelineStoryId: null,
    latestTimeline: [],
  };
}

export async function getViewerExportData(userId) {
  return (await callStore('get_export', { userId })) || {
    stories: [],
    viewers: [],
    generatedAt: new Date().toISOString(),
  };
}

export async function acquireViewerWatchLease(seconds = 55) {
  return Boolean(await callStore('acquire_watch_lease', {
    seconds: Math.max(10, Math.min(300, Number(seconds || 55))),
  }));
}


export async function getPrivacySettings(userId) {
  return callStore('get_privacy_settings', { userId });
}

export async function updatePrivacySettings(userId, patch = {}) {
  return callStore('update_privacy_settings', { userId, patch });
}

export async function captureBusinessMessage(row, eventType = 'new') {
  return callStore('capture_business_message', { row, eventType });
}

export async function markBusinessMessagesDeleted(userId, chatId, messageIds, deletedAt = null) {
  return callStore('mark_business_messages_deleted', {
    userId,
    chatId,
    messageIds,
    deletedAt: deletedAt || new Date().toISOString(),
  });
}

export async function listPrivacyThreads(userId) {
  return callStore('list_privacy_threads', { userId });
}

export async function listPrivacyMessages(userId, chatId, limit = 80) {
  return callStore('list_privacy_messages', {
    userId,
    chatId,
    limit: Math.max(1, Math.min(150, Number(limit || 80))),
  });
}

export async function getPrivacyMessageVersions(userId, chatId, messageId) {
  return callStore('get_message_versions', { userId, chatId, messageId });
}

export async function clearPrivacyArchive(userId) {
  return callStore('clear_privacy_archive', { userId });
}


export async function getPrivacyMediaRef(userId, chatId, messageId) {
  return callStore('get_privacy_media_ref', { userId, chatId, messageId });
}


export async function createPrivacyMediaUpload(userId, chatId, messageId) {
  return callStore('create_privacy_media_upload', { userId, chatId, messageId });
}

export async function finalizePrivacyMediaArchive(userId, chatId, messageId, result = {}) {
  return callStore('finalize_privacy_media_archive', {
    userId,
    chatId,
    messageId,
    archived: Boolean(result.archived),
    path: result.path || null,
    error: result.error || null,
  });
}
