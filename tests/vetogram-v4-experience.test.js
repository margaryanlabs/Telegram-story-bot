/* V4 source-bound safety checks. Not a browser/Telegram E2E test. */
'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,'public',name),'utf8');
const html = read('studio.html');
const script = read('vetogram-experience-v4.js');
const styles = read('vetogram-noir.css');

test('V4 is mounted in the existing real Mini App after legacy navigation', () => {
  assert.match(html, /<script src="\/vetogram-noir\.js[^"]*" defer><\/script>/);
  assert.match(html, /<script src="\/vetogram-experience-v4\.js[^"]*" defer><\/script>/);
  assert.ok(html.indexOf('/vetogram-noir.js') < html.indexOf('/vetogram-experience-v4.js'));
  assert.match(html, /id="seCanvas"/);
  assert.match(html, /id="telegramMirrorList"/);
});

test('V4 controller parses and cannot silently send or publish via its own controls', () => {
  assert.doesNotThrow(() => new vm.Script(script));
  assert.match(script,/const exitFocus =/);
  assert.match(script,/aria-pressed/);
  assert.match(script,/veto:screen-changed/);
  assert.doesNotMatch(script,/\b(fetch|sendMessage|publishStory|requestMedia|localStorage\.setItem)\s*\(/);
});

test('V4 preserves actual node IDs and uses native, accessible disclosures', () => {
  assert.match(script,/body\.append\(content\)/);
  assert.match(script,/document\.createElement\('details'\)/);
  for (const id of ['seEngine','seCanvas','seToolText','privacyBlock',
      'studioAssetEmpty','voiceMicButton','vtaiTasksPanel']) {
    assert.match(html,new RegExp('id="' + id + '"'));
  }
  for (const route of ['home','telegram','publish','privacy','voice','ai','viewers',
      'story-engine','studio']) {
    assert.match(html,new RegExp('data-screen="' + route + '"'));
  }
});

test('V4 includes safe reduced-motion/keyboard semantics and no new stylesheet', () => {
  assert.match(styles,/v4-studio-focus/);
  assert.match(styles,/v4-disclosure/);
  assert.match(styles,/prefers-reduced-motion:reduce/);
  assert.match(script,/event\.key === 'Escape'/);
  assert.match(script,/aria-expanded/);
  assert.doesNotMatch(html,/<link[^>]+href="\/vetogram-experience-v4\.css/);
});

test('V4 chat actions are real owner-scoped message interactions, not simulated chat data',()=>{
  const chat=read('vetogram-chat-experience-v4.js');
  assert.doesNotThrow(()=>new vm.Script(chat));
  assert.match(html,/vetogram-chat-experience-v4\.js/);
  assert.match(chat,/selectedInitData/);
  assert.match(chat,/visibleOwner\(\)/);
  assert.match(chat,/tg\.initData!==selectedInitData/);
  assert.match(chat,/\[data-mirror-message-id\]/);
  assert.match(chat,/\[data-mirror-reply\]/);
  assert.match(chat,/pointerdown/);
  assert.match(chat,/dx>72/);
  assert.match(chat,/aria-keyshortcuts/);
  assert.match(chat,/document\.createElement\('dialog'\)/);
  assert.match(chat,/navigator\.clipboard\.writeText\(text\)/);
  assert.match(chat,/window\.VetoTelegramNavigate\?\.\('privacy'\)/);
  assert.doesNotMatch(chat,/\bfetch\s*\(/);
  assert.doesNotMatch(chat,/\bsendMessage\s*\(/);
  assert.doesNotMatch(chat,/\blocalStorage\s*\./);
});

test('V4 does not nest a duplicate Telegram connection guide',()=>{
  assert.match(script,/byId\('telegramMirrorAccessDrawer'\) \|\| progressive/);
  assert.match(html,/id="telegramMirrorAccessDrawer"/);
  assert.match(styles,/v4-message-actions/);
  assert.match(styles,/se-template-canvas/);
});
