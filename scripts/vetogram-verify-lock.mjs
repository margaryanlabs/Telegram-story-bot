import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {auditNpmLock} from '../lib/vetogram-lock-audit.js';

const project=process.cwd();
const manifest=JSON.parse(readFileSync(resolve(project,'package.json'),'utf8'));
const lock=JSON.parse(readFileSync(resolve(project,'package-lock.json'),'utf8'));
const result=auditNpmLock(manifest,lock);
if(!result.versionValid)console.error('VETOGRAM_LOCKFILE_TOO_OLD: lockfileVersion must be >=2.');
if(result.mismatches.length){
  console.error('VETOGRAM_LOCKFILE_OUTDATED: manifest and lockfile root differ:');
  for(const value of result.mismatches)
    console.error('  -',value.name,'expected',value.required,'locked',value.locked??'(missing)');
}
if(result.missingPackages.length){
  console.error('VETOGRAM_LOCKFILE_MISSING_PACKAGES: missing npm resolution entries:');
  for(const name of result.missingPackages)console.error('  -',name);
}
if(!result.ok){
  console.error('Repair in a network-enabled trusted checkout: npm run lock:refresh');
  console.error('Then: npm run lock:check && npm ci --ignore-scripts --no-audit --no-fund');
  console.error('Commit the regenerated package-lock.json in the existing draft PR.');
  process.exitCode=1;
}else console.log('VETOGRAM_LOCKFILE_OK: direct specs and resolution entries match ('+
  result.declaredCount+' direct dependencies). npm ci must still verify integrity.');
