import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/vetogram-experience-2026.css',import.meta.url),'utf8');
const mobile=css.slice(css.indexOf('VETOGRAM 3.0 / R4 · mobile editorial layout'));
test('all six existing premium tools remain available on mobile',()=>{
  const start=source.indexOf('<div class="veto-command-home-grid"');
  const end=source.indexOf('</div>',start);
  assert.ok(start>0&&end>start);
  const entries=source.slice(start,end);
  for(const id of ['privacy','viewers','story-engine','ai','voice','relay']){
    assert.match(entries,new RegExp('data-open-screen="'+id+'"'));
  }
  assert.match(source,/vgx-tools-heading/);
  assert.match(source,/Листай вправо/);
});
test('narrow-screen tools use an accessible native scroll rail, never clipped hidden cards',()=>{
  assert.ok(mobile.length>100);
  assert.match(mobile,/grid-auto-flow:column!important/);
  assert.match(mobile,/grid-template-columns:none!important/);
  assert.match(mobile,/overflow-x:auto;overflow-y:hidden/);
  assert.match(mobile,/scroll-snap-type:x proximity/);
  assert.match(mobile,/overscroll-behavior-inline:contain/);
  assert.match(mobile,/scroll-snap-align:start/);
  assert.doesNotMatch(mobile,/\.veto-command-home-grid\s*\{[^}]*display:none/);
});
test('touch interactions, mobile bottom navigation, and reduced motion remain supported',()=>{
  assert.match(mobile,/#telegramMirror \.vg26-inbox-shortcuts button\{/);
  assert.match(mobile,/min-height:44px;white-space:nowrap/);
  assert.match(mobile,/\.bottom-nav \.nav-item\{\s*touch-action:manipulation/);
  assert.match(mobile,/@media\(max-width:340px\)/);
  assert.match(mobile,/@media\(prefers-reduced-motion:reduce\)/);
});
test('dashboard navigation stays owned by existing explicit click handlers',()=>{
  assert.match(source,/id="vetoHomeChatsPrimary" data-open-screen="telegram"/);
  assert.match(source,/id="vetoHomeConnectPrimary"/);
  assert.match(source,/data-nav="telegram"/);
  assert.match(source,/data-nav="privacy"/);
  assert.match(source,/data-nav="publish"/);
  assert.doesNotMatch(mobile,/fetch\(|XMLHttpRequest|sendMessage\(/);
});
