import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const html=read('studio.html');
const css=read('vetogram-finish-2026.css');
const header=read('vetogram-header.js');

function simulateHeader(phone=false){
  const attributes={},listeners={},classes=new Set();
  const heading={classList:{toggle(name,enabled){
    if(enabled)classes.add(name);else classes.delete(name);
  }}};
  const button={setAttribute(name,value){attributes[name]=value},
    addEventListener(type,fn){listeners[type]=fn},title:''};
  const document={
    querySelector:sel=>sel==='#telegramMirror .vetogram-header'?heading:null,
    getElementById:id=>id==='vetogramHeaderToggle'?button:null,
    body:{classList:{add(){}}}
  };
  const window={matchMedia:query=>({matches:phone&&query==='(max-width: 620px)'})};
  runInNewContext(header,{window,document});
  return {attributes,listeners,classes};
}

test('phone has compact chat header, expandable without scroll listeners',()=>{
  const state=simulateHeader(true);
  assert.equal(state.attributes['aria-expanded'],'false');
  assert.equal(state.classes.has('is-expanded'),false);
  state.listeners.click();
  assert.equal(state.attributes['aria-expanded'],'true');
  state.listeners.click();
  assert.equal(state.attributes['aria-expanded'],'false');
  assert.match(html,/class="veto-mirror-heading vetogram-header"/);
  assert.match(html,/id="vetogramHeaderToggle"[^>]*aria-expanded="false"/);
  assert.doesNotMatch(header,/addEventListener\('scroll'/);
});

test('desktop retains expanded header with the same manual disclosure',()=>{
  const state=simulateHeader(false);
  assert.equal(state.attributes['aria-expanded'],'true');
  assert.equal(state.classes.has('is-expanded'),true);
  state.listeners.click();
  assert.equal(state.attributes['aria-expanded'],'false');
});

test('real flagship screen keeps navigation/permissions, no fake success state',()=>{
  for(const nav of ['telegram','home','publish','privacy','studio'])
    assert.match(html,new RegExp('data-nav="'+nav+'"'));
  for(const id of ['vg27MissionAccount','vg27MissionPrivacy','vg27MissionStories',
    'telegramThreadCompose','telegramThreadSend','seTemplates','vtaiRoot'])
    assert.match(html,new RegExp('id="'+id+'"'));
  for(const copy of ['VETOGRAM · ЛИЧНЫЕ ЧАТЫ','VETOGRAM / AI-ИНСТРУМЕНТЫ',
    'VETOGRAM / РЕДАКТОР ИСТОРИЙ','10 ФИРМЕННЫХ СТИЛЕЙ'])
    assert.ok(html.includes(copy));
});

test('3.4 styling respects real disabled controls and reduced motion',()=>{
  const part=css.slice(css.indexOf('VETOGRAM 3.4 · premium interaction system'));
  assert.ok(part.length>8000);
  assert.match(part,/\.veto-mirror-send-button:not\(:disabled\)/);
  assert.match(part,/\.veto-mirror-send-button:disabled/);
  assert.match(part,/\.se-button:disabled/);
  assert.match(part,/@media\(hover:none\),\(pointer:coarse\)/);
  assert.match(part,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(part,/#telegramMirror \.veto-mirror-search-wrap:focus-within/);
  assert.match(part,/\.bottom-nav \.nav-item:focus-visible/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});
