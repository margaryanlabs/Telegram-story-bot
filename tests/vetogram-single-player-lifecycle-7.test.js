import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const host=read('vetogram-universe.js');
const bridge=read('vetogram-media-bridge.js');
const embedded=read('vetogram-media-embedded.css');

const start=host.indexOf(' function chrome(){');
const end=host.indexOf(' function moduleStatus(',start);
assert.ok(start>=0&&end>start,'production host chrome controller exists');
const source=host.slice(start,end);

function harness({audio=null,screen='media',module='music'}={}){
 const classes=new Set();
 const mini={hidden:true};
 const root={classList:{toggle:(name,value)=>{
  if(value)classes.add(name);else classes.delete(name);
 }}};
 const context={root,lastAudio:audio,screen,activeModule:module,$:name=>{
  assert.equal(name,'v6MiniPlayer');return mini;
 }};
 vm.runInNewContext(source+'\nthis.chrome=chrome',context,
  {filename:'vetogram-universe-chrome.js',timeout:1000});
 return {chrome:context.chrome,mini,classes,context};
}

test('host player remains visible while Music itself is open',()=>{
 const h=harness({audio:{title:'Own track',playing:true}});
 h.chrome();
 assert.equal(h.mini.hidden,false);
 assert.equal(h.classes.has('v6-has-audio'),true);
 assert.equal(h.classes.has('v6-module-open'),true);
});

test('the same player persists when navigating from Music into Chats',()=>{
 const h=harness({audio:{title:'Own track',playing:true},screen:'telegram',module:'music'});
 h.chrome();
 assert.equal(h.mini.hidden,false);
 assert.equal(h.classes.has('v6-has-audio'),true);
 assert.equal(h.classes.has('v6-module-open'),false);
});

test('no empty player or artificial content offset when nothing is playing',()=>{
 const h=harness();
 h.chrome();
 assert.equal(h.mini.hidden,true);
 assert.equal(h.classes.has('v6-has-audio'),false);
});

test('embedded Music hides only child player chrome, standalone retains its controls',()=>{
 assert.match(embedded,/html\.v6-embedded \.player-bar\{display:none!important\}/);
 assert.doesNotMatch(embedded,/^\.player-bar\{display:none!important\}/m);
 assert.match(read('music-module.html'),/id="miniPlay"/);
 assert.match(bridge,/data\.command==='toggle'\)document\.getElementById\('miniPlay'\)\?\.click\(\)/);
 assert.match(bridge,/data\.command==='previous'\)document\.getElementById\('miniPrev'\)\?\.click\(\)/);
 assert.match(bridge,/data\.command==='next'\)document\.getElementById\('miniNext'\)\?\.click\(\)/);
});

test('host layout reserves one player height above bottom navigation',()=>{
 const css=read('vetogram-universe.css');
 assert.match(css,/\.v6-has-audio\{--v6-player:62px\}/);
 assert.match(css,/\.v6-mini-player\{position:fixed;[^}]*bottom:calc\(var\(--v6-nav\)/);
 assert.match(css,/\.v6-media-stage\{height:calc\(var\(--tg-viewport-stable-height,100dvh\) - var\(--v6-nav\) - var\(--v6-player\)/);
});
