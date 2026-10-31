import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {decodeMediaInput,sendRichTelegramMessage} from '../lib/telegram-chat-rich.js';
import {makeRandomId,sentMessageId,sendOwnerMessage} from '../lib/telegram-chat-compose.js';

const nonce='20f9a8ba-a99a-40da-87ee-5b6996e9d764';
const peer={id:456n,isUser:true,entity:{id:456n}};
const mp4=Buffer.from([0,0,0,24,...Buffer.from('ftypisom'),0,0,0,0]).toString('base64');
const mp3=Buffer.from('ID3fixture-media').toString('base64');
function client(){
 return {requests:[],uploads:[],getInputEntity:async()=>({className:'InputPeerUser',userId:456n}),
  async uploadFile(value){this.uploads.push(value);return {id:999n,className:'InputFile'}},
  async invoke(request){this.requests.push(request);return {updates:[{className:'UpdateMessageID',randomId:request.randomId,id:88}]}}};
}
const video={kind:'video',mime:'video/mp4',name:'clip.mp4',base64:mp4,duration:5.25,width:1080,height:1920};

test('real MTProto video and audio uploads carry native document attributes, preserving documents',async()=>{
 const c=client();
 const common={action:'send_media',ownerId:'123',chatId:'456',nonce};
 const result=await sendRichTelegramMessage(c,[peer],{...common,...video});
 assert.equal(result.sent,true);assert.equal(result.kind,'video');assert.equal(result.messageId,88);
 const v=c.requests[0];
 assert.equal(v.className,'messages.SendMedia');
 assert.equal(v.media.className,'InputMediaUploadedDocument');
 assert.equal(v.media.forceFile,false);
 const attr=v.media.attributes.find(a=>a.className==='DocumentAttributeVideo');
 assert.equal(attr.w,1080);assert.equal(attr.h,1920);assert.equal(attr.duration,6);
 assert.equal(attr.supportsStreaming,false);
 assert.equal(v.randomId,makeRandomId('123','456',nonce));
 await sendRichTelegramMessage(c,[peer],{...common,kind:'audio',mime:'audio/mpeg',name:'song.mp3',base64:mp3,duration:42});
 const a=c.requests[1].media.attributes.find(a=>a.className==='DocumentAttributeAudio');
 assert.equal(a.voice,false);assert.equal(a.duration,42);
 assert.equal(c.requests[1].media.forceFile,false);
 await sendRichTelegramMessage(c,[peer],{...common,kind:'document',mime:'application/pdf',name:'note.pdf',base64:Buffer.from('pdf').toString('base64')});
 assert.equal(c.requests[2].media.forceFile,true);
 assert.equal(c.requests[2].media.attributes[0].className,'DocumentAttributeFilename');
});

test('invalid media container, MIME, duration, dimensions and upload size fail before Telegram upload',async()=>{
 const cases=[{mime:'text/html'},{base64:Buffer.from('not MP4').toString('base64')},
  {duration:0},{duration:Infinity},{duration:86401},{width:0},{height:8193},{width:12.2},
  {base64:Buffer.alloc(2*1024*1024+1).toString('base64')}];
 for(const invalid of cases){
  assert.throws(()=>decodeMediaInput({...video,...invalid}));
  const c=client();
  await assert.rejects(sendRichTelegramMessage(c,[peer],{action:'send_media',ownerId:'123',chatId:'456',nonce,...video,...invalid}));
  assert.equal(c.uploads.length,0);assert.equal(c.requests.length,0);
 }
});

test('unrelated Telegram updates never become a success confirmation for this outgoing message',async()=>{
 assert.equal(sentMessageId({updates:[{className:'UpdateNewMessage',message:{id:77}}]},123n),null);
 assert.equal(sentMessageId({updates:[{className:'UpdateMessageID',randomId:999n,id:77}]},123n),null);
 const c=client();c.invoke=async()=>({updates:[{className:'UpdateNewMessage',message:{id:77}}]});
 await assert.rejects(sendRichTelegramMessage(c,[peer],{
  action:'send_media',ownerId:'123',chatId:'456',nonce,...video,
 }),error=>error.uncertain===true&&error.status===502);
 await assert.rejects(sendOwnerMessage(c,[peer],{
  ownerId:'123',chatId:'456',nonce,message:'Hello',
 }),error=>error.uncertain===true&&error.status===502);
});

const ui=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const helperSource=ui.slice(ui.indexOf('  function richSendIntent('),ui.indexOf('  async function sendRichOutgoing('));
const senderSource=ui.slice(ui.indexOf('  async function sendRichOutgoing('),ui.indexOf('  // Installed packs are fetched'));

