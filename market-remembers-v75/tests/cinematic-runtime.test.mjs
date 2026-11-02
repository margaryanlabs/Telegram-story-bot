import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const original=readFileSync(new URL('../../market-remembers-preview/human-legacy-v74.html',import.meta.url),'utf8');
const js=page.split('<script>')[1]?.split('</script>')[0];
const css=page.split('<style>')[1]?.split('</style>')[0];

function between(a,b){
  const start=js.indexOf(a),end=js.indexOf(b,start);
  assert.ok(start>=0&&end>start,'functions must exist: '+a);
  return js.slice(start,end);
}

test('V7.5.3 preserves VETO V7.4 human-legacy and compiles',()=>{
  assert.ok(original.includes('V.07.4 / HUMAN LEGACY'));
  assert.ok(page.includes('V.07.5.3 / CINEMATIC CORE'));
  assert.doesNotThrow(()=>new Function(js));
  assert.equal(css.split('{').length,css.split('}').length);
  for(const phrase of ['function initGL','function init2D','function canvasRender','function showLegacy',
    'const LEGEND_ENTRIES=','const MEMORY_PATHS=','function renderJourneyReader',
    "const KEY='veto-market-remembers-demo-v4'",'LOCAL DEMO / NO REAL MEMBERS']){
    assert.ok(js.includes(phrase)||page.includes(phrase),phrase);
  }
});

test('scene pauses frame scheduling during reading and resumes afterwards',()=>{
  const source=between('  function sceneIsCovered(){','  function sampleGraphics(');
  const ui={drawer:{hidden:true},birthOverlay:{hidden:true}};
  const frames=[];let markerRefreshes=0;
  const engine=Function('$','document','window','updateMarkers',
    'let frameScheduled=false,lastTime=30;function animate(){};'+source+
    'return {queueFrame,resumeScene,reset:()=>{frameScheduled=false},time:()=>lastTime};'
  )(id=>ui[id],{hidden:false},{requestAnimationFrame:fn=>frames.push(fn)},()=>{markerRefreshes++});
  engine.queueFrame();engine.queueFrame();
  assert.equal(frames.length,1,'one pending frame');
  engine.reset();
  ui.drawer.hidden=false;
  engine.queueFrame();
  assert.equal(frames.length,1,'reader pauses background canvas');
  ui.drawer.hidden=true;
  ui.birthOverlay.hidden=false;
  engine.queueFrame();
  assert.equal(frames.length,1,'birth overlay pauses background canvas');
  ui.birthOverlay.hidden=true;
  engine.resumeScene();
  assert.equal(frames.length,2,'closing the reader resumes canvas');
  assert.equal(engine.time(),0,'clock reinitializes without a jump');
  assert.equal(markerRefreshes,1,'chosen star label and markers refresh');
});

test('viewport changes are batched and measured from the actual scene',()=>{
  const source=between('  function sceneSize(){','  function resize(){');
  const viewport={width:360,height:720},frames=[];
  const app=Function('stage','window',
    "let w=360,h=720,dpr=1.35,quality='auto',autoEco=false;let count=0,redraws=0;"+
    "function resize(){const x=sceneSize();w=x.width;h=x.height;count++}"+
    "function queueFrame(){redraws++}"+source+
    "return {scheduleResize,resizeCount:()=>count,redrawCount:()=>redraws,sceneSize};"
  )({getBoundingClientRect:()=>viewport},
     {innerWidth:1000,innerHeight:1000,devicePixelRatio:2,
       requestAnimationFrame:fn=>frames.push(fn)});
  app.scheduleResize();app.scheduleResize();
  assert.equal(frames.length,1,'rapid address-bar events are coalesced');
  frames.shift()();
  assert.equal(app.resizeCount(),0,'no redundant mesh rebuilding');
  viewport.height=650;
  app.scheduleResize();frames.shift()();
  assert.equal(app.resizeCount(),1,'new actual CSS height causes resize');
  assert.equal(app.redrawCount(),1,'a resize requests redraw');
  assert.equal(app.sceneSize().height,650,'stage coordinates align with 100dvh');
});

test('cancelled touches and non-primary mouse buttons do not select stars',()=>{
  const source=between('  function pointerUp(e,cancelled=false){','  function boot(){');
  const pointers=new Map(),opened=[];
  const fn=Function('pointers','stories','project','lensMatches','focus',
    'let dragging=true,pinchDistance=0,lastX=0,lastY=0,moved=0,downX=100,downY=100;'+
    source+'return pointerUp;'
  )(pointers,[{p:[0,0,1]}],()=>({x:100,y:100,z:1}),()=>true,
    (i,open)=>opened.push([i,open]));
  pointers.set(1,{x:100,y:100});
  fn({pointerId:1,clientX:100,clientY:100},true);
  assert.equal(opened.length,0,'browser touch-cancel must not open a memory');
  pointers.set(2,{x:100,y:100});
  fn({pointerId:2,clientX:100,clientY:100},false);
  assert.deepEqual(opened,[[0,true]],'normal tap can open a memory');
  assert.ok(js.includes("if(e.pointerType==='mouse'&&e.button!==0)return;"),'reject secondary mouse buttons');
  assert.ok(js.includes("pointerUp(e,true)"),'pointercancel passes cancellation flag');
  assert.ok(js.includes("lostpointercapture"),'capture loss is handled');
});
