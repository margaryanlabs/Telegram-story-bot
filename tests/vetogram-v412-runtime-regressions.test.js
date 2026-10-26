import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('live dialogs explicitly clear archive-only identity',()=>{
  const api=source('api/telegram-chats.js');
  assert.match(api,/previewFromArchive:false,archiveOnly:false/);
  assert.match(api,/chat\.archiveOnly!==true && SENDABLE_TYPES\.includes\(chat\.type\)/);
});
test('previously archived rows reprobe Telegram under verified owner',()=>{
  const chat=source('public/telegram-chats.js');
  assert.match(chat,/recheckArchivedLive=fastLive&&state\.thread\.archiveOnly===true/);
  assert.match(chat,/archiveOnly:Boolean\(state\.thread\.archiveOnly&&!recheckArchivedLive\)/);
  assert.match(chat,/archiveOnly:false,serverCanSend:data\.canSend===true/);
  assert.match(chat,/state\.connectionProof\?\.verified/);
});
test('timed-out history displays a recoverable failure not false empty state',()=>{
  const chat=source('public/telegram-chats.js');
  assert.match(chat,/threadLoadError=String\(error\?\.message/);
  assert.match(chat,/История пока недоступна/);
  assert.match(chat,/Нажми ↻ для повторной проверки/);
});
test('Story viewer gives a manual retry without faking viewed state',()=>{
  const stories=source('public/telegram-stories.js');
  assert.match(stories,/data-veto-story-retry/);
  assert.match(stories,/openStory\(state\.activePeer,state\.activeStory\)/);
  assert.match(stories,/state\.seen\.add\(String\(person\.userId\)/);
});
test('Telegram safe-area updates use max not additive 56px guess',()=>{
  const header=source('public/vetogram-header.css');
  const device=source('public/veto-device-polish.js');
  const noir=source('public/vetogram-noir.css');
  assert.doesNotMatch(header,/max\(56px/);
  assert.match(header,/--vetogram-top:max\(/);
  assert.match(device,/contentSafeAreaChanged/);
  assert.match(device,/safeAreaChanged/);
  assert.match(noir,/height:calc\(100dvh - var\(--vetogram-top,0px\)\)/);
});
test('real Studio remains available as a primary Stories choice',()=>{
  const html=source('public/studio.html');
  assert.match(html,/v4-story-entry/);
  assert.match(html,/data-open-screen="story-engine"/);
  assert.match(html,/data-se-mode="pro"/);
  assert.match(html,/v4-veto-brain/);
});
test('cached shell assets are versioned for V4.12',()=>{
  const html=source('public/studio.html');
  assert.match(html,/20261026-v412-runtime-ui/);
  assert.doesNotMatch(html,/20261026-v411-reborn-release/);
});
