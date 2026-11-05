import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [html,reader,css,sky,pkg]=await Promise.all([
  read('index.html'),read('v10/story-experience.js'),read('v10/v12-cinematic.css'),
  read('v10/universe-atmosphere.js'),read('package.json')
]);

test('V12 RC2 cinematic layer follows all existing design layers and renders a real star hero',()=>{
  assert.equal(JSON.parse(pkg).version,'12.0.0-rc.6');
  assert.match(html,/v10\/v12-cinematic\.css/);
  assert.ok(html.indexOf('v10/v12-cinematic.css')>html.indexOf('v10/explainable-constellations-v11.css'));
  assert.match(reader,/const hero=document\.createElement\('section'\);hero\.className='v12-memory-hero'/);
  assert.match(reader,/hero\.append\(heroEyebrow,halo,starLabel,title,abstract,overview\)/);
  assert.match(reader,/hero\.after\(progress,nav,container\)/);
  assert.match(css,/v12-memory-hero/);
  assert.match(css,/v12-memory-sigil/);
});
test('Existing original reader IDs, story source and honest provenance remain authoritative',()=>{
  assert.match(reader,/const title=document\.getElementById\('memoryTitle'\)/);
  assert.match(reader,/abstract\.textContent='«'\+String\(record\.quote/);
  assert.match(reader,/data\.provenance\(record\)/);
  assert.match(reader,/window\.MarketV10\.data\.chapters\(record\)/);
  assert.match(reader,/Отсутствующие детали не выдуманы/);
  assert.match(reader,/Этот этап не описан в исходной записи/);
  assert.doesNotMatch(reader,/fetch\(|XMLHttpRequest|sendBeacon/);
});
test('Redesigned action bar reuses the original functional controls and destinations',()=>{
  assert.match(reader,/const saveButton=document\.getElementById\('saveLesson'\)/);
  assert.match(reader,/if\(saveButton\)actions\.append\(saveButton\)/);
  assert.match(reader,/actions\.append\(link\)/);
  assert.match(reader,/const returnButton=document\.getElementById\('memoryBack'\)/);
  assert.match(reader,/actions\.append\(returnButton\)/);
  assert.match(reader,/navigator\.clipboard\.writeText/);
  assert.match(css,/\.v12-story-actions/);
});
test('No new WebGL canvases or frame loops; real sphere receives only small shader light variation',()=>{
  assert.match(html,/float memoryVeil=\.5\+\.5\*sin\(vObject\.y/);
  assert.match(html,/material\+=vec3\(\.031,\.081,\.095\)\*memoryBands\*\.32/);
  assert.match(html,/float planeA=abs\(dot\(vObject/);
  assert.match(html,/float depth=mix\(\.09,\.57/);
  assert.match(sky,/existing 15\/24 Hz background pass/);
  assert.doesNotMatch(sky,/requestAnimationFrame|setInterval|setTimeout/);
  assert.doesNotMatch(css,/canvas\s*\{|iframe|filter:blur\(80px\)/);
  assert.doesNotThrow(()=>new Script(sky));
});
test('Accessible responsive memory reader and quiet layered background preserve reduced motion',()=>{
  assert.match(css,/@media\(max-width:819px\)/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.scene-shading::after/);
  assert.match(css,/\.v12-story-actions button/);
  assert.match(reader,/hero\.setAttribute\('aria-label'/);
  assert.match(reader,/actions\.setAttribute\('role','group'\)/);
  assert.match(reader,/window\.MarketV10\.motion\.reduced/);
});

test('Verified historical quotations receive the same artifact treatment without losing source credits',()=>{
  assert.match(reader,/if\(profile&&originalTitle\)/);
  assert.match(reader,/legendHero\.className='v12-memory-hero v12-legend-hero'/);
  assert.match(reader,/\.legend-credit','.human-story-label','#memoryTitle','.legend-original'/);
  assert.match(css,/v12-legend-hero \.legend-portrait-box/);
  assert.match(css,/v12-legend-hero \.legend-original/);
  assert.match(reader,/Исторический источник:/);
});
