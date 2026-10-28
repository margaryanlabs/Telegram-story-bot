import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const coreSource=readFileSync(new URL('../public/vetogram-universe-61-core.js',import.meta.url),'utf8');
const context={window:{},URL};
vm.runInNewContext(coreSource,context);
const core=context.window.VetogramUniverse61Core;
function store(records){return {getItem:k=>Object.hasOwn(records,k)?JSON.stringify(records[k]):null};}
test('V6.1 builds one scoped library with actual book progress and favorites',()=>{
 const db=store({
  'vetogram-books-v1:owner-7:progress':{'b-1':{id:1,title:'Война и мир',authors:['Толстой'],workFraction:.42,at:100}},
  'vetogram-music-v1:owner-7':{liked:[{id:'m-1',title:'Мой трек',artist:'Автор'}]},
  'vetogram-v61-recent:owner-7':[{kind:'cinema',id:'film-1',title:'Фильм',at:200}],
  'vetogram-v61-links:owner-7':[{id:'https://example.org/',title:'Ссылка',href:'https://example.org/',at:50}],
  'vetogram-books-v1:owner-8:progress':{'b-2':{title:'Чужая книга',at:999}},
 });
 const items=core.collect(db,'owner-7');
 assert.equal(items.length,4);assert.equal(items.find(x=>x.kind==='books').progress,.42);
 assert.ok(!items.some(x=>x.title==='Чужая книга'));
 assert.equal(core.latest(items)[0].title,'Фильм');
 assert.equal(core.search(items,'война').length,1);
});
test('invalid schemes and malformed storage are not indexed or opened',()=>{
 assert.equal(core.url('javascript:alert(1)'),'');
 assert.equal(core.url('http://example.org'),'');
 assert.equal(core.url('https://example.org/').startsWith('https://'),true);
 const db={getItem:key=>key.includes('links')?JSON.stringify([{kind:'link',id:'x',title:'X',href:'javascript:bad'}]):'{not-json'};
 assert.equal(core.collect(db,'device').length,0);
});
test('search filters kinds and matches all query tokens without leaking other types',()=>{
 const rows=[{kind:'music',title:'Night song',subtitle:'Artist'},{kind:'books',title:'Night Song',subtitle:'Writer'}];
 assert.equal(core.search(rows,'night song','music').length,1);
 assert.equal(core.search(rows,'night missing','all').length,0);
});
