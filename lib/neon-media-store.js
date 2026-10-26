import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand,
 DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const OPS=new Set(['create_privacy_media_upload','create_history_media_upload',
 'finalize_privacy_media_archive','get_privacy_media_ref','list_recoverable_privacy_media',
 'clear_privacy_archive','cleanup_privacy_retention_global']);
export const isMediaOperation=op=>OPS.has(op);
const BUCKET='veto-private-media',MAX=20*1024*1024,now=()=>new Date().toISOString();
let client;
function s3(){
 if(client)return client;
 const endpoint=process.env.AWS_ENDPOINT_URL_S3||'';
 if(!/^https:\/\/br-[a-z0-9-]+\.storage\.[a-z0-9.-]+\.neon\.tech$/.test(endpoint))
   throw Error('NEON_STORAGE_NOT_CONFIGURED');
 if(!process.env.AWS_ACCESS_KEY_ID||!process.env.AWS_SECRET_ACCESS_KEY)
   throw Error('NEON_STORAGE_CREDENTIALS_MISSING');
 client=new S3Client({endpoint,region:process.env.AWS_REGION||'eu-central-1',forcePathStyle:true,
  credentials:{accessKeyId:process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY},requestChecksumCalculation:'WHEN_REQUIRED'});
 return client;
}
export async function neonMediaReady() {
 try { await s3().send(new HeadBucketCommand({Bucket:BUCKET})); return true; }
 catch { return false; }
}
function cleanExt(name,mime){
 const extension=String(name||'').split('.').pop().replace(/[^a-z0-9]/ig,'').slice(0,10).toLowerCase();
 if(extension&&extension!==String(name||'').toLowerCase())return '.'+extension;
 return { 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp',
  'video/mp4':'.mp4','audio/ogg':'.ogg','audio/mpeg':'.mp3',
  'application/pdf':'.pdf' }[mime]||'.bin';
}
function assertPath(path,u,c,m){
 const pref=u+'/'+c+'/'+m+'/';
 if(!String(path||'').startsWith(pref)||!/^[0-9a-zA-Z_/.-]+$/.test(path)||
    String(path).includes('..'))throw Error('UNSAFE_NEON_MEDIA_PATH');
 return path;
}
async function removeFiles(paths){
 for(const path of [...new Set(paths.filter(Boolean))]){
  if(!/^\d{1,20}\/-?\d{1,20}\/\d{1,20}\/[0-9a-zA-Z_.-]+$/.test(path))throw Error('UNSAFE_NEON_MEDIA_PATH');
  await s3().send(new DeleteObjectCommand({Bucket:BUCKET,Key:path}));
 }
}
const baseSettings=async(u,one)=>{
 const p=await one('SELECT anti_delete,ghost_inbox,retention_days FROM public.story_pilot_privacy_settings WHERE telegram_user_id=$1::bigint',[u]);
 return {antiDelete:!!p?.anti_delete,ghostInbox:!!p?.ghost_inbox,retentionDays:Math.max(1,Math.min(3650,Number(p?.retention_days)||30))};
};
// Cleanup is asynchronous. An expired row must stop granting access or signing
// upload/download URLs even when the retention worker has not run yet.
export function mediaWithinRetention(message,settings,nowMs=Date.now()){
 const sentAt=Date.parse(message?.sent_at);
 return Number.isFinite(sentAt)&&Number.isFinite(nowMs)&&
  sentAt>=nowMs-settings.retentionDays*86400000&&sentAt<=nowMs+120000;
}
export async function neonMediaOperation(op,a,{query,one,owner,chat}){
 const uid=op==='cleanup_privacy_retention_global'?null:owner(a.userId),
  cid=a.chatId==null?null:chat(a.chatId);
 const msg=a.messageId==null?null:Number(a.messageId);
 const row=async()=>one(`SELECT * FROM public.story_pilot_messages WHERE telegram_user_id=$1::bigint
  AND chat_id=$2::bigint AND message_id=$3`,[uid,cid,msg]);
 switch(op){
 case 'create_privacy_media_upload':
 case 'create_history_media_upload':{
  if(!Number.isSafeInteger(msg)||msg<=0||!cid)throw Error('INVALID_MEDIA_IDENTITY');
  const p=await baseSettings(uid,one);
  if(op==='create_privacy_media_upload'&&!p.antiDelete)return {allowed:false,reason:'anti_delete_disabled'};
  if(op==='create_history_media_upload'&&!p.ghostInbox)return {allowed:false,reason:'history_inbox_disabled'};
  const stored=await row();
  if(!mediaWithinRetention(stored,p))return {allowed:false,reason:'expired_media'};
  if(op==='create_privacy_media_upload'&&!stored?.media_file_id)return {allowed:false,reason:'no_media'};
  if(op==='create_history_media_upload'&&
    (!stored||stored.business_connection_id!=='user_session_backup'||!stored.media_type))
    return {allowed:false,reason:'history_message_not_found'};
  const size=Number(op==='create_history_media_upload'?a.fileSize:stored.media_file_size)||null;
  const limit=op==='create_history_media_upload'?5*1024*1024:MAX;
  if(size&&size>limit){
   await query(`UPDATE public.story_pilot_messages SET media_archive_status='too_large',
     media_archive_error='media_size_limit',updated_at=now()
     WHERE telegram_user_id=$1::bigint AND chat_id=$2::bigint AND message_id=$3`,
     [uid,cid,msg]);
   return {allowed:false,reason:'too_large'};
  }
  if(op==='create_history_media_upload'&&(!Number.isSafeInteger(size)||size<1))
    throw Error('INVALID_HISTORY_MEDIA_SIZE');
  if(stored.media_storage_path&&stored.media_archive_status==='archived')
   return {allowed:false,reason:'already_archived',path:stored.media_storage_path};
  const mime=op==='create_history_media_upload'?(a.mimeType||'application/octet-stream'):
    (stored.media_mime_type||'application/octet-stream');
  const filename=op==='create_history_media_upload'?a.fileName:stored.media_file_name;
  const hash=String(stored.content_hash||'media').replace(/[^a-z0-9]/ig,'').slice(0,24)||'media';
  const path=assertPath(uid+'/'+cid+'/'+msg+'/'+hash+cleanExt(filename,mime),uid,cid,msg);
  const signedUrl=await getSignedUrl(s3(),new PutObjectCommand({
   Bucket:BUCKET,Key:path,ContentType:mime}),{expiresIn:300});
  await query(`UPDATE public.story_pilot_messages SET media_archive_status='pending',
   media_archive_error=null,updated_at=now() WHERE telegram_user_id=$1::bigint
   AND chat_id=$2::bigint AND message_id=$3`,[uid,cid,msg]);
  return {allowed:true,path,signedUrl,mimeType:mime,
   fileName:filename||null,fileSize:size};
 }
 case 'finalize_privacy_media_archive':{
  if(!Number.isSafeInteger(msg)||msg<=0||!cid)throw Error('INVALID_MEDIA_IDENTITY');
  const archived=a.archived===true;
  let key=null;
  if(archived){
    const p=await baseSettings(uid,one),stored=await row();
    if(!mediaWithinRetention(stored,p))return {allowed:false,reason:'expired_media'};
    key=assertPath(String(a.path||''),uid,cid,msg);
    // Verify an upload completed before treating it as an independent recoverable copy.
    await s3().send(new HeadObjectCommand({Bucket:BUCKET,Key:key}));
  }
  return one(`UPDATE public.story_pilot_messages SET
   media_archive_status=$4,media_archive_error=$5,
   media_storage_path=CASE WHEN $6::boolean THEN $7 ELSE media_storage_path END,
   media_archived_at=CASE WHEN $6::boolean THEN now() ELSE media_archived_at END,updated_at=now()
   WHERE telegram_user_id=$1::bigint AND chat_id=$2::bigint AND message_id=$3
   RETURNING media_archive_status,media_storage_path,media_archived_at`,
   [uid,cid,msg,archived?'archived':'failed',archived?null:String(a.error||'archive_failed').slice(0,300),
    archived,key]);
 }
 case 'get_privacy_media_ref':{
  if(!Number.isSafeInteger(msg)||msg<=0||!cid)throw Error('INVALID_MEDIA_IDENTITY');
  const p=await baseSettings(uid,one);if(!p.antiDelete&&!p.ghostInbox)return null;
  const m=await row();
  if(!mediaWithinRetention(m,p)||(!m?.media_file_id&&!m?.media_storage_path))return null;
  let vaultUrl=null;
  if(m.media_archive_status==='archived'&&m.media_storage_path){
   const key=assertPath(m.media_storage_path,uid,cid,msg);
   vaultUrl=await getSignedUrl(s3(),new GetObjectCommand({Bucket:BUCKET,Key:key}),{expiresIn:90});
  }
  return {mediaType:m.media_type||null,fileId:m.media_file_id||null,
   mimeType:m.media_mime_type||null,fileName:m.media_file_name||null,
   fileSize:Number(m.media_file_size)||null,deletedAt:m.deleted_at||null,
   archiveStatus:m.media_archive_status||'none',vaultUrl};
 }
 case 'list_recoverable_privacy_media':{
  const p=await baseSettings(uid,one);if(!p.antiDelete)return {eligible:false,pending:0,rows:[]};
  const cutoff=new Date(Date.now()-p.retentionDays*86400000).toISOString();
  const total=await one(`SELECT COUNT(*)::int AS n FROM public.story_pilot_messages
   WHERE telegram_user_id=$1::bigint AND media_file_id IS NOT NULL
   AND sent_at >= $2::timestamptz
   AND media_archive_status IN ('pending','failed') AND media_storage_path IS NULL`,[uid,cutoff]);
  const rows=await query(`SELECT telegram_user_id,chat_id,message_id,media_file_id,
   media_mime_type,media_file_size,media_archive_status,media_storage_path
   FROM public.story_pilot_messages WHERE telegram_user_id=$1::bigint
   AND media_file_id IS NOT NULL AND media_archive_status IN ('pending','failed')
   AND sent_at >= $2::timestamptz
   AND media_storage_path IS NULL ORDER BY updated_at ASC LIMIT $3`,
   [uid,cutoff,Math.max(1,Math.min(3,Number(a.limit)||3))]);
  return {eligible:true,pending:Number(total?.n)||0,rows};
 }
 case 'clear_privacy_archive': {
  // Archive clear must never leave orphaned media. Delete media objects before rows.
  const files=await query(`SELECT media_storage_path FROM public.story_pilot_messages
    WHERE telegram_user_id=$1::bigint AND media_storage_path IS NOT NULL`,[uid]);
  await removeFiles(files.map(r=>r.media_storage_path));
  const result=await query(`DELETE FROM public.story_pilot_messages
    WHERE telegram_user_id=$1::bigint RETURNING message_id`,[uid]);
  await query(`DELETE FROM public.story_pilot_message_versions WHERE telegram_user_id=$1::bigint`,[uid]);
  return {deleted:result.length};
 }
 case 'cleanup_privacy_retention_global':{
  // Scheduled maintenance must be authorized by the cron endpoint, not public Mini App input.
  const configs=await query(`SELECT telegram_user_id,retention_days
   FROM public.story_pilot_privacy_settings ORDER BY telegram_user_id LIMIT 5000`);
  let users=0;
  for(const config of configs){
   const target=owner(config.telegram_user_id);
   const limit=Math.max(1,Math.min(3650,Number(config.retention_days)||30));
   const cutoff=new Date(Date.now()-limit*86400000).toISOString();
   for(;;){
    const batch=await query(`SELECT chat_id,message_id,media_storage_path
     FROM public.story_pilot_messages WHERE telegram_user_id=$1::bigint
     AND sent_at < $2::timestamptz ORDER BY sent_at ASC LIMIT 250`,[target,cutoff]);
    if(!batch.length)break;
    await removeFiles(batch.map(r=>r.media_storage_path));
    for(const r of batch) {
     // Retention must remove edit snapshots too: no ON DELETE CASCADE exists.
     await query(`DELETE FROM public.story_pilot_message_versions
      WHERE telegram_user_id=$1::bigint AND chat_id=$2::bigint AND message_id=$3`,
      [target,r.chat_id,r.message_id]);
     await query(`DELETE FROM public.story_pilot_messages
      WHERE telegram_user_id=$1::bigint AND chat_id=$2::bigint AND message_id=$3`,
      [target,r.chat_id,r.message_id]);
    }
    if(batch.length<250)break;
   }
   users++;
  }
  return {users};
 }
 default:throw Error('NEON_MEDIA_OPERATION_NOT_MIGRATED:'+op);
 }
}
