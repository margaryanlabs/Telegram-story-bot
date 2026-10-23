import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {taskCloudSnapshot,taskCloudRevision} from '../lib/vetogram-task-cloud-core.js';
import {encryptTaskCloud,decryptTaskCloud,taskEncryptionReady} from '../lib/vetogram-task-cloud-crypto.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sample=()=>({id:'12345678-1234-4123-8123-123456789012',
  title:'Подтвердить встречу',kind:'meeting',
  sourceQuote:'Подтверди встречу в пятницу',deadlineText:'в пятницу',
  certainty:'explicit',createdAt:1234,status:'open',dueAt:null});

test('Cloud snapshot allows at most 24 owner-bound tasks, never plaintext owner ID in payload',()=>{
  const value=taskCloudSnapshot('123',[sample()]);
  assert.equal(value.length,1);
  assert.deepEqual(Object.keys(value[0]),['id','title','kind','sourceQuote',
    'deadlineText','certainty','createdAt','status','dueAt']);
  assert.equal(Object.hasOwn(value[0],'owner'),false);
  assert.throws(()=>taskCloudSnapshot('123',Array(25).fill(sample())),/TASK_CLOUD_COUNT_INVALID/);
  assert.throws(()=>taskCloudSnapshot('0',[]),/TASK_CLOUD_OWNER_INVALID/);
  assert.throws(()=>taskCloudSnapshot('123',[sample(),sample()]),/TASK_CLOUD_DUPLICATE/);
  assert.throws(()=>taskCloudSnapshot('123',[{...sample(),sourceQuote:'short'}]),/TASK_CLOUD_ITEM_INVALID/);
  assert.equal(taskCloudRevision(0),0);
  assert.throws(()=>taskCloudRevision(-1),/TASK_CLOUD_REVISION_INVALID/);
});
test('Task AES-256-GCM requires its own server-only key and authenticates owner/tampering',()=>{
  const original=process.env.VETOGRAM_TASKS_KEY;
  try{
    delete process.env.VETOGRAM_TASKS_KEY;
    assert.equal(taskEncryptionReady(),false);
    assert.throws(()=>encryptTaskCloud('123',[sample()]),/TASK_CLOUD_KEY_UNAVAILABLE/);
    process.env.VETOGRAM_TASKS_KEY='d3'.repeat(32);
    const encoded=taskCloudSnapshot('123',[sample()]);
    const a=encryptTaskCloud('123',encoded),b=encryptTaskCloud('123',encoded);
    assert.notEqual(a,b); // fresh random nonce
    assert.deepEqual(decryptTaskCloud('123',a),encoded);
    assert.throws(()=>decryptTaskCloud('999',a));
    const parts=a.split('.');
    parts[3]=(parts[3].startsWith('A')?'B':'A')+parts[3].slice(1);
    assert.throws(()=>decryptTaskCloud('123',parts.join('.')));
    process.env.VETOGRAM_TASKS_KEY='e4'.repeat(32);
    assert.throws(()=>decryptTaskCloud('123',a),/TASK_CLOUD_KEY_MISMATCH/);
  }finally{
    if(original===undefined)delete process.env.VETOGRAM_TASKS_KEY;
    else process.env.VETOGRAM_TASKS_KEY=original;
  }
});
test('Signed Telegram owner is mandatory and writes require explicit task consent',()=>{
  const api=read('api/vetogram-tasks.js'),route=read('api/router.js'),
    store=read('lib/vetogram-task-cloud-store.js');
  assert.match(api,/validateTelegramMiniApp/);
  assert.match(api,/x-vetogram-tasks-consent/);
  assert.match(api,/VETOGRAM_TASKS_CLOUD_ENABLED/);
  assert.match(api,/private, no-store/);
  assert.match(route,/"vetogram-tasks"/);
  assert.match(store,/public\.vetogram_task_cloud_write/);
  assert.match(store,/\[id,rev,encrypted,false\]/);
  assert.match(store,/TASK_CLOUD_VERSION_CONFLICT/);
  assert.doesNotMatch(api,/sendOwnerMessage|withBackupClient|telegram-send/);
});
test('Deleted task ciphertext leaves version tombstone instead of exposing old tasks',()=>{
  const sql=read('migrations/vetogram-task-cloud-20261023.sql'),
    store=read('lib/vetogram-task-cloud-store.js');
  assert.match(sql,/encrypted_snapshot text/);
  assert.match(sql,/revision integer/);
  assert.match(sql,/REVOKE ALL ON TABLE public\.vetogram_task_cloud FROM PUBLIC/);
  assert.match(store,/\[id,rev,null,true\]/);
  assert.match(read('migrations/vetogram-reminders-20261024.sql'),/encrypted_snapshot=NULL/);
  assert.match(read('migrations/vetogram-reminders-20261024.sql'),/AND encrypted_snapshot IS NOT NULL/);
  assert.match(store,/row\.encrypted_snapshot===null\?\[\]/);
  assert.doesNotMatch(sql,/CREATE TABLE[^;]*(?:task_title|message_text|telegram_session)/i);
});
test('Task cloud frontend never syncs automatically or sends any Telegram messages',()=>{
  const html=read('public/studio.html'),js=read('public/vetogram-ai.js');
  for(const id of ['vtaiTasksCloudLoad','vtaiTasksCloudSave','vtaiTasksCloudErase',
    'vtaiTasksCloudStatus'])assert.ok(html.includes('id="'+id+'"'));
  assert.match(js,/function loadTasksCloud/);
  assert.match(js,/function saveTasksCloud/);
  assert.match(js,/function eraseTasksCloud/);
  assert.match(js,/action:'save',revision:state\.taskCloudRevision,tasks/);
  assert.match(js,/action:'erase',revision:state\.taskCloudRevision/);
  assert.match(js,/x-vetogram-tasks-consent/);
  assert.match(js,/state\.taskCloudRevision=null;state\.taskCloudBusy=false/);
  assert.doesNotMatch(js,/setInterval|localStorage|sessionStorage/);
});

