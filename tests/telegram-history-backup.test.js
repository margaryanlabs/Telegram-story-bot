import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listBackupDialogs, normalizeBackupMessage, fetchBackupPage } from '../lib/telegram-history-backup.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const owner='123456789';
const peer={id:87654321n,username:'friend',firstName:'Test',lastName:'Contact'};
const dialog={id:87654321n,entity:peer,isUser:true,title:'Test Contact'};
const channel={id:11n,entity:{id:11n},isUser:false,title:'Channel'};
const bot={id:12n,entity:{id:12n,bot:true},isUser:true,title:'Bot'};
const item=(id,date=Math.floor(Date.now()/1000))=>({
 id, date, className:'Message', message:'Привет '+id, out:false,
});
const fakeClient={
 async getDialogs(){return [dialog,channel,bot];},
 async getMessages(entity,{limit,offsetId}) {
  assert.equal(entity,peer);
  assert.ok(limit<=45);
  return offsetId>0?[item(1)]:Array.from({length:45},(_,i)=>item(100-i));
 },
};

test('Private history list never includes bots, channels or secret chats',async()=>{
 const result=await listBackupDialogs(fakeClient);
 assert.equal(result.length,1);
 assert.equal(result[0].chatId,'87654321');
 assert.equal(result[0].title,'Test Contact');
});

test('A user must select an existing accessible private Telegram conversation',async()=>{
 await assert.rejects(fetchBackupPage(fakeClient,{ownerId:owner,chatId:'99999',retentionDays:30}),/не найден/);
 await assert.rejects(fetchBackupPage(fakeClient,{ownerId:owner,chatId:'-1234',retentionDays:30}),/не найден/);
});

test('History is fetched in bounded pages, preserves chat-scoped cursor',async()=>{
 const first=await fetchBackupPage(fakeClient,{ownerId:owner,chatId:'87654321',retentionDays:30});
 assert.equal(first.fetched,45);
 assert.equal(first.eligible,45);
 assert.equal(first.nextOffsetId,56);
 assert.equal(first.hasMore,true);
 const next=await fetchBackupPage(fakeClient,{ownerId:owner,chatId:'87654321',offsetId:56,retentionDays:30});
 assert.equal(next.fetched,1);
 assert.equal(next.hasMore,false);
});

test('Expired content is excluded; media is only metadata, never a fake Bot API file ID',()=>{
 const old=item(17,Math.floor(Date.now()/1000)-370*86400);
 assert.equal(normalizeBackupMessage(owner,dialog,old,Date.now()-30*86400000),null);
 const row=normalizeBackupMessage(owner,dialog,{...item(19),photo:{}},Date.now()-30*86400000);
 assert.equal(row.chat_id,'87654321');
 assert.equal(row.direction,'incoming');
 assert.equal(row.media_type,'photo');
 assert.equal(row.media_file_id,null);
 assert.match(row.content_hash,/^[a-f0-9]{64}$/);
});

test('API requires user-owned linked session and explicit per-chat consent',()=>{
 const api=source('api/privacy-backup.js');
 assert.ok(api.includes("String(session.telegram_account_user_id || '') !== userId"));
 assert.ok(api.includes("body.confirm !== true"));
 assert.ok(api.includes("getViewerSession(userId)"));
 assert.ok(api.includes("listBackupDialogs(client)"));
 assert.ok(api.includes("fetchBackupPage(client"));
 assert.ok(!api.includes('list_active_sessions'));
});

test('Database importer is idempotent and preserves previously deleted copies',()=>{
 const edge=source('supabase/functions/story-pilot-store/index.ts');
 assert.ok(edge.includes('async function opImportUserHistoryBatch'));
 assert.ok(edge.includes('ignoreDuplicates: true'));
 assert.ok(edge.includes('onConflict: "telegram_user_id,chat_id,message_id"'));
 assert.ok(edge.includes('if (!settings.ghostInbox)'));
 const importer = edge.split('async function opImportUserHistoryBatch')[1]?.split('async function opCaptureBusinessMessage')[0] || '';
 assert.ok(importer.includes('ignoreDuplicates: true'));
 assert.ok(!importer.includes('do update set'));
});

test('Notification switches, live test alerts and completion notice remain real functions',()=>{
 const ui=source('public/privacy.js'),html=source('public/studio.html');
 const api=source('api/privacy-backup.js'),webhook=source('api/webhook-v7.js');
 assert.ok(html.includes('privacyTestNotificationButton'));
 assert.ok(ui.includes("request('test_alert')"));
 assert.ok(html.includes('privacyNotifyDeletesSwitch'));
 assert.ok(html.includes('privacyNotifyEditsSwitch'));
 assert.ok(webhook.includes('sendGhostDeleteAlert'));
 assert.ok(webhook.includes('sendGhostEditAlert'));
 assert.ok(api.includes('sendBackupNotice(userId,chatId,page.chatTitle,result.inserted)'));
 assert.ok(api.includes('disable_notification:false'));
 assert.ok(api.includes('notifyCompletion !== false'));
});

test('User initiates one chat backup and can load older pages or stop',()=>{
 const html=source('public/studio.html'),ui=source('public/privacy.js');
 assert.ok(html.includes('id="privacyBackupHistoryButton"'));
 assert.ok(ui.includes("backupApi('list_chats')"));
 assert.ok(ui.includes("backupApi('backup_chat'"));
 assert.ok(ui.includes('data-backup-next="1"'));
 assert.ok(ui.includes('backup.totalSaved += Number(data.saved || 0)'));
 assert.ok(ui.includes('privacyState.backup.selected'));
 assert.ok(ui.includes('data-backup-retention-long'));
});

test('A real delete event triggers an alert even when content was not archived',()=>{
 const webhook=source('api/webhook-v7.js');
 assert.ok(webhook.includes('deletedMessageCount = 0'));
 assert.ok(webhook.includes('Telegram сообщил об удалении'));
 assert.ok(webhook.includes('нет ранее сохранённой копии содержания'));
 assert.ok(webhook.includes('deleted.message_ids.length,'));
 assert.ok(!webhook.includes('&& result.events.length\n        ) {'));
});
