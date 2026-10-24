import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AI_MIGRATIONS,inspectAiMigrationSources,inspectAiRuntimeContract}
  from '../lib/vetogram-ai-release-gate.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migrations=()=>Object.fromEntries(AI_MIGRATIONS.map(name=>[name,read('migrations/'+name)]));
const runtimeFiles=[
  'api/vetogram-ai.js','api/vetogram-ai-agent.js','api/vetogram-ai-grants.js',
  'api/vetogram-ai-memory.js','api/router.js',
  'lib/vetogram-ai-agent-control.js','lib/vetogram-ai-grants.js',
  'lib/vetogram-ai-quota.js','lib/vetogram-ai-memory-crypto.js',
  'api/vetogram-tasks.js','lib/vetogram-task-cloud-store.js',
  'lib/vetogram-task-cloud-crypto.js',
  'api/vetogram-reminders.js','api/vetogram-reminder-worker.js',
  'lib/vetogram-reminder-store.js','lib/vetogram-reminder-core.js'
];
const runtime=()=>Object.fromEntries(runtimeFiles.map(name=>[name,read(name)]));

test('release gate recognizes staged migration order and fails closed for missing SQL',()=>{
  const good=inspectAiMigrationSources(migrations());
  assert.deepEqual(good.failures,[]);
  const missing=migrations();delete missing[AI_MIGRATIONS[3]];
  assert.equal(inspectAiMigrationSources(missing).ok,false);
});
test('release gate detects inverted grant/pause locks to prevent deadlocks',()=>{
  const bad=migrations();
  bad[AI_MIGRATIONS[3]]=bad[AI_MIGRATIONS[3]].replace(
    "PERFORM pg_advisory_xact_lock(hashtext('vetogram-ai-agent:' || p_owner_id::text)::bigint);",
    "PERFORM pg_advisory_xact_lock(0);");
  const result=inspectAiMigrationSources(bad);
  assert.equal(result.ok,false);
  assert.ok(result.failures.includes('ISSUE_LOCK_ORDER'));
});
test('release gate guards API auth, grant rechecks, quotas, and absence of sender tools',()=>{
  const good=inspectAiRuntimeContract(runtime());
  assert.deepEqual(good.failures,[]);
  const bad=runtime();
  bad['api/vetogram-ai.js']+='\\nconst ignored=sendOwnerMessage;';
  assert.equal(inspectAiRuntimeContract(bad).ok,false);
  const missing=runtime();missing['lib/vetogram-ai-grants.js']='';
  assert.ok(inspectAiRuntimeContract(missing).failures.includes('GRANT_ISSUE_PROCEDURE'));
});


test('release CI checks the draft PR once, without duplicate push runs',()=>{
  const workflow=read('.github/workflows/vetogram-ai-ci.yml');
  assert.match(workflow,/^on:\s*\n  pull_request:\s*\n/m);
  assert.doesNotMatch(workflow,/^  push:/m);
  assert.match(workflow,/branches: \[feat\/vetogram-story-engine-20261022\]/);
  assert.match(workflow,/types: \[opened, synchronize, reopened, ready_for_review\]/);
  for(const job of ['offline-contracts','node-tests','disposable-postgres'])
    assert.match(workflow,new RegExp('^  '+job+':','m'));
  assert.match(workflow,/npm run ci:offline/);
  assert.match(workflow,/bash scripts\/vetogram-task-reminder-race\.sh/);
});
