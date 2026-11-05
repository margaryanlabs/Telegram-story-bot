import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const modes=read('v10/market-history-modes.js');
const mirror=read('v10/people-mirror-planet.js');
const css=read('v10/v19-financial-chronicle.css');
const html=read('index.html');
const m=modes.match(/const EVENTS = Object\.freeze\((\[[\s\S]*?\])\);\s*const EVENT_BY_ID/);
if(!m)throw Error('Expected JSON historical source registry');
const episodes=JSON.parse(m[1]);
const byYear=Object.fromEntries(episodes.map(x=>[x.year,x]));

test('eight sourced, chronological cases have transparent attribution and all narrative fields',()=>{
 assert.deepEqual(episodes.map(e=>e.year),['1907','1929','1987','1998','2008','2010','2020','2023']);
 assert.equal(new Set(episodes.map(x=>x.id)).size,8);
 for(const e of episodes){
  for(const key of ['id','year','date','name','short','detail','mechanism','impact','lesson','metric','metricLabel','scope','source','url'])
   assert.ok(e[key],e.year+' missing '+key);
  assert.equal(e.chapters.length,3,e.year+' chronological chapters');
  assert.equal(e.mechanism.split('→').length,3,e.year+' transmission mechanism');
  assert.match(e.url,/^https:\/\/(?:www\.)?(?:federalreservehistory\.org|fdic\.gov|sec\.gov|libertystreeteconomics\.newyorkfed\.org)\//);
  assert.ok(Array.isArray(e.p)&&e.p.length===2&&e.p.every(n=>Math.abs(n)<.95),e.year+' point coordinate');
  assert.ok(e.p[0]**2+e.p[1]**2<1,e.year+' must live on globe');
 }
});
test('V18 featured historical points are perfectly preserved',()=>{
 const original={1907:[-.62,-.42],1987:[.52,-.50],2008:[-.14,.11],2020:[.62,.34]};
 assert.deepEqual(episodes.filter(x=>x.featured).map(x=>x.year),Object.keys(original));
 for(const [year,p] of Object.entries(original))assert.deepEqual(byYear[year].p,p);
});
test('Four new milestones map to the institutional source evidence',()=>{
 assert.match(byYear['1929'].url,/stock-market-crash-of-1929/);
 assert.match(byYear['1998'].url,/ltcm-near-failure/);
 assert.match(byYear['2010'].url,/sec\.gov/);
 assert.match(byYear['2023'].url,/fdic\.gov/);
 assert.match(byYear['1929'].metric,/13%/);
 assert.match(byYear['1998'].metric,/3,6/);
 assert.match(byYear['2010'].metric,/5–6%/);
 assert.match(byYear['2023'].metric,/42/);
});
test('Archive is a scrollable, accessible date rail with visible impact, not eight large date pills on the sphere',()=>{
 assert.match(modes,/window\.MarketEventPlanet\?\.focus/);
 assert.match(modes,/className = 'mh-beacon' \+ \(event\.featured/);
 assert.match(modes,/aria-label/);
 assert.match(modes,/mh-event-peek/);
 assert.match(modes,/rail\.scrollLeft=/);
 assert.match(css,/\.mh-beacon\.is-archive \.mh-beacon-year/);
 assert.match(css,/display:none/);
 assert.match(css,/overflow-x:auto/);
 assert.match(css,/scroll-snap-type:x proximity/);
 const selection=modes.slice(modes.indexOf('function selectEvent(id)'),modes.indexOf('function openPeopleTheme'));
 assert.doesNotMatch(selection,/panelExpanded\s*=\s*true/);
});
test('Evidence-first dossier includes three stages, market effect, trader lesson and primary source',()=>{
 for(const label of ['ХРОНОЛОГИЯ ШОКА','МЕХАНИЗМ ЗАРАЖЕНИЯ','РЕАКЦИЯ РЫНКОВ','УРОК ДЛЯ ТРЕЙДЕРА','ИСТОЧНИК · '])
  assert.ok(modes.includes(label),label);
 assert.match(modes,/mh-chronicle-impact/);
 assert.match(modes,/mh-chronicle-step/);
 assert.match(modes,/related=EVENTS\.filter/);
 assert.match(modes,/\.slice\(0,4\)/);
});
test('PEOPLE shader, renderer and original archive are not replaced',()=>{
 for(const key of ['id="gl"','id="memorySky"','id="markers"','id="lensPanel"','id="drawer"'])
  assert.ok(html.includes(key),key);
 assert.match(html,/people-mirror-planet\.js/);
 assert.match(html,/people-mirror-shaders\.js/);
 assert.match(html,/v19-financial-chronicle\.css/);
 assert.match(mirror,/window\.MarketPeopleResume\?\.\(\)/);
 assert.doesNotMatch(css,/#gl\b|#memorySky|#lensPanel|#selectedCard|#drawer/);
 assert.doesNotThrow(()=>new Script(modes));
});
