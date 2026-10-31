import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const shell=read('studio.html'),hub=read('vetogram-universe-61.js'),bridge=read('vetogram-media-bridge.js');
const parent=read('vetogram-universe.js'),cinema=read('cinema.js'),books=read('books.js');
test('one V6.1 Media Home exists in original Messenger shell, no duplicate site',()=>{
 assert.equal((shell.match(/id="v6MediaHome"/g)||[]).length,1);
 for(const id of ['v61Search','v61Results','v61Continue','v61VaultPanel','v61SaveLink','v61Player','v61PlayerMusic'])
  assert.ok(shell.includes('id="'+id+'"'),id);
 for(const asset of ['vetogram-universe-61-core.js','vetogram-universe-61.js','vetogram-universe-61.css'])
  assert.ok(shell.includes('/'+asset+'?v='),'asset '+asset);
 assert.ok(shell.includes('data-nav="telegram"')&&shell.includes('data-nav="media"'));
});
test('cross-module activity is authenticated by iframe window and origin before any parent event',()=>{
 assert.match(parent,/event\.origin!==location\.origin/);
 assert.match(parent,/item\.element\.contentWindow===event\.source/);
 assert.match(bridge,/event\.source!==parent \|\| event\.origin!==location\.origin/);
 assert.match(parent,/vetogram:media-recent/);
 assert.match(parent,/vetogram:media-library/);
 assert.match(books,/vetogram:book-progress/);
 assert.match(cinema,/vetogram:cinema-opened/);
 assert.match(cinema,/getLibrary:.*=>/s);
});
test('navigation and fullscreen player use the original Music frame rather than second audio',()=>{
 assert.match(parent,/open:\(name,page,id,query\)=>openModule/);
 assert.match(parent,/v61PlayerSeek/);
 assert.match(parent,/v61PlayerMusic/);
 assert.match(hub,/VetogramUniverse61Core/);
 assert.doesNotMatch(hub,/\bnew Audio\b/);
 assert.doesNotMatch(hub,/TELEGRAM_BOT_TOKEN|BOT_TOKEN|file_id/);
});
