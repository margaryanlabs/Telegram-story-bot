import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('switching chats does not inherit a previous pending history load or poll',()=>{
  const ui=read('public/telegram-chats.js');
  const open=ui.slice(ui.indexOf('async function openThread(chat)'),ui.indexOf('async function loadMessages'));
  assert.match(open,/state\.syncRunId\+\+;state\.syncBusy=false/);
  assert.match(open,/state\.threadLoading=false/);
  assert.ok(open.indexOf('state.threadLoading=false')<open.indexOf('loadMessages({reset:true})'));
  const load=ui.slice(ui.indexOf('async function loadMessages'),ui.indexOf('function back()'));
  assert.match(load,/state\.syncRunId\+\+;state\.syncBusy=false/);
  assert.match(load,/generation!==state\.threadGeneration/);
  const poll=ui.slice(ui.indexOf('async function pollThread'),ui.indexOf('function setThread(chat)'));
  assert.match(poll,/const runId=\+\+state\.syncRunId/);
  assert.match(poll,/if\(runId===state\.syncRunId&&generation===state\.threadGeneration&&/);
});

test('late private media responses cannot expose previous owners or different conversations',()=>{
  const ui=read('public/telegram-chats.js');
  for(const section of [
    ui.slice(ui.indexOf('async function openArchivedFile'),ui.indexOf('async function openLiveAttachment')),
    ui.slice(ui.indexOf('async function openLiveAttachment'),ui.indexOf('function visibleMessageAnchor')),
  ]){
    assert.match(section,/ownerKey=state\.ownerInitData,epoch=state\.previewEpoch/);
    assert.match(section,/ownerKey!==String\(tg\?\.initData\|\|''\)/);
    assert.match(section,/epoch!==state\.previewEpoch/);
    assert.match(section,/String\(state\.thread\?\.id\)!==chatId/);
    assert.match(section,/currentAttachmentButton\(button,id,/);
    assert.ok(section.indexOf('const active=currentAttachmentButton(button,id,')<section.indexOf('cacheExpandedAttachment(active,id,blob'));
  }
  assert.match(ui,/state\.syncRunId\+\+;state\.syncBusy=false/);
});

test('message find is scoped to opened loaded history and never hits an API',()=>{
  const ui=read('public/telegram-chats.js');
  const html=read('public/studio.html');
  const css=read('public/app.css');
  const find=ui.slice(ui.indexOf('function loadedSearchMatches'),ui.indexOf('function renderMessages'));
  assert.match(find,/state\.messages\.filter/);
  assert.match(find,/state\.threadSearch\.trim\(\)/);
  assert.match(find,/function searchedText/);
  assert.match(find,/safe\(text\.slice\(at,at\+needle\.length\)\)/);
  assert.doesNotMatch(find, /fetch\(|localStorage|sessionStorage|indexedDB|request\(/);
  assert.match(ui,/closeThreadSearch\(\)/);
  assert.match(ui,/refreshThreadSearch\(\{jump:true\}\)/);
  assert.match(html,/id="telegramThreadFindInput"/);
  assert.match(html,/id="telegramThreadFindPrev"/);
  assert.match(html,/id="telegramThreadFindNext"/);
  assert.match(html,/Только загруженная история/);
  assert.match(css,/veto-mirror-thread-find/);
  assert.match(css,/search-active/);
  assert.match(css,/data-chat-theme="pearl"/);
});
