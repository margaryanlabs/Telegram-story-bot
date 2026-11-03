import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js);
function extract(name){
 const start=js.indexOf('function '+name+'(');
 assert.ok(start>=0,name+' missing');
 const open=js.indexOf('{',start);let level=0;
 for(let i=open;i<js.length;i++){
  if(js[i]==='{')level++;
  if(js[i]==='}'&&--level===0)return js.slice(start,i+1);
 }
 throw new Error('unbalanced '+name);
}
const run=(name,ctx={})=>runInNewContext('('+extract(name)+')',ctx);
test('one fixed three-phase passage maps elapsed time to lock, flight and reveal',()=>{
 const phase=run('v9PhaseFor');
 assert.equal(phase(0),'lock');
 assert.equal(phase(219),'lock');
 assert.equal(phase(220),'flight');
 assert.equal(phase(999),'flight');
 assert.equal(phase(1000),'reveal');
});
function sceneContext(){
 const overlay={
  hidden:true,dataset:{},attrs:{},
  setAttribute(k,v){this.attrs[k]=v},
  style:{setProperty(){}},
  querySelector:()=>({style:{animation:''}}),
  offsetWidth:320
 };
 const skip={focused:false,focus(){this.focused=true}};
 const controls={dockOpen:{focus(){}},openSelected:{focus(){}},cancelDive:skip,
  memoryDive:overlay,diveName:{textContent:''},v9PassageStatus:{textContent:''}};
 const ctx={
  stories:[{alias:'A',category:'Risk',p:[0,0,1],type:'fictional'},
           {alias:'B',category:'Patience',p:[1,0,0],type:'fictional'}],
  selected:0,w:390,h:844,reduceMotion:false,
  v9State:{phase:'idle',started:0,index:-1,token:0,energy:0},
  diveIndex:-1,diveSequence:0,diveTimer:null,v93PassagePausedAt:0,targetZoom:1,flightFinish:0,
  v78ThreadContext:null,lensColors:{Risk:'#aabbcc',Patience:'#ccbbaa'},document:{activeElement:null,hidden:false},
  performance:{now:()=>100},
  $:key=>controls[key],
  clamp:(x,min,max)=>Math.min(max,Math.max(min,x)),
  lensMatches:()=>true,setLens(){},closeLensPanel(){},
  focus(index){this.selected=index},v78UpdateDiveRoute(){},updateDivePosition(){this.anchored=true},
  setTimeout(fn,ms){this.pending={fn,ms};return 23},
  clearTimeout(){this.cleared=true},
  showStory(story){this.opened=story.alias},
  closeDrawer(){},...{}
 };
 controls.drawer={hidden:true};
 ctx.v93SuspendPassage=run('v93SuspendPassage',ctx);
 ctx.v93ResumePassage=run('v93ResumePassage',ctx);
 ctx.cancelDive=run('cancelDive',ctx);
 ctx.finishDive=run('finishDive',ctx);
 ctx.beginDive=run('beginDive',ctx);
 ctx.v9PhaseFor=run('v9PhaseFor',ctx);
 ctx.v9Tick=run('v9Tick',ctx);
 return {ctx,controls,overlay,skip};
}
test('selected star launches a real cancellable flight with the correct alias',()=>{
 const {ctx,overlay,skip}=sceneContext();
 ctx.beginDive(1);
 assert.equal(ctx.diveIndex,1);
 assert.equal(ctx.v9State.phase,'lock');
 assert.equal(ctx.v9State.index,1);
 assert.equal(ctx.targetZoom,1.25);
 assert.equal(overlay.hidden,false);
 assert.equal(overlay.attrs['aria-hidden'],'false');
 assert.equal(ctx.pending.ms,1350);
 assert.equal(ctx.anchored,true);
 assert.equal(skip.focused,true);
 assert.equal(ctx.$('diveName').textContent,'@B');
});
test('flight phase moves camera in and lights the actual selected star',()=>{
 const {ctx}=sceneContext();
 ctx.beginDive(1);
 ctx.v9Tick(360);
 assert.equal(ctx.v9State.phase,'flight');
 assert.ok(ctx.targetZoom>1.25);
 assert.ok(ctx.v9State.energy>0);
 ctx.v9Tick(1200);
 assert.equal(ctx.v9State.phase,'reveal');
 assert.equal(ctx.targetZoom,1.65);
 assert.equal(ctx.$('v9PassageStatus').textContent,'ОТКРЫВАЕМ ИСТОРИЮ');
});
test('timer completes the selected story, not a fabricated detached reader',()=>{
 const {ctx,overlay}=sceneContext();
 ctx.beginDive(1);
 const seq=ctx.diveSequence;
 ctx.finishDive(seq);
 assert.equal(ctx.opened,'B');
 assert.equal(ctx.diveIndex,-1);
 assert.equal(ctx.v9State.phase,'idle');
 assert.equal(ctx.v9State.energy,0);
 assert.equal(overlay.hidden,true);
});
test('an interrupted flight cannot open an obsolete story',()=>{
 const {ctx}=sceneContext();
 ctx.beginDive(0);
 const stale=ctx.diveSequence;
 ctx.cancelDive();
 ctx.beginDive(1);
 ctx.finishDive(stale);
 assert.equal(ctx.opened,undefined);
 ctx.finishDive(ctx.diveSequence);
 assert.equal(ctx.opened,'B');
});
test('Escape/cancel leaves the globe visible and no history is opened',()=>{
 const {ctx,overlay}=sceneContext();
 ctx.beginDive(0);
 ctx.cancelDive();
 assert.equal(overlay.hidden,true);
 assert.equal(ctx.opened,undefined);
 assert.equal(ctx.v9State.energy,0);
 assert.equal(ctx.diveTimer,null);
});
test('skip opens the correct reader and never leaves an active pulse',()=>{
 const {ctx}=sceneContext();
 ctx.beginDive(0);
 ctx.finishDive(ctx.diveSequence);
 assert.equal(ctx.opened,'A');
 assert.equal(ctx.v9State.phase,'idle');
 assert.equal(ctx.diveIndex,-1);
});
test('reduced motion opens the real story immediately without an animated overlay',()=>{
 const {ctx,overlay}=sceneContext();
 ctx.reduceMotion=true;
 ctx.beginDive(1);
 assert.equal(ctx.opened,'B');
 assert.equal(ctx.diveIndex,-1);
 assert.equal(overlay.hidden,true);
 assert.equal(ctx.pending,undefined);
});
test('spark field uses a fixed tiny DOM batch, with no per-frame creation',()=>{
 const nodes=[];
 const field={children:nodes,append(fragment){nodes.push(...fragment.children)}};
 const env={
  $:()=>field,
  document:{
    createDocumentFragment:()=>({children:[],append(el){this.children.push(el)}}),
    createElement:()=>({props:{},style:{setProperty(k,v){this[k]=v}},setAttribute(k,v){this.props[k]=v}})
  }
 };
 const build=run('v9PrepareSparkField',env);
 build();build();
 assert.equal(nodes.length,14);
 assert.equal(nodes[0].props['aria-hidden'],'true');
});
test('shader energy is sent only into existing programs, not separate full-screen visuals',()=>{
 assert.match(js,/uPulse:reduceMotion\?0:v9State\.energy/);
 assert.match(js,/uniform float uPulse/);
 assert.match(js,/gl\.drawElements\(gl\.TRIANGLES/);
 assert.match(js,/function canvasRender\(t\)/);
 assert.match(html,/id="v9SparkField"/);
 assert.match(html,/class="memory-dive"/);
 assert.match(html,/\.memory-dive::after\{display:none!important\}/);
 assert.match(html,/@media\(prefers-reduced-motion:reduce\)/);
});


test('background browser suspends flight without opening a story',()=>{
 const {ctx}=sceneContext();
 ctx.beginDive(0);
 ctx.document.hidden=true;
 ctx.v93SuspendPassage();
 assert.equal(ctx.v93PassagePausedAt,100);
 assert.equal(ctx.$('memoryDive').dataset.suspended,'true');
 assert.equal(ctx.diveTimer,null);
 assert.equal(ctx.cleared,true);
 ctx.finishDive(ctx.diveSequence);
 assert.equal(ctx.opened,undefined);
 assert.equal(ctx.diveIndex,0);
});
test('returning after a long background interval resumes with the same token and flight',()=>{
 const {ctx}=sceneContext();
 ctx.beginDive(1);
 const token=ctx.diveSequence;
 ctx.document.hidden=true;ctx.v93SuspendPassage();
 ctx.performance.now=()=>5100;
 ctx.document.hidden=false;ctx.v93ResumePassage();
 assert.equal(ctx.v93PassagePausedAt,0);
 assert.equal(ctx.$('memoryDive').dataset.suspended,'false');
 assert.equal(ctx.v9State.started,5100);
 assert.equal(ctx.pending.ms,1350);
 assert.equal(ctx.v9State.token,token);
 ctx.finishDive(token);
 assert.equal(ctx.opened,'B');
});
test('cancelling a backgrounded transition clears its suspension state',()=>{
 const {ctx}=sceneContext();
 ctx.beginDive(0);
 ctx.document.hidden=true;ctx.v93SuspendPassage();
 ctx.cancelDive();
 ctx.performance.now=()=>5100;ctx.document.hidden=false;
 ctx.v93ResumePassage();
 assert.equal(ctx.v93PassagePausedAt,0);
 assert.equal(ctx.$('memoryDive').dataset.suspended,'false');
 assert.equal(ctx.diveIndex,-1);
 assert.equal(ctx.opened,undefined);
});
test('mobile marker placements are throttled without throttling WebGL renderer',()=>{
 const source=js.slice(js.indexOf('function animate('),js.indexOf('function unwrappedY('));
 assert.match(source,/t-v93LastMarkerFrame>=30/);
 assert.match(source,/webGLRender\(t\)/);
 assert.match(source,/v93LastMarkerFrame=t;updateMarkers\(\)/);
});

test('visual passage CSS pauses its running animations with the JavaScript clock',()=>{
 assert.match(html,/\.memory-dive\[data-suspended="true"\] \.memory-dive-progress span/);
 assert.match(html,/animation-play-state:paused!important/);
});
