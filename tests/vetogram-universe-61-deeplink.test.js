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
test('saved music opens an actual playable track, metadata becomes search only',async()=>{
 const source=src('vetogram-music.js');
 const start=source.indexOf('let savedOpenEpoch=0;'),end=source.indexOf('window.VetogramMusic=Object.freeze(',start);
 assert.ok(start>=0&&end>start);
 const actions=[],queries=[],messages=[],input={value:''};
 const state={local:[],liked:[
   {id:'stream-1',source:'stream',title:'Track',stream:'https://example.org/music.mp3'},
   {id:'meta-1',source:'metadata',title:'Not playable',artist:'Artist'},
   {id:'local-1',source:'local',title:'Unavailable without file'}
  ],streams:[],tracks:[],radios:[],metadata:[]};
 const handler=vm.runInNewContext(source.slice(start,end)+';openSavedById',{
   state,playbackGeneration:0,localDbReady:Promise.resolve(),unique:list=>list.filter((x,i)=>list.findIndex(y=>y.id===x.id)===i),
   showPage:page=>actions.push(['page',page]),playTrack:track=>actions.push(['play',track.id]),
   runSearch:query=>queries.push(query),$:()=>input,send:msg=>messages.push(msg)
 });
 assert.equal(await handler('stream-1'),true);
 assert.equal(await handler('meta-1'),true);
 assert.equal(await handler('local-1'),false);
 assert.equal(await handler('missing'),false);
 assert.ok(actions.some(x=>x[0]==='play'&&x[1]==='stream-1'));
 assert.deepEqual(queries,['Artist Not playable']);
 assert.ok(!actions.some(x=>x[0]==='play'&&x[1]==='meta-1'));
 assert.ok(messages.length===1);
});

test('missing saved media sends a truthful failure rather than doing nothing',async()=>{
 const events=new Map(),sent=[],parent={postMessage:x=>sent.push(x)};
 const window={VetogramMediaContext:{embedded:true,scope:'owner-42'},VetogramBooks:{openSavedByKey:()=>false},addEventListener:(name,cb)=>events.set(name,cb)};
 const document={getElementById:()=>null,querySelectorAll:()=>[],addEventListener(){},documentElement:{dataset:{}},body:{classList:{toggle(){}}}};
 vm.runInNewContext(src('vetogram-media-bridge.js'),{window,document,parent,location:{origin:'https://vetogram.test'},setTimeout:()=>1,clearTimeout(){}});
 events.get('message')({source:parent,origin:'https://vetogram.test',data:{channel:'vetogram-universe',action:'open-item',id:'missing-key'}});
 await Promise.resolve();
 assert.ok(sent.some(x=>x.type==='open-item-status'&&x.ok===false));
 assert.ok(src('vetogram-universe.js').includes("message.type==='open-item-status'"));
});

test('music saved-item deep link waits for the local owner library to restore',async()=>{
 let release;const ready=new Promise(resolve=>{release=resolve});
 const code=src('vetogram-music.js');
 const start=code.indexOf('let savedOpenEpoch=0;');
 const end=code.indexOf('function getLibrary(){',start);
 assert.ok(start>=0&&end>start);
 const state={local:[],liked:[],streams:[],tracks:[],radios:[],metadata:[]},played=[];
 const handler=vm.runInNewContext(code.slice(start,end)+';openSavedById',{
  state,playbackGeneration:0,localDbReady:ready,unique:x=>x,showPage:()=>{},playTrack:track=>played.push(track.id),
  runSearch:()=>{},$:()=>({value:''}),send:()=>{}
 });
 const pending=handler('local-1');
 state.local.push({id:'local-1',title:'Restored MP3',source:'local',url:'blob:private'});
 release();
 assert.equal(await pending,true);
 assert.deepEqual(played,['local-1']);
});

