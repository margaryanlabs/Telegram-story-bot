import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const runtime=html.match(/<script>([\\s\\S]*?)<\\/script>/)?.[1];
assert.ok(runtime,'Market Remembers inline runtime must exist');

function source(name){
  const begin=runtime.indexOf('function '+name+'(');
  assert.ok(begin>=0,'Missing '+name);
  const brace=runtime.indexOf('{',begin);let depth=0;
  for(let i=brace;i<runtime.length;i++){
    if(runtime[i]==='{')depth++;
    if(runtime[i]==='}'&&--depth===0)return runtime.slice(begin,i+1);
  }
  throw Error('Unbalanced '+name);
}
const front=runInNewContext('('+source('v95FrontStoryProjection')+')',{w:320,h:568});
test('Canvas fallback shows front-facing true stars inside viewport',()=>{
  assert.equal(front({x:180,y:330,z:.5}),true);
  assert.equal(front({x:0,y:0,z:.01}),true);
  assert.equal(front({x:320,y:568,z:.02}),true);
});
test('Canvas fallback culls back-facing stars as the WebGL sphere does',()=>{
  assert.equal(front({x:180,y:330,z:-.09}),false);
  assert.equal(front({x:180,y:330,z:-.5}),false);
  assert.equal(front({x:180,y:330,z:-1}),false);
});
test('Canvas fallback refuses invalid and off-screen projections',()=>{
  for(const p of [null,{}, {x:-1,y:45,z:1},{x:321,y:200,z:1},
    {x:120,y:570,z:1},{x:NaN,y:30,z:1},{x:Infinity,y:30,z:1},
    {x:140,y:30,z:Infinity}]){
    assert.equal(front(p),false,JSON.stringify(p));
  }
});
test('the Canvas star highlight is gated by facing hemisphere and selected LENS',()=>{
  const canvas=source('canvasRender');
  assert.match(canvas,/if\(!v95FrontStoryProjection\(p\)\|\|!lensMatches\(s\)\)return/);
  assert.doesNotMatch(canvas,/p\.z<-.4/);
  assert.match(canvas,/const active=i===selected/);
});
test('WebGL uses the existing triangulated sphere and restrained secondary shading',()=>{
  const core=runtime.slice(runtime.indexOf('const coreFragment='),runtime.indexOf('const precision=',runtime.indexOf('const coreFragment=')));
  assert.match(core,/float bounce=pow\(max\(dot\(N,normalize\(vec3\(\.48,-\.27,\.83\)\)\),0\.\),4\.\)/);
  assert.match(core,/material\+=vec3\(\.025,\.037,\.042\)\*bounce\*\.26/);
  assert.match(runtime,/gl\.drawElements\(gl\.TRIANGLES,coreIndexCount/);
  assert.match(runtime,/gl\.enable\(gl\.DEPTH_TEST\)/);
  assert.match(html,/\.obsidian \.v81-globe-aura,\s*\.obsidian \.energy-sweep\{display:none!important\}/);
});
test('reader typography supports long local notes without scroll overflow on phones',()=>{
  assert.match(html,/\.obsidian \.drawer\.memory-detail \.memory-title\{\s*overflow-wrap:anywhere;hyphens:auto;text-wrap:pretty/);
  assert.match(html,/\.obsidian \.drawer\.memory-detail \.human-lesson p\{/);
  assert.match(html,/@media\(max-width:390px\)\{\s*\.obsidian \.drawer\.memory-detail \.v93-observatory/);
  assert.match(runtime,/behavior:reduceMotion\?'auto':'smooth'/);
});
test('existing private-only data and story reading architecture are preserved',()=>{
  assert.match(runtime,/function v95ImportBackupData/);
  assert.match(runtime,/function v93MountReaderScene/);
  assert.match(runtime,/function v94StoreLocal/);
  assert.match(html,/veto-market-remembers-demo-v4/);
});
