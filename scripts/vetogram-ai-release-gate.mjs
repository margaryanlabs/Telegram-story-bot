import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
import {AI_MIGRATIONS,inspectAiMigrationSources,inspectAiRuntimeContract} from '../lib/vetogram-ai-release-gate.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(join(root,path),'utf8');
const migrationSources=Object.fromEntries(AI_MIGRATIONS.map(x=>[x,read('migrations/'+x)]));
const paths=[
  'api/vetogram-ai.js','api/vetogram-ai-agent.js','api/vetogram-ai-grants.js',
  'api/vetogram-ai-memory.js','api/router.js',
  'lib/vetogram-ai-agent-control.js','lib/vetogram-ai-grants.js',
  'lib/vetogram-ai-quota.js','lib/vetogram-ai-memory-crypto.js',
  'api/vetogram-tasks.js','lib/vetogram-task-cloud-store.js','lib/vetogram-task-cloud-crypto.js'
];
const files=Object.fromEntries(paths.map(x=>[x,read(x)]));
const migrations=inspectAiMigrationSources(migrationSources);
const runtime=inspectAiRuntimeContract(files);
const checks={migrations,runtime};
for(const [name,result] of Object.entries(checks))
  process.stdout.write((result.ok?'PASS':'FAIL')+' '+name+
    (result.failures.length?' — '+result.failures.join(', '):'')+'\n');
process.stdout.write('\nOFFLINE STATIC PREFLIGHT ONLY: No Postgres SQL was executed, no secrets tested, no provider called.\n');
process.stdout.write('Not a deploy authorization. Run full tests, disposable Postgres migrations, provider and Telegram E2E separately.\n');
if(!migrations.ok||!runtime.ok)process.exitCode=1;
