import { signStoryPilotRequest } from './viewer-sync-signing.js';

const STORE_URL = 'https://xvtmgzzaomolnvkcgosk.supabase.co/functions/v1/story-pilot-store';

export function viewerDbConfigured() {
  return Boolean(process.env.TELEGRAM_API_HASH && process.env.TELEGRAM_BOT_TOKEN);
}

async function callStore(op, args = {}) {
  if (!viewerDbConfigured()) {
    throw new Error('Viewer Sync storage signing is not configured');
  }

  const payload = { op, args };
  const signed = signStoryPilotRequest(payload);

  const response = await fetch(STORE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-story-timestamp': signed.timestamp,
      'x-story-signature': signed.signature,
    },
    body: signed.body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    throw new Error(`Viewer Sync store ${response.status}: ${data?.error || response.statusText || 'request failed'}`);
  }
  return data.data;
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

export async function acquireViewerWatchLease(seconds = 55) {
  return Boolean(await callStore('acquire_watch_lease', {
    seconds: Math.max(10, Math.min(300, Number(seconds || 55))),
  }));
}
