import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const device=source('public/veto-device-polish.js');
const styles=source('public/veto-device-polish.css');
const html=source('public/studio.html');
const stories=source('public/telegram-stories.js');

function viewport(initialHeight=800,visibleHeight=800,focus='BUTTON') {
  const values=new Map();
  const classes=new Map();
  const listeners=new Map();
  const scheduled=[];
  const visualViewport={
    height:visibleHeight,offsetTop:0,scale:1,
    addEventListener(name,callback){listeners.set('visual:'+name,callback);}
  };
  const window={
    innerHeight:initialHeight,visualViewport,Telegram:{WebApp:{onEvent(){}}},
    addEventListener(name,callback){listeners.set('window:'+name,callback);}
  };
  const document={
    activeElement:{matches(selector){return focus==='INPUT'&&selector.includes('input:');}},
    documentElement:{
      style:{setProperty(name,val){values.set(name,val);}},
      classList:{toggle(name,condition){classes.set(name,condition);}}
    },
    addEventListener(name,callback){listeners.set('document:'+name,callback);}
  };
  runInNewContext(device,{window,document,requestAnimationFrame(fn){scheduled.push(fn);return scheduled.length;},setTimeout(fn){scheduled.push(fn);}});
  function pump(event='visual:resize'){listeners.get(event)?.();while(scheduled.length)scheduled.shift()();}
  return {window,document,visualViewport,values,classes,pump};
}

test('Device viewport leaves navigation visible without a keyboard',()=>{
  const v=viewport(800,740,'BUTTON');
  assert.equal(v.values.get('--veto-visible-height'),'740px');
  assert.equal(v.classes.get('veto-keyboard-open'),false);
  assert.equal(v.values.get('--veto-visual-bottom'),'0px');
});

test('Focused Android/iOS input + narrowed visual viewport marks keyboard safely',()=>{
  const v=viewport(800,410,'INPUT');
  assert.equal(v.values.get('--veto-visible-height'),'410px');
  assert.equal(v.values.get('--veto-visual-bottom'),'390px');
  assert.equal(v.classes.get('veto-keyboard-open'),true);
  v.document.activeElement.matches=()=>false;
  v.pump('document:focusin');
  assert.equal(v.classes.get('veto-keyboard-open'),false);
  assert.equal(v.values.get('--veto-visual-bottom'),'0px');
});

test('Accessibility and style guards cover all device classes',()=>{
  assert.doesNotThrow(()=>new Script(device));
  assert.match(html,/viewport-fit=cover/);
  assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
  assert.match(html,/veto-device-polish\.css/);
  assert.match(html,/veto-device-polish\.js/);
  for(const rule of [
    /safe-area-inset-bottom/,/visualViewport/,/veto-keyboard-open/,
    /max-width:365px/,/max-height:570px/,/min-width:768px/,
    /prefers-reduced-motion/,/veto-mirror-thread/,
    /veto-story-viewer/,/veto-welcome-shell/,/sheet/
  ]) {
    assert.match(styles+device,rule);
  }
  assert.doesNotMatch(device,/localStorage|sessionStorage|fetch\(|navigator\.sendBeacon/);
});

test('Story search never replaces the focused input while typing',()=>{
  assert.match(stories,/renderBar\(preserveSearchField=false\)/);
  assert.match(stories,/renderBar\(true\)/);
  assert.match(stories,/previousPeople\.replaceChildren\(\.\.\.freshPeople\.childNodes\)/);
  assert.doesNotMatch(stories,/setSelectionRange\(caret,caret\)/);
});
