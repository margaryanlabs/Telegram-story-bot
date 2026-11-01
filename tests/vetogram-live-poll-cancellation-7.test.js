/* Live Telegram polling lifecycle: exercises the shipping client functions
 * with fake signed-owner transport. No real conversations or external APIs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
function slice(a,b){
 const start=source.indexOf(a),end=source.indexOf(b,start);
 assert.ok(start>0&&end>start,'missing shipping function: '+a);
 return source.slice(start,end);
}
const cancelSource=slice('  function cancelActivePoll(){','  // Both history refresh');
const pollSource=slice('  async function pollThread({manual=false}={}){','  function setThread(');

function fixture({ignoreAbort=false}={}){
 const state={
  thread:{id:'55',archiveOnly:false},
  threadGeneration:4,ownerInitData:'signed',
  syncRunId:7,syncBusy:false,syncAbort:null,syncFailures:0,
  messages:[{id:1,date:'2026-10-31T08:00:00Z',text:'Existing'}],
  lastSyncedAt:null
 };
 let resolveFetch,rejectFetch,networkSignal=null;
 const labels=[],calls=[], scheduled=[];
 let visible=true,renderCount=0;
 const context=vm.createContext({
  state,tg:{initData:'signed'},navigator:{onLine:true},
  resetOwner:()=>false,maySyncThread:()=>visible,
  syncLabel:value=>labels.push(value),
  scheduleThreadSync:ms=>scheduled.push(ms),
  $:()=>({scrollHeight:250,scrollTop:160,clientHeight:100}),
  visibleMessageAnchor:()=>null,renderMessages:()=>{renderCount++},
  rememberHotThread:()=>{},invalidateThreadAuthorization:()=>{},
  two:value=>String(value).padStart(2,'0'),
  fetch:(_url,{signal})=>{
   networkSignal=signal;
   return new Promise((resolve,reject)=>{
    resolveFetch=resolve;rejectFetch=reject;
    if(!ignoreAbort)signal.addEventListener('abort',()=>{
     reject(Object.assign(new Error('cancelled'),{name:'AbortError'}));
    },{once:true});
   });
  },
  AbortController,setTimeout,clearTimeout,
 });
 vm.runInContext(cancelSource+'\n'+pollSource,context,{timeout:1000});
 return {
  state,labels,calls,scheduled,
  start:()=>vm.runInContext('pollThread()',context),
  cancel:()=>vm.runInContext('cancelActivePoll()',context),
  get signal(){return networkSignal},
  respond:messages=>resolveFetch({ok:true,json:async()=>({ok:true,messages})}),
  fail:()=>rejectFetch(new Error('Failed to fetch')),
  setVisible:flag=>{visible=flag;},
  get renderCount(){return renderCount},
 };
}

test('opening another section aborts pending poll transport immediately',async()=>{
 const f=fixture(),pending=f.start();
 assert.equal(f.signal.aborted,false);
 assert.equal(f.state.syncBusy,true);
 f.cancel();
 assert.equal(f.signal.aborted,true);
 assert.equal(f.state.syncAbort,null);
 assert.equal(f.state.syncBusy,false);
 await pending;
 assert.equal(f.scheduled.length,0,'cancelled poll must not reschedule itself');
 assert.ok(f.labels.some(x=>x.includes('Обновление приостановлено')),'cancellation clears the busy status');
});

test('stale response arriving after hide cannot repaint messages or schedule a poll',async()=>{
 const f=fixture({ignoreAbort:true}),pending=f.start();
 const id=f.state.syncRunId;
 f.setVisible(false);f.cancel();
 assert.ok(f.state.syncRunId>id);
 f.respond([{id:999,date:'2026-11-01T08:00:00Z',text:'Old screen'}]);
 await pending;
 assert.deepEqual(f.state.messages.map(m=>m.id),[1]);
 assert.equal(f.renderCount,0);
 assert.equal(f.scheduled.length,0);
});

test('poll from old generation cannot overwrite a newly opened thread',async()=>{
 const f=fixture({ignoreAbort:true}),pending=f.start();
 f.cancel();
 f.state.thread={id:'77',archiveOnly:false};
 f.state.threadGeneration++;
 f.state.messages=[{id:777,text:'Different thread'}];
 f.respond([{id:999,text:'Old thread'}]);
 await pending;
 assert.equal(f.state.thread.id,'77');
 assert.deepEqual(f.state.messages.map(m=>m.id),[777]);
});

test('current verified poll merges a genuinely new message and schedules a subsequent check',async()=>{
 const f=fixture(),pending=f.start();
 f.respond([{id:2,date:'2026-11-01T08:01:00Z',text:'New'}]);
 await pending;
 assert.deepEqual(f.state.messages.map(m=>m.id),[1,2]);
 assert.equal(f.renderCount,1);
 assert.ok(f.scheduled.includes(26000));
 assert.equal(f.state.syncAbort,null);
});

test('chat switching, Back, hidden WebView, offline and owner reset all cancel live polling',()=>{
 for(const pattern of [
  /function resetOwner\(\)[\s\S]*?stopThreadSync\(\);cancelActivePoll\(\)/,
  /function openThread\(chat\)[\s\S]*?stopThreadSync\(\);cancelActivePoll\(\)/,
  /function back\(\)[\s\S]*?stopThreadSync\(\);cancelActivePoll\(\)/,
  /if\(document\.hidden\)\{stopThreadSync\(\);cancelActivePoll\(\);\}/,
  /window\.addEventListener\('offline',[\s\S]*?stopThreadSync\(\);cancelActivePoll\(\)/,
  /window\.addEventListener\('pagehide',[\s\S]*?stopThreadSync\(\);cancelActivePoll\(\)/,
 ])assert.match(source,pattern);
});
