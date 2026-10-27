/* VETOGRAM 5.1: ensure temporary network errors never look like logout.
 * Exercises the shipping inbox refresh controller in a fake DOM.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const begin=source.indexOf('  async function loadChats({reset=false}={}){');
const end=source.indexOf('  async function photoRequest(',begin);
assert.ok(begin>0&&end>begin,'must exercise the current client load controller');
const securityStart=source.indexOf('  function cancelThreadRequest(){');
const securityEnd=source.indexOf('  async function pollThread(',securityStart);
assert.ok(securityStart>0&&securityEnd>securityStart);
const controller=source.slice(begin,end)+
  '\n'+source.slice(securityStart,securityEnd);

function fixture({proof=true,count=1,page=0,reset=true,status=0,
    errorMessage='Failed to fetch',online=true}={}){
  const chats=Array.from({length:count},(_,i)=>({id:String(i+1),title:'Контакт '+i}));
  const state={chats,page,hasMore:true,loading:false,generation:0,
    autoPages:0,connectionProof:proof?{verified:true,username:'owner'}:null,
    ownerInitData:'signed',lastListFetchedAt:1,messages:[{id:5}],thread:{id:'1'},
    threadAuthRejected:false,threadCache:new Map([['1',{messages:[{id:5}]}]]),
    avatarEpoch:1,avatarQueue:[],avatarRequested:new Set(),avatarRetryAt:new Map(),
    avatarActive:0,avatarUrls:new Map([['1','blob:owner-avatar']]),
    drafts:new Map([['1','Private draft']]),draftVersions:new Map(),
    lastSendFailure:null,lastSendFailures:new Map(),lastRichFailure:null,
    lastRichFailures:new Map(),replyTo:null,pendingAttachment:null,};
  let notice='',renders=0,mediaCleared=0,avatarRevoked=0;
  const composer={value:'Private unsent text',dataset:{activeChat:'1'}};
  const nodes={
    telegramMirrorRefresh:{classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}},
    telegramMirrorUpdated:{textContent:''},
    telegramMirrorAccessButton:{textContent:''},
    telegramThreadView:{hidden:false},
    telegramChatsView:{hidden:true},
    telegramMirror:{classList:{remove(){}}},
    telegramMirrorList:{replaceChildren(){}},
    telegramThreadTitle:{textContent:'Contact'},
    telegramThreadMeta:{textContent:'Telegram'},
    telegramThreadCompose:composer,
  };
  const error=status
    ?Object.assign(new Error(errorMessage),{httpStatus:status})
    :new TypeError(errorMessage);
  const context=vm.createContext({
    state,tg:{initData:'signed'},navigator:{onLine:online},
    resetOwner:()=>false,stopThreadSync:()=>{},
    $:name=>nodes[name]||null,
    request:async()=>{throw error},
    renderChats:()=>{renders++},hideNotice:()=>{notice=''},
    showNotice:text=>{notice=text},
    revokeMediaUrls:()=>{mediaCleared++},
    renderReplyPreview(){},renderAttachmentChip(){},
    cancelVoiceCapture(){},dropVoiceDraft(){},renderSendComposer(){},
    URL:{revokeObjectURL:()=>{avatarRevoked++}},
    window:{VetoThemeDock:()=>{}},
  });
  new vm.Script(controller).runInContext(context);
  const load=()=>new vm.Script('loadChats({reset:'+reset+'})').runInContext(context);
  return {load,state,chats,composer,metrics:()=>({notice,renders,mediaCleared,avatarRevoked})};
}

test('Failed to fetch preserves previously verified same-owner chats',async()=>{
  const f=fixture();await f.load();
  assert.deepEqual(f.state.chats,f.chats);
  assert.equal(f.state.connectionProof.verified,true);
  assert.equal(f.state.hasMore,true);
  assert.equal(f.state.page,0);
  assert.match(f.metrics().notice,/временно не отвечает/);
  assert.equal(f.metrics().mediaCleared,0);
  assert.equal(f.state.loading,false);
});

test('an owner with zero chats does not lose verified session on refresh outage',async()=>{
  const f=fixture({count:0});await f.load();
  assert.equal(f.state.chats.length,0);
  assert.equal(f.state.connectionProof.verified,true);
  assert.equal(f.state.hasMore,true);
  assert.equal(f.metrics().mediaCleared,0);
});

test('server 503 during pagination retains already loaded rows and cursor',async()=>{
  const f=fixture({count:3,page:1,reset:false,status:503,errorMessage:'Upstream unavailable'});
  await f.load();
  assert.equal(f.state.chats.length,3);
  assert.equal(f.state.page,1);
  assert.equal(f.state.connectionProof.verified,true);
  assert.equal(f.metrics().mediaCleared,0);
});

test('no proven owner is never promoted to verified on a transport error',async()=>{
  const f=fixture({proof:false,count:0});await f.load();
  assert.equal(f.state.connectionProof,null);
  assert.equal(f.state.hasMore,true);
  assert.match(f.metrics().notice,/Не удалось проверить Telegram/);
});

test('401 remains fail-closed and discards old-owner inbox and thread',async()=>{
  const f=fixture({status:401,errorMessage:'Expired login'});
  await f.load();
  assert.equal(f.state.chats.length,0);
  assert.equal(f.state.connectionProof,null);
  assert.equal(f.state.hasMore,false);
  assert.equal(f.state.thread,null);
  assert.equal(f.metrics().mediaCleared,1);
  assert.equal(f.state.threadCache.size,0,'previous inbox private history must be cleared');
  assert.equal(f.state.avatarUrls.size,0,'owner portrait blob is revoked');
  assert.equal(f.state.drafts.size,0,'unsent text of rejected session must be cleared');
  assert.equal(f.composer.value,'','visible private draft cleared');
  assert.equal(f.state.lastRichFailures.size,0);
  assert.equal(f.metrics().avatarRevoked,1);
});

test('403 or 409 on inbox refresh clears owner-bound caches as on thread failure',async()=>{
  for(const status of [403,409]){
    const f=fixture({status,errorMessage:'Login not valid'});
    f.state.lastRichFailures.set('1',{nonce:'private'});
    await f.load();
    assert.equal(f.state.threadCache.size,0);
    assert.equal(f.state.avatarUrls.size,0);
    assert.equal(f.state.drafts.size,0);
    assert.equal(f.state.lastRichFailures.size,0);
    assert.equal(f.composer.value,'');
    assert.equal(f.metrics().mediaCleared,1);
  }
});

test('temporary 503 retains private drafts and cached messages of verified owner',async()=>{
  const f=fixture({status:503,errorMessage:'Upstream temporary error'});
  await f.load();
  assert.equal(f.state.threadCache.size,1);
  assert.equal(f.state.avatarUrls.size,1);
  assert.equal(f.state.drafts.size,1);
  assert.equal(f.composer.value,'Private unsent text');
  assert.equal(f.metrics().mediaCleared,0);
});
