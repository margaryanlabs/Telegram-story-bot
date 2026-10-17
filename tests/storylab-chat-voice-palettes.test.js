import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dialogPageBounds} from '../api/telegram-chats.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('first dialog page is smaller and every chat through 500 remains reachable',()=>{
  assert.deepEqual(dialogPageBounds(0),{start:0,count:24});
  assert.deepEqual(dialogPageBounds(1),{start:24,count:50});
  assert.deepEqual(dialogPageBounds(10),{start:474,count:26});
  const indices=[];
  for(let page=0;page<=10;page++){
    const {start,count}=dialogPageBounds(page);
    for(let i=start;i<start+count;i++)indices.push(i);
  }
  assert.equal(indices.length,500);
  assert.equal(new Set(indices).size,500);
  assert.equal(indices[0],0);
  assert.equal(indices.at(-1),499);
  for(const bad of [-1,11,1.5,NaN])assert.throws(()=>dialogPageBounds(bad));
});

test('composer has explicit voice review, upload, four visual palettes and no calls button',()=>{
  const html=source('public/studio.html');
  for(const id of ['telegramThreadVoicePreview','telegramThreadVoiceSend','telegramThreadVoiceRedo',
    'telegramThreadVoiceCancel','telegramThreadAudioButton','telegramThreadVoiceModes',
    'telegramThreadAudioInput','telegramChatThemes'])
    assert.match(html,new RegExp('id="'+id+'"'));
  for(const theme of ['graphite','pearl','slate','linen'])
    assert.match(html,new RegExp('data-chat-theme-option="'+theme+'"'));
  assert.doesNotMatch(html,/id="telegramThreadCall"/);
  assert.match(html,/chat-themes\.css\?/);
  assert.match(html,/chat-theme\.js\?/);
});

test('recorded voice is locally previewed and only sent on explicit press',()=>{
  const js=source('public/telegram-chats.js');
  assert.match(js,/state\.voiceDraft=\{file,url,origin,duration:/);
  assert.match(js,/telegramThreadVoiceSend.*addEventListener\('click'/);
  assert.match(js,/sendRichOutgoing\('send_media',\{file:draft\.file,kind:'voice'/);
  assert.doesNotMatch(js,/await sendRichOutgoing\('send_media',\{file,kind:'voice'/);
  assert.match(js,/state\.voicePermissionGeneration/);
  assert.match(js,/document\.hidden/);
  assert.match(js,/cancelVoiceCapture\(\)/);
  assert.doesNotMatch(js,/telegramThreadCall/);
});

test('themes reskin the rich composer and provide light-scheme contrast',()=>{
  const css=source('public/chat-themes.css');
  for(const theme of ['pearl','slate','linen'])
    assert.match(css,new RegExp('data-chat-theme="'+theme+'"'));
  assert.match(css,/#telegramMirror\[data-chat-theme\].*veto-mirror-compose-field/);
  assert.match(css,/color-scheme:light/);
  assert.match(css,/prefers-reduced-motion/);
  const themeJs=source('public/chat-theme.js');
  assert.match(themeJs,/localStorage\.setItem\(KEY,theme\)/);
  assert.doesNotMatch(themeJs,/localStorage\.setItem\([^)]*(?:chat|message|auth|token)/i);
});
