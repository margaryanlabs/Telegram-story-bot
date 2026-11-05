import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=read('index.html');
const people=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const modes=read('v10/market-history-modes.js');
const shader=read('v10/crimson-shaders.js');
const engine=read('v10/crimson-event-core.js');
const css=read('v10/crimson-event-core.css');

test('CRIMSON is a second rendering world, not a filter over People',()=>{
 assert.match(engine,/getContext\('webgl'/);
 assert.match(shader,/uniform float uYaw/);
 assert.match(shader,/uniform float uEmphasis/);
 assert.match(shader,/float fbm\(vec3 p\)/);
 assert.match(engine,/getContext\('2d'\)/);
 assert.match(engine,/mhPlanetSurface/);
 assert.match(css,/#app .mh-crimson-cosmos/);
 assert.match(css,/\.mh-planet-surface/);
 assert.match(css,/\.mh-event-header/);
 assert.match(css,/\.mh-world-veil/);
});

test('two top-level worlds, submodes only inside Event Core',()=>{
 assert.match(modes,/data-mh-mode="people"/);
 assert.match(modes,/EVENT CORE/);
 assert.match(modes,/mh-core-tabs/);
 assert.match(modes,/data-mh-mode="connections"/);
 assert.match(modes,/mh-history-panel/);
 assert.match(modes,/MarketEventPlanet\?\.setActive/);
 assert.match(modes,/MarketEventPlanet\?\.project/);
 assert.match(modes,/MarketEventPlanet\?\.focus/);
 assert.match(modes,/event\.stopPropagation\(\)/);
});

test('People stories, archive, controls and memory persistence remain in place',()=>{
 assert.match(html,/id="scene"/);
 assert.match(html,/id="markers"/);
 assert.match(html,/id="signalDock"/);
 assert.match(html,/id="lensPanel"/);
 assert.match(html,/id="drawer"/);
 assert.match(people,/window\.MarketPeopleResume=resumeScene/);
 assert.match(people,/function sceneIsCovered\(\)\{return [^\n]+dataset\.mhMode/);
 assert.doesNotMatch(engine,/localStorage|sessionStorage|fetch\(|XMLHttpRequest/);
 assert.doesNotMatch(modes,/localStorage\.setItem/);
});

test('crimson runtime dependencies are loaded in safe sequence after original V12',()=>{
 const list=[
 'v10/market-history-modes.css','v10/crimson-event-core.css',
 'window.MarketV10?.start()','v10/market-history-modes.js',
 'v10/crimson-shaders.js','v10/crimson-event-core.js'
 ];
 for(const name of list)assert.ok(html.includes(name),name);
 assert.ok(html.indexOf('window.MarketV10?.start()')<html.indexOf('src="v10/market-history-modes.js"'));
 assert.ok(html.indexOf('src="v10/market-history-modes.js"')<html.indexOf('src="v10/crimson-event-core.js"'));
 assert.ok(html.indexOf('src="v10/crimson-shaders.js"')<html.indexOf('src="v10/crimson-event-core.js"'));
 for(const [name,code] of [['original People',people],['V13 modes',modes],['crimson shader wrapper',shader],['V14 world',engine]])assert.doesNotThrow(()=>new Script(code,{filename:name}));
});

test('Event Core remains keyboard/mobile/reduced-motion friendly',()=>{
 assert.match(css,/@media\(max-width:819px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(engine,/pointerdown/);
 assert.match(engine,/pointermove/);
 assert.match(engine,/webglcontextlost/);
 assert.match(engine,/webglcontextrestored/);
 assert.match(engine,/document\.hidden/);
 assert.match(engine,/nw<820\?1:1\.35/);
});
