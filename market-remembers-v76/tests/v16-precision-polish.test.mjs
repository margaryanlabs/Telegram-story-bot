import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const file = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const html = file('index.html');
const shaderWrapper = file('v10/crimson-shaders.js');
const polish = file('v10/v16-precision-polish.css');
const originalV16 = file('v10/v16-experience.css');
const modes = file('v10/market-history-modes.js');
const renderer = file('v10/crimson-event-core.js');
const director = file('v10/v16-scene-director.js');
const context={window:{}};
new Script(shaderWrapper).runInNewContext(context);
const fragment=context.window.MHCrimsonShaders.fragment;

test('V16 remains the active base, with isolated polish layer loaded last',()=>{
  assert.match(html,/v10\/v16-experience\.css/);
  assert.match(html,/v10\/v16-precision-polish\.css/);
  assert.ok(html.indexOf('v10/v16-experience.css') < html.indexOf('v10/v16-precision-polish.css'));
  assert.doesNotMatch(html,/v17-aether-observatory/);
  for(const marker of ['id="gl"','id="markers"','id="lensPanel"','id="drawer"','id="signalDock"']) assert.ok(html.includes(marker), marker);
});

test('V16 shader retains its geometry, red stress seams, original timing and subdued luminance lift',()=>{
  for(const token of ['float field(vec3 p)','rotateCore(n)','float stress=hairline*gate','float sweep=',
    'vec3 obsidian=mix(vec3(.060,.078,.105),vec3(.187,.211,.252),relief)',
    'vec3(.36,.47,.60)*fresnel*.43'])
    assert.ok(fragment.includes(token), token);
  assert.doesNotMatch(fragment,/vec3 lava=|float thermal=|uniform vec3 uActivePos/);
  assert.match(renderer,/targetYaw\+=dt\*\.000058/); // Original V16 movement deliberately unchanged.
  assert.match(renderer,/nw<820\?1:1\.35/); // Existing phone GPU quality limit remains.
});

test('Polish is scoped to the EVENT CORE world and never overrides the original People renderer',()=>{
  assert.match(polish,/#app\.mh-v16\[data-mh-mode="events"\]/);
  assert.match(polish,/#app\.mh-v16\[data-mh-mode="connections"\]/);
  assert.doesNotMatch(polish,/#app(?:\s|\.) #gl|#memorySky|#selectedCard|#lensPanel/);
  assert.match(polish,/mh-history-panel\.is-expanded/);
  assert.match(polish,/mh-v16-research-card/);
  assert.match(polish,/mh-beacon\.is-active/);
  assert.match(originalV16,/mh-v16-portal/);
});

test('Motion remains low-intensity and respects reduced-motion preferences',()=>{
  assert.match(polish,/prefers-reduced-motion:no-preference/);
  assert.match(polish,/prefers-reduced-motion:reduce/);
  for(const motion of ['mhV16pOrbit','mhV16pScan','mhV16pNode','mhV16pAppear','mhV16pSignalFlow'])
    assert.ok(polish.includes(motion),motion);
  assert.match(director,/portal\.dataset\.phase='collapse'/);
  assert.match(director,/portal\.dataset\.phase='ignite'/);
  assert.match(director,/portal\.dataset\.phase='reveal'/);
});

test('Original event data, selection, archive links and scripts remain usable',()=>{
  for(const name of ['1907','1987','2008','2020'])
    assert.ok(modes.includes('"id": "'+name+'"'),name);
  assert.match(modes,/MarketEventPlanet\?\.focus/);
  assert.match(modes,/MarketSignalDirector\?\.position/);
  assert.match(modes,/data-mh-panel-toggle/);
  assert.match(modes,/function openPeopleTheme/);
  for(const [name,code] of [['History modes',modes],['Event renderer',renderer],['V16 director',director],['Shader wrapper',shaderWrapper]])
    assert.doesNotThrow(()=>new Script(code,{filename:name}));
});
