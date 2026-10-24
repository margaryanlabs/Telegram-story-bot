import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateReminderInput,reminderBelongsToActiveTask,reminderSchedulingConfigured}
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
  const justDue=now+1800000;
  assert.equal(reminderBelongsToActiveTask(task,reminder,justDue),true);
  assert.equal(reminderBelongsToActiveTask(null,reminder,justDue),false);
  assert.equal(reminderBelongsToActiveTask({...task,status:'done'},reminder,justDue),false);
  assert.equal(reminderBelongsToActiveTask({...task,status:'deferred'},reminder,justDue),false);
  assert.equal(reminderBelongsToActiveTask({...task,dueAt:iso(7200000)},reminder,justDue),false);
  assert.equal(reminderBelongsToActiveTask(task,{...reminder,taskId:'other'},justDue),false);
  assert.equal(reminderBelongsToActiveTask(task,{...reminder,remindAt:iso(7200000)},justDue),false);
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
  assert.match(worker,/reminderSchedulingConfigured/);
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

test('cancel-all action is owner-scoped, consent-gated and atomic with worker claim',()=>{
  const api=source('api/vetogram-reminders.js');
  const store=source('lib/vetogram-reminder-store.js');
  const ui=source('public/vetogram-ai.js');
  const html=source('public/studio.html');
  assert.match(api,/!\['list','schedule','cancel','cancel_all'\]\.includes\(body\.action\)/);
  assert.match(api,/body\.action==='cancel_all'/);
  assert.match(api,/x-vetogram-reminder-consent/);
  assert.match(store,/export async function cancelAllOwnerPendingReminders/);
  assert.match(store,/WHERE owner_id=\$1::bigint AND state='pending' RETURNING task_id/);
  assert.match(store,/claimedMayStillSend:true/);
  assert.match(ui,/action:'cancel_all'/);
  assert.match(ui,/vtaiReminderCancelAll'\)\.addEventListener/);
  assert.match(ui,/Уже начатые отправки могли продолжиться/);
  assert.match(html,/id="vtaiReminderCancelAll"/);
  assert.match(ui,/const pendingReminder=state\.reminders\.some/);
  assert.match(ui,/Есть ожидающее серверное напоминание/);
  assert.match(ui,/Изменения задачи требуют ручного облачного сохранения/);

});

test('reminder worker ignores missed/late deadlines instead of unexpected catch-up messages',()=>{
  const reminder={taskId,remindAt:iso(30*60000),dueAt:iso(90*60000)};
  const task={id:taskId,status:'open',dueAt:reminder.dueAt};
  assert.equal(reminderBelongsToActiveTask(task,reminder,now+31*60000),true);
  assert.equal(reminderBelongsToActiveTask(task,reminder,now+29*60000),false);
  assert.equal(reminderBelongsToActiveTask(task,reminder,now+90*60000),true);
  assert.equal(reminderBelongsToActiveTask(task,reminder,now+101*60000),false);
  const sql=source('migrations/vetogram-reminders-20261024.sql');
  const store=source('lib/vetogram-reminder-store.js');
  assert.match(sql,/r\.remind_at>=now\(\)-interval '1 hour'/);
  assert.match(store,/remind_at<now\(\)-interval '1 hour'/);
});

test('worker deadline grace and one-hour lateness limits are independently enforced',()=>{
  const start=Date.parse('2026-10-24T12:00:00.000Z');
  const at=m=>new Date(start+m*60000).toISOString();
  const early={taskId,remindAt:at(30),dueAt:at(90)};
  const lateDue={taskId,remindAt:at(90),dueAt:at(90)};
  const active=reminder=>({id:taskId,status:'open',dueAt:reminder.dueAt});
  assert.equal(reminderBelongsToActiveTask(active(early),early,start+31*60000),true);
  assert.equal(reminderBelongsToActiveTask(active(early),early,start+91*60000),false);
  assert.equal(reminderBelongsToActiveTask(active(lateDue),lateDue,start+100*60000),true);
  assert.equal(reminderBelongsToActiveTask(active(lateDue),lateDue,start+101*60000),false);
  const ui=source('public/vetogram-ai.js');
  assert.match(ui,/function taskReminderEditAllowed\(taskId\)/);
  assert.match(ui,/Сначала отмени его в VETO Reminders/);
  assert.ok((ui.match(/taskReminderEditAllowed\(task\.id\)/g)||[]).length>=4);
  assert.ok((ui.match(/renderReminders\(\);renderTasks\(\)/g)||[]).length>=2);
});

test('no new reminders until operator configures worker AND scheduler',()=>{
  const on={VETOGRAM_REMINDERS_ENABLED:'true',
    VETOGRAM_REMINDERS_WORKER_ENABLED:'true',
    VETOGRAM_REMINDERS_SCHEDULER_READY:'true'};
  assert.equal(reminderSchedulingConfigured(on),true);
  for(const flag of Object.keys(on)){
    assert.equal(reminderSchedulingConfigured({...on,[flag]:'false'}),false,flag);
    assert.equal(reminderSchedulingConfigured({...on,[flag]:undefined}),false,flag);
  }
  const api=source('api/vetogram-reminders.js');
  const worker=source('api/vetogram-reminder-worker.js');
  const ui=source('public/vetogram-ai.js');
  assert.match(api,/schedulingConfigured:reminderSchedulingConfigured\(\)/);
  assert.match(api,/if\(!reminderSchedulingConfigured\(\)\)return respond\(res,503/);
  assert.match(api,/cancelOwnerReminder\(owner.id,body.taskId\)/);
  assert.match(api,/cancelAllOwnerPendingReminders\(owner.id\)/);
  assert.match(worker,/if\(!reminderSchedulingConfigured\(\)\)/);
  assert.match(ui,/state.reminderSchedulingConfigured=result.schedulingConfigured===true/);
  assert.match(ui,/state.reminderSchedulingConfigured!==true/);
  assert.match(ui,/Просмотр и отмена остаются доступны/);
  assert.doesNotMatch(ui,/только в этом окне, без уведомлений/);
  assert.match(ui,/result.schedulingConfigured===true;renderReminders\(\);renderTasks\(\)/);
});

test('reminder scheduling validates cloud revision inside the owner lock',()=>{
  const migration=source('migrations/vetogram-reminders-20261024.sql');
  const store=source('lib/vetogram-reminder-store.js');
  const api=source('api/vetogram-reminders.js');
  assert.match(store,/snapshot\.revision/);
  assert.match(store,/\$6::integer\) AS status/);
  assert.match(migration,/p_cloud_revision integer/);
  const schedule=migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.vetogram_schedule_reminder'));
  const lock=schedule.indexOf("pg_advisory_xact_lock(hashtext('veto-reminders:'");
  const check=schedule.indexOf('SELECT revision INTO cloud_revision');
  const mutation=schedule.indexOf('INSERT INTO public.vetogram_reminders');
  assert.ok(lock>=0&&check>lock&&mutation>check);
  assert.match(schedule,/VETO_REMINDER_TASK_REVISION_CONFLICT/);
  assert.match(schedule,/encrypted_snapshot IS NOT NULL/);
  assert.match(api,/VETO_REMINDER_TASK_REVISION_CONFLICT/);
});

test('expired pending reminders reconcile without sends and release task write blockage',()=>{
  const sql=source('migrations/vetogram-reminders-20261024.sql');
  const store=source('lib/vetogram-reminder-store.js');
  const fn=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.vetogram_expire_owner_reminders'),
    sql.indexOf('CREATE OR REPLACE FUNCTION public.vetogram_task_cloud_write'));
  assert.match(fn,/WHERE owner_id=p_owner AND state='pending'/);
  assert.match(fn,/remind_at<now\(\)-interval '1 hour'/);
  assert.match(fn,/task_due_at<now\(\)-interval '10 minutes'/);
  assert.match(fn,/REVOKE ALL ON FUNCTION public\.vetogram_expire_owner_reminders/);
  assert.match(sql,/PERFORM public\.vetogram_expire_owner_reminders\(p_owner\)/);
  assert.match(store,/SELECT public\.vetogram_expire_owner_reminders\(\$1::bigint\)/);
  assert.match(store,/task_due_at<now\(\)-interval '10 minutes'/);
  assert.doesNotMatch(fn,/sendMessage|TELEGRAM_BOT_TOKEN|message_text|task_title/);
});

