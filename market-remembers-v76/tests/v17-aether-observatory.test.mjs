import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const html=read('index.html');
const core=read('v10/crimson-event-core.js');
const modes=read('v10/market-history-modes.js');
const css=read('v10/v17-aether-observatory.css');
const shaderjs=read('v10/crimson-shaders.js');
const box={window:{}};new Script(shaderjs).runInNewContext(box);
const frag=box.window.MHCrimsonShaders.fragment;

test('V17 Aether material raises legibility without becoming a bright lava sphere',()=>{
 for(const fragment of ['vec3 base=mix','float metalPlate','float activeFault=seam*borderRegion','float focusHalo','float focusCore','float fresnel','float spec=','gl_FragColor'])
   assert.ok(frag.includes(fragment),fragment);
 assert.match(frag,/uniform vec3 uActivePos/);
 assert.match(frag,/vec3\(\.45,\.58,\.72\)\*fresnel/);
 assert.doesNotMatch(frag,/vec3 lava=|float thermal=/);
 assert.match(core,/uniforms\.uActivePos/);
 assert.match(core,/gl\.uniform3f\(uniforms\.uActivePos/);
});
test('V17 keeps selected event in view rather than endless auto-rotation',()=>{
 assert.match(modes,/get selectedPoint\(\)/);
 assert.match(core,/if\(current\)focus\(current\)/);
 assert.match(core,/anchorYaw\+Math\.sin\(t\*\.00022\)\*\.042/);
 assert.doesNotMatch(core,/targetYaw\+=dt\*\.000058/);
 assert.match(core,/const qz=sx\*py\+cx\*pz/);
 assert.match(core,/pointer=null;anchorYaw=targetYaw/);
});
test('V17 scene-first event selection does not auto-expand full-screen research',()=>{
 assert.match(modes,/Scene first/);
 const select=modes.slice(modes.indexOf('function selectEvent(id)'),modes.indexOf('function openPeopleTheme'));
 assert.doesNotMatch(select,/panelExpanded = true/);
 assert.match(modes,/data-mh-panel-toggle/);
 assert.match(modes,/panelExpanded = !panelExpanded/);
 assert.match(css,/mh-history-panel:not\(\.is-expanded\)> \.mh-timeline/);
 assert.match(css,/display:grid!important/);
});
test('V17 full research remains an opt-in immersive stage with focused cards',()=>{
 assert.match(modes,/mh-v16-research-card/);
 assert.match(modes,/ПЕРВОИСТОЧНИК/);
 assert.match(modes,/ИССЛЕДОВАНИЕ СОБЫТИЯ/);
 assert.match(css,/mh-v17-research-open/);
 assert.match(css,/mh-history-panel\.is-expanded/);
 assert.match(css,/overflow-y:auto/);
 assert.match(css,/overscroll-behavior:contain/);
 assert.match(css,/\.mh-v16-related-card/);
});
test('V17 responsive scene preserves People and retains 2D fallback',()=>{
 for(const id of ['id="gl"','id="markers"','id="lensPanel"','id="drawer"','id="signalDock"'])
   assert.ok(html.includes(id),id);
 assert.match(html,/v10\/v17-aether-observatory\.css/);
 assert.ok(html.indexOf('v10/v17-aether-observatory.css')>html.indexOf('v10/v16-experience.css'));
 assert.match(core,/getContext\('2d'\)/);
 assert.match(core,/getContext\('webgl'/);
 assert.match(core,/getBoundingClientRect\(\)\.top-stage\.getBoundingClientRect\(\)\.top/);
 assert.match(css,/@media\(max-width:819px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:no-preference\)/);
 for(const source of [core,modes,shaderjs,html.match(/<script>([\s\S]*?)<\/script>/)?.[1]])assert.doesNotThrow(()=>new Script(source));
});
