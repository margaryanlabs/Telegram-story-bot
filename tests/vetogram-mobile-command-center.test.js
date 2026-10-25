import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/vetogram-experience-2026.css',import.meta.url),'utf8');
const mobile=css.slice(css.indexOf('VETOGRAM 3.0 / R4 · mobile editorial layout'));
const finish=readFileSync(new URL('../public/vetogram-finish-2026.css',import.meta.url),'utf8');
test('all six existing premium tools remain available on mobile',()=>{
  const start=source.indexOf('<div class="veto-command-home-grid"');
  const end=source.indexOf('</div>',start);
  assert.ok(start>0&&end>start);
  const entries=source.slice(start,end);
  for(const id of ['privacy','viewers','story-engine','ai','voice','relay']){
    assert.match(entries,new RegExp('data-open-screen="'+id+'"'));
  }
  assert.match(source,/vgx-tools-heading/);
  assert.match(source,/class="vg33-tools-panel"/);
  const hero=source.indexOf('<section class="veto-command-home"');
  const mission=source.indexOf('<section class="vg27-mission"');
  const tools=source.indexOf('<section class="vg33-tools-panel"');
  const resume=source.indexOf('<section class="vg26-resume"');
  assert.ok(hero>=0&&mission>hero&&tools>mission&&resume>tools);
});
test('new product grid supersedes old tool swipe rail without clipping',()=>{
  assert.ok(mobile.length>100);
  assert.match(mobile,/grid-auto-flow:column!important/);
  assert.match(finish,/\.vg33-tools-panel \.veto-command-home-grid/);
  assert.match(finish,/grid-auto-flow:row!important/);
  assert.match(finish,/overflow:visible!important/);
  assert.match(finish,/@media\(max-width:900px\)/);
  assert.match(finish,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(finish,/@media\(max-width:350px\)/);
  assert.match(finish,/grid-template-columns:minmax\(0,1fr\)!important/);
});
test('Story Studio templates are readable and scrollable on phones',()=>{
  assert.match(finish,/\.se-templates \.se-template/);
  assert.match(finish,/flex:0 0 128px!important/);
  assert.match(finish,/scroll-snap-type:x proximity/);
  assert.match(finish,/font-size:12px!important/);
  assert.match(finish,/min-height:45px!important/);
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
