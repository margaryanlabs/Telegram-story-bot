/* VETOGRAM: race regressions on production Privacy chat controllers.
 * The test extracts and executes real archived chat handler code, not a mock
 * implementation. No network or Telegram signed user is needed to run it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/privacy.js',import.meta.url),'utf8');
const segment=src.slice(src.indexOf('  async function openThread(chatId,'),
  src.indexOf('  async function maybeOpenGhostDeepLink()'));
assert.match(segment,/async function loadOlderThread/);

function session(){
  const state={
    ownerInitData:'signed-A',ownerEpoch:0,archiveThreadEpoch:0,
    loadingOlderThread:false,backup:{stopRequested:false},
    threads:[{chatId:'A',title:'Alice'},{chatId:'B',title:'Bob'}],
    activeThread:null
  };
  const pending=[],renders=[],errors=[],moreButton={disabled:false,textContent:''};
  const sheet={querySelector:()=>moreButton,scrollTop:55};
  const fetcher=(action,options)=>new Promise(resolve=>pending.push({action,options,resolve}));
  const closeStart=src.indexOf('  function closeSheet() {');
  const closeEnd=src.indexOf('  // The Mini App BackButton',closeStart);
  assert.ok(closeStart>0 && closeEnd>closeStart);
  const script=segment+'\n'+src.slice(closeStart,closeEnd)+
    '\nthis.exports={openThread,loadOlderThread,closeSheet};';
  const ctx=vm.createContext({
    privacyState:state,request:fetcher,
    ownerLease:()=>({epoch:state.ownerEpoch,signed:state.ownerInitData}),
    assertOwner:lease=>{
      if(lease.epoch!==state.ownerEpoch)
        throw Object.assign(new Error('Stale owner'),{code:'VETO_PRIVACY_OWNER_CHANGED'});
    },
    renderThreadSheet:(thread,messages,opts)=>{
      state.activeThread={thread,messages,mode:opts.mode,offset:opts.offset,
        hasMore:opts.hasMore,focusMessageId:opts.focusMessageId};
      renders.push({thread:thread.chatId,messages,options:opts});
    },
    toast:err=>errors.push(String(err)),
    $:name=>name==='sheet'?sheet:null,
    window:{VetoTelegramModal:{close(){}}},
    revokeMediaUrl(){},
  });
  new vm.Script(script).runInContext(ctx);
  return {state,pending,renders,errors,moreButton,sheet,...ctx.exports};
}
test('rapid A → B picks the latest chat even if A arrives last',async()=>{
  const s=session(),a=s.openThread('A'),b=s.openThread('B');
  assert.equal(s.pending.length,2);
  s.pending[1].resolve({messages:[{message_id:20,text:'B'}],hasMore:true});
  assert.equal(await b,true);
  s.pending[0].resolve({messages:[{message_id:10,text:'A'}],hasMore:true});
  assert.equal(await a,false);
  assert.deepEqual(s.renders.map(v=>v.thread),['B']);
  assert.equal(s.errors.length,0);
});
test('older B page cannot overwrite newly opened A or lock pagination',async()=>{
  const s=session(),b=s.openThread('B');
  s.pending[0].resolve({messages:[{message_id:20,text:'B'}],hasMore:true});
  await b;
  const old=s.loadOlderThread();
  assert.equal(s.state.loadingOlderThread,true);
  const a=s.openThread('A');
  assert.equal(s.state.loadingOlderThread,false);
  s.pending[1].resolve({messages:[{message_id:1,text:'older B'}],hasMore:false});
  await old;
  assert.deepEqual(s.renders.map(v=>v.thread),['B']);
  s.pending[2].resolve({messages:[{message_id:30,text:'new A'}],hasMore:false});
  await a;
  assert.deepEqual(s.renders.map(v=>v.thread),['B','A']);
  assert.equal(s.errors.length,0);
});
test('closing a sheet cancels an unfinished openThread response',async()=>{
  const s=session(),work=s.openThread('A');
  s.closeSheet();
  s.pending[0].resolve({messages:[{message_id:7,text:'private'}],hasMore:false});
  assert.equal(await work,false);
  assert.equal(s.renders.length,0);
  assert.equal(s.state.activeThread,null);
  assert.equal(s.state.backup.stopRequested,true);
});
test('pagination deduplicates message IDs without losing active thread',async()=>{
  const s=session(),b=s.openThread('B');
  s.pending[0].resolve({messages:[{message_id:3},{message_id:4}],hasMore:true});
  await b;
  const old=s.loadOlderThread();
  s.pending[1].resolve({messages:[{message_id:1},{message_id:3}],hasMore:false});
  await old;
  assert.deepEqual(Array.from(s.state.activeThread.messages,x=>x.message_id),[1,3,4]);
  assert.equal(s.state.activeThread.offset,4);
  assert.equal(s.state.loadingOlderThread,false);
  assert.equal(s.renders.at(-1).options.preserveScroll,true);
});
test('late edit history, media and background refresh are guarded',()=>{
  assert.match(src,/const intent=privacyState.archiveThreadEpoch;[\s\S]*setTimeout\(\(\)\s*=>\s*\{/);
  assert.match(src,/String\(privacyState\.activeThread\?\.thread\?\.chatId\)!==String\(chatId\)/);
  assert.match(src,/const blob = await response\.blob\(\);[\s\S]*intent!==privacyState\.archiveThreadEpoch/);
  assert.match(src,/privacyState\.refreshInFlight=true/);
  assert.match(src,/if \(!tg\?\.initData \|\| privacyState\.refreshInFlight/);
  assert.match(src,/if\(intent===privacyState\.archiveThreadEpoch\)privacyState\.loadingOlderThread=false/);
});

test('Canvas Noir Vault presents only verified archive status and accessible refresh',()=>{
  const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
  const noir=readFileSync(new URL('../public/vetogram-noir.css',import.meta.url),'utf8');
  const experience=readFileSync(new URL('../public/vetogram-experience-v4.js',import.meta.url),'utf8');
  for(const id of ['privacyStatThreads','privacyStatDeleted','privacyStatEdited',
    'privacyStatMessages','privacyStatVault']){
    assert.match(html,new RegExp('id="'+id+'">—</strong>'));
  }
  for(const id of ['privacyEvidenceBar','privacyEvidenceStatus','privacyEvidenceRefresh']){
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
  }
  assert.match(src,/evidence\.dataset\.verified=String\(archiveReady\)/);
  assert.match(src,/privacyState\.lastRefreshAt\)/);
  assert.match(src,/privacyEvidenceRefresh'\)\?\.addEventListener\('click'/);
  assert.match(src,/Promise\.allSettled\(\[/);
  assert.match(experience,/vaultStats\.after\(vaultEvidence\)/);
  assert.match(experience,/vaultEvidence\.after\(vaultActions\)/);
  assert.match(noir,/\.v4-vault-evidence>span\[data-verified="true"\]/);
  assert.match(noir,/\#privacyEvidenceRefresh/);
  assert.equal((noir.match(/\{/g)||[]).length,(noir.match(/\}/g)||[]).length);
});
