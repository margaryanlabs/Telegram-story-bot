import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script,runInNewContext} from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [html,sky,css,depth,pkg]=await Promise.all([
  read('index.html'),read('v10/universe-atmosphere.js'),
  read('v10/v12-universe-cinema.css'),
  read('v10/v12-universe-depth-v2.css'),read('package.json')
]);
const fragment=html.match(/const coreFragment=`([\s\S]*?)`;/)?.[1]||'';

test('V12 RC6 ships the real cinematic globe, not a disconnected illustration',()=>{
  assert.equal(JSON.parse(pkg).version,'12.0.0-rc.6');
  assert.equal(html.split('href="v10/v12-universe-cinema.css"').length-1,1);
  assert.ok(html.indexOf('v10/v12-universe-cinema.css')>html.indexOf('v10/v12-depth-field.css'));
  assert.match(html,/CINEMATIC UNIVERSE · V12 RC6/);
  assert.match(html,/gl\.drawElements\(gl\.TRIANGLES,coreIndexCount/);
  assert.match(html,/const coreVertex=`precision highp float/);
  assert.match(html,/const coreFragment=`#ifdef GL_FRAGMENT_PRECISION_HIGH/);
  assert.match(fragment,/precision highp float;/);
  assert.match(fragment,/#else\nprecision mediump float;/);
  assert.doesNotThrow(()=>new Script(html.match(/<script>([\s\S]*?)<\/script>/)?.[1]||''));
});

test('WebGL memory globe has more dimensional depth, cyan plasma and warm edge',()=>{
  assert.match(fragment,/float nebulaNoise=/);
  assert.match(fragment,/float nebulaNoise3\(vec3 p\)/);
  assert.match(fragment,/float cloudDepth=nebulaNoise3\(/);
  assert.match(fragment,/float shadowCavity=/);
  assert.match(fragment,/float goldZone=/);
  assert.match(fragment,/float stellarDust=/);
  assert.match(fragment,/float brightVein=/);
  assert.match(fragment,/float limb=pow\(1\.-clamp\(N\.z/);
  assert.match(fragment,/vec3\(\.235,\.158,\.098\)\*warmLimb/);
  assert.match(fragment,/vec3\(\.145,\.340,\.395\)\*brightVein/);
  assert.match(fragment,/float traceA=/);
  assert.match(fragment,/float traceB=/);
  assert.match(fragment,/visibleFace\*\(vec3\(\.19,\.38,\.43\)\*traceA\*\.18/);
  assert.match(fragment,/float gaseousBank=/);
  assert.match(fragment,/float darkRift=/);
  assert.match(fragment,/float cloudRidge=/);
  assert.match(fragment,/vec3\(\.141,\.395,\.475\)\*brightCurrent\*veil\*\.31/);
  assert.match(html,/const nominalRadius=Math\.min\(w,h\)\*\(short\?\.296:\.306\)/);
  assert.match(fragment,/gl_FragColor=vec4\(clamp\(material,0\.,1\.\),1\.\)/);
});

test('Android automatic/ECO material retains primary depth but skips secondary detail',()=>{
  assert.match(fragment,/uniform mediump float uQuality/);
  assert.match(fragment,/if\(uQuality>\.5\)\{/);
  assert.match(fragment,/float cloudDetail=nebulaNoise3/);
  assert.match(fragment,/float speckSeed=hash\(floor\(speckCoords\)\)/);
  assert.ok(fragment.indexOf('material+=vec3(.145,.340,.395)*brightVein')<
            fragment.indexOf('if(uQuality>.5)'));
  assert.ok(fragment.indexOf('float microCloud=')>
            fragment.indexOf('if(uQuality>.5)'));
  assert.match(html,/uQuality:\(quality==='low'\|\|\(quality==='auto'&&\(w<820\|\|autoEco\)\)\)\?0:1/);
});

test('Canvas fallback shows real clipped sphere with nebula and quality guard',()=>{
  assert.match(html,/ctx\.arc\(c\.x,c\.y,r,0,twoPi\);ctx\.clip\(\)/);
  assert.match(html,/const cloudRibbon=ctx\.createLinearGradient/);
  assert.match(html,/const warmCloud=ctx\.createRadialGradient/);
  assert.match(html,/if\(quality!=='low'&&!autoEco\)/);
  assert.match(html,/ctx\.globalCompositeOperation='screen'/);
  assert.match(html,/webglcontextlost/);
  assert.match(html,/function init2D\(\)/);
});

test('Static background stays behind original sphere and cannot intercept taps',()=>{
  const skyIndex=html.indexOf('id="memorySky"');
  const opticalIndex=html.indexOf('class="v124-depth-field"');
  const planetBackgroundIndex=html.indexOf('class="v127-space-field"');
  const globeIndex=html.indexOf('id="gl"');
  assert.ok(opticalIndex<planetBackgroundIndex&&planetBackgroundIndex<globeIndex);
  assert.equal(html.split('v10/v12-universe-depth-v2.css').length-1,1);
  assert.match(depth,/\.v127-galaxy\{/);
  assert.match(depth,/\.v127-nebula-river\{/);
  assert.match(depth,/\.v127-nebula-crown\{/);
  assert.match(depth,/pointer-events:none/);
  assert.match(depth,/@media\(prefers-reduced-motion:reduce\)/);
  assert.ok(skyIndex>=0&&skyIndex<opticalIndex&&opticalIndex<globeIndex);
  assert.match(css,/#app\.obsidian \.v124-depth-field\{/);
  assert.match(css,/pointer-events:none/);
  assert.match(css,/#app\.obsidian \.scene-shading\{/);
  assert.match(css,/#app\.obsidian \.v81-globe-aura::after\{/);
  assert.match(html,/class="v126-orbit-guide" aria-hidden="true"/);
  assert.match(css,/\.v126-orbit-guide::before/);
  assert.match(css,/\.v126-orbit-guide::after/);
  assert.match(css,/\.v81-globe-aura\.is-eco \.v126-orbit-guide::after/);
  assert.match(css,/\.star-marker\.is-selected/);
  assert.match(css,/@media\(max-width:819px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css,/@keyframes|animation-duration:\s*\d+ms/);
});

test('Original starfield remains deterministic, throttled and ECO-bounded',()=>{
  assert.doesNotThrow(()=>new Script(sky));
  const calls={arcs:0,gradients:0};
  const ctx={
    setTransform(){},clearRect(){},fillRect(){},beginPath(){},fill(){},
    arc(){calls.arcs++},
    createRadialGradient(){calls.gradients++;return{addColorStop(){}}}
  };
  const canvas={width:0,height:0,getContext:()=>ctx};
  const env={window:{},document:{getElementById:()=>canvas}};
  runInNewContext(sky,env);
  const fx=env.window.MarketV10.atmosphere;
  fx.init();
  fx.draw(0,{w:390,h:844,cameraX:0,cameraY:0,low:true,reduced:true});
  assert.equal(fx.stats().points,52);
  assert.equal(calls.arcs,52);
  assert.equal(calls.gradients,1);
  assert.equal(fx.stats().draws,1);
  fx.draw(12,{w:390,h:844,cameraX:0,cameraY:0,low:true,reduced:true});
  assert.equal(fx.stats().draws,1);
  assert.doesNotMatch(sky,/requestAnimationFrame|setInterval|setTimeout/);
});
