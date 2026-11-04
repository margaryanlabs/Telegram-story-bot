import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js,'Market Remembers inline script missing');
function extract(name){
 const at=js.indexOf('function '+name+'(');
 assert.ok(at>=0,'Missing function: '+name);
 const open=js.indexOf('{',at);let depth=0;
 for(let i=open;i<js.length;i++){
  if(js[i]==='{')depth++;
  if(js[i]==='}'&&--depth===0)return js.slice(at,i+1);
 }
 throw Error('Unbalanced function '+name);
}
const ctx={};
const run=(name)=>runInNewContext('('+extract(name)+')',ctx);
ctx.v98FlightEase=run('v98FlightEase');
ctx.v98FlightZoom=run('v98FlightZoom');

test('V9.8 easing clamps invalid/outside-of-range progress',()=>{
 const ease=ctx.v98FlightEase;
 assert.equal(ease(-1),0);
 assert.equal(ease(0),0);
 assert.equal(ease(1),1);
 assert.equal(ease(4),1);
 assert.equal(ease(NaN),0);
 assert.equal(ease(Infinity),0);
});
test('V9.8 quintic curve has restrained acceleration and deceleration',()=>{
 const ease=ctx.v98FlightEase;
 assert.ok(ease(.1)<.02);
 assert.ok(ease(.9)>.98);
 assert.ok(Math.abs(ease(.5)-.5)<.00001);
 for(let i=1;i<=100;i++){
  assert.ok(ease(i/100)>=ease((i-1)/100),'ease must be monotonic');
  assert.ok(ease(i/100)<=1);
 }
});
test('V9.8 zoom preserves original 1350ms phase and target bounds',()=>{
 const zoom=ctx.v98FlightZoom;
 for(const time of [-300,0,219,220])assert.equal(zoom(time),1.25);
 for(const time of [1000,1100,1350,2000])assert.equal(zoom(time),1.65);
 for(let time=220;time<=1000;time+=10){
  assert.ok(zoom(time)>=1.25&&zoom(time)<=1.65);
 }
});
test('V9.8 zoom is smooth at phase boundaries and increases during flight',()=>{
 const zoom=ctx.v98FlightZoom;
 assert.ok(Math.abs(zoom(219.9)-zoom(220.1))<.00001);
 assert.ok(Math.abs(zoom(999.9)-zoom(1000.1))<.00001);
 assert.ok(zoom(360)>1.25);
 assert.ok(zoom(650)>zoom(360));
 assert.ok(zoom(920)>zoom(650));
});
test('real selected-star GPU point is illuminated by existing passage energy',()=>{
 const vertex=js.slice(js.indexOf('const pVertex='),js.indexOf('const pFragment='));
 const fragment=js.slice(js.indexOf('const pFragment='),js.indexOf('const lVertex='));
 assert.match(vertex,/uniform float uPulse/);
 assert.match(vertex,/vSelected\*\(2\.0\+uPulse\*\.32\)/);
 assert.match(fragment,/uniform float uPulse/);
 assert.match(fragment,/vSelected\*\(\.28\+uPulse\*\.60\)/);
 assert.match(js,/uPulse:reduceMotion\?0:v9State\.energy/);
});
test('Canvas2D selected star has equivalent subtle pulse without new draws',()=>{
 const canvas=extract('canvasRender');
 assert.match(canvas,/active\?26\+Math\.min\(4,v9State\.energy\*4\):16/);
 assert.match(canvas,/stories\.forEach\(\(s,i\)=>/);
 assert.match(canvas,/v95FrontStoryProjection\(p\)/);
});
test('GPU keeps the original WebGL1 mesh and no extra postprocessing pass',()=>{
 const render=extract('webGLRender');
 assert.match(render,/gl\.drawElements\(gl\.TRIANGLES,coreIndexCount/);
 assert.match(render,/gl\.drawArrays\(gl\.POINTS,0,pts\)/);
 assert.match(render,/gl\.depthMask\(false\)/);
 assert.match(html,/\.obsidian \.v81-globe-aura,\s*\.obsidian \.energy-sweep\{display:none!important\}/);
});
test('selected marker retains keyboard focus outline and reduced-motion fallback',()=>{
 assert.match(html,/\.obsidian \.star-marker\.is-selected:focus-visible/);
 assert.match(html,/@media\(prefers-reduced-motion:reduce\)\{\s*\.obsidian \.star-marker\.is-selected/);
 const begin=extract('beginDive');
 assert.match(begin,/if\(reduceMotion\)\{showStory\(stories\[index\]\);return\}/);
});
