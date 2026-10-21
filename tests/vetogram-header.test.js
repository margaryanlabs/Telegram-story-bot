import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, runInNewContext } from 'node:vm';

const read = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html = read('public/studio.html');
const css = read('public/vetogram-header.css');
const js = read('public/vetogram-header.js');

test('Vetogram keeps the canonical red/silver split-V identity in its real inbox',()=>{
  assert.match(html, /<title>Vetogram/);
  assert.match(html, /class="veto-inbox-wordmark">VETOGRAM/);
  assert.match(html, /class="veto-mirror-heading vetogram-header"/);
  assert.match(html, /veto-telegram-mark\.svg\?v=20261019-brand-v2/);
  assert.doesNotMatch(html, /VETO Telegram|StoryLab|Buy Veta/i);
});

test('the final stylesheet and accessible controller are wired AFTER existing cosmetics',()=>{
  assert.match(html, /id="vetogramHeaderToggle"[^>]+aria-controls="vetogramHeaderActions"[^>]+aria-expanded="false"/);
  assert.ok(html.indexOf('vetogram-header.css')>html.indexOf('veto-launch-polish.css'));
  assert.ok(html.indexOf('vetogram-header.js')>html.indexOf('veto-launch-polish.js'));
  assert.match(css, /\.vetogram-header\.is-expanded/);
  assert.match(css, /position:sticky/);
  assert.match(css, /@media\(max-width:360px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(js,/fetch\(|localStorage|sessionStorage|indexedDB|sendBeacon/);
  assert.doesNotThrow(()=>new Script(js));
});

test('header toggle works for taps and auto-collapses on scroll without touching conversations',()=>{
  const attrs={};const listeners={};const classes=new Set();const winListeners={};
  const heading={classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name)}}};
  const button={
    setAttribute(name,value){attrs[name]=value},
    addEventListener(name,handler){listeners[name]=handler},
    title:''
  };
  const body={classList:{contains(name){return name==='veto-chat-active'}}};
  const doc={
    querySelector(selector){return selector==='#telegramMirror .vetogram-header'?heading:null},
    getElementById(id){return id==='vetogramHeaderToggle'?button:null},
    body
  };
  const win={
    scrollY:0,
    requestAnimationFrame(fn){fn();return 1},
    addEventListener(name,handler){winListeners[name]=handler}
  };
  runInNewContext(js,{document:doc,window:win});
  assert.equal(attrs['aria-expanded'],'false');
  listeners.click();
  assert.equal(attrs['aria-expanded'],'true');
  assert.ok(classes.has('is-expanded'));
  win.scrollY=120;
  winListeners.scroll();
  assert.equal(attrs['aria-expanded'],'false');
  assert.ok(!classes.has('is-expanded'));
  listeners.click();
  listeners.click();
  assert.equal(attrs['aria-expanded'],'false');
});
