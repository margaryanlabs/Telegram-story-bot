/* VETOGRAM 5.1: execute real send handler against controlled delayed ACKs.
 * No Telegram session, user content, or network access is used.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const code=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const begin=code.indexOf('  async function sendOutgoing(){');
const finish=code.indexOf('  async function richRequest(',begin);
assert.ok(begin>0&&finish>begin,'test the shipping send controller');
const senderSource=code.slice(begin,finish);
function fixture(){
  const state={
    thread:{id:'A'},ownerInitData:'signed',pendingAttachment:null,
    sendInFlight:false,replyTo:{id:42},lastSendFailure:null,
    lastSendFailures:new Map(),drafts:new Map(),messages:[],
  };
  const field={value:'Привет',dataset:{activeChat:'A'}};
  const calls=[],pending=[];
  let ids=0,resetCalls=0;
  const ctx=vm.createContext({
    state,tg:{initData:'signed'},$:id=>id==='telegramThreadCompose'?field:null,
    canSendInThread:chat=>Boolean(chat),
    window:{crypto:{randomUUID:()=> 'nonce-'+(++ids)}},
    sendChatRequest:(...args)=>{
      calls.push(args);
      return new Promise((resolve,reject)=>pending.push({resolve,reject}));
    },
    setDeliveryStatus:()=>{},renderMessages:()=>{},
    renderSendComposer:()=>{},renderReplyPreview:()=>{},
    touchRecentChat:()=>{},threadNotice:()=>{},
    toast:()=>{},sendRichOutgoing:()=>{},
    resetOwner:()=>{resetCalls++},setTimeout:()=>0,
  });
  new vm.Script(senderSource).runInContext(ctx);
  const send=()=>new vm.Script('sendOutgoing()').runInContext(ctx);
  const reject=({uncertain=true}={})=>{
    const error=new Error('Нет подтверждения');
    error.uncertain=uncertain;
    pending.shift().reject(error);
  };
  const accept=()=>pending.shift().resolve({messageId:123});
  return {state,field,calls,send,reject,accept,resetCalls:()=>resetCalls};
}

test('delayed failure in chat A restores A draft without modifying chat B',async()=>{
  const f=fixture();
  const first=f.send();
  f.state.thread={id:'B'};
  f.field.value='Новый текст чата B';
  f.reject();await first;
  assert.equal(f.state.drafts.get('A'),'Привет');
  assert.equal(f.field.value,'Новый текст чата B');
  assert.equal(f.state.lastSendFailures.get('A').nonce,'nonce-1');
  assert.equal(f.state.sendInFlight,false);
});

test('reopening original chat retries same uncertain send with same reply and nonce',async()=>{
  const f=fixture();
  const first=f.send();f.state.thread={id:'B'};f.reject();await first;
  f.state.thread={id:'A'};
  f.field.value=f.state.drafts.get('A');f.state.replyTo={id:42};
  const second=f.send();f.accept();await second;
  assert.equal(f.calls.length,2);
  assert.equal(f.calls[0][2],f.calls[1][2]);
  assert.equal(f.calls[1][3],42);
  assert.equal(f.state.lastSendFailures.has('A'),false);
});

test('reply to a different message must generate a different send nonce',async()=>{
  const f=fixture();
  const first=f.send();f.reject();await first;
  f.state.replyTo={id:99};
  const second=f.send();f.accept();await second;
  assert.equal(f.calls.length,2);
  assert.notEqual(f.calls[0][2],f.calls[1][2]);
  assert.equal(f.calls[1][3],99);
});

test('reply target selected while request is in flight is never silently erased',async()=>{
  const f=fixture();
  const first=f.send();
  f.state.replyTo={id:88};
  f.accept();await first;
  assert.equal(f.state.replyTo.id,88);
  assert.equal(f.calls[0][3],42);
});

test('late acknowledgement cannot delete a newer original-chat draft',async()=>{
  const f=fixture();
  const first=f.send();
  f.state.drafts.set('A','Свежий черновик в A');
  f.state.thread={id:'B'};
  f.field.value='Текст B';
  f.accept();await first;
  assert.equal(f.state.drafts.get('A'),'Свежий черновик в A');
  assert.equal(f.field.value,'Текст B');
});

test('text editing and Telegram owner switch clear owner-bound retry state',()=>{
  assert.match(code,/state\.lastSendFailures\.delete\(chatId\)/);
  assert.match(code,/state\.lastSendFailures\.clear\(\);state\.lastRichFailure=null/);
  assert.match(code,/failed&&failed\.message!==event\.target\.value\.trim\(\)/);
});

test('reopened chat restores only the matching uncertain reply context',()=>{
  const start=code.indexOf('    const failedSend=state.lastSendFailures.get(String(chat.id));');
  const end=code.indexOf('    renderReplyPreview();renderAttachmentChip();',start);
  assert.ok(start>0&&end>start,'test real reply restoration controller');
  const snippet=code.slice(start,end);
  function run({chatId='A',draft='Привет',failedText='Привет',replyTo=42}={}){
    const state={
      replyTo:null,drafts:new Map([['A',draft]]),
      lastSendFailures:new Map([['A',{
        chatId:'A',message:failedText,replyTo,nonce:'nonce-1',
      }]]),
    };
    vm.runInNewContext(snippet,{state,chat:{id:chatId}});
    return state.replyTo;
  }
  assert.equal(run().id,42,'matching reply restores same target');
  assert.equal(run({draft:'Новый текст'}),null,'fresh draft cannot inherit stale reply');
  assert.equal(run({chatId:'B'}),null,'another chat cannot inherit A reply');
  assert.equal(run({replyTo:null}),null,'plain send never invents a reply');
});

test('uncertain retry warning is shown after history load, not auto-retransmitted',()=>{
  const opened=code.slice(code.indexOf('  async function openThread(chat){'),
    code.indexOf('  // First paint comes from owner-verified MTProto;'));
  assert.match(opened,/const historyLoad=loadMessages\\(\\{reset:true\\}\\);/);
  assert.match(opened,/if\\(openedGeneration!==state\\.threadGeneration\\)return;/);
  assert.match(opened,/const unresolved=state\\.lastSendFailures\\.get/);
  assert.match(code,/Отправка не подтверждена\. Проверь оригинальный Telegram перед повтором/);
});
