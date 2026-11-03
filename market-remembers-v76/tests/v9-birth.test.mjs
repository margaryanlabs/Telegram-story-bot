import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
function extract(name){
 const i=script.indexOf('function '+name+'(');
 assert.ok(i>=0,name+' missing');
 const start=script.indexOf('{',i);let depth=0;
 for(let j=start;j<script.length;j++){
   if(script[j]==='{')depth++;
   if(script[j]==='}'&&--depth===0)return script.slice(i,j+1);
 }
 throw new Error('Unbalanced '+name);
}
const fn=(name,ctx={})=>runInNewContext('('+extract(name)+')',ctx);
const seed=fn('v94SeedFromId');
const xorshift=initial=>{let value=initial;return ()=>{value^=value<<13;value^=value>>>17;value^=value<<5;return (value>>>0)/4294967296}};
const norm=x=>{const magnitude=Math.hypot(...x)||1;return x.map(v=>v/magnitude)};
const pos=fn('v94PositionFromId',{seeded:xorshift,v94SeedFromId:seed,twoPi:Math.PI*2,norm});
test('same private ID reconstructs exactly the same normalized 3D position',()=>{
 const a=Array.from(pos('local-m7a-12345'));
 const b=Array.from(pos('local-m7a-12345'));
 assert.deepEqual(a,b);
 assert.ok(Math.abs(Math.hypot(...a)-1)<1e-9);
});
test('separate local IDs produce distinct positions',()=>{
 assert.notDeepEqual(Array.from(pos('local-aa')),Array.from(pos('local-bb')));
 assert.notEqual(seed('local-aa'),seed('local-bb'));
});
test('source has no personal story upload or remote post in new birth code',()=>{
 const a=script.indexOf('function v94SeedFromId(');
 const b=script.indexOf('function loadChecks()',a);
 const own=script.slice(a,b);
 assert.match(own,/localStorage\.setItem\(KEY,JSON\.stringify\(next\)\)/);
 assert.doesNotMatch(own,/fetch\(|XMLHttpRequest|navigator\.sendBeacon|FormData\(.*\).*fetch/i);
 assert.match(own,/createdAt:new Date\(\)\.toISOString\(\)/);
});
test('local storage failure is a failure, never a fake success',()=>{
 const localStorage={setItem(){throw new Error('QuotaExceededError')}};
 const f=fn('v94StoreLocal',{saved:[],KEY:'private-records',localStorage});
 assert.equal(f({id:'local-failed'}),false);
});
test('successful write is bounded to the most recent forty private records',()=>{
 const writes=[];
 const localStorage={setItem:(key,value)=>writes.push({key,records:JSON.parse(value)})};
 const saved=Array.from({length:40},(_,i)=>({id:'local-'+i}));
 const ok=fn('v94StoreLocal',{saved,KEY:'private-records',localStorage});
 assert.equal(ok({id:'local-last'}),true);
 assert.equal(writes[0].key,'private-records');
 assert.equal(writes[0].records.length,40);
 assert.equal(writes[0].records[0].id,'local-1');
 assert.equal(writes[0].records.at(-1).id,'local-last');
});
function element(tag){
 const style={setProperty(key,value){this[key]=value}};
 return {tag,style,attributes:{},children:[],className:'',hidden:true,textContent:'',
  classList:{add(k){this[k]=true},remove(k){this[k]=false}},
  setAttribute(key,value){this.attributes[key]=value},
  append(fragment){this.children.push(...fragment.children)},
  replaceChildren(){this.children=[]},focus(){this.focused=true},offsetWidth:40};
}
const category={Risk:'#75d8ff'};
function particleCase({quality='high',autoEco=false,reduceMotion=false}={}){
 const field=element('div');
 const ctx={
  $:()=>field,quality,autoEco,reduceMotion,w:390,h:844,lensColors:category,
  v94SeedFromId:seed,seeded:xorshift,twoPi:Math.PI*2,
  document:{
   createDocumentFragment:()=>({children:[],append(v){this.children.push(v)}}),
   createElement:element
  }
 };
 const prepare=fn('v94PrepareBirthField',ctx);
 return {field,prepare,ctx};
}
test('cinematic birth creates 48 deterministic lightweight particles once for this star',()=>{
 const {field,prepare}=particleCase();
 prepare({id:'local-same-seed',category:'Risk'});
 const first=field.children.map(el=>[el.style['--from-x'],el.style['--from-y'],el.style['--delay']]);
 assert.equal(first.length,48);
 assert.equal(field.hidden,false);
 assert.equal(field.classList['is-forming'],true);
 assert.equal(field.style['--v94-color'],category.Risk);
 prepare({id:'local-same-seed',category:'Risk'});
 assert.deepEqual(field.children.map(el=>[el.style['--from-x'],el.style['--from-y'],el.style['--delay']]),first);
});
test('low graphics creates only 24 particles, never high-cost endless animations',()=>{
 const {field,prepare}=particleCase({quality:'low'});
 prepare({id:'local-eco',category:'Risk'});
 assert.equal(field.children.length,24);
});
test('reduced-motion makes no particles, even though the story is still saved',()=>{
 const {field,prepare}=particleCase({reduceMotion:true});
 prepare({id:'local-static',category:'Risk'});
 assert.equal(field.children.length,0);
 assert.equal(field.hidden,true);
});
test('particle field stays positioned at current projected selected 3D star',()=>{
 const field=element('div');field.hidden=false;
 const ctx={birth:{started:100},stories:[{p:[0,.5,.9]}],selected:0,
 $:()=>field,project:p=>({x:p[0]*100+180,y:p[1]*100+210})};
 fn('v94UpdateBirthField',ctx)();
 assert.equal(field.style.left,'180px');
 assert.equal(field.style.top,'260px');
});
function completeCase(){
 const overlay=element('div'),comet=element('div'),field=element('div'),button=element('button');
 overlay.hidden=true;comet.style.display='block';field.hidden=false;
 const elements={birthOverlay:overlay,birthComet:comet,v94BirthField:field,birthContinue:button};
 const ctx={
  $:id=>elements[id],stories:[{id:'local-1',local:true}],selected:0,
  birth:{started:50},resumeScene(){this.resumed=true}
 };
 return {ctx,elements,finish:fn('v94FinishBirth',ctx)};
}
test('birth completes in an accessible local-only dialog with focused primary action',()=>{
 const {ctx,elements,finish}=completeCase();
 finish();
 assert.equal(ctx.birth,null);
 assert.equal(elements.birthOverlay.hidden,false);
 assert.equal(elements.birthOverlay.attributes['aria-hidden'],'false');
 assert.equal(elements.v94BirthField.hidden,true);
 assert.equal(elements.birthContinue.focused,true);
});
test('show-my-star closes success and restores selected star with current camera',()=>{
 const {elements}=completeCase();
 elements.birthOverlay.hidden=false;
 const actions=[];
 const ctx={$:id=>elements[id],
  document:{querySelectorAll:()=>[{dataset:{open:'universe'},classList:{toggle(k,v){actions.push(v)}}}]},
  v762RestoreStar(){actions.push('restore')},resumeScene(){actions.push('resume')}
 };
 fn('v94ReturnToStar',ctx)();
 assert.equal(elements.birthOverlay.hidden,true);
 assert.equal(elements.birthOverlay.attributes['aria-hidden'],'true');
 assert.deepEqual(actions,[true,'restore','resume']);
});
test('archive alternative preserves local-only legacy UI',()=>{
 const {elements}=completeCase();
 elements.birthOverlay.hidden=false;
 let archive=0;
 fn('v94ShowOwnArchive',{$:id=>elements[id],showLegacy(){archive++}})();
 assert.equal(archive,1);
 assert.equal(elements.birthOverlay.hidden,true);
});
test('create form exits early on blocked storage without mutating memory catalogue',()=>{
 const stories=[],saved=[],notices=[];let navigations=0;
 const data={get:k=>({alias:'MY STAR',market:'CRYPTO',category:'Risk',quote:'A valid thought about risk',
   story:'Some local memory',rule:'Always respect the risk limit',capsule:''}[k])};
 const ctx={
  safeString:(v,max)=>String(v||'').slice(0,max),
  rand:()=>.246,Date,stories,saved,
  v94PositionFromId:pos,
  v94StoreLocal:()=>false,
  showToast:message=>notices.push(message),
  closeDrawer(){navigations++}
 };
 const result=fn('addStory',ctx)(data);
 assert.equal(result,false);
 assert.equal(stories.length,0);assert.equal(saved.length,0);
 assert.equal(navigations,0);
 assert.match(notices[0],/Не удалось сохранить/);
});
test('local birth has two choices and never claims public publishing',()=>{
 assert.match(html,/id="v94BirthField"/);
 assert.match(html,/id="birthContinue"/);
 assert.match(html,/id="birthViewArchive"/);
 assert.match(html,/не опубликована/);
 assert.match(html,/Очистка данных браузера может удалить/);
 assert.match(script,/\$\('birthContinue'\)\.onclick=v94ReturnToStar/);
 assert.match(script,/\$\('birthViewArchive'\)\.onclick=v94ShowOwnArchive/);
 assert.match(script,/function v762RestoreStar\(\)/);
});
test('existing WebGL and Canvas engines remain intact; quiet render and accessibility remain',()=>{
 assert.match(script,/function webGLRender\(t\)/);
 assert.match(script,/function canvasRender\(t\)/);
 assert.match(script,/function v9Tick\(t\)/);
 assert.match(script,/v94UpdateBirthField\(\);updateDivePosition/);
 assert.match(html,/@keyframes v94Gather/);
 assert.match(html,/@media\(prefers-reduced-motion:reduce\)[\s\S]*?\.v94-birth-field i/);
 assert.match(html,/aria-modal="true"/);
});
