/* VETOGRAM visual review with an allowlisted READ-ONLY public media API.
 * No Telegram auth, Business or database is served.
 * Standalone free-host static preview; never use for authenticated production.
 */
import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {handlePreviewMediaApi} from './vetogram-preview-public-api.mjs';

const root=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const mimetypes=Object.freeze({
 '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
 '.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
 '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
 '.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif',
 '.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2',
 '.mp3':'audio/mpeg','.mp4':'video/mp4','.webm':'video/webm',
 '.txt':'text/plain; charset=utf-8',
});
const fail=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(JSON.stringify({ok:false,...body}));};
const server=http.createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method))return fail(res,405,{error:'method_not_allowed'});
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}
 catch{return fail(res,400,{error:'bad_path'});}
 if(pathname.startsWith('/api/')) {
  return handlePreviewMediaApi(req,res,new URL(req.url,'http://localhost'));
 }
 if(pathname==='/')pathname='/studio.html';
 if(!/^\/[A-Za-z0-9/_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(pathname)||
    pathname.split('/').some(p=>p.startsWith('.'))){
  return fail(res,404,{error:'not_found'});
 }
 const file=resolve(root,'.'+pathname);
 if(!file.startsWith(root+sep))return fail(res,404,{error:'not_found'});
 try{
  const info=await stat(file);
  if(!info.isFile())return fail(res,404,{error:'not_found'});
  const mime=mimetypes[extname(file).toLowerCase()];
  if(!mime)return fail(res,404,{error:'not_found'});
  res.writeHead(200,{'Content-Type':mime,
    'Content-Length':info.size,'Cache-Control':mime.startsWith('text/html')?'no-store':'public, max-age=60',
    'Referrer-Policy':'strict-origin-when-cross-origin','X-Content-Type-Options':'nosniff',
    'X-Robots-Tag':'noindex, nofollow, noarchive'});
  if(req.method==='HEAD')return res.end();
  createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 }catch{return fail(res,404,{error:'not_found'});}
});
const port=Number(process.env.PORT)||10000;
server.listen(port,'0.0.0.0',()=>console.log('VETOGRAM_VISUAL_PREVIEW_READY port='+port));
