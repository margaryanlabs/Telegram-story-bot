import test from 'node:test';import assert from 'node:assert/strict';import {readFile,stat} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('V22 deploy mirror has six worlds and two real routes',async()=>{
 const html=await readFile(new URL('universe.html',root),'utf8');
 const js=await readFile(new URL('v10/v22-universe-hub.js',root),'utf8');
 for(const id of ['people','events','decisions','agora','mirror','guilds'])assert.ok(html.includes('data-world="'+id+'"'),id);
 assert.match(js,/worlds\/index\.html\?world=people/);assert.match(js,/worlds\/index\.html\?mm=events/);
 assert.match(html,/v10\/v22-universe-hub\.css/);assert.match(html,/v10\/v22-universe-hub\.js/);
 for(const x of ['v10/v22-universe-hub.css','v10/v22-universe-hub.js','v10/v21-universe-return.css','v10/market-history-modes.js']){
 assert.ok((await stat(new URL(x,root))).isFile(),x);
 }
});
