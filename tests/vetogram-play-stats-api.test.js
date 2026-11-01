import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import handler from '../api/play-stats.js';

function signed(token='play-test-token'){
  const params=new URLSearchParams({
    auth_date:String(Math.floor(Date.now()/1000)),
    user:JSON.stringify({id:123456789,first_name:'Play Tester'})
  });
  const string=[...params.entries()].sort(([a],[b])=>a.localeCompare(b))
    .map(([a,b])=>a+'='+b).join('\n');
  const secret=crypto.createHmac('sha256','WebAppData').update(token).digest();
  params.set('hash',crypto.createHmac('sha256',secret).update(string).digest('hex'));
  return params.toString();
}
async function call(request){
  const res={
    httpStatus:0,headers:{},data:null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(v){this.httpStatus=v;return this;},
    json(value){this.data=value;return this;}
  };
  await handler({method:'GET',query:{},headers:{},...request},res);
  return res;
}
test('Stats API rejects anonymous users before accessing game database',async()=>{
  const response=await call({method:'GET',query:{view:'leaders'}});
  assert.equal(response.httpStatus,401);
  assert.equal(response.data.error,'auth_required');
  assert.equal(response.headers['Cache-Control'],'no-store, max-age=0');
});
test('Stats API does not invent player results while Neon remains unconfigured',async()=>{
  const token=process.env.TELEGRAM_BOT_TOKEN;
  const oldUrl=process.env.VETOGRAM_PLAY_DATABASE_URL;
  try{
    process.env.TELEGRAM_BOT_TOKEN='play-test-token';
    delete process.env.VETOGRAM_PLAY_DATABASE_URL;
    const r=await call({method:'GET',query:{view:'mine'},
      headers:{'x-telegram-init-data':signed()}});
    assert.equal(r.httpStatus,503);
    assert.equal(r.data.error,'not_configured');
    assert.equal(Object.hasOwn(r.data,'profile'),false);
    assert.equal(Object.hasOwn(r.data,'leaders'),false);
  }finally{
    if(token===undefined)delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN=token;
    if(oldUrl===undefined)delete process.env.VETOGRAM_PLAY_DATABASE_URL;
    else process.env.VETOGRAM_PLAY_DATABASE_URL=oldUrl;
  }
});
test('Stats API rejects invalid methods and huge submissions',async()=>{
  const method=await call({method:'DELETE'});
  assert.equal(method.httpStatus,405);
  assert.equal(method.headers.Allow,'GET, POST');
  const token=process.env.TELEGRAM_BOT_TOKEN;
  const db=process.env.VETOGRAM_PLAY_DATABASE_URL;
  try{
    process.env.TELEGRAM_BOT_TOKEN='play-test-token';
    process.env.VETOGRAM_PLAY_DATABASE_URL='postgresql://example.invalid/unused';
    const huge=await call({method:'POST',headers:{
      'x-telegram-init-data':signed(),'content-type':'application/json','content-length':'100000'
    },body:{action:'leaderboard_visibility',visible:true}});
    assert.equal(huge.httpStatus,413);
    const content=await call({method:'POST',headers:{
      'x-telegram-init-data':signed(),'content-type':'text/plain'
    },body:{action:'leaderboard_visibility',visible:true}});
    assert.equal(content.httpStatus,415);
  }finally{
    if(token===undefined)delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN=token;
    if(db===undefined)delete process.env.VETOGRAM_PLAY_DATABASE_URL;
    else process.env.VETOGRAM_PLAY_DATABASE_URL=db;
  }
});
