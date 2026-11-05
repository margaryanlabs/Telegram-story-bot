import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=read('index.html');
const people=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const modes=read('v10/market-history-modes.js');
const core=read('v10/crimson-event-core.js');
const shaderWrapper=read('v10/crimson-shaders.js');
const director=read('v10/v16-scene-director.js');
const css=read('v10/v16-experience.css');
const v15=read('v10/v15-obsidian-polish.css');
const box={window:{}};
new Script(shaderWrapper).runInNewContext(box);
const shader=box.window.MHCrimsonShaders.fragment;

test('V16 signal material: brighter structural body, silver optics and sparse red faults',()=>{
 for(const part of ['vec3 obsidian','float relief','float stress=hairline*gate','float fresnel','fresnel*.43','uShock','gl_FragColor'])assert.ok(shader.includes(part),part);
 assert.doesNotMatch(shader,/vec3 lava=/);
 assert.doesNotMatch(shader,/float thermal=/);
 assert.match(shader,/float field\(vec3 p\)/);
 assert.match(shader,/float sweep=/);
 assert.ok(shader.length>2500);
});
test('Cinematic passage switches separate worlds only after convergence',()=>{
 assert.match(modes,/function commitMode/);
 assert.match(modes,/MarketWorldTransition\.run/);
 assert.match(director,/portal\.dataset\.phase='collapse'/);
 assert.match(director,/portal\.dataset\.phase='ignite'/);
 assert.match(director,/portal\.dataset\.phase='reveal'/);
 assert.match(director,/window\.MarketWorldTransition=Object\.freeze/);
 assert.match(css,/@keyframes mhV16Converge/);
 assert.match(css,/@keyframes mhV16Expand/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/#app\.mh-v16 \.mh-world-veil\{display:none!important\}/);
});
test('Signal nodes follow actual 3D material and support mobile touch',()=>{
 assert.match(core,/const qz=sx\*py\+cx\*pz/);
 assert.match(core,/const nx=cy\*px\+sy\*qz,nz=-sy\*px\+cy\*qz/);
 assert.match(core,/targetYaw=-Math\.atan2\(px,Math\.hypot\(py,pz\)\)/);
 assert.match(modes,/MarketSignalDirector\?\.position/);
 assert.match(css,/min-width:44px;min-height:44px/);
 assert.match(css,/\.mh-beacon:before/);
 assert.match(css,/mh-v16-tether/);
});
test('Research dossier is modular and sourced, with contextual connection mapping',()=>{
 for(const label of ['ЧТО ПРОИЗОШЛО','МЕХАНИЗМ ШОКА','УРОК ДЛЯ ТРЕЙДЕРА','ПЕРВОИСТОЧНИК','ИСТОРИЧЕСКИЕ ПАРАЛЛЕЛИ'])
   assert.ok(modes.includes(label),label);
 assert.match(modes,/mh-v16-related-card/);
 assert.match(modes,/event\.mechanism\.split\('→'\)/);
 assert.match(modes,/FINANCIAL HISTORY/);
 assert.match(modes,/setMode\('people',true,\(\)=>/);
 assert.doesNotMatch(director,/localStorage|sessionStorage|fetch\(/);
});
test('V16 assets load after V12, V14, V15 and do not remove People',()=>{
 for(const id of ['id="gl"','id="markers"','id="lensPanel"','id="drawer"','id="signalDock"'])
   assert.ok(html.includes(id),id);
 for(const f of ['v10/v15-obsidian-polish.css','v10/v16-experience.css','v10/v16-scene-director.js'])
   assert.ok(html.includes(f),f);
 assert.ok(html.indexOf('v10/v16-experience.css')>html.indexOf('v10/v15-obsidian-polish.css'));
 assert.ok(html.indexOf('src="v10/v16-scene-director.js"')>html.indexOf('src="v10/crimson-event-core.js"'));
 for(const [name,code] of [['People',people],['modes',modes],['crimson-core',core],['director',director]])
   assert.doesNotThrow(()=>new Script(code,{filename:name}));
 assert.match(html,/window\.MarketPeopleResume=resumeScene/);
 assert.match(v15,/max-height:min\(64dvh,525px\)/);
});
