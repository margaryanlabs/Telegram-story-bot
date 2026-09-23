import { getViewerExportData } from '../lib/viewer-sync-store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const data = await getViewerExportData('0');
    res.status(200).json({
      ok: true,
      exportShape: {
        stories: Array.isArray(data?.stories),
        viewers: Array.isArray(data?.viewers),
        generatedAt: Boolean(data?.generatedAt),
      },
    });
  } catch (error) {
    res.status(503).json({ ok: false, error: error?.message || String(error) });
  }
}
