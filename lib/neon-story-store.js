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
  const stories=await query(`SELECT story_id,posted_at,last_views_count,last_identified_count,
    last_reactions_count,last_forwards_count,last_sync_at,active
    FROM public.story_pilot_stories WHERE telegram_user_id=$1::bigint
    ORDER BY posted_at DESC LIMIT 100`,[u]);
  const viewers=await query(`SELECT story_id,viewer_user_id,username,display_name,viewed_at,
    reaction_json,is_contact FROM public.story_pilot_viewers
    WHERE telegram_user_id=$1::bigint AND status='confirmed'
    ORDER BY viewed_at DESC LIMIT 3000`,[u]);
  const snapshots=await query(`SELECT story_id,observed_at,total_views,identified_views,reactions_count,
    forwards_count FROM public.story_pilot_viewer_snapshots WHERE telegram_user_id=$1::bigint
    ORDER BY observed_at DESC LIMIT 1000`,[u]);
  const storyMap = new Map(stories.map((story) => [String(story.story_id), story]));
  const people = new Map();

  for (const row of viewers) {
    const viewerId = String(row.viewer_user_id);
    const story = storyMap.get(String(row.story_id));
    const postedAt = story?.posted_at ? new Date(story.posted_at).getTime() : NaN;
    const viewedAt = row.viewed_at ? new Date(row.viewed_at).getTime() : NaN;
    const delaySec = Number.isFinite(postedAt) && Number.isFinite(viewedAt)
      ? Math.max(0, Math.round((viewedAt - postedAt) / 1000))
      : null;

    const current = people.get(viewerId) || {
      viewerUserId: viewerId,
      username: row.username || "",
      displayName: row.display_name || "",
      isContact: Boolean(row.is_contact),
      storyIds: new Set(),
      firstSeenAt: row.viewed_at || null,
      lastSeenAt: row.viewed_at || null,
      delayTotal: 0,
      delayCount: 0,
      fast15Count: 0,
      reactions: 0,
    };

    current.storyIds.add(String(row.story_id));
    if (row.username) current.username = row.username;
    if (row.display_name) current.displayName = row.display_name;
    current.isContact = current.isContact || Boolean(row.is_contact);

    if (row.viewed_at) {
      if (!current.firstSeenAt || new Date(row.viewed_at).getTime() < new Date(current.firstSeenAt).getTime()) {
        current.firstSeenAt = row.viewed_at;
      }
      if (!current.lastSeenAt || new Date(row.viewed_at).getTime() > new Date(current.lastSeenAt).getTime()) {
        current.lastSeenAt = row.viewed_at;
      }
    }

    if (delaySec !== null) {
      current.delayTotal += delaySec;
      current.delayCount += 1;
      if (delaySec <= 15 * 60) current.fast15Count += 1;
    }
    if (row.reaction_json) current.reactions += 1;

    people.set(viewerId, current);
  }

  const scoreStoryDenominator = Math.max(1, Math.min(stories.length, 20));
  const nowMs = Date.now();

  const personRows = [...people.values()].map((person) => {
    const viewedStories = person.storyIds.size;
    const avgDelaySec = person.delayCount ? Math.round(person.delayTotal / person.delayCount) : null;
    const fast15Rate = person.delayCount ? Math.round((person.fast15Count / person.delayCount) * 100) : null;

    const frequency = Math.min(1, viewedStories / scoreStoryDenominator);
    const latency = fast15Rate === null ? 0 : Math.min(1, Math.max(0, fast15Rate / 100));
    const reactionRate = Math.min(1, person.reactions / Math.max(1, viewedStories));
    const lastSeenMs = person.lastSeenAt ? new Date(person.lastSeenAt).getTime() : 0;
    const ageDays = lastSeenMs > 0 ? Math.max(0, (nowMs - lastSeenMs) / 86400000) : Infinity;
    const recency = ageDays <= 1 ? 1
      : ageDays <= 3 ? 0.8
      : ageDays <= 7 ? 0.6
      : ageDays <= 14 ? 0.4
      : ageDays <= 30 ? 0.2
      : 0;
    const confidence = Math.min(1, viewedStories / 5);
    const rawScore = (frequency * 40) + (latency * 25) + (reactionRate * 15) + (recency * 20);
    const activityScore = Math.round(rawScore * (0.55 + 0.45 * confidence));
    const activityBand = activityScore >= 80 ? "very_high"
      : activityScore >= 60 ? "high"
      : activityScore >= 35 ? "medium"
      : "low";

    return {
      viewerUserId: person.viewerUserId,
      username: person.username,
      displayName: person.displayName,
      isContact: person.isContact,
      viewedStories,
      firstSeenAt: person.firstSeenAt,
      lastSeenAt: person.lastSeenAt,
      avgDelaySec,
      fast15Rate,
      reactions: person.reactions,
      activityScore,
      activityBand,
      scoreConfidence: Math.round(confidence * 100),
      scoreFactors: {
        frequency: Math.round(frequency * 100),
        latency: Math.round(latency * 100),
        reactions: Math.round(reactionRate * 100),
        recency: Math.round(recency * 100),
      },
    };
  }).sort((a, b) =>
    (b.activityScore - a.activityScore)
    || (b.viewedStories - a.viewedStories)
    || (new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime())
  );

  const uniqueViewers = personRows.length;
  const repeatViewers = personRows.filter((person) => person.viewedStories >= 2).length;
  const contacts = personRows.filter((person) => person.isContact).length;
  const nonContacts = Math.max(0, uniqueViewers - contacts);

  const delays = personRows
    .map((person) => person.avgDelaySec)
    .filter((value) => Number.isFinite(value));
  const avgDelaySec = delays.length
    ? Math.round(delays.reduce((sum, value) => sum + value, 0) / delays.length)
    : null;

  const totalViews = (stories).reduce((sum, story) => sum + Number(story.last_views_count || 0), 0);
  const identifiedViews = (stories).reduce((sum, story) => sum + Number(story.last_identified_count || 0), 0);
  const unattributedViews = Math.max(0, totalViews - identifiedViews);
  const reactions = (stories).reduce((sum, story) => sum + Number(story.last_reactions_count || 0), 0);
  const forwards = (stories).reduce((sum, story) => sum + Number(story.last_forwards_count || 0), 0);

  const performance = (stories).map((story) => {
    const storyId = String(story.story_id);
    const postedMs = new Date(story.posted_at).getTime();
    const series = (snapshots)
      .filter((point) => String(point.story_id) === storyId)
      .sort((a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime());

    const milestone = (seconds) => {
      if (!Number.isFinite(postedMs) || !series.length) return null;
      const target = postedMs + seconds * 1000;
      const point = series.find((item) => new Date(item.observed_at).getTime() >= target);
      return point ? Number(point.total_views || 0) : null;
    };

    return {
      storyId,
      postedAt: story.posted_at,
      views: Number(story.last_views_count || 0),
      identified: Number(story.last_identified_count || 0),
      reactions: Number(story.last_reactions_count || 0),
      forwards: Number(story.last_forwards_count || 0),
      views5m: milestone(5 * 60),
      views15m: milestone(15 * 60),
      views60m: milestone(60 * 60),
      lastSyncAt: story.last_sync_at || null,
    };
  }).slice(0, 20);

  const latestStory = (stories)[0] || null;
  const latestPostedMs = latestStory?.posted_at ? new Date(latestStory.posted_at).getTime() : NaN;
  const latestTimeline = latestStory
    ? (snapshots)
        .filter((point) => String(point.story_id) === String(latestStory.story_id))
        .sort((a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime())
        .slice(-120)
        .map((point) => {
          const observedMs = new Date(point.observed_at).getTime();
          return {
            observedAt: point.observed_at,
            minutes: Number.isFinite(latestPostedMs) && Number.isFinite(observedMs)
              ? Math.max(0, Math.round((observedMs - latestPostedMs) / 60000))
              : null,
            totalViews: Number(point.total_views || 0),
            identifiedViews: Number(point.identified_views || 0),
            unattributedViews: Math.max(0, Number(point.total_views || 0) - Number(point.identified_views || 0)),
            reactions: Number(point.reactions_count || 0),
            forwards: Number(point.forwards_count || 0),
          };
        })
    : [];

  return {
    storiesTracked: stories.length,
    totalViews,
    identifiedViews,
    unattributedViews,
    uniqueViewers,
    repeatViewers,
    contacts,
    nonContacts,
    reactions,
    forwards,
    avgDelaySec,
    topPeople: personRows.slice(0, 30),
    storyPerformance: performance,
    latestTimelineStoryId: latestStory ? String(latestStory.story_id) : null,
    latestTimeline,
  };
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
