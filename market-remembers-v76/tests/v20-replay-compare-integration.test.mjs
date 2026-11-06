import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const modes = read('v10/market-history-modes.js');
const replay = read('v10/shock-replay-2008.js');
const html = read('index.html');

test('Crisis Atlas + Shock Replay + Compare run together without blocking the event sphere',()=>{
  const timers=new Map(),historyCalls=[],eventFocus=[],hosts=[];
  let timerId=0,focusCount=0;
  class ElementStub {
    constructor(id=''){
      this.id=id;this.dataset={};this.hidden=false;this.innerHTML='';
      this.children=[];this.listeners={};this.scrollTop=0;this.attributes={};
      this.classList={add(){},toggle(){}};
    }
    append(...children){this.children.push(...children);}
    addEventListener(type,cb){this.listeners[type]=cb;}
    removeEventListener(type,cb){if(this.listeners[type]===cb)delete this.listeners[type];}
    setAttribute(k,v){this.attributes[k]=v;}
    removeAttribute(k){delete this.attributes[k];}
    querySelector(selector){
      if(selector==='#mhShockReplay2008'){
        const host=new ElementStub('mhShockReplay2008');
        hosts.push(host);return host;
      }
      const node=new ElementStub();
      node.focus=()=>{focusCount++;};
      return node;
    }
    querySelectorAll(){return [];}
    focus(){focusCount++;}
    remove(){}
    closest(){return null;}
    scrollIntoView(){}
  }
  const app=new ElementStub('app'),scene=new ElementStub('scene'),main=new ElementStub('main');
  const beacon=new ElementStub('beacon');
  app.querySelector=selector=>selector==='main'?main:new ElementStub();
  const document={
    hidden:false,activeElement:{closest:()=>null},
    getElementById:id=>id==='app'?app:id==='scene'?scene:null,
    querySelector:selector=>selector.includes('data-mh-beacon="2008"')?beacon:null,
    createElement:()=>new ElementStub(),
    createElementNS:()=>new ElementStub(),
    addEventListener(){},
  };
  const window={
    location:{href:'https://preview.example/market/',search:''},
    requestAnimationFrame:()=>0,
    setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},
    clearTimeout:id=>timers.delete(id),
    addEventListener(){},
    matchMedia:()=>({matches:false}),
    MarketEventPlanet:{setActive(){},focus:p=>eventFocus.push(p)},
    MarketSignalDirector:{setEvent(){}},
  };
  const history={
    state:null,pushState(...args){historyCalls.push(['push',...args]);},
    replaceState(...args){historyCalls.push(['replace',...args]);}
  };
  const context={document,window,history,Element:ElementStub,URL,URLSearchParams};
  new Script(replay).runInNewContext(context);
  new Script(modes).runInNewContext(context);
  const api=window.MarketHistoryModes,player=window.MarketShockReplay2008;
  const panel=main.children.find(node=>node.id==='mhHistoryPanel');
  assert.ok(panel,'Actual event panel must be installed');

  api.setMode('events',false);
  assert.equal(api.activeEvent,'2008');
  assert.equal(player.state.mounted,false,'The first scene is compact');
  assert.match(panel.innerHTML,/▶ 6 ЭТАПОВ/);
  assert.doesNotMatch(panel.innerHTML,/class="mh-v20-compare"/);

  const open=new ElementStub();
  open.closest=selector=>selector==='[data-mh-panel-toggle]'?open:null;
  app.listeners.click({target:open});
  assert.equal(player.state.mounted,true,'Expanding 2008 mounts its documentary timeline');
  assert.match(panel.innerHTML,/mhShockReplay2008/);
  const host=hosts.at(-1);
  const play=new ElementStub();
  play.dataset.mhReplayAction='toggle';
  play.closest=selector=>selector==='[data-mh-replay-action]'?play:null;
  host.listeners.click({target:play,stopPropagation(){}});
  assert.equal(player.state.playing,true);
  assert.equal(timers.size,1,'Playback owns one disposable timer');
  assert.equal(app.dataset.mhReplayStep,'1');

  api.setMode('connections',false);
  assert.equal(player.state.mounted,false,'Entering Compare unmounts Replay');
  assert.equal(player.state.playing,false,'No timer survives mode change');
  assert.equal(timers.size,0);
  assert.equal(app.dataset.mhReplayStep,undefined);
  assert.equal(api.comparedEvent,'1907');
  assert.match(panel.innerHTML,/class="mh-v20-compare"/);
  assert.match(panel.innerHTML,/aria-expanded="true"/);

  const focusBefore=eventFocus.length;
  panel.scrollTop=75;
  const second=new ElementStub();
  second.dataset.mhCompare='1987';
  second.closest=selector=>selector==='[data-mh-compare]'?second:null;
  app.listeners.click({target:second});
  assert.equal(api.comparedEvent,'1987');
  assert.equal(api.activeEvent,'2008','Case B does not displace the globe marker');
  assert.equal(eventFocus.length,focusBefore,'Compare selection must not rotate sphere');
  assert.equal(panel.scrollTop,75,'Long research view keeps scroll position');
  assert.ok(focusCount>0,'Keyboard focus is restored');

  api.setMode('events',false);
  assert.match(panel.innerHTML,/aria-expanded="false"/);
  assert.equal(player.state.mounted,false,'Returning to sphere must not auto-open Replay');
  assert.doesNotMatch(panel.innerHTML,/class="mh-v20-compare"/);
  api.selectEvent('1987');
  assert.equal(player.state.mounted,false);
  api.setMode('people',false);
  assert.equal(api.mode,'people');
  assert.equal(timers.size,0);
  assert.ok(html.indexOf('v10/shock-replay-2008.js')<html.indexOf('v10/market-history-modes.js'));
  assert.ok(html.includes('v10/v20-compare-lens.css'));
});

test('deep-linked connections open their evidence document, not an empty closed card',()=>{
  const modesSource=modes;
  assert.match(modesSource,/mode === 'connections' && oldMode !== 'connections'\) \{\s*panelExpanded = true;\s*panelFullscreen = false;/);
  assert.match(modesSource,/mode === 'events' && oldMode === 'connections'\) \{\s*panelExpanded = false;\s*panelFullscreen = false;/);
  assert.match(modesSource,/if \(panelExpanded && state\.mode==='events' && event\.id==='2008'\)/);
  assert.match(modesSource,/get comparedEvent\(\)/);
});
