import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'single inline runtime required');
function extract(name){
  const start=script.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' not found');
  const open=script.indexOf('{',start);let count=0;
  for(let i=open;i<script.length;i++){
    if(script[i]==='{')count++;
    if(script[i]==='}'&&--count===0)return script.slice(start,i+1);
  }
  throw new Error('Unbalanced '+name);
}
const stories=[
  {alias:'ORIGIN',market:'CRYPTO',category:'Risk',type:'fictional',quote:'A story'},
  {alias:'EDITORIAL',market:'STOCKS',category:'Risk',type:'editorial',quote:'A thought'},
  {alias:'SECRET ALIAS',market:'CRYPTO',category:'Patience',type:'fictional',local:true},
  {alias:'GRAHAM',market:'STOCKS',category:'Discipline',type:'legend'}
];
const ctx=(overrides={})=>({
  stories,selected:0,guidedJourney:null,v78ThreadContext:null,
  v78ThreadLabel:obj=>obj.local?'МОЯ ЛОКАЛЬНАЯ ЗВЕЗДА':(obj.type==='legend'?'★ ':'@')+obj.alias,
  beginDive(){},...overrides
});
const make=(name,env)=>runInNewContext('('+extract(name)+')',env);

test('following a valid editorial thread records only an in-memory hop',()=>{
  const clicks=[];
  const env=ctx({beginDive:i=>clicks.push(i)});
  make('v78FollowThread',env)(1,'Общая тема');
  assert.equal(env.v78ThreadContext.from,0);
  assert.equal(env.v78ThreadContext.to,1);
  assert.equal(env.v78ThreadContext.relation,'Общая тема');
  assert.deepEqual(clicks,[1]);
});
test('private/local target and source record cannot be a public recommendation target',()=>{
  const clicks=[];const env=ctx({beginDive:i=>clicks.push(i)});
  make('v78FollowThread',env)(2,'Ошибка');
  assert.equal(env.v78ThreadContext,null);
  assert.deepEqual(clicks,[]);
});
test('guided four-part paths ignore editorial thread navigation',()=>{
  const env=ctx({guidedJourney:{step:0},beginDive(){throw Error('unexpected')}}); 
  make('v78FollowThread',env)(1,'Общая тема');
  assert.equal(env.v78ThreadContext,null);
});
test('self-link and unrecognized story type are not navigable',()=>{
  const env=ctx({beginDive(){throw Error('invalid hop')}});
  make('v78FollowThread',env)(0,'Self');
  make('v78FollowThread',env)(100,'Out of bounds');
  assert.equal(env.v78ThreadContext,null);
});
test('thread labels distinguish verified legends, local privacy and editorial examples',()=>{
  const label=make('v78ThreadLabel',ctx());
  assert.equal(label(stories[0]),'@ORIGIN');
  assert.equal(label(stories[3]),'★ GRAHAM');
  assert.equal(label(stories[2]),'МОЯ ЛОКАЛЬНАЯ ЗВЕЗДА');
  assert.ok(!label(stories[2]).includes('SECRET ALIAS'));
});
test('dive HUD shows origin and destination with relationship; hides on ordinary moves',()=>{
  const routePanel={hidden:true};
  const elems={
    v78DiveRoute:routePanel,v78RouteFrom:{textContent:''},
    v78RouteTo:{textContent:''},v78RouteRelation:{textContent:''},
    travelTrail:{classList:{toggle(_key,v){this.active=v}}}
  };
  const env=ctx({v78ThreadContext:{from:0,to:1,relation:'Общая тема'},
    $:id=>elems[id]});
  const update=make('v78UpdateDiveRoute',env);
  update(1);
  assert.equal(routePanel.hidden,false);
  assert.equal(elems.v78RouteFrom.textContent,'@ORIGIN');
  assert.equal(elems.v78RouteTo.textContent,'@EDITORIAL');
  assert.ok(elems.v78RouteRelation.textContent.includes('ОБЩАЯ ТЕМА'));
  assert.equal(elems.travelTrail.classList.active,true);
  update(3);
  assert.equal(routePanel.hidden,true);
  assert.equal(elems.travelTrail.classList.active,false);
});
test('back-to-origin clears thread and reopens the previous story',()=>{
  const clicks=[];let removed=false;
  const env=ctx({v78ThreadContext:{from:0,to:1,relation:'Общая тема'},
    beginDive:i=>clicks.push(i),
    $:()=>({classList:{remove(){removed=true}}})});
  make('v78BackToOrigin',env)();
  assert.equal(env.v78ThreadContext,null);
  assert.deepEqual(clicks,[0]);
  assert.equal(removed,true);
});
function el(tag){
  return {tag,className:'',type:'',attributes:{},children:[],textContent:'',
    append(...nodes){this.children.push(...nodes)},
    setAttribute(k,v){this.attributes[k]=v},
    insertAdjacentElement(_where,node){this.inserted=node}
  };
}
test('reader breadcrumb is accessible and retains a functional return button',()=>{
  const head=el('div');
  const article={querySelector:k=>k==='.memory-topline'?head:null};
  const env=ctx({
    v78ThreadContext:{from:0,to:1,relation:'Общая тема'},
    document:{createElement:el},
    $:()=>({querySelector:k=>k==='.memory-experience'?article:null}),
    v78BackToOrigin(){},
  });
  make('v78MountBreadcrumb',env)(stories[1]);
  const nav=head.inserted;
  assert.equal(nav.tag,'nav');
  assert.equal(nav.attributes['aria-label'],'Переход между тематическими историями');
  const back=nav.children.find(x=>x.tag==='button');
  assert.ok(back&&back.type==='button');
  assert.equal(typeof back.onclick,'function');
  const chain=nav.children.find(x=>x.className==='v78-breadcrumb-chain');
  assert.equal(chain.children[0].textContent,'@ORIGIN');
  assert.equal(chain.children[2].textContent,'@EDITORIAL');
});
test('guided reading and unrelated stories never show a stale breadcrumb',()=>{
  let calls=0;const head=el('div');
  const article={querySelector:()=>head};
  const base={
    v78ThreadContext:{from:0,to:1,relation:'Общая тема'},
    document:{createElement(){calls++;return el('div')}},
    $:()=>({querySelector:()=>article})
  };
  make('v78MountBreadcrumb',ctx({...base,guidedJourney:{step:0}}))(stories[1]);
  make('v78MountBreadcrumb',ctx(base))(stories[3]);
  assert.equal(calls,0);
});
test('thread UI is integrated into both verified and fictional readers and old scene remains',()=>{
  assert.match(script,/v78MountBreadcrumb\(s\);v77MountThreads\(s\)/);
  assert.match(script,/v78UpdateDiveRoute\(index\)/);
  assert.match(script,/v78ThreadContext=null/);
  assert.match(html,/id="travelTrail"/);
  assert.match(html,/id="gl"/);
  assert.match(html,/id="fallback"/);
  assert.match(html,/veto-market-remembers-demo-v4/);
});

