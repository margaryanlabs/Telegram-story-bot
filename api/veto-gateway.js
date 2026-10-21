// VETO Hobby gateway: keep existing API modules unchanged while deploying as ONE Vercel function.
// Each route is explicitly allowlisted. This does not enable any new authenticated behavior.
const handlers = Object.freeze({
  'webhook-v7': () => import('./webhook-v7.js'),
  'webhook-v8': () => import('./webhook-v8.js'),
  'miniapp': () => import('./miniapp.js'),
  'emoji-studio': () => import('./emoji-studio.js'),
  'privacy': () => import('./privacy.js'),
  'privacy-backup': () => import('./privacy-backup.js'),
  'business-wizard': () => import('./business-wizard.js'),
  'telegram-message-context': () => import('./telegram-message-context.js'),
  'telegram-intelligence-search': () => import('./telegram-intelligence-search.js'),
  'telegram-chats': () => import('./telegram-chats.js'),
  'telegram-chat-updates': () => import('./telegram-chat-updates.js'),
  'telegram-send': () => import('./telegram-send.js'),
  'telegram-chat-media': () => import('./telegram-chat-media.js'),
  'telegram-sticker-preview': () => import('./telegram-sticker-preview.js'),
  'telegram-sticker-previews': () => import('./telegram-sticker-previews.js'),
  'privacy-backup-worker': () => import('./privacy-backup-worker.js'),
  'privacy-media': () => import('./privacy-media.js'),
  'privacy-media-recover': () => import('./privacy-media-recover.js'),
  'relay': () => import('./relay.js'),
  'relay-bootstrap': () => import('./relay-bootstrap.js'),
  'viewer-sync': () => import('./viewer-sync.js'),
  'viewer-qr': () => import('./viewer-qr.js'),
  'viewer-watch': () => import('./viewer-watch.js'),
  'viewer-public-key': () => import('./viewer-public-key.js'),
  'viewer-store-health': () => import('./viewer-store-health.js'),
  'viewer-analytics-health': () => import('./viewer-analytics-health.js'),
  'viewer-export-health': () => import('./viewer-export-health.js'),
  'setup': () => import('./setup.js'),
  'automations': () => import('./automations.js'),
  'automation-run': () => import('./automation-run.js'),
  'health': () => import('./health.js'),
  'telegram-stories': () => import('./telegram-stories.js'),
});

export default async function handler(req, res) {
  const raw = req.query?.route;
  const route = typeof raw === 'string' ? raw : '';
  if (!Object.hasOwn(handlers, route)) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(404).json({ ok: false, error: 'Unknown VETO API route' });
    return;
  }
  try {
    const module = await handlers[route]();
    return await module.default(req, res);
  } catch (error) {
    // No stack traces, request parameters or secret values in client responses.
    console.error('VETO API route failure:', route, error?.name || 'Error');
    if (!res.headersSent) res.status(500).json({ ok: false, error: 'Internal server error' });
    else if (!res.writableEnded) res.end();
  }
}
