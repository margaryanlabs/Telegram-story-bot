import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script,runInNewContext} from 'node:vm';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const atlas=await readFile(new URL('../v10/memory-archive.js',import.meta.url),'utf8');
const css=await readFile(new URL('../v10/memory-atlas-v11.css',import.meta.url),'utf8');
const runtime=html.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'';

test('V11.5 is an additive version on the original, tested archive',()=>{
  assert.match(html,/(?:MEMORY ATLAS \/ OBSERVATORY № 11\.5|MEMORY TRAILS \/ OBSERVATORY № 11\.6|EXPLAINABLE CONSTELLATIONS \/ OBSERVATORY № 11\.7)/);
  assert.match(html,/v10\/memory-atlas-v11\.css/);
  assert.match(html,/v10\/star-passage-v11\.css/);
  assert.match(html,/v10\/memory-archive\.js/);
  assert.doesNotThrow(()=>new Script(runtime));
  assert.doesNotThrow(()=>new Script(atlas));
});
test('Archive atlas uses original exact search matcher, not invented results',()=>{
  assert.match(runtime,/archiveSelect:\(filter,query\)=>v79SelectArchive\(stories,filter,query,isSavedLesson\)/);
  assert.match(atlas,/api\.archiveSelect\('All',q\)/);
  assert.match(atlas,/matching\.filter\(record=>record\.category===topic\.id\)/);
  assert.match(atlas,/const q=document\.getElementById\('archiveSearch'\)\?\.value\|\|''/);
});
test('Topic buttons drive real existing archive filters',()=>{
  assert.match(atlas,/data-archive-filter="/);
  assert.match(atlas,/\?\.click\(\)/);
  assert.match(atlas,/node\.setAttribute\('aria-pressed'/);
  for(const theme of ['Risk','Discipline','FOMO','Patience'])assert.match(atlas,new RegExp("id:'"+theme+"'"));
  assert.match(atlas,/Линии показывают категории, а не знакомства людей/);
});
test('Random discovery clicks only eligible rendered story buttons',()=>{
  assert.match(atlas,/document\.querySelectorAll\('#archiveGrid \.v79-archive-record'\)/);
  assert.match(atlas,/cards\[Math\.floor\(Math\.random\(\)\*cards\.length\)\]\.click\(\)/);
  assert.match(atlas,/surprise\.disabled=cards\.length===0/);
});
test('Archive does not change private/local-only storage or introduce network calls',()=>{
  assert.doesNotMatch(atlas,/fetch\(|localStorage|sessionStorage|XMLHttpRequest|sendBeacon|new WebSocket/);
  assert.match(runtime,/Личные записи остаются только в этом браузере и не публикуются/);
  assert.match(css,/@media\(max-width:819px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('Sorting API preserves deterministic allowed sort keys',()=>{
  const context={window:{}};
  runInNewContext(atlas,context);
  const model=context.window.MarketV10.archive;
  assert.equal(model.getSort(),'curated');
  model.setSort('alias');
  assert.equal(model.getSort(),'alias');
  model.setSort('unknown');
  assert.equal(model.getSort(),'curated');
});
