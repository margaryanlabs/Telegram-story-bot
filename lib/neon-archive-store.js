// Portable Telegram private message archive. Owner identity is checked by the Vercel API,
// not trusted from browser-supplied user ids. SQL always scopes reads/writes by owner.
const archiveOps=new Set(['capture_business_message','mark_business_messages_deleted','list_privacy_threads',
 'list_deleted_feed','list_privacy_messages','get_message_versions','import_user_history_batch']);
export const isArchiveOperation = op=>archiveOps.has(op);
const preview=r=>String(r.text_content||r.caption||'').trim().slice(0,140)||
 (r.media_type?'['+r.media_type+']':'Сообщение');
const nextDate=()=>new Date().toISOString();
function safeInt(v,lo=1,hi=160){const n=Math.floor(Number(v)||lo);return Math.max(lo,Math.min(hi,n));}
function iso(v){const ms=Date.parse(String(v||''));return Number.isFinite(ms)?new Date(ms).toISOString():null;}
const settingsDefault={antiDelete:false,editHistory:false,ghostInbox:false,ghostFocus:true,
 notifyDeletes:true,notifyEdits:true,retentionDays:30};
const safeRow=r=>r?{antiDelete:!!r.anti_delete,editHistory:!!r.edit_history,
 ghostInbox:!!r.ghost_inbox,ghostFocus:r.ghost_focus!==false,
 notifyDeletes:r.notify_deletes!==false,notifyEdits:r.notify_edits!==false,
 retentionDays:safeInt(r.retention_days,1,3650)}:{...settingsDefault};
