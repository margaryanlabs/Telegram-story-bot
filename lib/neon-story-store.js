// Neon native Stories metadata and viewer evidence. No fabricated identifiers/analytics.
const operations=new Set(['track_story','mark_story_deleted','list_story_archive','list_stories',
'update_story_stats','list_viewer_rows','upsert_viewer','delete_viewer',
'insert_snapshot','get_story_data','get_analytics','get_export']);
export const isStoryOperation=op=>operations.has(op);
const numeric=v=>Math.max(0,Number(v)||0);
const sId=v=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<1)throw Error('INVALID_STORY_ID');return n;};
export async function neonStoryOperation(op,a,{query,one,owner}){
 const r=a.row||{},u=owner(a.userId??r.telegram_user_id),sid=()=>sId(a.storyId??r.story_id);
 switch(op){
 case 'track_story': {
  const saved=await one(`INSERT INTO public.story_pilot_stories
    (telegram_user_id,story_id,posted_at,expires_at,watch_until,audience,protected,active,
     deleted_at,last_views_count,last_identified_count,last_forwards_count,last_reactions_count,
     last_sync_at,last_error)
    VALUES($1::bigint,$2,coalesce($3::timestamptz,now()),$4::timestamptz,$5::timestamptz,
     $6,$7,$8,$9::timestamptz,$10,$11,$12,$13,$14::timestamptz,$15)
    ON CONFLICT(telegram_user_id,story_id) DO UPDATE SET
     posted_at=excluded.posted_at,expires_at=excluded.expires_at,
     watch_until=excluded.watch_until,audience=excluded.audience,
     protected=excluded.protected,active=excluded.active,deleted_at=excluded.deleted_at,
     last_error=excluded.last_error RETURNING *`,
   [u,sid(),r.posted_at||null,r.expires_at,r.watch_until,r.audience||null,
    !!r.protected,r.active!==false,r.deleted_at||null,numeric(r.last_views_count),
    numeric(r.last_identified_count),numeric(r.last_forwards_count),numeric(r.last_reactions_count),
    r.last_sync_at||null,r.last_error||null]);
  await query(`INSERT INTO public.story_pilot_events
    (telegram_user_id,event_type,source,story_id,correlation_key,dedupe_key,payload,retention_until)
    VALUES($1::bigint,'story.publish','stories',$2,$3,$4,$5::jsonb,now()+interval '90 days')
    ON CONFLICT(telegram_user_id,dedupe_key) DO NOTHING`,
    [u,sid(),'story:'+sid(),'story:'+sid()+':publish',
    JSON.stringify({audience:r.audience||null,protected:!!r.protected})]);
  return saved;
 }
 case 'mark_story_deleted': {
  await query(`UPDATE public.story_pilot_stories SET active=false,deleted_at=now()
    WHERE telegram_user_id=$1::bigint AND story_id=$2`,[u,sid()]);
  await query(`INSERT INTO public.story_pilot_events
    (telegram_user_id,event_type,source,story_id,correlation_key,dedupe_key,retention_until)
    VALUES($1::bigint,'story.delete','stories',$2,$3,$4,now()+interval '90 days')
    ON CONFLICT(telegram_user_id,dedupe_key) DO NOTHING`,
    [u,sid(),'story:'+sid(),'story:'+sid()+':delete']);
  return true;
 }
 case 'list_story_archive':
  return query(`SELECT story_id,posted_at,audience,protected,active,deleted_at,
    last_views_count,last_identified_count,last_reactions_count,
    last_forwards_count,last_sync_at,last_error
    FROM public.story_pilot_stories WHERE telegram_user_id=$1::bigint
    ORDER BY posted_at DESC LIMIT $2`,[u,Math.min(100,Number(a.limit)||50)]);
 case 'list_stories':
  return query(`SELECT * FROM public.story_pilot_stories WHERE telegram_user_id=$1::bigint
    AND active=true AND watch_until>now() ORDER BY posted_at DESC LIMIT $2`,
    [u,Math.min(20,Number(a.limit)||8)]);
 case 'update_story_stats': {
  const p=a.patch||{},allowed=['last_views_count','last_identified_count','last_forwards_count',
    'last_reactions_count','last_sync_at','last_error','active'];
  const keys=Object.keys(p).filter(k=>allowed.includes(k));
  if(!keys.length)return one(`SELECT * FROM public.story_pilot_stories WHERE telegram_user_id=$1::bigint
    AND story_id=$2`,[u,sid()]);
  return one('UPDATE public.story_pilot_stories SET '+keys.map((k,i)=>k+'=$'+(i+3)).join(',')+
     ' WHERE telegram_user_id=$1::bigint AND story_id=$2 RETURNING *',
    [u,sid(),...keys.map(k=>p[k])]);
 }
 case 'list_viewer_rows':
  return query(`SELECT * FROM public.story_pilot_viewers WHERE telegram_user_id=$1::bigint
    AND story_id=$2 ORDER BY first_seen_at ASC`,[u,sid()]);
 case 'upsert_viewer': {
  const viewer=owner(r.viewer_user_id),state=r.status||'provisional';
  if(!['provisional','confirmed'].includes(state))throw Error('INVALID_VIEWER_STATE');
  const saved=await one(`INSERT INTO public.story_pilot_viewers
   (telegram_user_id,story_id,viewer_user_id,status,first_seen_at,last_seen_at,viewed_at,
    confirmed_at,username,display_name,is_contact,reaction_json,notification_message_id)
   VALUES($1::bigint,$2,$3::bigint,$4,coalesce($5::timestamptz,now()),
    coalesce($6::timestamptz,now()),coalesce($7::timestamptz,now()),$8::timestamptz,
    $9,$10,$11,$12::jsonb,$13::bigint)
   ON CONFLICT(telegram_user_id,story_id,viewer_user_id) DO UPDATE SET
    status=excluded.status,first_seen_at=excluded.first_seen_at,last_seen_at=excluded.last_seen_at,
    viewed_at=excluded.viewed_at,confirmed_at=excluded.confirmed_at,
    username=excluded.username,display_name=excluded.display_name,is_contact=excluded.is_contact,
    reaction_json=excluded.reaction_json,notification_message_id=excluded.notification_message_id
   RETURNING *`,[u,sid(),viewer,state,r.first_seen_at||null,r.last_seen_at||null,
    r.viewed_at||null,r.confirmed_at||null,r.username||null,r.display_name||null,!!r.is_contact,
    r.reaction_json==null?null:JSON.stringify(r.reaction_json),r.notification_message_id||null]);
  await query(`INSERT INTO public.story_pilot_events
    (telegram_user_id,event_type,source,story_id,actor_user_id,actor_username,
    actor_display_name,correlation_key,dedupe_key,payload,retention_until)
    VALUES($1::bigint,$2,'intelligence',$3,$4::bigint,$5,$6,$7,$8,$9::jsonb,now()+interval '90 days')
    ON CONFLICT(telegram_user_id,dedupe_key) DO NOTHING`,
    [u,'story.view.'+state,sid(),viewer,r.username||null,r.display_name||null,
      'story:'+sid(),'story:'+sid()+':viewer:'+viewer+':'+state,
      JSON.stringify({status:state,isContact:!!r.is_contact,hasReaction:!!r.reaction_json})]);
  return saved;
 }
 case 'delete_viewer':
  await query(`DELETE FROM public.story_pilot_viewers WHERE telegram_user_id=$1::bigint
    AND story_id=$2 AND viewer_user_id=$3::bigint`,[u,sid(),owner(a.viewerUserId)]);return true;
 case 'insert_snapshot':
  await query(`INSERT INTO public.story_pilot_viewer_snapshots
   (telegram_user_id,story_id,observed_at,total_views,identified_views,forwards_count,reactions_count)
   VALUES($1::bigint,$2,coalesce($3::timestamptz,now()),$4,$5,$6,$7)`,
   [u,sid(),r.observed_at||null,numeric(r.total_views),numeric(r.identified_views),
    numeric(r.forwards_count),numeric(r.reactions_count)]);return true;
 case 'get_story_data': {
  const story=await one(`SELECT * FROM public.story_pilot_stories WHERE telegram_user_id=$1::bigint
    AND story_id=$2`,[u,sid()]);
  const viewers=await query(`SELECT viewer_user_id,username,display_name,viewed_at,reaction_json,is_contact
   FROM public.story_pilot_viewers WHERE telegram_user_id=$1::bigint
   AND story_id=$2 AND status='confirmed' ORDER BY viewed_at DESC LIMIT 500`,[u,sid()]);
  return {story,viewers};
 }
 case 'get_analytics': {
  const totals=await one(`SELECT COUNT(*)::int AS stories,COALESCE(SUM(last_views_count),0)::int AS views,
   COALESCE(SUM(last_identified_count),0)::int AS identified,
   COALESCE(SUM(last_forwards_count),0)::int AS forwards,
   COALESCE(SUM(last_reactions_count),0)::int AS reactions
   FROM public.story_pilot_stories WHERE telegram_user_id=$1::bigint`,[u]);
  const viewers=await one(`SELECT COUNT(DISTINCT viewer_user_id)::int AS unique_viewers,
    COUNT(*)::int AS total_viewers,
    COUNT(*) FILTER (WHERE is_contact=true)::int AS contacts,
    COUNT(*) FILTER (WHERE is_contact=false)::int AS non_contacts
    FROM public.story_pilot_viewers WHERE telegram_user_id=$1::bigint AND status='confirmed'`,[u]);
  const stories=await query(`SELECT story_id,posted_at,last_views_count,last_identified_count,
    last_reactions_count,last_forwards_count FROM public.story_pilot_stories
    WHERE telegram_user_id=$1::bigint ORDER BY posted_at DESC LIMIT 40`,[u]);
  return {storiesTracked:numeric(totals?.stories),totalViews:numeric(totals?.views),
    identifiedViews:numeric(totals?.identified),unattributedViews:
      Math.max(0,numeric(totals?.views)-numeric(totals?.identified)),
    uniqueViewers:numeric(viewers?.unique_viewers),repeatViewers:Math.max(0,
      numeric(viewers?.total_viewers)-numeric(viewers?.unique_viewers)),
    contacts:numeric(viewers?.contacts),nonContacts:numeric(viewers?.non_contacts),
    reactions:numeric(totals?.reactions),forwards:numeric(totals?.forwards),
    avgDelaySec:null,topPeople:[],storyPerformance:stories,
    latestTimelineStoryId:stories?.[0]?.story_id??null,latestTimeline:[]};
 }
 case 'get_export': {
  const stories=await query(`SELECT * FROM public.story_pilot_stories WHERE telegram_user_id=$1::bigint
    ORDER BY posted_at DESC LIMIT 2000`,[u]);
  const viewers=await query(`SELECT * FROM public.story_pilot_viewers WHERE telegram_user_id=$1::bigint
    ORDER BY viewed_at DESC LIMIT 10000`,[u]);
  return {stories,viewers,generatedAt:new Date().toISOString()};
 }
 default:throw Error('NEON_STORY_OPERATION_NOT_MIGRATED:'+op);
 }
}
