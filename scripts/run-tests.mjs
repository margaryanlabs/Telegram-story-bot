import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

// Existing tests mock the legacy Supabase signed-store transport.
// Preserve that unit-test contract while independently probing the Neon staging DB.
const files=readdirSync('tests').filter(name=>name.endsWith('.test.js') && name!=='neon-runtime-smoke.test.js').sort();
function suite(names,env) {
 const result=spawnSync(process.execPath,['--test',...names.map(name=>'tests/'+name)],{
  stdio:'inherit',env:{...process.env,...env},
 });
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}
suite(files,{VETO_STORAGE_PROVIDER:'supabase'});
if(process.env.VETO_STORAGE_PROVIDER==='neon'){
 suite(['neon-runtime-smoke.test.js'],{VETO_STORAGE_PROVIDER:'neon'});
}
