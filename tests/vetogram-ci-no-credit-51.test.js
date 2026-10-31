/* VETOGRAM free verification must never create an automatic paid job.
 * Static source audit only: node:test + node:fs, no external API.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('main GitHub verification only runs after explicit manual authorization',()=>{
  const workflow=read('.github/workflows/vetogram-verification.yml');
  assert.match(workflow,/^on:\s*\n\s+workflow_dispatch:\s*$/m);
  assert.doesNotMatch(workflow,/^\s+(?:push|pull_request|schedule|workflow_run):/m);
  assert.match(workflow,/contents: read/);
  assert.match(workflow,/npm ci --no-audit --no-fund/);
});

test('VETOGRAM zero-credit QA uses only existing Node.js runtime',()=>{
  const pkg=JSON.parse(read('package.json'));
  const command=pkg.scripts['qa:free'];
  assert.ok(command&&command.startsWith('node --check '));
  assert.match(command,/node --test/);
  assert.doesNotMatch(command,/npm (?:ci|install|run vercel-build)|npx|vercel deploy|curl|wget/);
  assert.match(command,/tests\/vetogram-ci-no-credit-51\.test\.js/);
});

test('preview/production deploy is not part of zero-credit test suite',()=>{
  const command=JSON.parse(read('package.json')).scripts['qa:free'];
  assert.doesNotMatch(command,/deploy|--prod|promote|build/);
});
