/* VETOGRAM 6.1 unified personal search -> real module catalog routing. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL('../public/'+x,import.meta.url),'utf8');
function bridgeFixture(kind){
 const calls=[],handlers=new Map(),parent={postMessage(){}};
 const mocks={
  music:{showPage:p=>calls.push(['page',p]),search:q=>calls.push(['music',q]),now:()=>null,getLibrary:()=>[]},
  cinema:{search:q=>calls.push(['cinema',q]),getLibrary:()=>[]},
  books:{search:q=>calls.push(['books',q])}
 };
 const window={VetogramMediaContext:{embedded:true,scope:'owner-7'},addEventListener:(key,fn)=>handlers.set(key,fn)};
 if(kind==='music')window.VetogramMusic=mocks.music;
 if(kind==='cinema')window.VetogramCinema=mocks.cinema;
 if(kind==='books')window.VetogramBooks=mocks.books;
 const searchInput={value:''};
 const document={getElementById:id=>id==='searchInput'?searchInput:null,
  querySelectorAll:()=>[],addEventListener(){},documentElement:{dataset:{}},body:{classList:{toggle(){}}}};
 vm.runInNewContext(read('vetogram-media-bridge.js'),{window,document,parent,location:{origin:'https://vetogram.test'},setTimeout:()=>1,clearTimeout(){}});
 const dispatch=(query,source=parent,origin='https://vetogram.test')=>{
  handlers.get('message')({source,origin,data:{channel:'vetogram-universe',action:'search-query',query}});
 };
 return {calls,dispatch,searchInput};
}
test('Music preserves query and opens its real search API, not a fake list',()=>{
 const f=bridgeFixture('music');
 f.dispatch('  Radiohead — Creep  ');
 assert.deepEqual(f.calls,[['page','search'],['music','Radiohead — Creep']]);
 assert.equal(f.searchInput.value,'Radiohead — Creep');
});
test('Cinema uses its own catalog search; Books uses its own reader/catalog search',()=>{
 const cinema=bridgeFixture('cinema'),books=bridgeFixture('books');
 cinema.dispatch('Гарри Поттер');books.dispatch('Мастер и Маргарита');
 assert.deepEqual(cinema.calls,[['cinema','Гарри Поттер']]);
 assert.deepEqual(books.calls,[['books','Мастер и Маргарита']]);
});
test('search requests are ignored from forged source, origin, and too-short queries',()=>{
 const f=bridgeFixture('music');
 f.dispatch('Секретное',{},'https://vetogram.test');
 f.dispatch('Секретное',undefined,'https://evil.test');
 f.dispatch('A');
 assert.deepEqual(f.calls,[]);
});
test('parent retains search query for first load and retry; it is never embedded in iframe URL',()=>{
 const p=read('vetogram-universe.js');
 assert.match(p,/searchQuery:query\|\|''/);
 assert.match(p,/lastQuery:query\|\|''/);
 assert.match(p,/action:'search-query'/);
 assert.match(p,/openModule\(name,page,id,query\)/);
 assert.doesNotMatch(p,/encodeURIComponent\(query\)/);
});

test('Books discovery uses broad Spotlight instead of the 18-item whole-text subset',()=>{
 const source=read('books.js');
 const start=source.indexOf('  function search(query){');
 const end=source.indexOf('  window.VetogramBooks=Object.freeze(',start);
 assert.ok(start>=0&&end>start);
 const state={source:'complete',query:''},calls=[],input={value:''};
 const search=vm.runInNewContext(source.slice(start,end)+';search',{
  state,persist:(k,v)=>calls.push(['persist',k,v]),
  $:id=>id==='bookSearch'?input:{focus(){}},
  setSourceInfo:()=>calls.push(['source-info']),
  loadCatalog:()=>{calls.push(['catalog',state.source,state.query]);return Promise.resolve()}
 });
 assert.equal(search('Гарри Поттер'),true);
 assert.equal(state.source,'spotlight');
 assert.equal(state.query,'Гарри Поттер');
 assert.deepEqual(calls.at(-1),['catalog','spotlight','Гарри Поттер']);
 state.source='local';
 assert.equal(search('Анна Каренина'),true);
 assert.equal(state.source,'spotlight');
 state.source='ru';
 assert.equal(search('Достоевский'),true);
 assert.equal(state.source,'ru');
 assert.equal(search('А'),false);
});
