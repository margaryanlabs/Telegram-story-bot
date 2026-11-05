import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const file=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=file('index.html');
const shaderjs=file('v10/crimson-shaders.js');
const modes=file('v10/market-history-modes.js');
const director=file('v10/v16-scene-director.js');
const background=file('v10/v16-deep-space.js');
const effects=file('v10/v16-cosmic-effects.css');
const people=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const scope={window:{}};new Script(shaderjs).runInNewContext(scope);
const material=scope.window.MHCrimsonShaders.fragment;

test('exact owner-approved V16 composition is retained',()=>{
 assert.match(html,/v10\/v16-experience\.css/);
 assert.match(html,/v10\/v16-precision-polish\.css/);
 assert.match(html,/v10\/v16-cosmic-effects\.css/);
 assert.match(html,/src="v10\/v16-deep-space\.js"/);
 assert.doesNotMatch(html,/v17-aether-observatory|v17-scene/);
 assert.ok(html.indexOf('v10/v16-cosmic-effects.css')>html.indexOf('v10/v16-precision-polish.css'));
 assert.ok(html.indexOf('v10/v16-deep-space.js')>html.indexOf('v10/v16-scene-director.js'));
 for(const id of ['id="gl"','id="markers"','id="drawer"','id="lensPanel"','id="signalDock"'])
   assert.ok(html.includes(id),id);
});
test('perpetual red flicker removed without changing V16 planet material or camera',()=>{
 assert.match(material,/float hairline=/);
 assert.match(material,/float stress=hairline\*gate/);
 assert.match(material,/rotateCore\(n\)/);
 assert.match(material,/vec3 obsidian=/);
 assert.match(material,/float sweep=/);
 assert.match(material,/float pulse=/);
 assert.match(material,/Static, rare fault etching/);
 assert.doesNotMatch(material,/float ignition=/);
 assert.doesNotMatch(material,/sin\(uTime\*\.00037\+continents\*8\.0\)/);
 assert.match(material,/vec3\(\.59,\.085,\.135\)\*stress/);
});
test('background is deterministic, cheap and redraws only on resize',()=>{
 assert.match(background,/seed=0x16ca3f/);
 assert.match(background,/length:112/);
 assert.match(background,/ResizeObserver/);
 assert.match(background,/getContext\('2d'/);
 assert.match(background,/cosmos\.prepend\(sky\)/);
 assert.doesNotMatch(background,/requestAnimationFrame|setInterval|fetch\(|localStorage/);
 assert.match(effects,/mh-deep-space/);
 assert.match(effects,/75s ease-in-out infinite alternate/);
});
test('user-triggered event burst replaces always-on long dotted connector',()=>{
 assert.match(director,/function triggerEvent\(\)/);
 assert.match(director,/signalUntil=performance\.now\(\)\+820/);
 assert.match(director,/const length=mobile\?64:86/);
 assert.match(director,/performance\.now\(\)<signalUntil/);
 assert.match(director,/window\.MarketSignalDirector=Object\.freeze\(\{setEvent,position,triggerEvent\}\)/);
 assert.match(modes,/MarketSignalDirector\?\.triggerEvent\(\)/);
 assert.match(effects,/mh-event-burst\.is-live/);
 assert.match(effects,/@keyframes mhV16SignalRing/);
 assert.match(effects,/mh-v16-tether path/);
 assert.match(effects,/mh-beacon\.is-active \.mh-beacon-ring\{\s*animation:none!important/);
});
test('tap a year preserves compact dock until explicit user expansion',()=>{
 const selection=modes.slice(modes.indexOf('function selectEvent(id)'),modes.indexOf('function openPeopleTheme'));
 assert.doesNotMatch(selection,/panelExpanded\s*=\s*true/);
 assert.match(modes,/data-mh-panel-toggle aria-expanded/);
 assert.match(modes,/panelExpanded = !panelExpanded/);
 assert.match(modes,/MarketEventPlanet\?\.focus/);
});
test('reduced-motion and People safety remain intact',()=>{
 assert.match(effects,/prefers-reduced-motion:reduce/);
 assert.match(director,/if\(reduced\)return/);
 assert.match(effects,/data-mh-mode="events"/);
 assert.match(effects,/data-mh-mode="connections"/);
 assert.doesNotMatch(background,/localStorage|sessionStorage|XMLHttpRequest/);
 for(const [name,src] of Object.entries({shaderjs,modes,director,background,people}))
   assert.doesNotThrow(()=>new Script(src,{filename:name}));
});
