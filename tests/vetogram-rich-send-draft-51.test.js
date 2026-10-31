/* Real VETOGRAM rich-send controller tests: no user data, no Telegram API calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const code=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const from=code.indexOf('  async function sendRichOutgoing(');
const to=code.indexOf('  // Installed packs are fetched',from);
assert.ok(from>0&&to>from,'use the real app rich-send controller');
const functionSource=code.slice(from,to);

function fixture(){
  const originalFile={name:'test.jpg',type:'image/jpeg',size:1204};
  const pendingAttachment={file:originalFile,kind:'photo'};
  const state={
    thread:{id:'A'},ownerInitData:'signed',sendInFlight:false,
    pendingAttachment,replyTo:{id:42},lastRichFailure:null,
    drafts:new Map([['A','Старый текст']]),draftVersions:new Map([['A',0]]),
  };
  const field={value:'Старый текст'};
  const nodes={telegramThreadCompose:field,
    telegramThreadFileInput:{value:'selected'},
    telegramThreadAudioInput:{value:'selected'}};
  const calls=[],deferred=[];
  const ctx=vm.createContext({
    state,tg:{initData:'signed'},$:id=>nodes[id]||null,
    window:{crypto:{randomUUID:()=> 'nonce-1'}},
    canSendInThread:chat=>Boolean(chat),
    richSendIntent:(action,chatId,pending,caption,replyTo,stickerId)=>({
      action,chatId,file:pending?.file||pending||null,caption,replyTo,
      stickerId:action==='send_sticker'?String(stickerId?.id||stickerId):null,
      stickerSetId:action==='send_sticker'?(stickerId?.setId||null):null,
    }),
    sameRichIntent:()=>false,
    readFileAsBase64:async()=> 'cGhvdG8=',
    richRequest:(action,payload)=>{calls.push({action,payload});return new Promise((resolve,reject)=>deferred.push({resolve,reject}))},
    renderSendComposer(){},renderReplyPreview(){},renderAttachmentChip(){},
    setDeliveryStatus(){},touchRecentChat(){},threadNotice(){},toast(){},
    closeStickerDrawer(){},dropVoiceDraft(){},resetOwner(){},
    setTimeout:()=>0,
  });
  new vm.Script(functionSource).runInContext(ctx);
  const send=(action,payload)=>new vm.Script(
    'sendRichOutgoing('+JSON.stringify(action)+(action==='send_sticker'
      ?','+JSON.stringify(payload):'')+')').runInContext(ctx);
  const accept=()=>deferred.shift().resolve({ok:true});
  return {state,field,nodes,calls,send,accept,pendingAttachment};
}

test('media ACK never deletes newly composed text or a changed reply target',async()=>{
  const f=fixture(),task=f.send('send_media');
  for(let i=0;i<6&&f.calls.length<1;i++)await Promise.resolve();
  f.field.value='Новый текст';
  f.state.drafts.set('A','Новый текст');
  f.state.replyTo={id:99};
  f.accept();await task;
  assert.equal(f.field.value,'Новый текст');
  assert.equal(f.state.drafts.get('A'),'Новый текст');
  assert.equal(f.state.replyTo.id,99);
  assert.equal(f.state.pendingAttachment,null);
  assert.equal(f.calls[0].payload.replyTo,42);
  assert.equal(f.calls[0].payload.caption,'Старый текст');
});

test('media ACK removes only the original unchanged caption and attachment',async()=>{
  const f=fixture(),task=f.send('send_media');
  for(let i=0;i<6&&f.calls.length<1;i++)await Promise.resolve();
  f.accept();await task;
  assert.equal(f.field.value,'');
  assert.equal(f.state.drafts.has('A'),false);
  assert.equal(f.state.pendingAttachment,null);
  assert.equal(f.state.replyTo,null);
});

test('sticker send does not consume unsent text or text draft',async()=>{
  const f=fixture(),task=f.send('send_sticker',{id:'777'});
  for(let i=0;i<6&&f.calls.length<1;i++)await Promise.resolve();
  f.accept();await task;
  assert.equal(f.field.value,'Старый текст');
  assert.equal(f.state.drafts.get('A'),'Старый текст');
  assert.equal(f.state.pendingAttachment,f.pendingAttachment);
  assert.equal(f.calls[0].payload.stickerId,'777');
});

test('late media ACK cannot clear a newer unsent attachment',async()=>{
  const f=fixture(),task=f.send('send_media');
  for(let i=0;i<6&&f.calls.length<1;i++)await Promise.resolve();
  const newFile={file:{name:'other.png',type:'image/png',size:450}};
  f.state.pendingAttachment=newFile;
  f.accept();await task;
  assert.equal(f.state.pendingAttachment,newFile);
  assert.equal(f.nodes.telegramThreadFileInput.value,'selected');
});

test('late rich ACK after opening chat B leaves B composer intact',async()=>{
  const f=fixture(),task=f.send('send_media');
  for(let i=0;i<6&&f.calls.length<1;i++)await Promise.resolve();
  f.state.thread={id:'B'};
  f.field.value='Текст B';
  f.state.drafts.set('B','Текст B');
  f.accept();await task;
  assert.equal(f.field.value,'Текст B');
  assert.equal(f.state.drafts.get('B'),'Текст B');
});

test('late media ACK after leaving chat A removes unchanged original A caption only',async()=>{
  const f=fixture(),task=f.send('send_media');
  for(let i=0;i<6&&f.calls.length<1;i++)await Promise.resolve();
  f.state.thread={id:'B'};
  f.field.value='Черновик B';
  f.state.drafts.set('B','Черновик B');
  f.accept();await task;
  assert.equal(f.state.drafts.has('A'),false);
  assert.equal(f.state.drafts.get('B'),'Черновик B');
  assert.equal(f.field.value,'Черновик B');
});

test('typed identical text with newer version remains after older media ACK',async()=>{
  const f=fixture(),task=f.send('send_media');
  for(let i=0;i<6&&f.calls.length<1;i++)await Promise.resolve();
  // The user deliberately typed the same string again; equality alone
  // cannot distinguish a new draft from an old sent caption.
  f.state.draftVersions.set('A',1);
  f.state.drafts.set('A','Старый текст');
  f.accept();await task;
  assert.equal(f.state.drafts.get('A'),'Старый текст');
  assert.equal(f.field.value,'Старый текст');
});

test('edited A draft survives media ACK after moving to chat B',async()=>{
  const f=fixture(),task=f.send('send_media');
  for(let i=0;i<6&&f.calls.length<1;i++)await Promise.resolve();
  f.state.draftVersions.set('A',1);
  f.state.drafts.set('A','Новый черновик A');
  f.state.thread={id:'B'};
  f.field.value='Черновик B';
  f.accept();await task;
  assert.equal(f.state.drafts.get('A'),'Новый черновик A');
  assert.equal(f.field.value,'Черновик B');
});
