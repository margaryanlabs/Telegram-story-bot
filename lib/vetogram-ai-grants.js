import {randomUUID} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {makeNegotiationPolicy} from '../public/vetogram-negotiator-core.js';
const ownerId=value=>{
  const id=String(value??'');if(!/^\d{1,20}$/.test(id)||id==='0')throw Error('AI_GRANT_INVALID_OWNER');return id;
};
const validGrantId=id=>typeof id==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
function conn(){
  if(process.env.VETOGRAM_AI_GRANTS_ENABLED!=='true')throw Error('AI_GRANTS_DISABLED');
  const url=String(process.env.VETO_NEON_DATABASE_URL||'');
  if(!/^postgres(?:ql)?:\/\//.test(url))throw Error('AI_GRANTS_DB_UNAVAILABLE');
  return neon(url);
}
function toPublic(r){
  if(!r)return null;
  return {grantId:String(r.grant_id),chatId:String(r.chat_id),currency:r.currency,
    askingCents:Number(r.asking_cents),minCents:Number(r.min_cents),
    maxDiscountPct:Number(r.max_discount),expiresAt:new Date(r.expires_at).toISOString(),
    active:!r.revoked_at&&!r.drafting_paused&&Date.parse(r.expires_at)>Date.now(),
    draftingPaused:r.drafting_paused===true,
    mode:'approval-only'};
}
export async function issueAiDraftGrant(owner,fields){
  const uid=ownerId(owner);
  const p=makeNegotiationPolicy({...fields,owner:uid,now:Date.now()});
  const sql=conn(),grantId=randomUUID();
  const rows=await sql.query(
    `INSERT INTO public.vetogram_ai_draft_grants(
      owner_id,grant_id,chat_id,currency,min_cents,asking_cents,max_discount,created_at,expires_at,revoked_at,mode)
    VALUES($1::bigint,$2::uuid,$3,$4,$5::bigint,$6::bigint,$7::integer,now(),now()+($8::integer*interval '1 minute'),NULL,'approval-only')
    ON CONFLICT(owner_id) DO UPDATE SET
      grant_id=EXCLUDED.grant_id,chat_id=EXCLUDED.chat_id,currency=EXCLUDED.currency,
      min_cents=EXCLUDED.min_cents,asking_cents=EXCLUDED.asking_cents,
      max_discount=EXCLUDED.max_discount,created_at=now(),expires_at=EXCLUDED.expires_at,
      revoked_at=NULL,mode='approval-only'
    RETURNING *`,
    [uid,grantId,p.chatId,p.currency,p.minCents,p.askingCents,p.discountPct,
      Math.round((p.expiresAt-p.createdAt)/60000)]);
  if(rows.length!==1)throw Error('AI_GRANT_WRITE_FAILED');
  return toPublic(rows[0]);
}
export async function getAiDraftGrant(owner,grantId=null){
  const uid=ownerId(owner),sql=conn();
  if(grantId!==null&&!validGrantId(grantId))throw Error('AI_GRANT_INVALID_ID');
  const rows=await sql.query(
    `SELECT g.*,COALESCE(c.drafting_paused,false) AS drafting_paused
       FROM public.vetogram_ai_draft_grants g
       LEFT JOIN public.vetogram_ai_agent_control c ON c.owner_id=g.owner_id
      WHERE g.owner_id=$1::bigint AND ($2::uuid IS NULL OR g.grant_id=$2::uuid)
      LIMIT 1`,[uid,grantId]);
  return toPublic(rows[0]);
}
export async function revokeAiDraftGrant(owner,grantId){
  const uid=ownerId(owner);
  if(!validGrantId(grantId))throw Error('AI_GRANT_INVALID_ID');
  const rows=await conn().query(
    `UPDATE public.vetogram_ai_draft_grants SET revoked_at=now()
      WHERE owner_id=$1::bigint AND grant_id=$2::uuid AND revoked_at IS NULL
      RETURNING grant_id`,[uid,grantId]);
  return {revoked:rows.length>0};
}
export function trustedGrantPolicy(owner,grant,chatId){
  if(!grant?.active||grant.mode!=='approval-only'||String(grant.chatId)!==String(chatId))
    throw Error('AI_GRANT_NOT_ACTIVE');
  const price=Number(grant.askingCents),floor=Number(grant.minCents);
  if(!Number.isSafeInteger(price)||!Number.isSafeInteger(floor)||floor<1||floor>price)
    throw Error('AI_GRANT_CORRUPT');
  return {owner:ownerId(owner),chatId:String(chatId),currency:grant.currency,
    askingCents:price,minCents:floor,discountPct:grant.maxDiscountPct,
    createdAt:0,expiresAt:Date.parse(grant.expiresAt),mode:'approval-only'};
}
