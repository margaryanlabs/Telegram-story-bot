import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('public/veto-messenger-rebirth.css');
const html=read('public/studio.html');
const nav=read('public/veto-global-ui.css');

test('visual rebirth is applied AFTER device polish, preserving mobile behavior',()=>{
  const device=html.indexOf('/veto-device-polish.css?');
  const rebirth=html.indexOf('/veto-messenger-rebirth.css?v=20261019-brand-v2');
  assert.ok(device>0 && rebirth>device, 'premium styles must load last');
  assert.match(html,/veto-device-polish\.js/);
  assert.match(html,/id="telegramThreadComposer"/);
  assert.match(html,/id="telegramMirrorList"/);
});

test('new inbox identity is visible and decorative only',()=>{
  assert.match(html,/class="veto-inbox-signature" aria-hidden="true"/);
  assert.match(html,/class="veto-inbox-title-copy"><span class="veto-inbox-wordmark" aria-label="VETOGRAM"><span>VETO<\/span><i>GRAM/);
  assert.match(css,/\.veto-inbox-signature/);
  assert.match(css,/\.veto-mirror-heading::before/);
});

test('four palettes have distinct backgrounds, surfaces and conversations',()=>{
  for(const name of ['graphite','slate','pearl','linen']){
    assert.ok(css.includes('#telegramMirror[data-chat-theme="'+name+'"]'));
    assert.ok(css.includes('html[data-veto-theme="'+name+'"] body.veto-chat-active'));
    assert.ok(css.includes('html[data-veto-theme="'+name+'"] body.veto-chat-active:not(.veto-chat-thread) .bottom-nav'));
  }
  for(const token of ['--veto-header','--veto-row','--veto-story-glow','--veto-outgoing','--veto-incoming']){
    assert.ok(css.includes(token),token);
  }
  assert.match(css,/linear-gradient\(145deg,#396cdb,#3750ae\)/);
  assert.match(css,/linear-gradient\(145deg,#ff806b/);
});

test('real chats, stories, send and keyboard remain usable and scoped',()=>{
  for(const selector of [
    '#telegramMirror .veto-mirror-chat{',
    '#telegramMirror .veto-mirror-chat-list{',
    '#telegramMirror .veto-story-strip{',
    '#telegramMirror[data-chat-theme] .veto-mirror-bubble.outgoing .veto-mirror-bubble-inner{',
    '#telegramMirror[data-chat-theme] .veto-mirror-compose-field{',
    '#telegramMirror[data-chat-theme] .veto-mirror-send-button{',
    'body.veto-chat-active:not(.veto-chat-thread) .bottom-nav{'
  ])assert.ok(css.includes(selector),selector);
  assert.match(nav,/body\.veto-chat-thread \.bottom-nav\{display:none!important\}/);
  assert.doesNotMatch(css,/localStorage|sessionStorage|indexedDB|fetch\(|@import|url\(/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});