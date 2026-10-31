import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import handler from '../api/play-room.js';
import { readFileSync } from 'node:fs';

function response() {
  return {
    headers:{},httpStatus:0,data:null,
    setHeader(k,v){this.headers[k]=v;},
    status(v){this.httpStatus=v;return this;},
    json(body){this.data=body;return this;},
  };
}
function signedMiniApp(token='test-bot-token',userId=123456789) {
  const now=Math.floor(Date.now()/1000);
  const params=new URLSearchParams();
  params.set('auth_date',String(now));
  params.set('user',JSON.stringify({id:userId,first_name:'Tester'}));
  const ordered=[...params.entries()].sort(([a],[b])=>a.localeCompare(b));
  const data=ordered.map(([k,v])=>k+'='+v).join('\n');
  const secret=crypto.createHmac('sha256','WebAppData').update(token).digest();
  const hash=crypto.createHmac('sha256',secret).update(data).digest('hex');
  params.set('hash',hash);
  return params.toString();
}
async function call(req) {
  const res=response();
  await handler({method:'POST',query:{},headers:{},...req},res);
  return res;
}
test('Play-room endpoint exposes only a configuration flag without user data',async()=>{
  const res=await call({method:'GET',query:{health:'1'}});
  assert.equal(res.httpStatus,200);
  assert.equal(res.data.ok,true);
  assert.equal(typeof res.data.configured,'boolean');
  assert.equal(res.headers['Cache-Control'],'no-store, max-age=0');
  assert.equal(Object.hasOwn(res.data,'token'),false);
});
test('Play-room endpoint denies requests without a valid Telegram signature',async()=>{
  const response=await call({method:'POST',headers:{'content-type':'application/json'},body:{action:'create'}});
  assert.equal(response.httpStatus,401);
  assert.equal(response.data.error,'auth_required');
});
test('Play-room endpoint returns unavailable until isolated Neon database is configured',async()=>{
  const oldBot=process.env.TELEGRAM_BOT_TOKEN;
  const oldDatabase=process.env.VETOGRAM_PLAY_DATABASE_URL;
  process.env.TELEGRAM_BOT_TOKEN='test-bot-token';
  delete process.env.VETOGRAM_PLAY_DATABASE_URL;
  try{
    const signature=signedMiniApp();
    const res=await call({
      headers:{'x-telegram-init-data':signature,'content-type':'application/json'},
      body:{action:'create'},
    });
    assert.equal(res.httpStatus,503);
    assert.equal(res.data.error,'not_configured');
    assert.equal(Object.hasOwn(res.data,'room'),false);
    const oversized=await call({
      headers:{'x-telegram-init-data':signature,'content-type':'application/json','content-length':'999999'},
      body:{action:'create'},
    });
    assert.equal(oversized.httpStatus,413);
    assert.equal(oversized.data.error,'too_large');
  }finally{
    if(oldBot===undefined)delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN=oldBot;
    if(oldDatabase===undefined)delete process.env.VETOGRAM_PLAY_DATABASE_URL;
    else process.env.VETOGRAM_PLAY_DATABASE_URL=oldDatabase;
  }
});
test('Play-room endpoint cannot be called with mutating GET',async()=>{
  const res=await call({method:'PATCH'});
  assert.equal(res.httpStatus,405);
  assert.equal(res.headers.Allow,'GET, POST');
});
test('room feature remains isolated to the API router and new Play files',()=>{
  const router=readFileSync(new URL('../api/router.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
  const client=readFileSync(new URL('../public/vetogram-play-room.js',import.meta.url),'utf8');
  assert.match(router,/"play-room": \(\) => import\("\.\/play-room\.js"\)/);
  assert.match(html,/id="vpRoomCreate"/);
  assert.match(html,/id="vpRoomBoard"/);
  assert.match(html,/vetogram-play-room\.js/);
  assert.doesNotMatch(client,/document\.cookie|telegram-chats|localStorage\.setItem\([^)]*initData/);
});
