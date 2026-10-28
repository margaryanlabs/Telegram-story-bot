/* V6.1 real controllers — deep link and trust-boundary regression tests.
 * This file executes the shipping bridge and saved-entry handlers in Node vm. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');

function bridgeFixture(kind) {
 const events=new Map(),calls=[],parent={postMessage(){}};
 const window={VetogramMediaContext:{embedded:true,scope:'owner-42'},addEventListener(name,cb){events.set(name,cb)}};
 if(kind==='books')window.VetogramBooks={openSavedByKey:id=>{calls.push(id);return true}};
 if(kind==='music')window.VetogramMusic={now:()=>null,openSavedById:id=>{calls.push(id);return true}};
 const document={getElementById:()=>null,querySelectorAll:()=>[],addEventListener() {},documentElement:{dataset:{}},body:{classList:{toggle(){}}}};
 vm.runInNewContext(src('vetogram-media-bridge.js'),{window,document,parent,location:{origin:'https://vetogram.test'},setTimeout:()=>1,clearTimeout(){}});
 return {calls,dispatch:(id,origin='https://vetogram.test',source=parent)=>{
   events.get('message')({source,origin,data:{channel:'vetogram-universe',action:'open-item',id}});
 }};
}
test('reopen saved book only from the trusted same-origin parent',()=>{
 const f=bridgeFixture('books');
 f.dispatch('book-1','https://foreign.test');
 f.dispatch('book-1','https://vetogram.test',{});
 f.dispatch('book-1');
 f.dispatch('x'.repeat(221));
 assert.deepEqual(f.calls,['book-1']);
});
test('music deep link uses existing Music controller and rejects foreign windows',()=>{
 const f=bridgeFixture('music');
 f.dispatch('audio-1','https://foreign.test');f.dispatch('audio-1');
 assert.deepEqual(f.calls,['audio-1']);
});
test('saved book resolver only opens an actual entry from personal saved/progress maps',()=>{
 const source=src('books.js');
 const start=source.indexOf('function openSavedByKey(');
 const end=source.indexOf('window.VetogramBooks=Object.freeze(',start);
 assert.ok(start>=0&&end>start);
 const opened=[];
 const saved={'local-3':{id:3,title:'Моя книга',provider:'local'}};
 const progress={'47':{id:47,title:'Моя книга 2'}};
 const context={saved,progress,bookFromProgress:(_key,item)=>item,openBook:book=>opened.push(book)};
 const handler=vm.runInNewContext(source.slice(start,end)+';openSavedByKey',context);
 assert.equal(handler('local-3'),true);
 assert.equal(handler('47'),true);
 assert.equal(handler('missing'),false);
 assert.equal(handler('javascript:alert(1)'),false);
 assert.deepEqual(opened.map(x=>x.id),[3,47]);
});
test('saved music opens an actual playable track, metadata becomes search only',()=>{
 const source=src('vetogram-music.js');
 const start=source.indexOf('function openSavedById('),end=source.indexOf('window.VetogramMusic=Object.freeze(',start);
 assert.ok(start>=0&&end>start);
 const actions=[],queries=[],messages=[],input={value:''};
 const state={local:[],liked:[
   {id:'stream-1',source:'stream',title:'Track',stream:'https://example.org/music.mp3'},
   {id:'meta-1',source:'metadata',title:'Not playable',artist:'Artist'},
   {id:'local-1',source:'local',title:'Unavailable without file'}
  ],streams:[],tracks:[],radios:[],metadata:[]};
 const handler=vm.runInNewContext(source.slice(start,end)+';openSavedById',{
   state,unique:list=>list.filter((x,i)=>list.findIndex(y=>y.id===x.id)===i),
   showPage:page=>actions.push(['page',page]),playTrack:track=>actions.push(['play',track.id]),
   runSearch:query=>queries.push(query),$:()=>input,send:msg=>messages.push(msg)
 });
 assert.equal(handler('stream-1'),true);
 assert.equal(handler('meta-1'),true);
 assert.equal(handler('local-1'),false);
 assert.equal(handler('missing'),false);
 assert.ok(actions.some(x=>x[0]==='play'&&x[1]==='stream-1'));
 assert.deepEqual(queries,['Artist Not playable']);
 assert.ok(!actions.some(x=>x[0]==='play'&&x[1]==='meta-1'));
 assert.ok(messages.length===1);
});

test('missing saved media sends a truthful failure rather than doing nothing',()=>{
 const events=new Map(),sent=[],parent={postMessage:x=>sent.push(x)};
 const window={VetogramMediaContext:{embedded:true,scope:'owner-42'},VetogramBooks:{openSavedByKey:()=>false},addEventListener:(name,cb)=>events.set(name,cb)};
 const document={getElementById:()=>null,querySelectorAll:()=>[],addEventListener(){},documentElement:{dataset:{}},body:{classList:{toggle(){}}}};
 vm.runInNewContext(src('vetogram-media-bridge.js'),{window,document,parent,location:{origin:'https://vetogram.test'},setTimeout:()=>1,clearTimeout(){}});
 events.get('message')({source:parent,origin:'https://vetogram.test',data:{channel:'vetogram-universe',action:'open-item',id:'missing-key'}});
 assert.ok(sent.some(x=>x.type==='open-item-status'&&x.ok===false));
 assert.ok(src('vetogram-universe.js').includes("message.type==='open-item-status'"));
});
