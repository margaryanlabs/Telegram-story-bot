/* Vetogram REBORN RB12: deterministic CSS delivery and release invariants.
 * This suite is source-driven and requires no real Telegram account.
 * Real browser/physical WebView and full Node suite are separate release gates.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const file=path=>new URL('../public/'+path,import.meta.url);
const read=path=>readFileSync(file(path),'utf8');
const html=read('studio.html');
const app=read('app.js');
const bundle=read('vetogram-reborn-ui.css');
const foundation=read('vetogram-reborn-foundation.css');
const noir=read('vetogram-noir.css');
const device=read('veto-device-polish.js');
const sourceNames=['vetogram-reborn-atelier.css','vetogram-reborn-media.css',
  'vetogram-reborn-privacy.css','vetogram-reborn-account.css'];
const inputs=sourceNames.map(read);
const stylesheetLinks=[...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+\.css(?:\?[^"]*)?)"/g)].map(x=>x[1]);

test('RB12 links one CSS bundle after the foundation in the actual studio',()=>{
  assert.ok(stylesheetLinks.at(-1).startsWith('/vetogram-reborn-ui.css?v='));
  assert.ok(stylesheetLinks.some(x=>x.startsWith('/vetogram-reborn-foundation.css?v=')));
  for(const name of sourceNames)
    assert.ok(!stylesheetLinks.some(x=>x.includes('/'+name+'?')),'remove redundant '+name);
  assert.equal(stylesheetLinks.length,32);
});

test('old CSS sources remain versioned and in deterministic cascade order',()=>{
  let last=-1;
  for(let i=0;i<sourceNames.length;i++){
    const name=sourceNames[i];
    const first='/* ===== BEGIN '+name+' ===== */\n';
    const end='\n/* ===== END '+name+' ===== */\n';
    const at=bundle.indexOf(first);
    assert.ok(at>last,'CSS input ordering wrong: '+name);
    assert.ok(bundle.slice(at+first.length,at+first.length+inputs[i].trimEnd().length)===inputs[i].trimEnd(),
      'CSS source modified during bundling: '+name);
    assert.ok(bundle.indexOf(end,at)>at);
    last=at;
  }
  assert.ok(bundle.indexOf('RB12 / release invariants')>last);
});

test('bundler --check compares shipping CSS to all four sources',()=>{
  const script=fileURLToPath(new URL('../scripts/build-reborn-css.mjs',import.meta.url));
  const output=execFileSync(process.execPath,[script,'--check'],{encoding:'utf8',timeout:12000});
  assert.match(output,/RB12 bundle matches all four source files/);
});

test('source CSS is safe for same-directory concatenation and cache versioning',()=>{
  for(const src of inputs){
    assert.doesNotMatch(src,/@import\s/i);
    assert.doesNotMatch(src,/@charset\s/i);
  }
  assert.match(html,/vetogram-reborn-ui\.css\?v=20261105-rb12-01/);
  assert.ok(foundation.length>1500);
});

test('semantic hidden guard prevents accidental display of private controls',()=>{
  assert.match(bundle,/\[hidden\]:not\(\[hidden="until-found"\]\)/);
  for(const id of ['telegramThreadOpenNative','viewerQrImage',
    'viewerCountryPicker','viewerPendingLoginNotice']){
    assert.ok((html+app).includes('id="'+id+'"'),id);
    assert.ok(bundle.includes('#'+id+'[hidden]'),'no specific guard: '+id);
  }
  assert.match(bundle,/display:\s*none\s*!important/);
});

test('sensitive dialogs remain opt-in; source has no fake accounts or QR tokens',()=>{
  assert.match(html,/id="viewerPendingLoginNotice"[^>]*hidden/);
  assert.match(html,/id="telegramThreadOpenNative"[^>]*hidden/);
  assert.match(html,/id="sheet"[^>]*hidden/);
  assert.doesNotMatch(bundle,/content\s*:\s*["'](?:CONNECTED|ONLINE|LIVE|100%)/i);
  assert.doesNotMatch(bundle,/fetch\(|new Audio\(|Telegram\.WebApp\.initData/);
});

test('minimum 44px tap areas on mobile header and native conversation Back',()=>{
  assert.match(bundle,/pointer:\s*coarse/);
  assert.match(bundle,/max-width:\s*600px/);
  assert.match(bundle,/#telegramThreadBack/);
  assert.match(bundle,/min-width:\s*44px\s*!important/);
  assert.match(bundle,/min-height:\s*44px\s*!important/);
  assert.match(html,/id="vetoMessengerToolsToggle"/);
  assert.match(html,/id="telegramMirrorRefresh"/);
});

test('keyboard-aware account sheet uses real visualViewport, not fixed window height',()=>{
  assert.match(bundle,/var\(--veto-visible-height,\s*100dvh\)/);
  assert.match(bundle,/max-height:\s*min\(89dvh,\s*calc/);
  assert.match(noir,/\.veto-keyboard-open body\.veto-sheet-open #sheet/);
  assert.match(noir,/bottom:var\(--veto-visual-bottom,0px\)/);
  assert.match(device,/window\.visualViewport/);
  assert.match(device,/veto-keyboard-open/);
});

test('light themes and accessibility states survive bundled cascade',()=>{
  for(const s of ['data-veto-theme="pearl"','data-veto-theme="linen"',
    'prefers-reduced-motion:reduce','forced-colors:active',':focus-visible'])
    assert.ok(bundle.includes(s),s);
  assert.match(bundle,/--a11-ink/);
  assert.match(bundle,/--p10-ink/);
  assert.match(bundle,/--ma-ink/);
  assert.match(bundle,/--v8-ink/);
});

test('Media and Book iframe documents retain their independent styling',()=>{
  for(const name of ['music-module.html','cinema.html','books.html']){
    const page=read(name);
    assert.ok(page.includes('/vetogram-reborn-modules.css?v=20261105-rb9-01'),name);
  }
  assert.match(bundle,/\.screen\[data-screen="media"\]/);
  assert.match(bundle,/\.screen\[data-screen="profile"\]/);
  assert.match(bundle,/\.screen\[data-screen="privacy"\]/);
});

test('static studio controls have unique IDs so status can target one element',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(new Set(ids).size,ids.length);
  for(const key of ['telegramMirrorList','telegramThreadCompose','v11MiniAppProof',
    'v11PersonalProof','v11BusinessProof','privacyClearButton','v6MediaStage'])
    assert.ok(ids.includes(key),key);
});

test('no broken or unterminated CSS blocks in final output',()=>{
  const clean=bundle.replace(/\/\*[\s\S]*?\*\//g,'')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'""');
  let depth=0;
  for(const ch of clean){
    if(ch==='{')depth++;
    if(ch==='}')depth--;
    assert.ok(depth>=0,'unexpected CSS closing brace');
  }
  assert.equal(depth,0,'unterminated CSS block');
  assert.ok(bundle.length>130000);
});

test('existing four-tab app navigation and keyboard geometry are unmodified',()=>{
  assert.match(html,/data-reborn-nav="four"/);
  assert.match(html,/data-nav="telegram"/);
  assert.match(html,/data-nav="publish"/);
  assert.match(html,/data-nav="media"/);
  assert.match(html,/data-nav="privacy"/);
  assert.match(bundle,/grid-template-columns:\s*repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(device,/veto:screen-changed/);
});
