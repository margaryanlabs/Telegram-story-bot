import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const js=read('public/privacy.js');
const a=js.indexOf('  function guardPrivacyOwner(){'),b=js.indexOf('  async function loadTelegramConnection(',a);
assert.ok(a>=0&&b>a);

test('Privacy clears previous Telegram account settings, archived contents, media and permissions',()=>{
  const tg={initData:'signed-B'};
  const privacyState={
    ownerInitData:'signed-A',ownerEpoch:7,loading:true,
    settings:{antiDelete:true,editHistory:true,ghostInbox:true},
    threads:[{chatId:'private-A',messageCount:2}],
    deletedFeed:[{message_id:10}],
    deletedFeedLoaded:true,deletedFeedLoading:true,deletedFeedHasMore:true,
    diagnostics:{saved:true},activeThread:{messages:[{text:'A message'}]},
    smartBrief:{text:'A'},smartSummary:{x:1},lastTotalMessages:90,
    lastRefreshAt:123,query:'A secret',filter:'deleted',
    connection:{live:true,ready:true,loaded:true},
    degraded:true,backup:{stopRequested:false,running:true},
  };
  let mediaCleared=0,sheetClosed=0,renders=0;
  const guard=vm.runInNewContext(js.slice(a,b)+'\nguardPrivacyOwner',{
    tg,privacyState,revokeMediaUrl:()=>mediaCleared++,closeSheet:()=>sheetClosed++,
    render:()=>renders++,
  });
  guard();
  assert.equal(privacyState.ownerEpoch,8);
  assert.equal(privacyState.ownerInitData,'signed-B');
  assert.equal(privacyState.threads.length,0);
  assert.equal(privacyState.deletedFeed.length,0);
  assert.equal(privacyState.activeThread,null);
  assert.equal(privacyState.smartSummary,null);
  assert.equal(privacyState.settings.antiDelete,false);
  assert.equal(privacyState.settings.editHistory,false);
  assert.equal(privacyState.connection.live,false);
  assert.equal(privacyState.lastTotalMessages,0);
  assert.equal(privacyState.backup.stopRequested,true);
  assert.equal(privacyState.degraded,false);
  assert.equal(mediaCleared,1);
  assert.equal(sheetClosed,1);
  assert.equal(renders,1);
  guard();
  assert.equal(mediaCleared,1,'Same owner should never be reset twice');
});

test('Privacy request rejects stale owner responses and cannot retry B with A credentials',async()=>{
  const tg={initData:'signed-A'};
  const privacyState={ownerInitData:'signed-A',ownerEpoch:0};
  let resolveNetwork,requests=0,ownerSwitches=0;
  const fetch=()=>{requests++;return new Promise(resolve=>{resolveNetwork=resolve;});};
  const x=js.indexOf('  async function request(action = null, payload = {}) {');
  const y=js.indexOf('  function threadTotals(',x);
  assert.ok(x>0&&y>x);
  const request=vm.runInNewContext(js.slice(x,y)+'\nrequest',{
    tg,privacyState,fetch,AbortController,setTimeout,clearTimeout,
    guardPrivacyOwner(){
      if(tg.initData===privacyState.ownerInitData)return;
      privacyState.ownerInitData=tg.initData;
      privacyState.ownerEpoch++;ownerSwitches++;
    },
  });
  const future=request('list_messages',{chatId:'555'});
  tg.initData='signed-B';
  resolveNetwork({ok:true,status:200,json:async()=>({ok:true,messages:[{text:'A private note'}]})});
  await assert.rejects(future,/аккаунт изменился/i);
  assert.equal(ownerSwitches,1);
  assert.equal(requests,1,'Must not silently retry old account auth');
});

test('Privacy GET refresh and Telegram connection use the owner epoch before updating UI',()=>{
  assert.ok(js.includes('const epoch=privacyState.ownerEpoch;'));
  assert.ok(js.includes('if(epoch!==privacyState.ownerEpoch)return;'));
  assert.ok(js.includes('owner!==privacyState.ownerInitData'));
  assert.ok(js.includes("window.addEventListener('focus',guardPrivacyOwner)"));
  assert.ok(js.includes("window.addEventListener('pageshow',guardPrivacyOwner)"));
  assert.ok(js.includes('revokeMediaUrl();closeSheet();render();'));
});
