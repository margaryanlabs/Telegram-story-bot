import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, runInNewContext } from 'node:vm';

const read = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html = read('public/studio.html');
const css = read('public/vetogram-header.css');
const js = read('public/vetogram-header.js');

test('Vetogram keeps the canonical red/silver split-V identity in its real inbox',()=>{
  assert.match(html, /<title>VETOGRAM/);
  assert.match(html, /aria-label="VETOGRAM"><span>VETO<\/span><i>GRAM/);
  assert.match(html, /class="veto-mirror-heading vetogram-header"/);
  assert.match(html, /veto-telegram-mark\.svg\?v=20261019-brand-v2/);
  assert.doesNotMatch(html, /VETO Telegram|StoryLab|Buy Veta/i);
});

test('compact CSS/controller are installed after legacy cosmetic scripts',()=>{
  assert.ok(html.indexOf('vetogram-header.css')>html.indexOf('veto-launch-polish.css'));
  assert.ok(html.indexOf('vetogram-header.js')>html.indexOf('veto-launch-polish.js'));
  assert.ok(html.includes('id="vetoMessengerToolsToggle"'));
  assert.ok(!html.includes('id="vetogramHeaderToggle"'));
  assert.ok(css.includes('height:54px!important'));
  assert.ok(css.includes('position:relative!important'));
  assert.ok(css.includes('--vetogram-top:max('));
  assert.ok(!js.includes('addEventListener(\'scroll\''));
  assert.doesNotMatch(js,/fetch\(|localStorage|sessionStorage|indexedDB|sendBeacon/);
  assert.doesNotThrow(()=>new Script(js));
});

test('real Mini App receives safe-area flag without opening header accordion',()=>{
  const seen=[];
  const title={classList:{remove(name){seen.push(name)}},setAttribute(k,v){seen.push(k+':'+v)}};
  const body={classList:{add(name){seen.push(name)}}};
  const document={body,querySelector:()=>title};
  const window={Telegram:{WebApp:{initData:'verified-data'}}};
  runInNewContext(js,{document,window});
  assert.ok(seen.includes('vetogram-in-tg'));
  assert.ok(seen.includes('is-expanded'));
  assert.ok(seen.some(x=>x.includes('VETOGRAM — чаты')));
});

test('compact header has no scroll listener or mobile-only expander',()=>{
  assert.ok(!js.includes('addEventListener(\'scroll\''));
  assert.ok(!js.includes('toggle.addEventListener'));
  assert.ok(!html.includes('vetogramHeaderToggle'));
  assert.ok(css.includes('vetoMessengerToolsToggle'));
  assert.ok(css.includes('veto-inbox-signature'));
});
