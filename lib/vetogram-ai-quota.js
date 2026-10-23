import {neon} from '@neondatabase/serverless';
import {configuredAiCaps,estimateAiUnits,aiQuotaErrorKind} from './vetogram-ai-budgets.js';

// Durable atomic reservation. No database/migration => AI stays unavailable.
export async function reserveAiBudget(ownerId,parsed,instruction,env=process.env){
  const id=String(ownerId||'');
  if(!/^\d{1,20}$/.test(id)||id==='0')throw Error('VETOGRAM_AI_OWNER_INVALID');
  if(env.VETOGRAM_AI_QUOTA_READY!=='true')throw Error('VETOGRAM_AI_QUOTA_NOT_READY');
  const url=String(env.VETO_NEON_DATABASE_URL||'');
  if(!/^postgres(?:ql)?:\/\//.test(url))throw Error('VETOGRAM_AI_QUOTA_DB_MISSING');
  const caps=configuredAiCaps(env);
  const units=estimateAiUnits(parsed,instruction);
  if(units>25000||units>caps.ownerUnits||units>caps.globalUnits)throw Error('VETOGRAM_AI_QUOTA_INPUT_TOO_LARGE');
  const sql=neon(url);
  const rows=await sql.query(
    'SELECT public.vetogram_ai_reserve_budget($1::bigint,$2::integer,$3::integer,$4::bigint,$5::bigint) AS quota',
    [id,units,caps.ownerRequests,caps.ownerUnits,caps.globalUnits]);
  const item=rows?.[0]?.quota;
  if(!item||!Number.isInteger(Number(item.ownerRemainingRequests)))throw Error('VETOGRAM_AI_QUOTA_INVALID_RESPONSE');
  return {
    utcDay:item.utcDay,
    ownerRemainingRequests:Number(item.ownerRemainingRequests),
    ownerRemainingUnits:Number(item.ownerRemainingUnits),
    globalRemainingUnits:Number(item.globalRemainingUnits),
    reservedUnits:units
  };
}
export {aiQuotaErrorKind};
