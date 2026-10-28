import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
const html=read('studio.html');
const app=read('app.js');
const css=read('vetogram-finish-2026.css');
const chat=read('telegram-chats.js');
const screenNames=[...html.matchAll(/<section[^>]*class="[^"]*\bscreen\b[^"]*"[^>]*data-screen="([^"]+)"/g)]
  .map(m=>m[1]);
const IDs=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);

test('the same Mini App contains 15 screens and five primary tabs',()=>{
  const expected=['home','telegram','voice','publish','viewers','analytics','privacy',
    'chats','ai','story-engine','studio','relay','archive','media','profile'];
  assert.deepEqual(screenNames,expected);
  assert.equal(new Set(screenNames).size,15);
  const nav=[...html.matchAll(/\bdata-nav="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(nav,['telegram','publish','media','privacy','profile']);
});

test('screen buttons resolve to real screens or explicit existing aliases',()=>{
  const aliasStart=app.indexOf('const SCREEN_ALIASES');
  const aliasEnd=app.indexOf('const requestedScreen',aliasStart);
  assert.ok(aliasStart>=0&&aliasEnd>aliasStart);
  const aliases=app.slice(aliasStart,aliasEnd);
  const destinations=[...new Set([...html.matchAll(/data-open-screen="([^"]+)"/g)].map(m=>m[1]))];
  for(const name of destinations){
    if(screenNames.includes(name))continue;
    const escaped=name.replace(/[.*+?^$()|[\]{}]/g,'\\$&');
    const match=aliases.match(new RegExp('(?:^|[,\\n])\\s*[\\x27"]?'+escaped+'[\\x27"]?\\s*:\\s*[\\x27]([^\\x27]+)[\\x27]'));
    assert.ok(match,'missing supported screen alias for '+name);
    assert.ok(screenNames.includes(match[1]),'alias target is missing for '+name);
  }
});

test('every DOM id is unique and accessibility control/label targets exist',()=>{
  assert.equal(IDs.length,new Set(IDs).size,'duplicate HTML ids');
  const idSet=new Set(IDs);
  for(const id of [...html.matchAll(/\baria-controls="([^"]+)"/g)].map(m=>m[1]))
    assert.ok(idSet.has(id),'aria-controls references missing '+id);
  for(const id of [...html.matchAll(/\bfor="([^"]+)"/g)].map(m=>m[1]))
    assert.ok(idSet.has(id),'form label references missing '+id);
});

test('all changed core assets are cache-versioned to the current release',()=>{
  for(const name of ['vetogram-finish-2026.css','telegram-chats.js','vetogram-header.js']){
    const escaped=name.replaceAll('.','\\.');
    assert.match(html,new RegExp('/'+escaped+'\\?v=\\d{8}-[a-z0-9-]+'),
      'versioned release asset missing: '+name);
  }
  assert.doesNotMatch(html,/vetogram-finish-2026\.css\?v=20261025-motion-r1/);
  assert.doesNotMatch(html,/telegram-chats\.js\?v=20261019-messenger-first-v1/);
});

test('cross-screen finish layer covers real mobile layouts and does not alter Telegram owner auth',()=>{
  const index=css.indexOf('VETOGRAM 4.1 · responsive fit & interaction contract');
  assert.ok(index>0);
  const layer=css.slice(index);
  assert.ok(layer.length>5500);
  for(const name of ['viewers','analytics','privacy','chats','studio','relay',
    'archive','voice','publish','ai','story-engine'])
    assert.ok(layer.includes('data-screen="'+name+'"'),'not covered: '+name);
  assert.match(layer,/@media\(max-width:720px\)/);
  assert.match(layer,/@media\(max-width:480px\)/);
  assert.match(layer,/@media\(max-width:360px\)/);
  assert.match(layer,/grid-auto-columns:minmax\(150px,67%\)/);
  assert.match(layer,/font-size:max\(16px,1em\)/);
  assert.doesNotMatch(layer,/fetch\(|sendOutgoing\(|localStorage|sessionStorage/);
  assert.match(chat,/function resetOwner\(\)/);
});

test('touch focus, disabled states and reduced motion survive CSS cascade',()=>{
  const layer=css.slice(css.indexOf('VETOGRAM 4.1 · responsive fit'));
  assert.match(layer,/:focus-visible/);
  assert.match(layer,/touch-action:manipulation/);
  assert.match(layer,/button:disabled/);
  assert.match(layer,/@media\(prefers-reduced-motion:reduce\)/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
  assert.match(css,/VETOGRAM 4\.0 · Smart Inbox/);
});
