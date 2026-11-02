import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=page.split('<script>')[1]?.split('</script>')[0];
const css=page.split('<style>')[1]?.split('</style>')[0];
const markerStart=script.indexOf('  function updateMarkers(){');
const markerEnd=script.indexOf('  function queueFrame(){',markerStart);
assert.ok(markerStart>0&&markerEnd>markerStart,'isolated star-marker update should exist');
const markerSource=script.slice(markerStart,markerEnd);

function scenario({mobile=false,drawer=false,lens=false,focus=true,cluster=false}={}){
  const w=mobile?360:1100,h=mobile?760:780;
  const stories=Array.from({length:30},(_,i)=>({p:{index:i},type:i%6===0?'legend':'editorial',category:'Risk'}));
  const markerEls=stories.map(()=>({
    style:{},tabIndex:0,attrs:{},
    getAttribute(k){return this.attrs[k]},
    setAttribute(k,v){this.attrs[k]=v},
    classList:{toggle(name,value){if(name==='is-selected')this.selected=value}}
  }));
  const nodes={
    starFocusLabel:{hidden:true,style:{}},
    drawer:{hidden:!drawer},lensPanel:{hidden:!lens},
    memoryDive:{hidden:true},birthOverlay:{hidden:true}
  };
  const selected=1;
  const project=p=>cluster
    ?{x:160+(p.index%3)*5,y:300+(p.index%2)*5,z:.9}
    :{x:45+(p.index%6)*55,y:200+Math.floor(p.index/6)*65,z:.8};
  const args={stories,project,lensMatches:()=>true,markerEls,w,h,selected,focusLabelActive:focus,
    $:id=>nodes[id],clamp:(n,lo,hi)=>Math.max(lo,Math.min(hi,n))};
  const update=Function(...Object.keys(args),markerSource+'return updateMarkers')(...Object.values(args));
  update();
  return {markerEls,nodes,selected};
}
test('Stellar UX retains v7.4 WebGL and Legacy while the full inline JS parses',()=>{
  assert.doesNotThrow(()=>new Function(script));
  assert.ok(page.includes('function initGL'));
  assert.ok(page.includes('function canvasRender'));
  assert.ok(page.includes('function showLegacy'));
  assert.ok(page.includes("const KEY='veto-market-remembers-demo-v4'"));
  assert.ok(page.includes('LOCAL DEMO / NO REAL MEMBERS'));
  assert.ok(page.includes('id="starFocusLabel"'));
  assert.ok(page.includes('id="starFocusAlias"'));
  assert.ok(page.includes('id="starFocusType"'));
  assert.equal(css.split('{').length,css.split('}').length);
});
test('selected star wins crowded mobile marker positions, hidden stars are not keyboard focusable',()=>{
  const {markerEls,selected,nodes}=scenario({mobile:true,cluster:true});
  const visible=markerEls.filter(m=>m.tabIndex===0);
  assert.equal(visible.length,1,'crowded stars collapse into one marker');
  assert.equal(markerEls[selected].tabIndex,0,'selected marker wins');
  assert.equal(markerEls[selected].selected,true);
  assert.equal(nodes.starFocusLabel.hidden,false,'focus label displayed');
  for(const [i,m] of markerEls.entries()){
    if(i!==selected){assert.equal(m.tabIndex,-1);assert.equal(m.attrs['aria-hidden'],'true');}
  }
});
test('dense globe culls to eight touch markers and fifteen desktop markers',()=>{
  const mobile=scenario({mobile:true});
  const desktop=scenario({mobile:false});
  assert.ok(mobile.markerEls.filter(m=>m.tabIndex===0).length<=8);
  assert.ok(desktop.markerEls.filter(m=>m.tabIndex===0).length<=15);
  assert.equal(mobile.markerEls[1].tabIndex,0);
  assert.equal(desktop.markerEls[1].tabIndex,0);
});
test('focus cue is hidden during reading and when choosing thematic filters',()=>{
  assert.equal(scenario({drawer:true}).nodes.starFocusLabel.hidden,true);
  assert.equal(scenario({lens:true}).nodes.starFocusLabel.hidden,true);
  assert.equal(scenario({focus:false}).nodes.starFocusLabel.hidden,true);
  assert.equal(scenario().nodes.starFocusLabel.hidden,false);
});
test('camera smoothing is frame-rate independent and reduced-motion-safe',()=>{
  assert.ok(script.includes('reduceMotion?1:1-Math.exp(-dt/245)'));
  const full=1-Math.exp(-16.667/245);
  const half=1-Math.exp(-8.3335/245);
  assert.ok(Math.abs(full-(1-(1-half)*(1-half)))<1e-8);
});
