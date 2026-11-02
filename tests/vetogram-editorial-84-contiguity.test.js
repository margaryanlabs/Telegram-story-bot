import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const editorial=readFileSync(new URL('../public/vetogram-editorial-80.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../public/vetogram-editorial-80.css',import.meta.url),'utf8');
const books=readFileSync(new URL('../public/books.html',import.meta.url),'utf8');
const cinema=readFileSync(new URL('../public/cinema.html',import.meta.url),'utf8');

function node(id){
 return {id,children:[],parentNode:null,dataset:{},
  classList:{added:[],add(...names){this.added.push(...names);}},
  setAttribute(key,value){this[key]=value;},
  insertBefore(child,before){
   if(child.parentNode){
    const old=child.parentNode.children.indexOf(child);
    if(old>=0)child.parentNode.children.splice(old,1);
   }
   const index=this.children.indexOf(before);
   if(index<0)throw Error('target anchor not inside source parent: '+before.id);
   this.children.splice(index,0,child);child.parentNode=this;
  },
  querySelector(selector){return this.lookups?.[selector]??null}
 };
}
function attach(parent,...nodes){
 for(const child of nodes){parent.children.push(child);child.parentNode=parent}
}
function run(mode){
 const main=node('main'),root=node('v78MediaHub');root.dataset.v78Module=mode;
 const el={v78MediaHub:root};
 const add=id=>el[id]=node(id);
 const body={classList:{add(){}}};
 const page={body,documentElement:{dataset:{}},
  getElementById:id=>el[id]??null,
  querySelector:selector=>({
   '.cinema-shell main':mode==='cinema'?main:null,
   '.books-main .source-tabs':el.tabs??null,
   '.books-main .shelf-heading':el.shelfHeading??null,
   '.books-main .topics':el.topics??null,
   '.books-main .catalog-footer':el.footer??null,
  })[selector]??null
 };
 if(mode==='cinema'){
  const elements=['hero','nav','cinemaSearchArea','cinemaWatchNow',
   'cinemaGenresSection','cinemaLatest','cinemaBrowse'].map(add);
  const [hero,nav,search,watch,genres,latest,browse]=elements;
  main.lookups={'.cinema-section-nav':nav};
  attach(main,hero,root,nav,search,watch,genres,latest,browse);
 }else{
  for(const id of ['continueShelf','hero','featuredEditions','bookModeStatus','tabs',
   'sourceDescription','translationFilters','hotFilters','readingGenres',
   'spotlightFilters','importBanner','catalogSearch','authorDiscovery','shelfHeading',
   'topics','libraryClarity','catalogGrid','footer'])add(id);
  attach(main,el.continueShelf,el.hero,root,el.featuredEditions,
   el.bookModeStatus,el.tabs,el.sourceDescription,el.translationFilters,
   el.hotFilters,el.readingGenres,el.spotlightFilters,el.importBanner,
   el.catalogSearch,el.authorDiscovery,el.shelfHeading,el.topics,
   el.libraryClarity,el.catalogGrid,el.footer);
 }
 runInNewContext(editorial,{document:page});
 return {main,el};
}
test('Cinema category chips, sorting, real film results remain together before secondary actions',()=>{
 assert.match(cinema,/id="cinemaBrowse"/);
 assert.match(cinema,/id="cinemaGenres"/);
 assert.match(cinema,/id="cinemaGrid"/);
 const {main}=run('cinema');
 assert.deepEqual(main.children.map(n=>n.id),
  ['hero','nav','cinemaSearchArea','cinemaWatchNow',
   'cinemaGenresSection','cinemaLatest','cinemaBrowse','v78MediaHub']);
 assert.match(styles,/#cinemaGrid/);
 assert.match(styles,/#cinemaGenres/);
});
test('Books original search, filters and full result grid form one consecutive catalog',()=>{
 for(const id of ['catalogSearch','featuredEditions','sourceDescription',
   'bookModeStatus','translationFilters','hotFilters','readingGenres',
   'spotlightFilters','catalogGrid','libraryClarity']){
   assert.match(books,new RegExp('id="'+id+'"'));
 }
 const {main,el}=run('books');
 const actual=main.children.map(n=>n.id);
 assert.deepEqual(actual,[
  'continueShelf','hero','catalogSearch','featuredEditions','tabs',
  'bookModeStatus','sourceDescription','translationFilters','hotFilters',
  'readingGenres','spotlightFilters','importBanner','authorDiscovery',
  'shelfHeading','topics','libraryClarity','catalogGrid','footer','v78MediaHub'
 ]);
 for(const id of ['catalogGrid','topics','shelfHeading','sourceDescription','bookModeStatus'])
  assert.equal(el[id].parentNode,main,'original '+id+' DOM node must survive');
 assert.equal(el.tabs['aria-label'],'Фильтры книжного каталога по доступности и языку');
});
test('Responsive browsing does not create a second player, book search or fake media',()=>{
 assert.equal(styles.split('{').length,styles.split('}').length);
 assert.match(styles,/#cinemaGrid/);
 assert.match(styles,/repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(styles,/\.books-main \.shelf-heading/);
 assert.doesNotMatch(editorial,/\bfetch\s*\(|XMLHttpRequest|innerHTML|new Audio|postMessage/);
});
