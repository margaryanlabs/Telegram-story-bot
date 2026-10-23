// One-time VETO Reminders: explicit owner request, no inferred dates or recipients.
export const REMINDER_MAX_DAYS=365;
export function validateReminderInput({taskId,remindAt,timeZone},now=Date.now()){
  const id=String(taskId||''),when=String(remindAt||''),zone=String(timeZone||'');
  if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))
    throw Error('REMINDER_TASK_INVALID');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(when)||
    !Number.isFinite(Date.parse(when))||new Date(when).toISOString()!==when)
    throw Error('REMINDER_TIME_INVALID');
  const epoch=Date.parse(when),base=Number(now);
  if(!Number.isFinite(base)||epoch<base+120000||
    epoch>base+REMINDER_MAX_DAYS*86400000)throw Error('REMINDER_TIME_RANGE');
  if(zone.length<1||zone.length>64||!/^[A-Za-z0-9_+\-\/]+$/.test(zone))
    throw Error('REMINDER_ZONE_INVALID');
  try{new Intl.DateTimeFormat('en',{timeZone:zone});}
  catch{throw Error('REMINDER_ZONE_INVALID')}
  return {taskId:id,remindAt:when,timeZone:zone};
}
// Never send an old catch-up notification far beyond its chosen time.
// A short grace period allows polling/drift without a misleading late alert.
export const REMINDER_MAX_LATENESS_MS=60*60*1000;
export const REMINDER_DUE_GRACE_MS=10*60*1000;
export function reminderBelongsToActiveTask(task,reminder,now=Date.now()){
  return Boolean(task&&reminder&&task.id===reminder.taskId&&
    task.status==='open'&&task.dueAt!==null&&
    typeof task.dueAt==='string'&&task.dueAt===reminder.dueAt&&
    Date.parse(reminder.remindAt)<=Date.parse(task.dueAt)&&
    Number.isFinite(Number(now))&&
    Number(now)>=Date.parse(reminder.remindAt)&&
    Number(now)-Date.parse(reminder.remindAt)<=REMINDER_MAX_LATENESS_MS&&
    Number(now)<=Date.parse(task.dueAt)+REMINDER_DUE_GRACE_MS);
}