const hasArchive=s=>s.antiDelete||s.editHistory||s.ghostInbox;
function clip(v,n=200){return String(v||'').slice(0,n)||null;}
export async function neonArchiveOperation(op,a,sql){
 const {query,one,owner,chat}=sql;
 const uid=owner(a.userId??a.user_id??a.row?.telegram_user_id);
 const settings=async()=>safeRow(await one('SELECT * FROM public.story_pilot_privacy_settings WHERE telegram_user_id=$1::bigint',[uid]));
 const cutoff=s=>new Date(Date.now()-s.retentionDays*86400000).toISOString();
 if(op==='capture_business_message'){
  const r=a.row||{},cid=chat(r.chat_id),mid=Number(r.message_id);
  if(!Number.isSafeInteger(mid)||mid<=0||!r.business_connection_id)throw Error('invalid_business_message');
  const p=await settings();if(!hasArchive(p))return {captured:false,reason:'privacy_disabled'};
  const hash=String(r.content_hash||'');if(!hash)throw Error('missing_message_hash');
  const now=nextDate();
  const saved=await one(`INSERT INTO public.story_pilot_messages (
   telegram_user_id,business_connection_id,chat_id,message_id,direction,sender_user_id,
   sender_username,sender_display_name,chat_title,text_content,caption,media_type,
   media_file_id,media_unique_id,media_mime_type,media_file_name,media_file_size,
   sent_at,edited_at,content_hash,updated_at)
   VALUES($1::bigint,$2,$3::bigint,$4,$5,$6::bigint,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
   coalesce($18::timestamptz,now()),$19::timestamptz,$20,now())
   ON CONFLICT(telegram_user_id,chat_id,message_id) DO UPDATE SET
    business_connection_id=excluded.business_connection_id,direction=excluded.direction,
    sender_user_id=excluded.sender_user_id,sender_username=excluded.sender_username,
    sender_display_name=excluded.sender_display_name,chat_title=excluded.chat_title,
    text_content=excluded.text_content,caption=excluded.caption,media_type=excluded.media_type,
    media_file_id=excluded.media_file_id,media_unique_id=excluded.media_unique_id,
    media_mime_type=excluded.media_mime_type,media_file_name=excluded.media_file_name,
    media_file_size=excluded.media_file_size,sent_at=excluded.sent_at,
    edited_at=excluded.edited_at,content_hash=excluded.content_hash,updated_at=now()
   -- Replayed webhooks with identical content are NOT new edit versions.
   -- Only the changed row may cause downstream notifications/history events.
   WHERE public.story_pilot_messages.deleted_at IS NULL
     AND public.story_pilot_messages.content_hash IS DISTINCT FROM excluded.content_hash
   RETURNING *`,[uid,String(r.business_connection_id),cid,mid,r.direction==='outgoing'?'outgoing':'incoming',
   r.sender_user_id?owner(r.sender_user_id):null,clip(r.sender_username,90),clip(r.sender_display_name,140),
   clip(r.chat_title,160),clip(r.text_content,10000),clip(r.caption,10000),
   clip(r.media_type,40),clip(r.media_file_id,600),clip(r.media_unique_id,600),
   clip(r.media_mime_type,150),clip(r.media_file_name,160),Number(r.media_file_size)||null,
   iso(r.sent_at),iso(r.edited_at),hash]);
  // Deletion tombstones are immutable. A delayed business update must not undo an earlier deletion.
  if(saved&&p.editHistory){
   await query(`INSERT INTO public.story_pilot_message_versions
    (telegram_user_id,chat_id,message_id,event_type,content_hash,text_content,caption,
    media_type,media_file_id,media_unique_id,observed_at)
    VALUES($1::bigint,$2::bigint,$3,$4,$5,$6,$7,$8,$9,$10,now())
    ON CONFLICT(telegram_user_id,chat_id,message_id,content_hash) DO NOTHING`,
    [uid,cid,mid,a.eventType==='edit'?'edit':'new',hash,clip(r.text_content,10000),clip(r.caption,10000),
     clip(r.media_type,40),clip(r.media_file_id,600),clip(r.media_unique_id,600)]);
  }
  if(saved){
   await query(`INSERT INTO public.story_pilot_events
    (telegram_user_id,event_type,source,occurred_at,chat_id,message_id,direction,correlation_key,dedupe_key,payload,retention_until)
    VALUES($1::bigint,$2,'business',now(),$3::bigint,$4,$5,$6,$7,$8::jsonb,now()+$9::integer*interval '1 day')
    ON CONFLICT(telegram_user_id,dedupe_key) DO NOTHING`,
    [uid,a.eventType==='edit'?'message.edit':'message.new',cid,mid,saved.direction,
     'chat:'+cid,'message:'+cid+':'+mid+':'+(a.eventType==='edit'?'message.edit':'message.new')+':'+hash,
     JSON.stringify({chatTitle:clip(r.chat_title,160),mediaType:clip(r.media_type,40)}),p.retentionDays]);
  }
  return {captured:!!saved,settings:p,
    reason:saved?null:'duplicate_content_or_already_deleted'};
 }
 if(op==='mark_business_messages_deleted'){
  const cid=chat(a.chatId),ids=[...new Set((Array.isArray(a.messageIds)?a.messageIds:[])
    .map(Number).filter(v=>Number.isSafeInteger(v)&&v>0))].slice(0,100);
  if(!ids.length)return {affected:0};
  const p=await settings(),now=iso(a.deletedAt)||nextDate();
  const before=await query(`SELECT * FROM public.story_pilot_messages
   WHERE telegram_user_id=$1::bigint AND chat_id=$2::bigint
   AND message_id=ANY($3::bigint[]) AND deleted_at IS NULL`,
   [uid,cid,ids]);
  // Rows without media can be safely deleted when anti-delete is off. File archive cleanup
  // must be implemented before clearing saved attachments; fail closed instead.
  if(!p.antiDelete&&before.some(r=>r.media_storage_path))
    throw Error('NEON_MEDIA_CLEANUP_NOT_MIGRATED');
  // Privacy rule: when Anti-Delete is disabled, do not retain edit versions
  // of a message being permanently removed. No FK cascade exists in Neon.
  if(!p.antiDelete&&before.length) await query(`DELETE FROM public.story_pilot_message_versions
    WHERE telegram_user_id=$1::bigint AND chat_id=$2::bigint
      AND message_id=ANY($3::bigint[])`,[uid,cid,ids]);
  const changed=p.antiDelete?
    await query(`UPDATE public.story_pilot_messages SET deleted_at=coalesce(deleted_at,$4::timestamptz),
     updated_at=$4::timestamptz WHERE telegram_user_id=$1::bigint AND chat_id=$2::bigint
     AND message_id=ANY($3::bigint[]) AND deleted_at IS NULL
     RETURNING message_id`,[uid,cid,ids,now]):
    await query(`DELETE FROM public.story_pilot_messages WHERE telegram_user_id=$1::bigint
     AND chat_id=$2::bigint AND message_id=ANY($3::bigint[]) RETURNING message_id`,[uid,cid,ids]);
  // The update/delete returning set, not a stale preceding SELECT, defines
  // which webhook owns the deletion. Do not re-notify after duplicate delivery.
  const changedIds=new Set(changed.map(r=>String(r.message_id)));
  const newlyDeleted=before.filter(r=>changedIds.has(String(r.message_id)));
  for(const r of newlyDeleted) await query(`INSERT INTO public.story_pilot_events
    (telegram_user_id,event_type,source,occurred_at,chat_id,message_id,direction,
     correlation_key,dedupe_key,payload,retention_until)
    VALUES($1::bigint,'message.delete','business',$2::timestamptz,$3::bigint,$4,$5,$6,$7,$8::jsonb,
     $2::timestamptz+$9::integer*interval '1 day')
    ON CONFLICT(telegram_user_id,dedupe_key) DO NOTHING`,
    [uid,now,cid,r.message_id,r.direction,'chat:'+cid,'message:'+cid+':'+r.message_id+':delete',
     JSON.stringify({chatTitle:r.chat_title,mediaType:r.media_type,hasMedia:!!r.media_type}),p.retentionDays]);
  return {affected:changed.length,retained:p.antiDelete,settings:p,
    events:newlyDeleted.map(r=>({chatId:cid,messageId:Number(r.message_id),sender:r.sender_display_name||
      (r.sender_username?'@'+r.sender_username:null),chatTitle:r.chat_title,
      direction:r.direction,preview:preview(r)})),mediaRecovery:[]};
 }
 if(op==='import_user_history_batch'){
  const cid=chat(a.chatId),rows=Array.isArray(a.rows)?a.rows:[];
  if(rows.length<1||rows.length>45)throw Error('invalid_history_import');
  const p=await settings();if(!p.ghostInbox)throw Error('enable_private_inbox_before_history_import');
  const seen=new Set(),now=Date.now();let accepted=0,inserted=0;
  for(const r of rows){
   const mid=Number(r.message_id),date=Date.parse(r.sent_at);
   if(String(r.telegram_user_id)!==uid||String(r.chat_id)!==cid||
      r.business_connection_id!=='user_session_backup'||!Number.isSafeInteger(mid)||
      mid<=0||seen.has(mid)||date<now-p.retentionDays*86400000||date>now+120000||
      !/^[a-f\d]{64}$/i.test(String(r.content_hash||'')))continue;
   seen.add(mid);accepted++;
   const got=await query(`INSERT INTO public.story_pilot_messages(
     telegram_user_id,business_connection_id,chat_id,message_id,direction,sender_user_id,
     sender_username,sender_display_name,chat_title,text_content,media_type,media_mime_type,
     media_file_name,media_file_size,sent_at,edited_at,content_hash)
     VALUES($1::bigint,'user_session_backup',$2::bigint,$3,$4,$5::bigint,$6,$7,$8,$9,$10,$11,$12,$13,
     $14::timestamptz,$15::timestamptz,$16)
     ON CONFLICT(telegram_user_id,chat_id,message_id) DO NOTHING RETURNING message_id`,
     [uid,cid,mid,r.direction==='outgoing'?'outgoing':'incoming',
      /^\d{1,19}$/.test(String(r.sender_user_id||''))?r.sender_user_id:null,
      clip(r.sender_username,80),clip(r.sender_display_name,120),clip(r.chat_title,120),
      clip(r.text_content,4000),['photo','document','location','attachment'].includes(r.media_type)?r.media_type:null,
      clip(r.media_mime_type,100),clip(r.media_file_name,110),
      Number.isSafeInteger(Number(r.media_file_size))?Number(r.media_file_size):null,
      new Date(date).toISOString(),iso(r.edited_at),String(r.content_hash)]);
   inserted+=got.length;
  }
  return {accepted,inserted};
 }
 if(op==='list_privacy_messages'||op==='list_deleted_feed'||op==='list_privacy_threads'||op==='get_message_versions'){
  const p=await settings(),date=cutoff(p),limit=safeInt(a.limit,1,160),offset=Math.max(0,Math.min(50000,Number(a.offset)||0));
  if(!hasArchive(p))return op==='list_deleted_feed'?{settings:p,items:[]}:
    op==='list_privacy_threads'?{settings:p,threads:[],smartSummary:{action:0,watch:0,archive:0,likelyNeedsReply:0}}:
    op==='get_message_versions'?{settings:p,versions:[]}:{settings:p,messages:[]};
  if(op==='get_message_versions'){
   if(!p.editHistory)return {settings:p,versions:[]};
   const rows=await query(`SELECT event_type,text_content,caption,media_type,observed_at
    FROM public.story_pilot_message_versions WHERE telegram_user_id=$1::bigint
    AND chat_id=$2::bigint AND message_id=$3 ORDER BY observed_at ASC LIMIT 50`,
    [uid,chat(a.chatId),Number(a.messageId)]);
   return {settings:p,versions:rows};
  }
  if(op==='list_privacy_messages'){
   const rows=await query(`SELECT * FROM public.story_pilot_messages WHERE telegram_user_id=$1::bigint
   AND chat_id=$2::bigint AND sent_at >= $3::timestamptz
   ORDER BY sent_at DESC,message_id DESC LIMIT $4 OFFSET $5`,
   [uid,chat(a.chatId),date,limit+1,offset]);
   return {settings:p,offset,hasMore:rows.length>limit,messages:rows.slice(0,limit).reverse()};
  }
  if(op==='list_deleted_feed'){
   const rows=await query(`SELECT * FROM public.story_pilot_messages WHERE telegram_user_id=$1::bigint
    AND deleted_at IS NOT NULL AND sent_at >= $2::timestamptz
    ORDER BY deleted_at DESC,chat_id DESC,message_id DESC LIMIT $3 OFFSET $4`,
    [uid,date,limit+1,offset]);
   return {settings:p,offset,hasMore:rows.length>limit,
     items:rows.slice(0,limit).map(r=>({chatId:String(r.chat_id),messageId:Number(r.message_id),
     direction:r.direction,senderUserId:r.sender_user_id?String(r.sender_user_id):null,
     senderUsername:r.sender_username,senderDisplayName:r.sender_display_name,chatTitle:r.chat_title,
     preview:preview(r),mediaType:r.media_type,mediaFileName:r.media_file_name,mediaFileSize:r.media_file_size,
     mediaArchiveStatus:r.media_archive_status,sentAt:r.sent_at,editedAt:r.edited_at,deletedAt:r.deleted_at}))};
  }
  const rows=await query(`SELECT * FROM public.story_pilot_messages WHERE telegram_user_id=$1::bigint
   AND sent_at >= $2::timestamptz ORDER BY sent_at DESC,chat_id DESC,message_id DESC LIMIT 2400`,
   [uid,date]);
  const threads=new Map();
  for(const r of rows){
   const id=String(r.chat_id);
   if(!threads.has(id))threads.set(id,{chatId:id,title:r.chat_title||r.sender_display_name||
      (r.sender_username?'@'+r.sender_username:'Telegram chat'),lastAt:r.sent_at,
      preview:preview(r),direction:r.direction,deletedCount:0,editedCount:0,mediaCount:0,vaultCount:0,
      messageCount:0,incomingCount:0,outgoingCount:0,lastIncomingAt:null,lastOutgoingAt:null,
      lastDeletedAt:null,latestDeletedMessageId:null,deletedPreview:null,lastEditedAt:null,
      latestEditedMessageId:null,editedPreview:null});
   const t=threads.get(id);t.messageCount++;
   if(r.direction==='outgoing'){t.outgoingCount++;t.lastOutgoingAt??=r.sent_at}
   else {t.incomingCount++;t.lastIncomingAt??=r.sent_at}
   if(r.deleted_at){t.deletedCount++;if(!t.lastDeletedAt||Date.parse(r.deleted_at)>Date.parse(t.lastDeletedAt)){
     t.lastDeletedAt=r.deleted_at;t.latestDeletedMessageId=Number(r.message_id);t.deletedPreview=preview(r)}}
   if(r.edited_at){t.editedCount++;if(!t.lastEditedAt||Date.parse(r.edited_at)>Date.parse(t.lastEditedAt)){
     t.lastEditedAt=r.edited_at;t.latestEditedMessageId=Number(r.message_id);t.editedPreview=preview(r)}}
   if(r.media_type)t.mediaCount++;if(r.media_archive_status==='archived')t.vaultCount++;
  }
  const list=[...threads.values()].slice(0,160).map(t=>{
    const awaiting=!!t.lastIncomingAt&&(!t.lastOutgoingAt||Date.parse(t.lastIncomingAt)>Date.parse(t.lastOutgoingAt));
    const question=/[?？]$/.test(t.preview.trim());
    const age=Math.max(0,Math.floor((Date.now()-Date.parse(t.lastAt))/60000));
    const score=Math.min(100,(awaiting?38:0)+(question?16:0)+(age<120?18:age<1440?8:0)+
      (t.deletedCount?Math.min(18,8+t.deletedCount*2):0)+(t.editedCount?Math.min(12,5+t.editedCount):0));
    const smartState=score>=52?'action':score>=24?'watch':'archive';
    return {...t,smartScore:score,smartState,smartKind:smartState==='action'?'review_reply':
      smartState==='watch'?'review_changes':'archive',
      smartNextAction:smartState==='action'?'Проверить сообщения':
      smartState==='watch'?'Проверить изменения':'Оставить в архиве',
      smartReasons:[],actionLikely:awaiting,looksQuestion:question,ageMinutes:age};
  });
  const summary={action:0,watch:0,archive:0,likelyNeedsReply:0};
  for(const t of list){summary[t.smartState]++;if(t.actionLikely)summary.likelyNeedsReply++}
  const top=[...list].sort((a,b)=>b.smartScore-a.smartScore)[0];
  return {settings:p,threads:list,smartSummary:summary,
    smartBrief:{status:summary.action?'action':summary.watch?'watch':'clear',
      title:summary.action?summary.action+' диалога требуют внимания':
        summary.watch?summary.watch+' диалога стоит проверить':'Срочных сигналов нет',
      detail:top?.title||'Нет сохранённых сообщений',
      primaryChatId:top?.chatId||'',primaryAction:top?.smartKind||'archive',reasons:[],generatedAt:nextDate()}};
 }
 throw Error('UNSUPPORTED_ARCHIVE_OPERATION');
}