test('closing real sticker drawer terminates, hides it and invalidates stale owner requests',()=>{
 const state={stickerEpoch:4},pane={hidden:false},attributes={};
 const closeSource=ui.slice(ui.indexOf('  function closeStickerDrawer('),ui.indexOf('  function stickerShownItems('));
 const close=vm.runInNewContext(closeSource+';closeStickerDrawer',{
  state,$:id=>id==='telegramThreadStickerDrawer'?pane:
   id==='telegramThreadStickersButton'?{setAttribute:(key,value)=>attributes[key]=value}:null,
 });
 close();
 assert.equal(pane.hidden,true);assert.equal(state.stickerEpoch,5);
 assert.equal(attributes['aria-expanded'],'false');
 close();assert.equal(state.stickerEpoch,6);
});

test('local metadata decoder never uploads and revokes private blob URLs on success and failure',async()=>{
 for(const fail of [false,true]){
  const revoked=[],elements=[];
  const api=vm.runInNewContext(helperSource+';({localMediaMetadata,attachmentKind})',{
   Promise,Error,Number,clearTimeout,setTimeout,
   URL:{createObjectURL:()=> 'blob:fixture-private',revokeObjectURL:url=>revoked.push(url)},
   document:{createElement:tag=>{
    const element={tag,duration:12.3,videoWidth:640,videoHeight:360,removeAttribute(){},load(){},
     set src(value){queueMicrotask(()=>fail?this.onerror():this.onloadedmetadata())}};
    elements.push(element);return element;
   }},
  });
  if(fail)await assert.rejects(api.localMediaMetadata({},'video'),/не смог прочитать/);
  else assert.deepEqual(JSON.parse(JSON.stringify(await api.localMediaMetadata({},'video'))),{duration:12.3,width:640,height:360});
  assert.deepEqual(revoked,['blob:fixture-private']);
  assert.equal(elements[0].onloadedmetadata,null);
  assert.equal(api.attachmentKind('video/mp4'),'video');
  assert.equal(api.attachmentKind('audio/ogg'),'audio');
  assert.equal(api.attachmentKind('application/pdf'),'document');
 }
});

function senderFixture(metadata=async()=>({duration:5,width:640,height:360})){
 const file={size:256,name:'clip.mp4',type:'video/mp4'};
 const state={thread:{id:'456'},ownerInitData:'signed-A',threadGeneration:1,
  pendingAttachment:{file,kind:'video'},replyTo:null,lastRichFailure:null,sendInFlight:false,
  drafts:new Map(),draftVersions:new Map(),lastRichFailures:new Map(),threadLoading:false};
 const field={value:'caption'},calls=[],notices=[];
 let ids=0,attempt=0;
 const sandbox={state,tg:{initData:'signed-A'},window:{crypto:{randomUUID:()=> (++ids===1?nonce:'11111111-1111-1111-1111-111111111111')}},
  $:id=>id==='telegramThreadCompose'?field:null,
  canSendInThread:()=>true,readFileAsBase64:async()=>mp4,localMediaMetadata:metadata,
  richRequest:async(action,payload)=>{calls.push({action,payload});if(attempt++===0)throw Object.assign(new Error('uncertain'),{uncertain:true})},
  setDeliveryStatus(){},renderSendComposer(){},touchRecentChat(){},closeStickerDrawer(){},
  renderReplyPreview(){},renderAttachmentChip(){},loadMessages(){},setTimeout(){},
  threadNotice:text=>notices.push(text),toast(){},Date,Error,String,Number,
 };
 // Reuse real intent/mime logic; metadata is injected to control the async boundary.
 const withoutDecoder=helperSource.slice(0,helperSource.indexOf('  function localMediaMetadata('));
 const send=vm.runInNewContext(withoutDecoder+senderSource+';sendRichOutgoing',sandbox);
 return {state,file,calls,send,field,notices};
}

test('uncertain native media retry reuses the nonce only for the same exact send intent',async()=>{
 const f=senderFixture();
 await f.send('send_media');
 assert.equal(f.calls.length,1);assert.ok(f.state.lastRichFailure);
 assert.equal(f.calls[0].payload.kind,'video');
 assert.equal(f.calls[0].payload.width,640);
 await f.send('send_media');
 assert.equal(f.calls.length,2);
 assert.equal(f.calls[1].payload.nonce,f.calls[0].payload.nonce);
});

test('owner or A→B→A thread generation changes during media parsing cancel before any send',async()=>{
 let release;
 const f=senderFixture(()=>new Promise(resolve=>{release=resolve}));
 const pending=f.send('send_media');
 f.state.threadGeneration+=2; // same chat ID and owner after returning to A
 f.state.sendInFlight=true; // same global send lock; no newer request can start while held
 release({duration:5,width:640,height:360});
 await pending;
 assert.equal(f.calls.length,0);
 assert.equal(f.state.sendInFlight,false);
});
