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
  const app={dataset:{}};
  const beacon={dataset:{},setAttribute(){},removeAttribute(){}};
  const document={
    hidden:false,
    getElementById(id){return id==='app'?app:null;},
    querySelector(selector){return selector.includes('data-mh-beacon="2008"')?beacon:null;},
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
  return {document,window,host,app,beacon,clock,click,visibility:()=>visibility()};
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
  assert.equal(f.app.dataset.mhReplayStep,'1');
  assert.equal(f.beacon.dataset.mhReplayStage,'07 СЕН');
});

test('V20.2 replay controls move through real archive stages and cleanup timers',()=>{
  const f=fixture();
  const api=f.window.MarketShockReplay2008;
  f.click('next'); assert.equal(api.state.index,1);
  f.click('prev'); assert.equal(api.state.index,0);
  f.click(3,'stage');assert.equal(api.state.index,3);
  f.click('speed');assert.equal(api.state.speed,1.5);
  f.click('toggle');assert.equal(api.state.playing,true);
  assert.equal(f.app.dataset.mhReplayPlaying,'true');
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
  assert.equal(f.app.dataset.mhReplayStep,undefined);
  assert.equal(f.beacon.dataset.mhReplayStage,undefined);
  assert.equal(f.host.listeners.click,undefined);
  assert.equal(f.clock.size,0);
});

test('V20.2 controller lives only in expanded 2008 research and disposes when hidden',()=>{
  assert.match(modes,/event\.id==='2008' \? '<section class="mh-shock-replay-host mh-shock-replay"/);
  assert.match(modes,/window\.MarketShockReplay2008\?\.unmount\(\)/);
  assert.match(modes,/window\.MarketShockReplay2008\?\.syncScene\(\)/);
  assert.match(modes,/if \(panelExpanded && state\.mode==='events' && event\.id==='2008'\)/);
  assert.match(modes,/▶ 6 ЭТАПОВ/);
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
  assert.match(css,/mhReplayBeaconFocus/);
  assert.match(css,/\.mh-replay-controls button:focus-visible/);
  assert.match(css,/min-height:45px/);
  let depth=0;
  for(const char of css){if(char==='{')depth++;if(char==='}')depth--;assert.ok(depth>=0);}
  assert.equal(depth,0);
});


test('EVENT controller mounts 2008 replay only on explicit expansion and stops on world change',()=>{
  class Node {
    constructor(){this.children=[];this.listeners={};this.hidden=false;this.dataset={};this.innerHTML='';this.scrollTop=0;
      this.classList={toggle(){},add(){}};}
    append(...items){this.children.push(...items);}
    addEventListener(type,handler){this.listeners[type]=handler;}
    querySelector(){return new Node();}
    querySelectorAll(){return [];}
    setAttribute(){}
    remove(){}
    focus(){}
    closest(){return null;}
  }
  const app=new Node(),scene=new Node(),main=new Node();
  app.querySelector=selector=>selector==='main'?main:new Node();
  const document={
    activeElement:{closest:()=>null},
    getElementById(id){return id==='app'?app:id==='scene'?scene:null;},
    createElement(){return new Node();},
    createElementNS(){return new Node();}
  };
  const calls={mount:0,unmount:0,sync:0};
  const window={
    location:{href:'https://test.example/',search:''},
    addEventListener(){},setTimeout(){},requestAnimationFrame(){return 1;},matchMedia(){return {matches:false};},
    MarketEventPlanet:{setActive(){},focus(){}},MarketSignalDirector:{setEvent(){}},
    MarketShockReplay2008:{
      mount(){calls.mount++;},unmount(){calls.unmount++;},syncScene(){calls.sync++;}
    }
  };
  const history={state:null,pushState(){},replaceState(){}};
  new Script(modes).runInNewContext({document,window,history,Element:Node,URL,URLSearchParams});
  window.MarketHistoryModes.setMode('events',false);
  const panel=main.children.find(child=>child.id==='mhHistoryPanel');
  assert.ok(panel);
  assert.equal(calls.mount,0,'Collapsed dossier never mounts the replay');
  const toggle=new Node();
  toggle.closest=selector=>selector==='[data-mh-panel-toggle]'?toggle:null;
  app.listeners.click({target:toggle});
  assert.equal(calls.mount,1,'Explicit expansion mounts the replay once');
  assert.match(panel.innerHTML,/mhShockReplay2008/);
  window.MarketHistoryModes.selectEvent('1987');
  assert.equal(calls.mount,1,'Other event has no replay');
  assert.ok(calls.unmount>=2,'Changing event disposes the prior replay');
  window.MarketHistoryModes.selectEvent('2008');
  window.MarketHistoryModes.setMode('people',false);
  assert.equal(window.MarketHistoryModes.mode,'people');
  assert.ok(calls.sync>=1,'Beacon recreation can re-sync the active replay stage');
});
