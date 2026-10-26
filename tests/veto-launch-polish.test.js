import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('public/studio.html');
const css=read('public/veto-launch-polish.css');
const js=read('public/veto-launch-polish.js');

test('Launch polish is installed on existing real Telegram Mini App as final cosmetic layer',()=>{
  assert.ok(html.includes('id="telegramMirrorList"'));
  assert.ok(html.includes('id="telegramThreadComposer"'));
  assert.ok(html.includes('id="telegramThreadSend"'));
  assert.ok(html.includes('id="vetoWelcome"'));
  assert.match(html,/veto-launch-polish\.css\?v=\d{8}-[a-z0-9-]+/);
  assert.match(html,/veto-launch-polish\.js\?v=\d{8}-[a-z0-9-]+/);
  assert.ok(html.indexOf('veto-launch-polish.css')>html.indexOf('veto-messenger-rebirth.css'));
  assert.ok(html.indexOf('veto-launch-polish.js')>html.indexOf('brand-pack.js'));
});

test('VETO hero keeps true canonical mark and clarity-first tagline',()=>{
  assert.match(html,/veto-inbox-signature" aria-hidden="true"><img src="\/veto-telegram-mark\.svg/);
  // The logo and uppercase wordmark replace the oversized tagline in chat chrome.
  assert.ok(html.includes('class="veto-inbox-wordmark"'));
  assert.ok(html.includes('class="veto-inbox-signature"'));
  for(const cls of [
    '.veto-mirror-heading::before','.veto-inbox-tagline','.veto-mirror-chat',
    '.veto-story-ring','.veto-mirror-bubble.outgoing','.veto-mirror-send-button',
    '.veto-mirror-empty','.veto-mirror-search-wrap:focus-within',
    '.veto-welcome-shell','.veto-command-home','.bottom-nav .nav-item.active'
  ])assert.ok(css.includes(cls),cls);
});

test('Motion respects input methods, screen sizes, safety and accessible reduced-motion',()=>{
  assert.doesNotThrow(()=>new Script(js));
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/@media\(hover:none\)/);
  assert.match(css,/@media\(max-width:370px\)/);
  assert.match(js,/prefers-reduced-motion: reduce/);
  assert.match(js,/pointer: fine/);
  assert.match(js,/requestAnimationFrame/);
  assert.match(js,/MutationObserver/);
  assert.match(js,/\.slice\(0,8\)/);
  assert.match(js,/observer\.disconnect\(\)/);
  assert.match(js,/animationend/);
  assert.doesNotMatch(js,/fetch\(|localStorage|sessionStorage|indexedDB|sendBeacon|innerHTML|postMessage|Telegram\./);
  assert.doesNotMatch(css,/@import|url\(/);
});

test('Reduced motion registers no animation listeners or observers',()=>{
  let pointerEvents=0,observers=0;
  const list={querySelectorAll(){return []}};
  const header={addEventListener(){pointerEvents++}};
  const doc={querySelector(){return header},getElementById(){return list}};
  const w={matchMedia(q){return {matches:q.includes('prefers-reduced-motion')}},MutationObserver:class{constructor(){observers++}}};
  runInNewContext(js,{document:doc,window:w});
  assert.equal(pointerEvents,0);
  assert.equal(observers,0);
});

test('Fine-pointer ambient light updates only CSS variables and not account data',()=>{
  const props=new Map(),events={};
  const row={style:{setProperty(){}},classList:{add(){},remove(){}},addEventListener(){}};
  const list={querySelectorAll(){return [row]}};
  const header={
    style:{setProperty(name,value){props.set(name,value)}},
    addEventListener(name,callback){events[name]=callback},
    getBoundingClientRect(){return {left:0,top:0,width:200,height:100}}
  };
  const doc={querySelector(){return header},getElementById(){return list}};
  const w={
    matchMedia(q){return {matches:q.includes('pointer: fine')}},
    requestAnimationFrame(fn){fn();return 1;},
    MutationObserver:class{observe(){} disconnect(){}}
  };
  runInNewContext(js,{document:doc,window:w});
  assert.equal(typeof events.pointermove,'function');
  events.pointermove({clientX:150,clientY:75});
  assert.equal(props.get('--veto-light-x'),'6.0px');
  assert.equal(props.get('--veto-light-y'),'4.0px');
  events.pointerleave();
  assert.equal(props.get('--veto-light-x'),'0px');
});
