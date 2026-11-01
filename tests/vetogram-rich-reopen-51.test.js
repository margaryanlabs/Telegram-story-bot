/* VETOGRAM 5.1: safe in-memory restore for uncertain media sends.
 * Tests actual shipping controllers; no real Telegram sessions or file uploads.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const start=source.indexOf('  function richSendIntent(');
const end=source.indexOf('  async function sendRichOutgoing(',start);
assert.ok(start>0&&end>start,'exercise actual intent comparison and restore functions');
const controllers=source.slice(start,end);

function fixture({chat='A',kind='photo',caption='Фото семьи',
    draft=caption,owner='signed',size=1000,voice=false}={}){
  const file={name:'photo.jpg',size,type:'image/jpeg'};
  const pending={file,kind:voice?'voice':kind,duration:voice?5:0};
  const state={
    ownerInitData:owner,
    replyTo:null,pendingAttachment:null,
    drafts:new Map([[chat,draft]]),
    lastRichFailures:new Map(),
  };
  const ctx=vm.createContext({state,tg:{initData:'signed'}});
  new vm.Script(controllers).runInContext(ctx);
  const make=(pendingArg)=>new vm.Script(
    'richSendIntent("send_media",'+JSON.stringify(chat)+
    ',globalThis.pendingArg,'+JSON.stringify(caption)+',42,null)'
  ).runInContext(Object.assign(ctx,{pendingArg}));
  const original=make(pending);
  state.lastRichFailures.set(chat,{intent:original,nonce:'nonce-123'});
  const restore=()=>new vm.Script(
    'restoreUncertainRichMedia({id:'+JSON.stringify(chat)+'})'
  ).runInContext(ctx);
  const compare=(left,right)=>{
    ctx.left=left;ctx.right=right;
    return new vm.Script('sameRichIntent(left,right)').runInContext(ctx);
  };
  return {state,file,original,restore,compare,make};
}

test('unchanged signed-owner chat restores original File and reply for a manual retry',()=>{
  const f=fixture();
  assert.equal(f.restore(),true);
  assert.equal(f.state.pendingAttachment.file,f.file);
  assert.equal(f.state.pendingAttachment.kind,'photo');
  assert.equal(f.state.replyTo.id,42);
  const retry=f.make(f.state.pendingAttachment);
  assert.equal(f.compare(f.original,retry),true,'exact reselected payload keeps the original nonce');
  assert.equal(f.state.lastRichFailures.get('A').nonce,'nonce-123');
});

test('new text never silently reattaches an old media upload',()=>{
  const f=fixture({draft:'Другое сообщение'});
  assert.equal(f.restore(),false);
  assert.equal(f.state.pendingAttachment,null);
  assert.equal(f.state.replyTo,null);
});

test('changed account or foreign chat cannot access a prior upload',()=>{
  const f=fixture({owner:'another-owner'});
  assert.equal(f.restore(),false);
  const own=fixture();
  own.state.lastRichFailures.delete('A');
  assert.equal(own.restore(),false);
});

test('voice recording is not reconstructed as an ordinary photo/document attachment',()=>{
  const f=fixture({voice:true});
  assert.equal(f.restore(),false);
  assert.equal(f.state.pendingAttachment,null);
});

test('oversized or missing user-owned file cannot be restored',()=>{
  const large=fixture({size:2*1024*1024+1});
  assert.equal(large.restore(),false);
  const empty=fixture({size:0});
  assert.equal(empty.restore(),false);
});

test('different kind or duration changes the delivery intent and nonce',()=>{
  const f=fixture();
  assert.equal(f.compare(f.original,f.make({file:f.file,kind:'document'})),false);
  assert.equal(f.compare(f.original,f.make({file:f.file,kind:'photo',duration:10})),false);
});

test('attachment chip shows the real selected file name and readable byte size',()=>{
  const from=source.indexOf('  function renderAttachmentChip(){');
  const to=source.indexOf('  function readFileAsBase64(',from);
  assert.ok(from>0&&to>from);
  const code=source.slice(from,to);
  const chip={hidden:true},label={textContent:''};
  const state={pendingAttachment:{file:{name:'archive.pdf',size:2048},kind:'document'}};
  vm.runInNewContext(code+'\nrenderAttachmentChip()',{
    state,$:id=>id==='telegramThreadAttachmentChip'?chip:label,
  });
  assert.equal(chip.hidden,false);
  assert.match(label.textContent,/archive\.pdf/);
  assert.match(label.textContent,/2 КБ/);
});

test('restore never silently triggers Telegram send and warnings require verification',()=>{
  assert.doesNotMatch(controllers,/fetch\(|sendChatRequest\(|richRequest\(/);
  assert.match(source,/Файл мог быть отправлен\. Проверь Telegram перед повтором/);
  assert.match(source,/state\.lastRichFailures\.size>4/);
});
