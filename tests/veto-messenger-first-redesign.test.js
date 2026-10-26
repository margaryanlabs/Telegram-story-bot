import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('public/studio.html'),app=read('public/app.js'),
  messenger=read('public/telegram-chats.js'),css=read('public/veto-global-ui.css');

test('Messenger is the first-class default screen with four primary working tabs',()=>{
 assert.match(app,/switchScreen\(requestedScreen \|\| 'telegram'\)/);
 assert.match(app,/telegram:'telegram'/);
 const nav=html.slice(html.indexOf('<nav class="bottom-nav"'),html.indexOf('<div class="action-dock"'));
 assert.deepEqual([...nav.matchAll(/data-nav="([^"]+)"/g)].map(m=>m[1]),
   ['telegram','publish','ai','privacy']);
 assert.match(nav,/data-nav="telegram"[^>]*aria-label="Чаты"/);
 assert.match(html,/data-screen="viewers"/);
 assert.match(html,/data-screen="relay"/);
});

test('Welcome has one main task, optional education and correct login handoff',()=>{
 assert.match(html,/<h1 class="v5-welcome-title"><span class="v5-welcome-veto">VETO<\/span>/);
 assert.match(html,/class="veto-brand-reveal-wordmark" aria-label="VETOGRAM"/);
 assert.match(html,/id="vetoWelcomeExplore"/);
 assert.match(html,/id="vetoWelcomeNext"/);
 assert.match(app,/vetoWelcomeStep === 0/);
 assert.match(app,/switchScreen\('telegram'\)/);
 assert.match(app,/connectionHelpSheet\(\)/);
 assert.match(app,/pendingLoginMarkup\(\)/);
 assert.match(app,/viewerApi\('verify_code'/);
 assert.match(app,/viewerApi\('verify_password'/);
 assert.match(app,/\/api\/viewer-qr/);
});

test('VETO command hub preserves original live modules while reducing initial clutter',()=>{
 for(const id of ['vetoCommandAdvanced','vetoHomeChatsPrimary','vetoHomeConnectPrimary',
  'homeTelegramTitle','homeOverallState','activationScore','homeActivityList']){
   assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/<details class="veto-command-advanced"/);
 assert.match(app,/vetoHomeConnectPrimary/);
 assert.match(css,/veto-command-home-grid/);
});

test('Inbox has signed-user connect CTA, bounded tools, filters and source-backed intelligence',()=>{
 for(const id of ['telegramMirrorList','telegramMirrorAccessDrawer',
  'telegramMirrorPrivacyDiagnostics','telegramThreadView','telegramMirrorSearch',
  'vetoMessengerToolsToggle','vetoMessengerTools','vetoMessengerConnectCta',
  'vetoMessengerFiltersToggle','telegramMirrorFilters','vetoMessengerIntelArea',
  'vetoIntelSearchForm','vetoIntelIncludeVault','telegramThreadVoiceModes']){
   assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(messenger,/const ready=state.connectionProof\?\.verified===true/);
 assert.ok(messenger.includes("if($('vetoMessengerConnectCta'))$('vetoMessengerConnectCta').hidden=ready;"));
 assert.match(messenger,/data-veto-messenger-tool/);
 assert.match(messenger,/closeVetoMessengerTools\(\)/);
 assert.match(messenger,/clearIntelSearch\(\{close:true\}\)/);
 assert.match(css,/veto-filter-advanced\{display:none\}/);
 assert.match(css,/data-expanded="true"/);
 assert.match(css,/veto-messenger-tools\[hidden\]/);
});

test('App tabs are visible on inbox but immersive conversations keep their composer',()=>{
 const css=read('public/veto-global-ui.css');
 assert.match(css,/body\.veto-chat-active:not\(\.veto-chat-thread\) \.bottom-nav\{/);
 assert.match(css,/display:grid!important/);
 assert.match(css,/body\.veto-chat-thread \.bottom-nav\{display:none!important\}/);
 assert.match(css,/body\.veto-chat-active:not\(\.veto-chat-thread\) \.app-shell\{/);
 assert.match(css,/padding:0 0 calc\(108px \+ env\(safe-area-inset-bottom\)\)!important/);
 assert.match(css,/body\.veto-chat-thread \.app-shell\{/);
 assert.match(css,/body\.veto-chat-active:not\(\.veto-chat-thread\) \.veto-messenger-exit\{/);
});

test('Single palette changes app and chats, no new private message persistence',()=>{
 const theme=read('public/chat-theme.js');
 assert.match(theme,/document\.documentElement\.dataset\.vetoTheme=theme/);
 assert.match(theme,/root\.dataset\.chatTheme=theme/);
 assert.match(theme,/window\.localStorage\.getItem\(KEY\)/);
 assert.doesNotMatch(messenger,/localStorage|sessionStorage|indexedDB/);
 assert.match(css,/html\[data-veto-theme\]/);
 assert.match(css,/:focus-visible/);
});



test('Account changes and authorization failures restore chat tabs',()=>{
  const messenger=read('public/telegram-chats.js');
  const reset=messenger.slice(messenger.indexOf('function resetOwner()'),messenger.indexOf('function revokeMediaUrls()'));
  assert.ok(reset.includes("window.VetoThemeDock?.('inbox');"));
  const authFailure=messenger.slice(messenger.indexOf('// Authentication and ownership failures'),messenger.indexOf('async function photoRequest('));
  assert.ok(authFailure.includes("window.VetoThemeDock?.('inbox');"));
  assert.ok(authFailure.includes("classList.remove('thread-mode')"));
});
test('The mobile inbox tab bar has legible labels and meaningful tap targets',()=>{
  assert.ok(css.includes('min-height:50px'));
  assert.ok(css.includes('font-size:clamp(10px,2.5vw,11px)'));
  assert.ok(css.includes('body.veto-chat-active:not(.veto-chat-thread) .bottom-nav .nav-item:focus-visible'));
  assert.ok(!css.includes('body.veto-chat-active .bottom-nav{display:none!important}'));
  assert.ok(css.includes('height:var(--veto-visible-height,100dvh)!important'));
  assert.ok(/veto-global-ui\.css\?v=\d{8}-[a-z0-9-]+/.test(html));
});
