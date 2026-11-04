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
if(!html.includes('THE MARKET REMEMBERS V11 — COSMIC AWAKENING'))throw Error('V11 title is missing');
if(!html.includes('v10/cosmic-awakening.css'))throw Error('V11 visual layer is missing');
if(!html.includes('float planeA=abs(dot(vObject'))throw Error('Native V11 orbital shader is missing');
if(!html.includes('v10/star-passage-v11.css')||!html.includes('id="v114PassageQuote"'))throw Error('V11.4 passage scene or narrative cue is missing');
if(!html.includes('v10/memory-atlas-v11.css')||!html.includes('archiveSelect:(filter,query)=>v79SelectArchive'))throw Error('V11.5 archive atlas or canonical search binding is missing');
console.log('V11.5 lint: original engine, story passage, canonical archive atlas, local assets and shell IDs valid.');