function openDrawerTest(tag){
  const record={cleared:false,focus:0};
  const elements={
    drawer:{
      hidden:false,scrollTop:0,classList:{remove(){}},
      style:{setProperty(){}},setAttribute(){},contains:()=>false
    },
    drawerTag:{textContent:''},drawerContents:{innerHTML:''},
    scrim:{hidden:true},closeDrawer:{focus(){record.focus++}},
    travelTrail:{classList:{remove(key){if(key==='is-thread')record.cleared=true}}}
  };
  const env=ctx({
    $:id=>elements[id],diveIndex:-1,v76FocusReturn:null,
    v762CancelReturn(){},
    v78ThreadContext:{from:0,to:1,relation:'Общая тема'},
    document:{activeElement:null,body:{classList:{add(){}}}}
  });
  make('setDrawer',env)(tag,'<p>test content</p>');
  return {env,record,elements};
}
test('opening archive from a story clears ephemeral thread and highlighted route',()=>{
  const {env,record,elements}=openDrawerTest('THE HUMAN ATLAS / STORIES');
  assert.equal(env.v78ThreadContext,null);
  assert.equal(record.cleared,true);
  assert.equal(elements.drawerContents.innerHTML,'<p>test content</p>');
});
test('changing to a legitimate story reader retains an in-progress thread',()=>{
  const {env,record}=openDrawerTest('HUMAN STORY / FICTIONAL');
  assert.equal(env.v78ThreadContext.to,1);
  assert.equal(record.cleared,false);
});
test('verified legend reader also retains the in-progress thread',()=>{
  const {env}=openDrawerTest('LEGEND / VERIFIED SOURCE');
  assert.equal(env.v78ThreadContext.to,1);
});
