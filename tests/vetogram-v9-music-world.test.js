/* V9 Music World: real source events, one native player, no fake chart ranks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const html=read('music-module.html');
const source=read('vetogram-v9-music-world.js');
const css=read('vetogram-v9-music-world.css');
const music=read('vetogram-music.js');
const catalog=read('vetogram-music-catalog.js');
const IDS=['v9MusicWorld','v9WorldHeading','v9WorldTitle','v9WorldArtist','v9WorldArt',
  'v9WorldIndex','v9WorldStatus','v9WorldTracks','v9WorldPlay','v9WorldLike',
  'v9WorldRetry','v9WorldPrev','v9WorldNext','v9WorldCatalog'];
class FakeNode{
  constructor(tag='div'){this.tag=tag;this.children=[];this.attributes={};this.dataset={};
    this.hidden=true;this.textContent='';this.className='';this.parentNode=null;
    this.classList={add:()=>{},remove:()=>{}}}
  setAttribute(key,value){this.attributes[key]=String(value)}
  append(...children){for(const child of children){if(child?.tag==='fragment'){this.append(...child.children);continue}
    if(child&&typeof child==='object')child.parentNode=this;this.children.push(child)}}
  replaceChildren(...children){this.children=[];this.append(...children)}
  addEventListener(){}
  contains(){return false}
}
function setup(initial=[]){
  const elements=new Map(IDS.map(id=>[id,new FakeNode(id)]));
  const listeners=new Map(),played=[],liked=[];
  let records=initial,refreshes=0,opened=[];
  const document={
    getElementById:id=>elements.get(id),
    createElement:tag=>new FakeNode(tag),
    createDocumentFragment:()=>new FakeNode('fragment'),
    addEventListener:(name,fn)=>{listeners.set(name,fn)},
    documentElement:{classList:{add:()=>{}}},
    visibilityState:'visible',activeElement:null
  };
  const api={
    trending:()=>records,play:(track,queue)=>played.push({track,queue}),
    toggleLike:track=>liked.push(track.id),
    refreshTrending:()=>{refreshes++},
    showPage:page=>opened.push(page)
  };
  const window={
    VetogramMusic:api,VetogramCatalog:{selectPreset:id=>opened.push(id)},
    matchMedia:()=>({matches:false}),
    setInterval:()=>1,clearInterval:()=>{},addEventListener:()=>{}
  };
  runInNewContext(source,{window,document,URL});
  const emit=(name,detail)=>listeners.get(name)?.({detail});
  return {window,document,elements,api,played,liked,opened,emit,
    setRecords:next=>{records=next},refreshes:()=>refreshes};
}
const track=(id,title='Actual track',artwork='https://creatornode2.audius.co/content/real.jpg')=>({
  id:'audius:'+id,source:'audius',title,artist:'Actual artist',artwork
});
test('music world is wired after the original single audio controller',()=>{
  assert.ok(html.includes('id="v9MusicWorld"'));
  assert.ok(html.indexOf('vetogram-music.js')<html.indexOf('vetogram-v9-music-world.js'));
  assert.ok(html.indexOf('vetogram-reborn-modules.css')<html.indexOf('vetogram-v9-music-world.css'));
  assert.equal((html.match(/<audio\b/g)||[]).length,1);
  for(const id of IDS)assert.ok(html.includes('id="'+id+'"'),id);
});
test('the old native Audius fetch publishes events and a read-only real track list',()=>{
  assert.match(music,/trending:\(\)=>state\.tracks\.slice\(\)/);
  assert.match(music,/refreshTrending:loadTrending/);
  assert.match(music,/vetogram:music-trending/);
  assert.match(music,/window\.VetogramCatalog\?\.selectPreset\?\.\("world"\)/);
  assert.doesNotMatch(source,/\bfetch\s*\(|new Audio\s*\(|previewUrl|itunes\.apple|\.mp3/);
});
test('catalog defaults to world search, RU and HY are still present',()=>{
  assert.match(catalog,/group="world",preset="world"/);
  assert.match(catalog,/PRESETS\.find\(x=>x\.id==="world"\)\.q/);
  assert.match(catalog,/id:"ru"/);
  assert.match(catalog,/id:"am"/);
});
test('no synthetic artists: empty home stays honest with retry',()=>{
  const x=setup([]);
  assert.equal(x.elements.get('v9MusicWorld').hidden,false);
  assert.equal(x.window.VetogramV9WorldMusic.state().count,0);
  assert.equal(x.elements.get('v9WorldPlay').disabled,true);
  assert.equal(x.elements.get('v9WorldTracks').children.length,4);
  x.elements.get('v9WorldRetry').onclick();
  assert.equal(x.refreshes(),1);
  assert.equal(x.played.length,0);
});
test('live provider records create real cover cards and one-tap native playback',()=>{
  const x=setup([]);
  x.setRecords([track('A1','Track one'),track('B2','Track two')]);
  x.emit('vetogram:music-trending',{status:'ready',count:2});
  assert.equal(x.window.VetogramV9WorldMusic.state().count,2);
  assert.equal(x.elements.get('v9WorldTracks').children.length,2);
  assert.equal(x.elements.get('v9WorldTitle').textContent,'Track one');
  x.elements.get('v9WorldTracks').children[1].onclick();
  assert.equal(x.played.length,1);
  assert.equal(x.played[0].track.id,'audius:B2');
  assert.equal(x.played[0].queue.length,2);
  x.elements.get('v9WorldLike').onclick();
  assert.equal(x.liked[0],'audius:B2');
});
test('broken provider stream is removed; confirmed playback is not guessed',()=>{
  const x=setup([track('A1'),track('B2')]);
  x.emit('vetogram:audio-error',{trackId:'audius:A1'});
  assert.equal(x.window.VetogramV9WorldMusic.state().count,1);
  assert.equal(x.window.VetogramV9WorldMusic.state().failed,1);
  assert.match(x.elements.get('v9WorldStatus').textContent,/не воспроизвёлся/);
  x.emit('vetogram:audio-playing',{trackId:'audius:B2'});
  assert.match(x.elements.get('v9WorldStatus').textContent,/Подтверждено воспроизведение/);
});
test('unsafe cover URL and malformed metadata never enter editorial rail',()=>{
  const x=setup([track('A1','Safe','http://example.com/art.jpg'),
    track('B2','Unsafe host','https://tracker.example.com/cover.png'),
    {id:'audius:bad/../id',source:'audius',title:'bad',artist:'bad'},
    {id:'metadata:99',source:'metadata',title:'Fake full song',artist:'none'}]);
  assert.equal(x.window.VetogramV9WorldMusic.state().count,2);
  assert.equal(x.elements.get('v9WorldArt').children[0].tag,'span');
  x.elements.get('v9WorldNext').onclick();
  assert.equal(x.elements.get('v9WorldArt').children[0].tag,'span');
});
test('catalog button uses existing router; no second iframe/player',()=>{
  const x=setup([track('A1')]);
  x.elements.get('v9WorldCatalog').onclick();
  assert.deepEqual(x.opened,['catalog','world']);
  assert.doesNotMatch(source,/createElement\(['"](?:iframe|audio)['"]\)/);
});
test('black-white, responsive and reduced motion rules are present',()=>{
  assert.match(css,/v9-world-ready/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/max-width:420px/);
  assert.match(css,/v9-world-track-grid/);
  assert.doesNotMatch(css,/#[0-9a-f]{6}(?:aa|bb|cc|dd)/i);
});
