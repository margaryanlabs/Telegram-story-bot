import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=read('index.html'),modes=read('v10/market-history-modes.js'),css=read('v10/people-mirror-events.css');
const shaders=read('v10/people-mirror-shaders.js'),engine=read('v10/people-mirror-planet.js');
const host={window:{}};new Script(shaders).runInNewContext(host);
const clone=host.window.MHPeopleMirrorShaders;
const original=name=>{
  const q=String.fromCharCode(96);
  const m=html.match(new RegExp('const '+name+'='+q+'([\\s\\S]*?)'+q+';'));
  assert.ok(m,'Original People shader '+name+' must remain in index.html');
  return m[1];
};

test('Exact PEOPLE mesh/particles/line vertex GLSL is reused verbatim',()=>{
  for(const key of ['coreVertex','pVertex','lVertex'])
    assert.equal(clone[key],original(key),key);
  assert.match(engine,/radius=\.955/);
  assert.match(engine,/low\?30:46,lon=low\?46:70/);
  assert.match(engine,/gl\.drawElements\(gl\.TRIANGLES/);
  assert.match(engine,/gl\.drawArrays\(gl\.POINTS/);
  assert.match(engine,/271828\+count/);
  assert.match(engine,/2\.399963229728653/);
});

test('Exact PEOPLE volumetric shader is preserved up to palette-only final output',()=>{
  const originalFrag=original('coreFragment');
  const cutoff='gl_FragColor=vec4(clamp(material,0.,1.),1.);';
  assert.equal(originalFrag.split(cutoff).length,2);
  const prefix=originalFrag.split(cutoff)[0];
  assert.ok(clone.coreFragment.startsWith(prefix));
  assert.match(clone.coreFragment,/vec3 eventPalette=vec3/);
  assert.match(clone.coreFragment,/nebulaNoise3/);
  assert.match(clone.coreFragment,/volumePasses=uQuality>/);
  assert.match(clone.coreFragment,/float atmosphere=pow/);
  assert.doesNotMatch(clone.coreFragment,/float stress=hairline|vec3 lava=/);
  assert.match(clone.pFragment,/vec3 ink=vec3\(\.35,\.30,\.44\)/);
});

test('EVENT CORE uses cloned People engine, not any earlier red-planet renderer',()=>{
  assert.match(html,/src="v10\/people-mirror-shaders\.js"/);
  assert.match(html,/src="v10\/people-mirror-planet\.js"/);
  assert.match(html,/v10\/people-mirror-events\.css/);
  assert.doesNotMatch(html,/src="v10\/crimson-shaders\.js"|src="v10\/crimson-event-core\.js"/);
  assert.ok(html.indexOf('src="v10/people-mirror-shaders.js"')<html.indexOf('src="v10/people-mirror-planet.js"'));
  assert.ok(html.indexOf('src="v10/people-mirror-planet.js"')<html.indexOf('src="v10/v16-scene-director.js"'));
  assert.match(engine,/window\.MarketEventPlanet=Object\.freeze/);
  assert.match(engine,/get copiedPeopleRenderer\(\)\{return true;\}/);
});

test('Only dates and financial details replace original personal stories',()=>{
  for(const date of ['1907','1929','1987','1998','2008','2010','2020','2023'])assert.ok(modes.includes('"id": "'+date+'"'),date);
  assert.match(modes,/p:\[\.\.\.p\]/);
  assert.match(modes,/MarketEventPlanet\?\.project/);
  assert.match(modes,/MarketEventPlanet\?\.focus/);
  assert.match(engine,/events\(\)\.forEach\(\(ev,i\)=>points\.push\(\.\.\.point3\(ev\.p\)/);
  assert.match(modes,/Federal Reserve History/);
  assert.match(modes,/FDIC · Crisis chronology/);
  assert.doesNotMatch(engine,/localStorage|sessionStorage|XMLHttpRequest|fetch\(/);
});

test('PEOPLE globe, archive, visual theme and stored records are completely untouched',()=>{
  for(const id of ['id="gl"','id="fallback"','id="markers"','id="memorySky"','id="drawer"','id="signalDock"','id="lensPanel"'])
    assert.ok(html.includes(id),id);
  assert.match(html,/window\.MarketPeopleResume=resumeScene/);
  assert.doesNotMatch(css,/#gl|#fallback|#memorySky|#selectedCard|#lensPanel/);
  assert.match(css,/#app\.mh-v16\[data-mh-mode="events"\]/);
  assert.match(css,/#app\.mh-v16\[data-mh-mode="connections"\]/);
  assert.match(engine,/window\.MarketPeopleResume\?\.\(\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test('Mirror renderer, shader wrapper and original inline runtime are syntactically valid',()=>{
  for(const [name,source] of [['mirror',engine],['shaders',shaders],['modes',modes],['People original',html.match(/<script>([\s\S]*?)<\/script>/)?.[1]]])
    assert.doesNotThrow(()=>new Script(source,{filename:name}));
});
