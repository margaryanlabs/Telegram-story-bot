import test from 'node:test';
import assert from 'node:assert/strict';
import { createVetogramRenderServer } from '../scripts/vetogram-render-server.mjs';

async function withServer(handler) {
  const server=createVetogramRenderServer({
    router:async(req,res)=>{
      if(req.query.route==='echo')return res.status(200).json({ok:true,method:req.method,query:req.query,body:req.body||null});
      if(req.query.route==='redirect')return res.redirect('/studio.html');
      return res.status(404).json({ok:false,error:'unknown_api_endpoint'});
    },
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  try{return await handler(origin);}
  finally{await new Promise(resolve=>server.close(resolve));}
}
test('Render adapter serves V9 studio but cannot serve source secrets or dotfiles',async()=>{
  await withServer(async origin=>{
    const page=await fetch(origin+'/');
    assert.equal(page.status,200);
    assert.match(await page.text(),/VETOGRAM|VETO/i);
    const script=await fetch(origin+'/app.js');
    assert.equal(script.status,200);
    assert.match(String(script.headers.get('content-type')),/javascript/);
    for(const path of ['/api/private/extra','/../lib/neon-store.js','/%2eenv','/lib/neon-store.js']){
      const res=await fetch(origin+path);
      assert.equal(res.status,404,path);
    }
  });
});
test('Render adapter parses real JSON POST requests and forwards query without losing owner-signature headers',async()=>{
  await withServer(async origin=>{
    const res=await fetch(origin+'/api/echo?limit=2',{
      method:'POST',headers:{'content-type':'application/json','x-telegram-init-data':'signed-test'},
      body:JSON.stringify({action:'prepare',chatId:'101'}),
    });
    const data=await res.json();
    assert.equal(res.status,200);
    assert.equal(data.query.limit,'2');
    assert.equal(data.query.route,'echo'); // fixture sees route; production router strips it
    assert.deepEqual(data.body,{action:'prepare',chatId:'101'});
  });
});
test('Render adapter rejects malformed JSON before calling API handler',async()=>{
  await withServer(async origin=>{
    const res=await fetch(origin+'/api/echo',{method:'POST',
      headers:{'content-type':'application/json'},body:'{broken'});
    assert.equal(res.status,400);
    assert.equal((await res.json()).error,'invalid_request');
  });
});
test('Render liveness endpoint does not require Telegram secrets',async()=>{
  await withServer(async origin=>{
    const res=await fetch(origin+'/_render/healthz');
    assert.equal(res.status,200);
    assert.equal(await res.text(),'ready');
  });
});
test('Render redirects only within the same origin',async()=>{
  await withServer(async origin=>{
    const res=await fetch(origin+'/api/redirect',{redirect:'manual'});
    assert.equal(res.status,302);
    assert.equal(res.headers.get('location'),'/studio.html');
  });
});

test('staging rejects webhook and setup writes without changing the Telegram bot',async()=>{
  const original=process.env.VETOGRAM_RENDER_STAGE;
  process.env.VETOGRAM_RENDER_STAGE='true';
  try{
    await withServer(async origin=>{
      for(const path of ['/api/webhook-v7','/api/webhook-v8','/api/setup']){
        const res=await fetch(origin+path,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
        assert.equal(res.status,403,path);
        assert.equal((await res.json()).error,'staging_bot_mutation_disabled');
      }
    });
  }finally{
    if(original===undefined)delete process.env.VETOGRAM_RENDER_STAGE;
    else process.env.VETOGRAM_RENDER_STAGE=original;
  }
});
