/* V9.5 integration: real controller delegation, never simulated catalog content. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');

class Node {
 constructor(name){this.name=name;this.children=[];this.dataset={};this.listeners={};this.attributes={};
  this.hidden=false;this.active=false;
  this.classList={contains:k=>k==='active'&&this.active,toggle:(k,v)=>{if(k==='is-active')this.active=Boolean(v);}};
 }
 append(...xs){this.children.push(...xs)}
 appendChild(x){this.children.push(x)}
 setAttribute(k,v){this.attributes[k]=v}
 addEventListener(k,fn){this.listeners[k]=fn}
 insertAdjacentElement(where,node){if(where==='afterend')this.after=node}
 click(){this.listeners.click?.()}
}

test('Books four entrypoints use real source handlers, not synthetic pages',()=>{
 const main=new Node('main'),dock=new Node('dock'),tabs=new Node('tabs'),sources={};
 for(const id of ['complete','ru','hy','local']){
  const el=new Node(id);el.active=id==='complete';
  el.click=()=>{Object.values(sources).forEach(s=>s.active=false);el.active=true;el.clicked=(el.clicked||0)+1};
  sources[id]=el;
 }
 tabs.querySelector=selector=>{
  const match=selector.match(/\[data-books-source="([^"]+)"\]/);
  return match?sources[match[1]]||null:null;
 };
 const catalog=new Node('catalog'),banner=new Node('banner');
 catalog.scrollIntoView=()=>{catalog.moves=(catalog.moves||0)+1};
 banner.scrollIntoView=()=>{banner.moves=(banner.moves||0)+1};
 main.querySelector=sel=>({
  '.source-tabs':tabs,'.v9-explore-dock':dock,
  '#catalogGrid':catalog,'#importBanner':banner,
 })[sel]||null;
 const document={
  createElement:tag=>new Node(tag),
  querySelector:sel=>sel==='#booksMain'?main:null,
 };
 runInNewContext(read('vetogram-v9-explore.js'),{document,window:{}});
 const lanes=dock.after;
 assert.ok(lanes);
 assert.equal(lanes.children.length,4);
 assert.equal(lanes.attributes['aria-label'],'Выбрать тип книжной библиотеки');
 lanes.children[2].click();
 assert.equal(sources.hy.clicked,1);
 assert.equal(lanes.children[2].attributes['aria-pressed'],'true');
 assert.equal(catalog.moves,1);
 lanes.children[3].click();
 assert.equal(sources.local.clicked,1);
 assert.equal(banner.moves,1);
 assert.equal(lanes.children[3].attributes['aria-pressed'],'true');
});

test('Old game shortcuts and Surprise now route to V9 without opening legacy modal',()=>{
 const launcher=new Node('surprise'),pairButton=new Node('pairs');
 pairButton.dataset.v74Launch='pairs';
 const root={
  querySelector:s=>s==='#v75SurpriseMe'?launcher:null,
  querySelectorAll:s=>s==='[data-v74-launch]'?[pairButton]:[],
 };
 const opened=[];
 const window={
  VetogramV9GameOpen:id=>{opened.push(id);return true},
  localStorage:{getItem:()=>null},
  addEventListener:()=>{},
 };
 const document={querySelector:s=>s==='.screen[data-screen="play"]'?root:null};
 runInNewContext(read('vetogram-play-records.js'),{window,document,Math});
 pairButton.click();launcher.click();
 assert.equal(opened[0],'pairs');
 assert.ok(['reaction','pairs','tic','2048','mines','snake'].includes(opened[1]));
 assert.equal(opened.length,2);
});

test('Game deep link and V9 controller expose the same allowlisted focus route',()=>{
 const controller=read('vetogram-play.js');
 const deepLink=read('vetogram-play-store.js');
 assert.match(controller,/window\.VetogramV9GameOpen=name=>/);
 assert.match(controller,/if\(!v9Allowed\.has\(name\)\)return false/);
 assert.match(deepLink,/window\.VetogramV9GameOpen\(incomingId\)/);
 assert.match(deepLink,/byId\.has\(incomingId\)/);
 assert.doesNotMatch(read('vetogram-v9-explore.js'),/XMLHttpRequest|fetch\(/);
});
