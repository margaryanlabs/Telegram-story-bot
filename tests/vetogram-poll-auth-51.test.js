/* No-cost owner safety regression: actual live-poll controller + invalidation.
 * No Telegram account, secrets, external network, npm packages or GitHub runner.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const a=source.indexOf('  function invalidateThreadAuthorization(){');
const b=source.indexOf('  function setThread(',a);
assert.ok(a>0&&b>a,'actual owner-safe poll controllers are present');
const controller=source.slice(a,b);

function fixture(status){
  const input={value:'Sensitive draft',dataset:{activeChat:'77'}};
  const state={
    ownerInitData:'signed',thread:{id:'77',serverCanSend:true},
    threadGeneration:4,threadLoading:false,threadAuthRejected:false,
    syncBusy:false,syncRunId:0,syncFailures:0,sendInFlight:false,
    threadLoadError:'',messages:[{id:1,text:'Private'}],
    threadCache:new Map([['77',{}]]),connectionProof:{verified:true},
    chats:[{id:'77'}],page:0,hasMore:true,
    avatarEpoch:0,avatarQueue:[],avatarRequested:new Set(),
    avatarRetryAt:new Map(),avatarActive:0,
    avatarUrls:new Map([['77','blob:portrait']]),
    drafts:new Map([['77','Sensitive draft']]),draftVersions:new Map(),
    lastSendFailure:null,lastSendFailures:new Map(),lastRichFailure:null,
    lastRichFailures:new Map(),
  };
  const logs=[];
  const ctx=vm.createContext({
    state,tg:{initData:'signed'},resetOwner:()=>false,
    $:id=>id==='telegramThreadCompose'?input:
      id==='telegramMirrorList'?{replaceChildren(){logs.push('clear-list')}}:
      id==='telegramThreadTitle'||id==='telegramThreadMeta'?{textContent:''}:null,
    URL:{revokeObjectURL:()=>logs.push('revoke-avatar')},
    revokeMediaUrls:()=>logs.push('revoke-media'),
    renderReplyPreview(){},renderAttachmentChip(){},
    cancelVoiceCapture(){},dropVoiceDraft(){},
    renderSendComposer:()=>logs.push('composer'),
    renderMessages:()=>logs.push('paint'),
    threadNotice:()=>{},syncLabel:()=>{},
    maySyncThread:()=>Boolean(state.connectionProof?.verified),
    scheduleThreadSync:()=>{if(state.connectionProof?.verified)logs.push('schedule')},
    visibleMessageAnchor:()=>null,
    fetch:async()=>({ok:false,status,json:async()=>({
      ok:false,error:'Telegram authentication / transport response',
    })}),
    navigator:{onLine:true},AbortController,
    setTimeout:()=>1,clearTimeout(){},
  });
  new vm.Script(controller).runInContext(ctx);
  return {state,input,logs,run:()=>new vm.Script('pollThread()').runInContext(ctx)};
}

test('poll rejection 401, 403, 409 clears private content immediately',async()=>{
  for(const status of [401,403,409]){
    const f=fixture(status);await f.run();
    assert.equal(f.state.connectionProof,null);
    assert.equal(f.state.threadAuthRejected,true);
    assert.equal(f.state.messages.length,0);
    assert.equal(f.state.chats.length,0);
    assert.equal(f.state.drafts.size,0);
    assert.equal(f.input.value,'');
    assert.equal(f.state.avatarUrls.size,0);
    assert.ok(f.logs.includes('revoke-media'));
    assert.ok(f.logs.includes('paint'));
    assert.ok(!f.logs.includes('schedule'));
  }
});

test('poll transport 503 preserves verified history, drafts and owner',async()=>{
  const f=fixture(503);await f.run();
  assert.equal(f.state.connectionProof.verified,true);
  assert.equal(f.state.messages[0].text,'Private');
  assert.equal(f.input.value,'Sensitive draft');
  assert.equal(f.state.threadAuthRejected,false);
  assert.equal(f.state.syncFailures,1);
  assert.ok(f.logs.includes('schedule'));
  assert.ok(!f.logs.includes('revoke-media'));
});

test('poll preserves exact signed account/selected chat as a required guard',()=>{
  assert.match(controller,/ownerKey===String\(tg\?\.initData\|\|''\)/);
  assert.match(controller,/\[401,403,409\]\.includes\(Number\(error\?\.httpStatus\|\|0\)\)/);
  assert.match(controller,/invalidateThreadAuthorization\(\)/);
});
