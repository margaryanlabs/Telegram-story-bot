import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Android Telegram header respects native chrome, measured SDK inset and a safe fallback',()=>{
  const css=read('public/vetogram-header.css');
  const device=read('public/veto-device-polish.js');
  const script=read('public/vetogram-header.js');
  assert.ok(css.includes('body.vetogram-in-tg'));
  assert.ok(css.includes('--tg-content-safe-area-inset-top'));
  assert.ok(css.includes('--tg-safe-area-inset-top'));
  assert.ok(css.includes('--vetogram-sdk-content-top'));
  assert.ok(css.includes('--vetogram-sdk-device-top'));
  assert.ok(css.includes('padding-top:var(--vetogram-top)!important'));
  assert.ok(css.includes('46px'));
  assert.ok(script.includes('webApp?.initData'));
  assert.ok(device.includes('contentSafeAreaChanged'));
  assert.ok(device.includes('safeAreaChanged'));
  assert.ok(!css.includes('padding-top:max(56px'));
});

test('mobile header is always compact and gives one-tap access to tools',()=>{
  const html=read('public/studio.html');
  const css=read('public/vetogram-header.css');
  const js=read('public/vetogram-header.js');
  assert.ok(html.includes('veto-mirror-heading vetogram-header'));
  assert.ok(html.includes('veto-telegram-mark.svg'));
  assert.ok(html.includes('id="vetoMessengerToolsToggle"'));
  assert.ok(!html.includes('id="vetogramHeaderToggle"'));
  assert.ok(css.includes('max-height:54px!important'));
  assert.ok(!js.includes('setExpanded('));
  assert.ok(!js.includes("addEventListener('scroll'"));
});
