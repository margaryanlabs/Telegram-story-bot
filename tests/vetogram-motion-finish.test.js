import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL('../public/' + path, import.meta.url),'utf8');
const html = read('studio.html');
const css = read('vetogram-finish-2026.css');

test('VETOGRAM 3.2 finish is wired into the real app after all older styles',()=>{
  const last = html.indexOf('/vetogram-experience-2026.css?');
  const finish = html.indexOf('/vetogram-finish-2026.css?');
  assert.ok(last > 0 && finish > last, 'finish stylesheet must be last');
  assert.ok(finish < html.indexOf('</head>'),'finish CSS must be in head');
  assert.match(html,/<section class="screen active control-home" data-screen="home">/);
  assert.match(css,/\.app-shell\s*>\s*\.screen\.active/);
});

test('motion is intentional, real-state-only and reduced-motion safe',()=>{
  for(const animation of ['vg32-enter','vg32-rise','vg32-checking'])
    assert.match(css,new RegExp('@keyframes\\s+'+animation+'\\b'));
  assert.match(css,/#vg27Mission\s+\[data-status="checking"\]/);
  assert.match(css,/#vg27Mission\s+\[data-status="ready"\]/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/animation:none!important/);
  assert.doesNotMatch(css,/status="connected"\][^\n]*infinite/);
});

test('3.2 navigation does not cover Telegram, inbox, or safe touch areas',()=>{
  assert.match(css,/\.screen\.active:not\(\[data-screen="telegram"\]\)/);
  assert.match(css,/#telegramMirror \.veto-mirror-chat/);
  assert.match(css,/\.bottom-nav \.nav-item/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/@media\(max-width:365px\)/);
  assert.match(css,/html\[data-veto-theme="pearl"\]/);
  assert.match(css,/html\[data-veto-theme="linen"\]/);
  assert.doesNotMatch(css,/\b(fetch|XMLHttpRequest|localStorage|sendMessage)\b/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,'CSS blocks must balance');
});
