import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const modes=file('v10/market-history-modes.js');
const replay=file('v10/shock-replay-2008.js');
const css=file('v10/v20-three-state-sheet.css');
const html=file('index.html');

function fixture(){
  const timers=new Map(),nodes=[],globeFocus=[];
  let nextTimer=0,focusCount=0;
  class Node {
    constructor(id=''){
      this.id=id;this.dataset={};this.hidden=false;this.innerHTML='';
      this.scrollTop=0;this.children=[];this.listeners={};this.attributes={};
      const classes=new Set();
      this.classList={add:k=>classes.add(k),toggle:(k,on)=>on?classes.add(k):classes.delete(k),contains:k=>classes.has(k)};
    }
    append(...children){this.children.push(...children);}
    addEventListener(type,fn){this.listeners[type]=fn;}
    removeEventListener(type,fn){if(this.listeners[type]===fn)delete this.listeners[type];}
    querySelector(selector){
      if(selector==='main')return main;
      if(selector==='#mhShockReplay2008'){
        const node=new Node('shockReplay');nodes.push(node);return node;
      }
      if(selector==='[data-mh-sheet-size]' && !this.innerHTML.includes('data-mh-sheet-size'))return null;
      return new Node();
    }
    querySelectorAll(){return [];}
    setAttribute(k,v){this.attributes[k]=v;}
    removeAttribute(k){delete this.attributes[k];}
    closest(){return null;}
    focus(){focusCount++;}
    scrollIntoView(){}
    remove(){}
  }
  const app=new Node('app'),scene=new Node('scene'),main=new Node('main'),beacon=new Node('2008');
  const document={
    hidden:false,
    activeElement:{closest:()=>null},
    createElement:()=>new Node(),
    createElementNS:()=>new Node(),
    getElementById:id=>id==='app'?app:id==='scene'?scene:null,
    querySelector:selector=>selector.includes('data-mh-beacon="2008"')?beacon:null,
    addEventListener(){}
  };
  const window={
    location:{href:'https://example.test/market',search:''},
    requestAnimationFrame:()=>0,
    matchMedia:()=>({matches:false}),
    addEventListener(){},
    setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},
    clearTimeout:id=>timers.delete(id),
    MarketEventPlanet:{setActive(){},focus:x=>globeFocus.push(x)},
    MarketSignalDirector:{setEvent(){}}
  };
  const history={state:null,pushState(){},replaceState(){}};
  const context={document,window,Element:Node,history,URL,URLSearchParams};
  new Script(replay).runInNewContext(context);
  new Script(modes).runInNewContext(context);
  const panel=main.children.find(x=>x.id==='mhHistoryPanel');
  const action=type=>{
    const el=new Node();
    el.closest=selector=>selector===type?el:null;
    app.listeners.click({target:el});
  };
  const command=(host,key)=>{
    const el=new Node();el.dataset.mhReplayAction=key;
    el.closest=selector=>selector==='[data-mh-replay-action]'?el:null;
    host.listeners.click({target:el,stopPropagation(){}});
  };
  return {document,window,app,scene,panel,beacon,nodes,timers,action,command,Node,globeFocus,focusCount:()=>focusCount};
}

