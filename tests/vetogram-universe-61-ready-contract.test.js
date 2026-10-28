/* Real embedded media bridge: a loaded document is not an initialized module. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const bridge=readFileSync(new URL('../public/vetogram-media-bridge.js',import.meta.url),'utf8');
function fixture(pathname,controllers={},failed=false,embedded=true){
 const emitted=[],parent={postMessage:message=>emitted.push(message)},events=new Map();
 const window={
  VetogramMediaContext:{embedded,scope:'owner-7'},VetogramModuleError:failed,
  ...controllers,
  addEventListener:(name,callback)=>events.set(name,callback)
 };
 const document={
  getElementById:()=>null,querySelectorAll:()=>[],addEventListener(){},
  documentElement:{dataset:{}},body:{classList:{toggle(){}}}
 };
 vm.runInNewContext(bridge,{window,document,parent,location:{pathname,origin:'https://vetogram.test'},
  setTimeout:()=>1,clearTimeout(){}});
 return emitted;
}
const ready=(messages)=>messages.filter(x=>x.type==='ready').length;
const failed=(messages)=>messages.filter(x=>x.type==='failed').length;

test('Music, Cinema and Books each report ready only with their own real controller',()=>{
 const good=[
  ['/music-module.html',{VetogramMusic:{showPage(){},now(){return null},getLibrary(){return []}}}],
  ['/cinema.html',{VetogramCinema:{openTab(){},getLibrary(){return []}}}],
  ['/books.html',{VetogramBooks:{openSavedByKey(){return true}}}]
 ];
 for(const [path,controller] of good){
  const messages=fixture(path,controller);
  assert.equal(ready(messages),1,'ready: '+path);
  assert.equal(failed(messages),0,'not failed: '+path);
 }
});
test('broken module script cannot masquerade as a ready iframe',()=>{
 for(const path of ['/music-module.html','/cinema.html','/books.html']){
  const messages=fixture(path);
  assert.equal(ready(messages),0,'not ready: '+path);
  assert.equal(failed(messages),1,'failed: '+path);
 }
});
test('a same-name non-function object and an unexpected path are never ready',()=>{
 assert.equal(ready(fixture('/cinema.html',{VetogramCinema:{openTab:true}})),0);
 assert.equal(failed(fixture('/cinema.html',{VetogramCinema:{openTab:true}})),1);
 assert.equal(ready(fixture('/random-rewrite.html',{VetogramBooks:{openSavedByKey(){}}})),0);
});
test('script runtime errors and nonembedded contexts cannot emit ready',()=>{
 const music={VetogramMusic:{showPage(){},now(){return null}}};
 assert.equal(failed(fixture('/music-module.html',music,true)),1);
 assert.equal(ready(fixture('/music-module.html',music,true)),0);
 assert.equal(fixture('/music-module.html',music,false,false).length,0);
});
