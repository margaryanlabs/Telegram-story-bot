import { viewerStoreHealth } from '../lib/viewer-sync-store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const store = await viewerStoreHealth();
    res.status(200).json({ ok: true, store });
  } catch (error) {
    res.status(503).json({ ok: false, error: error?.message || String(error) });
  }
}
