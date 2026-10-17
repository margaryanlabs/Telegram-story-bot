import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizePolledArchive,ACTIVE_DIALOG_SCAN,ACTIVE_LATEST_MESSAGES}
  from '../api/telegram-chat-updates.js';
import {combineLiveAndPreserved} from '../api/telegram-chats.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('active poll snapshots are bounded to the owner-verified active dialog',()=>{
 const api=read('api/telegram-chat-updates.js');
 assert.equal(ACTIVE_DIALOG_SCAN,70);
 assert.equal(ACTIVE_LATEST_MESSAGES,28);
 assert.match(api,/validateTelegramMiniApp\(/);
 assert.match(api,/sameTelegramAccount\(userId,session.telegram_account_user_id\)/);
 assert.ok(api.indexOf('verifyTelegramClientOwner(client,userId)') <
   api.indexOf('client.getDialogs({limit:ACTIVE_DIALOG_SCAN})'));
 assert.match(api,/dialog=dialogs.find\(item=>id\(item\?\.id\)===chatId\)/);
 assert.match(api,/client.getMessages\(dialog.entity,\{limit:ACTIVE_LATEST_MESSAGES\}\)/);
 assert.match(api,/action!=='poll_thread'/);
 assert.match(api,/readReceiptsSent:false/);
 assert.match(api,/source:'owner-mtproto-poll'/);
 assert.doesNotMatch(api, /markRead\(|readHistory\(|sendMessage\(|UpdateReadHistory/);
});

test('archive evidence is only from actual owner-scoped preserved rows',()=>{
 const time='2026-10-17T13:00:00.000Z';
 const saved=normalizePolledArchive([
   {message_id:7,sent_at:time,text_content:'captured',direction:'incoming',
    deleted_at:time,media_type:'photo',media_file_id:'private-reference'},
   {message_id:'not number',text_content:'invalid'},
 ]);
 assert.equal(saved.length,1);
 assert.equal(saved[0].deleted,true);
 assert.equal(saved[0].text,'captured');
 assert.equal(saved[0].mediaAvailable,true);
 assert.deepEqual(normalizePolledArchive(null),[]);
 const merged=combineLiveAndPreserved([
   {id:8, text:'still live',date:time,out:false},
 ],saved);
 assert.equal(merged.length,2);
 assert.equal(merged[0].id,7);
 assert.equal(merged[0].preservedOnly,true);
 assert.equal(merged[0].deleted,true);
 assert.equal(merged[1].deleted,undefined);
 // No historic archive means nobody can claim a missing message was deleted.
 assert.equal(combineLiveAndPreserved([{id:8,text:'live'}],[])[0].deleted,undefined);
});

test('background sync never touches global storage, respects foreground and ownership',()=>{
 const ui=read('public/telegram-chats.js');
 const html=read('public/studio.html');
 const css=read('public/app.css');
 assert.match(ui,/threadCache:new Map\(\)/);
 assert.match(ui,/state\.threadCache\.clear\(\)/);
 assert.match(ui,/while\(state\.threadCache\.size>4\)/);
 assert.match(ui,/Date\.now\(\)-value\.at>90000/);
 assert.match(ui,/scheduleThreadSync\(ms=26000\)/);
 assert.match(ui,/!document\.hidden/);
 assert.match(ui,/!state\.thread\.archiveOnly/);
 assert.match(ui,/navigator\.onLine!==false/);
 assert.match(ui,/ownerKey!==state\.ownerInitData/);
 assert.match(ui,/generation!==state\.threadGeneration/);
 assert.match(ui,/if\(document\.hidden\)stopThreadSync\(\)/);
 assert.match(ui,/window\.addEventListener\('offline'/);
 assert.match(ui,/data\.messages\|\|\[\]/);
 assert.match(ui,/old\.deleted\|\|msg\.deleted/);
 assert.match(ui,/absen(?:ce|t) alone is never treated as a deletion/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|indexedDB/i);
 for(const id of ['telegramThreadSyncStatus','telegramThreadSyncNow','telegramThreadSyncDot']){
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(css,/veto-mirror-sync-strip/);
 assert.match(html,/veto-active-sync-v1/);
});
