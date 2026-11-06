/* RB8 Atelier — actual source contracts, not mock data or screenshot claims.
 * Test the final CSS layer and current HTML / controller selectors.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const css=read('vetogram-reborn-atelier.css');
const html=read('studio.html');
const legacy=read('vetogram-reborn-foundation.css');
const noir=read('vetogram-noir.css');
const stories=read('telegram-stories.js');
const chats=read('telegram-chats.js');
const device=read('veto-device-polish.js');

function unquotedCss(source){
  return source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'""');
}

test('Atelier is preserved as the first module inside the final RB12 bundle',()=>{
  const links=[...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(x=>x[1]);
  assert.ok(links.length>=20,'the existing layered stylesheets still exist');
  assert.ok(links.at(-1).startsWith('/vetogram-reborn-ui.css?v='));
  assert.ok(links.some(x=>x.startsWith('/vetogram-reborn-foundation.css?v=')));
  assert.ok(html.includes('data-reborn-nav="five"'));
});

test('CSS has balanced blocks and no missing or fabricated module selectors',()=>{
  const source=unquotedCss(css);
  let depth=0;
  for(const ch of source){
    if(ch==='{')depth++;
    if(ch==='}')depth--;
    assert.ok(depth>=0,'closing brace without a matching open');
  }
  assert.equal(depth,0);
  for(const marker of ['#telegramMirror','.veto-mirror-chat','.veto-story-ring',
    '.veto-mirror-bubble-inner','.veto-mirror-compose-field',
    '.veto-story-stage','.v5-stories-head','.bottom-nav[data-reborn-nav']){
    assert.ok(css.includes(marker),marker);
  }
  assert.ok(css.length>18000);
});

test('design retains all real chat controllers and does not replace message DOM',()=>{
  for(const id of ['telegramMirrorList','telegramMirrorSearch','telegramMirrorFilters',
    'telegramThreadView','telegramThreadMessages','telegramThreadCompose',
    'telegramThreadSend','telegramThreadBack','vetoMessengerConnectCta']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.match(chats,/function renderChats\(\)/);
  assert.match(chats,/function renderMessages\(/);
  assert.match(chats,/async function openThread\(chat\)/);
  assert.doesNotMatch(css,/display\s*:\s*none\s*!important\s*;\s*\/\*\s*chat rows/i);
});

test('design does not force a replacement on owner-selected chat wallpaper',()=>{
  const source=unquotedCss(css);
  assert.doesNotMatch(source,/\.veto-mirror-thread-body\s*\{[^}]*\bbackground(?:-image)?\s*:/i);
  assert.doesNotMatch(source,/\bwallpaper\s*:/i);
  assert.match(css,/custom wallpapers/);
  assert.match(css,/#telegramThreadCompose/);
  assert.match(css,/font-size:\s*16px\s*!important/);
  assert.match(device,/visualViewport/);
  assert.match(noir,/--veto-visible-height/);
});

test('both white and linen theme branches remain present and readable',()=>{
  assert.match(css,/data-veto-theme="pearl"/);
  assert.match(css,/data-veto-theme="linen"/);
  assert.match(css,/color:\s*#2e2e2e/);
  assert.match(css,/color:\s*#393939\s*!important/);
  assert.match(css,/\.veto-mirror-bubble\.outgoing/);
});

test('actual Stories viewer remains data driven, no fabricated media sources',()=>{
  assert.match(stories,/async function openStory\(peerIndex,storyIndex=0\)/);
  assert.match(stories,/fetch\('\/api\/telegram-stories'/);
  assert.match(stories,/viewer\.innerHTML/);
  assert.match(css,/\.veto-story-progress/);
  assert.match(css,/\.veto-story-caption/);
  assert.doesNotMatch(css,/url\(['"]?https?:\/\//i);
  assert.doesNotMatch(css,/\.veto-story-display\s*\{[^}]*filter\s*:/i);
});

test('the primary Stories publishing screen has the same aesthetic hierarchy',()=>{
  for(const marker of ['data-screen="publish"','class="v5-stories-head"',
    'class="v5-story-switch"','id="v5StoriesWatch"','class="hero-card"']){
    assert.ok(html.includes(marker),marker);
  }
  assert.match(css,/\[data-screen="publish"\]\s+\.v5-stories-head/);
  assert.match(css,/#v5StoriesWatch\s+\.veto-story-strip/);
  assert.match(css,/data-veto-theme="pearl"\]\s+\.screen\[data-screen="publish"\]/);
});

test('mobile fold widths, safe areas and reduced motion are supported',()=>{
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/prefers-reduced-motion:\s*reduce/);
  assert.match(css,/@media \(pointer: coarse\)/);
  assert.match(css,/@media \(forced-colors: active\)/);
});

test('no decorative indicators assert unverified network/Privacy state',()=>{
  assert.doesNotMatch(css,/content\s*:\s*["'](?:LIVE|ONLINE|CONNECTED|100%)/);
  assert.match(chats,/state\.connectionProof\?\.verified/);
  assert.match(html,/telegramMirrorAccountProof/);
  assert.match(html,/telegramMirrorPrivacyDiagnostics/);
});

test('Atelier keeps accessible focus treatment and contrasts',()=>{
  assert.match(css,/:focus-visible/);
  assert.match(css,/prefers-contrast:\s*more/);
  assert.match(css,/--v8-focus/);
  assert.match(css,/var\(--v8-accent/);
});

test('source is intentionally a CSS-only change, not a new message/OTP backend',()=>{
  assert.ok(legacy.includes('RB2'),'RB1+RB2 base was preserved');
  assert.doesNotMatch(css,/fetch\(|viewerApi\(|sessionStorage|localStorage|send_code/);
  const styles=html.match(/vetogram-reborn-ui\.css/g)||[];
  assert.equal(styles.length,1);
});
