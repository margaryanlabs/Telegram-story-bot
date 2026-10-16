import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyTelegramClientOwner,telegramOwnerError} from '../lib/telegram-owner-runtime.js';
const load=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('MTProto runtime user identity must match signed Telegram Mini App owner',async()=>{
  assert.deepEqual(await verifyTelegramClientOwner({
    getMe:async()=>({id:{toString:()=> '111'},firstName:'Own',username:'own'}),
  },111),{name:'Own',username:'own',verified:true});
  await assert.rejects(()=>verifyTelegramClientOwner({getMe:async()=>({id:222})},111),
    e=>e.code==='TELEGRAM_OWNER_MISMATCH');
  await assert.rejects(()=>verifyTelegramClientOwner({getMe:async()=>{throw Error('network')}} ,111),
    e=>e.code==='TELEGRAM_OWNER_UNVERIFIED');
  assert.equal(telegramOwnerError({code:'TELEGRAM_OWNER_MISMATCH'}).status,409);
  assert.equal(telegramOwnerError({code:'TELEGRAM_OWNER_UNVERIFIED'}).status,503);
  assert.equal(telegramOwnerError(new Error('timeout')),null);
});
test('Private list, thread, avatars and history backup cannot run without real owner identity check',()=>{
  const chats=load('api/telegram-chats.js'),media=load('api/telegram-chat-media.js');
  const backup=load('api/privacy-backup.js'),worker=load('api/privacy-backup-worker.js');
  assert.equal(chats.split('verifyTelegramClientOwner(client,userId)').length-1,2);
  assert.equal(media.split('verifyTelegramClientOwner(client,userId)').length-1,1);
  assert.equal(backup.split('verifyTelegramClientOwner(client,userId)').length-1,3);
  assert.equal(worker.split('verifyTelegramClientOwner(client,userId)').length-1,1);
  assert.ok(chats.includes("if(stop)return respond(res,stop.status,{error:stop.error});"));
  assert.ok(media.includes('if(stop)return deny(res,stop.status,stop.error)'));
  assert.ok(chats.indexOf('verifyTelegramClientOwner(client,userId)')<chats.indexOf('client.getDialogs('));
  assert.ok(media.indexOf('verifyTelegramClientOwner(client,userId)')<media.indexOf('client.getDialogs('));
});
test('No unverified live chat is shown or carried over to new identity',()=>{
  const api=load('api/telegram-chats.js'),ui=load('public/telegram-chats.js');
  const html=load('public/studio.html');
  assert.ok(api.includes('sameTelegramAccount(userId, linked.telegram_account_user_id)'));
  assert.ok(api.includes("source:live.account?.verified?'telegram-live':'owner-scoped-veto-archive'"));
  assert.ok(ui.includes('state.connectionProof=data.connection||null'));
  assert.ok(ui.includes('state.chats=[];state.hasMore=false;state.connectionProof=null'));
  assert.ok(html.includes('id="telegramMirrorAccountProof"'));
  assert.ok(ui.includes('id="telegramMirrorDeletedGuide"')||html.includes('id="telegramMirrorDeletedGuide"'));
  assert.ok(html.includes('veto-mirror-account-proof'));
});
test('Confirmed deleted messages are distinguished from saved-but-not-confirmed archives',()=>{
  const source=load('api/telegram-chats.js'),html=load('public/telegram-chats.js');
  assert.ok(source.includes('confirmedDeleted:history.reduce'));
  assert.ok(html.includes('Подтверждённых удалений'));
  assert.ok(html.includes('Резервные копии без Business сохраняют содержимое'));
  assert.ok(source.includes('deleted:Boolean(row.deleted_at)'));
});
