/* Vetogram Hobby deployment adapter.
 * This module is the only deployed Vercel Function. All existing endpoint
 * handlers remain untouched and retain their original paths via routing.
 * No authorization, webhook, or persistence operations happen here.
 */
const endpointLoaders = {
  "automation-run": () => import("./automation-run.js"),
  "automations": () => import("./automations.js"),
  "business-wizard": () => import("./business-wizard.js"),
  "emoji-studio": () => import("./emoji-studio.js"),
  "health": () => import("./health.js"),
  "miniapp": () => import("./miniapp.js"),
  "privacy-backup-worker": () => import("./privacy-backup-worker.js"),
  "privacy-backup": () => import("./privacy-backup.js"),
  "privacy-media-recover": () => import("./privacy-media-recover.js"),
  "privacy-media": () => import("./privacy-media.js"),
  "privacy": () => import("./privacy.js"),
  "relay-bootstrap": () => import("./relay-bootstrap.js"),
  "relay": () => import("./relay.js"),
  "setup": () => import("./setup.js"),
  "telegram-chat-media": () => import("./telegram-chat-media.js"),
  "telegram-chat-updates": () => import("./telegram-chat-updates.js"),
  "telegram-chats": () => import("./telegram-chats.js"),
  "telegram-intelligence-search": () => import("./telegram-intelligence-search.js"),
  "telegram-message-context": () => import("./telegram-message-context.js"),
  "telegram-send": () => import("./telegram-send.js"),
  "telegram-sticker-preview": () => import("./telegram-sticker-preview.js"),
  "telegram-sticker-previews": () => import("./telegram-sticker-previews.js"),
  "telegram-stories": () => import("./telegram-stories.js"),
  "viewer-analytics-health": () => import("./viewer-analytics-health.js"),
  "viewer-export-health": () => import("./viewer-export-health.js"),
  "viewer-public-key": () => import("./viewer-public-key.js"),
  "viewer-qr": () => import("./viewer-qr.js"),
  "viewer-store-health": () => import("./viewer-store-health.js"),
  "viewer-sync": () => import("./viewer-sync.js"),
  "viewer-watch": () => import("./viewer-watch.js"),
  "webhook-v7": () => import("./webhook-v7.js"),
  "webhook-v8": () => import("./webhook-v8.js"),
};

export default async function vetogramApiRouter(req,res) {
  const rawRoute = req.query?.route;
  const route = typeof rawRoute === 'string' ? rawRoute : '';
  if (!Object.prototype.hasOwnProperty.call(endpointLoaders,route)) {
    res.setHeader('Cache-Control','no-store');
    return res.status(404).json({ok:false,error:'Unknown API endpoint'});
  }
  // Vercel's route parameter belongs to this adapter, not the handler.
  const url = new URL(req.url || '/', 'http://localhost');
  url.searchParams.delete('route');
  req.url = '/api/' + route + (url.search || '');
  if (req.query && typeof req.query === 'object') {
    delete req.query.route;
  }
  try {
    const module = await endpointLoaders[route]();
    if (typeof module.default !== 'function') {
      throw new Error('Route module does not export a handler: '+route);
    }
    return await module.default(req,res);
  } catch(err) {
    console.error('[Vetogram API] unhandled endpoint error',route,err?.message||String(err));
    if (!res.headersSent) return res.status(500).json({ok:false,error:'Internal server error'});
  }
}
