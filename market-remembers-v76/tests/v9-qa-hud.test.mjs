import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const runtime=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(runtime,'runtime missing');
function extract(name){
  const start=runtime.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' not found');
  const begin=runtime.indexOf('{',start);let depth=0;
  for(let i=begin;i<runtime.length;i++){
    if(runtime[i]==='{')depth++;
    if(runtime[i]==='}'&&--depth===0)return runtime.slice(start,i+1);
  }
  throw new Error('Unbalanced '+name);
}
const make=(name,ctx={})=>runInNewContext('('+extract(name)+')',ctx);

function fixture(enabled=true){
 const qaPanel={hidden:true,open:false},qaStatus={textContent:''},qaCopy={onclick:null};
 const birthOverlay={hidden:true},drawer={hidden:true};
 const controls={qaPanel,qaStatus,qaCopy,birthOverlay,drawer};
 const qaState={frames:0,period:0,fps:0,previousTime:0,fallbackCount:0,
                webglLossCount:0,errorCount:0};
 const messages=[],clipboard=[];
 const ctx={qaEnabled:enabled,qaState,w:390,h:844,dpr:1.35,resW:527,resH:1139,
   gl:{},ctx:null,quality:'auto',autoEco:false,reduceMotion:false,immersive:false,
   birth:null,diveIndex:-1,
   $:id=>controls[id],
   navigator:{clipboard:{writeText:text=>{clipboard.push(text);return {then(ok){ok()}}}}},
   showToast:s=>messages.push(s)};
 ctx.qaSnapshot=make('qaSnapshot',ctx);
 ctx.qaPaint=make('qaPaint',ctx);
 return {ctx,controls,qaState,messages,clipboard};
}
test('QA panel is opt-in through exact ?qa=1 and hidden by default',()=>{
 assert.match(runtime,/new URLSearchParams\(window\.location\.search\)\.get\('qa'\)==='1'/);
 assert.match(html,/id="qaPanel" class="v9-qa-panel" hidden/);
 const f=fixture(false);
 make('qaInit',f.ctx)();
 assert.equal(f.controls.qaPanel.hidden,true);
 assert.equal(f.controls.qaCopy.onclick,null);
});
test('QA panel displays live mode and remains local-only',()=>{
 const f=fixture();
 make('qaInit',f.ctx)();
 assert.equal(f.controls.qaPanel.hidden,false);
 assert.equal(f.controls.qaPanel.open,true);
 assert.match(f.controls.qaStatus.textContent,/WEBGL1/);
 assert.match(f.controls.qaStatus.textContent,/390 × 844/);
 assert.match(f.controls.qaStatus.textContent,/DPR: 1.35/);
 assert.match(f.controls.qaStatus.textContent,/AUTO/);
});
test('renderer fallback and quality eco are visible but never reveal story content',()=>{
 const f=fixture();
 f.ctx.gl=null;f.ctx.ctx={};
 f.ctx.quality='low';f.ctx.autoEco=true;
 f.ctx.immersive=true;f.qaState.webglLossCount=2;
 f.qaState.fallbackCount=1;f.qaState.fps=38;
 const text=f.ctx.qaSnapshot();
 assert.match(text,/Renderer: CANVAS2D/);
 assert.match(text,/Graphics: LOW \/ ECO/);
 assert.match(text,/WebGL losses: 2/);
 assert.match(text,/FPS \(last active second\): 38/);
 assert.match(text,/FOCUS/);
 assert.doesNotMatch(text,/localStorage|story|alias|quote|user|uuid|id=/i);
});
test('copy QA contains only performance and renderer information',()=>{
 const f=fixture();
 make('qaInit',f.ctx)();
 f.controls.qaCopy.onclick();
 assert.equal(f.clipboard.length,1);
 assert.equal(f.clipboard[0],f.ctx.qaSnapshot());
 assert.match(f.messages[0],/без личных данных/);
});
test('copy failure has a fallback to a manual QA screenshot',()=>{
 const f=fixture();
 f.ctx.navigator.clipboard=null;
 make('qaInit',f.ctx)();
 f.controls.qaCopy.onclick();
 assert.match(f.messages[0],/скриншот/);
});
test('fps samples are counted by actual rAF timestamps and updated once per second',()=>{
 const f=fixture();
 make('qaFrame',f.ctx)(100);
 for(let i=1;i<=65;i++)make('qaFrame',f.ctx)(100+i*16.667);
 assert.ok(f.qaState.fps>=55&&f.qaState.fps<=65);
 assert.match(f.controls.qaStatus.textContent,/FPS/);
});
test('background-tab elapsed frames are discarded rather than reporting false FPS',()=>{
 const f=fixture();
 const step=make('qaFrame',f.ctx);
 step(100);step(116);step(1800);
 assert.equal(f.qaState.frames,1);
 assert.equal(f.qaState.period,16);
});
test('birth particle gather completes before the success overlay appears',()=>{
 assert.match(html,/animation:v94Gather 1\.75s/);
 assert.match(runtime,/Math\.floor\(rng\(\)\*650\)\+'ms'/);
 assert.match(runtime,/birth&&t-birth\.started>2450/);
 const maxSparkMs=1750+650;
 assert.ok(maxSparkMs<2450);
});
test('the diagnostics do not change production local storage or send telemetry',()=>{
 const slice=runtime.slice(runtime.indexOf('// V9 release QA'),runtime.indexOf('// V7.6: lightweight reader progress.')).replace(/\/\/[^\n]*/g,'');
 assert.doesNotMatch(slice,/fetch\(|XMLHttpRequest|sendBeacon|localStorage\s*[.\[]|sessionStorage\s*[.\[]|WebSocket/);
 assert.match(slice,/Never include selected aliases, notes, star IDs/);
 assert.match(html,/Без личных историй, ID, координат и сетевой отправки/);
});
test('normal page keeps existing source readers, sphere and production privacy',()=>{
 assert.match(runtime,/function webGLRender\(t\)/);
 assert.match(runtime,/function canvasRender\(t\)/);
 assert.match(runtime,/function v94StoreLocal\(story\)/);
 assert.match(runtime,/function v94ReturnToStar\(\)/);
 assert.match(runtime,/function v9Tick\(t\)/);
 assert.match(html,/id="gl"/);
 assert.match(html,/id="fallback"/);
});
