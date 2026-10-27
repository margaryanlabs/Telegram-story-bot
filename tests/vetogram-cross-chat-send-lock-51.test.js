/* VETOGRAM 5.1: an in-flight A send must not masquerade as a B send.
 * Test the actual source controllers; no owner session or Telegram requests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
function segment(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>0&&b>a,'require a real source controller');
  return source.slice(a,b);
}
const composer=segment('  function renderSendComposer(){','  async function sendOutgoing(){');
const rich=segment('  function richSendIntent(','  // Installed packs are fetched');

test('chat B remains editable but shows honest lock while A is sending',()=>{
  const input={value:'B draft',dataset:{activeChat:'B'},style:{},scrollHeight:28};
  const sendButton={disabled:false,title:'',textContent:''};
  const form={classList:{toggle(){}}};
  const attach={disabled:false};
  const nodes={
    telegramThreadComposer:form,telegramThreadCompose:input,
    telegramThreadSend:sendButton,telegramThreadAttachButton:attach,
  };
  const state={
    thread:{id:'B',type:'private'},ownerInitData:'signed',
    sendInFlight:true,sendInFlightChatId:'A',pendingAttachment:null,
    recording:null,voiceStarting:false,drafts:new Map([['B','B draft']]),
  };
  const ctx=vm.createContext({
    state,$:id=>nodes[id]||null,canSendInThread:()=>true,
    renderVoiceDraft(){},
  });
  new vm.Script(composer+'\nrenderSendComposer()').runInContext(ctx);
  assert.equal(input.disabled,false);
  assert.equal(input.value,'B draft');
  assert.match(input.placeholder,/отправка в другом чате/);
  assert.equal(sendButton.disabled,true);
  assert.equal(sendButton.textContent,'➤','no fake spinner on chat B');
  assert.match(sendButton.title,/другом чате/);
  assert.equal(attach.disabled,true,'serialize Telegram sends');
  state.sendInFlight=false;state.sendInFlightChatId=null;
  new vm.Script('renderSendComposer()').runInContext(ctx);
  assert.equal(sendButton.disabled,false);
  assert.equal(input.value,'B draft');
});

function fixture(){
  const state={
    thread:{id:'A'},ownerInitData:'signed',sendInFlight:false,
    sendInFlightChatId:null,lastRichFailure:null,
    lastRichFailures:new Map(),replyTo:null,
    pendingAttachment:null,drafts:new Map(),draftVersions:new Map(),
  };
  const file={name:'note.png',size:1200,type:'image/png'};
  const attachment={file,kind:'photo'};
  const ctx=vm.createContext({
    state,tg:{initData:'signed'},$:id=>id==='telegramThreadCompose'?{value:''}:null,
    window:{crypto:{randomUUID:()=> 'new-nonce'}},
    canSendInThread:()=>true,
    readFileAsBase64:async()=>{throw new Error('local file read failed')},
    richRequest:async()=>{throw new Error('must not reach Telegram')},
    renderSendComposer(){},renderReplyPreview(){},renderAttachmentChip(){},
    setDeliveryStatus(){},touchRecentChat(){},threadNotice(){},toast(){},
    closeStickerDrawer(){},dropVoiceDraft(){},resetOwner(){},setTimeout:()=>0,
  });
  new vm.Script(rich).runInContext(ctx);
  const make=()=>vm.runInContext('richSendIntent("send_media","A",globalThis.original,"",null,null)',
    Object.assign(ctx,{original:attachment}));
  const send=()=>vm.runInContext('sendRichOutgoing("send_media",globalThis.original)',ctx);
  return {state,make,send,attachment};
}
test('local media file read error never destroys an uncertain original nonce',async()=>{
  const f=fixture(),intent=f.make();
  f.state.lastRichFailures.set('A',{intent,nonce:'original-uncertain-nonce'});
  await f.send();
  assert.equal(f.state.lastRichFailures.get('A').nonce,'original-uncertain-nonce');
  assert.equal(f.state.sendInFlight,false);
  assert.equal(f.state.sendInFlightChatId,null);
});

test('account reset explicitly clears in-flight owner scope',()=>{
  assert.match(source,/state\.sendInFlight=false;state\.sendInFlightChatId=null;state\.lastSendFailure=null/);
  assert.match(source,/state\.lastRichFailures\.clear\(\)/);
});
