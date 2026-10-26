/** Portable Node HTTP adapter for the existing VETOGRAM Vercel-style API.
 * Runs behind Coolify HTTPS reverse proxy. Does not register Telegram webhooks.
 */
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {realpath,stat} from 'node:fs/promises';
import {dirname,extname,resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import vetogramApiRouter from '../api/router.js';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../public');
const MAX_BODY=8*1024*1024;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
 '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
 '.webp':'image/webp','.ico':'image/x-icon','.webm':'video/webm','.mp4':'video/mp4',
 '.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.wasm':'application/wasm'};
const privateHtml=new Set(['studio.html','portal.html']);
export function attachResponseMethods(res){
 res.status=function(code){this.statusCode=code;return this;};
 res.json=function(body){this.setHeader('Content-Type','application/json; charset=utf-8');
  this.setHeader('Cache-Control','no-store');this.end(JSON.stringify(body));return this;};
 res.send=function(body){
  if(!this.hasHeader('Content-Type'))this.setHeader('Content-Type',Buffer.isBuffer(body)?'application/octet-stream':'text/plain; charset=utf-8');
  this.end(body);return this;
 };
 return res;
}
export async function readBoundedBody(req,max=MAX_BODY){
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>max){const e=new Error('body_too_large');e.statusCode=413;throw e;}chunks.push(chunk);}
 const raw=Buffer.concat(chunks);if(!raw.length)return undefined;
 const type=String(req.headers['content-type']||'').split(';',1)[0].toLowerCase().trim();
 if(type==='application/json'){
  try{return JSON.parse(raw.toString('utf8'));}
  catch{const e=new Error('invalid_json');e.statusCode=400;throw e;}
 }
 if(type==='application/x-www-form-urlencoded')return Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
 if(type==='text/plain')return raw.toString('utf8');
 const e=new Error('unsupported_body_type');e.statusCode=415;throw e;
}
async function serveStatic(path,req,res,root){
 if(!['GET','HEAD'].includes(req.method)){res.status(405).json({ok:false,error:'Method not allowed'});return;}
 const name=path==='/'?'studio.html':path.slice(1);
 if(!name||name.includes('\\')||name.includes('\0')||name.includes('%')||name.split('/').includes('..')){res.status(404).end();return;}
 const expected=resolve(root,name);
 if(!expected.startsWith(root+sep)){res.status(404).end();return;}
 try{
  const real=await realpath(expected),file=await stat(real);
  if(!real.startsWith(root+sep)||!file.isFile()){res.status(404).end();return;}
  const ext=extname(real).toLowerCase();if(!Object.prototype.hasOwnProperty.call(MIME,ext)){res.status(404).end();return;}
  res.setHeader('Content-Type',MIME[ext]);res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control',privateHtml.has(name)?'no-store, max-age=0':'public, max-age=300');
  if(name==='portal.html'){
   res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
   res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  }
  res.setHeader('Content-Length',String(file.size));
  if(req.method==='HEAD'){res.status(200).end();return;}
  const stream=createReadStream(real);
  stream.on('error',()=>{if(!res.headersSent)res.status(503).end();else res.destroy();});
  stream.pipe(res);
 }catch{res.status(404).end();}
}
export function createHandler({apiHandler=vetogramApiRouter,publicRoot=ROOT}={}){
 const root=resolve(publicRoot);
 return async function handler(req,res){
  attachResponseMethods(res);res.setHeader('X-Content-Type-Options','nosniff');
  let url;try{url=new URL(req.url||'/','http://127.0.0.1');}catch{res.status(400).end();return;}
  const path=url.pathname;
  if(path.startsWith('/api/')){
   const route=path.slice(5);
   if(!/^[A-Za-z0-9-]+$/.test(route)){res.status(404).json({ok:false,error:'Not found'});return;}
   req.query={...Object.fromEntries(url.searchParams.entries()),route};
   if(['POST','PUT','PATCH'].includes(req.method)){
    try{req.body=await readBoundedBody(req);}
    catch(e){res.status(e.statusCode||400).json({ok:false,error:e.message});return;}
   }
   try{
    await apiHandler(req,res);
    if(!res.writableEnded&&!res.headersSent)res.status(500).json({ok:false,error:'Handler did not respond'});
   }catch{
    if(!res.headersSent)res.status(500).json({ok:false,error:'Internal error'});
    else res.destroy();
   }
   return;
  }
  await serveStatic(path,req,res,root);
 };
}
export function start(port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1'){
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid listen port');
 const server=createServer(createHandler());
 server.headersTimeout=20000;server.requestTimeout=45000;server.keepAliveTimeout=5000;
 server.listen(port,host);return server;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)start();
