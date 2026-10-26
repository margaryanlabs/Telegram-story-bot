import { neon } from '@neondatabase/serverless';
import { neonCipherReady, neonCipherKeyId, sealNeonJson, openNeonJson } from './neon-private-crypto.js';
import { isArchiveOperation, neonArchiveOperation } from './neon-archive-store.js';
import { isStoryOperation, neonStoryOperation } from './neon-story-store.js';
import { isWorkerOperation, neonWorkerOperation } from './neon-worker-store.js';
import { isMediaOperation, neonMediaOperation, neonMediaReady } from './neon-media-store.js';

// Server-only Neon adapter. All SQL values are positional parameters, never user-interpolated.
// Unsupported operations MUST fail closed (no silent Supabase writes or invented data).
let connection;
function db() {
  if (!connection) {
    const url=String(process.env.VETO_NEON_DATABASE_URL||'');
    if (!/^postgres(?:ql)?:\/\//.test(url)) throw new Error('VETO_NEON_DATABASE_URL_NOT_CONFIGURED');
    connection=neon(url);
  }
  return connection;
}
async function query(statement,params=[]) { return db().query(statement,params); }
const owner = v => {const s=String(v??'');if(!/^\d{1,20}$/.test(s))throw new Error('INVALID_OWNER_ID');return s;};
const chat = v => {const s=String(v??'');if(!/^-?\d{1,20}$/.test(s))throw new Error('INVALID_CHAT_ID');return s;};
const one = async (statement,params=[]) => (await query(statement,params))[0]||null;
const opts = (args={}) => args||{};
const int = (v,low=1,high=100) => Math.max(low,Math.min(high,Math.floor(Number(v)||low)));
const defaults={antiDelete:false,editHistory:false,ghostInbox:false,ghostFocus:true,notifyDeletes:true,notifyEdits:true,retentionDays:30};
const privacyShape=r=>r?({
  antiDelete:!!r.anti_delete,editHistory:!!r.edit_history,ghostInbox:!!r.ghost_inbox,
  ghostFocus:r.ghost_focus!==false,notifyDeletes:r.notify_deletes!==false,
  notifyEdits:r.notify_edits!==false,retentionDays:int(r.retention_days,1,3650)
}):{...defaults};
const businessShape=r=>r?({
  telegramUserId:String(r.telegram_user_id),businessConnectionId:r.business_connection_id||null,
  isEnabled:!!r.is_enabled,canManageStories:!!r.can_manage_stories,
  canReadMessages:!!r.can_read_messages,source:r.source||null,
  lastVerifiedAt:r.last_verified_at,createdAt:r.created_at,updatedAt:r.updated_at
}):null;
const storedPrivacy=async userId=>privacyShape(await one(
 'SELECT * FROM public.story_pilot_privacy_settings WHERE telegram_user_id=$1::bigint',[owner(userId)]));
const validMessage=row=>Boolean(row?.chat_id && Number.isSafeInteger(Number(row.message_id)) && Number(row.message_id)>0);
function eventShape(r){return {
  id:String(r.id),eventType:r.event_type,source:r.source,occurredAt:r.occurred_at,
  chatId:r.chat_id==null?null:String(r.chat_id),messageId:r.message_id==null?null:Number(r.message_id),
  storyId:r.story_id==null?null:Number(r.story_id),actorUserId:r.actor_user_id==null?null:String(r.actor_user_id),
  actorUsername:r.actor_username,actorDisplayName:r.actor_display_name,direction:r.direction,
  correlationKey:r.correlation_key,payload:r.payload||{}
};}

export async function neonStoreOperation(op, rawArgs={}) {
 const a=opts(rawArgs), user=a.userId??a.user_id??a.telegram_user_id;
 if (isArchiveOperation(op)) return neonArchiveOperation(op,a,{query,one,owner,chat});
 if (isStoryOperation(op)) return neonStoryOperation(op,a,{query,one,owner,chat});
 if (isWorkerOperation(op)) return neonWorkerOperation(op,a,{query,one,owner,chat});
 if (isMediaOperation(op)) return neonMediaOperation(op,a,{query,one,owner,chat});
 switch(op){
 case 'health': {
   const version=await one('SELECT version FROM public.veto_storage_migrations ORDER BY version DESC LIMIT 1');
   // A schema version alone is not proof that the atomically required lease
   // table exists. This is a read-only catalog check: no user data is touched.
   const lease=await one("SELECT to_regclass('public.veto_business_write_leases') IS NOT NULL AS ready");
   const otpLease=await one("SELECT to_regclass('public.veto_login_code_leases') IS NOT NULL AS ready");
   return { storage:'ok', backend:'neon', schemaVersion:version?.version||0,
     businessLeaseReady:lease?.ready===true,
     loginCodeLeaseReady:otpLease?.ready===true,
     // Media, cron workers and nonported analytics must be verified separately.
     mediaVault:await neonMediaReady(), backgroundWorkers:false };
 }
 case 'seal_viewer_private_json':
   return sealNeonJson(a.value,a.context||'global');
 case 'open_viewer_private_json':
   return openNeonJson(a.ciphertext,a.context||'global');
 case 'viewer_crypto_health': {
   if(!neonCipherReady()) throw new Error('PRIVATE_SESSION_CRYPTO_UNAVAILABLE');
   const row=await one('SELECT version FROM public.veto_storage_migrations ORDER BY version DESC LIMIT 1');
   if(!row?.version) throw new Error('NEON_SCHEMA_MISSING');
   // Read only the cipher prefix and fingerprint match, not private sessions.
   // Never claim auth-ready if old v4 sessions use a different key.
   const incompatible=await one(`SELECT count(*)::integer AS total
      FROM public.story_pilot_viewer_sessions
      WHERE session_ciphertext IS NOT NULL
        AND (split_part(session_ciphertext,'.',1) <> 'v4'
          OR split_part(session_ciphertext,'.',2) <> $1)`,[neonCipherKeyId()]);
   if(Number(incompatible?.total||0)>0) {
     return {ready:false,version:'v4',cipherVersion:'v4',backend:'neon',
       reason:'NEON_SESSION_KEY_MISMATCH'};
   }
   return {ready:true,version:'v4',cipherVersion:'v4',environment:a.environment||'preview',
     backend:'neon',keyId:'server_environment'};
 }
 case 'claim_business_write_lease': {
   const uid=owner(user),token=String(a.leaseToken||'');
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))
     throw new Error('INVALID_BUSINESS_LEASE_TOKEN');
   const ttl=int(a.ttlSeconds,90,240);
   const row=await one(`INSERT INTO public.veto_business_write_leases
     (telegram_user_id,lease_token,expires_at)
     VALUES($1::bigint,$2::uuid,now()+($3::integer * interval '1 second'))
     ON CONFLICT (telegram_user_id) DO UPDATE
       SET lease_token=excluded.lease_token,expires_at=excluded.expires_at
     WHERE public.veto_business_write_leases.expires_at < now()
     RETURNING lease_token`,[uid,token,ttl]);
   return {acquired:String(row?.lease_token||'')===token};
 }
 case 'release_business_write_lease': {
   const uid=owner(user),token=String(a.leaseToken||'');
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))
     throw new Error('INVALID_BUSINESS_LEASE_TOKEN');
   const rows=await query(`DELETE FROM public.veto_business_write_leases
     WHERE telegram_user_id=$1::bigint AND lease_token=$2::uuid
     RETURNING telegram_user_id`,[uid,token]);
   return {released:rows.length>0};
 }
 case 'claim_login_code_lease': {
   const uid=owner(user),token=String(a.leaseToken||'');
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))
     throw new Error('INVALID_LOGIN_CODE_LEASE_TOKEN');
   // A lease is bounded. 180s > the expected lifetime of one serverless
   // MTProto request; do not expose phone/code/session data in this table.
   const ttl=int(a.ttlSeconds,180,240);
   const row=await one(`INSERT INTO public.veto_login_code_leases
     (telegram_user_id,lease_token,expires_at)
     VALUES($1::bigint,$2::uuid,now()+($3::integer * interval '1 second'))
     ON CONFLICT (telegram_user_id) DO UPDATE
       SET lease_token=excluded.lease_token,expires_at=excluded.expires_at
     WHERE public.veto_login_code_leases.expires_at < now()
     RETURNING lease_token`,[uid,token,ttl]);
   return {acquired:String(row?.lease_token||'')===token};
 }
 case 'release_login_code_lease': {
   const uid=owner(user),token=String(a.leaseToken||'');
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))
     throw new Error('INVALID_LOGIN_CODE_LEASE_TOKEN');
   const rows=await query(`DELETE FROM public.veto_login_code_leases
     WHERE telegram_user_id=$1::bigint AND lease_token=$2::uuid
     RETURNING telegram_user_id`,[uid,token]);
   return {released:rows.length>0};
 }
 case 'get_session':
   return one('SELECT * FROM public.story_pilot_viewer_sessions WHERE telegram_user_id=$1::bigint',[owner(user)]);
 case 'upsert_session': {
   const r=a.row||{},uid=owner(r.telegram_user_id);
   return one(`INSERT INTO public.story_pilot_viewer_sessions
    (telegram_user_id,session_ciphertext,status,telegram_account_user_id,telegram_account_username,telegram_account_first_name,last_poll_at,last_error,notify_enabled,notify_anonymous_gap,created_at,updated_at)
    VALUES ($1::bigint,$2,$3,$4::bigint,$5,$6,$7::timestamptz,$8,$9,$10,coalesce($11::timestamptz,now()),now())
    ON CONFLICT(telegram_user_id) DO UPDATE SET session_ciphertext=excluded.session_ciphertext,
      status=excluded.status,telegram_account_user_id=excluded.telegram_account_user_id,
      telegram_account_username=excluded.telegram_account_username,
      telegram_account_first_name=excluded.telegram_account_first_name,
      last_poll_at=excluded.last_poll_at,last_error=excluded.last_error,updated_at=now(),
      notify_enabled=excluded.notify_enabled,notify_anonymous_gap=excluded.notify_anonymous_gap
    RETURNING *`,[uid,String(r.session_ciphertext||''),r.status||'active',
      r.telegram_account_user_id?owner(r.telegram_account_user_id):null,
      r.telegram_account_username||null,r.telegram_account_first_name||null,r.last_poll_at||null,
      r.last_error||null,r.notify_enabled!==false,r.notify_anonymous_gap!==false,r.created_at||null]);
 }
 case 'update_session': {
   const allowed=['status','session_ciphertext','last_poll_at','last_error','notify_enabled','notify_anonymous_gap','telegram_account_username','telegram_account_first_name'];
   const patch=a.patch||{},keys=Object.keys(patch).filter(k=>allowed.includes(k));
   if(!keys.length) return neonStoreOperation('get_session',{userId:user});
   return one('UPDATE public.story_pilot_viewer_sessions SET '+
      keys.map((key,i)=>key+'=$'+(i+2)).join(',')+',updated_at=now() WHERE telegram_user_id=$1::bigint RETURNING *',
      [owner(user),...keys.map(k=>patch[k])]);
 }
 case 'delete_session':
   await query('DELETE FROM public.story_pilot_viewer_sessions WHERE telegram_user_id=$1::bigint',[owner(user)]);return true;
 case 'get_challenge':
   return one('SELECT * FROM public.story_pilot_viewer_auth_challenges WHERE telegram_user_id=$1::bigint',[owner(user)]);
 case 'save_challenge': {
   const r=a.row||{};return one(`INSERT INTO public.story_pilot_viewer_auth_challenges
     (telegram_user_id,challenge_ciphertext,stage,created_at,expires_at)
     VALUES($1::bigint,$2,$3,coalesce($4::timestamptz,now()),$5::timestamptz)
     ON CONFLICT(telegram_user_id) DO UPDATE SET challenge_ciphertext=excluded.challenge_ciphertext,
      stage=excluded.stage,created_at=excluded.created_at,expires_at=excluded.expires_at
     RETURNING *`,[owner(r.telegram_user_id),r.challenge_ciphertext||'',r.stage||'code',
       r.created_at||null,r.expires_at]);
 }
 case 'delete_challenge':
   await query('DELETE FROM public.story_pilot_viewer_auth_challenges WHERE telegram_user_id=$1::bigint',[owner(user)]);return true;
 case 'get_privacy_settings': return storedPrivacy(user);
 case 'update_privacy_settings': {
   const p=a.patch||{},c=await storedPrivacy(user);const state={
      antiDelete:p.antiDelete===undefined?c.antiDelete:!!p.antiDelete,
      editHistory:p.editHistory===undefined?c.editHistory:!!p.editHistory,
      ghostInbox:p.ghostInbox===undefined?c.ghostInbox:!!p.ghostInbox,
      ghostFocus:p.ghostFocus===undefined?c.ghostFocus:!!p.ghostFocus,
      notifyDeletes:p.notifyDeletes===undefined?c.notifyDeletes:!!p.notifyDeletes,
      notifyEdits:p.notifyEdits===undefined?c.notifyEdits:!!p.notifyEdits,
      retentionDays:int(p.retentionDays??c.retentionDays,1,3650)
   };
   await query(`INSERT INTO public.story_pilot_privacy_settings
     (telegram_user_id,anti_delete,edit_history,ghost_inbox,ghost_focus,notify_deletes,notify_edits,retention_days)
     VALUES($1::bigint,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT(telegram_user_id) DO UPDATE SET anti_delete=excluded.anti_delete,
      edit_history=excluded.edit_history,ghost_inbox=excluded.ghost_inbox,ghost_focus=excluded.ghost_focus,
      notify_deletes=excluded.notify_deletes,notify_edits=excluded.notify_edits,
      retention_days=excluded.retention_days,updated_at=now()`,
     [owner(user),state.antiDelete,state.editHistory,state.ghostInbox,state.ghostFocus,
       state.notifyDeletes,state.notifyEdits,state.retentionDays]);
   return state;
 }
 case 'get_business_connection_state':
   return businessShape(await one('SELECT * FROM public.story_pilot_business_connections WHERE telegram_user_id=$1::bigint',[owner(user)]));
 case 'upsert_business_connection_state': {
   const r=a.row||{},uid=owner(r.telegramUserId||r.telegram_user_id);
   const saved=await one(`INSERT INTO public.story_pilot_business_connections
      (telegram_user_id,business_connection_id,is_enabled,can_manage_stories,can_read_messages,source,last_verified_at)
      VALUES ($1::bigint,$2,$3,$4,$5,$6,coalesce($7::timestamptz,now()))
      ON CONFLICT(telegram_user_id) DO UPDATE SET business_connection_id=excluded.business_connection_id,
       is_enabled=excluded.is_enabled,can_manage_stories=excluded.can_manage_stories,
       can_read_messages=excluded.can_read_messages,source=excluded.source,
       last_verified_at=excluded.last_verified_at,updated_at=now() RETURNING *`,
      [uid,r.businessConnectionId??r.business_connection_id??null,!!(r.isEnabled??r.is_enabled),
       !!(r.canManageStories??r.can_manage_stories),!!(r.canReadMessages??r.can_read_messages),
       String(r.source||'runtime').slice(0,64),r.lastVerifiedAt||r.last_verified_at||null]);
   return businessShape(saved);
 }
 case 'list_business_connection_candidates': return (await query(
    'SELECT telegram_user_id,business_connection_id,updated_at FROM public.story_pilot_business_connections WHERE is_enabled=true AND business_connection_id IS NOT NULL ORDER BY updated_at DESC LIMIT $1',
    [int(a.limit,1,100)])).map(r=>({telegramUserId:String(r.telegram_user_id),businessConnectionId:r.business_connection_id,lastSeenAt:r.updated_at}));
 case 'record_event': {
   const allowed=['session.created','session.revoked','connection.created','connection.revoked','security.event'];
   if(!allowed.includes(a.eventType))throw new Error('EVENT_TYPE_NOT_ALLOWED');
   const payload={};for(const k of ['method','crypto','connection','reason','status'])if(typeof a.payload?.[k]==='string')payload[k]=a.payload[k].slice(0,80);
   const event=await one(`INSERT INTO public.story_pilot_events
     (telegram_user_id,event_type,source,occurred_at,correlation_key,dedupe_key,payload,retention_until)
     VALUES($1::bigint,$2,'security',coalesce($3::timestamptz,now()),$4,$5,$6::jsonb,
       coalesce($3::timestamptz,now())+interval '180 days')
     ON CONFLICT(telegram_user_id,dedupe_key) DO UPDATE SET dedupe_key=excluded.dedupe_key RETURNING *`,
     [owner(user),a.eventType,a.occurredAt||null,String(a.correlationKey||'security').slice(0,120),
       String(a.dedupeKey||a.eventType+':'+(a.occurredAt||'')).slice(0,240),JSON.stringify(payload)]);
   return eventShape(event);
 }
 case 'list_events':
   return (await query(`SELECT * FROM public.story_pilot_events WHERE telegram_user_id=$1::bigint
     AND (retention_until IS NULL OR retention_until>now()) ORDER BY occurred_at DESC LIMIT $2`,
     [owner(user),int(a.limit,1,50)])).map(eventShape);
 case 'list_active_sessions':
   return query(`SELECT * FROM public.story_pilot_viewer_sessions WHERE status='active' ORDER BY updated_at DESC LIMIT $1`,
     [int(a.limit,1,50)]);
 default:
   throw new Error('NEON_OPERATION_NOT_MIGRATED:'+String(op||'unknown'));
 }
}
