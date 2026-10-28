/* Full personal index pagination: tests actual V6.1 UI/controller scripts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL('../public/'+x,import.meta.url),'utf8');

function fixture({denyStorage=false}={}){
 const records={
  'vetogram-books-v1:owner-7:progress':Object.fromEntries(Array.from({length:120},(_,i)=>[
   'book-'+i,{id:i+1,title:'Книга '+i,at:i+1,workFraction:.2}
  ]))
 };
 let reads=0;
 const localStorage={getItem(k){reads++;return Object.hasOwn(records,k)?JSON.stringify(records[k]):null},
  setItem(k,v){records[k]=JSON.parse(v)}};
 const nodes=new Map(),listeners={};let owner=7;
 const makeNode=tag=>({
  tag,hidden:false,value:'',dataset:{},children:[],textContent:'',style:{},attrs:{},
  classList:{toggle(){},remove(){},add(){}},
  setAttribute(k,v){this.attrs[k]=v},append(...items){this.children.push(...items)},
  replaceChildren(...items){this.children=items},addEventListener(k,cb){this.events??={};this.events[k]=cb},
  scrollIntoView(){},focus(){}
 });
 const $=id=>nodes.get(id)||(nodes.set(id,makeNode('div')),nodes.get(id));
 const filters=['all','music','cinema','books','link'].map(kind=>{const b=makeNode('button');b.dataset.v61Filter=kind;return b});
 const document={getElementById:$,createElement:makeNode,
  querySelectorAll:selector=>selector.includes('data-v61-filter')?filters:[],
  addEventListener(name,cb){listeners['doc:'+name]=cb}};
 const window={VetogramUniverse:{context(){return {initData:'signed',user:{id:owner}}},open(){}},
  addEventListener(name,cb){listeners[name]=cb}};
 Object.defineProperty(window,'localStorage',{
  get(){if(denyStorage)throw new Error('Storage is blocked');return localStorage}
 });
 vm.runInNewContext(read('vetogram-universe-61-core.js'),{window,URL});
 vm.runInNewContext(read('vetogram-universe-61.js'),{window,document,URL});
 return {$,filters,listeners,getReadCount:()=>reads,
  put(key,value){records[key]=value},changeOwner(id){owner=id}};
}
test('search returns all 120 real records through progressive reveal, with true count',()=>{
 const f=fixture(),search=f.$('v61Search');
 search.value='Книга';search.events.input();
 assert.equal(f.$('v61ResultsList').children.length,35);
 assert.equal(f.$('v61ResultsTitle').textContent,'Результаты в личной коллекции · 120');
 assert.equal(f.$('v61SearchMore').hidden,false);
 f.$('v61SearchMore').events.click();assert.equal(f.$('v61ResultsList').children.length,70);
 f.$('v61SearchMore').events.click();f.$('v61SearchMore').events.click();
 assert.equal(f.$('v61ResultsList').children.length,120);
 assert.equal(f.$('v61SearchMore').hidden,true);
 search.value='Отсутствующая';search.events.input();
 assert.equal(f.$('v61ResultsList').children.length,1); // empty-state paragraph
 assert.equal(f.$('v61SearchMore').hidden,true);
});
test('VAULT uses chunks of 50 and preserves total collection count',()=>{
 const f=fixture();
 assert.equal(f.$('v61VaultCount').textContent,'120');
 assert.equal(f.$('v61VaultList').children.length,0); // hidden panel renders lazily
 f.$('v61VaultButton').events.click();
 assert.equal(f.$('v61VaultList').children.length,50);
 f.$('v61VaultMore').events.click();assert.equal(f.$('v61VaultList').children.length,100);
 f.$('v61VaultMore').events.click();assert.equal(f.$('v61VaultList').children.length,120);
 assert.equal(f.$('v61VaultMore').hidden,true);
});
test('changing signed owner resets pagination and removes old private titles',()=>{
 const f=fixture();f.$('v61VaultButton').events.click();f.$('v61VaultMore').events.click();
 f.changeOwner(8);f.listeners['vetogram:identity-change']();
 assert.equal(f.$('v61VaultCount').textContent,'0');
 assert.equal(f.$('v61VaultPanel').hidden,true);
 assert.equal(f.$('v61VaultList').children.length,0);
 f.changeOwner(7);f.listeners['vetogram:identity-change']();
 f.$('v61VaultButton').events.click();
 assert.equal(f.$('v61VaultList').children.length,50); // reset, not previous 100
});

test('search keystrokes reuse indexed metadata; real storage change invalidates it',()=>{
 const f=fixture(),search=f.$('v61Search'),before=f.getReadCount();
 search.value='Кни';search.events.input();
 search.value='Книг';search.events.input();
 search.value='Книга';search.events.input();
 assert.equal(f.getReadCount(),before);
 assert.equal(f.$('v61ResultsTitle').textContent,'Результаты в личной коллекции · 120');
 f.put('vetogram-v61-links:owner-7',[{
  kind:'link',id:'https://example.org/private',title:'Новый сайт',href:'https://example.org/private'
 }]);
 f.listeners.storage({key:'vetogram-v61-links:owner-7'});
 assert.equal(f.$('v61VaultCount').textContent,'121');
 search.value='Новый';search.events.input();
 assert.equal(f.$('v61ResultsTitle').textContent,'Результаты в личной коллекции · 1');
});
test('unavailable browser storage never claims a personal link was saved',()=>{
 const f=fixture({denyStorage:true});
 f.$('v61LinkTitle').value='Личный сайт';
 f.$('v61LinkUrl').value='https://example.org/';
 f.$('v61SaveLink').events.submit({preventDefault(){}});
 assert.equal(f.$('v61VaultStatus').textContent,'Не удалось сохранить ссылку на устройстве.');
 assert.equal(f.$('v61VaultCount').textContent,'0');
});

test('recent playback retains original own-file label and author after de-duplication',()=>{
 const host={};
 vm.runInNewContext(read('vetogram-universe-61-core.js'),{window:host,URL});
 const entries={
  'vetogram-v61-music:owner-7':[
    {kind:'music',id:'local-abc',title:'My file',subtitle:'Мой исполнитель',description:'Личный аудиофайл',source:'saved'}],
  'vetogram-v61-recent:owner-7':[
    {kind:'music',id:'local-abc',title:'My file',subtitle:'',at:100,source:'recent'}]
 };
 const local={getItem:k=>entries[k]?JSON.stringify(entries[k]):null};
 const list=host.VetogramUniverse61Core.collect(local,'owner-7');
 assert.equal(list.length,1);
 assert.equal(list[0].subtitle,'Мой исполнитель');
 assert.equal(list[0].description,'Личный аудиофайл');
 assert.equal(list[0].source,'saved');
 assert.equal(list[0].at,100);
});
