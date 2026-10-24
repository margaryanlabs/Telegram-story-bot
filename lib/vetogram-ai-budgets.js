// VETOGRAM AI quota policy, independent of storage/network for deterministic tests.
// 1 unit is a conservative upper bound: UTF-8 bytes of JSON context + output cap.
// Units are NOT billed tokens or USD; provider invoices must still be monitored.
export const MAX_AI_OUTPUT_TOKENS=700;
export function configuredAiCaps(env={}){
  const integer=(key,fallback,min,max)=>{
    const raw=env[key];
    if(raw===undefined||raw===null||raw==='')return fallback;
    const n=Number(raw);
    if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('VETOGRAM_AI_QUOTA_CONFIG_INVALID');
    return n;
  };
  return {
    ownerRequests:integer('VETOGRAM_AI_DAILY_REQUEST_LIMIT',8,1,500),
    ownerUnits:integer('VETOGRAM_AI_DAILY_OWNER_UNITS',80000,1000,5000000),
    globalUnits:integer('VETOGRAM_AI_DAILY_GLOBAL_UNITS',1000000,1000,100000000)
  };
}
export function estimateAiUnits(parsed,instruction='',userPrompt=undefined){
  if(!parsed||!['chat','translate','reply','story','campaign','negotiator','action','brief'].includes(parsed.mode))throw Error('AI_MODE_INVALID');
  // Measure the EXACT user-facing prompt, including consented notes. Otherwise
  // a long note selection could consume provider usage without being reserved.
  const payload=JSON.stringify({instruction,prompt:typeof userPrompt==='string'?userPrompt:parsed.prompt,notes:parsed.notes||[],history:parsed.history||[]});
  if(payload.length>15000)throw Error('AI_CONTEXT_TOO_LARGE');
  return Buffer.byteLength(payload,'utf8')+MAX_AI_OUTPUT_TOKENS;
}
export function aiQuotaErrorKind(error){
  const msg=String(error?.message||'');
  if(msg.includes('VETOGRAM_AI_OWNER_LIMIT'))return 'owner';
  if(msg.includes('VETOGRAM_AI_GLOBAL_LIMIT'))return 'global';
  return 'unavailable';
}
