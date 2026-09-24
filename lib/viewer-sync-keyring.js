const KEY_BROKER_URL = 'https://xvtmgzzaomolnvkcgosk.supabase.co/functions/v1/story-pilot-key-broker';
const CACHE_MS = 5 * 60 * 1000;
let cache = null;

function normalizeEntry(entry) {
  const id = String(entry?.id || '').trim();
  const key = String(entry?.key || '').trim();
  if (!id || id.includes('.') || key.length < 32) return null;
  return { id, key };
}

function explicitKeyring() {
  const key = String(process.env.VIEWER_SYNC_MASTER_KEY || '').trim();
  if (!key) return null;
  const id = String(process.env.VIEWER_SYNC_MASTER_KEY_ID || 'env-primary').trim() || 'env-primary';
  const current = normalizeEntry({ id, key });
  if (!current) return null;

  let previous = [];
  try {
    const raw = String(process.env.VIEWER_SYNC_PREVIOUS_KEYS_JSON || '').trim();
    if (raw) {
      const parsed = JSON.parse(raw);
      const entries = Array.isArray(parsed)
        ? parsed
        : Object.entries(parsed || {}).map(([entryId, entryKey]) => ({ id: entryId, key: entryKey }));
      previous = entries.map(normalizeEntry).filter(Boolean).slice(0, 3);
    }
  } catch {
    previous = [];
  }

  return { current, previous, source: 'environment' };
}

async function brokerKeyring() {
  const oidc = String(process.env.VERCEL_OIDC_TOKEN || '').trim();
  if (!oidc) return null;
  if (cache?.expiresAt > Date.now()) return cache.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(KEY_BROKER_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${oidc}`,
        'content-type': 'application/json',
      },
      body: '{}',
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) {
      throw new Error(`Viewer Sync key broker unavailable (${response.status})`);
    }
    const current = normalizeEntry(data.keyring?.current);
    if (!current) throw new Error('Viewer Sync key broker returned an invalid current key');
    const previous = Array.isArray(data.keyring?.previous)
      ? data.keyring.previous.map(normalizeEntry).filter(Boolean).slice(0, 3)
      : [];
    const value = { current, previous, source: 'vercel_oidc_broker' };
    cache = { value, expiresAt: Date.now() + CACHE_MS };
    return value;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Viewer Sync key broker timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function secureViewerKeySourceConfigured() {
  return Boolean(process.env.VIEWER_SYNC_MASTER_KEY || process.env.VERCEL_OIDC_TOKEN);
}

export async function getViewerSyncKeyring({ required = true } = {}) {
  const explicit = explicitKeyring();
  if (explicit) return explicit;
  try {
    const broker = await brokerKeyring();
    if (broker) return broker;
  } catch (error) {
    if (required) throw error;
    return null;
  }
  if (required) throw new Error('Secure Viewer Sync keyring is not configured');
  return null;
}

export function clearViewerSyncKeyringCache() {
  cache = null;
}
