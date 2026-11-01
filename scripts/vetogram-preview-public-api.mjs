/**
 * Public, read-only media API used exclusively by the VISUAL PREVIEW server.
 * Never forward Telegram headers, cookies, launch data or private endpoints.
 * The production Vercel API router is deliberately not imported.
 */
const publicRoutes = Object.freeze({
  '/api/books': () => import('../api/books.js'),
  '/api/books-discover': () => import('../api/books-discover.js'),
  '/api/books-wikisource': () => import('../api/books-wikisource.js'),
  '/api/cinema-channels': () => import('../api/cinema-channels.js'),
});

export function isPublicPreviewApiPath(pathname) {
  return Object.prototype.hasOwnProperty.call(publicRoutes, pathname);
}

export async function handlePreviewMediaApi(req, res, url) {
  if (!isPublicPreviewApiPath(url.pathname)) {
    return reply(res, 503, {ok:false,error:'preview_only',
      message:'Личные функции Telegram и базы данных в предпросмотре отключены.'});
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return reply(res, 405, {ok:false,error:'method_not_allowed'});
  }
  if (url.search.length > 600 || [...url.searchParams.keys()].length > 14) {
    return reply(res, 400, {ok:false,error:'invalid_query'});
  }

  // Reconstruct minimal request. Never pass request cookies or Authorization.
  const query = Object.fromEntries(url.searchParams);
  const incoming = {method:'GET',query};
  const outbound = {
    statusCode: 200,
    status(code) { this.statusCode = Number.isInteger(code) && code >= 100 && code <= 599 ? code : 500; return this; },
    setHeader(name, value) {
      if (/^(cache-control|content-type|allow)$/i.test(name)) res.setHeader(name, value);
      return this;
    },
    json(payload) { return reply(res, this.statusCode, payload); },
  };
  try {
    const module = await publicRoutes[url.pathname]();
    if (typeof module.default !== 'function') throw new Error('Public handler missing');
    await module.default(incoming, outbound);
    if (!res.writableEnded) reply(res, 502, {ok:false,error:'no_response'});
  } catch (err) {
    console.error('[Vetogram media preview]', url.pathname, String(err?.message || 'upstream error'));
    if (!res.headersSent) reply(res, 502, {ok:false,error:'media_service_unavailable',
      message:'Источник медиа временно недоступен. Попробуйте ещё раз.'});
    else res.end();
  }
}

function reply(res, status, payload) {
  if (res.writableEnded) return res;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.writeHead(status);
  res.end(JSON.stringify(payload));
  return res;
}
