import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const script=readFileSync(new URL('../public/relay-sw.js',import.meta.url),'utf8');
const origin='https://veto.example';
const okResponse=value=>({
  ok:true,value,clone(){return okResponse(value);}
});
function harness({online=true}={}){
  const listeners={},stored=new Map(),deleted=[],requests=[];
  const awaiting=[];
  const cache={
    addAll:async urls=>{for(const url of urls)stored.set(origin+url,okResponse('precache:'+url));},
    match:async request=>stored.get(request.url),
    put:async(request,response)=>{stored.set(request.url,response);}
  };
  const caches={
    open:async()=>cache,
    keys:async()=>['veto-relay-shell-v1','unrelated-cache','veto-relay-shell-v411-20261026'],
    delete:async key=>{deleted.push(key);return true;}
  };
  const worker={
    addEventListener:(type,fn)=>{listeners[type]=fn;},
    skipWaiting:async()=>{},
    clients:{claim:async()=>{}}
  };
  const fetch=async(request,opts)=>{
    requests.push({url:request.url,opts});
    if(!online)throw Error('NETWORK_OFFLINE');
    return okResponse('network:'+request.url);
  };
  const Response={error:()=>({ok:false,networkError:true})};
  vm.runInNewContext(script,{self:worker,caches,fetch,URL,Response,location:{origin}});
  const event=type=>{
    let promise=null;
    const e={
      waitUntil(p){awaiting.push(Promise.resolve(p))},
      respondWith(p){promise=Promise.resolve(p)}
    };
    return {e,reply:()=>promise};
  };
  const invoke=async path=>{
    const ev=event('fetch');
    ev.e.request={url:origin+path,method:'GET'};
    listeners.fetch(ev.e);
    const promise=ev.reply();
    const response=promise?await promise:null;
    await Promise.all(awaiting.splice(0));
    return response;
  };
  return{invoke,listeners,stored,deleted,requests,event,cache};
}
test('Relay service worker is scoped to Relay assets, never VETOGRAM chat or API',async()=>{
  const x=harness();
  for(const url of ['/studio.html','/app.js?v=old','/vetogram-ai.js?v=new',
                    '/api/viewer-sync','/api/vetogram-ai']){
    assert.equal(await x.invoke(url),null,url);
    assert.equal(x.requests.length,0);
  }
});
test('online Relay JS is network-first, not stale Cache Storage',async()=>{
  const x=harness();
  const path='/relay-bootstrap.js?v=20261026-v411-relay';
  x.stored.set(origin+path,okResponse('old-cache'));
  const response=await x.invoke(path);
  assert.equal(response.value,'network:'+origin+path);
  assert.equal(x.stored.get(origin+path).value,'network:'+origin+path);
  assert.equal(x.requests.length,1);
  assert.equal(x.requests[0].opts.cache,'no-store');
});
test('offline Relay respects exact asset version, never ignoreSearch',async()=>{
  const x=harness({online:false});
  const old='/relay-bootstrap.css?v=20261007-v1';
  const current='/relay-bootstrap.css?v=20261026-v411-relay';
  x.stored.set(origin+old,okResponse('old-version'));
  assert.equal((await x.invoke(current)).networkError,true);
  x.stored.set(origin+current,okResponse('current-version'));
  assert.equal((await x.invoke(current)).value,'current-version');
});
test('activation deletes only old VETO Relay caches, not unrelated caches',async()=>{
  const x=harness();
  const e=x.event('activate');
  x.listeners.activate(e.e);
  await Promise.all([]);
  // waitUntil callbacks can resolve in a microtask; assert after draining queue
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(x.deleted,['veto-relay-shell-v1']);
});
test('new offline precache has exactly the versioned Relay HTML dependencies',async()=>{
  const x=harness();
  const e=x.event('install');
  x.listeners.install(e.e);
  await new Promise(resolve=>setImmediate(resolve));
  for(const entry of ['/relay.html','/relay-bootstrap.css?v=20261026-v411-relay',
                       '/relay-bootstrap.js?v=20261026-v411-relay',
                       '/veto-telegram-mark.svg']){
    assert.equal(x.stored.has(origin+entry),true,entry);
  }
});
test('Relay page versions, SW precache and updateViaCache match',()=>{
  const html=readFileSync(new URL('../public/relay.html',import.meta.url),'utf8');
  const boot=readFileSync(new URL('../public/relay-bootstrap.js',import.meta.url),'utf8');
  assert.match(html,/\/relay-bootstrap\.css\?v=20261026-v411-relay/);
  assert.match(html,/\/relay-bootstrap\.js\?v=20261026-v411-relay/);
  assert.match(boot,/updateViaCache:'none'/);
  assert.doesNotMatch(script,/ignoreSearch\s*:\s*true/);
  assert.doesNotMatch(script,/keys\.filter\(key\s*=>\s*key\s*!==\s*CACHE_NAME\)/);
});
