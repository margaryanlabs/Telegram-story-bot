import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Run the production function unchanged, with deterministic IndexedDB events.
// This is a contract and failure-mode test, not an actual WebView storage test.
const music=readFileSync(new URL('../public/vetogram-music.js',import.meta.url),'utf8');
const begin=music.indexOf('function openDb(){');
const end=music.indexOf('function saveDb(record)',begin);
assert.ok(begin>0&&end>begin);
const code=music.slice(begin,end)+'\nthis.openDb=openDb;';

function harness(factory=null){
 const timeouts=new Map();let seq=0;
 const indexedDB=factory===null?undefined:{open:factory};
 const context={
  window:factory===null?{}:{indexedDB},
  indexedDB,
  DB_NAME:'vetogram-test',
  STORE:'music',
  setTimeout(fn){const id=++seq;timeouts.set(id,fn);return id;},
  clearTimeout(id){timeouts.delete(id);}
 };
 vm.runInNewContext(code,context,{filename:'vetogram-music-idb-extract.js',timeout:1000});
 return {
  open:()=>context.openDb(),
  expire(){for(const fn of [...timeouts.values()])fn();},
  get pendingTimers(){return timeouts.size;}
 };
}

test('missing IndexedDB degrades without blocking the music module',async()=>{
 const db=harness();
 assert.equal(await db.open(),null);
});

test('successful storage open clears the watchdog and returns its DB',async()=>{
 let request;
 const db=harness(()=>{request={};return request;});
 const promise=db.open();
 const handle={close(){}};
 request.result=handle;
 request.onsuccess();
 assert.equal(await promise,handle);
 assert.equal(db.pendingTimers,0);
});

test('storage open timeout rejects and allows saved music to recover gracefully',async()=>{
 let request;
 const db=harness(()=>{request={};return request;});
 const promise=db.open();
 db.expire();
 await assert.rejects(promise,/timed out/);
});

test('late successful IDB open after timeout closes the abandoned handle',async()=>{
 let request,closed=false;
 const db=harness(()=>{request={};return request;});
 const promise=db.open();
 db.expire();
 await assert.rejects(promise,/timed out/);
 request.result={close(){closed=true;}};
 request.onsuccess();
 assert.equal(closed,true);
});

test('blocked storage rejects promptly and leaves no dangling timeout',async()=>{
 let request;
 const db=harness(()=>{request={};return request;});
 const promise=db.open();
 request.onblocked();
 await assert.rejects(promise,/blocked/);
 assert.equal(db.pendingTimers,0);
});