test('music search and demo sources are valid Continue targets, expired provider audio opens search',async()=>{
 const source=src('vetogram-music.js');
 const start=source.indexOf('let savedOpenEpoch=0;'),end=source.indexOf('function getLibrary(){',start);
 assert.ok(start>=0&&end>start);
 const state={local:[],liked:[],streams:[],tracks:[],radios:[],metadata:[],search:[{id:'audius:one',title:'Live',source:'audius'}],queue:[]};
 const actions=[],queries=[],messages=[],input={value:''};
 const handle=vm.runInNewContext(source.slice(start,end)+';openSavedById',{
  state,playbackGeneration:0,localDbReady:Promise.resolve(),demoTracks:[{id:'demo:orbit',title:'Demo',source:'demo'}],
  scope:'owner-1',jLoad:(_key,def)=>[{kind:'music',id:'audius:expired',title:'Old hit',subtitle:'Artist'}],
  unique:list=>list.filter((x,i)=>list.findIndex(y=>y.id===x.id)===i),
  showPage:page=>actions.push(page),playTrack:track=>actions.push('play:'+track.id),
  runSearch:query=>queries.push(query),$:()=>input,send:msg=>messages.push(msg)
 });
 assert.equal(await handle('demo:orbit'),true);
 assert.equal(await handle('audius:one'),true);
 assert.ok(actions.includes('play:demo:orbit')&&actions.includes('play:audius:one'));
 assert.equal(await handle('audius:expired'),true);
 assert.deepEqual(queries,['Artist Old hit']);
 assert.ok(actions.includes('search'));
 assert.equal(await handle('random-unowned'),false);
 assert.equal(messages.length,1);
});

test('latest saved-Music tap wins if multiple file opens wait for IndexedDB',async()=>{
 let resume;const ready=new Promise(resolve=>{resume=resolve});
 const code=src('vetogram-music.js');
 const start=code.indexOf('let savedOpenEpoch=0;'),end=code.indexOf('function getLibrary(){',start);
 const played=[],context=vm.createContext({
  state:{local:[],liked:[],streams:[],tracks:[],radios:[],metadata:[]},
  localDbReady:ready,playbackGeneration:0,unique:x=>x,showPage:()=>{},
  playTrack:track=>played.push(track.id),runSearch:()=>{},$:()=>({value:''}),send:()=>{}
 });
 const open=vm.runInContext(code.slice(start,end)+';openSavedById',context);
 const first=open('one'),second=open('two');
 context.state.local.push(
  {id:'one',title:'Old track',source:'local',url:'blob:old'},
  {id:'two',title:'Latest track',source:'local',url:'blob:new'});
 resume();
 assert.equal(await first,false);
 assert.equal(await second,true);
 assert.deepEqual(played,['two']);
});
test('manually starting a new track cancels a pending saved-Music restore',async()=>{
 let resume;const ready=new Promise(resolve=>{resume=resolve});
 const code=src('vetogram-music.js');
 const start=code.indexOf('let savedOpenEpoch=0;'),end=code.indexOf('function getLibrary(){',start);
 const played=[],context=vm.createContext({
  state:{local:[],liked:[],streams:[],tracks:[],radios:[],metadata:[]},
  localDbReady:ready,playbackGeneration:0,unique:x=>x,showPage:()=>{},
  playTrack:track=>played.push(track.id),runSearch:()=>{},$:()=>({value:''}),send:()=>{}
 });
 const open=vm.runInContext(code.slice(start,end)+';openSavedById',context);
 const pending=open('old');
 context.state.local.push({id:'old',title:'Past song',source:'local',url:'blob:old'});
 context.playbackGeneration++;
 resume();
 assert.equal(await pending,false);
 assert.deepEqual(played,[]);
});
test('bridge echoes correlation ID on asynchronous open success and failure',async()=>{
 const events=new Map(),sent=[],parent={postMessage:x=>sent.push(x)};
 let resolveOld;const oldPending=new Promise(r=>{resolveOld=r});
 const window={VetogramMediaContext:{embedded:true,scope:'owner-1'},
  VetogramMusic:{now:()=>null,getLibrary:()=>[],openSavedById:id=>id==='old'?oldPending:Promise.resolve(true)},
  addEventListener:(k,cb)=>events.set(k,cb)};
 const document={getElementById:()=>null,querySelectorAll:()=>[],addEventListener(){},documentElement:{dataset:{}},body:{classList:{toggle(){}}}};
 vm.runInNewContext(src('vetogram-media-bridge.js'),{
  window,document,parent,location:{origin:'https://vetogram.test'},setTimeout:()=>1,clearTimeout(){}
 });
 const receive=(id,requestId)=>events.get('message')({
  source:parent,origin:'https://vetogram.test',
  data:{channel:'vetogram-universe',action:'open-item',id,requestId}
 });
 receive('old',51);receive('new',52);
 await Promise.resolve();
 assert.ok(sent.some(x=>x.type==='open-item-status'&&x.ok&&x.requestId===52));
 resolveOld(false);
 await Promise.resolve();
 assert.ok(sent.some(x=>x.type==='open-item-status'&&!x.ok&&x.requestId===51));
});
