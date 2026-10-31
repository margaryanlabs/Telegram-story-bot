/* V6.1 offline release-surface guard. Zero live service or credentials needed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const html=read('studio.html');
const pages=['studio.html','music-module.html','cinema.html','books.html'];

test('every local JS/CSS/image/font referenced by all Universe entry pages exists',()=>{
 const asset=/\b(?:src|href)\s*=\s*["']((?:\/|\.\/)[A-Za-z0-9/_-]+\.(?:js|css|svg|png|webp|ico|woff2?))(?:\?[^"']*)?["']/gi;
 let total=0;
 for(const page of pages){
  const found=[...read(page).matchAll(asset)].map(x=>x[1].replace(/^\.\//,'/'));
  assert.ok(found.length>3,'no scanned assets on '+page);
  for(const path of found){
   assert.ok(existsSync(new URL('../public'+path,import.meta.url)),'missing '+path+' referenced by '+page);
   total++;
  }
 }
 assert.ok(total>=40,'Universe pages should load local assets');
});
test('Messenger shell has unique HTML IDs and all V6.1 hooks',()=>{
 const ids=[...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(x=>x[1]);
 const seen=new Set();
 for(const id of ids){
  assert.ok(!seen.has(id),'duplicate ID: '+id);seen.add(id);
 }
 for(const id of ['v6MediaHome','v6MediaStage','v6Frames','v61Continue','v61ContinueList',
  'v61Search','v61VaultPanel','v61VaultList','v61VaultButton','v61Player','v61PlayerClose',
  'v61PlayerSeek','v6MiniPlayer','v6NowPlay']){
  assert.ok(seen.has(id),'missing media control '+id);
 }
 assert.equal((html.match(/id="v6MediaHome"/g)||[]).length,1);
});
test('original app still owns primary navigation and modules load in order',()=>{
 for(const route of ['telegram','publish','media','privacy','profile'])
  assert.ok(html.includes('data-nav="'+route+'"'),'missing nav '+route);
 const bootstrap=html.indexOf('/vetogram-universe.js?v=');
 const core=html.indexOf('/vetogram-universe-61-core.js?v=');
 const ui=html.indexOf('/vetogram-universe-61.js?v=');
 assert.ok(bootstrap>0&&core>bootstrap&&ui>core,'V6 + V6.1 bootstrap order must be preserved');
 assert.ok(html.includes('/vetogram-universe-61.css?v='));
 assert.ok(html.includes('data-screen="media"'));
});
test('full-screen player controls existing Music iframe rather than creating another track',()=>{
 const controller=read('vetogram-universe.js');
 const bridge=read('vetogram-media-bridge.js');
 const v61=read('vetogram-universe-61.js');
 assert.match(controller,/const definitions=Object\.freeze\(\{music:/);
 assert.match(controller,/v61PlayerSeek/);
 assert.match(bridge,/if\(data\.action==='audio'&&audio\)/);
 assert.doesNotMatch(v61,/\bnew Audio\s*\(/);
 assert.ok(html.includes('id="v61Player"'));
});
