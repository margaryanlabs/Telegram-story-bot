import { signStoryPilotRequest } from './viewer-sync-signing.js';

const STORE_URL = 'https://xvtmgzzaomolnvkcgosk.supabase.co/functions/v1/story-pilot-store';

export function storeSigningConfigured() {
  return Boolean(process.env.TELEGRAM_API_HASH && process.env.TELEGRAM_BOT_TOKEN);
}

export function viewerDbConfigured() {
  return Boolean(
    process.env.TELEGRAM_API_ID
    && process.env.TELEGRAM_API_HASH
    && process.env.TELEGRAM_BOT_TOKEN
  );
}

const STORE_TRANSIENT_RE = /schema cache|retrying|timeout|timed out|temporar|fetch failed|network|ECONN|EAI_AGAIN|502|503|504/i;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function callStore(op, args = {}, options = {}) {
  if (!storeSigningConfigured()) {
    throw new Error('Story Pilot storage signing is not configured');
  }

  const payload = { op, args };
  const delays = Array.isArray(options.delays) && options.delays.length
    ? options.delays
    : [0, 180, 520];
  const timeoutMs = Math.max(800, Math.min(15000, Number(options.timeoutMs || 4500)));
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

function cryptoEnvironment() {
  return process.env.VERCEL_ENV === 'production' ? 'production' : 'preview';
}

export async function viewerCryptoHealth() {
  return callStore('viewer_crypto_health', {
    environment: cryptoEnvironment(),
  }, {
    delays: [0],
    timeoutMs: 5000,
  });
}

export async function sealViewerPrivateJson(value, context) {
  return callStore('seal_viewer_private_json', {
    environment: cryptoEnvironment(),
    context: String(context || 'global'),
    value,
  }, {
    delays: [0, 180],
    timeoutMs: 6000,
  });
}

export async function openViewerPrivateJson(ciphertext, context) {
  return callStore('open_viewer_private_json', {
    environment: cryptoEnvironment(),
    context: String(context || 'global'),
    ciphertext: String(ciphertext || ''),
  }, {
    delays: [0, 180],
    timeoutMs: 6000,
  });
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
  if (!storeSigningConfigured()) return null;
  return callStore('track_story', { row });
}

export async function markStoryDeleted(userId, storyId) {
  if (!storeSigningConfigured()) return null;
  return callStore('mark_story_deleted', { userId, storyId });
}

export async function listActiveViewerSessions(limit = 10) {
  return (await callStore('list_active_sessions', {
    limit: Math.max(1, Math.min(50, Number(limit || 10))),
  })) || [];
}

export async function recordActivityEvent(userId, eventType, payload = {}, options = {}) {
  const occurredAt = options.occurredAt || new Date().toISOString();
  return callStore('record_event', {
    userId: String(userId),
    eventType: String(eventType),
    occurredAt,
    correlationKey: options.correlationKey || 'security',
    dedupeKey: options.dedupeKey || `${eventType}:security:${occurredAt}`,
    payload,
  }, {
    delays: [0],
    timeoutMs: 3500,
  });
}

export async function listActivityEvents(userId, limit = 20) {
  return (await callStore('list_events', {
    userId,
    limit: Math.max(1, Math.min(50, Number(limit || 20))),
  }, {
    delays: [0],
    timeoutMs: 4000,
  })) || [];
}

export async function getAutomationSettings(userId) {
  return (await callStore('get_automation_settings', {
    userId: String(userId),
  }, {
    delays: [0],
    timeoutMs: 3500,
  })) || { rules: {} };
}

export async function updateAutomationSettings(userId, rules = {}) {
  return callStore('update_automation_settings', {
    userId: String(userId),
    rules,
  }, {
    delays: [0],
    timeoutMs: 3500,
  });
}

export async function listAutomationJobs(userId, limit = 20) {
  return (await callStore('list_automation_jobs', {
    userId: String(userId),
    limit: Math.max(1, Math.min(50, Number(limit || 20))),
  }, {
    delays: [0],
    timeoutMs: 4000,
  })) || [];
}

export async function claimAutomationJobs(limit = 10) {
  return (await callStore('claim_automation_jobs', {
    limit: Math.max(1, Math.min(25, Number(limit || 10))),
  }, {
    delays: [0],
    timeoutMs: 5000,
  })) || [];
}

export async function completeAutomationJob(jobId, success, error = null) {
  return callStore('complete_automation_job', {
    jobId: String(jobId),
    success: Boolean(success),
    error: error ? String(error).slice(0, 500) : null,
  }, {
    delays: [0],
    timeoutMs: 3500,
  });
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
  return (await callStore('get_analytics', { userId }, {
    delays: [0],
    timeoutMs: 14000,
  })) || {
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
  return (await callStore('get_export', { userId }, {
    delays: [0],
    timeoutMs: 14000,
  })) || {
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
