import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext,Script} from 'node:vm';

const script=await readFile(new URL('../v10/story-experience.js',import.meta.url),'utf8');
const data=await readFile(new URL('../v10/memory-data.js',import.meta.url),'utf8');
const css=await readFile(new URL('../v10/cosmic-awakening.css',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');

test('V11.3 reader parses and keeps original V10 interface',()=>{
  assert.doesNotThrow(()=>new Script(script));
  assert.match(script,/window\.MarketV10\.reader/);
  assert.match(script,/return \{init,mount\}/);
  assert.match(html,/(?:HUMAN STORIES \/ OBSERVATORY № 11\.3|STAR PASSAGE \/ OBSERVATORY № 11\.4|MEMORY ATLAS \/ OBSERVATORY № 11\.5)/);
});
test('Reader provides four chapters, progress and working navigation',()=>{
  assert.match(script,/v113-chapter-progress/);
  assert.match(script,/role','progressbar'/);
  assert.match(script,/aria-valuenow'/);
  assert.match(script,/function jumpToChapter\(index\)/);
  assert.match(script,/next\.onclick=\(\)=>jumpToChapter\(i\+1\)/);
  assert.match(script,/button\.onclick=\(\)=>jumpToChapter\(i\)/);
  assert.match(css,/v113-progress-fill/);
});
test('Provenance and missing source events are not invented',()=>{
  const context={window:{}};
  runInNewContext(data,context);
  const result=context.window.MarketV10.data.chapters({story:'Мой рассказ',rule:'Мой урок'});
  assert.equal(result.length,4);
  assert.equal(result[0].text,'Мой рассказ');
  assert.equal(result[1].missing,true);
  assert.equal(result[2].missing,true);
  assert.equal(result[3].text,'Мой урок');
  assert.match(script,/data\.provenance\(record\)/);
  assert.match(script,/Отсутствующие детали не выдуманы/);
  assert.match(script,/chapter\.text\|\|'Этот этап не описан в исходной записи\.'/);
});
test('Follow-on story action uses existing related records, honors guided mode',()=>{
  assert.match(script,/const related=api\.related\(record\)/);
  assert.match(script,/!api\.guided\(\)&&related\.length/);
  assert.match(script,/nextStory\.onclick=\(\)=>api\.follow\(linked\.index,linked\.relation\)/);
  assert.match(script,/Другие записи связаны общими темами и уроками, а не личными знакомствами/);
  assert.doesNotMatch(script,/fetch\(|XMLHttpRequest|sendBeacon/);
});
test('Reader safely preserves source quotations, local-only permalink and reduced motion',()=>{
  assert.match(script,/if\(record\.type!=='legend'\)/);
  assert.match(script,/data\.permalink\(record\)/);
  assert.match(script,/Ссылка открывается только там, где сохранена личная запись/);
  assert.match(script,/window\.MarketV10\.motion\.reduced/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
