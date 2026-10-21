import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import setupHandler from '../api/setup.js';
import gatewayHandler from '../api/veto-gateway.js';

const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
function mockResponse(){
  return {
    statusCode:200, headers:{}, payload:null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(code){this.statusCode=code;return this;},
    json(data){this.payload=data;return this;}
  };
}

test('Hobby deploy builds one API gateway, not >12 serverless functions', () => {
  const functions=config.builds.filter(b=>b.use==='@vercel/node');
  assert.deepEqual(functions.map(x=>x.src),['api/veto-gateway.js']);
  assert.ok(config.routes.some(r=>r.src==='^/api/([^/]+)$' && r.dest==='/api/veto-gateway.js?route=$1'));
  assert.ok(config.routes.some(r=>r.src==='^/(.*)$' && r.dest==='/public/$1'));
});

test('Missing or unlisted API gateway route is denied', async () => {
  const res=mockResponse();
  await gatewayHandler({query:{route:'not-a-real-route'}},res);
  assert.equal(res.statusCode,404);
  assert.equal(res.payload.ok,false);
});

test('Setup refuses mutations without the correct authorization', async () => {
  const savedToken=process.env.TELEGRAM_BOT_TOKEN;
  const savedSecret=process.env.SETUP_SECRET;
  process.env.TELEGRAM_BOT_TOKEN='test-token-not-real';
  process.env.SETUP_SECRET='known-test-secret';
  try {
    const res=mockResponse();
    await setupHandler({method:'POST',headers:{}},res);
    assert.equal(res.statusCode,401);
    assert.equal(res.payload.ok,false);
  } finally {
    if(savedToken===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=savedToken;
    if(savedSecret===undefined)delete process.env.SETUP_SECRET;else process.env.SETUP_SECRET=savedSecret;
  }
});

test('Read-only setup reports configured webhook accurately', async () => {
  const savedToken=process.env.TELEGRAM_BOT_TOKEN;
  const savedBase=process.env.STORY_PILOT_BASE_URL;
  const savedFetch=globalThis.fetch;
  const base='https://veto-labsmargaryan-5386.vercel.app';
  process.env.TELEGRAM_BOT_TOKEN='test-token-not-real';
  process.env.STORY_PILOT_BASE_URL=base;
  globalThis.fetch=async url=>({
    ok:true,
    json:async()=>({
      ok:true,
      result:String(url).endsWith('/getMe')
        ? {username:'Vetotg_bot'}
        : {url:'https://old-host.invalid/api/webhook-v8',pending_update_count:0},
    }),
  });
  try{
    const res=mockResponse();
    await setupHandler({method:'GET',headers:{}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.payload.bot,'@Vetotg_bot');
    assert.equal(res.payload.webhook_matches,false);
    assert.equal(res.payload.expected_webhook,base+'/api/webhook-v8');
  }finally{
    globalThis.fetch=savedFetch;
    if(savedToken===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=savedToken;
    if(savedBase===undefined)delete process.env.STORY_PILOT_BASE_URL;else process.env.STORY_PILOT_BASE_URL=savedBase;
  }
});

test('Owner setup console never stores setup secret in a persistent browser store',()=>{
  const html=readFileSync(new URL('../public/veto-setup.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../public/veto-setup.js',import.meta.url),'utf8');
  assert.ok(html.includes('autocomplete="off"'));
  assert.equal(/localStorage|sessionStorage|document\.cookie|URLSearchParams\(/.test(js),false);
  assert.ok(js.includes("method: 'POST'"));
});
