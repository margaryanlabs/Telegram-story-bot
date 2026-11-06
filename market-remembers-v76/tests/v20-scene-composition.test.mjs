import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const helper=read('v10/v20-scene-composition.js');
const mirror=read('v10/people-mirror-planet.js');
const css=read('v10/v20-scene-composition.css');
const html=read('index.html');

function scene(){
  const window={};
  new Script(helper).runInNewContext({window});
  return window.MarketSceneCompositionV20.compose;
}
const rect=(left,top,right,bottom)=>({left,top,right,bottom});
const inside=(frame,box,gap=0)=>
  frame.x-frame.r >= box.left+gap &&
  frame.x+frame.r <= box.right-gap &&
  frame.y-frame.r >= box.top+gap &&
  frame.y+frame.r <= box.bottom-gap;

test('EVENT desktop camera clears both document and Chronosphere without moving source coordinates',()=>{
  const compose=scene();
  const nav=rect(60,140,330,550),panel=rect(930,220,1368,820);
  const inputs={width:1440,height:900,chronosphere:nav,panel,header:rect(0,0,1440,77)};
  const data=JSON.stringify(inputs);
  const p=compose(inputs);
  assert.equal(p.strategy,'desktop');
  assert.ok(p.r>220,'A readable celestial object, not a point');
  assert.ok(p.x-p.r>nav.right+10);
  assert.ok(p.x+p.r<panel.left-10);
  assert.ok(p.y-p.r>77);
  assert.equal(JSON.stringify(inputs),data,'Must not mutate layout input rectangles');
});

test('Tablet composition leaves the horizontal chronology above the sphere and dossier to its right',()=>{
  const p=scene()({
    width:1024,height:768,
    chronosphere:rect(18,91,1006,185),panel:rect(580,200,1006,740),header:rect(0,0,1024,77)
  });
  assert.equal(p.strategy,'tablet');
  assert.ok(p.x+p.r<580);
  assert.ok(p.y-p.r>185);
  assert.ok(p.r>=160);
  assert.ok(p.y+p.r<760);
});

test('Portrait 390×844 keeps celestial body below chronology and above compact evidence sheet',()=>{
  const p=scene()({
    width:390,height:844,
    chronosphere:rect(12,151,378,260),
    panel:rect(12,630,378,835),header:rect(0,0,390,62)
  });
  assert.equal(p.strategy,'portrait');
  assert.ok(p.x-p.r>10 && p.x+p.r<380);
  assert.ok(p.y-p.r>260);
  assert.ok(p.y+p.r<630);
  assert.ok(p.r>120);
});

test('Short mobile portrait stays within the usable vertical area',()=>{
  const p=scene()({
    width:360,height:640,
    chronosphere:rect(12,149,348,230),
    panel:rect(10,480,350,632),header:rect(0,0,360,62)
  });
  assert.equal(p.strategy,'portrait');
  assert.ok(p.r>=75);
  assert.ok(p.y-p.r>=230);
  assert.ok(p.y+p.r<=480);
});

test('780×420 landscape places the source globe between chronology and research column',()=>{
  const p=scene()({
    width:780,height:420,orientation:'landscape',
    chronosphere:rect(12,76,230,182),
    panel:rect(445,113,768,405),header:rect(0,0,780,62)
  });
  assert.equal(p.strategy,'landscape');
  assert.ok(p.x-p.r>230);
  assert.ok(p.x+p.r<445);
  assert.ok(p.y-p.r>62);
  assert.ok(p.y+p.r<420);
});

test('Camera placement is deterministic for the same resting doc bounds',()=>{
  const compose=scene();
  const viewport={width:1440,height:900,chronosphere:rect(60,140,330,550),
    panel:rect(930,220,1368,820),header:rect(0,0,1440,77)};
  const compact=compose(viewport);
  const research=compose({...viewport,panel:viewport.panel});
  assert.deepEqual(compact,research);
  assert.match(mirror,/if\(sheet==='compact' && actualPanel\)lastCompactPanel=actualPanel/);
  assert.match(mirror,/const dock=sheet==='compact'\?actualPanel:\(lastCompactPanel\|\|actualPanel\)/);
  assert.match(mirror,/lastCompactPanel=null;\s*if\(!active\)return;\s*size\(\);place\(\);request\(\)/);
});

test('Invalid geometry and missing obstacles fail closed without NaN projections',()=>{
  const compose=scene();
  const invalid=compose({width:NaN,height:900});
  assert.equal(invalid.r,0);assert.equal(invalid.strategy,'invalid');
  const generic=compose({width:1280,height:720,chronosphere:rect(NaN,1,5,8),panel:null,header:null});
  assert.ok(Number.isFinite(generic.x)&&Number.isFinite(generic.y)&&Number.isFinite(generic.r));
  assert.ok(generic.r>0);
  const compact=compose({width:320,height:480,chronosphere:rect(12,149,308,227),
    panel:rect(8,355,312,472),header:rect(0,0,320,62)});
  assert.equal(compact.strategy,'portrait');
  assert.ok(compact.x>=0&&compact.x<=320);
  assert.ok(compact.y>=0&&compact.y<=480);
});

test('Scene composition only affects EVENT mirror and is loaded before that renderer',()=>{
  new Script(helper);new Script(mirror);
  assert.ok(html.indexOf('v10/v20-scene-composition.js')<html.indexOf('v10/people-mirror-planet.js'));
  assert.ok(html.indexOf('v10/v20-scene-composition.css')>html.indexOf('v10/v20-beacon-layout.css'));
  assert.match(mirror,/window\.MarketSceneCompositionV20\?\.compose/);
  assert.match(mirror,/if\(frame && frame\.r>0\)/);
  assert.match(mirror,/app\.dataset\.mhComposition=frame\.strategy/);
  assert.doesNotMatch(helper,/\.MarketPeopleResume|\.MarketPeopleRenderer|localStorage|fetch\(|Math\.random\(/);
  assert.match(css,/@media \(min-width:820px\) and \(max-width:1199px\)/);
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/\.mh-history-panel:not\(\.is-fullscreen\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css,/\.selected-card|\.signal-dock|#markers|#drawer/);
  let depth=0;for(const ch of css){if(ch==='{')depth++;if(ch==='}')depth--;assert.ok(depth>=0);}
  assert.equal(depth,0);
});
