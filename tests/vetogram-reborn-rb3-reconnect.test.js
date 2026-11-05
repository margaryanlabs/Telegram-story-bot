/* RB3 reconnect regressions against the shipped scheduleThreadSync function.
 * Offline VM fixtures — no Telegram account, credentials, API calls or timers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const start=source.indexOf('  function stopThreadSync(){');
const end=source.indexOf('  function rememberHotThread(){',start);
assert.ok(start>0&&end>start,'real sync scheduler must be present');
const actualScheduler=source.slice(start,end);

function fixture({loadError='',threadLoading=false,visible=true}={}){
  const state={
    thread:{id:'55',archiveOnly:false},
    ownerInitData:'signed',
    connectionProof:{verified:true},
    threadLoadError:loadError,
    threadLoading,
    syncTimer:null,
  };
  const timers=new Map(),calls=[];
  let nextTimer=0,online=visible;
  const context=vm.createContext({
    state,
    // The actual scheduler also has the complete can-sync recheck.
    maySyncThread:()=>online,
    $:()=>null,
    setTimeout:(callback,ms)=>{
      const id=++nextTimer;
      timers.set(id,{callback,ms});
      return id;
    },
    clearTimeout:id=>timers.delete(id),
    loadMessages:({reset})=>{
      calls.push('history:'+reset);
      state.threadLoadError='';
      return Promise.resolve();
    },
    pollThread:()=>{
      calls.push('poll');
      return Promise.resolve();
    },
  });
  vm.runInContext(actualScheduler,context,{timeout:1000});
  return {
    state,calls,timers,
    schedule:ms=>vm.runInContext('scheduleThreadSync('+ms+')',context),
    setVisible:value=>{online=value;},
    fire:()=>{
      const [id,timer]=timers.entries().next().value||[];
      if(!timer)return;
      timers.delete(id);
      timer.callback();
    },
  };
}

test('normal healthy thread keeps the incremental polling path',()=>{
  const f=fixture();
  f.schedule(1800);
  assert.equal(f.timers.size,1);
  f.fire();
  assert.deepEqual(f.calls,['poll']);
});

test('failed initial Telegram history uses full verified history on reconnect',()=>{
  const f=fixture({loadError:'Временная ошибка Telegram'});
  f.schedule(1800);
  f.fire();
  assert.deepEqual(f.calls,['history:true']);
  assert.equal(f.state.threadLoadError,'');
  f.schedule(26000);
  f.fire();
  assert.deepEqual(f.calls,['history:true','poll']);
});

test('a currently running history request is not duplicated or replaced by a poll',()=>{
  const f=fixture({loadError:'timeout',threadLoading:true});
  f.schedule(1800);
  f.fire();
  assert.deepEqual(f.calls,[]);
});

test('leaving the chat or losing network before timer fires prevents stale calls',()=>{
  const f=fixture({loadError:'timeout'});
  f.schedule(1800);
  f.setVisible(false);
  f.fire();
  assert.deepEqual(f.calls,[]);
});

test('a newer reconnect replaces an old retry timer without duplicate loads',()=>{
  const f=fixture({loadError:'timeout'});
  f.schedule(45000);
  assert.equal(f.timers.size,1);
  f.schedule(1800);
  assert.equal(f.timers.size,1);
  assert.equal([...f.timers.values()][0].ms,1800);
  f.fire();
  assert.deepEqual(f.calls,['history:true']);
});

test('the actual app routes all visible reconnect entry points through the scheduler',()=>{
  assert.match(source,/window\.addEventListener\('online',\(\)=>\{if\(state\.thread\)scheduleThreadSync\(1800\)\}/);
  assert.match(source,/else if\(!resetOwner\(\)\)\{[\s\S]*?if\(state\.thread\)scheduleThreadSync\(2800\)/);
  assert.match(source,/if\(state\.thread\)scheduleThreadSync\(3500\)/);
  assert.match(source,/if\(!authRejected\)scheduleThreadSync\(45000\)/);
  assert.match(source,/function invalidateThreadAuthorization\(\)[\s\S]*?stopThreadSync\(\);cancelActivePoll\(\)/);
});

test('recovery does not bypass existing account and visibility requirements',()=>{
  assert.match(source,/function maySyncThread\(\)\{[\s\S]*?state\.connectionProof\?\.verified/);
  assert.match(source,/!document\.hidden&&navigator\.onLine!==false/);
  assert.match(actualScheduler,/if\(!maySyncThread\(\)\)return;/);
  assert.match(actualScheduler,/if\(state\.threadLoadError\)/);
});
