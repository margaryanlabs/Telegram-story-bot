import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const reader=read('v10/story-experience.js');
const modes=read('v10/market-history-modes.js');
const globe=read('v10/people-mirror-planet.js');
const css=read('v10/v19-story-and-worlds.css');
const html=read('index.html');
const source=read('v10/memory-data.js');

test('V19 reader displays only documented chapters and discloses missing context',()=>{
  assert.match(reader,/availableChapters=allChapters\.filter\(chapter=>!chapter\.missing\)/);
  assert.match(reader,/availableChapters\.forEach\(\(chapter,i\)=>/);
  assert.match(reader,/missingChapters\.length/);
  assert.match(reader,/v19-source-coverage/);
  assert.match(reader,/Отсутствующие детали не выдуманы/);
  assert.match(reader,/progress\.setAttribute\('aria-valuemax',String\(availableChapters\.length\|\|1\)\)/);
  assert.match(reader,/chapterLabels\[current\]/);
  assert.match(reader,/saveButton\)actions\.append\(saveButton\)/);
  assert.match(reader,/actions\.append\(returnButton\)/);
  assert.doesNotMatch(reader,/fetch\(|sendBeacon|XMLHttpRequest/);
  new Script(reader);
  const vm={window:{}};new Script(source).runInNewContext(vm);
  const demo=vm.window.MarketV10.data.chapters({story:'Текст урока',rule:'Моё правило'});
  assert.equal(demo.filter(x=>!x.missing).length,2);
});

test('V19 event selection stays compact until explicit dossier request',()=>{
  assert.match(modes,/function selectEvent\(id\)/);
  assert.match(modes,/panelExpanded = false;\s*renderPanel\(\);\s*renderBeacons\(\)/);
  assert.match(modes,/mh-v19-preview/);
  assert.match(modes,/mh-v19-context/);
  assert.match(modes,/mh-v19-neighbors/);
  assert.match(modes,/data-mh-go-connections/);
  assert.match(modes,/data-mh-event=/);
  for(const year of ['1907','1987','2008','2020'])assert.ok(modes.includes("id: '"+year+"'"));
  new Script(modes);
});

test('V19 second world conserves GPU when idle and does not allocate on PEOPLE entry',()=>{
  assert.match(globe,/rendererInitialized=true;initGL\(\)/);
  assert.match(globe,/moving\?33:82/);
  assert.match(globe,/const fallbackDust=Array\.from/);
  assert.match(globe,/const p=rotate\(fallbackDust\[i\]\)/);
  assert.match(globe,/if\(p\[2\]<=\.04\)continue/);
  assert.match(globe,/function focus\(pair\)/);
  assert.match(globe,/window\.MarketPeopleResume\?\.\(\)/);
  assert.doesNotMatch(globe,/targetYaw\s*\+=\s*dt\s*\*\s*\.000052/);
  assert.doesNotMatch(globe,/localStorage|sessionStorage|fetch\(/);
  new Script(globe);
});

test('V19 styles are last, visible and reduced-motion compliant',()=>{
  const mirror='v10/people-mirror-events.css',v19='v10/v19-story-and-worlds.css';
  assert.ok(html.indexOf(mirror)>0&&html.indexOf(v19)>html.indexOf(mirror));
  assert.match(css,/\.drawer\.memory-detail\.v10-reader/);
  assert.match(css,/\.mh-history-panel:not\(\.is-expanded\)/);
  assert.match(css,/canvas\[hidden\]/);
  assert.match(css,/@media\(max-width:819px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html,/diveTimer=setTimeout\(\(\)=>finishDive\(token\),1100\)/);
  assert.match(html,/const remaining=Math\.max\(0,1100-/);
});
