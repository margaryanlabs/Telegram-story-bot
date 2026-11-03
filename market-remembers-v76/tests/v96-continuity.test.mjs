import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js);

function extract(name){
 const start=js.indexOf('function '+name+'(');
 assert.ok(start>=0,'Missing '+name);
 const brace=js.indexOf('{',start);let depth=0;
 for(let i=brace;i<js.length;i++){
  if(js[i]==='{')depth++;
  if(js[i]==='}'&&--depth===0)return js.slice(start,i+1);
 }
 throw Error('Unbalanced '+name);
}
const run=(name,context={})=>runInNewContext('('+extract(name)+')',context);

function controls(){
 const element=(name)=>({
  name,isConnected:true,focused:0,hidden:false,dataset:{},attrs:{},
  focus(){this.focused++},
  setAttribute(k,v){this.attrs[k]=v},
  closest(){return null},
  getAttribute(){return null}
 });
 const e={dockOpen:element('dock'),openSelected:element('desktop'),
  focusMode:element('focus'),cancelDive:element('skip'),memoryDive:element('overlay')};
 return e;
}
function scene(){
 const e=controls();
 const c={w:390,immersive:false,diveIndex:0,diveSequence:7,diveTimer:23,
  flightFinish:1400,targetZoom:1.65,v93PassagePausedAt:0,v96ReaderArrival:false,
  v9State:{phase:'flight',started:100,index:0,token:7,energy:.5},
  document:{activeElement:e.cancelDive,hidden:false},
  stories:[{alias:'FIRST'},{alias:'SECOND'}],
  $:key=>e[key],clearTimeout(){this.cleared=true},
  showStory(story){this.opened=story.alias;this.arrivalDuringOpen=this.v96ReaderArrival}};
 c.cancelDive=run('cancelDive',c);
 c.finishDive=run('finishDive',c);
 return {c,e};
}
test('completed passage does not send focus to hidden SKIP or dock',()=>{
 const {c,e}=scene();
 c.diveIndex=1;c.diveSequence=7;
 c.finishDive(7);
 assert.equal(c.opened,'SECOND');
 assert.equal(c.arrivalDuringOpen,true);
 assert.equal(c.v96ReaderArrival,false);
 assert.equal(e.cancelDive.focused,0);
 assert.equal(e.dockOpen.focused,0);
 assert.equal(e.memoryDive.hidden,true);
});
test('stale passage token cannot open an obsolete story',()=>{
 const {c}=scene();
 c.finishDive(6);
 assert.equal(c.opened,undefined);
 assert.equal(c.diveIndex,0);
});
test('Escape cancellation still restores focus to the visible dock',()=>{
 const {c,e}=scene();
 c.cancelDive();
 assert.equal(e.dockOpen.focused,1);
 assert.equal(e.memoryDive.hidden,true);
 assert.equal(c.diveIndex,-1);
});
test('reader selects a safe dock focus instead of the hidden SKIP control',()=>{
 const e=controls();const c={w:390,immersive:false,$:key=>e[key]};
 const fn=run('v96ReaderReturnTarget',c);
 assert.equal(fn(e.cancelDive),e.dockOpen);
 assert.equal(fn(null),e.dockOpen);
});
test('reader returns focus to connected, visible markers',()=>{
 const e=controls();const c={w:390,immersive:false,$:key=>e[key]};
 const fn=run('v96ReaderReturnTarget',c);
 const marker={isConnected:true,focus(){},closest(){return null},getAttribute(){return null}};
 assert.equal(fn(marker),marker);
});
test('reader never restores focus into a removed archive card or hidden subtree',()=>{
 const e=controls();const c={w:390,immersive:false,$:key=>e[key]};
 const fn=run('v96ReaderReturnTarget',c);
 const marker={isConnected:false,focus(){},closest(){return null},getAttribute(){return null}};
 assert.equal(fn(marker),e.dockOpen);
 marker.isConnected=true;marker.closest=()=>({});
 assert.equal(fn(marker),e.dockOpen);
});
test('FOCUS mode returns to its visible scene control',()=>{
 const e=controls();const c={w:390,immersive:true,$:key=>e[key]};
 assert.equal(run('v96ReaderReturnTarget',c)(e.cancelDive),e.focusMode);
});
test('reader close and back buttons pass no raw click event as navigation flags',()=>{
 assert.match(js,/\$\('closeDrawer'\)\.onclick=\$\('scrim'\)\.onclick=\(\)=>closeDrawer\(\)/);
 assert.equal((js.match(/\$\('memoryBack'\)\.onclick=\(\)=>closeDrawer\(\)/g)||[]).length,2);
 assert.match(extract('closeDrawer'),/skipReturn!==true/);
 assert.match(extract('closeDrawer'),/v762RestoreStar\(\)/);
});
test('passage arrival is subtle and respects reduced motion',()=>{
 assert.match(js,/if\(v96ReaderArrival\)open\.classList\.add\('v96-reader-arrival'\)/);
 assert.match(html,/\.drawer\.v96-reader-arrival\.memory-detail \.memory-experience/);
 assert.match(html,/@media\(prefers-reduced-motion:reduce\)\{\s*\.obsidian \.drawer\.v96-reader-arrival/);
 assert.match(html,/id="dockAlias" aria-live="polite" aria-atomic="true"/);
});
