import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('resuming an existing Telegram code preserves its real delivery type without leaking credentials',()=>{
  const server=read('api/viewer-sync.js'),app=read('public/app.js');
  assert.ok(server.includes("pendingDelivery = sealed?.isCodeViaApp === true ? 'telegram_app'"));
  assert.ok(server.includes("...(loginChallenge.stage === 'code' ? { delivery: pendingDelivery } : {})"));
  assert.ok(server.includes("if (typeof auth?.phoneCodeHash !== 'string'"));
  assert.ok(server.includes("|| typeof auth?.session !== 'string'"));
  assert.ok(!server.includes('phoneCodeHash: sealed.phoneCodeHash'));
  assert.ok(!server.includes('loginPending: { phone:'));
  assert.ok(app.includes("viewerCodeSheet(pending.delivery||'unknown',true)"));
  assert.ok(app.includes("viewerCodeSheet(viewerState.loginPending?.delivery||'unknown',true)"));
  assert.ok(!app.includes('StoryLab'));
});

test('Telegram login does not request a code if the initial connection hangs',()=>{
  const source=read('lib/viewer-sync-telegram.js');
  const start=source.indexOf('export async function beginUserAuth(phoneNumber)');
  const end=source.indexOf('export async function verifyUserCode(',start);
  const flow=source.slice(start,end);
  assert.ok(flow.includes("withTimeout(client.connect(), 8000, 'Telegram phone connect')"));
  assert.ok(flow.indexOf('withTimeout(client.connect()')<flow.indexOf('client.sendCode('));
  assert.ok(flow.includes('Promise.race(['));
  assert.ok(flow.includes('client.disconnect().catch(() => {})'));
  assert.ok(!flow.includes('withTimeout(client.sendCode('),
    'Do not create a phantom code by timing out an already-sent Telegram request');
});
test('live chat API fails closed when the authenticated Telegram user changes mid-request',async()=>{
  const source=read('public/telegram-chats.js');
  const start=source.indexOf('  async function request(action,payload={}){');
  const stop=source.indexOf('  function showNotice(',start);
  assert.ok(start>=0&&stop>start);
  let resolveNetwork;
  const pending=new Promise(resolve=>{resolveNetwork=resolve;});
  let resets=0;
  const tg={initData:'signed-A'};
  const state={ownerInitData:'signed-A'};
  const fetch=(url,options)=>pending.then(()=>{
    assert.equal(options.headers['x-telegram-init-data'],'signed-A');
    return {ok:true,json:async()=>({ok:true,chats:[{id:10}]})};
  });
  const request=vm.runInNewContext(source.slice(start,stop)+'\nrequest',{
    tg,state,fetch,AbortController,setTimeout,clearTimeout,
    resetOwner(){resets++;state.ownerInitData=String(tg.initData);},
  });
  const result=request('list',{page:0});
  tg.initData='signed-B';
  resolveNetwork();
  await assert.rejects(result,/аккаунт изменился/i);
  assert.equal(resets,1);
});
test('stale chat/media/avatars cannot overwrite refreshed identity or surface secret content',()=>{
  const js=read('public/telegram-chats.js');
  assert.ok(js.includes('state.generation++;state.threadGeneration++'));
  assert.ok(js.includes('state.chats=[];state.messages=[];state.thread=null'));
  assert.ok(js.includes("if(generation!==state.generation)return"));
  assert.ok(js.includes("if(generation!==state.threadGeneration||String(state.thread?.id)!==chatId)return"));
  assert.ok(js.includes('owner!==state.ownerInitData'));
  assert.ok(js.includes('URL.revokeObjectURL(href);return;'));
  assert.ok(js.includes('state.avatarUrls.clear();state.avatarLoaded=0'));
  assert.ok(js.includes("window.addEventListener('focus',resetOwner)"));
  assert.ok(js.includes("window.addEventListener('pageshow',resetOwner)"));
});
test('late microphone permission response is disposed after navigating away from Voice Studio',async()=>{
  const source=read('public/voice-studio.js');
  const start=source.indexOf('  async function startMic(){'),end=source.indexOf('  function releaseRecording(){',start);
  assert.ok(start>=0&&end>start);
  const state={active:false,opening:false,micEpoch:0};
  let resolveMedia,stops=0,contextCreated=0;
  const tg=document=>document;
  const document={hidden:false,querySelector:()=>({dataset:{screen:'voice'}})};
  const pending=new Promise(resolve=>{resolveMedia=resolve;});
  const context={
    state,document,window:{AudioContext:class {constructor(){contextCreated++;}}},
    navigator:{mediaDevices:{getUserMedia:()=>pending}},audioSupported:true,
    $:()=>({disabled:false}),toast(){},updateButtons(){},setStrength(){},draw(){},
  };
  const startMic=vm.runInNewContext(source.slice(start,end)+'\nstartMic',context);
  const attempt=startMic();
  assert.equal(state.opening,true);
  // The app has been hidden while Android/Telegram permissions were open.
  document.hidden=true;
  state.micEpoch++;
  state.opening=false;
  resolveMedia({getTracks:()=>[{stop(){stops++;}}]});
  await attempt;
  assert.equal(stops,1);
  assert.equal(contextCreated,0,'AudioContext must not start after backgrounding');
  assert.equal(state.active,false);
});
test('Voice Studio stops microphone on hidden Telegram WebView as well as navigation',()=>{
  const js=read('public/voice-studio.js');
  assert.ok(js.includes('opening:false,micEpoch:0'));
  assert.ok(js.includes('state.micEpoch++;state.opening=false;'));
  assert.ok(js.includes("error?.message==='MIC_CANCELLED'"));
  assert.ok(js.includes("if(document.hidden&&(state.active||state.opening))"));
  assert.ok(js.includes("event.detail?.screen!=='voice'&&(state.active||state.opening)"));
  assert.ok(js.includes("window.addEventListener('pagehide'"));
});
