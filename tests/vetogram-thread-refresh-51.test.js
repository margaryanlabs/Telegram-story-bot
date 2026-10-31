/* VETOGRAM 5.1: source-level history refresh lifecycle regressions.
 * The test never reads personal Telegram data or calls external APIs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const a=source.indexOf('  function cancelThreadRequest(){');
const b=source.indexOf('  function back(){',a);
assert.ok(a>0&&b>a,'test shipping thread loader, not a copy');
const controller=source.slice(a,b);

function fixture({status=503,succeed=false}={}){
  const stored=[{id:1,date:'2026-10-26T11:00:00Z',text:'first'},
                {id:2,date:'2026-10-26T11:02:00Z',text:'second'}];
  const state={
    thread:{id:'77',type:'private',serverCanSend:true},messages:stored.map(m=>({...m})),
    threadLoading:false,threadLoadError:'',threadAuthRejected:false,threadGeneration:7,
    threadRequestAbort:null,
    syncRunId:1,syncBusy:false,liveHasMore:true,archiveHasMore:false,
    threadHasMore:true,threadOffset:1,archiveOffset:0,ownerInitData:'signed',
    threadCache:new Map([['77',{messages:stored}]]),
    chats:[{id:'77',title:'Private chat'}],page:1,hasMore:true,
    avatarEpoch:1,avatarQueue:[],avatarRequested:new Set(),
    avatarRetryAt:new Map(),avatarActive:0,avatarUrls:new Map([['77','blob:avatar']]),
    drafts:new Map([['77','private draft']]),draftVersions:new Map(),
    lastSendFailure:null,lastSendFailures:new Map(),lastRichFailure:null,
    lastRichFailures:new Map(),
    connectionProof:{verified:true},
  };
  const more={hidden:false,disabled:false},meta={textContent:''};
  const title={textContent:'Private chat'};
  const compose={value:'private unsent text',dataset:{activeChat:'77'}};
  const chatList={replaceChildren(){events.push({action:'list-cleared'})}};
  const events=[];
  let release;
  const ctx=vm.createContext({
    state,tg:{initData:'signed'},resetOwner:()=>false,stopThreadSync:()=>{},
    $:id=>id==='telegramThreadOlder'?more:id==='telegramThreadMeta'?meta:
      id==='telegramThreadTitle'?title:id==='telegramMirrorList'?chatList:
      id==='telegramThreadCompose'?compose:null,
    visibleMessageAnchor:()=>null,renderMessages:(options={})=>events.push({
      action:'render',count:state.messages.length,options,
    }),
    renderSendComposer:()=>events.push({action:'composer'}),
    renderReplyPreview:()=>{},renderAttachmentChip:()=>{},
    cancelVoiceCapture:()=>{},dropVoiceDraft:()=>{},
    rememberHotThread:()=>{},threadNotice:text=>events.push({action:'notice',text}),
    syncLabel:text=>events.push({action:'sync',text}),
    scheduleThreadSync:()=>events.push({action:'schedule'}),
    revokeMediaUrls:()=>events.push({action:'revoke'}),
    URL:{revokeObjectURL:()=>events.push({action:'avatar-revoked'})},
    AbortController,
    request:()=>new Promise((resolve,reject)=>{release=()=>{
      if(succeed)resolve({messages:[{id:3,date:'2026-10-27T13:00:00Z',text:'third'}],
        liveHasMore:false,archiveHasMore:false,canSend:true});
      else reject(Object.assign(new Error('Telegram network unavailable'),{httpStatus:status}));
    }}),
  });
  new vm.Script(controller).runInContext(ctx);
  return {
    state,events,more,compose,
    run:()=>new vm.Script('loadMessages({reset:true})').runInContext(ctx),
    settle:()=>release(),
  };
}
test('temporary 503 during owner-verified refresh retains previously loaded messages',async()=>{
  const f=fixture(),pending=f.run();
  assert.equal(f.state.messages.length,2,'loading must not erase cached messages');
  f.settle();await pending;
  assert.deepEqual(f.state.messages.map(m=>m.id),[1,2]);
  assert.equal(f.state.connectionProof.verified,true);
  assert.equal(f.state.threadAuthRejected,false);
  assert.equal(f.state.threadLoadError,'Telegram network unavailable');
  assert.ok(f.events.some(e=>e.action==='render'&&e.count===2));
  assert.ok(f.events.some(e=>e.action==='schedule'),'transient error can retry later');
  assert.ok(!f.events.some(e=>e.action==='revoke'),'media survives transient failure');
});

test('successful refresh merges new message without losing earlier loaded context',async()=>{
  const f=fixture({succeed:true}),pending=f.run();
  f.settle();await pending;
  assert.deepEqual(Array.from(f.state.messages,m=>m.id),[1,2,3]);
  assert.equal(f.state.threadLoadError,'');
  assert.equal(f.state.threadLoading,false);
});

test('a genuine 401/403/409 clears sensitive history and verified send permissions',async()=>{
  for(const status of [401,403,409]){
    const f=fixture({status}),pending=f.run();
    f.settle();await pending;
    assert.equal(f.state.messages.length,0);
    assert.equal(f.state.threadCache.size,0);
    assert.equal(f.state.chats.length,0,'old inbox no longer accessible');
    assert.equal(f.state.avatarUrls.size,0);
    assert.equal(f.state.drafts.size,0);
    assert.equal(f.compose.value,'');
    assert.equal(f.compose.dataset.activeChat,'');
    assert.equal(f.state.connectionProof,null);
    assert.equal(f.state.thread.serverCanSend,false);
    assert.equal(f.state.threadAuthRejected,true);
    assert.ok(f.events.some(e=>e.action==='revoke'));
    assert.ok(f.events.some(e=>e.action==='avatar-revoked'));
    assert.ok(f.events.some(e=>e.action==='list-cleared'));
    assert.ok(f.events.some(e=>e.action==='composer'));
    assert.ok(!f.events.some(e=>e.action==='schedule'));
  }
});

test('response for an old chat generation cannot erase or mutate a newer chat',async()=>{
  const f=fixture(),pending=f.run();
  f.state.thread={id:'88',type:'private'};
  f.state.threadGeneration++;
  f.state.messages=[{id:500,text:'new chat'}];
  f.settle();await pending;
  assert.equal(f.state.messages[0].id,500);
  assert.equal(f.state.thread.id,'88');
});

test('history refresh is not a media revoke event',()=>{
  assert.doesNotMatch(controller,/if\(reset&&!rememberedAnchor\)state\.messages=\[\]/);
  assert.match(controller,/const generation=\+\+state\.threadGeneration/);
  assert.match(controller,/if\(!authRejected\)scheduleThreadSync\(45000\)/);
});

test('expired session shows reconnect action; transient outage keeps refresh action',()=>{
  assert.match(source,/empty\('Нужно переподключить Telegram'/);
  assert.match(source,/data-mirror-reconnect-thread/);
  assert.match(source,/window\.VetoTelegramOpenAccountConnection\(\)/);
  assert.match(source,/data-mirror-retry-thread/);
  assert.match(source,/const authRejected=\[401,403,409\]/);
  assert.match(source,/state\.threadAuthRejected=authRejected/);
});
