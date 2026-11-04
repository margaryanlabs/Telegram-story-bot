import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'inline app runtime required');

function extract(name){
  const start=script.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' not found');
  const first=script.indexOf('{',start);let depth=0;
  for(let i=first;i<script.length;i++){
    if(script[i]==='{')depth++;
    if(script[i]==='}'&&--depth===0)return script.slice(start,i+1);
  }
  throw new Error(name+' is unbalanced');
}
function layout(width,height,heroBottom,dockTop,immersive=false,scale=1){
  const ctx={
    w:width,h:height,immersive,v763MobileStage:null,v81ScaleCurrent:scale,
    stage:{getBoundingClientRect:()=>({top:0})},
    $:id=>id==='hero'?{getBoundingClientRect:()=>({bottom:heroBottom})}
                        :{getBoundingClientRect:()=>({top:dockTop})},
    clamp:(x,a,b)=>Math.min(b,Math.max(a,x))
  };
  ctx.v9PortraitFrame=runInNewContext('('+extract('v9PortraitFrame')+')');
  const measure=runInNewContext('('+extract('v763MeasureStage')+')',ctx);
  const center=runInNewContext('('+extract('targetCenter')+')',ctx);
  measure();return {position:center(),stage:ctx.v763MobileStage};
}
test('portrait V11.1 sphere stays large but reveals more of the lower silhouette',()=>{
  for(const [w,h,hero,dock] of [[390,844,280,681],[390,620,238,484],[320,568,238,430],[768,1024,280,864]]){
    const {position:p,stage}=layout(w,h,hero,dock);
    assert.equal(stage.mode,'portrait');
    assert.ok(p.radius>=w*(h<650?.32:.34)-1,'refined sphere became too small');
    assert.ok(p.x-p.radius>=0&&p.x+p.radius<=w,'sphere clips horizontally in BIG mode');
    assert.ok(p.y-p.radius>=0&&p.y+p.radius<=h,'sphere clips vertically in BIG mode');
    assert.ok(p.y>hero*.85&&p.y<dock+25,'sphere lacks visual center between UI regions');
  }
});
test('short phone sphere remains readable but does not become a giant dark disk',()=>{
  const {position:p,stage}=layout(390,620,238,484);
  assert.ok(p.radius>120&&p.radius<134);
  assert.ok(p.radius<(stage.bottom-stage.top)*.7,'sphere swallows short-screen editorial context');
});
test('landscape mobile globe fills the right-hand theatre, with no clipping',()=>{
  const {position:p,stage}=layout(760,420,210,275);
  assert.equal(stage.mode,'landscape');
  assert.ok(p.radius>=150&&p.radius<165);
  assert.ok(p.x-p.radius>760*.42,'landscape globe overlaps story/controls at left');
  assert.ok(p.y-p.radius>0&&p.y+p.radius<420,'landscape globe clips vertically');
});
test('desktop defaults to a larger sphere and stays in view even on square displays',()=>{
  const {position:p,stage}=layout(1280,720,200,620);
  assert.equal(stage,null);
  assert.equal(p.x,1280*.672);
  assert.equal(p.y,720*.52);
  assert.equal(p.radius,720*.39);
  const squarish=layout(900,900,200,700).position;
  assert.ok(squarish.x+squarish.radius<=900-10);
});
test('FOCUS is larger than BIG and uses same three size states',()=>{
  const regular=layout(390,844,280,681);
  const {position:p,stage}=layout(390,844,280,681,true);
  assert.equal(stage,null);
  assert.equal(p.x,195);
  assert.equal(p.y,844*.54);
  assert.equal(p.radius,390*.49);
  assert.ok(p.radius>regular.position.radius);
  assert.ok(layout(390,844,280,681,true,1.15).position.radius>p.radius);
});
test('mobile layout is measured during resize and immersion toggle',()=>{
  assert.match(script,/fallbackCanvas\.height=resH;v8ViewportPending=false;\$\('v81Aura'\)\.classList\.toggle\('is-eco'/);
  assert.match(script,/v763MeasureStage\(\);if\(ctx\)ctx\.setTransform/);
  assert.match(script,/else\{targetZoom=1;setSpin\(!reduceMotion\)\}\s*v763MeasureStage\(\);updateMarkers/);
});
test('original story reader, accessibility and data boundaries preserved',()=>{
  assert.match(script,/function v762RestoreStar\(\)/);
  assert.match(script,/function v76EnhanceReader\(legend\)/);
  assert.match(script,/veto-market-remembers-demo-v4/);
  assert.match(html,/id="fallback"/);
  assert.match(html,/id="gl"/);
  assert.match(html,/@media\(prefers-reduced-motion:reduce\)/);
});


test('V9.4 portrait frame uses unobstructed mobile space when it is genuinely available',()=>{
  const {position:p,stage}=layout(390,844,360,680);
  assert.equal(stage.mode,'portrait');
  assert.equal(stage.fitted,true);
  assert.ok(p.y>844*.575,'should center inside actual hero-dock band');
  assert.ok(p.y-p.radius>=stage.top,'orb overlaps heading despite room');
  assert.ok(p.y+p.radius<=stage.bottom,'orb overlaps dock despite room');
  assert.ok(p.radius>=135,'sphere shrunk too far on standard phone');
});
test('V9.4 compact viewport retains the ECLIPSE sphere rather than collapsing to a tiny dot',()=>{
  const {position:p,stage}=layout(320,568,238,430);
  assert.equal(stage.fitted,false);
  assert.ok(p.radius>=100);
  assert.ok(Math.abs(p.y-568*.56)<.01);
});
test('V9.4 star labels are suppressed near hero while the selected dock remains usable',()=>{
  const code=extract('updateMarkers');
  assert.match(code,/p\.y-band\.top>=84/);
  assert.match(code,/band\.bottom-p\.y>=16/);
  assert.match(code,/focusLabelActive&&visible\.has\(selected\)&&labelRoom/);
});
test('V9.4 tracks RAF handles to resume foreground rendering after browser suspension',()=>{
  const schedule=extract('queueFrame');
  assert.match(schedule,/animationFrameHandle=window\.requestAnimationFrame\(animate\)/);
  assert.match(extract('animate'),/frameScheduled=false;animationFrameHandle=null/);
  assert.match(script,/window\.cancelAnimationFrame\(animationFrameHandle\)/);
  assert.match(script,/animationFrameHandle=null;frameScheduled=false;/);
});
