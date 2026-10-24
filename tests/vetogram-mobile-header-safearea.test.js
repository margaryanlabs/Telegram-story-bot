import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Telegram Android inbox reserves its own chrome touch-safe area',()=>{
  const css=read('public/vetogram-header.css');
  const script=read('public/vetogram-header.js');
  assert.match(css,/body\.vetogram-in-tg\.veto-chat-active/);
  assert.match(css,/--tg-content-safe-area-inset-top/);
  assert.match(css,/--tg-safe-area-inset-top/);
  assert.match(css,/padding-top:max\(56px/);
  assert.match(script,/Telegram\?\.WebApp\?\.initData/);
});

test('Mobile header starts compact and opens only on user tap',()=>{
  const html=read('public/studio.html');
  const js=read('public/vetogram-header.js');
  assert.match(html,/veto-mirror-heading vetogram-header/);
  assert.match(html,/id="vetogramHeaderToggle"[^>]*aria-expanded="false"/);
  assert.match(js,/setExpanded\(!compactOnPhone\);/);
  assert.doesNotMatch(js,/addEventListener\('scroll'/);
  assert.match(js,/toggle\.addEventListener\('click'/);
});
