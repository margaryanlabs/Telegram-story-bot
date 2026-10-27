/* Static guard against iOS/Android keyboard-hidden message composer.
 * Offline Node built-ins only; not a substitute for real phone screenshots.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('public/vetogram-noir.css');
const device=read('public/veto-device-polish.css');
const globalUI=read('public/veto-global-ui.css');
const html=read('public/studio.html');
const finalRule=css.slice(css.lastIndexOf('/* V5.1 mobile conversation quality:'));

test('last cascade layer restores real visual viewport instead of fixed 100dvh',()=>{
  assert.match(finalRule,/body\.veto-chat-thread \.app-shell,[\s\S]*?#telegramMirror,[\s\S]*?\.veto-mirror-thread\{/);
  assert.match(finalRule,/height:var\(--veto-visible-height,100dvh\)!important/);
  assert.match(finalRule,/max-height:var\(--veto-visible-height,100dvh\)!important/);
  assert.match(finalRule,/min-height:0!important/);
  assert.doesNotMatch(finalRule,/height:100dvh!important/);
  assert.match(device,/--veto-visible-height: 100dvh/);
  assert.match(globalUI,/body\.veto-chat-thread \.app-shell/);
});

test('message list stays independently scrollable while mobile keyboard is open',()=>{
  assert.match(finalRule,/\.veto-mirror-thread-body\{[\s\S]*?flex:1 1 auto/);
  assert.match(finalRule,/overflow-y:auto/);
  assert.match(finalRule,/overscroll-behavior-y:contain/);
  assert.match(finalRule,/-webkit-overflow-scrolling:touch/);
});

test('long headers and URLs wrap or truncate without forcing offscreen buttons',()=>{
  assert.match(finalRule,/\.veto-mirror-thread-person[\s\S]*?min-width:0/);
  assert.match(finalRule,/overflow-wrap:anywhere/);
  assert.match(finalRule,/text-overflow:ellipsis/);
  assert.match(finalRule,/#telegramThreadCompose\{[\s\S]*?font-size:16px!important/);
});

test('small screens keep keyboard-independent 40-44px touch targets',()=>{
  assert.match(finalRule,/@media\(max-width:600px\)/);
  assert.match(finalRule,/min-height:40px/);
  assert.match(finalRule,/min-height:44px/);
  assert.match(finalRule,/prefers-reduced-motion:reduce/);
});

test('versioned final stylesheet is loaded last after keyboard device styles',()=>{
  const last=html.lastIndexOf('href="/vetogram-noir.css?v=');
  const earlier=html.lastIndexOf('href="/veto-device-polish.css?v=');
  assert.ok(last>earlier,'this scoped fix must win against older 100dvh override');
});
