import {readFile, readdir, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const html=await readFile(path.join(root,'index.html'),'utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if(!code)throw Error('Original universe runtime is missing');
new Script(code,{filename:'index.html:inline'});
for(const file of await readdir(path.join(root,'v10'))){
 if(file.endsWith('.js'))new Script(await readFile(path.join(root,'v10',file),'utf8'),{filename:file});
}
for(const match of html.matchAll(/(?:src|href)="(v10\/[^"?#]+)"/g)){
 if(!(await stat(path.join(root,match[1]))).isFile())throw Error('Missing asset '+match[1]);
}
const shell=html.slice(0,html.indexOf('<script'));
const ids=[...shell.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
if(ids.length!==new Set(ids).size)throw Error('Duplicate ID in static shell');
if(!html.includes('THE MARKET REMEMBERS V12 — RELEASE CANDIDATE'))throw Error('V12 release-candidate title is missing');
if(!html.includes('v10/cosmic-awakening.css'))throw Error('V11 visual layer is missing');
if(!html.includes('float planeA=abs(dot(vObject'))throw Error('Native V11 orbital shader is missing');
if(!html.includes('v10/star-passage-v11.css')||!html.includes('id="v114PassageQuote"'))throw Error('V11.4 passage scene or narrative cue is missing');
if(!html.includes('v10/memory-atlas-v11.css')||!html.includes('archiveSelect:(filter,query)=>v79SelectArchive'))throw Error('V11.5 archive atlas or canonical search binding is missing');
if(!html.includes('v10/memory-trails-v11.css')||!html.includes('v10/memory-trails.js'))throw Error('V11.6 memory trails assets missing');
if(!html.includes('v10/explainable-constellations-v11.css'))throw Error('V11.7 evidence map stylesheet is missing');
// An old or partially cherry-picked entrypoint silently breaks the actual reader.
const moduleOrder=[
  'memory-data.js','motion-system.js','universe-atmosphere.js',
  'constellation-system.js','story-experience.js','memory-archive.js',
  'legacy-submission.js','navigation.js','memory-trails.js','living-universe.js'
];
let previous=-1;
for(const name of moduleOrder){
  const asset='<script src="v10/'+name+'"></script>';
  if(html.split(asset).length!==2)throw Error('Missing or duplicated runtime module '+name);
  const at=html.indexOf(asset);
  if(at<=previous)throw Error('Incorrect module load order around '+name);
  previous=at;
}
const packageData=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
if(packageData.version!=='12.0.0-rc.6')throw Error('V12 release metadata is out of sync');
for(const name of ['cosmic-awakening.css','star-passage-v11.css','memory-atlas-v11.css','memory-trails-v11.css','explainable-constellations-v11.css']){
  if(!html.includes('<link rel="stylesheet" href="v10/'+name+'">'))throw Error('Missing release stylesheet '+name);
}
if(!html.includes('v10/v12-cinematic.css'))throw Error('V12 RC2 cinematic layer missing');
if(!html.includes('v10/v12-reading-polish.css'))throw Error('V12 RC3 reader polish stylesheet missing');
if(!html.includes('v10/v12-depth-field.css')||!html.includes('class="v124-depth-field"'))throw Error('V12 RC4 native sphere depth layer missing');
if(!html.includes('v10/v12-universe-cinema.css'))throw Error('V12 RC6 cinematic universe layer missing');
if(!html.includes('v10/v12-universe-depth-v2.css')||!html.includes('class="v127-space-field"'))throw Error('V12 cosmic depth field v2 is missing');
const cosmicDepth=await readFile(path.join(root,'v10','v12-universe-depth-v2.css'),'utf8');
const spiralArt=await readFile(path.join(root,'v10','v12-cinematic-galaxy.svg'),'utf8');
if(!cosmicDepth.includes('url("v12-cinematic-galaxy.svg")')||
   !spiralArt.startsWith('<svg ')||
   !spiralArt.includes('id="galaxyCore"')||
   !spiralArt.trimEnd().endsWith('</svg>'))
  throw Error('V12 real structured galaxy background is missing or incomplete');
if(!html.includes('float volumeChord=')||
   !html.includes('vec3 accumulatedNebula=')||
   !html.includes('transmittance*='))
  throw Error('V12 true volumetric shader pass is missing');

if(!html.includes('float nebulaNoise3(vec3 p)')||!html.includes('float goldZone='))throw Error('V12 high depth nebula globe material missing');
console.log('V12 RC6 lint: cumulative engine, ordered modules, all visual layers, local-only data and shell IDs valid.');
