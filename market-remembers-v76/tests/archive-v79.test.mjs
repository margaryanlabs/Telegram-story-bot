import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const runtime=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(runtime,'original inline runtime missing');
function extract(name){
  const start=runtime.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' missing');
  const first=runtime.indexOf('{',start);
  let depth=0;
  for(let i=first;i<runtime.length;i++){
    if(runtime[i]==='{')depth++;
    if(runtime[i]==='}'&&--depth===0)return runtime.slice(start,i+1);
  }
  throw new Error('Unbalanced '+name);
}
function make(name,context){return runInNewContext('('+extract(name)+')',context)}
const catalogue=[
  {id:1,type:'fictional',alias:'NORTHSTAR',market:'CRYPTO',category:'Patience',
   quote:'A patient trader',story:'Long journey',rule:'Only after signal'},
  {id:2,type:'editorial',alias:'MIRA',market:'STOCKS',category:'Risk',
   quote:'Risk is a decision',story:'Costs of loss',rule:'Stop early'},
  {id:3,type:'legend',alias:'BENJAMIN',market:'STOCKS',category:'Discipline',
   quote:'A quotation with a source',story:'Factual story',rule:'Journal',
   legend:{source:'Verified publication',role:'Writer'}},
  {id:'my-local',type:'fictional',local:true,alias:'PRIVATE',market:'CRYPTO',category:'Risk',
   quote:'My private experience',story:'Not public',rule:'Risk limit'}
];
const saved=new Set([1,3]);
const select=make('v79SelectArchive',{});
const pick=(filter,query='')=>Array.from(select(catalogue,filter,query,r=>saved.has(r.id)));

