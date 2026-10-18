import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('chat list starts its independent archive + Business reads without serial blocking MTProto',()=>{
  const api=read('api/telegram-chats.js');
  assert.match(api,/let historyPromise=fastLive\?Promise\.resolve\(\[\]\):archiveThreads\(userId\)/);
  assert.match(api,/const permissionStatePromise=action==='list'/);
  assert.match(api,/const linked=await getViewerSession\(userId\)/);
  assert.ok(api.indexOf('const linked=await getViewerSession(userId)')<
    api.indexOf('const [history,permissionState]=await Promise.all([historyPromise,permissionStatePromise])'));
  assert.ok(api.indexOf('const storedPromise=archivedMessages')<
    api.indexOf('const [stored,history]=await Promise.all([storedPromise,historyPromise])'));
  assert.ok(api.indexOf('withBackupClient(creds.session')<
    api.indexOf('const [history,permissionState]=await Promise.all([historyPromise,permissionStatePromise])'));
  assert.match(api,/verifyTelegramClientOwner\(client,userId\)/);
});

test('verified same-owner refresh keeps visible chats while updating and never leaves mixed stale rows',()=>{
  const ui=read('public/telegram-chats.js');
  assert.match(ui,/const keepVisible=Boolean\(reset&&state\.connectionProof\?\.verified&&state\.chats\.length/);
  assert.match(ui,/state\.ownerInitData===String\(tg\?\.initData\|\|''\)/);
  assert.match(ui,/if\(!keepVisible\)\{state\.chats=\[\];state\.connectionProof=null;\}/);
  assert.match(ui,/if\(keepVisible\)state\.chats=\[\]/);
  assert.match(ui,/error\.httpStatus=response\.status/);
  assert.match(ui,/const transient=status===429\|\|status>=500/);
  assert.match(ui,/if\(keepVisible&&authenticated&&transient\)/);
  assert.match(ui,/state\.chats=\[\];state\.hasMore=false;state\.connectionProof=null/);
  assert.match(ui,/removeAttribute\('aria-busy'\)/);
  assert.doesNotMatch(ui,/localStorage|sessionStorage|indexedDB/);
});

test('jump-to-latest is accessible, bounded to open thread and independent of call functionality',()=>{
  const html=read('public/studio.html'),ui=read('public/telegram-chats.js'),css=read('public/app.css');
  assert.match(html,/id="telegramThreadJumpLatest"/);
  assert.match(html,/aria-label="Перейти к последним сообщениям"/);
  assert.match(ui,/function showLatestShortcut\(\)/);
  assert.match(ui,/state\.messages\.length<9\|\|remaining<160/);
  assert.match(ui,/showLatestShortcut\.frame=requestAnimationFrame/);
  assert.match(ui,/behavior:'smooth'/);
  assert.match(css,/veto-mirror-jump-latest\[hidden\]/);
  assert.match(html,/veto-fast-chat-v1/);
});
