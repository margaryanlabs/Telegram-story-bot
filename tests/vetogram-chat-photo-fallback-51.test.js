/* Regression checks for real messenger media controllers; no personal data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const chats=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const sourceStart=chats.indexOf('      const requestArchived=async()=>');
const sourceEnd=chats.indexOf('      request.then(href=>',sourceStart);
assert.ok(sourceStart>0&&sourceEnd>sourceStart);
const fallback=chats.slice(sourceStart,sourceEnd);

function fixture({status=503,deleted=false,preservedOnly=false,connected=true,ownerChanged=false}={}){
  let liveCalls=0,archiveCalls=0;
  const ctx={
    id:42,ownerChatId:'123',ownerKey:'signed',generation:7,
    msg:{saved:true,mediaAvailable:true,deleted,preservedOnly},
    state:{ownerInitData:ownerChanged?'other-owner':'signed',threadGeneration:7,
      thread:{id:'123'},connectionProof:{verified:connected},mediaMimeByUrl:new Map()},
    tg:{initData:'signed'},
    fetch:async()=>{archiveCalls++;return {
      ok:status===200,status,
      blob:async()=>({size:4096,type:'image/jpeg'}),
    }},
    photoRequest:async(action,chatId,id)=>{
      assert.equal(action,'photo');assert.equal(chatId,'123');assert.equal(id,42);
      liveCalls++;return 'blob:telegram-original';
    },
    URLSearchParams,AbortController,setTimeout,clearTimeout,
    URL:{createObjectURL:()=> 'blob:archive-preview'},
  };
  const run=()=>vm.runInNewContext('(async()=>{\n'+fallback+'\nreturn await request;})()',ctx);
  return {run,counts:()=>({liveCalls,archiveCalls}),ctx};
}

test('missing archived photo falls back to current live Telegram image',async()=>{
  const f=fixture();
  assert.equal(await f.run(),'blob:telegram-original');
  assert.deepEqual(f.counts(),{liveCalls:1,archiveCalls:1});
});

test('available archive image is displayed without a second Telegram connection',async()=>{
  const f=fixture({status:200});
  assert.equal(await f.run(),'blob:archive-preview');
  assert.deepEqual(f.counts(),{liveCalls:0,archiveCalls:1});
});

test('deleted and preserved-only evidence never triggers a live photo fallback',async()=>{
  for(const input of [{deleted:true},{preservedOnly:true}]){
    const f=fixture(input);
    await assert.rejects(f.run(),/private_photo_unavailable/);
    assert.equal(f.counts().liveCalls,0);
  }
});

test('owner mismatch, missing live connection and 401 never trigger fallback',async()=>{
  const cases=[{ownerChanged:true},{connected:false},{status:401},{status:403}];
  for(const input of cases){
    const f=fixture(input);
    await assert.rejects(f.run());
    assert.equal(f.counts().liveCalls,0);
  }
});

test('in-flight photo is fenced to the open chat, not unrelated inbox refresh',async()=>{
  const a=chats.indexOf('  async function photoRequest(');
  const b=chats.indexOf('  // A single signed MTProto connection',a);
  assert.ok(a>0&&b>a);
  const fn=chats.slice(a,b);
  let resets=0;
  const state={generation:4,threadGeneration:7,thread:{id:'123'}};
  const ctx={
    state,tg:{initData:'signed'},resetOwner:()=>{resets++},
    AbortController,setTimeout,clearTimeout,
    fetch:async()=>{state.generation++;return {
      ok:true,blob:async()=>({size:3072,type:'image/jpeg'}),
    }},
    URL:{createObjectURL:()=> 'blob:photo'},
  };
  assert.equal(await vm.runInNewContext('(async()=>{'+fn+"\nreturn photoRequest('photo','123',42)})()",ctx),
    'blob:photo');
  assert.equal(resets,0);
  state.thread={id:'999'};
  const blocked=vm.runInNewContext('(async()=>{'+fn+"\nreturn photoRequest('photo','123',42)})()",ctx);
  state.thread={id:'123'};
  await assert.rejects(blocked,/Открыта другая переписка/);
});
