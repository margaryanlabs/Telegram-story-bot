import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const runtime=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(runtime,'inline app missing');
function extract(name){
  const start=runtime.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' declaration missing');
  const open=runtime.indexOf('{',start);let depth=0;
  for(let i=open;i<runtime.length;i++){
    if(runtime[i]==='{')depth++;
    if(runtime[i]==='}'&&--depth===0)return runtime.slice(start,i+1);
  }
  throw new Error('unbalanced '+name);
}
const fn=(name,ctx)=>runInNewContext('('+extract(name)+')',ctx);
function viewportSetup(overrides={}){
  const state={width:390,height:844,dpr:1.35,covered:false};
  const hits={resize:0,queue:0,markers:0,raf:0};
  const ctx={
    w:390,h:844,dpr:1.35,quality:'auto',autoEco:false,
    resizeQueued:false,v8ViewportPending:false,lastTime:123,
    window:{devicePixelRatio:3,requestAnimationFrame(cb){hits.raf++;cb()}},
    sceneSize(){return {width:state.width,height:state.height}},
    sceneIsCovered(){return state.covered},
    v8NeedsSceneResize(){return fn('v8NeedsSceneResize',ctx)()},
    resize(){hits.resize++;ctx.w=state.width;ctx.h=state.height;ctx.v8ViewportPending=false;ctx.dpr=1.35},
    updateMarkers(){hits.markers++},
    queueFrame(){hits.queue++},
    ...overrides
  };
  return {state,hits,ctx,scheduled:fn('scheduleResize',ctx),resume:fn('resumeScene',ctx)};
}
test('keyboard opening under reader never regenerates hidden WebGL buffers',()=>{
  const {state,hits,ctx,scheduled}=viewportSetup();
  state.covered=true;state.height=530;
  scheduled();
  assert.equal(hits.resize,0);
  assert.equal(hits.queue,0);
  assert.equal(ctx.v8ViewportPending,true);
});
test('closing reader after changed viewport performs one resize and queues one frame',()=>{
  const {state,hits,ctx,scheduled,resume}=viewportSetup();
  state.covered=true;state.height=530;scheduled();
  state.covered=false;resume();
  assert.equal(hits.resize,1);
  assert.equal(hits.queue,1);
  assert.equal(ctx.v8ViewportPending,false);
  assert.equal(ctx.h,530);
  assert.equal(ctx.lastTime,0);
});
test('keyboard closing before reader closes avoids unnecessary rebuild',()=>{
  const {state,hits,ctx,scheduled,resume}=viewportSetup();
  state.covered=true;state.height=530;scheduled();
  state.height=844;scheduled();
  state.covered=false;resume();
  assert.equal(hits.resize,0);
  assert.equal(hits.markers,1);
  assert.equal(hits.queue,1);
  assert.equal(ctx.v8ViewportPending,false);
});
test('foreground orientation changes still rebuild the visible globe',()=>{
  const {state,hits,ctx,scheduled}=viewportSetup();
  state.width=844;state.height=390;scheduled();
  assert.equal(hits.resize,1);
  assert.equal(hits.queue,1);
  assert.equal(ctx.w,844);
  assert.equal(ctx.h,390);
});
test('unchanged viewport neither remeshes nor starts a redundant frame',()=>{
  const {hits,scheduled}=viewportSetup();
  scheduled();
  assert.equal(hits.resize,0);
  assert.equal(hits.queue,0);
});
test('device pixel ratio change is part of resize decision',()=>{
  const {ctx}=viewportSetup();
  assert.equal(fn('v8NeedsSceneResize',ctx)(),false);
  ctx.window.devicePixelRatio=1;
  assert.equal(fn('v8NeedsSceneResize',ctx)(),true);
});
test('pending covered-scene resize is deferred until scene resumes',()=>{
  const {state,hits,ctx,scheduled,resume}=viewportSetup();
  state.covered=true;state.width=420;scheduled();
  resume();
  assert.equal(hits.resize,0);
  state.covered=false;resume();
  assert.equal(hits.resize,1);
  assert.equal(hits.queue,1);
  assert.equal(ctx.v8ViewportPending,false);
});
test('safety-critical engine, archive and thematic routes preserved',()=>{
  assert.match(html,/THE MARKET REMEMBERS V(?:10 — THE LIVING UNIVERSE|11 — COSMIC AWAKENING|11\.7 — EXPLAINABLE CONSTELLATIONS|12 — RELEASE CANDIDATE)/);
  assert.match(runtime,/webglcontextlost/);
  assert.match(runtime,/webglcontextrestored/);
  assert.match(runtime,/function init2D\(\)/);
  assert.match(runtime,/function v79SelectArchive\(/);
  assert.match(runtime,/function v78BackToOrigin\(\)/);
  assert.match(runtime,/function v763MeasureStage\(\)/);
  assert.match(html,/veto-market-remembers-demo-v4/);
  assert.match(html,/@media\(prefers-reduced-motion:reduce\)/);
});
