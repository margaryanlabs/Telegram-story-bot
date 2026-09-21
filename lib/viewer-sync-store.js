const TABLES = {
  sessions: 'story_pilot_viewer_sessions',
  challenges: 'story_pilot_viewer_auth_challenges',
  stories: 'story_pilot_stories',
  viewers: 'story_pilot_viewers',
  snapshots: 'story_pilot_viewer_snapshots',
};

const SHARED_SUPABASE_URL = 'https://xvtmgzzaomolnvkcgosk.supabase.co';

function baseUrl() {
  return String(process.env.STORY_PILOT_SUPABASE_URL || SHARED_SUPABASE_URL).trim().replace(/\/$/, '');
}

function serviceKey() {
  return String(process.env.STORY_PILOT_SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

export function viewerDbConfigured() {
  const hasEncryptionMaterial = Boolean(
    process.env.VIEWER_SYNC_MASTER_KEY
    || (process.env.TELEGRAM_API_HASH && process.env.TELEGRAM_BOT_TOKEN)
  );
  return Boolean(baseUrl() && serviceKey() && hasEncryptionMaterial);
}

async function rest(table, {
  method = 'GET',
  query = '',
  body,
  prefer,
  single = false,
} = {}) {
  if (!viewerDbConfigured()) {
    throw new Error('Viewer Sync storage is not configured');
  }

  const url = `${baseUrl()}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const headers = {
    apikey: serviceKey(),
    Authorization: `Bearer ${serviceKey()}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  if (single) headers.Accept = 'application/vnd.pgrst.object+json';

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return null;
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!response.ok) {
    const detail = data?.message || data?.hint || text || response.statusText;
    throw new Error(`Viewer Sync DB ${response.status}: ${detail}`);
  }
  return data;
}

function eq(value) {
  return `eq.${encodeURIComponent(String(value))}`;
}

export async function getViewerSession(userId) {
  const rows = await rest(TABLES.sessions, {
    query: `telegram_user_id=${eq(userId)}&select=*&limit=1`,
  });
  return rows?.[0] || null;
}

export async function upsertViewerSession(row) {
  const rows = await rest(TABLES.sessions, {
    method: 'POST',
    query: 'on_conflict=telegram_user_id',
    body: row,
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  return rows?.[0] || null;
}

export async function updateViewerSession(userId, patch) {
  const rows = await rest(TABLES.sessions, {
    method: 'PATCH',
    query: `telegram_user_id=${eq(userId)}`,
    body: patch,
    prefer: 'return=representation',
  });
  return rows?.[0] || null;
}

export async function deleteViewerSession(userId) {
  return rest(TABLES.sessions, {
    method: 'DELETE',
    query: `telegram_user_id=${eq(userId)}`,
  });
}

export async function getAuthChallenge(userId) {
  const rows = await rest(TABLES.challenges, {
    query: `telegram_user_id=${eq(userId)}&select=*&limit=1`,
  });
  return rows?.[0] || null;
}

export async function saveAuthChallenge(row) {
  const rows = await rest(TABLES.challenges, {
    method: 'POST',
    query: 'on_conflict=telegram_user_id',
    body: row,
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  return rows?.[0] || null;
}

export async function deleteAuthChallenge(userId) {
  return rest(TABLES.challenges, {
    method: 'DELETE',
    query: `telegram_user_id=${eq(userId)}`,
  });
}

export async function trackPublishedStory(row) {
  if (!viewerDbConfigured()) return null;
  const rows = await rest(TABLES.stories, {
    method: 'POST',
    query: 'on_conflict=telegram_user_id,story_id',
    body: row,
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  return rows?.[0] || null;
}

export async function markStoryDeleted(userId, storyId) {
  if (!viewerDbConfigured()) return null;
  return rest(TABLES.stories, {
    method: 'PATCH',
    query: `telegram_user_id=${eq(userId)}&story_id=${eq(storyId)}`,
    body: { active: false, deleted_at: new Date().toISOString() },
    prefer: 'return=minimal',
  });
}

export async function listActiveViewerSessions(limit = 10) {
  return rest(TABLES.sessions, {
    query: `status=eq.active&select=*&order=last_poll_at.asc.nullsfirst&limit=${Math.max(1, Math.min(50, limit))}`,
  }) || [];
}

export async function listStoriesForOwner(userId, limit = 8) {
  const now = new Date().toISOString();
  return rest(TABLES.stories, {
    query: `telegram_user_id=${eq(userId)}&active=eq.true&watch_until=gt.${encodeURIComponent(now)}&select=*&order=posted_at.desc&limit=${Math.max(1, Math.min(20, limit))}`,
  }) || [];
}

export async function updateStoryStats(userId, storyId, patch) {
  const rows = await rest(TABLES.stories, {
    method: 'PATCH',
    query: `telegram_user_id=${eq(userId)}&story_id=${eq(storyId)}`,
    body: patch,
    prefer: 'return=representation',
  });
  return rows?.[0] || null;
}

export async function listViewerRows(userId, storyId) {
  return rest(TABLES.viewers, {
    query: `telegram_user_id=${eq(userId)}&story_id=${eq(storyId)}&select=*&order=first_seen_at.asc`,
  }) || [];
}

export async function upsertViewerRow(row) {
  const rows = await rest(TABLES.viewers, {
    method: 'POST',
    query: 'on_conflict=telegram_user_id,story_id,viewer_user_id',
    body: row,
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  return rows?.[0] || null;
}

export async function deleteViewerRow(userId, storyId, viewerUserId) {
  return rest(TABLES.viewers, {
    method: 'DELETE',
    query: `telegram_user_id=${eq(userId)}&story_id=${eq(storyId)}&viewer_user_id=${eq(viewerUserId)}`,
  });
}

export async function insertSnapshot(row) {
  return rest(TABLES.snapshots, {
    method: 'POST',
    body: row,
    prefer: 'return=minimal',
  });
}

export async function getViewerStoryData(userId, storyId) {
  const stories = await rest(TABLES.stories, {
    query: `telegram_user_id=${eq(userId)}&story_id=${eq(storyId)}&select=*&limit=1`,
  });
  const story = stories?.[0] || null;
  const viewers = await rest(TABLES.viewers, {
    query: `telegram_user_id=${eq(userId)}&story_id=${eq(storyId)}&status=eq.confirmed&select=viewer_user_id,username,display_name,viewed_at,reaction_json,is_contact&order=viewed_at.desc&limit=500`,
  }) || [];
  return { story, viewers };
}
