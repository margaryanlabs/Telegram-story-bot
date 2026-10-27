/**
 * VETOGRAM BOOKS — read-only catalog + book text.
 * Data source: Gutendex (Project Gutenberg metadata). No keys or user account required.
 * We deliberately allowlist upstream hosts, cap payloads, and never accept a remote URL from clients.
 */
const API = 'https://gutendex.com';
const MAX_BOOK_BYTES = 3_000_000;
const MAX_RESULTS = 32;
const LANGUAGES = new Set(['all', 'en', 'ru', 'fr', 'de', 'es', 'it', 'pt', 'hy']);
const SOURCE_HOSTS = new Set(['www.gutenberg.org', 'gutenberg.org']);

const send = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
};

const clean = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const integer = (v, fallback, max) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 1 && n <= max ? n : fallback;
};

export function bookSummary(book) {
  const formats = book?.formats || {};
  const textKey = Object.keys(formats).find(k => k.startsWith('text/plain') && k.includes('utf-8'))
    || Object.keys(formats).find(k => k.startsWith('text/plain'));
  const htmlKey = Object.keys(formats).find(k => k.startsWith('text/html'));
  const link = formats[textKey] || formats[htmlKey] || '';
  return {
    id: Number(book.id),
    title: clean(book.title, 320),
    authors: (book.authors || []).slice(0, 3).map(a => clean(a.name, 120)),
    language: (book.languages || [])[0] || 'und',
    cover: typeof formats['image/jpeg'] === 'string' ? formats['image/jpeg'] : '',
    summary: clean(book.summaries?.[0], 1000),
    subjects: (book.subjects || []).slice(0, 6).map(v => clean(v, 120)),
    downloads: Number(book.download_count) || 0,
    readable: Boolean(link && book.copyright === false && book.media_type === 'Text'),
    copyright: book.copyright,
    source: 'Project Gutenberg',
    sourceUrl: 'https://www.gutenberg.org/ebooks/' + Number(book.id),
  };
}

async function remote(url, timeout = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'VetogramBooks/1.0 (human-requested-catalog)' }, signal: controller.signal });
  } finally { clearTimeout(id); }
}

async function catalog(req, res) {
  const q = clean(req.query.q, 100);
  const lang = clean(req.query.lang, 8) || 'all';
  const topic = clean(req.query.topic, 50);
  const page = integer(req.query.page, 1, 100);
  if (!LANGUAGES.has(lang)) return send(res, 400, { ok:false, error:'Unsupported language' });
  const params = new URLSearchParams({ page:String(page), copyright:'false', mime_type:'text/' });
  if (q) params.set('search', q);
  if (lang !== 'all') params.set('languages', lang);
  if (topic) params.set('topic', topic);
  const response = await remote(API + '/books/?' + params);
  if (!response.ok) return send(res, 502, { ok:false, error:'Catalog temporarily unavailable' });
  const payload = await response.json();
  if (!Array.isArray(payload.results)) return send(res, 502, { ok:false, error:'Invalid catalog response' });
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
  return send(res, 200, {
    ok:true, count:Math.max(0,Number(payload.count)||0), page,
    nextPage: payload.next ? page + 1 : null,
    books: payload.results.slice(0,MAX_RESULTS).map(bookSummary).filter(b => b.readable && Number.isSafeInteger(b.id))
  });
}

function validSource(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && SOURCE_HOSTS.has(u.hostname) && !u.username && !u.password;
  } catch { return false; }
}
async function getSource(url, charset = 'utf-8') {
  // Manually follow only trusted Gutenberg redirects (never arbitrary hosts).
  let next = url;
  for (let i = 0; i < 5; i++) {
    if (!validSource(next)) throw new Error('Untrusted source');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(next, { redirect:'manual', headers:{'Accept':'text/plain,text/html;q=0.8'} , signal:controller.signal });
      if ([301,302,303,307,308].includes(response.status)) {
        const redirect = response.headers.get('location');
        if (!redirect) throw new Error('Missing redirect');
        next = new URL(redirect, next).toString();
        continue;
      }
      if (!response.ok) throw new Error('Source unavailable');
      const size = Number(response.headers.get('content-length'));
      if (Number.isFinite(size) && size > MAX_BOOK_BYTES) throw new Error('Book too large');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Empty source');
      const blocks = [];
      let total = 0;
      while(true) {
        const {done,value} = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BOOK_BYTES) {
          await reader.cancel();
          throw new Error('Book too large');
        }
        blocks.push(value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const block of blocks) { bytes.set(block, offset); offset += block.length; }
      let text;
      try { text = new TextDecoder(charset, { fatal:false }).decode(bytes); }
      catch { text = new TextDecoder('utf-8', { fatal:false }).decode(bytes); }
      if (/<html[\s>]/i.test(text.slice(0,1500))) {
        // Gutenberg HTML variant fallback, returned strictly as text (never rendered as HTML).
        text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
          .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
          .replace(/<\/(?:p|div|h[1-6]|section|li|blockquote)>/gi,'\n\n')
          .replace(/<br\s*\/?\s*>/gi,'\n')
          .replace(/<[^>]+>/g,'')
          .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<')
          .replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'");
      }
      return text.replace(/\r\n?/g, '\n').replace(/\n{5,}/g,'\n\n\n').trim();
    } finally {clearTimeout(timer);}
  }
  throw new Error('Too many redirects');
}

async function textForBook(req, res) {
  const id = integer(req.query.id, 0, 999999);
  if (!id) return send(res, 400, { ok:false, error:'Invalid book id' });
  const metaRes = await remote(API + '/books/' + id, 12000);
  if (metaRes.status === 404) return send(res, 404, {ok:false,error:'Book not found'});
  if (!metaRes.ok) return send(res, 502, {ok:false,error:'Catalog temporarily unavailable'});
  const book = await metaRes.json();
  const meta = bookSummary(book);
  if (!meta.readable) return send(res, 403, {ok:false,error:'This book has no supported public-domain full text'});
  const formats = book.formats || {};
  const textKey = Object.keys(formats).find(k => k.startsWith('text/plain') && k.includes('utf-8'))
    || Object.keys(formats).find(k => k.startsWith('text/plain'));
  const htmlKey = Object.keys(formats).find(k => k.startsWith('text/html'));
  const original = formats[textKey] || formats[htmlKey];
  if (!validSource(original)) return send(res, 502, {ok:false,error:'Unsupported original host'});
  const declaredCharset = /charset=([a-z0-9-]+)/i.exec(textKey || '')?.[1] || 'utf-8';
  const fullText = await getSource(original, declaredCharset);
  if (fullText.length < 120) return send(res, 502, {ok:false,error:'Full text unavailable'});
  res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=604800');
  return send(res, 200, {ok:true,book:meta,text:fullText});
}

export default async function handler(req,res) {
  if (req.method !== 'GET') return send(res,405,{ok:false,error:'Method not allowed'});
  try {
    if (req.query.mode === 'text') return await textForBook(req,res);
    return await catalog(req,res);
  } catch (error) {
    console.error('[Vetogram Books]', error?.message || String(error));
    return send(res,502,{ok:false,error:'Book service temporarily unavailable'});
  }
}
