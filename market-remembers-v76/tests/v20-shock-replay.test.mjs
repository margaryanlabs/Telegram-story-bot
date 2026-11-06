import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const replayCode=read('v10/shock-replay-2008.js');
const modes=read('v10/market-history-modes.js');
const css=read('v10/v20-shock-replay.css');
const html=read('index.html');

class ElementStub {
  constructor(){this.listeners={};this.innerHTML='';this.dataset={};this.selected=null;}
  addEventListener(type,fn){this.listeners[type]=fn;}
  removeEventListener(type,fn){if(this.listeners[type]===fn)delete this.listeners[type];}
  querySelector(){return {focus(){},scrollIntoView(){}};}
  closest(selector){return selector===this.selected?this:{dataset:{}}.missing;}
}
function fixture(){
  const clock=new Map();
  let nextId=1;
  let visibility=()=>{};
  const document={
    hidden:false,
    addEventListener(type,fn){if(type==='visibilitychange')visibility=fn;}
  };
  const window={
    setTimeout(fn,ms){const id=nextId++;clock.set(id,{fn,ms});return id;},
    clearTimeout(id){clock.delete(id);}
  };
  new Script(replayCode).runInNewContext({document,window,Element:ElementStub});
  const host=new ElementStub();
  window.MarketShockReplay2008.mount(host);
  const click=(action,type='action')=>{
    const button=new ElementStub();
    const selector=type==='stage'?'[data-mh-replay-index]':'[data-mh-replay-action]';
    button.selected=selector;
    if(type==='stage')button.dataset.mhReplayIndex=String(action);
    else button.dataset.mhReplayAction=action;
    host.listeners.click({target:button,stopPropagation(){}});
  };
  return {document,window,host,clock,click,visibility:()=>visibility()};
}

test('V20.2 replay has six dated sourced events, with no synthetic market series',()=>{
  const f=fixture();
  const stages=f.window.MarketShockReplay2008.stages;
  assert.equal(stages.length,6);
  assert.deepEqual(Array.from(stages,s=>s.iso),[
    '2008-09-07','2008-09-15','2008-09-16','2008-09-16','2008-09-19','2008-10-03'
  ]);
  for(const stage of stages) {
    assert.ok(stage.source);
    assert.match(stage.url,/^https:\/\/(?:www\.)?(?:fraser\.stlouisfed\.org|fdic\.gov|govinfo\.gov)\//);
  }
  assert.match(f.host.innerHTML,/ДОКУМЕНТИРОВАННЫЙ ФАКТ/);
  assert.match(f.host.innerHTML,/РЕДАКЦИОННОЕ ОБЪЯСНЕНИЕ/);
  assert.match(f.host.innerHTML,/aria-valuenow="1"/);
  assert.match(f.host.innerHTML,/data-mh-replay-index="5"/);
  assert.doesNotMatch(replayCode,/localStorage|XMLHttpRequest|fetch\(|Math\.random\(|sendBeacon/);
  assert.equal(f.clock.size,0,'Never autoplay on mount');
});

test('V20.2 replay controls move through real archive stages and cleanup timers',()=>{
  const f=fixture();
  const api=f.window.MarketShockReplay2008;
  f.click('next'); assert.equal(api.state.index,1);
  f.click('prev'); assert.equal(api.state.index,0);
  f.click(3,'stage');assert.equal(api.state.index,3);
  f.click('speed');assert.equal(api.state.speed,1.5);
  f.click('toggle');assert.equal(api.state.playing,true);
  assert.equal(f.clock.size,1);
  const scheduled=[...f.clock.values()][0];
  assert.ok(scheduled.ms>=3000&&scheduled.ms<=3300);
  f.clock.delete([...f.clock.keys()][0]);scheduled.fn();
  assert.equal(api.state.index,4);
  assert.equal(api.state.playing,true);
  f.click('toggle');
  assert.equal(api.state.playing,false);assert.equal(f.clock.size,0);
  f.click('toggle');assert.equal(f.clock.size,1);
  f.document.hidden=true;f.visibility();
  assert.equal(api.state.playing,false);assert.equal(f.clock.size,0);
  api.unmount();assert.equal(api.state.mounted,false);
  assert.equal(f.host.listeners.click,undefined);
  assert.equal(f.clock.size,0);
});

test('V20.2 controller lives only in expanded 2008 research and disposes when hidden',()=>{
  assert.match(modes,/event\.id==='2008' \? '<section class="mh-shock-replay-host mh-shock-replay"/);
  assert.match(modes,/window\.MarketShockReplay2008\?\.unmount\(\)/);
  assert.match(modes,/if \(panelExpanded && state\.mode==='events' && event\.id==='2008'\)/);
  assert.match(modes,/window\.MarketShockReplay2008\?\.mount\(panel\.querySelector\('#mhShockReplay2008'\)\)/);
  assert.match(modes,/if \(mode === 'people'\) \{\s*panelExpanded = false;\s*window\.MarketShockReplay2008\?\.unmount\(\)/);
  new Script(modes);
});

test('V20.2 replay assets load in order, respond to mobile and reduced-motion controls',()=>{
  assert.ok(html.indexOf('v10/shock-replay-2008.js')<html.indexOf('v10/market-history-modes.js'));
  assert.ok(html.indexOf('v10/v20-shock-replay.css')>html.indexOf('v10/v20-crisis-atlas.css'));
  assert.match(css,/@media\(max-width:819px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/scroll-snap-type:x proximity/);
  assert.match(css,/\.mh-replay-controls button:focus-visible/);
  assert.match(css,/min-height:45px/);
  let depth=0;
  for(const char of css){if(char==='{')depth++;if(char==='}')depth--;assert.ok(depth>=0);}
  assert.equal(depth,0);
});
