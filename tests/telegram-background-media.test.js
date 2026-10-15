import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeBackupMessage,fetchBackupPage,HISTORY_MEDIA_LIMIT_BYTES} from '../lib/telegram-history-backup.js';
import {archiveHistoryMedia} from '../lib/telegram-history-media.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('Telegram historical media metadata is limited and never falsifies Bot file IDs',()=>{
  const dialog={id:123456n,title:'friend',entity:{id:123456n,firstName:'friend'}};
  const m={id:9,date:Math.floor(Date.now()/1000),className:'Message',message:'',photo:{},out:false};
  const row=normalizeBackupMessage('500',dialog,m,Date.now()-86400000);
  assert.equal(row.media_type,'photo');
  assert.equal(row.media_mime_type,'image/jpeg');
  assert.equal(row.media_file_id,null);
  assert.equal(HISTORY_MEDIA_LIMIT_BYTES,5242880);
});

test('Background job enrollment is explicit, per-chat, and authenticated against linked owner',()=>{
  const api=read('api/privacy-backup.js');
  assert.ok(api.includes('body.backgroundConsent !== true'));
  assert.ok(api.includes('String(session.telegram_account_user_id || \'\') !== userId'));
  assert.ok(api.includes("dialogs.find(c=>String(c.chatId)===chatId)"));
  assert.ok(api.includes("background_pause"));
  assert.ok(api.includes('body.mediaEnabled === true'));
  const ui=read('public/privacy.js');
  assert.ok(ui.includes('backupBackground'));
  assert.ok(ui.includes('background_enable'));
  assert.ok(ui.includes('background_pause'));
  assert.ok(ui.includes('backupMedia'));
});

test('Server accepts only server-signed background worker and limits two chat jobs per call',()=>{
  const worker=read('api/privacy-backup-worker.js');
  assert.ok(worker.includes('verifyEdgeSignature'));
  assert.ok(worker.includes('maxAgeMs:120000'));
  assert.ok(worker.includes('const MAX_JOBS=2'));
  assert.ok(worker.includes('claimBackupJobs(MAX_JOBS)'));
  assert.ok(worker.includes('getViewerSession(userId)'));
  assert.ok(worker.includes('String(session.telegram_account_user_id)!==userId'));
  assert.ok(worker.includes('archiveHistoryMedia('));
  assert.ok(worker.includes('notifyCompleted('));
});

test('Scheduled trigger signs requests with existing server private seed and does not share key',()=>{
  const trigger=read('supabase/functions/story-pilot-backup-trigger/index.ts');
  assert.ok(trigger.includes("viewer_watch_signing_seed"));
  assert.ok(trigger.includes('nacl.sign.detached'));
  assert.ok(trigger.includes('api/privacy-backup-worker'));
  assert.ok(trigger.includes('EdgeRuntime.waitUntil'));
});

test('Background jobs are locked-down per user and chat with renewable lease',()=>{
  const sql=read('supabase/migrations/20261015_story_pilot_optin_backup_jobs.sql');
  const store=read('supabase/functions/story-pilot-store/index.ts');
  assert.ok(sql.includes('primary key (telegram_user_id,chat_id)'));
  assert.ok(sql.includes('enable row level security'));
  assert.ok(sql.includes('revoke all on public.story_pilot_backup_jobs from public, anon, authenticated'));
  assert.ok(store.includes('explicit_backup_consent_required'));
  assert.ok(store.includes('async function opClaimBackupJobs'));
  assert.ok(store.includes('.lte("lease_until",stamp)'));
  assert.ok(store.includes('case "pause_backup_job"'));
});

test('Private history media download accepts small buffers but never sends media to Mini App',()=>{
  const media=read('lib/telegram-history-media.js');
  const api=read('api/privacy-backup.js');
  assert.ok(media.includes('client.downloadMedia(message'));
  assert.ok(media.includes('HISTORY_MEDIA_LIMIT_BYTES'));
  assert.ok(media.includes('HISTORY_MEDIA_PER_PAGE'));
  assert.ok(media.includes('createHistoryMediaUpload('));
  assert.ok(media.includes('finalizeHistoryMediaUpload('));
  assert.ok(media.includes("url.hostname!=='xvtmgzzaomolnvkcgosk.supabase.co'"));
  assert.ok(!api.includes('signedUrl:ticket.signedUrl'));
  assert.ok(api.includes("includeMedia = body.includeMedia === true"));
});

test('Dense media chats are split before third attachment, so none silently disappear',async()=>{
 const dialog={id:777n,isUser:true,title:'Private',entity:{id:777n,firstName:'Private'}};
 const messages=Array.from({length:45},(_,i)=>({
   id:100-i,date:Math.floor(Date.now()/1000),className:'Message',
   photo:{},message:'',out:false,
 }));
 const client={
   async getDialogs(){return[dialog];},
   async getMessages(peer,{offsetId}){
     assert.equal(peer,dialog.entity);
     return offsetId ? messages.filter(m=>m.id < offsetId) : messages;
   },
 };
 const one=await fetchBackupPage(client,{
   ownerId:'500',chatId:'777',retentionDays:30,mediaEnabled:true,
 });
 assert.equal(one.fetched,2);
 assert.equal(one.eligible,2);
 assert.equal(one.mediaCandidates.length,2);
 assert.equal(one.hasMore,true);
 assert.equal(one.nextOffsetId,99);
 const two=await fetchBackupPage(client,{
   ownerId:'500',chatId:'777',retentionDays:30,mediaEnabled:true,offsetId:99,
 });
 assert.equal(two.rows[0].message_id,98);
 assert.equal(two.fetched,2);
 assert.equal(two.hasMore,true);
});
