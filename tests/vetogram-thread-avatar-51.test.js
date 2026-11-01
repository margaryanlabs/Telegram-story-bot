/* Vetogram V5.1 active-thread avatar loading, signed-owner DOM fencing.
 * Shipping avatar controllers are executed in a fake Telegram Mini App;
 * no user information, private session or real network request is used.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const a=source.indexOf('  async function fetchAvatarBatch(');
const b=source.indexOf('  function rememberPreview(',a);
assert.ok(a>0&&b>a,'test production avatar queue, not a duplicate controller');
const snippet=source.slice(a,b);

async function fixture({archiveOnly=false,changeOwner=false,changeThread=false}={}){
  let calls=0,requested=[],finish=null;
  const header={img:null,replaceChildren(node){this.img=node}};
  const state={
    thread:{id:'55',archiveOnly},connectionProof:{verified:true},
    ownerInitData:'signed',avatarEpoch:1,avatarQueue:[],avatarRequested:new Set(),
    avatarRetryAt:new Map(),avatarUrls:new Map(),avatarActive:0,
  };
  const nodes={
    telegramChatsView:{hidden:true},telegramThreadView:{hidden:false},
    telegramThreadAvatar:header,
  };
  const ctx=vm.createContext({
    state,tg:{initData:'signed'},$:id=>nodes[id]||null,
    document:{
      querySelector:()=>({dataset:{screen:'telegram'}}),
      querySelectorAll:()=>[],createElement:tag=>({tag}),
    },
    window:{innerHeight:800,addEventListener(){}},
    fetch:async(url,options)=>{
      calls++;
      assert.equal(url,'/api/telegram-chat-media');
      const payload=JSON.parse(options.body);
      assert.equal(payload.action,'avatar_batch');
      requested=payload.chatIds;
      return new Promise(resolve=>{finish=()=>resolve({
        ok:true,json:async()=>({ok:true,avatars:{'55':Buffer.from([255,216,255,217]).toString('base64')}}),
      })});
    },
    AbortController,setTimeout,clearTimeout,
    atob:base64=>Buffer.from(base64,'base64').toString('binary'),
    Blob:class{constructor(parts){this.parts=parts}},
    URL:{createObjectURL:()=> 'blob:signed-avatar',revokeObjectURL(){}},
  });
  new vm.Script(snippet).runInContext(ctx);
  new vm.Script('queueVisibleAvatars()').runInContext(ctx);
  if(finish){
    if(changeOwner){state.ownerInitData='new-owner';state.avatarEpoch++}
    if(changeThread)state.thread={id:'99',archiveOnly:false};
    finish();
  }
  for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));
  return {calls,requested,header,state};
}

test('open chat portrait loads even when entire inbox list is hidden',async()=>{
  const f=await fixture();
  assert.equal(f.calls,1);
  assert.deepEqual(Array.from(f.requested),['55']);
  assert.equal(f.header.img.src,'blob:signed-avatar');
  assert.equal(f.header.img.className,'veto-mirror-avatar-img');
  assert.equal(f.state.avatarUrls.get('55'),'blob:signed-avatar');
});

test('archive-only preserved chat never opens a live avatar session',async()=>{
  const f=await fixture({archiveOnly:true});
  assert.equal(f.calls,0);
  assert.equal(f.header.img,null);
});

test('late portrait from previous owner never paints private chat header',async()=>{
  const f=await fixture({changeOwner:true});
  assert.equal(f.calls,1);
  assert.equal(f.header.img,null);
  assert.equal(f.state.avatarUrls.size,0);
});

test('late portrait from previous thread never paints new chat header',async()=>{
  const f=await fixture({changeThread:true});
  assert.equal(f.calls,1);
  assert.equal(f.header.img,null);
});

test('screen-level queue explicitly prioritizes owner verified active thread',()=>{
  assert.match(snippet,/const threadId=threadVisible&&state\.connectionProof\?\.verified===true/);
  assert.match(snippet,/state\.avatarQueue\.unshift\(threadId\)/);
  assert.match(source,/setThread\(chat\);\s*\/\/ The owner may open a chat/);
});
