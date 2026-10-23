import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeAgentEvent} from '../lib/vetogram-ai-agent-control.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Agent audit only permits metadata event types and redacts all model text',()=>{
  const event=normalizeAgentEvent({id:'12',kind:'grant_revoked',
    grant_id:'12345678-1234-4123-8123-123456789012',chat_id:'899',
    occurred_at:'2026-10-23T14:00:00Z',
    prompt:'PRIVATE PROMPT',reply:'PRIVATE MESSAGE'});
  assert.deepEqual(Object.keys(event),['id','kind','grantId','chatId','at']);
  assert.equal(event.kind,'grant_revoked');
  assert.ok(!JSON.stringify(event).includes('PRIVATE'));
  assert.throws(()=>normalizeAgentEvent({kind:'unauthorized_send',id:2}),/UNKNOWN_EVENT/);
});
test('SQL journal is metadata only and grant trigger is attached to issue & revoke',()=>{
  const sql=read('migrations/vetogram-ai-agent-control-20261023.sql');
  assert.match(sql,/CREATE TABLE IF NOT EXISTS public.vetogram_ai_agent_events/);
  assert.match(sql,/CREATE TRIGGER vt_ai_grant_events AFTER INSERT OR UPDATE/);
  assert.match(sql,/CREATE TRIGGER vt_ai_guard_grants BEFORE INSERT OR UPDATE/);
  assert.match(sql,/pg_temp/);
  assert.match(sql,/drafting_paused/);
  assert.match(sql,/ON CONFLICT\(owner_id\) DO NOTHING/);
  assert.match(sql,/FOR UPDATE/);
  assert.match(sql,/UPDATE public.vetogram_ai_draft_grants SET revoked_at=now\(\)/);
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.vetogram_ai_issue_draft_grant/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/VALUES\(OLD.owner_id,'grant_revoked',OLD.grant_id,OLD.chat_id\)/);
  assert.match(sql,/IF TG_OP='INSERT' THEN/);
  assert.doesNotMatch(sql,/CREATE TABLE[^;]*(?:prompt_text|message_body|ai_reply|session_ciphertext)/i);
});
test('Owner-only Agent endpoint denies mutating without signed consent',()=>{
  const api=read('api/vetogram-ai-agent.js'),store=read('lib/vetogram-ai-agent-control.js');
  assert.match(api,/validateTelegramMiniApp/);
  assert.match(api,/x-vetogram-agent-consent/);
  assert.match(api,/private, no-store/);
  assert.match(api,/VETOGRAM_AI_GRANTS_ENABLED/);
  assert.match(store,/WHERE owner_id=\$1::bigint ORDER BY id DESC LIMIT 30/);
  assert.match(store,/vetogram_ai_set_drafting_pause\(\$1::bigint,\$2::boolean\)/);
  assert.doesNotMatch(api,/sendOwnerMessage|telegram-send|withBackupClient/);
});
test('Paused grant cannot be considered active by current grant lookup',()=>{
  const grant=read('lib/vetogram-ai-grants.js');
  assert.match(grant,/!r.revoked_at&&!r.drafting_paused/);
  assert.match(grant,/LEFT JOIN public.vetogram_ai_agent_control c/);
  assert.match(grant,/draftingPaused:r.drafting_paused===true/);
});
test('Agent controls in existing Mini App cannot send Telegram messages',()=>{
  const html=read('public/studio.html'),client=read('public/vetogram-ai.js'),router=read('api/router.js');
  for(const id of ['vtaiAgentControl','vtaiAgentRefresh','vtaiAgentState',
    'vtaiAgentPause','vtaiAgentResume','vtaiAgentHistory','vtaiAgentEvents'])
    assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
  assert.match(client,/request\('\/api\/vetogram-ai-agent',\{action:paused\?'pause':'resume'\},'agent'\)/);
  assert.match(client,/request\('\/api\/vetogram-ai-agent',\{action:'history'\}\)/);
  assert.match(client,/x-vetogram-agent-consent/);
  assert.match(router,/"vetogram-ai-agent"/);
});
