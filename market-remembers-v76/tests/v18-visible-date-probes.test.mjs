import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const file=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const planet=file('v10/people-mirror-planet.js');
const modes=file('v10/market-history-modes.js');
const css=file('v10/people-mirror-events.css');

test('No self-driven idle rotation that hides all four date stars',()=>{
  assert.doesNotMatch(planet,/targetYaw\s*\+=\s*dt\s*\*\s*\.000052/);
  assert.match(planet,/all four source events occupy one archive-facing hemisphere/);
  assert.match(planet,/targetYaw\+=dx\*\.006/); // user drag remains
  assert.match(planet,/function focus\(pair\)/);
  assert.match(planet,/targetYaw=-Math\.atan2\(p\[0\],p\[2\]\)/);
  assert.match(planet,/if\(cur\)focus\(cur\.p\)/);
});
test('All four dated probes face the camera on default 2008 focus',()=>{
  const points={1907:[-.62,-.42],1987:[.52,-.50],2008:[-.14,.11],2020:[.62,.34]};
  const selected=points[2008];
  const z=Math.sqrt(1-selected[0]**2-selected[1]**2);
  const yaw=-Math.atan2(selected[0],z);
  const pitch=Math.atan2(selected[1],Math.hypot(selected[0],z));
  for(const [year,[x,y]] of Object.entries(points)){
    const pz=Math.sqrt(Math.max(0,1-x*x-y*y));
    const rotatedZ=-Math.sin(yaw)*x+Math.cos(yaw)*pz;
    const depth=Math.sin(pitch)*y+Math.cos(pitch)*rotatedZ;
    assert.ok(depth>0,year+' should be on the front hemisphere: '+depth);
  }
});
test('Four event-year controls are available without expanding the dossier on a phone',()=>{
  assert.match(modes,/function timeline\(\)/);
  assert.match(modes,/data-mh-event=/);
  assert.match(css,/\.mh-history-panel:not\(\.is-expanded\) > \.mh-timeline/);
  assert.match(css,/display:grid!important/);
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/min-height:33px/);
});
test('People renderer and four historical source records are unchanged',()=>{
  for(const year of ['1907','1987','2008','2020'])assert.ok(modes.includes('"id": "'+year+'"'),year);
  assert.match(planet,/window\.MarketPeopleResume\?\.\(\)/);
  assert.doesNotMatch(planet,/localStorage|sessionStorage|fetch\(/);
  assert.match(css,/#app\.mh-v16\[data-mh-mode="events"\]/);
  assert.doesNotThrow(()=>new Script(planet));
  assert.doesNotThrow(()=>new Script(modes));
});
