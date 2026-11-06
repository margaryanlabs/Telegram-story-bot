import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const modes=file('v10/market-history-modes.js');
const replay=file('v10/shock-replay-2008.js');

function browserFixture(initial='/market/?mm=events&event=2008') {
  let timerId=0;
  const timers=new Map(),players=[],globeFocus=[];
  class Node {
    constructor(id='') {
      this.id=id;this.children=[];this.listeners={};this.dataset={};
      this.hidden=false;this.innerHTML='';this.scrollTop=0;this.attributes={};
      this.classList={classes:new Set(),toggle:(name,active)=>{
        if(active)this.classList.classes.add(name);
        else this.classList.classes.delete(name);
      },add:name=>this.classList.classes.add(name),contains:name=>this.classList.classes.has(name)};
    }
    append(...children){this.children.push(...children);}
    addEventListener(type,fn){this.listeners[type]=fn;}
    removeEventListener(type,fn){if(this.listeners[type]===fn)delete this.listeners[type];}
    querySelector(selector){
      if(selector==='main')return main;
      if(selector==='#mhShockReplay2008'){
        const host=new Node('shock');players.push(host);return host;
      }
      if(selector==='[data-mh-sheet-size]'&&!this.innerHTML.includes('data-mh-sheet-size'))return null;
      return new Node();
    }
    querySelectorAll(){return [];}
    setAttribute(k,v){this.attributes[k]=v;}
    removeAttribute(k){delete this.attributes[k];}
    closest(){return null;}
    focus(){}
    scrollIntoView(){}
    remove(){}
  }
  const app=new Node('app'),scene=new Node('scene'),main=new Node('main'),beacon=new Node('beacon');
  const document={
    hidden:false,activeElement:{closest:()=>null},
    createElement:()=>new Node(),createElementNS:()=>new Node(),
    getElementById:id=>id==='app'?app:id==='scene'?scene:null,
    querySelector:selector=>selector.includes('data-mh-beacon="2008"')?beacon:null,
    addEventListener(){}
  };
  const handlers={};
  const location={href:'https://preview.example'+initial,search:''};
  function updateLocation(raw){
    const value=String(raw||location.href);
    location.href=value.startsWith('http')?value:'https://preview.example'+value;
    const parts=location.href.split('?');
    location.search=parts[1]?'?'+parts[1].split('#')[0]:'';
  }
  updateLocation(location.href);
  const window={
    location,addEventListener:(name,fn)=>{handlers[name]=fn;},
    matchMedia:()=>({matches:false}),requestAnimationFrame:()=>1,
    setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},
    clearTimeout:id=>timers.delete(id),
    MarketEventPlanet:{setActive(){},focus:pos=>globeFocus.push(pos)},
    MarketSignalDirector:{setEvent(){}}
  };
  const entries=[{url:location.href,state:null}];
  let cursor=0;
  const history={
    state:null,
    pushState(value,_unused,url){
      entries.splice(cursor+1);
      const next=url?(String(url).startsWith('http')?url:'https://preview.example'+url):location.href;
      entries.push({url:next,state:value});
      cursor=entries.length-1;this.state=value;updateLocation(next);
    },
    replaceState(value,_unused,url){
      const next=url?(String(url).startsWith('http')?url:'https://preview.example'+url):location.href;
      entries[cursor]={url:next,state:value};
      this.state=value;updateLocation(next);
    },
    go(delta){
      const next=cursor+delta;
      if(next<0||next>=entries.length)return;
      cursor=next;this.state=entries[cursor].state;
      updateLocation(entries[cursor].url);
      handlers.popstate?.({state:this.state});
    },
    back(){this.go(-1);},
    forward(){this.go(1);},
    get length(){return entries.length;},
    get index(){return cursor;}
  };
  const context={document,window,history,Element:Node,URL,URLSearchParams};
  new Script(replay).runInNewContext(context);
  new Script(modes).runInNewContext(context);
  const panel=main.children.find(child=>child.id==='mhHistoryPanel');
  const click=selector=>{
    const target=new Node();
    target.closest=value=>value===selector?target:null;
    app.listeners.click({target});
  };
  const playerAction=type=>{
    const host=players.at(-1);
    assert.ok(host);
    const target=new Node();target.dataset.mhReplayAction=type;
    target.closest=value=>value==='[data-mh-replay-action]'?target:null;
    host.listeners.click({target,stopPropagation(){}});
  };
  return {window,history,document,app,panel,players,timers,click,playerAction,globeFocus,
    get entries(){return entries.map(e=>({url:e.url,state:e.state}));}};
}

