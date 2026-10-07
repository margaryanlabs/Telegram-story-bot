const CACHE_NAME = 'veto-relay-shell-v1';
const SHELL = [
  '/relay.html',
  '/relay-bootstrap.css?v=20261007-v1',
  '/relay-bootstrap.js?v=20261007-v1',
  '/veto-telegram-mark.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  const isRelayShell = url.pathname === '/relay.html'
    || url.pathname === '/relay-bootstrap.css'
    || url.pathname === '/relay-bootstrap.js'
    || url.pathname === '/veto-telegram-mark.svg';

  if (!isRelayShell) return;

  event.respondWith(
    caches.match(request, { ignoreSearch:true }).then(cached => {
      const network = fetch(request).then(response => {
        if (response?.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      }).catch(() => cached);

      return cached || network;
    })
  );
});