test('Task Cloud writes and reminder scheduling share a safe per-owner lock',()=>{
  const migration=read('migrations/vetogram-reminders-20261024.sql');
  const store=read('lib/vetogram-task-cloud-store.js');
  const api=read('api/vetogram-tasks.js');
  const fn=migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.vetogram_task_cloud_write'),
    migration.indexOf('CREATE OR REPLACE FUNCTION public.vetogram_schedule_reminder'));
  const schedule=migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.vetogram_schedule_reminder'));
  const lock="pg_advisory_xact_lock(hashtext('veto-reminders:'||p_owner::text)::bigint)";
  assert.ok(fn.includes(lock));
  assert.ok(schedule.includes(lock));
  assert.match(fn,/VETO_TASK_PENDING_REMINDERS/);
  assert.match(fn,/state='pending'/);
  assert.match(fn,/VETO_TASK_REVISION_CONFLICT/);
  assert.match(fn,/revision=p_revision/);
  assert.match(store,/vetogram_task_cloud_write/);
  assert.match(api,/VETO_TASK_PENDING_REMINDERS/);
  assert.match(api,/return respond\(res,409/);
  assert.doesNotMatch(migration,/CREATE TABLE[^;]*?(?:task_title|source_quote|message_text)/i);
});

test('task-cloud mutation first expires undeliverably old pending reminder jobs',()=>{
  const sql=read('migrations/vetogram-reminders-20261024.sql');
  const fn=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.vetogram_task_cloud_write'),
    sql.indexOf('CREATE OR REPLACE FUNCTION public.vetogram_schedule_reminder'));
  const sweep=fn.indexOf('PERFORM public.vetogram_expire_owner_reminders(p_owner)');
  const conflict=fn.indexOf('VETO_TASK_PENDING_REMINDERS');
  assert.ok(sweep>0&&conflict>sweep);
  assert.match(fn,/pg_advisory_xact_lock/);
});
