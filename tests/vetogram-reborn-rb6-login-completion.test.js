/* RB6: confirm the *current* Telegram session before UI login success.
 * Executes the real user-session completion helper under delayed response
 * fixtures; no Telegram accounts, OTPs, passwords or media are accessed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=app.indexOf('  async function finishVerifiedViewerLogin({analytics=false}={}){');
const end=app.indexOf('  async function renderViewerLoginResult(data) {',start);
assert.ok(start>=0&&end>start,'real finishVerifiedViewerLogin helper must exist');
const source=app.slice(start,end);

function deferred(){
  let resolve;const promise=new Promise(next=>resolve=next);
  return {resolve,promise};
}
function fixture({linked=true,degraded=false,viewerGate=null,mainGate=null,analyticsGate=null}={}){
  const calls=[];
  const context=vm.createContext({
    tg:{initData:'signed-owner-A'},
    viewerOwnerEpoch:5,
    viewerState:{session:linked?{connected:true}:null,degraded},
    viewerPendingPhone:'+000',
    closeSheet:()=>calls.push('close'),
    refreshViewerSync:async()=>{
      calls.push('viewer-refresh');
      if(viewerGate)await viewerGate.promise;
    },
    refresh:async()=>{
      calls.push('main-refresh');
      if(mainGate)await mainGate.promise;
    },
    refreshViewerAnalytics:async()=>{
      calls.push('analytics-refresh');
      if(analyticsGate)await analyticsGate.promise;
    },
    markVetoWelcomeSeen:()=>calls.push('welcome'),
    notify:()=>calls.push('success'),
    showToast:message=>calls.push('toast:'+message),
    switchScreen:screen=>calls.push('nav:'+screen),
    offerBusinessConsentAfterLogin:()=>calls.push('offer-business'),
  });
  vm.runInContext(source,context,{timeout:1000});
  return {context,calls,run:()=>vm.runInContext('finishVerifiedViewerLogin({analytics:true})',context)};
}

test('verified login finishes in Chats only after all account refreshes',async()=>{
  const f=fixture(),ok=await f.run();
  assert.equal(ok,true);
  assert.deepEqual(f.calls.slice(0,4),
    ['close','viewer-refresh','main-refresh','analytics-refresh']);
  assert.ok(f.calls.includes('success'));
  assert.ok(f.calls.includes('nav:telegram'));
  assert.ok(f.calls.includes('offer-business'));
  assert.equal(f.context.viewerPendingPhone,'');
});

test('backend still cannot confirm a session: no fake success and no new code',async()=>{
  const f=fixture({linked:false}),ok=await f.run();
  assert.equal(ok,false);
  assert.equal(f.calls.some(s=>s==='success'||s==='nav:telegram'),false);
  assert.ok(f.calls.some(s=>s.startsWith('toast:Telegram принял вход')));
  assert.doesNotMatch(source,/viewerApi\('send_code'/);
});

test('Viewer storage degraded: do not navigate with an unverified session',async()=>{
  const f=fixture({degraded:true}),ok=await f.run();
  assert.equal(ok,false);
  assert.equal(f.calls.includes('nav:telegram'),false);
});

test('same-owner confirmed logout during Viewer Sync cancels old login completion',async()=>{
  const gate=deferred(),f=fixture({viewerGate:gate});
  const running=f.run();
  f.context.viewerOwnerEpoch++;
  gate.resolve();
  assert.equal(await running,false);
  assert.equal(f.calls.includes('main-refresh'),false);
  assert.equal(f.calls.includes('nav:telegram'),false);
});

test('logout while awaiting Mini App refresh suppresses old success and navigation',async()=>{
  const gate=deferred(),f=fixture({mainGate:gate});
  const running=f.run();
  await Promise.resolve();
  assert.ok(f.calls.includes('main-refresh'));
  f.context.viewerOwnerEpoch++;
  gate.resolve();
  assert.equal(await running,false);
  assert.equal(f.calls.includes('nav:telegram'),false);
  assert.equal(f.calls.includes('success'),false);
});

test('owner switch during optional analytics still prevents old navigation',async()=>{
  const gate=deferred(),f=fixture({analyticsGate:gate});
  const running=f.run();
  await Promise.resolve();await Promise.resolve();
  assert.ok(f.calls.includes('analytics-refresh'));
  f.context.viewerOwnerEpoch++;
  gate.resolve();
  assert.equal(await running,false);
  assert.equal(f.calls.includes('nav:telegram'),false);
});

test('all three phone/2FA success paths share one verified owner-fenced completion',()=>{
  const code=app.slice(app.indexOf("    if (action === 'viewer-verify-code') {"),
    app.indexOf("    if (action === 'security-revoke-session') {"));
  const result=app.slice(app.indexOf('  async function renderViewerLoginResult(data) {'),
    app.indexOf('  function viewerResendControls() {'));
  assert.match(result,/await finishVerifiedViewerLogin\(\)/);
  assert.equal((code.match(/finishVerifiedViewerLogin\(\{analytics:true\}\)/g)||[]).length,2);
  assert.match(source,/ownerEpoch===viewerOwnerEpoch/);
  assert.match(source,/viewerState\.session\?\.connected!==true/);
  assert.match(source,/if\(!current\(\)\)return false;/);
  assert.doesNotMatch(source,/VetoTelegramOpenUnifiedOnboarding/);
});
