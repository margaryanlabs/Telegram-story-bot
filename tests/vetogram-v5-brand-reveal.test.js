import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('onboarding shows VETO and main session reveal has silver/coral VETOGRAM',()=>{
 const html=read('public/studio.html');
 const css=read('public/vetogram-brand-reveal.css');
 assert.match(html,/class="veto-welcome-brand"[^>]*><img[^>]*><div><strong>VETO<\/strong>/);
 assert.match(html,/id="vetoBrandReveal" aria-hidden="true" hidden/);
 assert.match(html,/class="veto-brand-reveal-wordmark" aria-label="VETOGRAM"><span>VETO<\/span><em>GRAM<\/em>/);
 assert.match(css,/color:#f0f3f9/);
 assert.match(css,/color:#ff7780/);
});
test('signed personal session triggers one nonblocking reveal; no auth or messaging mutation',()=>{
 const code=read('public/vetogram-brand-reveal.js');
 const app=read('public/app.js');
 assert.doesNotThrow(()=>new Script(code));
 assert.match(code,/addEventListener\('vetogram:telegram-session-connected', reveal\)/);
 assert.match(app,/dispatchEvent\(new CustomEvent\('vetogram:telegram-session-connected'\)\)/);
 assert.match(code,/alreadyPlayed/);
 assert.match(code,/stage\.hidden = true/);
 assert.doesNotMatch(code,/fetch\(|localStorage|Telegram\.WebApp|sendCode|sendMessage|initData/);
});
test('reveal never obstructs onboarding or runs again on second auth event',()=>{
 const code=read('public/vetogram-brand-reveal.js');
 const events={};
 const stage={hidden:true,classList:{add(){},remove(){}}};
 const welcome={hidden:false};
 const doc={hidden:false,getElementById:id=>id==='vetoBrandReveal'?stage:welcome};
 const win={addEventListener:(event,fn)=>events[event]=fn,matchMedia:()=>({matches:true})};
 const context={window:win,document:doc,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame(fn){fn()}};
 runInNewContext(code,context);
 events['vetogram:telegram-session-connected']();
 assert.equal(stage.hidden,true);
 // The owner can finish onboarding; reveal then plays exactly once.
 welcome.hidden=true;
 events['vetogram:telegram-session-connected']();
 assert.equal(stage.hidden,false);
 events['pagehide']();
 assert.equal(stage.hidden,true);
 events['vetogram:telegram-session-connected']();
 assert.equal(stage.hidden,true);
});
test('header only shows canonical V in chrome; actions are still accessible',()=>{
 const html=read('public/studio.html'),css=read('public/vetogram-brand-reveal.css');
 assert.match(html,/class="veto-inbox-signature" aria-hidden="true"><img src="\/veto-telegram-mark\.svg/);
 assert.match(html,/id="vetoMessengerToolsToggle"/);
 assert.match(html,/id="telegramMirrorRefresh"/);
 assert.match(css,/\.vetogram-header \.veto-inbox-title-copy\{\s*display:none!important/);
 assert.match(css,/\.vetogram-header \.veto-messenger-exit\{\s*display:none!important/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
