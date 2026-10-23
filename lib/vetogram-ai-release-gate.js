// Offline-only VETOGRAM AI release gate. No network, DB connections or deploys.
export const AI_MIGRATIONS=Object.freeze([
  'vetogram-ai-usage-20261023.sql',
  'vetogram-ai-memory-20261023.sql',
  'vetogram-ai-draft-grants-20261023.sql',
  'vetogram-ai-agent-control-20261023.sql'
]);
export function inspectAiMigrationSources(sources){
  const failures=[];
  const get=name=>{
    const value=sources?.[name];
    if(typeof value!=='string'||value.length<200)failures.push('MISSING_MIGRATION:'+name);
    return String(value||'');
  };
  const usage=get(AI_MIGRATIONS[0]),memory=get(AI_MIGRATIONS[1]),
    grants=get(AI_MIGRATIONS[2]),control=get(AI_MIGRATIONS[3]);
  const requireText=(test,ok)=>{if(!ok)failures.push(test)};
  requireText('USAGE_ATOMIC_RESERVATIONS',
    usage.includes('pg_advisory_xact_lock')&&usage.includes('VETOGRAM_AI_OWNER_LIMIT')&&
    usage.includes('VETOGRAM_AI_GLOBAL_LIMIT'));
  requireText('MEMORY_STORED_AS_CIPHER',
    memory.includes('encrypted_snapshot text NOT NULL')&&memory.includes('REVOKE ALL ON TABLE'));
  requireText('GRANTS_APPROVAL_ONLY',
    grants.includes("mode='approval-only'")&&grants.includes('revoked_at'));
  const issueStart=control.indexOf('CREATE OR REPLACE FUNCTION public.vetogram_ai_issue_draft_grant');
  const pauseStart=control.indexOf('CREATE OR REPLACE FUNCTION public.vetogram_ai_set_drafting_pause');
  const issue=control.slice(issueStart,pauseStart>issueStart?pauseStart:undefined);
  const pause=control.slice(pauseStart);
  for(const [label,source] of [['ISSUE',issue],['PAUSE',pause]]){
    const advisory=source.indexOf("pg_advisory_xact_lock(hashtext('vetogram-ai-agent:'");
    const lock=source.indexOf('WHERE owner_id=p_owner_id FOR UPDATE');
    const grantMutation=label==='ISSUE'
      ?source.indexOf('INSERT INTO public.vetogram_ai_draft_grants')
      :source.indexOf('UPDATE public.vetogram_ai_draft_grants SET revoked_at=now()');
    requireText(label+'_LOCK_ORDER',advisory>=0&&lock>advisory&&grantMutation>lock);
  }
  requireText('GRANT_AUDIT_ISSUE_REVOKE',control.includes("VALUES(OLD.owner_id,'grant_revoked',OLD.grant_id,OLD.chat_id)")&&
    control.includes("VALUES(NEW.owner_id,'grant_issued',NEW.grant_id,NEW.chat_id)"));
  requireText('ISSUE_CONTROL_TRIGGER',control.includes('CREATE TRIGGER vt_ai_guard_grants BEFORE INSERT OR UPDATE'));
  requireText('PAUSE_REVOKE_ATOMIC',control.includes('SELECT drafting_paused INTO previous')&&
    control.includes("VALUES(p_owner_id,CASE WHEN p_pause THEN 'drafting_paused'"));
  requireText('OWNER_SCOPED_AUDIT',control.includes('vetogram_ai_agent_events_owner_idx')&&control.includes('REVOKE ALL ON TABLE public.vetogram_ai_agent_events'));
  return {ok:failures.length===0,failures,migrations:[...AI_MIGRATIONS]};
}
export function inspectAiRuntimeContract(files){
  const failures=[];
  const contains=(name,text)=>String(files?.[name]||'').includes(text);
  const necessary=[
    ['AI_OWNER_AUTH','api/vetogram-ai.js','validateTelegramMiniApp'],
    ['AI_QUOTA_BEFORE_PROVIDER','api/vetogram-ai.js','reserveAiBudget(owner.id,parsed,instruction'],
    ['AI_PERMISSION_CONSENT','api/vetogram-ai-grants.js','x-vetogram-grant-consent'],
    ['AGENT_OWNER_AUTH','api/vetogram-ai-agent.js','validateTelegramMiniApp'],
    ['AGENT_MUTATION_CONSENT','api/vetogram-ai-agent.js','x-vetogram-agent-consent'],
    ['AGENT_STATUS_LIMIT','lib/vetogram-ai-agent-control.js','ORDER BY id DESC LIMIT 30'],
    ['AGENT_PAUSE_FUNCTION','lib/vetogram-ai-agent-control.js','vetogram_ai_set_drafting_pause'],
    ['GRANT_ISSUE_PROCEDURE','lib/vetogram-ai-grants.js','vetogram_ai_issue_draft_grant'],
    ['GRANT_CURRENT_PAUSE_CHECK','lib/vetogram-ai-grants.js','!r.revoked_at&&!r.drafting_paused'],
    ['GRANT_REVALIDATE','api/vetogram-ai.js','getAiDraftGrant(owner.id,draftingGrant.grantId)'],
    ['MEMORY_ENCRYPTED','lib/vetogram-ai-memory-crypto.js',"createCipheriv('aes-256-gcm'"],
    ['AI_FAIL_CLOSED','api/vetogram-ai.js',"VETOGRAM_AI_ENABLED!=='true'"],
    ['QUOTA_FAIL_CLOSED','lib/vetogram-ai-quota.js',"VETOGRAM_AI_QUOTA_READY!=='true'"],
    ['MEMORY_FAIL_CLOSED','api/vetogram-ai-memory.js',"VETOGRAM_AI_MEMORY_ENABLED!=='true'"]
  ];
  for(const [test,file,fragment] of necessary)if(!contains(file,fragment))failures.push(test);
  for(const endpoint of ['api/vetogram-ai.js','api/vetogram-ai-agent.js','api/vetogram-ai-grants.js','api/vetogram-ai-memory.js']){
    if(/sendOwnerMessage|sendRichTelegramMessage|withBackupClient/.test(String(files?.[endpoint]||'')))
      failures.push('UNEXPECTED_SEND_CAPABILITY:'+endpoint);
  }
  const route=String(files?.['api/router.js']||'');
  for(const key of ['vetogram-ai','vetogram-ai-agent','vetogram-ai-memory','vetogram-ai-grants'])
    if(!route.includes('"'+key+'":'))failures.push('MISSING_ROUTE:'+key);
  return {ok:failures.length===0,failures};
}
