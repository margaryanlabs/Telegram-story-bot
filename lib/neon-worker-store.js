const workerOps=new Set(['save_backup_job','list_backup_jobs','pause_backup_job','claim_backup_jobs',
 'complete_backup_job','get_automation_settings','update_automation_settings',
 'list_automation_jobs','claim_automation_jobs','complete_automation_job','acquire_watch_lease']);
export const isWorkerOperation=op=>workerOps.has(op);
const defaults={security_changes:true,smart_action:false,watch_changes:false,confirmed_viewer:false};
const clamped=(v,min,max)=>Math.max(min,Math.min(max,Math.floor(Number(v)||min)));
const id=v=>{if(!/^\d{1,20}$/.test(String(v)))throw Error('INVALID_TELEGRAM_ID');return String(v)};
const jobEvent=r=>({type:r.event_type,occurredAt:r.occurred_at,
 storyId:r.story_id==null?null:Number(r.story_id),chatId:r.chat_id==null?null:String(r.chat_id),
 actorUsername:r.actor_username||null,actorDisplayName:r.actor_display_name||null,payload:r.payload||{}});
export async function neonWorkerOperation(op,a,{query,one}){
 const u=()=>id(a.userId);
 switch(op){
 case 'save_backup_job':{
  if(a.consent!==true)throw Error('EXPLICIT_BACKUP_CONSENT_REQUIRED');
  const user=u(),chat=id(a.chatId);
  const session=await one(`SELECT telegram_account_user_id FROM public.story_pilot_viewer_sessions
   WHERE telegram_user_id=$1::bigint AND status='active'`,[user]);
  if(!session||String(session.telegram_account_user_id)!==user)
   throw Error('OWNED_TELEGRAM_SESSION_REQUIRED');
  const privacy=await one(`SELECT ghost_inbox FROM public.story_pilot_privacy_settings
   WHERE telegram_user_id=$1::bigint`,[user]);
  if(!privacy?.ghost_inbox)throw Error('ENABLE_INBOX_BEFORE_BACKUP');
  return one(`INSERT INTO public.story_pilot_backup_jobs
   (telegram_user_id,chat_id,chat_title,enabled,media_enabled,notify_completion,state,
   next_run_at,lease_until,updated_at)
   VALUES($1::bigint,$2::bigint,$3,true,$4,$5,'active',now(),now(),now())
   ON CONFLICT(telegram_user_id,chat_id) DO UPDATE SET chat_title=excluded.chat_title,
   enabled=true,media_enabled=excluded.media_enabled,notify_completion=excluded.notify_completion,
   state='active',last_error=null,completed_at=null,next_run_at=now(),lease_until=now(),updated_at=now()
   RETURNING chat_id,state,enabled,media_enabled,notify_completion,total_read,total_saved,total_media,
   offset_id,updated_at`,[user,chat,String(a.chatTitle||'').slice(0,120),
     a.mediaEnabled===true,a.notifyCompletion!==false]);
 }
 case 'list_backup_jobs':
  return query(`SELECT chat_id,chat_title,enabled,media_enabled,notify_completion,state,
   offset_id,total_read,total_saved,total_media,updated_at,last_error,completed_at
   FROM public.story_pilot_backup_jobs WHERE telegram_user_id=$1::bigint
   ORDER BY updated_at DESC LIMIT 60`,[u()]);
 case 'pause_backup_job':
  return one(`UPDATE public.story_pilot_backup_jobs SET enabled=false,state='paused',updated_at=now()
   WHERE telegram_user_id=$1::bigint AND chat_id=$2::bigint RETURNING chat_id,state,enabled`,
   [u(),id(a.chatId)]);
 case 'claim_backup_jobs':
  return query(`WITH picked AS (
   SELECT telegram_user_id,chat_id FROM public.story_pilot_backup_jobs WHERE enabled=true
    AND state='active' AND next_run_at<=now() AND lease_until<=now()
   ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT $1)
   UPDATE public.story_pilot_backup_jobs b SET lease_until=now()+interval '115 seconds',
     next_run_at=now()+interval '5 minutes',updated_at=now()
   FROM picked p WHERE b.telegram_user_id=p.telegram_user_id AND b.chat_id=p.chat_id
   RETURNING b.telegram_user_id,b.chat_id,b.chat_title,b.offset_id,b.media_enabled,b.notify_completion`,
   [clamped(a.limit,1,3)]);
 case 'complete_backup_job':{
  const user=u(),chat=id(a.chatId),error=String(a.error||'').slice(0,150);
  const current=await one(`SELECT * FROM public.story_pilot_backup_jobs
   WHERE telegram_user_id=$1::bigint AND chat_id=$2::bigint`,[user,chat]);
  if(!current||!current.enabled||current.state!=='active')return {status:'paused'};
  const cursor=clamped(a.nextOffsetId??0,0,2147483647);
  if(a.complete!==true&&!error&&Number(current.offset_id)>0&&cursor>=Number(current.offset_id))
    return {status:'stale'};
  return one(`UPDATE public.story_pilot_backup_jobs SET
   total_read=total_read+$3,total_saved=total_saved+$4,total_media=total_media+$5,
   lease_until=now(),last_error=$6,offset_id=CASE WHEN $6::text<>'' THEN offset_id
    WHEN $7::boolean THEN 0 ELSE $8::bigint END,
   state=CASE WHEN $6::text<>'' THEN state WHEN $7::boolean THEN 'done' ELSE 'active' END,
   enabled=CASE WHEN $6::text<>'' THEN enabled ELSE NOT $7::boolean END,
   completed_at=CASE WHEN $7::boolean AND $6::text='' THEN now() ELSE completed_at END,
   next_run_at=CASE WHEN $6::text<>'' THEN now()+interval '15 minutes' ELSE now() END,
   updated_at=now() WHERE telegram_user_id=$1::bigint AND chat_id=$2::bigint
   AND enabled=true AND state='active'
   RETURNING state,enabled,offset_id,total_read,total_saved,total_media,notify_completion,chat_title`,
   [user,chat,clamped(a.read,0,45),clamped(a.saved,0,45),
    clamped(a.mediaSaved,0,2),error,a.complete===true,cursor])||{status:'paused'};
 }
 case 'get_automation_settings':{
  const rows=await query(`SELECT rule_key,enabled,updated_at
   FROM public.story_pilot_automation_rules WHERE telegram_user_id=$1::bigint`,[u()]);
  return {rules:Object.fromEntries(Object.entries(defaults).map(([key,enabled])=>{
   const r=rows.find(r=>r.rule_key===key);
   return [key,{enabled:r?!!r.enabled:enabled,source:r?'user':'default',
    updatedAt:r?.updated_at||null}]}))};
 }
 case 'update_automation_settings':{
  const values=Object.entries(a.rules||{});
  for(const [key,setting] of values){
   if(!(key in defaults))throw Error('INVALID_AUTOMATION_RULE');
   await query(`INSERT INTO public.story_pilot_automation_rules
    (telegram_user_id,rule_key,enabled,updated_at) VALUES($1::bigint,$2,$3,now())
    ON CONFLICT(telegram_user_id,rule_key) DO UPDATE SET
    enabled=excluded.enabled,updated_at=excluded.updated_at`,
    [u(),key,typeof setting==='object'&&setting!==null?!!setting.enabled:!!setting]);
  }
  return neonWorkerOperation('get_automation_settings',{userId:u()},{query,one});
 }
 case 'list_automation_jobs':{
  const rows=await query(`SELECT j.*,e.event_type,e.occurred_at,e.story_id,e.chat_id,
    e.actor_username,e.actor_display_name,e.payload
    FROM public.story_pilot_automation_jobs j JOIN public.story_pilot_events e
     ON j.event_id=e.id WHERE j.telegram_user_id=$1::bigint
    ORDER BY j.created_at DESC LIMIT $2`,[u(),clamped(a.limit,1,50)]);
  return rows.map(r=>({id:String(r.id),ruleKey:r.rule_key,status:r.status,
   attempts:Number(r.attempts||0),createdAt:r.created_at,sentAt:r.sent_at,
   lastError:r.last_error,event:jobEvent(r)}));
 }
 case 'claim_automation_jobs':{
  const rows=await query(`WITH picked AS (
   SELECT id FROM public.story_pilot_automation_jobs WHERE attempts<5 AND
   ((status IN ('queued','failed') AND available_at<=now()) OR
    (status='sending' AND locked_at<now()-interval '5 minutes'))
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1),
   updated AS (UPDATE public.story_pilot_automation_jobs j
    SET status='sending',attempts=j.attempts+1,locked_at=now(),updated_at=now()
    FROM picked WHERE j.id=picked.id RETURNING j.*)
   SELECT u.*,e.event_type,e.occurred_at,e.story_id,e.chat_id,
    e.actor_username,e.actor_display_name,e.payload
   FROM updated u JOIN public.story_pilot_events e ON e.id=u.event_id
   ORDER BY u.created_at ASC`,[clamped(a.limit,1,25)]);
  return rows.map(r=>({id:String(r.id),userId:String(r.telegram_user_id),
   eventId:String(r.event_id),ruleKey:r.rule_key,attempts:Number(r.attempts||0),
   event:jobEvent(r)}));
 }
 case 'complete_automation_job': {
  if(!/^[0-9a-f-]{36}$/i.test(String(a.jobId||'')))throw Error('INVALID_AUTOMATION_JOB_ID');
  return one(`UPDATE public.story_pilot_automation_jobs SET
   status=CASE WHEN $2::boolean THEN 'sent' ELSE 'failed' END,
   sent_at=CASE WHEN $2::boolean THEN now() ELSE sent_at END,
   last_error=CASE WHEN $2::boolean THEN null ELSE $3 END,
   available_at=CASE WHEN $2::boolean THEN available_at
   ELSE now()+least(30,greatest(1,attempts*attempts))*interval '1 minute' END,
   locked_at=null,updated_at=now() WHERE id=$1::uuid
   RETURNING id,status,attempts,sent_at,available_at`,
   [a.jobId,!!a.success,String(a.error||'').slice(0,500)||null]);
 }
 case 'acquire_watch_lease': {
  const r=await one(`INSERT INTO public.story_pilot_worker_leases
   (name,locked_until) VALUES('viewer-watch',now()+$1::integer*interval '1 second')
   ON CONFLICT(name) DO UPDATE SET
     locked_until=excluded.locked_until,updated_at=now()
   WHERE public.story_pilot_worker_leases.locked_until<=now() RETURNING name`,
   [clamped(a.seconds,10,300)]);
  return !!r;
 }
 default:throw Error('NEON_WORKER_OPERATION_NOT_MIGRATED:'+op);
 }
}
