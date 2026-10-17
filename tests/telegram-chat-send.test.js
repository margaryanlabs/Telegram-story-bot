import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_MESSAGE_CHARACTERS, SENDABLE_TYPES, cleanOutgoingMessage,validateSendNonce,
  writableDialog,makeRandomId,sentMessageId,sendOwnerMessage,
} from '../lib/telegram-chat-compose.js';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const owner='123456789';
const privateChat={id:101n,isUser:true,entity:{id:101n}};
const group={id:202n,isGroup:true,entity:{id:202n}};
const bot={id:303n,isUser:true,entity:{id:303n,bot:true}};
const saved={id:404n,isUser:true,entity:{id:404n,self:true}};
const channel={id:505n,isChannel:true,isGroup:false,entity:{id:505n}};
const dialogs=[privateChat,group,bot,saved,channel];

test('compose validation rejects empty, huge or invalid messages and forged send IDs',()=>{
 assert.equal(MAX_MESSAGE_CHARACTERS,4096);
 assert.equal(cleanOutgoingMessage('  hello\r\nworld  '),'hello\nworld');
 for(const v of ['', '    ', '\0hi', 'a'.repeat(4097), null, 42])
   assert.throws(()=>cleanOutgoingMessage(v));
 const uuid='20f9a8ba-a99a-40da-87ee-5b6996e9d764';
 assert.equal(validateSendNonce(uuid),uuid);
 for(const bad of ['', 'random', 'A'.repeat(36), 42, null, 'a'.repeat(200)])
   assert.throws(()=>validateSendNonce(bad));
});

test('existing authenticated owner dialog is required: groups, private, bots and Saved okay, channels and missing forbidden',()=>{
 assert.deepEqual(SENDABLE_TYPES,['private','group','bot','saved']);
 for(const n of ['101','202','303','404'])
   assert.equal(String(writableDialog(dialogs,n).id),n);
 for(const n of ['505','999','-99','abc'])
   assert.throws(()=>writableDialog(dialogs,n));
});

test('Telegram random_id stable across uncertain network retries but changes by owner, peer and explicit intent',()=>{
 const first='20f9a8ba-a99a-40da-87ee-5b6996e9d764';
 const second='b0216429-29c7-44da-865c-25bfdf48a91a';
 const seed=makeRandomId(owner,'101',first);
 assert.equal(typeof seed,'bigint');
 assert.notEqual(seed,0n);
 assert.equal(makeRandomId(owner,'101',first),seed);
 assert.notEqual(makeRandomId(owner,'102',first),seed);
 assert.notEqual(makeRandomId('123456788','101',first),seed);
 assert.notEqual(makeRandomId(owner,'101',second),seed);
});

test('sendOwnerMessage invokes the MTProto send API with chosen peer once and no Business rights',async()=>{
 let called=0,request=null;
 const client={
   getInputEntity: async peer=>({ className:'InputPeerUser',userId:peer.id }),
   invoke: async q=>{called++;request=q;return {id:924};},
 };
 const nonce='20f9a8ba-a99a-40da-87ee-5b6996e9d764';
 const result=await sendOwnerMessage(client,dialogs,{
  ownerId:owner,chatId:'101',message:'Привет',nonce,
 });
 assert.equal(called,1);
 assert.equal(request.className,'messages.SendMessage');
 assert.equal(request.message,'Привет');
 assert.equal(String(request.randomId),String(makeRandomId(owner,'101',nonce)));
 assert.equal(request.silent,false);
 assert.equal(result.sent,true);
 assert.equal(result.messageId,924);
 assert.equal(result.source,'owner-mtproto');
 assert.equal(sentMessageId({updates:[{className:'UpdateMessageID',id:16,randomId:123n}]},123n),16);
});

test('send API independently verifies initData, encrypted session, live owner and target; no bot impersonation',()=>{
 const api=read('api/telegram-send.js'),mini=read('public/telegram-chats.js'),html=read('public/studio.html');
 assert.match(api,/validateTelegramMiniApp/);
 assert.match(api,/sameTelegramAccount\(userId,session.telegram_account_user_id\)/);
 assert.match(api,/verifyTelegramClientOwner\(client,userId\)/);
 assert.ok(api.indexOf('verifyTelegramClientOwner(client,userId)')<api.indexOf('client.getDialogs({limit:500})'));
 assert.match(api,/sendOwnerMessage\(client,dialogs/);
 assert.match(api,/uncertain:true/);
 assert.doesNotMatch(api,/TELEGRAM_BUSINESS|BUSINESS_CONNECTION_ID|sendBusinessMessage/);
 assert.match(html,/id="telegramThreadCompose"/);
 assert.match(html,/id="telegramThreadSend"/);
 assert.match(mini,/sendOutgoing\(/);
 assert.match(mini,/window.crypto\?\.randomUUID/);
 assert.match(mini,/lastSendFailure/);
 assert.match(mini,/data.canSend===true/);
 assert.match(mini,/\['private','group','bot','saved'\]/);
});