test('V20 three-state EVENT flow preserves live 2008 replay and scroll position',()=>{
  const f=fixture(),api=f.window.MarketHistoryModes,player=f.window.MarketShockReplay2008;
  api.setMode('events',false);
  assert.equal(api.sheetState,'compact');
  assert.equal(f.panel.dataset.mhSheetState,'compact');
  assert.doesNotMatch(f.panel.innerHTML,/data-mh-sheet-size/);
  f.action('[data-mh-panel-toggle]');
  assert.equal(api.sheetState,'research');
  assert.equal(f.panel.dataset.mhSheetState,'research');
  assert.match(f.panel.innerHTML,/data-mh-sheet-size/);
  assert.match(f.panel.innerHTML,/data-mh-sheet-close/);
  assert.equal(player.state.mounted,true);
  const host=f.nodes.at(-1);
  f.command(host,'next');
  assert.equal(player.state.index,1);
  f.command(host,'toggle');
  assert.equal(player.state.playing,true);
  assert.equal(f.timers.size,1);
  f.panel.scrollTop=173;
  const originalHTML=f.panel.innerHTML;
  f.action('[data-mh-sheet-size]');
  assert.equal(api.sheetState,'full');
  assert.equal(f.panel.dataset.mhSheetState,'full');
  assert.ok(f.panel.classList.contains('is-expanded'));
  assert.ok(f.panel.classList.contains('is-fullscreen'));
  assert.equal(f.panel.scrollTop,173);
  assert.equal(f.panel.innerHTML,originalHTML,'Resizing must not rerender dossier or player');
  assert.equal(f.nodes.at(-1),host,'Player host must remain the original node');
  assert.equal(player.state.index,1);
  assert.equal(player.state.playing,true);
  assert.equal(f.timers.size,1);
  // Fullscreen Escape goes to research without killing the running player.
  let prevented=false;
  f.panel.listeners.keydown({
    key:'Escape',target:new f.Node(),
    preventDefault(){prevented=true;},stopPropagation(){}
  });
  assert.ok(prevented);
  assert.equal(api.sheetState,'research');
  assert.equal(player.state.playing,true);
  assert.equal(f.timers.size,1);
  f.action('[data-mh-sheet-size]');
  assert.equal(api.sheetState,'full');
  // A new archive year must close the old research context and stop the timer.
  api.selectEvent('1987');
  assert.equal(api.sheetState,'compact');
  assert.equal(player.state.mounted,false);
  assert.equal(player.state.playing,false);
  assert.equal(f.timers.size,0);
  assert.ok(f.globeFocus.length>0);
});

test('Research controls close to sphere, Compare stays available, PEOPLE clears fullscreen',()=>{
  const f=fixture(),api=f.window.MarketHistoryModes;
  api.setMode('events',false);
  f.action('[data-mh-panel-toggle]');
  f.action('[data-mh-sheet-size]');
  assert.equal(api.sheetState,'full');
  f.action('[data-mh-sheet-close]');
  assert.equal(api.sheetState,'compact');
  assert.equal(f.panel.dataset.mhSheetState,'compact');
  assert.equal(f.panel.classList.contains('is-fullscreen'),false);
  api.setMode('connections',false);
  assert.equal(api.sheetState,'research');
  assert.match(f.panel.innerHTML,/class="mh-v20-compare"/);
  f.action('[data-mh-sheet-size]');
  assert.equal(api.sheetState,'full');
  assert.equal(api.comparedEvent,'1907');
  api.setMode('people',false);
  assert.equal(api.sheetState,'compact');
  assert.equal(f.panel.classList.contains('is-fullscreen'),false);
  assert.equal(f.panel.hidden,true);
  assert.equal(f.timers.size,0);
});

test('Escape de-escalates full → research → compact, preserving a focus target',()=>{
  const f=fixture(),api=f.window.MarketHistoryModes;
  api.setMode('events',false);
  f.action('[data-mh-panel-toggle]');
  f.action('[data-mh-sheet-size]');
  const keydown=()=>{
    f.panel.listeners.keydown({
      key:'Escape',target:new f.Node(),preventDefault(){},stopPropagation(){}
    });
  };
  keydown();assert.equal(api.sheetState,'research');
  keydown();assert.equal(api.sheetState,'compact');
  assert.ok(f.focusCount()>0);
  assert.doesNotMatch(f.panel.innerHTML,/data-mh-sheet-close/);
});

test('Full-size sheet CSS is mobile-safe, does not restyle the PEOPLE world',()=>{
  new Script(modes);
  assert.ok(html.indexOf('v10/v20-three-state-sheet.css')>html.indexOf('v10/v20-chronosphere.css'));
  assert.match(css,/#app \.mh-history-panel\.is-fullscreen/);
  assert.match(css,/position:fixed!important/);
  assert.match(css,/max-height:100dvh!important/);
  assert.match(css,/env\(safe-area-inset-top,0px\)/);
  assert.match(css,/env\(safe-area-inset-bottom,0px\)/);
  assert.match(css,/@media\(max-width:819px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.mh-v20-sheet-tools button:focus-visible/);
  assert.doesNotMatch(css,/#app\[data-mh-mode="people"\]|\.selected-card|\.signal-dock/);
  let depth=0;
  for(const ch of css){if(ch==='{')depth++;if(ch==='}')depth--;assert.ok(depth>=0);}
  assert.equal(depth,0);
});
