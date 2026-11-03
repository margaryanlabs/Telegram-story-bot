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
function layout(width,height,heroBottom,dockTop,immersive=false){
  const ctx={
    w:width,h:height,immersive,v763MobileStage:null,
    stage:{getBoundingClientRect:()=>({top:0})},
    $:id=>id==='hero'?{getBoundingClientRect:()=>({bottom:heroBottom})}
                        :{getBoundingClientRect:()=>({top:dockTop})},
    clamp:(x,a,b)=>Math.min(b,Math.max(a,x))
  };
  const measure=runInNewContext('('+extract('v763MeasureStage')+')',ctx);
  const center=runInNewContext('('+extract('targetCenter')+')',ctx);
  measure();return {position:center(),stage:ctx.v763MobileStage};
}
test('portrait phone sphere fits between hero and story dock',()=>{
  for(const [w,h,hero,dock] of [[390,844,280,681],[390,620,238,484],[320,568,238,430],[768,1024,280,864]]){
    const {position:p,stage}=layout(w,h,hero,dock);
    assert.ok(p.radius>45,'sphere should remain visible');
    assert.ok(p.y-p.radius>=stage.top-1, 'sphere touches hero');
    assert.ok(p.y+p.radius<=stage.bottom+1, 'sphere touches dock');
    assert.ok(p.x-p.radius>=0 && p.x+p.radius<=w,'sphere clips horizontally');
  }
});
test('landscape phone sphere occupies right-hand theatre space',()=>{
  const {position:p,stage}=layout(760,420,210,275);
  assert.equal(stage.mode,'landscape');
  assert.ok(p.x-p.radius>760*.42,'landscape sphere overlaps story/controls at left');
  assert.ok(p.y-p.radius>0&&p.y+p.radius<420,'landscape sphere out of screen');
});
test('desktop retains original camera projection',()=>{
  const {position:p,stage}=layout(1280,720,200,620);
  assert.equal(stage,null);
  assert.equal(p.x,1280*.672);
  assert.equal(p.y,720*.52);
  assert.equal(p.radius,720*.39);
});
test('focus mode remains full immersive mobile sphere',()=>{
  const {position:p,stage}=layout(390,844,280,681,true);
  assert.equal(stage,null);
  assert.equal(p.x,195);
  assert.equal(p.y,844*.54);
  assert.equal(p.radius,390*.49);
});
test('mobile layout is measured during resize and immersion toggle',()=>{
  assert.match(script,/fallbackCanvas\.height=resH;v8ViewportPending=false;v763MeasureStage\(\)/);
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
