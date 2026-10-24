import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const html=read('studio.html');
const css=read('vetogram-finish-2026.css');
const device=read('veto-device-polish.js');
const layout=read('veto-global-ui.css');

test('3.5 keeps the real conversation, message list, safe composer and voice actions',()=>{
  for(const id of ['telegramThreadView','telegramThreadMessages','telegramThreadComposer',
    'telegramThreadCompose','telegramThreadSend','telegramThreadRecordVoice',
    'telegramThreadVoicePreview','telegramThreadVoiceSend','telegramThreadAttachmentChip',
    'telegramThreadReplyPreview','telegramThreadJumpLatest','telegramThreadSearchToggle'])
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  assert.match(css,/VETOGRAM 3\.5 \/ flagship conversations/);
  assert.match(css,/#telegramMirror \.veto-mirror-thread-bar/);
  assert.match(css,/#telegramMirror \.veto-mirror-bubble-inner p/);
});

test('mobile chat header shows ALL real actions without clipping on narrow phones',()=>{
  const media=css.slice(css.indexOf('@media(max-width:660px)'));
  assert.ok(media.length>1800);
  assert.match(media,/\.veto-mirror-thread-bar\{\s*display:flex;flex-wrap:wrap/);
  assert.match(media,/\.veto-mirror-thread-person\{\s*flex:1 1 calc\(100% - 100px\)/);
  assert.match(media,/> \.veto-mirror-icon-btn:not\(\.veto-mirror-back\)/);
  assert.match(media,/> \[hidden\]\{display:none!important\}/);
  for(const id of ['telegramThreadRefresh','telegramThreadSearchToggle','telegramThreadReplyAI',
    'telegramThreadBriefAI','telegramThreadOpenNative'])
    assert.match(html,new RegExp('id="'+id+'"'));
});

test('input and attachment controls remain usable on 320px phones',()=>{
  const phone=css.slice(css.indexOf('@media(max-width:410px)'));
  assert.match(phone,/\.veto-mirror-thread-footer\{\s*display:flex;flex-wrap:wrap/);
  assert.match(phone,/\.veto-mirror-compose-toolbar\{\s*display:flex;width:100%/);
  assert.match(phone,/\.veto-mirror-composer\{\s*display:flex;flex:1 1 100%;width:100%/);
  assert.match(phone,/\.veto-mirror-compose-field textarea\{\s*font-size:16px!important/);
  assert.match(css,/\.veto-mirror-send-button:disabled/);
  assert.match(html,/id="telegramThreadSend"[^>]*disabled/);
});

test('keyboard geometry comes from actual visualViewport, not a guessed bottom inset',()=>{
  assert.match(device,/window\.visualViewport/);
  assert.match(device,/root\.classList\.toggle\('veto-keyboard-open',keyboard\)/);
  assert.match(layout,/var\(--veto-visible-height,100dvh\)/);
  const keyboard=css.slice(css.indexOf('Allow Android/iOS keyboard'));
  assert.match(keyboard,/html\.veto-keyboard-open body\.veto-chat-thread \.app-shell/);
  assert.match(keyboard,/min-height:0!important/);
  assert.match(keyboard,/height:var\(--veto-visible-height,100dvh\)!important/);
  assert.match(keyboard,/padding-bottom:0!important/);
  assert.match(keyboard,/\.veto-mirror-thread-body\{\s*min-height:0!important;flex:1 1 auto/);
  assert.doesNotMatch(keyboard,/window\.innerHeight|setTimeout\(/);
});

test('voice, reply and stickers animate only actual visible states, never fake messages',()=>{
  assert.match(css,/\.veto-mirror-voice-preview:not\(\[hidden\]\)/);
  assert.match(css,/\.veto-mirror-voice-status:not\(\[hidden\]\)/);
  assert.match(css,/\.veto-mirror-sticker-drawer:not\(\[hidden\]\)/);
  assert.match(css,/\.veto-mirror-reply-preview,\.veto-mirror-attachment-chip\):not\(\[hidden\]\)/);
  assert.match(css,/\.veto-mirror-voice-actions \[data-voice-send\]:not\(:disabled\)/);
  const extra=css.slice(css.indexOf('VETOGRAM 3.5 / flagship conversations'));
  assert.doesNotMatch(extra,/\bfetch\s*\(|sendMessage\s*\(|localStorage|setInterval/);
  assert.doesNotMatch(extra,/\.veto-mirror-bubble\s*\{[^}]*animation:/);
});

test('all finish CSS blocks balance and keyboard/mobile has accessible motion fallback',()=>{
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
  const extra=css.slice(css.indexOf('VETOGRAM 3.5 / flagship conversations'));
  assert.match(extra,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(extra,/@media\(max-width:660px\)/);
  assert.match(extra,/@media\(max-width:410px\)/);
  assert.match(extra,/:focus-visible/);
  assert.match(extra,/@media\(max-height:440px\)/);
});


test('Telegram send flags indicate accepted-not-read and mobile controls remain 44px',()=>{
  const chat=read('telegram-chats.js');
  assert.match(chat,/message\.pending\?'<span class="veto-mirror-send-pending">/);
  assert.match(chat,/message\.sent\?'<span class="veto-mirror-send-accepted"/);
  assert.match(chat,/статус прочтения неизвестен/);
  assert.match(css,/\.veto-mirror-send-pending\{/);
  assert.match(css,/\.veto-mirror-send-accepted\{/);
  assert.match(css,/\.veto-mirror-open-vault\{/);
  const extra=css.slice(css.indexOf('Stronger than the legacy narrow-chat 32px icon rule'));
  assert.match(extra,/\.veto-mirror-back\{\s*min-width:44px;width:44px;height:44px/);
  assert.match(extra,/> \.veto-mirror-icon-btn:not\(\.veto-mirror-back\)/);
  assert.match(extra,/min-width:44px;width:44px;height:44px/);
});
