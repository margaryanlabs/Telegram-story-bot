import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../public/vetogram-editorial-80.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/vetogram-editorial-80.css',import.meta.url),'utf8');
const music=readFileSync(new URL('../public/music-module.html',import.meta.url),'utf8');
const books=readFileSync(new URL('../public/books.html',import.meta.url),'utf8');
const catalog=readFileSync(new URL('../public/vetogram-music-catalog.js',import.meta.url),'utf8');
function element(id=''){
 return {
  id,parentNode:null,children:[],dataset:{},events:{},
  classList:{added:[],add(x){this.added.push(x);}},
  addEventListener(name,fn){this.events[name]=fn;},
  querySelector(){return null;},
  click(){this.events.click?.();},
  setAttribute(key,val){this[key]=val;},
  insertBefore(item,anchor){
   const old=item.parentNode;
   if(old){const k=old.children.indexOf(item);if(k>=0)old.children.splice(k,1);}
   const i=this.children.indexOf(anchor);
   if(i<0)throw Error('missing original anchor: '+anchor.id);
   this.children.splice(i,0,item);item.parentNode=this;
  }
 };
}
function attach(parent,...nodes){parent.children.push(...nodes);nodes.forEach(n=>n.parentNode=parent)}
test('music exposes seven genuine native catalog presets, without creating fake tracks',()=>{
 const originalIds=['ru','am','world','ru-rap','electronic','jazz','world-lofi'];
 assert.equal((music.match(/data-v82-preset="/g)||[]).length,originalIds.length);
 for(const id of originalIds){
  assert.match(music,new RegExp('data-v82-preset="'+id+'"'));
  assert.match(catalog,new RegExp('id:"'+id+'"'));
 }
 const root=element('v78MediaHub');root.dataset.v78Module='music';
 const genres=element('v82MusicGenres');
 const buttons=originalIds.map(id=>{const b=element(id);b.dataset.v82Preset=id;return b});
 genres.querySelectorAll=()=>buttons;
 const status=element('v82GenresStatus');status.hidden=true;
 const main=element('home');
 const originalTracks=element('licensedHomeSection');
 attach(main,root,originalTracks);
 const document={
  body:{classList:{add(){}}},
  documentElement:{dataset:{}},
  getElementById:id=>id==='v78MediaHub'?root:id==='licensedHomeSection'?originalTracks:
    id==='v82MusicGenres'?genres:id==='v82GenresStatus'?status:null,
  querySelector:sel=>sel==='.page[data-view="home"]'?main:null
 };
 const calls=[],window={VetogramMusic:{showPage:id=>calls.push('page:'+id)},
  VetogramCatalog:{selectPreset:id=>{calls.push('preset:'+id);return true;}}};
 runInNewContext(source,{document,window});
 buttons.find(b=>b.dataset.v82Preset==='am').click();
 buttons.find(b=>b.dataset.v82Preset==='world-lofi').click();
 assert.deepEqual(calls,['preset:am','page:catalog','preset:world-lofi','page:catalog']);
 assert.equal(originalTracks.parentNode,main);
 assert.match(css,/\.v82-genres-scroll/);
});
test('music real genre navigation handles unloaded catalog without inventing success',()=>{
 const root=element('v78MediaHub');root.dataset.v78Module='music';
 const genres=element('v82MusicGenres');
 const b=element('ru');b.dataset.v82Preset='ru';genres.querySelectorAll=()=>[b];
 const status=element('v82GenresStatus');status.hidden=true;
 const document={body:{classList:{add(){}}},documentElement:{dataset:{}},
  getElementById:id=>id==='v78MediaHub'?root:id==='v82MusicGenres'?genres:
    id==='v82GenresStatus'?status:null,querySelector:()=>null};
 runInNewContext(source,{document,window:{}});
 b.click();
 assert.equal(status.hidden,false);
 assert.match(status.textContent,/загружается/);
});
test('books moves the ORIGINAL source filters, title search and topics directly above the library',()=>{
 assert.match(books,/id="catalogSearch"/);
 assert.match(books,/class="source-tabs"/);
 assert.match(books,/class="topics"/);
 const root=element('v78MediaHub');root.dataset.v78Module='books';
 const main=element('books-main');
 const hero=element('hero'),featured=element('featuredEditions'),
   tabs=element('tabs'),topics=element('topics'),search=element('catalogSearch');
 attach(main,hero,root,featured,tabs,topics,search);
 const document={body:{classList:{add(){}}},documentElement:{dataset:{}},
  getElementById:id=>id==='v78MediaHub'?root:id==='featuredEditions'?featured:
    id==='catalogSearch'?search:null,
  querySelector:q=>q==='.books-main .source-tabs'?tabs:
    q==='.books-main .topics'?topics:null};
 runInNewContext(source,{document});
 assert.deepEqual(main.children.map(x=>x.id),
   ['hero','catalogSearch','featuredEditions','tabs','topics','v78MediaHub']);
 assert.ok([featured,tabs,topics,search].every(node=>node.parentNode===main));
 assert.match(css,/\.books-main>\.topics/);
 assert.match(css,/#catalogSearch/);
});
test('editorial real-category design retains keyboard focus and narrow mobile scrolling',()=>{
 assert.match(css,/\.v82-genres-scroll button:focus-visible/);
 assert.match(css,/\.v82-genres-scroll\{display:flex;gap:8px;max-width:100%;overflow-x:auto/);
 assert.match(css,/\.books-main>\.topics\{display:flex!important;max-width:100%;overflow-x:auto/);
 assert.equal(css.split('{').length,css.split('}').length);
 assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|innerHTML|document\.cookie|postMessage/);
});
