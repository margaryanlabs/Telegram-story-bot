import {neon} from '@neondatabase/serverless';

const validOwner=value=>{
  const id=String(value??'');
  if(!/^\d{1,20}$/.test(id)||id==='0')throw Error('AI_AGENT_INVALID_OWNER');
  return id;
};
const sqlConn=()=>{
  if(process.env.VETOGRAM_AI_GRANTS_ENABLED!=='true')throw Error('AI_AGENT_NOT_ENABLED');
  const url=String(process.env.VETO_NEON_DATABASE_URL||'');
  if(!/^postgres(?:ql)?:\/\//.test(url))throw Error('AI_AGENT_DB_UNAVAILABLE');
  return neon(url);
};
export function normalizeAgentEvent(row){
  if(!row||!['grant_issued','grant_revoked','drafting_paused','drafting_resumed'].includes(row.kind))
    throw Error('AI_AGENT_UNKNOWN_EVENT');
  return {
    id:String(row.id),kind:row.kind,
    grantId:row.grant_id==null?null:String(row.grant_id),
    chatId:row.chat_id==null?null:String(row.chat_id),
    at:new Date(row.occurred_at).toISOString()
  };
}
export async function getAiAgentStatus(owner){
  const id=validOwner(owner),sql=sqlConn();
  const rows=await sql.query(
    'SELECT drafting_paused,updated_at FROM public.vetogram_ai_agent_control WHERE owner_id=$1::bigint',
    [id]);
  return {draftingPaused:rows[0]?.drafting_paused===true,
    updatedAt:rows[0]?.updated_at??null,
    scope:'draft-only',automaticSending:false};
}
export async function setAiAgentPause(owner,paused){
  const id=validOwner(owner);
  if(typeof paused!=='boolean')throw Error('AI_AGENT_INVALID_PAUSE');
  const result=await sqlConn().query(
    'SELECT public.vetogram_ai_set_drafting_pause($1::bigint,$2::boolean) AS result',
    [id,paused]);
  const status=result[0]?.result;
  if(!status||status.draftingPaused!==paused)throw Error('AI_AGENT_BAD_RESULT');
  return {draftingPaused:status.draftingPaused,changed:status.changed===true,
    scope:'draft-only',automaticSending:false};
}
export async function listAiAgentEvents(owner){
  const id=validOwner(owner),sql=sqlConn();
  const rows=await sql.query(
    'SELECT id,kind,grant_id,chat_id,occurred_at FROM public.vetogram_ai_agent_events WHERE owner_id=$1::bigint ORDER BY id DESC LIMIT 30',
    [id]);
  return rows.map(normalizeAgentEvent);
}
