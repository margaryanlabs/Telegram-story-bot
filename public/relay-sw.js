/* VETO Relay offline fallback, isolated from the VETOGRAM Mini App.
 * Always fetch current Relay HTML/assets online; fall back to exactly matched
 * versioned assets only while offline. No API or chat response is cached.
 */
const CACHE_NAME = 'veto-relay-shell-v411-20261026';
const SHELL = [
  '/relay.html',
  '/relay-bootstrap.css?v=20261026-v411-relay',
  '/relay-bootstrap.js?v=20261026-v411-relay',
  '/veto-telegram-mark.svg',
];
const RELAY_PATHS = new Set([
  '/relay.html',
  '/relay-bootstrap.css',
  '/relay-bootstrap.js',
  '/veto-telegram-mark.svg',
]);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL))
      .catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('veto-relay-shell-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || !RELAY_PATHS.has(url.pathname)) return;

  event.respondWith((async() => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // Network-first avoids stale JS/CSS when Telegram WebView comes online.
      const response = await fetch(request, { cache:'no-store' });
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(cache.put(request, copy).catch(() => {}));
      }
      return response;
    } catch {
      // Respect the exact versioned URL: ignoreSearch would return old JS.
      return await cache.match(request) || Response.error();
    }
  })());
});
