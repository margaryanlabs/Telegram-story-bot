/* VETOGRAM 5.1: execute real inline-photo retry controller without Telegram data.
 * No user sessions, private messages, provider credentials or network required.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const chats=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const start=chats.indexOf('  function loadInlinePreviews({requestedId=null}={}){');
const end=chats.indexOf('  // Telegram\'s MTProto acceptance is not equivalent',start);
assert.ok(start>0&&end>start,'test the shipping photo controller, not copied logic');
const controller=chats.slice(start,end);

function fixture({status=503,connected=true}={}){
  let calls=0,images=0,sequence=0;
  const timers=new Map();
  const badge={textContent:''};
  const placeholder={
    dataset:{mirrorPreview:'42'},querySelector:()=>badge,
    getBoundingClientRect:()=>({top:100,bottom:160}),
    replaceWith(node){this.loaded=node},
  };
  const scroller={
    querySelectorAll:()=>placeholder.loaded?[]:[placeholder],
    getBoundingClientRect:()=>({top:0,bottom:480}),
  };
  const state={
    thread:{id:'77'},ownerInitData:'signed',threadGeneration:9,previewEpoch:1,
    messages:[{id:42,media:'photo',saved:false,deleted:false,mediaAvailable:false}],
    previewActive:0,previewSeen:new Set(),previewInflight:new Set(),
    previewRetryCounts:new Map(),previewRetryTimers:new Map(),
    mediaMimeByUrl:new Map(),connectionProof:{verified:connected},
  };
  const context=vm.createContext({
    state,tg:{initData:'signed'},$:()=>scroller,navigator:{onLine:true},
    photoInViewport:()=>true,
    photoRequest:async()=>{
      calls++;
      if(calls===1){
        const error=new Error('temporary');
        error.httpStatus=status;throw error;
      }
      return 'blob:own-photo';
    },
    document:{
      createElement:tag=>({
        tag,dataset:{},setAttribute(){},appendChild(value){this.image=value},
      }),
    },
    rememberPreview:()=>{images++},
    setTimeout:callback=>{const id=++sequence;timers.set(id,callback);return id},
    clearTimeout:id=>timers.delete(id),
    URL:{revokeObjectURL(){}},
    URLSearchParams:class{},
    AbortController:class{},
  });
  new vm.Script(controller).runInContext(context);
  const run=()=>new vm.Script('loadInlinePreviews()').runInContext(context);
  const flush=async()=>{
    for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));
  };
  const fire=()=>{
    const callbacks=[...timers.values()];
    timers.clear();
    callbacks.forEach(fn=>fn());
  };
  return {state,badge,placeholder,timers,run,flush,fire,
    metrics:()=>({calls,images})};
}

test('one 503 starts a single delayed retry and then loads the owner photo',async()=>{
  const f=fixture();
  f.run();await f.flush();
  assert.equal(f.metrics().calls,1);
  assert.equal(f.timers.size,1);
  assert.match(f.badge.textContent,/повторю загрузку/);
  f.fire();await f.flush();
  assert.equal(f.metrics().calls,2);
  assert.equal(f.metrics().images,1);
  assert.equal(f.timers.size,0);
  assert.ok(f.placeholder.loaded,'preview is rendered after one retry');
});

test('Telegram 429 never schedules an automatic retry',async()=>{
  const f=fixture({status:429});f.run();await f.flush();
  assert.equal(f.metrics().calls,1);
  assert.equal(f.timers.size,0);
  assert.match(f.badge.textContent,/ограничил/);
});

test('authorization, forbidden and not-found responses never retry silently',async()=>{
  for(const status of [400,401,403,404,409]){
    const f=fixture({status});f.run();await f.flush();
    assert.equal(f.metrics().calls,1);
    assert.equal(f.timers.size,0);
    assert.equal(f.metrics().images,0);
  }
});

test('owner or chat change before delayed retry forbids a stale photo fetch',async()=>{
  for(const change of [
    f=>{f.state.ownerInitData='different';},
    f=>{f.state.thread={id:'other-chat'};},
    f=>{f.state.previewEpoch++;},
  ]){
    const f=fixture();f.run();await f.flush();
    assert.equal(f.timers.size,1);
    change(f);f.fire();await f.flush();
    assert.equal(f.metrics().calls,1);
    assert.equal(f.metrics().images,0);
  }
});

test('owner switch clears scheduled retry timers and media retry budgets',()=>{
  assert.match(chats,/for\(const timer of state\.previewRetryTimers\.values\(\)\)clearTimeout\(timer\)/);
  assert.match(chats,/state\.previewRetryTimers\.clear\(\);state\.previewRetryCounts\.clear\(\)/);
  assert.match(chats,/state\.previewRetryCounts\.delete\(id\)/);
});

test('failed thread has accessible explicit retry without initiating a send',()=>{
  assert.match(chats,/data-mirror-retry-thread/);
  assert.match(chats,/void loadMessages\(\{reset:true\}\)/);
  assert.match(chats,/if\(!resetOwner\(\)&&state\.thread&&!state\.threadLoading\)/);
  const css=readFileSync(new URL('../public/vetogram-noir.css',import.meta.url),'utf8');
  assert.match(css,/\.veto-mirror-retry-thread\{[\s\S]*?min-height:46px/);
});
