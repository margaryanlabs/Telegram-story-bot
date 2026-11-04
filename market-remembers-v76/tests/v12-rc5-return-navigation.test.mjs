import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext,Script} from 'node:vm';

const root=new URL('../',import.meta.url);
const load=path=>readFile(new URL(path,root),'utf8');
const [navigation,bridge,reader]=await Promise.all([
  load('v10/navigation.js'),load('v10/living-universe.js'),
  load('v10/story-experience.js')
]);

function makeRouter(initial='#archive?theme=Risk&q=BTC'){
  const calls=[];
  const listeners={};
  const location={hash:initial,href:'https://preview.invalid/'+initial};
  const entries=[{hash:initial,state:null}];let cursor=0;
  const mutate=(hash,state,replace)=>{
    if(replace)entries[cursor]={hash,state};
    else{entries.splice(cursor+1);entries.push({hash,state});cursor++;}
    location.hash=hash;location.href='https://preview.invalid/'+hash;
  };
  const history={
    get state(){return entries[cursor].state},
    pushState(state,title,hash){mutate(hash,state,false)},
    replaceState(state,title,hash){mutate(hash,state,true)},
    back(){
      if(cursor<=0)return;
      cursor--;
      location.hash=entries[cursor].hash;
      location.href='https://preview.invalid/'+location.hash;
      listeners.popstate?.();
    }
  };
  const stories=[{id:'alpha',alias:'ALPHA'},{id:'bravo',alias:'BRAVO'}];
  const api={
    stories,
    active:view=>calls.push('active:'+view),
    cancel:()=>calls.push('cancel'),
    close:()=>calls.push('close'),
    modal:()=>calls.push('modal'),
    focus:i=>calls.push('focus:'+i),
    archiveState:params=>calls.push('query:'+params.get('theme')+'/'+params.get('q')),
    archive:()=>calls.push('archive'),
    story:record=>calls.push('story:'+record.id),
    toast:message=>calls.push('toast:'+message),
    create:()=>calls.push('create'),
    legacy:()=>calls.push('legacy')
  };
  const context={window:{MarketV10:{},addEventListener:(name,listener)=>listeners[name]=listener},
    location,history,URLSearchParams,encodeURIComponent,decodeURIComponent};
  runInNewContext(navigation,context);
  const router=context.window.MarketV10.navigation(api);
  router.start();
  return {router,calls,location,history,entries};
}

test('RC5 navigation module parses and provides a safe previous-view interface',()=>{
  assert.doesNotThrow(()=>new Script(navigation));
  assert.match(navigation,/function previousView\(\)/);
  assert.match(navigation,/return \{read,visit,dismiss,previousView,/);
});
test('Closing a story entered from archive restores exact search and filter URL',()=>{
  const m=makeRouter();
  assert.equal(m.location.hash,'#archive?theme=Risk&q=BTC');
  m.router.visit('story',{id:'alpha'});
  assert.equal(m.location.hash,'#story/alpha');
  assert.equal(m.router.previousView(),'archive');
  m.calls.length=0;
  m.router.dismiss();
  assert.equal(m.location.hash,'#archive?theme=Risk&q=BTC');
  assert.ok(m.calls.includes('archive'));
  assert.ok(m.calls.includes('query:Risk/BTC'));
  assert.equal(m.calls.filter(c=>c==='archive').length,1);
});
test('Closing a connected story returns to its preceding star',()=>{
  const m=makeRouter('#story/alpha');
  m.router.visit('story',{id:'bravo'});
  assert.equal(m.router.previousView(),'story');
  assert.equal(m.location.hash,'#story/bravo');
  m.calls.length=0;
  m.router.dismiss();
  assert.equal(m.location.hash,'#story/alpha');
  assert.ok(m.calls.includes('story:alpha'));
  assert.ok(!m.calls.includes('archive'));
});
test('Direct shared story links do not invent a previous archive or story',()=>{
  const direct=makeRouter('#story/alpha');
  assert.equal(direct.router.previousView(),null);
  const universal=makeRouter('#universe');
  universal.router.visit('story',{id:'alpha'});
  assert.equal(universal.router.previousView(),'universe');
  const invalid=makeRouter('#universe');
  invalid.history.replaceState({tmrV10:true,prior:{view:'archive'}},'','#story/alpha');
  assert.equal(invalid.router.previousView(),null);
});
test('Reader controls and V12 wrapper route according to the actual origin',()=>{
  assert.match(bridge,/previousView:\(\)=>router\?\.previousView\(\)\|\|null/);
  assert.match(bridge,/previous==='archive'\|\|previous==='story'/);
  assert.match(bridge,/if\(returnToContent\)router\.dismiss\(\)/);
  assert.match(bridge,/api\.base\.closeDrawer\(returnToContent\?true:skipReturn\)/);
  assert.match(bridge,/if\(!returnToContent\)target\?\.focus/);
  assert.match(bridge,/else router\.visit\('universe',\{star:starId\},true\)/);
  assert.match(reader,/prior==='archive'\?'← К результатам архива'/);
  assert.match(reader,/prior==='story'\?'← К предыдущей звезде'/);
  assert.match(reader,/actions\.append\(returnButton\)/);
});
test('Wrapped story entry establishes navigation before return-label rendering',()=>{
  const start=bridge.indexOf('showStory(record) {');
  const end=bridge.indexOf('showArchive() {',start);
  assert.ok(start>=0&&end>start,'story wrapper exists');
  const block=bridge.slice(start,end);
  const route=block.indexOf("router.visit('story',{id:String(record.id)})");
  const mount=block.indexOf('V.reader.mount(record,shared)');
  assert.ok(route>=0&&mount>route,'route is set before reader decides return caption');
});
test('Navigation changes no private stories or storage protocols',()=>{
  assert.doesNotMatch(navigation,/localStorage|sessionStorage|fetch\(|XMLHttpRequest|sendBeacon/);
  assert.doesNotMatch(bridge,/history\.go\(-\d+\)|location\.assign/);
});
