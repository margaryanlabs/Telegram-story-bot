/* Privacy owner isolation regression against real UI controller.
 * Isolated Node tests. Does NOT simulate Telegram signed E2E or production DB.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/privacy.js',import.meta.url),'utf8');
const section=source.slice(source.indexOf('  function resetPrivacyOwner()'),
  source.indexOf('  function threadTotals('));
assert.ok(section.includes('async function request('),'owner lease source must be present');
function harness(){
  let closes=0;
  const nodes={privacySearch:{value:'old-filter'},privacyThreads:{replaceChildren(){this.cleared=true}},
    privacyDeletedMore:{hidden:false}};
  const tg={initData:'signed-owner-a',initDataUnsafe:{user:{id:'111'}}};
  const privacyState={
    ownerInitData:'signed-owner-a',ownerEpoch:0,loading:true,degraded:false,
    settings:{antiDelete:true,editHistory:true,ghostInbox:true},
    threads:[{title:'PRIVATE OLD ACCOUNT',messageCount:5}],
    smartSummary:{action:3},smartBrief:{title:'Secret'},deletedFeed:[{text:'Private'}],
    backup:{stopRequested:false,selected:{title:'Old account'}},
    activeThread:{messages:[{text:'Private'}]},diagnostics:{secret:'Old'},connection:{live:true},
    lastRefreshAt:123,lastTotalMessages:5
  };
  const allBackup={stop:false,running:true,index:2,total:5,queued:2,longRetention:true};
  const ctx=vm.createContext({tg,privacyState,allBackup,
    businessWizardSnapshot:{private:'A'},businessWizardSignedOwner:'signed-owner-a',
    closeSheet:()=>{closes++;},$:id=>nodes[id]||null,
    navigator:{onLine:true},AbortController,setTimeout,clearTimeout,
    fetch:async()=>({ok:true,status:200,json:async()=>({ok:true})}),
    render:()=>{},toast:()=>{},Error,Promise});
  new vm.Script(section).runInContext(ctx);
  return {ctx,tg,privacyState,allBackup,nodes,get closes(){return closes}};
}
test('switch clears all owner-scoped archive, deleted, backup and modal data',()=>{
  const a=harness();
  const oldBackup=a.privacyState.backup;
  a.tg.initData='signed-owner-b';
  assert.equal(vm.runInContext('resetPrivacyOwner()',a.ctx),true);
  assert.equal(a.closes,1);
  assert.equal(oldBackup.stopRequested,true);
  assert.equal(a.privacyState.ownerEpoch,1);
  assert.equal(a.privacyState.ownerInitData,'signed-owner-b');
  assert.equal(a.privacyState.threads.length,0);
  assert.equal(a.privacyState.deletedFeed.length,0);
  assert.equal(a.privacyState.smartBrief,null);
  assert.equal(a.privacyState.activeThread,null);
  assert.equal(a.privacyState.diagnostics,null);
  assert.equal(a.privacyState.lastRefreshAt,null);
  assert.equal(a.privacyState.connection.loaded,false);
  assert.equal(a.allBackup.stop,true);
  assert.equal(a.allBackup.total,0);
  assert.equal(a.nodes.privacySearch.value,'');
  assert.equal(a.nodes.privacyThreads.cleared,true);
  assert.equal(a.nodes.privacyDeletedMore.hidden,true);
  assert.equal(a.ctx.businessWizardSnapshot,null);
  assert.equal(a.ctx.businessWizardSignedOwner,'');
});
test('in-flight archive response cannot render old owner after account switch',async()=>{
  const a=harness(),seen=[];
  let complete;
  a.ctx.fetch=(url,opts)=>{
    seen.push({url,header:opts.headers['x-telegram-init-data']});
    return new Promise(resolve=>{complete=resolve});
  };
  const pending=vm.runInContext("request('list_messages',{chatId:'secret'})",a.ctx);
  assert.equal(seen.length,1);
  assert.equal(seen[0].header,'signed-owner-a');
  a.tg.initData='signed-owner-b';
  complete({ok:true,status:200,json:async()=>({ok:true,messages:[{text:'old secret'}]})});
  await assert.rejects(pending,{code:'VETO_PRIVACY_OWNER_CHANGED'});
  assert.equal(a.privacyState.threads.length,0);
  assert.equal(a.privacyState.ownerInitData,'signed-owner-b');
  assert.equal(seen.length,1,'must never retry old message against new owner');
});
test('owner epochs prevent stale response reuse after A → B → A',()=>{
  const a=harness();
  const lease=vm.runInContext('ownerLease()',a.ctx);
  a.tg.initData='signed-owner-b';vm.runInContext('resetPrivacyOwner()',a.ctx);
  a.tg.initData='signed-owner-a';vm.runInContext('resetPrivacyOwner()',a.ctx);
  a.ctx.oldLease=lease;
  assert.throws(()=>vm.runInContext('assertOwner(oldLease)',a.ctx),
    {code:'VETO_PRIVACY_OWNER_CHANGED'});
  assert.equal(a.privacyState.ownerEpoch,2);
});
test('connection status from an old owner is never applied to the new owner',async()=>{
  const a=harness();
  let complete;
  a.ctx.fetch=()=>new Promise(resolve=>{complete=resolve});
  const pending=vm.runInContext('loadTelegramConnection()',a.ctx);
  a.tg.initData='signed-owner-b';
  complete({ok:true,json:async()=>({ok:true,state:{live:true,ready:true}})});
  await pending;
  assert.equal(a.privacyState.ownerInitData,'signed-owner-b');
  assert.equal(a.privacyState.connection.loaded,false);
  assert.equal(a.privacyState.connection.live,false);
});
test('all Privacy fetch paths enforce immutable signed-owner leases',()=>{
  assert.match(source,/async function backupApi[\s\S]*?const lease=ownerLease\(\)/);
  assert.match(source,/async function mediaRecoveryApi[\s\S]*?const lease=ownerLease\(\)/);
  assert.match(source,/async function loadMedia[\s\S]*?const lease=ownerLease\(\)/);
  assert.match(source,/async function businessWizardRequest[\s\S]*?const lease=ownerLease\(\)/);
  assert.match(source,/const blob = await response\.blob\(\);\s*assertOwner\(lease\)/);
  assert.match(source,/const archiveReady=Boolean\(privacyState\.lastRefreshAt/);
  assert.match(source,/archiveReady \? String\(value\) : '—'/);
  assert.match(source,/status:'pending',title:'Проверяем архив Telegram'/);
  assert.match(source,/lease\.epoch!==privacyState\.ownerEpoch/);
});
