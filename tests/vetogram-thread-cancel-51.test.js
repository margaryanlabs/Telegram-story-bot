/* Offline transport cancellation guarantees for real VETOGRAM history.
 * No Telegram account, external fetch, dependency install or deployment.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const piece=(from,to)=>{
  const a=source.indexOf(from),b=source.indexOf(to,a);
  assert.ok(a>0&&b>a,'expected real controller: '+from);
  return source.slice(a,b);
};
const requestSource=piece('  async function request(action,payload={},externalSignal=null){',
  '  // Text sending is separate from the Business bot');
const cancelSource=piece('  function cancelThreadRequest(){',
  '  // Both history refresh and live polling');
const historySource=piece('  async function loadMessages({reset=false}={}){','  function back(){');

function requestHarness(){
  const state={threadRequestAbort:null,threadGeneration:8,ownerInitData:'signed'};
  const tg={initData:'signed'};
  let fetchSignal=null,fetchCalls=0,seenPath='';
  const context=vm.createContext({
    state,tg,resetOwner:()=>false,
    AbortController,setTimeout,clearTimeout,
    fetch:(url,opts)=>{
      fetchCalls++;seenPath=url;fetchSignal=opts.signal;
      return new Promise((resolve,reject)=>{
        if(opts.signal.aborted){reject(Object.assign(new Error('aborted'),{name:'AbortError'}));return;}
        opts.signal.addEventListener('abort',()=>{
          reject(Object.assign(new Error('aborted'),{name:'AbortError'}));
        },{once:true});
      });
    },
  });
  new vm.Script(requestSource+cancelSource).runInContext(context);
  return {state,tg,context,getSignal:()=>fetchSignal,fetchCalls:()=>fetchCalls,
    getPath:()=>seenPath,
    request:()=>new vm.Script("request('thread',{chatId:'A'},globalThis.currentAbort.signal)")
      .runInContext(context),
    cancel:()=>new vm.Script('cancelThreadRequest()').runInContext(context),
  };
}

test('switching chats aborts pending owner-signed fetch immediately, not at 22s timeout',async()=>{
  const h=requestHarness(),controller=new AbortController();
  h.context.currentAbort=controller;
  h.state.threadRequestAbort=controller;
  const pending=h.request();
  assert.equal(h.fetchCalls(),1);
  assert.equal(h.getPath(),'/api/telegram-chats');
  assert.equal(h.getSignal().aborted,false);
  h.cancel();
  assert.equal(controller.signal.aborted,true);
  assert.equal(h.getSignal().aborted,true);
  assert.equal(h.state.threadRequestAbort,null);
  await assert.rejects(pending,error=>error?.name==='AbortError');
});

test('cancelling old request never aborts a replacement controller',()=>{
  const h=requestHarness(),old=new AbortController();
  const fresh=new AbortController();
  h.state.threadRequestAbort=old;
  h.cancel();
  h.state.threadRequestAbort=fresh;
  assert.equal(old.signal.aborted,true);
  assert.equal(fresh.signal.aborted,false);
  assert.equal(h.state.threadRequestAbort,fresh);
});

test('history handler keeps ownership and generation guards around canceled network',async()=>{
  const h=requestHarness();
  const state=Object.assign(h.state,{
    thread:{id:'A',type:'private'},messages:[],threadLoading:false,threadLoadError:'',
    syncRunId:0,archiveOffset:0,threadOffset:0,liveHasMore:true,threadHasMore:false,
    connectionProof:{verified:true},
  });
  const el={hidden:false};
  h.context.$=()=>el;
  h.context.visibleMessageAnchor=()=>null;
  h.context.renderMessages=()=>{};
  h.context.scheduleThreadSync=()=>{};
  h.context.threadNotice=()=>{};
  h.context.syncLabel=()=>{};
  h.context.renderSendComposer=()=>{};
  h.context.rememberHotThread=()=>{};
  h.context.invalidateThreadAuthorization=()=>{};
  new vm.Script(historySource).runInContext(h.context);
  const promise=new vm.Script('loadMessages({reset:true})').runInContext(h.context);
  assert.equal(state.threadLoading,true);
  assert.ok(state.threadRequestAbort);
  // Reopening another chat invalidates the earlier generation and cancels
  // the obsolete fetch; the new dialog may start its own independent request.
  h.cancel();
  state.threadGeneration++;
  state.thread={id:'B',type:'private'};
  state.threadLoading=false;
  await promise;
  assert.equal(state.thread.id,'B');
  assert.equal(state.threadLoading,false);
  assert.equal(state.threadRequestAbort,null);
  assert.equal(state.threadLoadError,'');
});

test('navigation, back, account reset and revocation all cancel the transport',()=>{
  const open=piece('  async function openThread(chat){',
    '  // First paint comes from owner-verified MTProto;');
  const back=piece('  function back(){','  function closeVetoMessengerTools(){');
  const owner=piece('  function resetOwner(){','  function revokeMediaUrls(){');
  const invalidate=piece('  function invalidateThreadAuthorization(){',
    '  async function pollThread(');
  assert.match(open,/cancelThreadRequest\(\);/);
  assert.match(back,/cancelThreadRequest\(\);/);
  assert.match(owner,/cancelThreadRequest\(\);/);
  assert.match(invalidate,/cancelThreadRequest\(\);/);
  assert.match(invalidate,/state\.threadGeneration\+\+/);
  assert.match(invalidate,/state\.syncRunId\+\+/);
  assert.match(invalidate,/stopThreadSync\(\)/);
  assert.match(historySource,/request\('thread',[\s\S]*?threadAbort\.signal\)/);
  assert.match(historySource,/if\(state\.threadRequestAbort===threadAbort\)/);
});

test('Back cancels deferred archive and thread fetches together',()=>{
  const state={
    threadRequestAbort:new AbortController(),
    archiveRequestAbort:new AbortController(),
  };
  const oldHistory=state.threadRequestAbort,oldArchive=state.archiveRequestAbort;
  const context=vm.createContext({state});
  new vm.Script(cancelSource+'\ncancelThreadRequest()').runInContext(context);
  assert.equal(oldHistory.signal.aborted,true);
  assert.equal(oldArchive.signal.aborted,true);
  assert.equal(state.threadRequestAbort,null);
  assert.equal(state.archiveRequestAbort,null);
});

test('deferred archive cannot paint old A after signed user switches to B',async()=>{
  const archiveSource=piece('  async function mergeDeferredArchive(',
    '  async function loadMessages(');
  const state={
    thread:{id:'A'},threadGeneration:9,ownerInitData:'signed',
    archiveRequestAbort:null,threadRequestAbort:null,messages:[{id:7,text:'A'}],
  };
  let started=false,networkSignal=null,repaintCount=0;
  const context=vm.createContext({
    state,tg:{initData:'signed'},AbortController,
    resetOwner:()=>false,
    request:(action,payload,signal)=>{
      assert.equal(action,'thread_archive');
      assert.equal(payload.chatId,'A');
      networkSignal=signal;started=true;
      return new Promise((resolve,reject)=>{
        signal.addEventListener('abort',()=>reject(
          Object.assign(new Error('obsolete request'),{name:'AbortError'})),{once:true});
      });
    },
    visibleMessageAnchor:()=>null,
    renderMessages:()=>{repaintCount++},
    rememberHotThread:()=>{},
    threadNotice:()=>{},
    syncLabel:()=>{},
  });
  new vm.Script(cancelSource+archiveSource).runInContext(context);
  const pending=new vm.Script("mergeDeferredArchive('A',9,'signed')").runInContext(context);
  assert.equal(started,true);
  assert.equal(networkSignal.aborted,false);
  new vm.Script('cancelThreadRequest()').runInContext(context);
  state.thread={id:'B'};state.threadGeneration++;
  await pending;
  assert.equal(networkSignal.aborted,true);
  assert.equal(state.archiveRequestAbort,null);
  assert.deepEqual(state.messages,[{id:7,text:'A'}]);
  assert.equal(repaintCount,0);
});
