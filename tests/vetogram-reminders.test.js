import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateReminderInput,reminderBelongsToActiveTask}
  from '../lib/vetogram-reminder-core.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const taskId='12345678-1234-4123-8123-123456789012';
const now=Date.parse('2026-10-24T12:00:00.000Z');
const iso=offset=>new Date(now+offset).toISOString();

test('explicit reminder requires task UUID, time window, and valid IANA time zone',()=>{
  const data=validateReminderInput({taskId,remindAt:iso(60*60000),
    timeZone:'Asia/Yerevan'},now);
  assert.equal(data.timeZone,'Asia/Yerevan');
  for(const raw of [
    {taskId:'not-a-task',remindAt:iso(60*60000),timeZone:'Asia/Yerevan'},
    {taskId,remindAt:iso(60000),timeZone:'Asia/Yerevan'},
    {taskId,remindAt:iso(370*86400000),timeZone:'Asia/Yerevan'},
    {taskId,remindAt:'tomorrow',timeZone:'Asia/Yerevan'},
    {taskId,remindAt:iso(3600000),timeZone:'Not/A_Real_Zone'}
  ])assert.throws(()=>validateReminderInput(raw,now),/REMINDER_/);
});
test('due-time task recheck prevents reminders after deletion, completion or edits',()=>{
  const reminder={taskId,remindAt:iso(1800000),dueAt:iso(3600000)};
  const task={id:taskId,status:'open',dueAt:reminder.dueAt};
  assert.equal(reminderBelongsToActiveTask(task,reminder),true);
  assert.equal(reminderBelongsToActiveTask(null,reminder),false);
  assert.equal(reminderBelongsToActiveTask({...task,status:'done'},reminder),false);
  assert.equal(reminderBelongsToActiveTask({...task,status:'deferred'},reminder),false);
  assert.equal(reminderBelongsToActiveTask({...task,dueAt:iso(7200000)},reminder),false);
  assert.equal(reminderBelongsToActiveTask(task,{...reminder,taskId:'other'}),false);
  assert.equal(reminderBelongsToActiveTask(task,{...reminder,remindAt:iso(7200000)}),false);
});
test('owner API blocks unsigned access and requires separate scheduling consent',()=>{
  const api=source('api/vetogram-reminders.js');
  const store=source('lib/vetogram-reminder-store.js');
  const router=source('api/router.js');
  assert.match(api,/validateTelegramMiniApp/);
  assert.match(api,/x-vetogram-reminder-consent/);
  assert.match(api,/VETOGRAM_REMINDERS_ENABLED!=='true'/);
  assert.match(api,/private, no-store/);
  assert.match(store,/loadTaskCloud\(id\)/);
  assert.match(store,/task\.status!=='open'/);
  assert.match(store,/fields\.dueAt!==task\.dueAt/);
  assert.match(api,/REMINDER_UNSAVED_TASK_CHANGES/);
  assert.match(store,/public\.vetogram_schedule_reminder/);
  assert.match(store,/WHERE owner_id=\$1::bigint AND task_id=\$2::uuid AND state='pending'/);
  assert.match(router,/"vetogram-reminders"/);
  assert.match(router,/"vetogram-reminder-worker"/);
});
test('queue is metadata-only, at-most-once claim, and no insecure cron paths',()=>{
  const migration=source('migrations/vetogram-reminders-20261024.sql');
  const store=source('lib/vetogram-reminder-store.js');
  const worker=source('api/vetogram-reminder-worker.js');
  assert.match(migration,/FOR UPDATE SKIP LOCKED/);
  assert.match(migration,/state='claimed'/);
  assert.match(migration,/REVOKE ALL ON TABLE public\.vetogram_reminders FROM PUBLIC/);
  assert.match(migration,/attempt_id uuid/);
  assert.match(store,/AND attempt_id=\$3::uuid AND state='claimed'/);
  assert.doesNotMatch(migration,/CREATE TABLE[^;]*(?:message_text|source_quote|task_title|prompt_text)/i);
  assert.match(worker,/neonCronAuthorized/);
  assert.match(worker,/VETOGRAM_REMINDERS_WORKER_ENABLED!=='true'/);
  assert.match(worker,/loadTaskCloud\(owner\)/);
  assert.match(worker,/reminderBelongsToActiveTask/);
  assert.match(worker,/generic self-notification/);
  assert.doesNotMatch(worker,/retry|setInterval|chatTitle|messageBody|task\.title/);
});
test('VETO Task Center reminders UI uses explicit owner confirmation and no background scheduling',()=>{
  const js=source('public/vetogram-ai.js'),html=source('public/studio.html');
  for(const name of ['vtaiReminderCount','vtaiReminderRefresh','vtaiReminderStatus',
    'vtaiReminderList','vtaiRemindersPanel'])
    assert.ok(html.includes('id="'+name+'"'),'Missing UI id: '+name);
  assert.match(js,/window\.confirm\('Создать одноразовое Telegram-напоминание/);
  assert.match(js,/x-vetogram-reminder-consent/);
  assert.match(js,/state\.reminders=\[\];state\.reminderBusy=false/);
  assert.match(js,/state\.taskCloudRevision<1/);
  assert.match(js,/scheduleReminder\(task,Number\(lead\.value\)\)/);
  assert.match(js,/cancelReminder\(item\.taskId\)/);
  assert.doesNotMatch(js,/setInterval|localStorage|sessionStorage/);
});
