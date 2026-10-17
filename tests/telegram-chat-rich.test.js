import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 MEDIA_LIMIT_BYTES,MEDIA_KINDS,decodeMediaInput,cleanCaption,
 recentStickersPublic,sendRichTelegramMessage,
} from '../lib/telegram-chat-rich.js';
import {safeReplyId,assertReplyInDialog,sendOwnerMessage} from '../lib/telegram-chat-compose.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const nonce='4ef01288-1a6e-4a6d-8d69-122ba9f3a817';
const dialog={id:123n,entity:{id:123n},isUser:true};
const mock=()=>({
 uploads:[],invocations:[],
 async getInputEntity(entity){return {className:'InputPeerUser',userId:entity.id}},
 async uploadFile(args){this.uploads.push(args);return {className:'InputFile',id:44n}},
 async invoke(req){this.invocations.push(req);return {id:909}},
 async getMessages(entity,args){return args.ids[0]===5?[{id:5,className:'Message'}]:[]},
});

test('incoming reply IDs are scoped to real messages, invalid ids cannot target other chats',async()=>{
 const client=mock();
 assert.equal(safeReplyId(null),null);
 assert.equal(safeReplyId(5),5);
 assert.throws(()=>safeReplyId(-1));
 assert.throws(()=>safeReplyId('x'));
 assert.equal(await assertReplyInDialog(client,dialog,5),5);
 await assert.rejects(assertReplyInDialog(client,dialog,90),/недоступно/);
 await sendOwnerMessage(client,[dialog],{ownerId:'777',chatId:'123',message:'Да!',nonce,replyTo:5});
 const req=client.invocations[0];
 assert.equal(req.className,'messages.SendMessage');
 assert.equal(req.replyTo.replyToMsgId,5);
});

test('raw uploads are bounded and verified before memory allocation',()=>{
 assert.equal(MEDIA_LIMIT_BYTES,2*1024*1024);
 assert.deepEqual(MEDIA_KINDS,['photo','document','voice']);
 const binary=Buffer.from('Photo').toString('base64');
 const photo=decodeMediaInput({kind:'photo',mime:'image/png',name:'pic.png',base64:binary});
 assert.equal(photo.buffer.toString(),'Photo');
 assert.equal(photo.mime,'image/png');
 assert.throws(()=>decodeMediaInput({kind:'photo',mime:'image/svg+xml',name:'danger.svg',base64:binary}));
 assert.throws(()=>decodeMediaInput({kind:'document',mime:'text/html',name:'x.html',base64:binary}));
 assert.throws(()=>decodeMediaInput({kind:'photo',mime:'image/png',name:'good.png',base64:'!##'}));
 assert.throws(()=>decodeMediaInput({kind:'photo',mime:'image/png',name:'good.png',base64:'a'.repeat(4*1024*1024)}));
 assert.throws(()=>decodeMediaInput({kind:'voice',mime:'audio/webm',name:'voice.webm',duration:100,base64:binary}));
 assert.equal(cleanCaption('  подпись '),'подпись');
 assert.throws(()=>cleanCaption('x'.repeat(1025)));
});

test('photo media is sent via Telegram owner MTProto with retry-stable random ID',async()=>{
 const client=mock();
 const result=await sendRichTelegramMessage(client,[dialog],{
  action:'send_media',kind:'photo',mime:'image/png',base64:Buffer.from('png').toString('base64'),
  name:'a.png',caption:'Hello',ownerId:'777',chatId:'123',nonce,replyTo:5,
 });
 assert.equal(result.sent,true);
 assert.equal(result.messageId,909);
 assert.equal(client.uploads.length,1);
 const sent=client.invocations[0];
 assert.equal(sent.className,'messages.SendMedia');
 assert.equal(sent.media.className,'InputMediaUploadedPhoto');
 assert.equal(sent.message,'Hello');
 assert.equal(sent.replyTo.replyToMsgId,5);
});

test('voice and document use real Telegram document MIME and voice attribute',async()=>{
 const voice=mock(),doc=mock();
 const base64=Buffer.from('voice').toString('base64');
 await sendRichTelegramMessage(voice,[dialog],{
  action:'send_media',kind:'voice',mime:'audio/webm',duration:6,name:'note.webm',
  base64,ownerId:'777',chatId:'123',nonce,
 });
 const media=voice.invocations[0].media;
 assert.equal(media.className,'InputMediaUploadedDocument');
 assert.equal(media.mimeType,'audio/webm');
 assert.ok(media.attributes.some(a=>a.className==='DocumentAttributeAudio'&&a.voice===true));
 await sendRichTelegramMessage(doc,[dialog],{
  action:'send_media',kind:'document',mime:'application/pdf',name:'file.pdf',
  base64,ownerId:'777',chatId:'123',nonce,
 });
 assert.equal(doc.invocations[0].media.forceFile,true);
});

test('recent stickers expose only indices and emoji, and send a server-resolved Telegram document',async()=>{
 const sticker={
  id:88n,accessHash:99n,fileReference:Buffer.from('ref'),
  attributes:[{className:'DocumentAttributeSticker',alt:'🦊'}],
 };
 const client=mock();
 client.invoke=async req=>{
   client.invocations.push(req);
   return req.className==='messages.GetRecentStickers'?{stickers:[sticker]}:{id:777};
 };
 assert.deepEqual(recentStickersPublic([sticker]),[{index:0,id:'88',emoji:'🦊'}]);
 const result=await sendRichTelegramMessage(client,[dialog],{
  action:'send_sticker',stickerId:'88',ownerId:'777',chatId:'123',nonce,
 });
 assert.equal(result.kind,'sticker');
 assert.equal(client.invocations[1].className,'messages.SendMedia');
 assert.equal(client.invocations[1].media.className,'InputMediaDocument');
 await assert.rejects(sendRichTelegramMessage(client,[dialog],{
  action:'send_sticker',stickerId:'999',ownerId:'777',chatId:'123',nonce,
 }));
});

test('UI requires explicit user sends, uses client mic permission, no fake in-browser calling',()=>{
 const ui=read('public/telegram-chats.js'),html=read('public/studio.html'),api=read('api/telegram-send.js'),media=read('api/telegram-chat-media.js');
 for(const id of ['telegramThreadAttachButton','telegramThreadRecordVoice','telegramThreadStickersButton','telegramThreadReplyPreview','telegramThreadVoicePreview','telegramThreadVoiceSend']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(ui,/navigator\.mediaDevices\.getUserMedia\(/);
 assert.match(ui,/echoCancellation:true/);
 assert.match(ui,/new MediaRecorder\(/);
 assert.match(ui,/sendRichOutgoing\('send_media'/);
 assert.match(ui,/sendRichOutgoing\('send_sticker'/);
 assert.match(ui,/data-mirror-reply/);
 assert.match(ui,/openLiveAttachment\(/);
 assert.match(api,/verifyTelegramClientOwner\(client,userId\)/);
 assert.match(api,/safeReplyId\(body.replyTo\)/);
 assert.match(api,/\['send_message','send_media','send_sticker','recent_stickers'\]/);
 assert.match(media,/verifyTelegramClientOwner\(client,userId\)/);
 assert.match(media,/Content-Disposition/);
 assert.doesNotMatch(html,/id="telegramThreadCall"/);
 assert.doesNotMatch(ui,/telegramThreadCall/);
 assert.match(ui,/sendRichOutgoing\('send_media',\{file:draft\.file,kind:'voice'/);
});
