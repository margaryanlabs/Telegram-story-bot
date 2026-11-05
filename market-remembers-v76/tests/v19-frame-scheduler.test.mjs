import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';

// Exercise the exact production scheduler functions, without pretending
// that this replaces Playwright, WebGL or mobile-device benchmarks.
const globe=readFileSync(new URL('../v10/people-mirror-planet.js',import.meta.url),'utf8');
const start=globe.indexOf('function scheduleIdle(');
const end=globe.indexOf('function setActive(next)',start);
if(start<0||end<start)throw Error('EVENT renderer scheduler boundaries changed');
const source=globe.slice(start,end);
new Script(source);

function harness(){
 const timers=new Map(),raf=[];
 let lastId=0,clears=0;
 const ctx={
  document:{hidden:false},
  requestAnimationFrame:callback=>{raf.push(callback);return ++lastId},
  window:{
   setTimeout:(callback,ms)=>{const id=++lastId;timers.set(id,{callback,ms});return id},
   clearTimeout:id=>{if(timers.delete(id))clears++}
  }
 };
 const api=runInNewContext(
  'let active=true,frame=0,idleTimer=0;\n'+source+
  '\n({scheduleIdle,scheduleNext,request,disable:()=>{active=false},state:()=>({active,frame,idleTimer})})',ctx
 );
 return {api,timers,raf,ctx,get clears(){return clears}};
}
test('EVENT calm state really sleeps instead of spinning requestAnimationFrame',()=>{
 const h=harness();
 h.api.scheduleIdle(82);
 h.api.scheduleIdle(82);
 assert.equal(h.timers.size,1,'only one timer can be outstanding');
 assert.equal(h.raf.length,0,'no requestAnimationFrame while the world is idle');
 const sleep=[...h.timers.values()][0];
 assert.ok(sleep.ms>=82);
 sleep.callback();
 assert.equal(h.raf.length,1,'one frame is requested after waking');
});
test('Touch requests interrupt the idle wait immediately, without double RAF',()=>{
 const h=harness();
 h.api.scheduleIdle(82);
 h.api.request();
 assert.equal(h.timers.size,0,'idle timer is cancelled on interaction');
 assert.equal(h.clears,1);
 assert.equal(h.raf.length,1);
 h.api.request();
 assert.equal(h.raf.length,1,'in-flight RAF is not duplicated');
});
test('Hidden or inactive EVENT world does not allocate new frame work',()=>{
 const h=harness();
 h.ctx.document.hidden=true;
 h.api.scheduleIdle(82);h.api.request();
 assert.equal(h.timers.size,0);
 assert.equal(h.raf.length,0);
 h.ctx.document.hidden=false;
 h.api.disable();
 h.api.scheduleNext(33);h.api.request();
 assert.equal(h.timers.size,0);
 assert.equal(h.raf.length,0);
});
