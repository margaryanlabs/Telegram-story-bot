/* RB5 QR auth lifecycle: use the real shipping stream controller in a VM.
 * No credentials, real QR token, Telegram session or network operation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {TextEncoder,TextDecoder} from 'node:util';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('public/app.js');
const qrApi=read('api/viewer-qr.js');
const begin=app.indexOf('  async function startViewerQrLogin() {');
const end=app.indexOf('  function viewerStorySheet() {',begin);
assert.ok(begin>=0&&end>begin,'real QR stream controller must exist');
const controllerSource=app.slice(begin,end);
const encode=new TextEncoder();

function fixture({events=[],deferFetch=false,changeOnRefresh=false}={}){
  const sheet={hidden:true},calls=[],qrEvents=[];
  const viewerState={newConnectionsReady:true,loginPending:null};
  const tg={initData:'signed-A'};
  let resolveFetch;
  const stream={getReader:()=>{
    let pointer=0;
    return {read:async()=>{
      if(pointer>=events.length)return {done:true,value:undefined};
      return {done:false,value:encode.encode(JSON.stringify(events[pointer++])+'\n')};
    }};
  }};
  const response={ok:true,body:stream};
  const context=vm.createContext({
    tg,viewerState,viewerOwnerEpoch:1,viewerQrAbortController:null,
    AbortController,TextDecoder,
    $:id=>id==='sheet'?sheet:null,
    fetch:(_url,options)=>{
      calls.push({type:'fetch',url:_url,owner:options.headers['x-telegram-init-data']});
      return deferFetch?new Promise(resolve=>{resolveFetch=resolve;}):Promise.resolve(response);
    },
    viewerQrSheet:()=>{sheet.hidden=false;calls.push({type:'qr-sheet'});},
    viewerSetupSheet:()=>calls.push({type:'setup'}),
    updateViewerQr:e=>qrEvents.push(e),
    viewerPasswordSheet:hint=>calls.push({type:'password',hint}),
    renderViewerPendingLoginNotice:()=>calls.push({type:'pending'}),
    closeSheet:()=>{sheet.hidden=true;calls.push({type:'close'})},
    notify:()=>{},showToast:message=>calls.push({type:'toast',message}),
    refreshViewerSync:async()=>{
      calls.push({type:'refresh'});
      if(changeOnRefresh){context.viewerOwnerEpoch++;tg.initData='signed-B';}
    },
    refresh:async()=>calls.push({type:'refresh-main'}),
    refreshViewerAnalytics:async()=>calls.push({type:'refresh-analytics'}),
    switchScreen:screen=>calls.push({type:'navigate',screen}),
    offerBusinessConsentAfterLogin:()=>calls.push({type:'offer-business'}),
  });
  vm.runInContext(controllerSource,context,{timeout:1000});
  return {
    context,calls,qrEvents,sheet,viewerState,tg,
    start:()=>vm.runInContext('startViewerQrLogin()',context),
    finishFetch:()=>resolveFetch(response),
  };
}

test('QR password challenge becomes resumable without storing a secret',async()=>{
  const expiresAt=new Date(Date.now()+10*60_000).toISOString();
  const f=fixture({events:[{type:'qr',uri:'tg://login?token=fake'},
    {type:'password_required',stage:'qr_password',expiresAt,hint:'hint only'}]});
  await f.start();
  assert.equal(f.viewerState.loginPending.stage,'qr_password');
  assert.equal(f.viewerState.loginPending.expiresAt,expiresAt);
  assert.deepEqual(Object.keys(f.viewerState.loginPending).sort(),['expiresAt','stage']);
  assert.ok(f.calls.some(x=>x.type==='password'));
  assert.ok(f.calls.some(x=>x.type==='pending'));
  assert.equal(f.calls.some(x=>x.type==='navigate'),false);
  assert.match(qrApi,/stage: 'qr_password'/);
  assert.match(qrApi,/type: 'password_required'[\s\S]*?expiresAt:new Date\(now\.getTime\(\) \+ AUTH_TTL_MS\)\.toISOString\(\)/);
});

test('closed QR modal ignores an already started network response',async()=>{
  const f=fixture({deferFetch:true,events:[{type:'connected'}]});
  const pending=f.start();
  f.sheet.hidden=true;
  f.finishFetch();
  await pending;
  assert.equal(f.calls.some(x=>x.type==='navigate'),false);
  assert.equal(f.calls.some(x=>x.type==='refresh'),false);
});

test('owner change during QR request never shows old QR nor opens previous account',async()=>{
  const f=fixture({deferFetch:true,events:[{type:'connected'}]});
  const pending=f.start();
  f.context.viewerOwnerEpoch++;
  f.tg.initData='signed-B';
  f.finishFetch();
  await pending;
  assert.equal(f.qrEvents.length,0);
  assert.equal(f.calls.some(x=>x.type==='navigate'),false);
});

test('owner change after connected stream but during refresh does not redirect new owner',async()=>{
  const f=fixture({events:[{type:'connected'}],changeOnRefresh:true});
  await f.start();
  assert.equal(f.calls.some(x=>x.type==='refresh'),true);
  assert.equal(f.calls.some(x=>x.type==='navigate'),false);
  assert.equal(f.calls.some(x=>x.type==='offer-business'),false);
});

test('stream closing without confirmation surfaces an explicit retry state',async()=>{
  const f=fixture({events:[{type:'starting'}]});
  await f.start();
  assert.ok(f.qrEvents.some(e=>e.type==='error'&&/без подтверждения/.test(e.error)));
  assert.equal(f.calls.some(x=>x.type==='navigate'),false);
});

test('explicit QR expiration is not overwritten by generic stream error',async()=>{
  const f=fixture({events:[{type:'expired',error:'QR истёк'}]});
  await f.start();
  assert.deepEqual(f.qrEvents.map(x=>x.type),['expired']);
});

test('QR stream does not implicitly send a phone code or grant Business rights',()=>{
  assert.doesNotMatch(controllerSource,/viewerApi\('send_code'/);
  assert.doesNotMatch(controllerSource,/viewerApi\('resend_code'/);
  assert.match(controllerSource,/ownerEpoch===viewerOwnerEpoch/);
  assert.match(controllerSource,/viewerQrAbortController===controller/);
  assert.match(controllerSource,/if\(!isCurrent\(\)\)return;/);
});
