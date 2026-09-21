import { storyPilotPublicKey } from '../lib/viewer-sync-signing.js';

export default async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    res.status(200).json({
      ok: true,
      algorithm: 'Ed25519',
      key: storyPilotPublicKey(),
      project: 'telegram-story-bot',
    });
  } catch (error) {
    res.status(503).json({ ok: false, error: error?.message || String(error) });
  }
}