test('Android Back: fullscreen → research keeps playing replay, then research → compact disposes timer',()=>{
  const f=browserFixture(),api=f.window.MarketHistoryModes,player=f.window.MarketShockReplay2008;
  assert.equal(api.mode,'events');assert.equal(api.sheetState,'compact');
  assert.equal(f.history.length,1);
  f.click('[data-mh-panel-toggle]');
  assert.equal(api.sheetState,'research');assert.equal(f.history.length,2);
  f.playerAction('next');
  f.playerAction('toggle');assert.equal(player.state.playing,true);
  f.panel.scrollTop=155;
  const host=f.players.at(-1);
  f.click('[data-mh-sheet-size]');
  assert.equal(api.sheetState,'full');assert.equal(f.history.length,3);
  assert.equal(f.history.state.__marketRemembersV20Sheet.depth,2);
  f.history.back();
  assert.equal(api.sheetState,'research');assert.equal(f.history.index,1);
  assert.equal(f.panel.scrollTop,155);
  assert.equal(f.players.at(-1),host,'No remount on size-only Back');
  assert.equal(player.state.index,1);
  assert.equal(player.state.playing,true);assert.equal(f.timers.size,1);
  f.history.back();
  assert.equal(api.sheetState,'compact');assert.equal(f.history.index,0);
  assert.equal(player.state.mounted,false);assert.equal(f.timers.size,0);
  f.history.forward();
  assert.equal(api.sheetState,'research');
  assert.equal(player.state.playing,false,'Forward never restarts playback');
});

test('Explicit К СФЕРЕ from fullscreen consumes both panel history levels',()=>{
  const f=browserFixture(),api=f.window.MarketHistoryModes;
  f.click('[data-mh-panel-toggle]');f.click('[data-mh-sheet-size]');
  assert.equal(api.sheetState,'full');
  f.click('[data-mh-sheet-close]');
  assert.equal(api.sheetState,'compact');assert.equal(f.history.index,0);
  assert.equal(f.history.state.__marketRemembersV20Sheet.sheet,'compact');
  f.click('[data-mh-panel-toggle]');
  assert.equal(api.sheetState,'research');
  assert.equal(f.history.length,2,'New navigation replaces discarded forward branch');
  f.click('[data-mh-panel-toggle]');
  assert.equal(api.sheetState,'compact');assert.equal(f.history.index,0);
});

test('Switching worlds adds one URL entry and Back restores event world without false panel reopen',()=>{
  const f=browserFixture(),api=f.window.MarketHistoryModes;
  f.click('[data-mh-panel-toggle]');f.click('[data-mh-sheet-size]');
  const oldEntry=f.history.state.__marketRemembersV20Sheet;
  assert.equal(oldEntry.sheet,'full');
  api.setMode('people',true);
  assert.equal(api.mode,'people');
  assert.equal(api.sheetState,'compact');
  assert.ok(!f.window.location.search.includes('mm='));
  const n=f.history.length;
  f.history.back();
  assert.equal(f.history.length,n,'Popstate must not create an entry');
  assert.equal(api.mode,'events');
  assert.equal(api.sheetState,'full','Back restores the actual recorded sheet');
  f.history.back();
  assert.equal(api.sheetState,'research');
  f.history.back();
  assert.equal(api.sheetState,'compact');
});

test('Deep-linked Compare begins in research and returns to compact without leaving the page',()=>{
  const f=browserFixture('/market/?mm=connections&event=1987');
  const api=f.window.MarketHistoryModes;
  assert.equal(api.mode,'connections');assert.equal(api.activeEvent,'1987');
  assert.equal(api.sheetState,'research');
  assert.equal(f.history.state.__marketRemembersV20Sheet.depth,0);
  f.click('[data-mh-sheet-size]');
  assert.equal(api.sheetState,'full');assert.equal(f.history.state.__marketRemembersV20Sheet.depth,1);
  f.history.back();assert.equal(api.sheetState,'research');
  f.click('[data-mh-sheet-close]');
  assert.equal(api.sheetState,'compact');assert.equal(f.history.index,0);
  assert.equal(f.history.state.__marketRemembersV20Sheet.sheet,'compact');
});

test('Only the sheet, mode and public event ID are recorded; event selection does not fill Back stack',()=>{
  const f=browserFixture(),api=f.window.MarketHistoryModes;
  const base=f.history.length;
  api.selectEvent('1987');api.selectEvent('1907');
  assert.equal(f.history.length,base);
  assert.equal(api.activeEvent,'1907');
  const entry=f.history.state.__marketRemembersV20Sheet;
  assert.deepEqual(Object.keys(entry).sort(),['depth','event','mode','sheet']);
  assert.equal(entry.depth,0);assert.equal(entry.sheet,'compact');
  assert.doesNotMatch(JSON.stringify(f.history.state),/secret|story|memory|token|private/i);
});
