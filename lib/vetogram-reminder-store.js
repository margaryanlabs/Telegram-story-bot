import {neon} from '@neondatabase/serverless';
import {validateReminderInput} from './vetogram-reminder-core.js';
import {loadTaskCloud} from './vetogram-task-cloud-store.js';

function conn(){
  if(process.env.VETOGRAM_REMINDERS_ENABLED!=='true')throw Error('REMINDERS_DISABLED');
  const url=String(process.env.VETO_NEON_DATABASE_URL||'');
  if(!/^postgres(?:ql)?:\/\//.test(url))throw Error('REMINDERS_DATABASE_UNAVAILABLE');
  return neon(url);
}
function ownerId(value){
  const owner=String(value);
  if(!/^\d{1,20}$/.test(owner)||owner==='0')throw Error('REMINDER_OWNER_INVALID');
  return owner;
}
const toPublic=row=>({taskId:String(row.task_id),
  remindAt:new Date(row.remind_at).toISOString(),
  dueAt:new Date(row.task_due_at).toISOString(),
  timeZone:row.time_zone,status:row.state,
  attemptedAt:row.attempted_at||null,completedAt:row.completed_at||null});
export async function listOwnerReminders(owner){
  const id=ownerId(owner),sql=conn();
  // Read-time reconciliation keeps abandoned expired jobs from blocking tasks.
  await sql.query('SELECT public.vetogram_expire_owner_reminders($1::bigint)',[id]);
  const rows=await sql.query(
    `SELECT task_id,remind_at,task_due_at,time_zone,state,attempted_at,completed_at FROM public.vetogram_reminders WHERE owner_id=$1::bigint ORDER BY CASE WHEN state='pending' THEN 0 WHEN state='claimed' THEN 1 ELSE 2 END ASC, CASE WHEN state='pending' THEN remind_at END ASC NULLS LAST, remind_at DESC LIMIT 40`,
    [id]);
  return {reminders:rows.map(toPublic)};
}
export async function scheduleOwnerReminder(owner,fields){
  const id=ownerId(owner),input=validateReminderInput(fields);
  const snapshot=await loadTaskCloud(id);
  const task=snapshot.tasks.find(t=>t.id===input.taskId);
  if(!task||task.status!=='open'||!task.dueAt)
    throw Error('REMINDER_TASK_NOT_READY');
  if(typeof fields.dueAt!=='string'||fields.dueAt!==task.dueAt)
    throw Error('REMINDER_UNSAVED_TASK_CHANGES');
  if(Date.parse(input.remindAt)>Date.parse(task.dueAt)||
     Date.parse(task.dueAt)<Date.now()+120000)throw Error('REMINDER_AFTER_TASK_DUE');
  const rows=await conn().query(
    'SELECT public.vetogram_schedule_reminder($1::bigint,$2::uuid,$3::timestamptz,$4::timestamptz,$5::text,$6::integer) AS status',
    [id,input.taskId,input.remindAt,task.dueAt,input.timeZone,snapshot.revision]);
  if(rows[0]?.status!=='pending')throw Error('REMINDER_SCHEDULE_FAILED');
  return {scheduled:true,taskId:input.taskId,remindAt:input.remindAt,
    dueAt:task.dueAt,timeZone:input.timeZone,status:'pending'};
}
export async function cancelOwnerReminder(owner,taskId){
  const id=ownerId(owner);
  if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(String(taskId||'')))
    throw Error('REMINDER_TASK_INVALID');
  const rows=await conn().query(
    "UPDATE public.vetogram_reminders SET state='canceled',enabled_by_owner=false,updated_at=now(),completed_at=now() WHERE owner_id=$1::bigint AND task_id=$2::uuid AND state='pending' RETURNING task_id",
    [id,taskId]);
  return {canceled:rows.length===1};
}
// Owner's explicit emergency bulk cancellation. This updates only pending
// reminders, so an already claimed network attempt cannot be falsely revoked.
// A single SQL statement is atomic against claim_due() row locks.
export async function cancelAllOwnerPendingReminders(owner){
  const id=ownerId(owner);
  const rows=await conn().query(
    "UPDATE public.vetogram_reminders SET state='canceled',enabled_by_owner=false,updated_at=now(),completed_at=now() WHERE owner_id=$1::bigint AND state='pending' RETURNING task_id",
    [id]);
  return {canceledCount:rows.length,claimedMayStillSend:true};
}
export async function claimDueReminders(){
  const sql=conn();
  await sql.query(
    "UPDATE public.vetogram_reminders SET state='skipped',completed_at=now(),updated_at=now() WHERE state='pending' AND (remind_at<now()-interval '1 hour' OR task_due_at<now()-interval '10 minutes')");
  return sql.query('SELECT * FROM public.vetogram_claim_reminders($1::integer)',[8]);
}
export async function completeReminderAttempt(owner,taskId,attemptId,status){
  const id=ownerId(owner);
  if(!['sent','failed','skipped'].includes(status))throw Error('REMINDER_STATUS_INVALID');
  if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[0-9a-f]{12}$/i.test(String(attemptId)))
    throw Error('REMINDER_ATTEMPT_INVALID');
  const rows=await conn().query(
    "UPDATE public.vetogram_reminders SET state=$4,completed_at=now(),updated_at=now() WHERE owner_id=$1::bigint AND task_id=$2::uuid AND attempt_id=$3::uuid AND state='claimed' RETURNING task_id",
    [id,taskId,attemptId,status]);
  return rows.length===1;
}
