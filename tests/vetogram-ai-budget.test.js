import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {configuredAiCaps,estimateAiUnits,aiQuotaErrorKind,MAX_AI_OUTPUT_TOKENS}
  from '../lib/vetogram-ai-budgets.js';
import {normalizeAiInput,systemInstruction} from '../lib/vetogram-ai-core.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('AI budget defaults are finite and invalid overrides fail closed',()=>{
  assert.deepEqual(configuredAiCaps({}),{ownerRequests:8,ownerUnits:80000,globalUnits:1000000});
  for(const invalid of ['-1','0','1000000','x','1.5'])
    assert.throws(()=>configuredAiCaps({VETOGRAM_AI_DAILY_REQUEST_LIMIT:invalid}),/QUOTA_CONFIG_INVALID/);
});
test('conservative units include Unicode, bounded context and output allowance',()=>{
  const one=normalizeAiInput({mode:'chat',prompt:'Hello',history:[]});
  const bigger=normalizeAiInput({mode:'chat',prompt:'Привет! 👋',history:[{role:'assistant',text:'Мир'}]});
  const a=estimateAiUnits(one,systemInstruction('chat'));
  const b=estimateAiUnits(bigger,systemInstruction('chat'));
  assert.ok(a>MAX_AI_OUTPUT_TOKENS);
  assert.ok(b>a);
  assert.ok(b<25000);
  const withNotes={...bigger,notes:['Long chosen note '.repeat(22)]};
  assert.ok(estimateAiUnits(withNotes,systemInstruction('chat'),withNotes.prompt+' '+withNotes.notes.join(' '))>b);
});
test('quota classification never leaks secrets or prompts',()=>{
  assert.equal(aiQuotaErrorKind(new Error('VETOGRAM_AI_OWNER_LIMIT')),'owner');
  assert.equal(aiQuotaErrorKind(new Error('VETOGRAM_AI_GLOBAL_LIMIT')),'global');
  assert.equal(aiQuotaErrorKind(new Error('password')),'unavailable');
});
test('AI endpoint must reserve before external provider call',()=>{
  const src=read('api/vetogram-ai.js');
  assert.match(src,/reserveAiBudget\(owner.id,parsed,instruction,process.env,userPrompt\)/);
  assert.ok(src.indexOf('reserveAiBudget(owner.id,parsed,instruction,process.env,userPrompt)') <
    src.indexOf("fetch('https://generativelanguage.googleapis.com/"));
  assert.match(src,/VETOGRAM_AI_ENABLED/);
  assert.match(src,/quota:\{utcDay:/);
});
test('Neon SQL quota protects simultaneous instances and rolls back global on user denial',()=>{
  const sql=read('migrations/vetogram-ai-usage-20261023.sql');
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/ON CONFLICT \(day_utc, owner_id\) DO UPDATE/g);
  assert.match(sql,/VETOGRAM_AI_OWNER_LIMIT/);
  assert.match(sql,/VETOGRAM_AI_GLOBAL_LIMIT/);
  assert.match(sql,/REVOKE ALL ON FUNCTION/);
  assert.doesNotMatch(sql,/prompt_text|message_text|provider_key|output_text/i);
});
test('API quota is not bypassed without Neon migration and explicit ready flag',()=>{
  const source=read('lib/vetogram-ai-quota.js');
  assert.match(source,/VETOGRAM_AI_QUOTA_READY/);
  assert.match(source,/VETO_NEON_DATABASE_URL/);
  assert.match(source,/SELECT public.vetogram_ai_reserve_budget/);
  assert.match(source,/VETOGRAM_AI_QUOTA_INVALID_RESPONSE/);
});
test('Story AI handoff waits for owner and async draft initialization',()=>{
  const story=read('public/story-engine.js'),ui=read('public/vetogram-ai.js');
  assert.match(story,/async function applyAiStorySuggestion/);
  assert.match(story,/await init\(\)/);
  assert.match(story,/owner\(\)!==requestedOwner/);
  assert.match(story,/window.VetoTelegramApplyAiStory=applyAiStorySuggestion/);
  assert.match(ui,/await window.VetoTelegramApplyAiStory/);
  assert.match(ui,/if\(!applied\)return notice/);
});
