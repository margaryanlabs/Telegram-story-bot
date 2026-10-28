/* No-cost VETOGRAM 5.1: actual signed text controller across chat changes.
 * No Telegram tokens, outbound network, dependencies, or paid CI.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const a=source.indexOf('  async function sendOutgoing(){');
const b=source.indexOf('  async function richRequest(',a);
assert.ok(a>0&&b>a,'execute the shipping send and cache-settlement controllers');
const realSend=source.slice(a,b);

function fixture(){
  const state={
    thread:{id:'A'},messages:[],chats:[{id:'A',preview:''},{id:'B',preview:''}],
    ownerInitData:'signed',pendingAttachment:null,sendInFlight:false,
    sendInFlightChatId:null,replyTo:null,lastSendFailure:null,
    lastSendFailures:new Map(),drafts:new Map([['A','Привет']]),
    threadCache:new Map(),
  };
  const field={value:'Привет',dataset:{activeChat:'A'}},pending=[];
  const nonces=[],toasts=[],status=[];
  let seq=0;
  const ctx=vm.createContext({
    state,tg:{initData:'signed'},
    $:id=>id==='telegramThreadCompose'?field:null,
    canSendInThread:()=>true,
    window:{crypto:{randomUUID:()=> 'nonce-'+(++seq)}},
    sendChatRequest:(id,message,nonce,replyTo)=>{
      nonces.push(nonce);
      return new Promise((resolve,reject)=>pending.push({resolve,reject}));
    },
    setDeliveryStatus:(...v)=>status.push(v),
    renderMessages(){},renderSendComposer(){},renderReplyPreview(){},
    threadNotice(){},toast:value=>toasts.push(value),
    touchRecentChat:(chatId,msg,date)=>{
      const row=state.chats.find(c=>c.id===chatId);
      if(row){row.preview=msg;row.date=date}
    },
    resetOwner(){},setTimeout:()=>0,
  });
  new vm.Script(realSend).runInContext(ctx);
  return {
    state,field,nonces,toasts,status,
    send:()=>new vm.Script('sendOutgoing()').runInContext(ctx),
    accept:(messageId=101)=>pending.shift().resolve({messageId}),
    fail:(uncertain=true)=>{
      const err=Object.assign(new Error('Telegram ответил ошибкой'),{uncertain});
      pending.shift().reject(err);
    },
    leaveA(){
      // Mimics rememberHotThread() followed by opening B.
      state.threadCache.set('A',{at:Date.now(),
        messages:state.messages.map(m=>({...m}))});
      state.thread={id:'B'};state.messages=[{id:88,text:'B message'}];
      field.value='Текст B';field.dataset.activeChat='B';
      state.drafts.set('B','Текст B');
    },
  };
}

test('A send ACK after switching to B settles cached optimistic bubble without touching B',async()=>{
  const f=fixture(),inFlight=f.send();
  const optimistic=f.state.messages.find(m=>m.pending);
  assert.ok(optimistic);
  f.leaveA();
  f.accept(119);await inFlight;
  const cached=f.state.threadCache.get('A').messages;
  assert.equal(cached.some(m=>m.pending),false);
  assert.equal(cached.some(m=>m.id===119&&m.sent===true),true);
  assert.equal(f.state.messages[0].text,'B message');
  assert.equal(f.field.value,'Текст B');
  assert.equal(f.state.chats[0].preview,'Привет');
  assert.equal(f.state.lastSendFailure,null);
  assert.equal(f.state.lastSendFailures.has('A'),false);
});

test('late A failure erases cached spinner and restores A draft without B popup',async()=>{
  const f=fixture(),inFlight=f.send();
  f.leaveA();f.fail(true);await inFlight;
  assert.equal(f.state.threadCache.get('A').messages.some(m=>m.pending),false);
  assert.equal(f.state.drafts.get('A'),'Привет');
  assert.equal(f.field.value,'Текст B');
  assert.equal(f.toasts.length,0,'unrelated delayed popup must not interrupt B');
  assert.equal(f.state.lastSendFailures.get('A').nonce,'nonce-1');
});

test('successful retry clears old nonce, so a new identical message gets a fresh nonce',async()=>{
  const f=fixture();
  let run=f.send();f.fail(true);await run;
  f.field.value='Привет';
  run=f.send();f.accept(121);await run;
  f.field.value='Привет';
  run=f.send();f.accept(122);await run;
  assert.deepEqual(f.nonces,['nonce-1','nonce-1','nonce-2']);
  assert.equal(f.state.lastSendFailure,null);
  assert.equal(f.state.lastSendFailures.has('A'),false);
});

test('JSON numeric-string Telegram ACK IDs are accepted without producing phantom spinners',async()=>{
  const f=fixture(),run=f.send();f.leaveA();
  f.accept('304');await run;
  const cache=f.state.threadCache.get('A').messages;
  assert.equal(cache.some(m=>Number(m.id)===304&&m.sent),true);
  assert.equal(cache.some(m=>String(m.id).startsWith('sending-')),false);
});

test('returning to A before ACK reconciles both visible and saved A history',async()=>{
  const f=fixture(),run=f.send();
  f.leaveA();
  f.state.thread={id:'A'};
  f.state.messages=f.state.threadCache.get('A').messages.map(m=>({...m}));
  f.field.value='Новый черновик A';
  f.state.drafts.set('A',f.field.value);
  f.accept(207);await run;
  assert.equal(f.state.messages.some(m=>m.pending),false);
  assert.equal(f.state.threadCache.get('A').messages.some(m=>m.pending),false);
  assert.equal(f.state.messages.some(m=>m.id===207&&m.sent),true);
  assert.equal(f.field.value,'Новый черновик A');
  assert.equal(f.state.drafts.get('A'),'Новый черновик A');
});

test('uncertain text retention is bounded in volatile memory across many chats',async()=>{
  const f=fixture();
  for(let i=0;i<11;i++){
    const id='chat-'+i;
    f.state.thread={id};
    f.state.messages=[];
    f.field.value='Message '+i;
    const sending=f.send();f.fail(true);await sending;
  }
  assert.ok(f.state.lastSendFailures.size<=8);
  assert.equal(f.state.lastSendFailures.has('chat-0'),false);
  assert.equal(f.state.lastSendFailures.has('chat-10'),true);
});
