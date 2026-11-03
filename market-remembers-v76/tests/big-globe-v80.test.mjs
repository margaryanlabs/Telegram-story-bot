import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'runtime exists');
function extract(name){
  const i=script.indexOf('function '+name+'(');
  assert.ok(i>=0,name+' missing');
  let j=script.indexOf('{',i),d=0;
  for(let k=j;k<script.length;k++){
    if(script[k]==='{')d++;
    if(script[k]==='}'&&--d===0)return script.slice(i,k+1);
  }
  throw new Error('unclosed '+name);
}
const make=(name,c)=>runInNewContext('('+extract(name)+')',c);
test('initial sphere size is BIG and is not persisted in localStorage',()=>{
  assert.match(script,/let v81SizeMode='big',v81ScaleCurrent=1,v81ScaleTarget=1/);
  assert.doesNotThrow(()=>make('v81ScaleFactor',{}));
  assert.equal(make('v81ScaleFactor',{})('big'),1);
  assert.equal(make('v81ScaleFactor',{})('small'),.73);
  assert.equal(make('v81ScaleFactor',{})('max'),1.15);
  assert.doesNotMatch(script,/localStorage\.setItem\([^)]*v81SizeMode/);
});
test('size switch cycles BIG to SMALL to MAX and back',()=>{
  const calls=[],env={v81SizeMode:'big',v81SetScale(mode){calls.push(mode);env.v81SizeMode=mode}};
  const cycle=make('v81CycleScale',env);
  cycle();cycle();cycle();
  assert.deepEqual(calls,['small','max','big']);
});
function scaleCase(reduced=false){
  const b={textContent:'',dataset:{},setAttribute(name,value){this[name]=value}};
  const notices=[],record={markers:0,atlas:0};
  const env={
    v81SizeMode:'big',v81ScaleCurrent:1,v81ScaleTarget:1,
    reduceMotion:reduced,
    $:()=>b,
    v81ScaleFactor:make('v81ScaleFactor',{}),
    updateMarkers(){record.markers++},
    updateAtlas(){record.atlas++},
    showToast:t=>notices.push(t)
  };
  const setScale=make('v81SetScale',env);
  return {env,b,notices,record,setScale};
}
test('BIG and MAX control labels are accessible and announce user scale',()=>{
  const {env,b,notices,setScale}=scaleCase();
  setScale('max');
  assert.equal(env.v81SizeMode,'max');
  assert.equal(env.v81ScaleTarget,1.15);
  assert.equal(env.v81ScaleCurrent,1,'cinematic size changes ease in, not jump');
  assert.equal(b.textContent,'✦ MAX');
  assert.equal(b.dataset.mode,'max');
  assert.match(b['aria-label'],/максимальный/);
  assert.ok(notices[0].includes('максимальный'));
  setScale('big',false);
  assert.equal(b.textContent,'◉ BIG');
  assert.equal(notices.length,1,'silent state changes do not spam announcements');
});
test('reduced-motion size switching is immediate and synchronizes star hit targets',()=>{
  const {env,record,setScale}=scaleCase(true);
  setScale('small',false);
  assert.equal(env.v81ScaleCurrent,.73);
  assert.equal(env.v81ScaleTarget,.73);
  assert.equal(record.markers,1);
  assert.equal(record.atlas,1);
});
test('invalid mode cannot modify globe or visible controls',()=>{
  const {env,b,notices,setScale}=scaleCase();
  setScale('oversize');
  assert.equal(env.v81SizeMode,'big');
  assert.equal(env.v81ScaleTarget,1);
  assert.equal(b.textContent,'');
  assert.equal(notices.length,0);
});
test('glow aura follows projected globe and changes with selected story',()=>{
  assert.match(html,/id="v81Aura" class="v81-globe-aura"|class="v81-globe-aura" id="v81Aura"/);
  assert.match(script,/aura\.style\.left=c\.x\+'px'/);
  assert.match(script,/aura\.style\.width=auraSize\+'px'/);
  assert.match(script,/\$\('scene'\)\.style\.setProperty\('--v81-tint',tint\)/);
  assert.match(script,/lensColors\[s\.type==='legend'\?'Legends':s\.type==='editorial'\?'Lessons':s\.category\]/);
});
test('aura breathing and halo respect reduced motion and graphics eco mode',()=>{
  assert.match(html,/@keyframes v81Breathe/);
  assert.match(html,/@keyframes v81HaloOrbit/);
  assert.match(html,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html,/\.v81-globe-aura\.is-eco::after\{animation:none/);
  assert.match(script,/\$\('v81Aura'\)\.classList\.toggle\('is-eco',quality==='low'\|\|autoEco\)/);
});
test('globe control is in existing world controls and does not replace zoom/immersive',()=>{
  assert.match(html,/id="globeScale"/);
  assert.match(html,/id="plusZoom"/);
  assert.match(html,/id="minusZoom"/);
  assert.match(html,/id="focusMode"/);
  assert.match(script,/\$\('globeScale'\)\.onclick=v81CycleScale/);
  assert.match(script,/function setImmersive\(value\)/);
  assert.match(script,/function v8NeedsSceneResize\(\)/);
});
