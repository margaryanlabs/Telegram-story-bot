/* Deployment-only public mirror. Canonical development: margaryanlabs/Marketremember */
import {mkdir,cp,rm,readFile,writeFile,stat} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const dist=new URL('../dist/',import.meta.url);
for(const asset of ['universe.html','index.html','v10/v22-universe-hub.js','v10/v22-universe-hub.css','v10/market-history-modes.js','v10/shock-replay-2008.js','v10/people-mirror-planet.js','v10/v21-universe-return.css']){
 if(!(await stat(new URL(asset,root))).isFile())throw new Error('Missing preview asset: '+asset);
}
const source=await readFile(new URL('index.html',root),'utf8');
if(!source.includes('v10/market-history-modes.js'))throw new Error('Integrated V20 is missing');
const world=source.replace('</head>','<link rel="stylesheet" href="v10/v21-universe-return.css">\n</head>')
 .replace('<div class="app obsidian" id="app">','<div class="app obsidian" id="app">\n<a class="v21-universe-return" href="../index.html" aria-label="Вернуться к финансовой вселенной">← ВСЕЛЕННАЯ</a>');
if(!world.includes('v21-universe-return'))throw new Error('Return path missing');
await rm(dist,{recursive:true,force:true});
await mkdir(new URL('v10/',dist),{recursive:true});
await mkdir(new URL('worlds/v10/',dist),{recursive:true});
await cp(new URL('universe.html',root),new URL('index.html',dist));
await cp(new URL('v10/v22-universe-hub.js',root),new URL('v10/v22-universe-hub.js',dist));
await cp(new URL('v10/v22-universe-hub.css',root),new URL('v10/v22-universe-hub.css',dist));
await cp(new URL('v10/',root),new URL('worlds/v10/',dist),{recursive:true});
await writeFile(new URL('worlds/index.html',dist),world);
await writeFile(new URL('release.json',dist),JSON.stringify({project:'Market Remembers',version:'V22 COSMIC REVIEW',source:'margaryanlabs/Marketremember',mode:'public static preview',worlds:{live:['PEOPLE','EVENT CORE'],planned:['DECISIONS','AGORA','MIRROR','GUILDS']},data:'fictional demos and browser-only records'},null,2)+'\n');
console.log('V22 public universe preview built; canonical Marketremember source remains private.');
