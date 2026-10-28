/* VETOGRAM 6.1 — actual user media metadata, import routing, and privacy boundary. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');

test('Music VAULT snapshot contains only metadata, not Blob URLs, file contents or secrets',()=>{
 const source=src('vetogram-music.js'),start=source.indexOf('function getLibrary(){'),end=source.indexOf('window.VetogramMusic=Object.freeze(',start);
 assert.ok(start>=0&&end>start);
 const privateBlob={byteLength:1024,privateSecret:'not-for-Vault'};
 const state={liked:[{id:'stream:1',title:'Liked',artist:'Artist',source:'stream',stream:'https://example.org/tr.mp3'}],
  streams:[],local:[{id:'local:1',title:'Owned MP3',artist:'Me',source:'local',url:'blob:secret',blob:privateBlob}]};
 const get=vm.runInNewContext(source.slice(start,end)+';getLibrary',{state});
 const indexed=get(),json=JSON.stringify(indexed);
 assert.equal(indexed.length,2);
 assert.ok(indexed.some(x=>x.id==='local:1'&&x.description==='Личный аудиофайл'));
 assert.doesNotMatch(json,/blob:secret|privateSecret|byteLength|https:\/\/example.org\/tr\.mp3/);
});
test('VETO VAULT displays personal Music metadata for exactly one owner',()=>{
 const host={};
 vm.runInNewContext(src('vetogram-universe-61-core.js'),{window:host,URL});
 const records={
  'vetogram-v61-music:owner-7':[{kind:'music',id:'local:7',title:'Mine',description:'Личный аудиофайл',source:'saved'}],
  'vetogram-v61-music:owner-8':[{kind:'music',id:'local:8',title:'Not mine',source:'saved'}]
 };
 const local={getItem:key=>records[key]?JSON.stringify(records[key]):null};
 const rows=host.VetogramUniverse61Core.collect(local,'owner-7');
 assert.equal(rows.length,1);assert.equal(rows[0].title,'Mine');
 assert.equal(rows[0].description,'Личный аудиофайл');
 assert.ok(!rows.some(x=>x.title==='Not mine'));
});
test('Books import is a real local-books tab, not an automatic file-dialog attempt',()=>{
 const source=src('books.js'),start=source.indexOf('  function showImport(){'),end=source.indexOf('  window.VetogramBooks=Object.freeze(',start);
 assert.ok(start>=0&&end>start);
 const state={source:'complete',query:'old'};
 const nodes={bookSearch:{value:'old'},importBanner:{hidden:true,scrollIntoView(){}},importButton:{focus(){},click(){throw Error('native file picker must require user gesture')}}};
 let persisted=0,catalog=0;
 const handler=vm.runInNewContext(source.slice(start,end)+';showImport',{
  state,persist:()=>persisted++,$:id=>nodes[id],setSourceInfo:()=>{},
  loadCatalog:()=>{catalog++;return Promise.resolve()},window:{requestAnimationFrame:cb=>cb()}
 });
 assert.equal(handler(),true);
 assert.equal(state.source,'local');assert.equal(nodes.importBanner.hidden,false);
 assert.equal(persisted,1);assert.equal(catalog,1);
});
test('Book import bridge only accepts messages from matching parent origin and source',()=>{
 const source=src('vetogram-media-bridge.js'),events=new Map(),parent={postMessage(){}},called=[];
 const window={VetogramMediaContext:{embedded:true,scope:'owner-7'},VetogramBooks:{showImport(){called.push('import')}},
  addEventListener:(key,handler)=>events.set(key,handler)};
 const document={getElementById:()=>null,querySelectorAll:()=>[],addEventListener(){},documentElement:{dataset:{}},body:{classList:{toggle(){}}}};
 vm.runInNewContext(source,{window,document,parent,location:{origin:'https://vetogram.test'},setTimeout:()=>1,clearTimeout(){}});
 const dispatch=(source,origin)=>events.get('message')({source,origin,data:{channel:'vetogram-universe',action:'page',page:'import'}});
 dispatch({},'https://vetogram.test');dispatch(parent,'https://foreign.test');dispatch(parent,'https://vetogram.test');
 assert.deepEqual(called,['import']);
});
