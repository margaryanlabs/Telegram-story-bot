import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'inline application runtime must exist');

function extract(name){
  const start=script.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' declaration missing');
  const begin=script.indexOf('{',start);
  let depth=0;
  for(let i=begin;i<script.length;i++){
    if(script[i]==='{')depth++;
    if(script[i]==='}'){
      depth--;
      if(depth===0)return script.slice(start,i+1);
    }
  }
  throw new Error('Unbalanced function '+name);
}
function classList(){
  return {add(){},remove(){},toggle(){},contains(name){return name==='memory-detail'}};
}
function closeCase(arg,hasReturnFocus=true,mobile=true){
  const record={pulse:0,scene:0,restored:0,dockFocus:0,desktopFocus:0};
  const drawer={hidden:false,classList:classList()};
  const els={
    drawer,scrim:{hidden:false},
    dockOpen:{focus(){record.dockFocus++}},
    openSelected:{focus(){record.desktopFocus++}}
  };
  const context={
    $:id=>els[id],w:mobile?390:1200,diveIndex:-1,
    v76FocusReturn:hasReturnFocus?{isConnected:true,focus(){record.restored++}}:null,
    document:{body:{classList:{remove(){}}},querySelectorAll:()=>[]},
    resumeScene(){record.scene++},
    v762RestoreStar(){record.pulse++}
  };
  const close=runInNewContext('('+extract('closeDrawer')+')',context);
  close(arg);
  assert.equal(drawer.hidden,true);
  assert.equal(els.scrim.hidden,true);
  return record;
}

test('closing a reader returns to the same star and restores focus',()=>{
  const r=closeCase(false);
  assert.equal(r.pulse,1);
  assert.equal(r.scene,1);
  assert.equal(r.restored,1);
});
test('navigating to another memory never fires a spurious return pulse',()=>{
  const r=closeCase(true);
  assert.equal(r.pulse,0);
  assert.equal(r.scene,1);
});
test('DOM click event is not mistaken for skip-return boolean',()=>{
  const r=closeCase({type:'click'});
  assert.equal(r.pulse,1);
});
test('when an archive trigger is destroyed the mobile dock gets focus',()=>{
  const r=closeCase(false,false,true);
  assert.equal(r.pulse,1);
  assert.equal(r.dockFocus,1);
});
test('desktop fallback focuses the current selected-memory action',()=>{
  const r=closeCase(false,false,false);
  assert.equal(r.desktopFocus,1);
});

function restoreCase(reduced){
  const record={timer:0,markers:0,point:0};
  const pulse={hidden:true,style:{},classList:classList(),offsetWidth:100};
  const elements={
    returnPulse:pulse,selectedCard:{classList:classList()},
    signalDock:{classList:classList()},
    autoRotate:{setAttribute(){},textContent:''}
  };
  const ctx={
    $:id=>elements[id],
    stories:[{p:[0,0,1]}],selected:0,
    reduceMotion:reduced,
    focusLabelActive:false,inertiaX:1,inertiaY:1,spinning:true,flightFinish:12,
    cameraY:0,cameraX:0,targetY:0,targetX:0,targetZoom:2,zoom:2,w:390,h:700,
    v762ReturnTimer:null,
    v762CancelReturn(){},
    unwrappedY:x=>x,clamp:(x,a,b)=>Math.min(b,Math.max(a,x)),
    project:()=>{record.point++;return {x:180,y:300,z:.75}},
    updateMarkers(){record.markers++},
    setTimeout(_fn,ms){record.timer=ms;return 1}
  };
  const restore=runInNewContext('('+extract('v762RestoreStar')+')',ctx);
  restore();
  return {record,pulse,ctx};
}
test('reduced motion immediately restores selected star without pulse',()=>{
  const {record,pulse,ctx}=restoreCase(true);
  assert.equal(record.markers,1);
  assert.equal(record.timer,0);
  assert.equal(record.point,0);
  assert.equal(pulse.hidden,true);
  assert.equal(ctx.focusLabelActive,true);
  assert.equal(ctx.zoom,1.13);
});
test('normal return anchors one halo to the projected selected star',()=>{
  const {record,pulse,ctx}=restoreCase(false);
  assert.equal(record.markers,1);
  assert.equal(record.timer,1150);
  assert.equal(pulse.hidden,false);
  assert.equal(pulse.style.left,'180px');
  assert.equal(pulse.style.top,'300px');
  assert.equal(ctx.focusLabelActive,true);
});
