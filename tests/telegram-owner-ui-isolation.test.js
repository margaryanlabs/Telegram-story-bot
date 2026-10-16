import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const start=source.indexOf('  async function loadChats({reset=false}={}){');
const end=source.indexOf('  async function photoRequest(',start);
assert.ok(start>=0&&end>start,'extract the real browser loadChats implementation');
const actualLoadChats=source.slice(start,end);

function deferred(){
  let resolve,reject;
  const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});
  return {promise,resolve,reject};
}
function harness(request){
  const tg={initData:'signed-user-A'};
  const state={
    chats:[],page:0,hasMore:true,loading:false,generation:0,
    ownerFingerprint:null,threadGeneration:0,thread:null,messages:[],
    threadLoading:false,threadHasMore:false,threadOffset:0,archiveOffset:0,
    liveHasMore:false,archiveHasMore:false,connectionProof:null,
    avatarUrls:new Map(),avatarQueue:[],avatarRequested:new Set(),avatarActive:0,avatarLoaded:0,
  };
  const nodes=new Map();
  const $=name=>{
    if(!nodes.has(name)){
      nodes.set(name,{hidden:false,textContent:'',classList:{remove(){},add(){}}});
    }
    return nodes.get(name);
  };
  const revoked=[];
  let renderCount=0;
  const sandbox={
    state,tg,$,request,
    hideNotice:()=>{},showNotice:()=>{},
    revokeMediaUrls:()=>{},
    renderChats:()=>{renderCount++;},
    window:{},
    URL:{revokeObjectURL:url=>revoked.push(url)},
  };
  const loadChats=vm.runInNewContext(actualLoadChats+'\nloadChats;',sandbox);
  return {loadChats,state,tg,$,revoked,get renderCount(){return renderCount;}};
}
const result=(id)=>({ok:true,chats:[{id,title:'Owner '+id,preview:'private '+id}],
  page:0,hasMore:false,connection:{verified:true,accountName:id}});

test('switching Telegram identities while owner A request is in flight never renders A to B',async()=>{
  const old=deferred();
  const calls=[];
  const env=harness((action,args)=>{
    calls.push({action,args});
    return calls.length===1?old.promise:Promise.resolve(result('B'));
  });
  const stale=env.loadChats({reset:true});
  env.state.avatarUrls.set('a','blob:owner-a');
  env.state.avatarQueue.push('a');
  env.state.thread={id:'private-a'};
  env.state.messages=[{id:11,text:'owner A secret'}];
  env.tg.initData='signed-user-B';
  // Non-reset pagination request must become a forced identity reset,
  // even though an older request is still loading.
  await env.loadChats();
  assert.equal(env.state.ownerFingerprint,'signed-user-B');
  assert.equal(env.state.chats.map(x=>x.id).join(','),'B');
  assert.equal(env.state.thread,null);
  assert.equal(env.state.messages.length,0);
  assert.equal(env.state.avatarUrls.size,0);
  assert.ok(env.revoked.includes('blob:owner-a'));
  assert.equal(env.$('telegramThreadView').hidden,true);
  assert.equal(env.$('telegramChatsView').hidden,false);
  old.resolve(result('A'));
  await stale;
  assert.equal(env.state.chats.map(x=>x.id).join(','),'B');
  assert.equal(calls.length,2,'late old-owner response must not start another reset');
  assert.equal(env.state.loading,false);
});
test('a user refresh invalidates an older response for the same account',async()=>{
  const old=deferred();
  let count=0;
  const env=harness(()=>{
    count++;return count===1?old.promise:Promise.resolve(result('new'));
  });
  const pending=env.loadChats({reset:true});
  await env.loadChats({reset:true});
  old.resolve(result('old'));
  await pending;
  assert.equal(env.state.chats.map(x=>x.id).join(','),'new');
  assert.equal(env.state.loading,false);
});
test('other private media and thread responses have owner-bound stale response guards',()=>{
  assert.match(source,/ownerFingerprint!==String\(tg\?\.initData\|\|''\)/);
  assert.match(source,/URL\.revokeObjectURL\(href\);return;/);
  assert.match(source,/state\.threadGeneration\+\+;/);
  assert.match(source,/if\(current==='telegram'\)loadChats\(\{reset:true\}\);/);
  assert.match(source,/if\(initData!==String\(tg\?\.initData\|\|''\)\)throw new Error\('TELEGRAM_ACCOUNT_CHANGED'\)/);
});
