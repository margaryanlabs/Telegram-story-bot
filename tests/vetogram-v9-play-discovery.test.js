/* Vetogram V9.6 — offline Play discovery regression tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../public/vetogram-v9-explore.js',import.meta.url),'utf8');

class Element {
 constructor(name){
  this.name=name;this.children=[];this.parentNode=null;this.hidden=false;this.dataset={};
  this.textContent='';this.attrs={};this.events={};this.targets={};
  this.classes=new Set();
  this.classList={
   contains:key=>key==='v9-arcade-enhanced'||this.classes.has(key),
   toggle:(key,value)=>value?this.classes.add(key):this.classes.delete(key)
  };
 }
 querySelector(q){return this.targets[q]||null}
 querySelectorAll(q){return this.targets[q]||[]}
 addEventListener(type,callback){this.events[type]=callback}
 setAttribute(key,value){this.attrs[key]=value}
 append(...nodes){for(const node of nodes){
  if(node.parentNode)node.parentNode.children=node.parentNode.children.filter(x=>x!==node);
  node.parentNode=this;this.children.push(node);
 }}
 appendChild(node){this.append(node)}
 insertBefore(node,ref){
  if(node.parentNode)node.parentNode.children=node.parentNode.children.filter(x=>x!==node);
  const at=ref?this.children.indexOf(ref):this.children.length;
  assert.ok(at>=0);node.parentNode=this;this.children.splice(at,0,node);
 }
 insertAdjacentElement(where,node){
  assert.equal(where,'afterend');
  const parent=this.parentNode;
  parent.insertBefore(node,parent.children[parent.children.indexOf(this)+1]||null);
 }
 click(){this.events.click?.()}
 focus(){this.focused=true}
}

function setup(){
 const events=new Map();
 const records=new Map([
  ['vetogram:play:reaction-best:v1','253'],
  ['vetogram:play:snake-best:v1','46']
 ]);
 const favorites=new Set();
 const root=new Element('root'),launcher=new Element('launcher');
 const heading=new Element('heading'),grid=new Element('grid');
 root.targets['#v9ArcadeLauncher']=launcher;
 launcher.targets['.v9-arcade-launch-grid']=grid;
 launcher.targets['.v9-arcade-heading']=heading;
 launcher.append(heading,grid);
 const names=['reaction','pairs','tic','2048','mines','snake'];
 const cards=names.map(name=>{
  const card=new Element(name),art=new Element('art');
  card.dataset.v9Launch=name;card.targets['.v9-cover-art']=art;
  card.append(art);return card;
 });
 grid.append(...cards);grid.targets['button[data-v9-launch]']=cards;
 const document={
  createElement:tag=>new Element(tag),
  querySelector:selector=>selector==='.screen[data-screen="play"]'?root:null,
  activeElement:null
 };
 const window={
  localStorage:{getItem:key=>records.has(key)?records.get(key):null},
  VetogramPlayFavorites:favorites,
  addEventListener:(name,fn)=>events.set(name,fn)
 };
 runInNewContext(source,{document,window,Set});
 return {events,records,favorites,launcher,cards,grid};
}

test('Saved games are real, reactive favorites with an actionable empty state',()=>{
 const {events,favorites,launcher,cards}=setup();
 const filters=launcher.children[1].children[0];
 const counter=launcher.children[1].children[1];
 const empty=launcher.children[3];
 assert.equal(filters.children.length,4);
 assert.equal(cards.filter(c=>!c.hidden).length,6);
 filters.children[3].click();
 assert.equal(cards.filter(c=>!c.hidden).length,0);
 assert.equal(empty.hidden,false);
 favorites.add('snake');events.get('vetogram:play-favorites-changed')();
 assert.deepEqual(cards.filter(c=>!c.hidden).map(c=>c.dataset.v9Launch),['snake']);
 assert.equal(empty.hidden,true);
 assert.equal(counter.textContent,'1 игра · офлайн');
 favorites.delete('snake');events.get('vetogram:play-favorites-changed')();
 assert.equal(empty.hidden,false);
 empty.children[2].click();
 assert.equal(cards.filter(c=>!c.hidden).length,6);
 assert.equal(empty.hidden,true);
});

test('Personal records show only actual, validated local data and refresh after play',()=>{
 const {launcher,cards,records,events}=setup();
 const recordNode=name=>cards.find(c=>c.dataset.v9Launch===name).children.at(-1);
 assert.match(recordNode('reaction').textContent,/253 мс/);
 assert.match(recordNode('snake').textContent,/46 очков/);
 assert.match(recordNode('tic').textContent,/ещё впереди/);
 records.set('vetogram:play:snake-best:v1','87');
 records.set('vetogram:play:tic-wins:v1','2');
 events.get('vetogram:game-close')();
 assert.match(recordNode('snake').textContent,/87 очков/);
 assert.match(recordNode('tic').textContent,/2 побед/);
 records.set('vetogram:play:snake-best:v1','not-a-score');
 events.get('storage')();
 assert.match(recordNode('snake').textContent,/ещё впереди/);
 assert.ok(launcher.children.length>3);
});
