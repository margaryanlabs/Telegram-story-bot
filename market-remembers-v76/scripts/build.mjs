import './check.mjs';
import {mkdir,cp,rm,writeFile} from 'node:fs/promises';
const output=new URL('../dist/',import.meta.url);
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(new URL('../index.html',import.meta.url),new URL('index.html',output));
await cp(new URL('../v10/',import.meta.url),new URL('v10/',output),{recursive:true});
// Public metadata describes deployment composition, not operational health.
const release={
  project:'The Market Remembers',
  version:'12.0.0-rc.6',
  stage:'review-preview',
  builtAt:new Date().toISOString(),
  deployment:'static',
  production:false,
  publishing:'local-browser-only',
  savedRoutes:'opt-in, browser-only',
  sections:['universe','archive','legacy','create','story'],
  modules:['living-universe','story-experience','constellation-system',
           'memory-archive','memory-trails','navigation']
};
await writeFile(new URL('release.json',output),JSON.stringify(release,null,2)+'\n');
console.log('V12 RC6 build: standalone static preview and release.json generated. Production untouched.');
