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
const controller=source.slice(begin,end);

function fixture({proof=true,count=1,page=0,reset=true,status=0,
    errorMessage='Failed to fetch',online=true}={}){
  const chats=Array.from({length:count},(_,i)=>({id:String(i+1),title:'Контакт '+i}));
  const state={chats,page,hasMore:true,loading:false,generation:0,
    autoPages:0,connectionProof:proof?{verified:true,username:'owner'}:null,
    ownerInitData:'signed',lastListFetchedAt:1,messages:[{id:5}],thread:{id:'1'}};
  let notice='',renders=0,mediaCleared=0;
  const nodes={
    telegramMirrorRefresh:{classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}},
    telegramMirrorUpdated:{textContent:''},
    telegramMirrorAccessButton:{textContent:''},
    telegramThreadView:{hidden:false},
    telegramChatsView:{hidden:true},
    telegramMirror:{classList:{remove(){}}},
  };
  const error=status
    ?Object.assign(new Error(errorMessage),{httpStatus:status})
    :new TypeError(errorMessage);
  const context=vm.createContext({
    state,tg:{initData:'signed'},navigator:{onLine:online},
    resetOwner:()=>false,
    $:name=>nodes[name]||null,
    request:async()=>{throw error},
    renderChats:()=>{renders++},hideNotice:()=>{notice=''},
    showNotice:text=>{notice=text},
    revokeMediaUrls:()=>{mediaCleared++},
    window:{VetoThemeDock:()=>{}},
  });
  new vm.Script(controller).runInContext(context);
  const load=()=>new vm.Script('loadChats({reset:'+reset+'})').runInContext(context);
  return {load,state,chats,metrics:()=>({notice,renders,mediaCleared})};
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
});
