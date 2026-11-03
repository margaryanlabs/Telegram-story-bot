import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const original=readFileSync(fileURLToPath(new URL('../../market-remembers-preview/human-legacy-v74.html',import.meta.url)),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const eclipsed=html.slice(html.indexOf('/* V8.2 — ECLIPSE'),html.indexOf('</style>'));
assert.ok(script&&eclipsed.startsWith('/* V8.2 — ECLIPSE'));
function functionSource(name){
  const start=script.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' missing');
  const begin=script.indexOf('{',start);let d=0;
  for(let i=begin;i<script.length;i++){
    if(script[i]==='{')d++;
    if(script[i]==='}'&&--d===0)return script.slice(start,i+1);
  }
  throw new Error('unbalanced function '+name);
}
test('Eclipse visually removes the circular atmosphere ring introduced in V8.0',()=>{
  assert.match(eclipsed,/\.obsidian \.v81-globe-aura,\s*\.obsidian \.energy-sweep\{display:none!important\}/);
  assert.match(eclipsed,/\.obsidian \.lens-halo\{opacity:\.025!important\}/);
  assert.match(eclipsed,/\.obsidian \.scene-grid\{opacity:\.012!important\}/);
});
test('V7.4 real WebGL core shader was kept byte-for-byte unchanged',()=>{
  const shader=t=>{
    const start=t.indexOf('const coreFragment=');
    const end=t.indexOf('const precision=',start);
    assert.ok(start>=0&&end>start);
    return t.slice(start,end);
  };
  assert.equal(shader(html),shader(original));
});
test('WebGL and Canvas fallback retain existing visual source, not substitute illustration',()=>{
  assert.match(script,/function initGL\(\)/);
  assert.match(script,/function init2D\(\)/);
  assert.match(script,/function canvasRender\(t\)/);
  assert.match(html,/id="gl"/);
  assert.match(html,/id="fallback"/);
});
test('mobile hero layout actually matches the root DOM selector',()=>{
  assert.match(html,/class="app obsidian" id="app"/);
  assert.match(eclipsed,/\.app\.obsidian \.hero\{top:118px/);
  assert.doesNotMatch(eclipsed,/\.obsidian \.app \.hero/);
});
test('new mobile headline has calmer hierarchy while retaining original call to action',()=>{
  assert.match(eclipsed,/\.obsidian \.hero h1\{font-size:clamp\(29px,8vw,38px\)/);
  assert.match(eclipsed,/\.obsidian \.hero-actions \.btn-primary\{min-height:40px/);
  assert.match(html,/id="heroCreate"/);
});
test('three globe size modes survive the restored original camera proportions',()=>{
  assert.match(script,/function v81CycleScale\(\)/);
  assert.match(html,/id="globeScale"/);
  assert.match(script,/radius:Math\.min\(w,h\)\*\(short\?\.36:\.397\)/);
  const fn=runInNewContext('('+functionSource('v81ScaleFactor')+')');
  assert.equal(fn('small'),.73);
  assert.equal(fn('big'),1);
  assert.equal(fn('max'),1.15);
});
test('private stories, editorial links and cinematic transitions remain',()=>{
  assert.match(html,/veto-market-remembers-demo-v4/);
  assert.match(script,/function v79SelectArchive\(/);
  assert.match(script,/function v78FollowThread\(/);
  assert.match(script,/function v8NeedsSceneResize\(/);
});
test('responsive and reduced-motion CSS does not require another GPU pass',()=>{
  assert.match(eclipsed,/@media\(max-width:820px\)/);
  assert.match(eclipsed,/@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(eclipsed,/canvas\.getContext\(/);
});
