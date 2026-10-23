import {neonCronAuthorized} from '../lib/neon-scheduler-auth.js';
import {loadTaskCloud} from '../lib/vetogram-task-cloud-store.js';
import {reminderBelongsToActiveTask,reminderSchedulingConfigured} from '../lib/vetogram-reminder-core.js';
import {claimDueReminders,completeReminderAttempt} from '../lib/vetogram-reminder-store.js';

// generic self-notification only: never put task titles, quotes or contact data in Bot API calls.
export async function deliverGenericReminder(token,owner,fetcher=fetch){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetcher('https://api.telegram.org/bot'+token+'/sendMessage',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({chat_id:owner,
        text:'⏰ VETOGRAM · Напоминание\n\nПора проверить задачу в Task Center. Открой VETOGRAM, чтобы увидеть детали.',
        disable_notification:false}),signal:controller.signal
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok||data?.ok!==true)throw Error('REMINDER_BOT_DELIVERY_FAILED');
    return true;
  }finally{clearTimeout(timeout)}
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST required'});
  if(!reminderSchedulingConfigured())
    return res.status(503).json({ok:false,error:'Reminder worker disabled'});
  if(!neonCronAuthorized(req))return res.status(401).json({ok:false,error:'Unauthorized'});
  const token=String(process.env.TELEGRAM_BOT_TOKEN||'');
  if(!token)return res.status(503).json({ok:false,error:'Telegram bot unconfigured'});
  let claimed=[],sent=0,failed=0,skipped=0;
  try{claimed=await claimDueReminders();}
  catch{return res.status(503).json({ok:false,error:'Reminder queue unavailable'});}
  for(const job of claimed){
    const owner=String(job.owner_id),taskId=String(job.task_id),
      attemptId=String(job.attempt_id);
    let status='failed';
    try{
      const cloud=await loadTaskCloud(owner);
      const task=cloud.tasks.find(t=>t.id===taskId);
      const reminder={taskId,remindAt:new Date(job.remind_at).toISOString(),
        dueAt:new Date(job.task_due_at).toISOString()};
      if(!reminderBelongsToActiveTask(task,reminder))status='skipped';
      else {await deliverGenericReminder(token,owner);status='sent';}
    }catch{status='failed';}
    if(status==='sent')sent++;
    else if(status==='skipped')skipped++;
    else failed++;
    try{await completeReminderAttempt(owner,taskId,attemptId,status)}
    catch{ /* A claimed attempt is never re-sent after an uncertain outcome. */ }
  }
  return res.status(200).json({ok:true,claimed:claimed.length,sent,failed,skipped,
    note:'At most one attempt per one-time reminder; not guaranteed delivery.'});
}
