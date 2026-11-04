import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const runtime=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(runtime,'inline WebGL runtime exists');

function extract(name){
  const start=runtime.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' not found');
  const first=runtime.indexOf('{',start);let depth=0;
  for(let i=first;i<runtime.length;i++){
    if(runtime[i]==='{')depth++;
    if(runtime[i]==='}'&&--depth===0)return runtime.slice(start,i+1);
  }
  throw new Error('Unbalanced '+name);
}
const sample=[
  {alias:'LOCAL',type:'fictional',local:true,market:'CRYPTO',category:'Risk',quote:'personal'},
  {alias:'SOURCE',type:'fictional',market:'CRYPTO',category:'Risk',quote:'A fictional cautionary story'},
  {alias:'RISK EDIT',type:'editorial',market:'STOCKS',category:'Risk',quote:'A thoughtful source story'},
  {alias:'DISCIPLINE',type:'editorial',market:'CRYPTO',category:'Discipline',quote:'A meaningful discipline story'},
  {alias:'PATIENT',type:'fictional',market:'CRYPTO',category:'Patience',quote:'A calm patient story'},
  {alias:'FOMO',type:'editorial',market:'FUTURES',category:'FOMO',quote:'Learning from an impulse'},
  {alias:'VERIFIED',type:'legend',market:'FOREX',category:'Discipline',quote:'A sourced quotation with a citation'}
];
const select=runInNewContext('('+extract('v77RelatedRecords')+')',{stories:sample});
test('related threads contain original theme, complementary lesson and editorial perspective',()=>{
  const rows=select(sample[1],sample);
  assert.equal(rows.length,3);
  assert.deepEqual(Array.from(rows,r=>r.relation),['Общая тема','Следующий урок','Редакционный взгляд']);
  assert.equal(rows[0].story.alias,'RISK EDIT');
  assert.equal(rows[1].story.alias,'DISCIPLINE');
  assert.equal(rows[2].story.alias,'FOMO');
});
test('never recommends any private/local memory',()=>{
  const records=select(sample[1],sample);
  assert.ok(records.every(row=>!row.story.local));
  assert.ok(!records.some(row=>row.story.alias==='LOCAL'));
});
test('a local source may explore editorial stories without becoming a target',()=>{
  const records=select(sample[0],sample);
  assert.ok(records.every(row=>!row.story.local));
  assert.equal(records.length,3);
});
test('returns unique stable story indices',()=>{
  const rows=select(sample[4],sample);
  assert.equal(new Set(rows.map(r=>r.index)).size,rows.length);
  assert.deepEqual(rows.map(r=>r.index),select(sample[4],sample).map(r=>r.index));
});
test('no relationships fabricated from personal recordings or empty catalogues',()=>{
  assert.deepEqual(Array.from(select(null,sample)),[]);
  assert.deepEqual(Array.from(select(sample[1],[sample[1]])),[]);
});
test('source quote never changes while navigating editorial links',()=>{
  const quote=sample[1].quote;
  select(sample[1],sample);
  assert.equal(sample[1].quote,quote);
});

function el(tag){
  return {
    tag,type:'',className:'',dataset:{},children:[],attributes:{},textContent:'',
    append(...parts){this.children.push(...parts)},
    setAttribute(name,value){this.attributes[name]=value},
    insertAdjacentElement(_place,node){this.inserted=node}
  };
}
function mount(guided){
  const nav=el('nav');
  const article={querySelector:key=>key==='.memory-navigation'?nav:null};
  const doc={createElement:el};
  const context={
    guidedJourney:guided?{step:0}:null,
    $:()=>({querySelector:key=>key==='.memory-experience'?article:null}),
    document:doc,
    v77RelatedRecords:source=>select(source,sample),
    beginDive(){throw new Error('do not navigate during render')}
  };
  const fn=runInNewContext('('+extract('v77MountThreads')+')',context);
  fn(sample[1]);
  return nav;
}
test('mount creates a semantic section with three usable story buttons',()=>{
  const nav=mount(false);
  const section=nav.inserted;
  assert.ok(section,'related section mounted');
  assert.equal(section.tag,'section');
  assert.equal(section.attributes['aria-label'],'Тематически связанные истории');
  const grid=section.children[1];
  assert.equal(grid.children.length,3);
  assert.ok(grid.children.every(btn=>btn.tag==='button'&&btn.type==='button'));
  assert.ok(grid.children.every(btn=>!btn.textContent.includes('LOCAL')));
});
test('guided paths keep their fixed order without thematic interruptions',()=>{
  assert.equal(mount(true).inserted,undefined);
});
test('readers for fictional stories and verified legends both mount thematic links',()=>{
  assert.match(runtime,/v76EnhanceReader\(true\);v78MountBreadcrumb\(s\);v93MountReaderScene\(s\);v77MountThreads\(s\)/);
  assert.match(runtime,/v76EnhanceReader\(false\);v78MountBreadcrumb\(s\);v93MountReaderScene\(s\);v77MountThreads\(s\)/);
  assert.match(html,/v77-thread-disclaimer/);
  assert.match(html,/Смысловая связь|Связи построены по темам/);
});
