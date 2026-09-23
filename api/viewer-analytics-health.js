import { getViewerAnalytics } from '../lib/viewer-sync-store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const analytics = await getViewerAnalytics('0');
    res.status(200).json({
      ok: true,
      analyticsShape: {
        uniqueViewers: analytics?.uniqueViewers ?? null,
        repeatViewers: analytics?.repeatViewers ?? null,
        topPeople: Array.isArray(analytics?.topPeople),
        storyPerformance: Array.isArray(analytics?.storyPerformance),
      },
    });
  } catch (error) {
    res.status(503).json({ ok: false, error: error?.message || String(error) });
  }
}
