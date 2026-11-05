/* RB6: same-owner logout is a privacy boundary for in-flight requests.
 * This test runs the shipping controller excerpts in Node VM with deferred
 * owner-authenticated responses, without contacting Telegram or storing data.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('public/app.js');
const chats=read('public/telegram-chats.js');
const begin=app.indexOf('  function notifyTelegramSessionDisconnected(){');
const end=app.indexOf('  // Returning from Telegram',begin);
const apiBegin=app.indexOf('  async function api(action = null, payload = {}) {');
const apiEnd=app.indexOf('  async function viewerApi(',apiBegin);
assert.ok(begin>=0&&end>begin&&apiBegin>=0&&apiEnd>apiBegin);
const code=app.slice(begin,end);
const actionCode=app.slice(apiBegin,apiEnd);
function deferred(){
  let resolve;
  const promise=new Promise(next=>{resolve=next;});
  return {promise,resolve};
}
function fixture(getter){
  const events=[],renders=[];
  const state={accountConnection:{connected:true,account:{username:'test'}},
    businessPermissions:{connected:true,stories:true}};
  const viewerState={session:{connected:true,account:{username:'test'}},
    analytics:null,loginPending:null};
  const tg={initData:'signed-owner-test'};
  const qr={aborted:false,abort(){this.aborted=true;}};
  const scope=vm.createContext({
    state,viewerState,tg,
    viewerOwnerEpoch:4,viewerSyncIntent:2,viewerAnalyticsIntent:1,
    viewerAuthBusy:true,viewerQrAbortController:qr,
    viewerRegisteredKey:'',
    CustomEvent:class {constructor(type){this.type=type;}},
    window:{dispatchEvent:event=>events.push(event.type)},
    ensureComposerIdentity:()=>false,
    activeStoryHistory:()=>[],
    viewerApi:()=>getter(),
    renderViewers:()=>renders.push('viewers'),
    renderHome:()=>renders.push('home'),
    renderConnection:()=>renders.push('connection'),
    renderViewerPendingLoginNotice:()=>renders.push('pending'),
    showToast:()=>renders.push('toast'),
  });
  vm.runInContext(code,scope,{timeout:1000});
  return {
    scope,state,get viewerState(){return scope.viewerState;},tg,events,renders,qr,
    refresh:()=>vm.runInContext('refreshViewerSync({silent:true})',scope),
    logout:()=>{
      scope.viewerState.session=null; // confirmed server revoke
      vm.runInContext('notifyTelegramSessionDisconnected()',scope);
    },
  };
}

test('late signed Viewer Sync GET cannot resurrect chats after same-owner logout',async()=>{
  const gate=deferred();
  const f=fixture(()=>gate.promise);
  const oldRefresh=f.refresh();
  f.logout();
  gate.resolve({config:{configured:true},session:{connected:true,account:{username:'old'}},
    viewers:[],story:null,loginPending:null});
  await oldRefresh;
  assert.equal(f.viewerState.session,null);
  assert.equal(f.state.accountConnection.connected,false);
  assert.equal(f.scope.viewerOwnerEpoch,5);
  assert.equal(f.scope.viewerSyncIntent,4);
  assert.equal(f.scope.viewerAnalyticsIntent,2);
  assert.equal(f.scope.viewerAuthBusy,false);
  assert.equal(f.qr.aborted,true);
  assert.deepEqual(f.events,['vetogram:telegram-session-disconnected']);
  assert.deepEqual(f.renders,['home','connection','pending']);
  assert.equal(f.state.businessPermissions.stories,true);
});

test('server-confirmed session loss emits revocation and clears personal account label',async()=>{
  const f=fixture(async()=>({config:{configured:true},session:null,
    viewers:[],story:null,loginPending:null}));
  await f.refresh();
  assert.equal(f.viewerState.session,null);
  assert.equal(f.state.accountConnection.connected,false);
  assert.deepEqual(f.events,['vetogram:telegram-session-disconnected']);
  assert.ok(f.renders.includes('viewers'));
});

test('temporary Viewer storage degradation preserves confirmed session without logout',async()=>{
  const f=fixture(async()=>({degraded:true,config:{configured:true},
    storageError:'temporary store unavailable'}));
  await f.refresh();
  assert.equal(f.viewerState.session.connected,true);
  assert.equal(f.viewerState.degraded,true);
  assert.equal(f.events.length,0);
  assert.equal(f.state.accountConnection.connected,true);
});

test('late pre-logout Mini App response cannot restore old connection badge',async()=>{
  const gate=deferred();
  const f=fixture(async()=>({config:{},session:{connected:true}}));
  f.scope.requestJson=()=>gate.promise;
  vm.runInContext(actionCode,f.scope,{timeout:1000});
  const oldRequest=vm.runInContext('api()',f.scope);
  f.logout();
  gate.resolve({response:{ok:true,status:200},data:{ok:true,
    state:{accountConnection:{connected:true,account:{username:'old'}}}}});
  await assert.rejects(oldRequest,/Telegram-аккаунт изменился/);
  assert.equal(f.state.accountConnection.connected,false);
  assert.equal(f.events.length,1);
});

test('a user may explicitly reconnect later with a newly confirmed session',async()=>{
  let reply={config:{},session:{connected:true},viewers:[],story:null};
  const f=fixture(async()=>reply);
  f.logout();
  await f.refresh();
  assert.equal(f.viewerState.session.connected,true);
  assert.deepEqual(f.events,[
    'vetogram:telegram-session-disconnected',
    'vetogram:telegram-session-connected',
  ]);
});

test('unverified or archive-only inbox response cannot clear signed-out state',()=>{
  const start=chats.indexOf('      state.connectionProof=data.connection||null;');
  const end=chats.indexOf('      if(data.connection?.verified)state.lastListFetchedAt=',start);
  assert.ok(start>=0&&end>start);
  const source=chats.slice(start,end);
  function run(verified){
    const state={sessionDisconnected:true,connectionProof:null};
    vm.runInNewContext(source,{state,data:{connection:{verified}}});
    return state;
  }
  assert.equal(run(false).sessionDisconnected,true);
  assert.equal(run(undefined).sessionDisconnected,true);
  assert.equal(run(true).sessionDisconnected,false);
  assert.match(source,/if\(data\.connection\?\.verified===true\)/);
});
