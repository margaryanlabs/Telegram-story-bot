import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=app.indexOf('// Pointer spotlight is purely decorative.');
const end=app.indexOf("window.addEventListener('unhandledrejection'",start);
assert.ok(start>=0 && end>start,'Actual spotlight controller must exist');
const source=app.slice(start,end).trim();

function fixture({fine=true,reduced=false}={}){
  const callbacks={},frames=[],writes=[];
  const window={
    innerWidth:390,innerHeight:800,
    matchMedia(query){return {matches:query.includes('pointer: fine')?fine:reduced}},
    requestAnimationFrame(fn){frames.push(fn)},
    addEventListener(name,fn){callbacks[name]=fn}
  };
  const document={
    visibilityState:'visible',
    body:{style:{setProperty(name,value){writes.push([name,value])}}}
  };
  vm.runInNewContext(source,{window,document});
  return {callbacks,frames,writes,document};
}
test('premium background batches rapid pointer events into a single frame',()=>{
  const f=fixture();
  assert.equal(typeof f.callbacks.pointermove,'function');
  for(let i=0;i<25;i++)f.callbacks.pointermove({clientX:100+i,clientY:120+i});
  assert.equal(f.frames.length,1,'should not schedule 25 visual repaints');
  assert.equal(f.writes.length,0);
  f.frames.shift()();
  assert.deepEqual(f.writes,[['--veto-x','124px'],['--veto-y','144px']]);
  f.callbacks.pointermove({clientX:500,clientY:-15});
  assert.equal(f.frames.length,1);
  f.frames.shift()();
  assert.deepEqual(f.writes.slice(-2),[['--veto-x','390px'],['--veto-y','0px']]);
});
test('mobile touch screens and reduced-motion users get a stable static background',()=>{
  for(const settings of [{fine:false},{fine:true,reduced:true}]){
    const f=fixture(settings);
    assert.equal(f.callbacks.pointermove,undefined);
    assert.equal(f.frames.length,0);
    assert.equal(f.writes.length,0);
  }
  assert.doesNotMatch(source,/addEventListener\(['"]touchmove['"]/);
});
test('hidden WebView does not schedule or commit decorative gradients',()=>{
  const f=fixture();
  f.document.visibilityState='hidden';
  f.callbacks.pointermove({clientX:20,clientY:50});
  assert.equal(f.frames.length,0);
  f.document.visibilityState='visible';
  f.callbacks.pointermove({clientX:70,clientY:80});
  f.document.visibilityState='hidden';
  f.frames.shift()();
  assert.equal(f.writes.length,0);
});
