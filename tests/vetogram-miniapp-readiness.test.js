import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the real function, with only its Telegram/network/database dependencies mocked.
const source=readFileSync(new URL('../api/miniapp.js',import.meta.url),'utf8');
const begin=source.indexOf('async function refreshConnection(');
const end=source.indexOf('\nfunction setNoStore(',begin);
assert.ok(begin>0&&end>begin);
function connectionFunction(deps){
  return vm.runInNewContext('('+source.slice(begin,end).trim()+')',vm.createContext(deps));
}
const existing={bc:'business-A',canStories:true,canReadMessages:true};
test('Telegram API outage must keep saved connection but fail closed on live Story rights',async()=>{
  let writes=0;
  const refresh=connectionFunction({
    tg:async()=>{throw Error('network down')},
    saveSettings:async()=>{writes++},
    upsertBusinessConnectionState:async()=>{writes++},
    console:{warn:()=>{}},
  });
  const result=await refresh('fixture-token','111','https://example.org',existing);
  assert.equal(result.degraded,true);
  assert.equal(result.live,false);
  assert.equal(result.rights,false);
  assert.equal(result.readRights,false);
  assert.equal(result.settings.bc,'business-A');
  assert.equal(result.settings.canStories,true); // cached, but *not* trusted for publish
  assert.equal(writes,0); // do not erase/delete valid persisted data on outage
});
test('fresh verified Telegram connection confirms Story rights and owner permissions',async()=>{
  let updates=0;
  const refresh=connectionFunction({
    tg:async()=>({id:'business-A',is_enabled:true,
      rights:{can_manage_stories:true,can_read_messages:false}}),
    saveSettings:async()=>{updates++},
    upsertBusinessConnectionState:async()=>{updates++},
    console:{warn:()=>{}},
  });
  const result=await refresh('fixture-token','111','https://example.org',existing);
  assert.equal(result.live,true);
  assert.equal(result.rights,true);
  assert.equal(result.readRights,false);
  assert.equal(result.degraded,undefined);
  assert.equal(updates,2);
});
test('disabled Telegram Business connection is cleared after confirmed negative response',async()=>{
  let saved;
  const refresh=connectionFunction({
    tg:async()=>({id:'business-A',is_enabled:false,rights:null}),
    saveSettings:async(_token,_owner,_url,state)=>{saved=state},
    upsertBusinessConnectionState:async()=>{},
    console:{warn:()=>{}},
  });
  const result=await refresh('fixture-token','111','https://example.org',existing);
  assert.equal(result.live,false);
  assert.equal(result.rights,false);
  assert.equal(result.settings.bc,null);
  assert.equal(saved.bc,null);
});
