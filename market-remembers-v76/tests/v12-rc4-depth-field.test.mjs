import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext,Script} from 'node:vm';

const root=new URL('../',import.meta.url);
const load=file=>readFile(new URL(file,root),'utf8');
const [html,sky,css,pkg]=await Promise.all([
  load('index.html'),load('v10/universe-atmosphere.js'),
  load('v10/v12-depth-field.css'),load('package.json')
]);

function stage(){
  const calls={arcs:[],gradients:0,fillRects:0,clears:0};
  const context={
    setTransform(){},clearRect(){calls.clears++},
    createRadialGradient(){
      calls.gradients++;
      return {addColorStop(){}};
    },
    fillRect(){calls.fillRects++},beginPath(){},
    arc(x,y,r){calls.arcs.push([x,y,r])},fill(){}
  };
  const canvas={width:0,height:0,getContext:()=>context};
  const sandbox={window:{},document:{getElementById:id=>id==='memorySky'?canvas:null},Math};
  runInNewContext(sky,sandbox);
  const model=sandbox.window.MarketV10.atmosphere;
  model.init();
  return {model,calls,canvas};
}

test('RC4 optical background is strictly between original sky and true 3D globe',()=>{
  assert.equal(JSON.parse(pkg).version,'12.0.0-rc.6');
  assert.match(html,/v10\/v12-depth-field\.css/);
  assert.equal((html.match(/class="v124-depth-field"/g)||[]).length,1);
  const skyPos=html.indexOf('id="memorySky"'),depthPos=html.indexOf('class="v124-depth-field"');
  const glPos=html.indexOf('id="gl"'),fallbackPos=html.indexOf('id="fallback"');
  assert.ok(skyPos<depthPos&&depthPos<glPos&&glPos<fallbackPos);
  assert.match(css,/pointer-events:none/);
  assert.match(css,/contain:paint/);
  assert.doesNotThrow(()=>new Script(sky));
});
test('Phone rendering keeps original 15Hz scheduling, bounded stars and no new loop',()=>{
  const {model,calls,canvas}=stage();
  model.draw(0,{w:390,h:844,cameraX:0,cameraY:0,low:false,reduced:false});
  assert.equal(model.stats().points,96);
  assert.equal(model.stats().draws,1);
  assert.equal(canvas.width,312);
  assert.equal(canvas.height,675);
  assert.ok(calls.arcs.length>=96&&calls.arcs.length<=105);
  model.draw(40,{w:390,h:844,cameraX:.2,cameraY:.6,low:false,reduced:false});
  assert.equal(model.stats().draws,1);
  model.draw(70,{w:390,h:844,cameraX:.2,cameraY:.6,low:false,reduced:false});
  assert.equal(model.stats().draws,2);
  assert.doesNotMatch(sky,/requestAnimationFrame|setInterval|setTimeout/);
});
test('ECO and reduced-motion avoid optional star halos and pulsating brightness',()=>{
  const {model,calls}=stage();
  model.draw(0,{w:390,h:844,cameraX:0,cameraY:0,low:true,reduced:true});
  assert.equal(model.stats().points,52);
  assert.equal(calls.gradients,1);
  assert.equal(calls.arcs.length,52);
  assert.match(sky,/const flicker=reduced\?1/);
  assert.match(sky,/const breath=reduced\?1/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('Large screens show deeper distant stars without extra GPU materials',()=>{
  const {model,calls}=stage();
  model.draw(0,{w:1280,h:800,cameraX:0,cameraY:0,low:false,reduced:false});
  assert.equal(model.stats().points,210);
  assert.equal(calls.gradients,2);
  assert.ok(calls.arcs.length>=210&&calls.arcs.length<=225);
  assert.match(sky,/i%6===0&&!low/);
  assert.match(sky,/i%19===0&&layer===2&&!low/);
  assert.doesNotMatch(sky,/new WebGLRenderingContext|new AudioContext/);
});
test('Scene opacity and narrow mobile overlays preserve star readability',()=>{
  assert.match(css,/\.markers \.star-marker:focus-visible/);
  assert.match(css,/\.markers \.star-marker\.is-selected/);
  assert.match(css,/@media\(max-width:819px\)/);
  assert.match(css,/@media\(max-width:819px\) and \(max-height:650px\)/);
  assert.match(css,/\.v124-depth-field::after/);
  assert.doesNotMatch(css,/@keyframes|animation-duration:/);
});
