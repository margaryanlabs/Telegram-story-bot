/* Real VETOGRAM rich-send handlers: safe nonce reuse when Telegram ACK is lost. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const from=source.indexOf('  function richSendIntent(');
const to=source.indexOf('  // Installed packs are fetched',from);
assert.ok(from>0&&to>from,'test shipping send intent + handler');
const controllers=source.slice(from,to);

function fixture(){
  const state={
    thread:{id:'A'},ownerInitData:'signed',sendInFlight:false,
    drafts:new Map(),draftVersions:new Map(),replyTo:null,
    pendingAttachment:null,lastRichFailure:null,lastRichFailures:new Map(),
  };
  let serial=0;
  const calls=[],pending=[];
  const ctx=vm.createContext({
    state,tg:{initData:'signed'},$:id=>id==='telegramThreadCompose'?{value:''}:null,
    window:{crypto:{randomUUID:()=> 'nonce-'+(++serial)}},
    canSendInThread:chat=>Boolean(chat),readFileAsBase64:async()=> 'data',
    richRequest:(action,body)=>{calls.push({action,body});
      return new Promise((resolve,reject)=>pending.push({resolve,reject}));},
    renderSendComposer(){},renderReplyPreview(){},renderAttachmentChip(){},
    setDeliveryStatus(){},touchRecentChat(){},threadNotice(){},toast(){},
    closeStickerDrawer(){},dropVoiceDraft(){},resetOwner(){},setTimeout:()=>0,
  });
  new vm.Script(controllers).runInContext(ctx);
  const send=(id='100')=>new vm.Script(
    "sendRichOutgoing('send_sticker',{id:'"+id+"'})").runInContext(ctx);
  const uncertain=()=>{
    const error=new Error('No Telegram ACK');error.uncertain=true;
    pending.shift().reject(error);
  };
  const accept=()=>pending.shift().resolve({ok:true});
  return {state,calls,send,uncertain,accept,get serial(){return serial}};
}

test('lost sticker ACK after navigating A to B retains A nonce for deliberate retry',async()=>{
  const f=fixture();
  const first=f.send('100');
  f.state.thread={id:'B'};f.uncertain();await first;
  assert.equal(f.state.lastRichFailures.get('A').nonce,'nonce-1');
  f.state.thread={id:'A'};
  const retry=f.send('100');f.accept();await retry;
  assert.equal(f.calls[0].body.nonce,'nonce-1');
  assert.equal(f.calls[1].body.nonce,'nonce-1');
  assert.equal(f.serial,1);
  assert.equal(f.state.lastRichFailures.has('A'),false);
});

test('different sticker ID never reuses a failed Telegram nonce',async()=>{
  const f=fixture();
  const first=f.send('100');f.uncertain();await first;
  const second=f.send('200');f.accept();await second;
  assert.notEqual(f.calls[0].body.nonce,f.calls[1].body.nonce);
  assert.equal(f.calls[1].body.stickerId,'200');
});

test('two conversations retain distinct uncertain rich-send intents',async()=>{
  const f=fixture();
  const a=f.send('100');f.uncertain();await a;
  f.state.thread={id:'B'};
  const b=f.send('200');f.uncertain();await b;
  assert.equal(f.state.lastRichFailures.get('A').nonce,'nonce-1');
  assert.equal(f.state.lastRichFailures.get('B').nonce,'nonce-2');
  f.state.thread={id:'A'};
  const again=f.send('100');f.accept();await again;
  assert.equal(f.calls[2].body.nonce,'nonce-1');
  assert.equal(f.state.lastRichFailures.has('B'),true);
});

test('session reset removes both rich-send retry and text-send retry identities',()=>{
  assert.match(source,/state\.lastSendFailures\.clear\(\);state\.lastRichFailure=null;state\.lastRichFailures\.clear\(\)/);
  assert.match(source,/const prior=state\.lastRichFailures\.get\(chatId\)/);
  assert.match(source,/state\.lastRichFailures\.set\(chatId,failure\)/);
});
