/**
 * Vetogram native Render adapter.
 * Runs the same allowlisted API handlers as the Vercel router, rather than a
 * visual-only mock. No webhook changes or Telegram permissions at startup.
 */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';
import vetogramApiRouter from '../api/router.js';

const PUBLIC_ROOT = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const MAX_BODY_BYTES = 24 * 1024 * 1024;
const TYPES = Object.freeze({
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.gif':'image/gif', '.ico':'image/x-icon',
  '.woff':'font/woff', '.woff2':'font/woff2',
  '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.wav':'audio/wav',
  '.mp4':'video/mp4', '.webm':'video/webm',
  '.txt':'text/plain; charset=utf-8', '.pdf':'application/pdf',
});
const sendJson = (res, status, value) => {
  if (res.headersSent || res.writableEnded) return;
  res.statusCode = status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(value));
};
const fail = (res,status,error) => sendJson(res,status,{ok:false,error});

function prepareVercelResponse(res) {
  res.status = function(code) { this.statusCode=code; return this; };
  res.json = function(value) { sendJson(this,this.statusCode || 200,value); return this; };
  res.send = function(value) {
    if (this.writableEnded) return this;
    if (value && typeof value==='object' && !Buffer.isBuffer(value)) return this.json(value);
    if (!this.getHeader('Content-Type')) this.setHeader('Content-Type',
      Buffer.isBuffer(value) ? 'application/octet-stream' : 'text/plain; charset=utf-8');
    this.end(value ?? ''); return this;
  };
  res.redirect = function(codeOrUrl,other) {
    const status=typeof codeOrUrl==='number'?codeOrUrl:302;
    const target=typeof codeOrUrl==='number'?other:codeOrUrl;
    if (typeof target!=='string' || !target.startsWith('/')) return this.status(400).json({ok:false,error:'invalid_redirect'});
    this.statusCode=status;this.setHeader('Location',target);this.end();return this;
  };
}

async function readBody(req) {
  let size=0;
  const chunks=[];
  for await (const chunk of req) {
    size+=chunk.length;
    if (size>MAX_BODY_BYTES) {
      const err=new Error('request_too_large');err.status=413;throw err;
    }
    chunks.push(chunk);
  }
  const buffer=Buffer.concat(chunks);
  if (!buffer.length) return {};
  const mime=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
  if (mime==='application/json'||mime==='application/ld+json') {
    try {return JSON.parse(buffer.toString('utf8'));}
    catch {const err=new Error('invalid_json');err.status=400;throw err;}
  }
  if (mime==='application/x-www-form-urlencoded') return Object.fromEntries(new URLSearchParams(buffer.toString('utf8')));
  return buffer;
}

async function serveStatic(req,res,pathname,root) {
  if(!['GET','HEAD'].includes(req.method))return fail(res,405,'method_not_allowed');
  if(pathname==='/')pathname='/studio.html';
  // Resolve only public assets. Dotfiles, traversal, encoded slashes and
  // directory listing must never expose server-side modules or secrets.
  if (!/^\/[A-Za-z0-9_./-]+$/.test(pathname)
    || pathname.split('/').some(part=>part===''?false:part==='.'||part==='..'||part.startsWith('.'))) {
    return fail(res,404,'not_found');
  }
  const file=resolve(root,'.'+pathname);
  if(!file.startsWith(root+sep))return fail(res,404,'not_found');
  const type=TYPES[extname(file).toLowerCase()];
  if(!type)return fail(res,404,'not_found');
  try {
    const info=await stat(file);
    if(!info.isFile())return fail(res,404,'not_found');
    res.setHeader('Content-Type',type);
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
    res.setHeader('Cache-Control',type.startsWith('text/html')?'no-store':'public, max-age=0, must-revalidate');
    const range=String(req.headers.range||'');
    if(range && /^(?:audio|video)\//.test(type)) {
      const match=/^bytes=(\d+)-(\d*)$/.exec(range);
      const start=match?Number(match[1]):-1;
      const end=match&&match[2]!==''?Number(match[2]):info.size-1;
      if(!match||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||end>=info.size) {
        res.setHeader('Content-Range','bytes */'+info.size);
        res.statusCode=416;return res.end();
      }
      res.statusCode=206;
      res.setHeader('Accept-Ranges','bytes');
      res.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`);
      res.setHeader('Content-Length',end-start+1);
      if(req.method==='HEAD')return res.end();
      return createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res);
    }
    res.statusCode=200;
    res.setHeader('Content-Length',info.size);
    if(req.method==='HEAD')return res.end();
    return createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  } catch {return fail(res,404,'not_found');}
}

export function createVetogramRenderServer({root=PUBLIC_ROOT,router=vetogramApiRouter}={}) {
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    let url;
    try {url=new URL(req.url||'/','http://vetogram.local');}
    catch {return fail(res,400,'invalid_url');}
    const pathname=url.pathname;
    if(pathname==='/_render/healthz') {
      if(!['GET','HEAD'].includes(req.method))return fail(res,405,'method_not_allowed');
      res.setHeader('Cache-Control','no-store');
      res.statusCode=200;
      if(req.method==='HEAD')return res.end();
      return res.end('ready');
    }
    if(pathname.startsWith('/api/')) {
      const match=/^\/api\/([a-z0-9-]+)$/.exec(pathname);
      if(!match)return fail(res,404,'unknown_api_endpoint');
      prepareVercelResponse(res);
      req.query=Object.fromEntries(url.searchParams.entries());
      req.query.route=match[1];
      try {
        if(!['GET','HEAD'].includes(req.method))req.body=await readBody(req);
        return await router(req,res);
      } catch(error) {
        if(!res.headersSent) return fail(res,error?.status||500,error?.status?'invalid_request':'internal_server_error');
        if(!res.writableEnded)res.end();
        return;
      }
    }
    let decoded;
    try {decoded=decodeURIComponent(pathname);}
    catch {return fail(res,400,'invalid_path');}
    return serveStatic(req,res,decoded,root);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT)||10000;
  createVetogramRenderServer().listen(port,'0.0.0.0',()=>{
    console.log('VETOGRAM_FULLSTACK_RENDER_READY port='+port);
  });
}
