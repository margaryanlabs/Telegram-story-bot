import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function part(start,end){
 const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
 assert.ok(a>0&&b>a,'missing source '+start);
 return app.slice(a,b);
}
const apiSource=part('  async function viewerApi(action = null, payload = {}, storyId = selectedViewerStory) {','  async function automationsApi(');
const analyticsSource=part('  async function refreshViewerAnalytics({ silent = true } = {}) {','  async function refreshViewerSync(');
const syncSource=part('  async function refreshViewerSync({ silent = false } = {}) {','  function renderConnection()');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
test('Viewer API captures signed request identity and rejects response from previous Telegram owner',async()=>{
 let signed='owner-A',lastHeaders=null;
 const future=deferred();
 const tg={get initData(){return signed}};
 const requestJson=async(_url,options)=>{lastHeaders=options.headers;return future.promise};
 const viewerApi=new Function('tg','requestJson','selectedViewerStory',
   apiSource+';return viewerApi')(tg,requestJson,null);
 const pending=viewerApi();
 assert.equal(lastHeaders['x-telegram-init-data'],'owner-A');
 signed='owner-B';
 future.resolve({response:{ok:true},data:{ok:true,session:{connected:true,account:'A'}}});
 await assert.rejects(pending,/Telegram-аккаунт изменился/);
});
test('Viewer API accepts signed owner-matched source response',async()=>{
 const tg={initData:'signed-current'};
 const requestJson=async()=>({response:{ok:true},data:{ok:true,session:{connected:true}}});
 const api=new Function('tg','requestJson','selectedViewerStory',
   apiSource+';return viewerApi')(tg,requestJson,'123');
 const result=await api();
 assert.equal(result.session.connected,true);
});
test('Viewer Analytics does not overwrite a new owner state on late success',async()=>{
 let signed='owner-A',redraws=0;
 const future=deferred(),viewerState={session:{connected:true},analytics:{old:'current'}};
 const tg={get initData(){return signed}};
 const run=new Function('tg','viewerState','requestJson','renderAnalytics','showToast',
   analyticsSource+';return refreshViewerAnalytics')(
     tg,viewerState,()=>future.promise,()=>{redraws++},()=>{throw Error('old toast')});
 const pending=run();signed='owner-B';
 future.resolve({response:{ok:true},data:{ok:true,analytics:{old:'other-user'}}});
 await pending;
 assert.deepEqual(viewerState.analytics,{old:'current'});
 assert.equal(redraws,0);
});
test('Viewer Analytics rejects late errors without surfacing another owner failures',async()=>{
 let signed='owner-A',toast=0,redraws=0;
 const future=deferred(),viewerState={session:{connected:true},analytics:null};
 const tg={get initData(){return signed}};
 const run=new Function('tg','viewerState','requestJson','renderAnalytics','showToast',
   analyticsSource+';return refreshViewerAnalytics')(
     tg,viewerState,()=>future.promise,()=>{redraws++},()=>{toast++});
 const pending=run({silent:false});signed='owner-B';future.reject(new Error('old account failure'));
 await pending;
 assert.equal(toast,0);assert.equal(redraws,0);
});
test('Viewer refresh cannot render a late first response after owner switch',async()=>{
 let signed='owner-A',redraws=0;
 const future=deferred(),tg={get initData(){return signed}};
 const state={history:[]},initial={session:{connected:false},viewers:[]};
 const body="let viewerState=initial;let viewerRegisteredKey='';"+
   syncSource+";return {refreshViewerSync,getState:()=>viewerState}";
 const run=new Function('tg','initial','viewerApi','activeStoryHistory','renderViewers',
   'renderHome','showToast',body)(
   tg,initial,()=>future.promise,()=>[],()=>{redraws++},()=>{redraws++},()=>{});
 const task=run.refreshViewerSync();signed='owner-B';
 future.resolve({ok:true,config:{configured:true},session:{connected:true},viewers:[{name:'A'}]});
 await task;assert.equal(redraws,0);
 assert.equal(run.getState(),initial);
});
test('Viewer refresh rejects a late error after owner switch without degraded UI',async()=>{
 let signed='owner-A',notices=0;
 const future=deferred(),tg={get initData(){return signed}};
 const initial={session:{connected:true},viewers:[{name:'B'}]};
 const f=new Function('tg','initial','viewerApi','activeStoryHistory','renderViewers',
   'renderHome','showToast',
   "let viewerState=initial;let viewerRegisteredKey='';"+syncSource+
   ";return {refreshViewerSync,getState:()=>viewerState}")(
    tg,initial,()=>future.promise,()=>[],()=>{notices++},()=>{notices++},()=>{notices++});
 const task=f.refreshViewerSync({silent:false});signed='owner-B';
 future.reject(new Error('account A failure'));await task;
 assert.equal(notices,0);assert.equal(f.getState(),initial);
});
test('Story handoff, viewer and auto action paths preserve user-facing permission boundaries',()=>{
 assert.match(app,/const signedOwner = String\(tg\?\.initData \|\| ''\)/);
 assert.match(app,/viewerRegisteredKey = historyKey/);
 assert.match(app,/if \(signedOwner !== String\(tg\?\.initData \|\| ''\)\) return/);
 assert.match(app,/if \(action\) options\.body = JSON\.stringify/);
 assert.match(app,/if \(composerDataUrl && composerOwner !== signedOwner\)/);
 assert.match(app,/window\.dispatchEvent\(new CustomEvent\('veto:screen-changed'/);
});



test('main Mini App imports the new owner-scoped integration controller, not a cached old script',()=>{
  const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
  assert.match(html,/\/app\.js\?v=20261025-owner-integration-43/);
  assert.doesNotMatch(html,/\/app\.js\?v=20261019-messenger-first-v1/);
});



test('Automation Center request cannot return old account settings after Telegram owner swap',async()=>{
  const source=part('  async function automationsApi(action = null, payload = {}) {',
    '  function automationRuleEnabled(');
  let signed='owner-A';
  const future=deferred();
  const tg={get initData(){return signed}};
  const requestJson=()=>future.promise;
  const run=new Function('tg','requestJson',source+';return automationsApi')(tg,requestJson);
  const pending=run('refresh');
  signed='owner-B';
  future.resolve({response:{ok:true},data:{ok:true,rules:{enabled:true}}});
  await assert.rejects(pending,/Telegram-аккаунт изменился/);
});
