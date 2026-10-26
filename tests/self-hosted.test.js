import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHandler} from '../server/self-hosted.js';
async function onServer(handler,fn){
 const server=createServer(handler);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{return await fn('http://127.0.0.1:'+server.address().port);}
 finally{await new Promise(r=>server.close(r));}
}
test('API GET preserves query and rejects client route override',async()=>{
 await onServer(createHandler({apiHandler:async(req,res)=>res.status(200).json({url:req.url,query:req.query})}),async base=>{
  const r=await fetch(base+'/api/health?route=evil&n=1'),j=await r.json();
  assert.equal(r.status,200);assert.equal(j.query.route,'health');assert.equal(j.query.n,'1');
 });
});
test('POST JSON is parsed, malformed and oversized bodies denied',async()=>{
 await onServer(createHandler({apiHandler:async(req,res)=>res.status(200).json({body:req.body})}),async base=>{
  const ok=await fetch(base+'/api/test',{method:'POST',headers:{'content-type':'application/json'},body:'{"x":1}'});
  assert.equal((await ok.json()).body.x,1);
  const bad=await fetch(base+'/api/test',{method:'POST',headers:{'content-type':'application/json'},body:'{'});
  assert.equal(bad.status,400);
  const large=await fetch(base+'/api/test',{method:'POST',headers:{'content-type':'text/plain'},body:'x'.repeat(8*1024*1024+100)});
  assert.equal(large.status,413);
 });
});
test('static root is private, denies unsupported files and symlink escapes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'vetogram-http-'));
 try{
  writeFileSync(join(dir,'studio.html'),'private site');
  writeFileSync(join(dir,'portal.html'),'portal');
  writeFileSync(join(dir,'relay.html'),'relay');
  writeFileSync(join(dir,'app.js'),'const x=1');
  writeFileSync(join(dir,'secret.env'),'topsecret');
  symlinkSync('/etc/hosts',join(dir,'leak.txt'));
  await onServer(createHandler({publicRoot:dir,apiHandler:async(req,res)=>res.end()}),async base=>{
   const home=await fetch(base+'/');assert.equal(await home.text(),'private site');
   assert.match(home.headers.get('cache-control'),/no-store/);
   const portal=await fetch(base+'/portal.html');
   assert.match(portal.headers.get('content-security-policy'),/frame-ancestors 'none'/);
   const relay=await fetch(base+'/relay.html');
   assert.match(relay.headers.get('content-security-policy'),/connect-src 'self'/);
   assert.equal(relay.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
   assert.equal((await fetch(base+'/secret.env')).status,404);
   assert.equal((await fetch(base+'/leak.txt')).status,404);
   assert.equal((await fetch(base+'/api/not%2Froute')).status,404);
   assert.equal((await fetch(base+'/app.js')).headers.get('content-type'),'text/javascript; charset=utf-8');
  });
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('staging release identity is disabled unless explicitly enabled',async()=>{
 const original={MARKARIAN_RELEASE_ENABLED:process.env.MARKARIAN_RELEASE_ENABLED,MARKARIAN_ENVIRONMENT:process.env.MARKARIAN_ENVIRONMENT,MARKARIAN_SOURCE_SHA:process.env.MARKARIAN_SOURCE_SHA};
 try{
  delete process.env.MARKARIAN_RELEASE_ENABLED;
  delete process.env.MARKARIAN_ENVIRONMENT;
  delete process.env.MARKARIAN_SOURCE_SHA;
  await onServer(createHandler({apiHandler:async(req,res)=>res.status(404).end()}),async base=>{
   const absent=await fetch(base+'/api/markarian-release');assert.equal(absent.status,404);
   process.env.MARKARIAN_RELEASE_ENABLED='staging-only';
   process.env.MARKARIAN_ENVIRONMENT='staging';
   process.env.MARKARIAN_SOURCE_SHA='a'.repeat(40);
   const ok=await fetch(base+'/api/markarian-release');assert.equal(ok.status,200);
   assert.deepEqual(await ok.json(),{schema:'markarian-app-release/v1',environment:'staging',product:'vetogram',repository:'margaryanlabs/Telegram-story-bot',commit:'a'.repeat(40)});
   assert.match(ok.headers.get('cache-control'),/no-store/);
  });
 }finally{
  for(const [key,val] of Object.entries(original)){
   if(val===undefined)delete process.env[key];else process.env[key]=val;
  }
 }
});
