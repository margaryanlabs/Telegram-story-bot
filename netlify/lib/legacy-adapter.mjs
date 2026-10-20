import { Readable } from 'node:stream';

// Netlify supplies Fetch Request/Response; the existing Vercel API uses Node req/res.
// Preserve Telegram POST bodies, request headers, query parameters and binary responses.
export async function toNetlify(request, legacyHandler) {
  const url = new URL(request.url);
  const rawBody = ['GET', 'HEAD'].includes(request.method)
    ? Buffer.alloc(0)
    : Buffer.from(await request.arrayBuffer());
  const headerMap = Object.fromEntries(request.headers.entries());
  headerMap.host ||= url.host;
  const contentType = request.headers.get('content-type') || '';
  let parsedBody;
  if (rawBody.length && /\bapplication\/json\b/i.test(contentType)) {
    try { parsedBody = JSON.parse(rawBody.toString('utf8')); }
    catch { parsedBody = rawBody.toString('utf8'); }
  } else if (rawBody.length && /\bapplication\/x-www-form-urlencoded\b/i.test(contentType)) {
    parsedBody = Object.fromEntries(new URLSearchParams(rawBody.toString('utf8')));
  } else if (rawBody.length) {
    parsedBody = rawBody;
  }
  const req = Readable.from(rawBody.length ? [rawBody] : []);
  Object.assign(req, {
    method: request.method,
    url: url.pathname + url.search,
    originalUrl: url.pathname + url.search,
    headers: headerMap,
    query: Object.fromEntries(url.searchParams.entries()),
    body: parsedBody,
    rawBody,
    cookies: Object.fromEntries(
      (headerMap.cookie || '').split(';').map((part) => {
        const index = part.indexOf('=');
        return index < 0 ? [] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
      }).filter((part) => part.length === 2),
    ),
    socket: { remoteAddress: (headerMap['x-forwarded-for'] || '').split(',')[0]?.trim() || '' },
  });
  const headers = new Headers();
  let statusCode = 200;
  let ended = false;
  const chunks = [];
  const res = {
    get statusCode() { return statusCode; },
    set statusCode(value) { statusCode = Number(value) || 500; },
    get headersSent() { return ended; },
    status(code) { statusCode = code; return this; },
    setHeader(name, value) {
      if (Array.isArray(value)) {
        headers.delete(name);
        for (const part of value) headers.append(name, String(part));
      } else headers.set(name, String(value));
      return this;
    },
    getHeader(name) { return headers.get(name); },
    removeHeader(name) { headers.delete(name); return this; },
    writeHead(code, values) {
      statusCode = code;
      if (values) for (const [name, value] of Object.entries(values)) this.setHeader(name, value);
      return this;
    },
    write(data) {
      if (data !== undefined && data !== null) chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(String(data)));
      return true;
    },
    end(data) {
      if (data !== undefined && data !== null) this.write(data);
      ended = true;
      return this;
    },
    json(value) {
      this.setHeader('Content-Type', 'application/json; charset=utf-8');
      return this.end(JSON.stringify(value));
    },
    send(value) {
      if (value !== undefined && value !== null && typeof value === 'object' && !Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
        return this.json(value);
      }
      if (!headers.has('content-type')) this.setHeader('Content-Type', Buffer.isBuffer(value) ? 'application/octet-stream' : 'text/plain; charset=utf-8');
      return this.end(value);
    },
    redirect(codeOrUrl, maybeUrl) {
      const code = typeof codeOrUrl === 'number' ? codeOrUrl : 302;
      this.status(code).setHeader('Location', typeof codeOrUrl === 'number' ? maybeUrl : codeOrUrl);
      return this.end();
    },
  };
  try {
    await legacyHandler(req, res);
  } catch (error) {
    console.error('Legacy API handler error:', error?.message || String(error));
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
  if (!ended) {
    console.error('Legacy API handler returned without completing a response:', url.pathname);
    return Response.json({ ok: false, error: 'Incomplete function response' }, { status: 502 });
  }
  const noBody = request.method === 'HEAD' || [204, 205, 304].includes(statusCode);
  return new Response(noBody ? null : Buffer.concat(chunks), { status: statusCode, headers });
}