test('owner list puts pending and claimed jobs first even after long reminder history',()=>{
  const store=source('lib/vetogram-reminder-store.js');
  const list=store.slice(store.indexOf('export async function listOwnerReminders'),
    store.indexOf('export async function scheduleOwnerReminder'));
  assert.match(list,/WHERE owner_id=\$1::bigint ORDER BY CASE WHEN state='pending' THEN 0/);
  assert.match(list,/WHEN state='claimed' THEN 1 ELSE 2 END ASC/);
  assert.match(list,/CASE WHEN state='pending' THEN remind_at END ASC NULLS LAST/);
  assert.match(list,/LIMIT 40/);
  assert.match(list,/vetogram_expire_owner_reminders/);
});


test('disposable Postgres CI exercises both cross-device lock orderings',()=>{
  const race=source('scripts/vetogram-task-reminder-race.sh');
  const workflow=source('.github/workflows/vetogram-ai-ci.yml');
  const migration=source('migrations/vetogram-reminders-20261024.sql');
  assert.match(race,/set -euo pipefail/);
  assert.match(race,/PGOPTIONS/);
  assert.match(race,/pg_advisory_xact_lock\(hashtext\('veto-reminders:98760005'\)/);
  assert.match(race,/pg_advisory_xact_lock\(hashtext\('veto-reminders:98760006'\)/);
  assert.match(race,/CI_STALE_REMINDER_ACCEPTED_DURING_CLOUD_EDIT/);
  assert.match(race,/CI_CLOUD_EDIT_ALLOWED_DURING_REMINDER_SCHEDULE/);
  assert.match(race,/CI_CLOUD_REVISION_LOST_AFTER_SCHEDULE_RACE/);
  assert.match(race,/CI_CLOUD_WRITE_BYPASSED_PENDING_REMINDER/);
  assert.match(race,/CI_VALID_REMINDER_LOST_AFTER_WRITE_RACE/);
  assert.match(workflow,/bash -n scripts\/vetogram-task-reminder-race\.sh/);
  assert.match(workflow,/run: bash scripts\/vetogram-task-reminder-race\.sh/);
  assert.match(migration,/VETO_REMINDER_TASK_REVISION_CONFLICT/);
  assert.match(migration,/VETO_TASK_PENDING_REMINDERS/);
  assert.doesNotMatch(race,/api\.telegram\.org|TELEGRAM_BOT_TOKEN|https?:\/\//);
});
