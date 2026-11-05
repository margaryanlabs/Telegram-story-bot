/* RB7 mobile viewport contracts with the actual shipping geometry observer.
 * Simulates Android/Telegram visualViewport resizing and navigation; no
 * Telegram session, browser storage, message content or network is accessed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(
  new URL('../public/veto-device-polish.js',import.meta.url),'utf8');
const styles=readFileSync(
  new URL('../public/vetogram-noir.css',import.meta.url),'utf8');
const studio=readFileSync(
  new URL('../public/studio.html',import.meta.url),'utf8');

function fixture(){
  const events=new Map(),frames=[],timeouts=[],vars=new Map(),classes=new Map();
  const screen={active:true,classList:{contains:name=>name==='active'&&screen.active}};
  let blurred=0;
  const textarea={
    matches:query=>query.includes('textarea'),
    closest:query=>query==='.screen'?screen:null,
    blur(){blurred++;doc.activeElement=null;},
  };
  const root={
    clientHeight:800,
    style:{setProperty:(name,value)=>vars.set(name,value)},
    classList:{toggle:(name,value)=>classes.set(name,value)},
  };
  const visualViewport={
    height:800,offsetTop:0,scale:1,
    addEventListener:(name,callback)=>events.set('viewport:'+name,callback),
  };
  const doc={
    documentElement:root,
    activeElement:null,
    addEventListener:(name,callback)=>events.set('document:'+name,callback),
  };
  const telegram={
    contentSafeAreaInset:{top:30},safeAreaInset:{top:43},
    onEvent:(name,callback)=>events.set('telegram:'+name,callback),
  };
  const win={
    innerHeight:800,visualViewport,Telegram:{WebApp:telegram},
    addEventListener:(name,callback)=>events.set('window:'+name,callback),
  };
  vm.runInNewContext(source,{
    window:win,document:doc,
    requestAnimationFrame:callback=>{frames.push(callback);return frames.length;},
    setTimeout:callback=>{timeouts.push(callback);return timeouts.length;},
    Math,Number,
  },{timeout:1000});
  const flush=()=>{
    while(frames.length)frames.shift()();
  };
  const emit=(name)=>{events.get(name)?.();flush();};
  return {doc,root,win,screen,textarea,visualViewport,vars,classes,emit,flush,
    get blurred(){return blurred},
    runTimeouts:()=>{while(timeouts.length)timeouts.shift()();flush();}};
}

test('normal visual viewport keeps keyboard state off and uses actual height',()=>{
  const f=fixture();
  assert.equal(f.vars.get('--veto-visible-height'),'800px');
  assert.equal(f.vars.get('--veto-visual-bottom'),'0px');
  assert.equal(f.classes.get('veto-keyboard-open'),false);
  assert.equal(f.vars.get('--vetogram-sdk-content-top'),'30px');
  assert.equal(f.vars.get('--vetogram-sdk-device-top'),'43px');
});

test('focused chat composer and reduced Telegram visualViewport activate keyboard geometry',()=>{
  const f=fixture();
  f.doc.activeElement=f.textarea;
  f.visualViewport.height=490;
  f.emit('viewport:resize');
  assert.equal(f.classes.get('veto-keyboard-open'),true);
  assert.equal(f.vars.get('--veto-visible-height'),'490px');
  assert.equal(f.vars.get('--veto-visual-bottom'),'310px');
});

test('switching from Chats to Stories blurs abandoned input and restores nav',()=>{
  const f=fixture();
  f.doc.activeElement=f.textarea;
  f.visualViewport.height=450;
  f.emit('viewport:resize');
  assert.equal(f.classes.get('veto-keyboard-open'),true);
  f.screen.active=false;
  f.emit('window:veto:screen-changed');
  assert.equal(f.blurred,1);
  assert.equal(f.doc.activeElement,null);
  assert.equal(f.classes.get('veto-keyboard-open'),false);
  assert.equal(f.vars.get('--veto-visual-bottom'),'0px');
});

test('transient address-bar shrink without focused input is not a keyboard',()=>{
  const f=fixture();
  f.visualViewport.height=615;
  f.emit('viewport:resize');
  assert.equal(f.classes.get('veto-keyboard-open'),false);
});

test('pinch zoom does not incorrectly claim the software keyboard is open',()=>{
  const f=fixture();
  f.doc.activeElement=f.textarea;
  f.visualViewport.height=420;
  f.visualViewport.scale=1.4;
  f.emit('viewport:resize');
  assert.equal(f.classes.get('veto-keyboard-open'),false);
});

test('chat CSS keeps visual-height geometry and avoids input zoom on phones',()=>{
  assert.match(styles,/height:var\(--veto-visible-height,100dvh\)!important/);
  assert.match(styles,/#telegramMirror #telegramThreadCompose\{\s*font-size:16px!important/);
  assert.match(styles,/html#vetogram\.vetogram-noir\.veto-keyboard-open body\.veto-chat-thread/);
  assert.match(studio,/id="telegramThreadCompose"[^>]*rows="1"/);
  assert.match(studio,/id="telegramThreadComposer"/);
});
