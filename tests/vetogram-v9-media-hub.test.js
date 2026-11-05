/* V9 Media Hub: no fake catalog, no duplicate router, no cross-owner recent. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const source=read('vetogram-v9-media-hub-core.js');
const html=read('studio.html'),ui=read('vetogram-v9-media-hub.js'),css=read('vetogram-v9-media-hub.css');
const host={};
runInNewContext(source,{window:host,URL});
const core=host.VetogramV9MediaHubCore;
const storage=()=>{
 const data=new Map();
 return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))};
};
const guest={initData:'',user:{id:111}};
const ownerA={initData:'signed-init-data',user:{id:111}};
const ownerB={initData:'signed-init-data',user:{id:222}};
test('Media hub has three real module destinations, not four or games',()=>{
 const grid=html.slice(html.indexOf('class="v6-media-grid'),html.indexOf('class="v72-discovery-note'));
 const names=[...grid.matchAll(/data-v6-module="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(names,['music','cinema','books']);
 assert.match(html,/id="v6MediaStage"/);
 assert.match(html,/id="v6MediaHome"/);
 assert.match(html,/id="v9MediaResumeOpen"/);
 assert.match(html,/id="v9MediaResumeLabel"/);
 assert.match(html,/id="v9MediaResume" hidden/);
 assert.ok(html.indexOf('id="v9MediaResume"')<html.indexOf('class="v6-media-grid'));
});
test('media scripts load after existing Universe owner; cache identity stays unified',()=>{
 const universe=html.indexOf('/vetogram-universe.js?v=20261105-v9-02');
 const index=html.indexOf('/vetogram-universe-61.js?v=20261105-v9-02');
 const coreTag=html.indexOf('/vetogram-v9-media-hub-core.js?v=20261105-v9-02');
 const uiTag=html.indexOf('/vetogram-v9-media-hub.js?v=20261105-v9-02');
 assert.ok(universe>=0&&index>universe&&coreTag>index&&uiTag>coreTag);
 assert.match(html,/vetogram-v9-media-hub.css\?v=20261105-v9-02/);
 assert.doesNotMatch(html,/YOUR UNIVERSE \/ 07|001 — 004/);
});
test('last category persists only a safe enum and is separated per signed owner',()=>{
 const store=storage();
 assert.equal(core.scope(guest),'device');
 assert.equal(core.scope(ownerA),'owner-111');
 assert.equal(core.scope(ownerB),'owner-222');
 assert.equal(core.save(store,ownerA,'music'),true);
 assert.equal(core.read(store,ownerA),'music');
 assert.equal(core.read(store,ownerB),'');
 assert.equal(core.read(store,guest),'');
 assert.equal(core.save(store,ownerA,'<script>'),false);
 assert.equal(core.read(store,ownerA),'music');
 assert.equal(store.getItem(core.key(ownerA)),'music');
});
test('storage-disabled WebView is fail-closed and still usable',()=>{
 const denied={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 assert.equal(core.read(denied,ownerA),'');
 assert.equal(core.save(denied,ownerA,'books'),false);
 assert.equal(core.save(null,ownerA,'books'),false);
});
test('only trusted HTTPS artwork hosts can be loaded, without credentials',()=>{
 assert.equal(core.artwork('javascript:alert(1)'),'');
 assert.equal(core.artwork('http://covers.openlibrary.org/b/id/5-L.jpg'),'');
 assert.equal(core.artwork('https://tracker.example/collect?token=secret'),'');
 assert.equal(core.artwork('https://evil.com@covers.openlibrary.org/b/id/5-L.jpg'),'');
 assert.equal(core.artwork('https://covers.openlibrary.org/b/id/5-L.jpg'),'https://covers.openlibrary.org/b/id/5-L.jpg');
 assert.equal(core.artwork('https://images.audius.co/cover.jpg'),'https://images.audius.co/cover.jpg');
});
test('saved user-owned music and book cover art is source-bound, never fabricated',()=>{
 const store=storage(),scope=core.scope(ownerA);
 store.setItem('vetogram-music-v1:'+scope,JSON.stringify({liked:[
  {title:'one',artwork:'https://tracker.example/cover.png'},
  {title:'two',artwork:'https://images.audius.co/real.jpg'}
 ]}));
 store.setItem('vetogram-books-v1:'+scope+':saved',JSON.stringify({
  x:{title:'book',cover:'https://covers.openlibrary.org/b/id/123-L.jpg'}
 }));
 assert.equal(core.latestArt(store,ownerA,'music'),'https://images.audius.co/real.jpg');
 assert.equal(core.latestArt(store,ownerA,'books'),'https://covers.openlibrary.org/b/id/123-L.jpg');
 assert.equal(core.latestArt(store,ownerB,'books'),'');
 assert.equal(core.latestArt(store,ownerA,'cinema'),'');
});
test('existing controller is the only module router and stored resume is real',()=>{
 new Script(ui);
 assert.match(ui,/api\.open\(name\)/);
 assert.match(ui,/nameFromTitle\(\)/);
 assert.match(ui,/new MutationObserver/);
 assert.match(ui,/event\.detail\?\.screen==='media'/);
 assert.doesNotMatch(ui,/iframe\.src|document\.createElement\('iframe'\)/);
 assert.doesNotMatch(ui,/initData\s*\)/);
});
test('responsive media art honors reduced motion and both light themes',()=>{
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/max-width:760px/);
 assert.match(css,/max-width:360px/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/data-veto-theme="pearl"/);
 assert.match(css,/data-veto-theme="linen"/);
 assert.match(css,/v9-media-source-cover/);
 assert.match(ui,/image\.referrerPolicy='no-referrer'/);
});

test('actual module transition updates resume and uses the existing router',()=>{
 const store=storage(),events=new Map(),opened=[];
 let owner=ownerA,observer=null,click=null;
 const art={prepend(){}};
 const cards=['music','cinema','books'].map(name=>({
  dataset:{v6Module:name},classList:{remove(){},add(){}},
  querySelector(selector){return selector==='.v72-card-art'?art:null}
 }));
 const home={hidden:false,querySelectorAll(){return cards}};
 const stage={hidden:true},title={textContent:''};
 const resume={hidden:true},label={textContent:''};
 const button={dataset:{},setAttribute(){},addEventListener(name,fn){if(name==='click')click=fn}};
 const nodes={v6MediaHome:home,v6MediaStage:stage,v6ModuleTitle:title,
  v9MediaResume:resume,v9MediaResumeOpen:button,v9MediaResumeLabel:label,
  v61Continue:{hidden:true}};
 const universe={context:()=>owner,open:name=>opened.push(name)};
 const mockWindow={VetogramV9MediaHubCore:core,VetogramUniverse:universe,
  localStorage:store,addEventListener:(name,fn)=>events.set(name,fn)};
 const mockDocument={getElementById:id=>nodes[id]||null};
 class Observer{constructor(callback){observer=callback}observe(){}}
 runInNewContext(ui,{window:mockWindow,document:mockDocument,MutationObserver:Observer,setTimeout:fn=>fn()});
 assert.equal(resume.hidden,true);
 home.hidden=true;stage.hidden=false;title.textContent='Кино';observer();
 assert.equal(core.read(store,ownerA),'cinema');
 home.hidden=false;stage.hidden=true;observer();
 assert.equal(resume.hidden,false);
 assert.equal(label.textContent,'Кино');
 click();
 assert.deepEqual(opened,['cinema']);
 owner=ownerB;events.get('vetogram:identity-change')();
 assert.equal(resume.hidden,true);
 assert.equal(core.read(store,ownerB),'');
});
