import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const project=process.cwd();
const manifest=JSON.parse(readFileSync(resolve(project,'package.json'),'utf8'));
const lock=JSON.parse(readFileSync(resolve(project,'package-lock.json'),'utf8'));
const declared={...manifest.dependencies,...manifest.optionalDependencies,...manifest.devDependencies};
const resolved=lock.packages?.[''] || {};
const locked={...resolved.dependencies,...resolved.optionalDependencies,...resolved.devDependencies};
const mismatches=Object.entries(declared).filter(([name,spec])=>locked[name]!==spec);
if(lock.lockfileVersion<2) {
  console.error('VETOGRAM_LOCKFILE_TOO_OLD: lockfileVersion must be 2 or newer.');
  process.exitCode=1;
}
if(mismatches.length) {
  console.error('VETOGRAM_LOCKFILE_OUTDATED: package.json and package-lock.json disagree on',mismatches.length,'direct dependencies:');
  for(const [name] of mismatches) console.error('  -',name,'(lockfile missing or different)');
  console.error('In a network-enabled trusted checkout, run: npm run lock:refresh');
  process.exitCode=1;
} else {
  console.log('Direct dependency manifest and package-lock root agree; npm ci still must verify full integrity.');
}
