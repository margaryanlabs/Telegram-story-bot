import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('public/studio.html'),app=read('public/app.js'),
  messenger=read('public/telegram-chats.js'),css=read('public/veto-global-ui.css');

test('Messenger is the first-class default screen with exactly five working tabs',()=>{
 assert.match(app,/switchScreen\(requestedScreen \|\| 'telegram'\)/);
 assert.match(app,/telegram:'telegram'/);
 const nav=html.slice(html.indexOf('<nav class="bottom-nav"'),html.indexOf('<div class="action-dock"'));
 assert.deepEqual([...nav.matchAll(/data-nav="([^"]+)"/g)].map(m=>m[1]),
   ['telegram','home','publish','privacy','studio']);
 assert.match(nav,/data-nav="telegram"[^>]*aria-label="Чаты"/);
 assert.match(html,/data-screen="viewers"/);
 assert.match(html,/data-screen="relay"/);
});

test('Welcome has one main task, optional education and correct login handoff',()=>{
 assert.match(html,/Твои переписки/);
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
 assert.match(messenger,/vetoMessengerConnectCta'\)\)\$('vetoMessengerConnectCta'\)\.hidden=ready/);
 assert.match(messenger,/data-veto-messenger-tool/);
 assert.match(messenger,/closeVetoMessengerTools\(\)/);
 assert.match(messenger,/clearIntelSearch\(\{close:true\}\)/);
 assert.match(css,/veto-filter-advanced\{display:none\}/);
 assert.match(css,/data-expanded="true"/);
 assert.match(css,/veto-messenger-tools\[hidden\]/);
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