test('all collection and category filters operate on the live catalogue',()=>{
  assert.equal(pick('All').length,4);
  assert.deepEqual(pick('Risk').map(x=>x.alias),['MIRA','PRIVATE']);
  assert.deepEqual(pick('Legends').map(x=>x.alias),['BENJAMIN']);
  assert.deepEqual(pick('Lessons').map(x=>x.alias),['MIRA']);
});
test('private and saved collections are distinct',()=>{
  assert.deepEqual(pick('Mine').map(x=>x.alias),['PRIVATE']);
  assert.deepEqual(pick('Saved').map(x=>x.alias),['NORTHSTAR','BENJAMIN']);
});
test('search finds quotes, rules, source and roles, case-insensitively',()=>{
  assert.deepEqual(pick('All','signal').map(x=>x.alias),['NORTHSTAR']);
  assert.deepEqual(pick('All','Verified publication').map(x=>x.alias),['BENJAMIN']);
  assert.deepEqual(pick('All','writer').map(x=>x.alias),['BENJAMIN']);
  assert.deepEqual(pick('Risk','PRIVATE').map(x=>x.alias),['PRIVATE']);
  assert.equal(pick('Legends','unrelated').length,0);
});
test('search trims whitespace without changing the underlying user data',()=>{
  const phrase=catalogue[0].quote;
  assert.deepEqual(pick('All','  A PATIENT ' ).map(x=>x.alias),['NORTHSTAR']);
  assert.equal(catalogue[0].quote,phrase);
});
test('switching a filter does not remount drawer or reset input focus/scroll',()=>{
  const state={activeFilter:'All',redraws:0,flags:0,drawerScroll:390,focus:'search'};
  const fn=make('v79ChangeArchiveFilter',{
    v79ArchiveFilterNames:{All:'all',Mine:'mine'},
    get activeFilter(){return state.activeFilter},set activeFilter(v){state.activeFilter=v},
    v79UpdateArchiveFilters(){state.flags++},drawArchive(){state.redraws++}
  });
  fn('Mine');
  assert.equal(state.activeFilter,'Mine');
  assert.equal(state.redraws,1);
  assert.equal(state.flags,1);
  assert.equal(state.drawerScroll,390);
  assert.equal(state.focus,'search');
  fn('Unsupported');
  assert.equal(state.redraws,1);
});
test('filter switches update pressed state on each control',()=>{
  const buttons=[
    {dataset:{archiveFilter:'All'},classList:{toggle(k,v){this.on=v}},setAttribute(k,v){this[k]=v}},
    {dataset:{archiveFilter:'Mine'},classList:{toggle(k,v){this.on=v}},setAttribute(k,v){this[k]=v}}
  ];
  make('v79UpdateArchiveFilters',{
    activeFilter:'Mine',$:()=>({querySelectorAll:()=>buttons})
  })();
  assert.equal(buttons[0].classList.on,false);
  assert.equal(buttons[0]['aria-pressed'],'false');
  assert.equal(buttons[1].classList.on,true);
  assert.equal(buttons[1]['aria-pressed'],'true');
});
function element(tag='div'){
  return {
    tag,style:{},dataset:{},children:[],textContent:'',className:'',
    append(...x){this.children.push(...x)},
    replaceChildren(){this.children=[]},
    setAttribute(k,v){this[k]=v},
    focus(){this.didFocus=true}
  };
}
function archiveRender(filter='All',query='',preset=catalogue){
  const grid=element('grid'),input=element('input'),clear=element('button'),status=element('status');
  input.value=query;clear.hidden=true;const clicks=[];
  const els={archiveGrid:grid,archiveSearch:input,archiveClear:clear,archiveResultStatus:status};
  const env={
    $:id=>els[id],document:{createElement:element,createDocumentFragment:()=>element('fragment')},
    stories:preset,activeFilter:filter,archiveQuery:'',v79SelectArchive:select,
    isSavedLesson:row=>saved.has(row.id),beginDive:i=>clicks.push(i),
    v79ChangeArchiveFilter(next){this.filter=next}
  };
  make('drawArchive',env)();
  return {grid,input,clear,status,clicks,env};
}
test('archive renderer reports exact search results without re-creating the full drawer',()=>{
  const r=archiveRender('Risk','stop');
  assert.equal(r.status.textContent,'1 ИЗ 4 ЗАПИСЕЙ');
  assert.equal(r.grid.children[0].children.length,1);
  assert.equal(r.clear.hidden,false);
  assert.equal(r.env.archiveQuery,'stop');
});
test('archive records preserve correct source/provenance labels and destination',()=>{
  const r=archiveRender('All');
  const cards=r.grid.children[0].children;
  assert.equal(cards.length,4);
  const sourced=cards[2];
  const foot=sourced.children.at(-1);
  assert.equal(foot.children[0].textContent,'VERIFIED SOURCE · QUOTATION');
  assert.equal(cards[3].children.at(-1).children[0].textContent,'PRIVATE · ONLY THIS DEVICE');
  assert.equal(cards[1].children.at(-1).children[0].textContent,'EDITORIAL · FICTION');
  sourced.onclick();
  assert.deepEqual(r.clicks,[2]);
});
test('empty results offer a safe clear-and-reset action',()=>{
  const r=archiveRender('Saved','not found here');
  assert.equal(r.status.textContent,'0 ИЗ 4 ЗАПИСЕЙ');
  const empty=r.grid.children[0].children[0];
  assert.equal(empty.className,'v79-archive-empty');
  const button=empty.children.at(-1);
  assert.equal(typeof button.onclick,'function');
  button.onclick();
  assert.equal(r.input.value,'');
  assert.equal(r.env.archiveQuery,'');
  assert.equal(r.input.didFocus,true);
});
test('archive header counts catalogue records and includes search and privacy notice',()=>{
  const doc={
    archiveTotal:element('strong'),archiveVerified:element('strong'),
    archivePrivate:element('strong'),archiveFilters:element('nav'),
    archiveSearch:element('input'),archiveClear:element('button'),
    drawer:{classList:{add(){}}}
  };
  let markup='';
  const env={
    stories:catalogue,archiveQuery:'',lensFilters:['Risk','Discipline','FOMO','Patience','Legends','Lessons'],
    v79ArchiveFilterNames:{All:'ВСЕ',Mine:'МОИ',Saved:'ЗАКЛАДКИ',Risk:'РИСК',
      Discipline:'ДИСЦИПЛИНА',FOMO:'FOMO',Patience:'ТЕРПЕНИЕ',Legends:'ЛЕГЕНДЫ',Lessons:'РЕДАКЦИЯ'},
    $:id=>doc[id],document:{createElement:element},
    setDrawer(tag,content){markup=content},
    v79UpdateArchiveFilters(){},drawArchive(){}
  };
  make('showArchive',env)();
  assert.equal(doc.archiveTotal.textContent,'4');
  assert.equal(doc.archiveVerified.textContent,'1');
  assert.equal(doc.archivePrivate.textContent,'1');
  assert.match(markup,/id="archiveSearch"/);
  assert.match(markup,/не публикуются/);
  assert.equal(doc.archiveFilters.children.length,9);
});
