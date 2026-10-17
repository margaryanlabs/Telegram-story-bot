import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dialogPageBounds} from '../api/telegram-chats.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('dialog pagination returns 24 real chats first, then 50 with no gaps and never over 500',()=>{
  const first=dialogPageBounds(0);
  assert.deepEqual(first,{start:0,count:24,totalToFetch:25});
  assert.deepEqual(dialogPageBounds(1),{start:24,count:50,totalToFetch:75});
  const seen=new Set();
  for(let page=0;page<=10;page++){
    const {start,count,totalToFetch}=dialogPageBounds(page);
    assert.ok(count>=1&&count<=50&&totalToFetch<=500);
    assert.equal(totalToFetch>=start+count,true);
    for(let i=start;i<start+count;i++){
      assert.equal(seen.has(i),false,'duplicate chat index '+i);
      seen.add(i);
    }
  }
  assert.equal(seen.size,500);
  assert.equal(dialogPageBounds(10).count,26);
  for(const wrong of [-1,11,1.5,NaN])assert.throws(()=>dialogPageBounds(wrong));
});

test('open chat searches last 80 dialogs before the bounded 500-dialog fallback',()=>{
  const api=read('api/telegram-chats.js');
  assert.ok(api.includes('const FAST_THREAD_DIALOGS=80;'));
  assert.ok(api.includes('getDialogs({limit:FAST_THREAD_DIALOGS})'));
  assert.ok(api.includes('getDialogs({limit:MAX_DIALOGS})'));
  assert.ok(api.includes('if(!dialog){'));
  assert.ok(api.includes('verifyTelegramClientOwner(client,userId)'));
  assert.ok(api.includes('Promise.all(['));
  assert.ok(api.includes('getViewerSession(userId).catch(()=>null)'));
  assert.ok(!api.includes('client.sendMessage('));
  assert.ok(!api.includes('client.readHistory('));
});

test('private chat list shows immediate skeleton, loaded account progress and owner-only stale data',()=>{
  const js=read('public/telegram-chats.js'),html=read('public/studio.html');
  assert.ok(js.includes('function chatSkeleton()'));
  assert.ok(js.includes('aria-hidden="true"'));
  assert.ok(js.includes('const keepWhileRefreshing='));
  assert.ok(js.includes('if(reset)state.chats=[]'));
  assert.ok(js.includes('state.stale=true;'));
  assert.ok(js.includes('state.stale=false;'));
  assert.ok(js.includes('state.ownerInitData'));
  assert.ok(js.includes('accessFailure=[401,403,409]'));
  assert.ok(js.includes('не LIVE'));
  assert.ok(!js.includes('localStorage'));
  assert.ok(!js.includes('sessionStorage'));
  assert.ok(html.includes('id="telegramMirrorSyncMetric"'));
  assert.ok(html.includes('id="telegramMirrorSavedMetric"'));
  assert.ok(html.includes('id="telegramMirrorUnreadMetric"'));
  assert.ok(html.includes('id="telegramMirrorProgress"'));
  assert.ok(html.includes('PRIVATE MIRROR'));
});

test('UI uses viewport-bound auto pagination rather than eagerly preloading 500 chats',()=>{
  const js=read('public/telegram-chats.js'),html=read('public/studio.html');
  assert.ok(js.includes('IntersectionObserver'));
  assert.ok(js.includes("rootMargin:'180px 0px'"));
  assert.ok(js.includes('state.autoPages>=2'));
  assert.ok(js.includes("current==='telegram'"));
  assert.ok(js.includes("state.page<11"));
  assert.ok(js.includes("'telegramThreadBottomJump'"));
  assert.ok(html.includes('id="telegramThreadBottomJump"'));
  assert.ok(html.includes('v=20261017-veto-chat-speed-v3-merged'));
  const css=read('public/app.css');
  assert.ok(css.includes('.veto-mirror-skeleton'));
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
  assert.ok(css.includes('.veto-mirror-metrics'));
  assert.ok(css.includes('.veto-mirror-access-center.connected'));
});
