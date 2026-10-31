/* No-cost owner safety regression: actual live-poll controller + invalidation.
 * No Telegram account, secrets, external network, npm packages or GitHub runner.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const a=source.indexOf('  function cancelThreadRequest(){');
const b=source.indexOf('  function setThread(',a);
assert.ok(a>0&&b>a,'actual owner-safe poll controllers are present');
const controller=source.slice(a,b);

function fixture(status,{deferred=false}={}){
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
  let complete=null;
  const ctx=vm.createContext({
    state,tg:{initData:'signed'},resetOwner:()=>false,stopThreadSync:()=>{},
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
    fetch:()=>deferred
      ?new Promise(resolve=>{
          complete=()=>resolve({ok:false,status,json:async()=>({
            ok:false,error:'Telegram authentication / transport response',
          })});
        })
      :Promise.resolve({ok:false,status,json:async()=>({
          ok:false,error:'Telegram authentication / transport response',
        })}),
    navigator:{onLine:true},AbortController,
    setTimeout:()=>1,clearTimeout(){},
  });
  new vm.Script(controller).runInContext(ctx);
  return {state,input,logs,run:()=>new vm.Script('pollThread()').runInContext(ctx),
    finish:()=>complete?.()};
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

test('stale 401 after A-B-A chat navigation cannot revoke newly reopened session',async()=>{
  const f=fixture(401,{deferred:true}),task=f.run();
  // A new instance of A has the same chat id and owner, but a fresh
  // generation. The old response must not affect its current state.
  f.state.thread={id:'88',serverCanSend:true};
  f.state.threadGeneration++;
  f.state.syncRunId++;
  f.state.thread={id:'77',serverCanSend:true};
  f.finish();await task;
  assert.equal(f.state.connectionProof.verified,true);
  assert.equal(f.state.threadAuthRejected,false);
  assert.equal(f.state.messages[0].text,'Private');
  assert.equal(f.input.value,'Sensitive draft');
  assert.ok(!f.logs.includes('revoke-media'));
  assert.ok(!f.logs.includes('paint'));
});

test('stale 503 after another history request cannot override connection indicator',async()=>{
  const f=fixture(503,{deferred:true}),task=f.run();
  // A same-chat history refresh supersedes this background poll.
  f.state.threadGeneration++;
  f.state.syncRunId++;
  f.finish();await task;
  assert.equal(f.state.syncFailures,0);
  assert.equal(f.state.connectionProof.verified,true);
  assert.ok(!f.logs.includes('schedule'));
});

test('stale 403 with superseded poll run cannot invalidate same-generation owner',async()=>{
  const f=fixture(403,{deferred:true}),task=f.run();
  f.state.syncRunId++;
  f.finish();await task;
  assert.equal(f.state.connectionProof.verified,true);
  assert.equal(f.state.threadAuthRejected,false);
  assert.equal(f.state.drafts.get('77'),'Sensitive draft');
});

test('the shipping poll controller fences both failures and successful results',()=>{
  assert.match(controller,/const isCurrent=runId===state\.syncRunId&&/);
  assert.match(controller,/generation===state\.threadGeneration&&/);
  assert.match(controller,/if\(isCurrent&&\[401,403,409\]/);
  assert.match(controller,/\}else if\(isCurrent\)\{/);
});
