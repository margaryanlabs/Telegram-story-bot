import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html = read('index.html');
const modes = read('v10/market-history-modes.js');
const engine = read('v10/crimson-event-core.js');
const shaderWrapper = read('v10/crimson-shaders.js');
const polish = read('v10/v15-obsidian-polish.css');
const shaderContext = {window:{}};
new Script(shaderWrapper).runInNewContext(shaderContext);
const frag = shaderContext.window.MHCrimsonShaders.fragment;

test('V15 new obsidian material keeps red accents localized rather than lava-world', () => {
  assert.match(frag,/Obsidian alloy/);
  assert.match(frag,/hairline/);
  assert.match(frag,/stress=hairline\*gate/);
  assert.match(frag,/obsidian/);
  assert.match(frag,/uShock/);
  assert.doesNotMatch(frag,/vec3 lava=/);
  assert.doesNotMatch(frag,/float thermal=/);
  assert.match(frag,/vec3 color=obsidian\*shading/);
});

test('mobile size fits entire planet above compact information dock',()=>{
  assert.match(engine,/Math\.min\(w\*\.395,clearHeight\*\.50,h\*\.29\)/);
  assert.match(engine,/reservedTop\+clearHeight\*\.50/);
  assert.match(polish,/\.mh-history-panel:not\(\.is-expanded\)/);
  assert.match(polish,/\.mh-panel-grip/);
  assert.match(polish,/max-height:min\(64dvh,525px\)/);
  assert.match(polish,/\.mh-intro\{/);
});

test('research detail is accessible yet collapsed on load; event selection opens details',()=>{
  assert.match(modes,/let panelExpanded = false/);
  assert.match(modes,/data-mh-panel-toggle aria-expanded/);
  assert.match(modes,/panelExpanded = true;/);
  assert.match(modes,/panelExpanded = !panelExpanded/);
  assert.match(modes,/panel\.classList\.toggle\('is-expanded'/);
  assert.match(modes,/event\.stopPropagation/);
});

test('People mode remains physically separate and original scripts survive',()=>{
  for(const id of ['id="gl"','id="markers"','id="signalDock"','id="lensPanel"','id="drawer"'])
    assert.ok(html.includes(id),id);
  assert.match(html,/window\.MarketPeopleResume=resumeScene/);
  assert.match(html,/v10\/v15-obsidian-polish\.css/);
  assert.ok(html.indexOf('v10/crimson-event-core.css') < html.indexOf('v10/v15-obsidian-polish.css'));
  assert.match(polish,/#app\[data-mh-mode="events"\]/);
  assert.match(polish,/#app\[data-mh-mode="connections"\]/);
  assert.doesNotMatch(modes,/localStorage\.setItem/);
  assert.doesNotMatch(engine,/localStorage\.setItem/);
  new Script(modes);
  new Script(engine);
});
