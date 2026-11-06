import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const modes = read('v10/market-history-modes.js');
const css = read('v10/v20-compare-lens.css');
const html = read('index.html');

test('V20 compare uses only existing archival fields and preserves provenance', () => {
  new Script(modes);
  assert.match(modes, /function comparisonMarkup\(event\)/);
  assert.match(modes, /const candidates = EVENTS\.filter\(other => other\.id !== event\.id\)/);
  assert.match(modes, /record\.mechanism\.split\('→'\)/);
  assert.match(modes, /escape\(record\.detail\)/);
  assert.match(modes, /escape\(record\.lesson\)/);
  assert.match(modes, /escape\(record\.source\)/);
  assert.match(modes, /escape\(record\.url\)/);
  assert.match(modes, /target="_blank" rel="noopener noreferrer"/);
  assert.match(modes, /не доказывают причинность/);
  assert.match(modes, /ИНТЕРПРЕТАЦИЯ/);
  assert.doesNotMatch(modes, /Math\.random\(|localStorage\.setItem\(|fetch\(/);
});

test('V20 compare is a separate, responsive layer that does not restyle PEOPLE', () => {
  const old = html.indexOf('v10/v20-crisis-atlas.css');
  const current = html.indexOf('v10/v20-compare-lens.css');
  assert.ok(old >= 0 && current > old, 'Compare CSS must load after Crisis Atlas');
  assert.match(css, /#app \.mh-v20-compare-case/);
  assert.match(css, /#app \.mh-v20-compare-picker button:focus-visible/);
  assert.match(css, /@media\(max-width:819px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css, /selected-card|signal-dock|MarketPeople|people-mirror/);
  let depth = 0;
  for (const char of css) {
    if (char === '{') depth++;
    if (char === '}') depth--;
    assert.ok(depth >= 0, 'No stray closing CSS brace');
  }
  assert.equal(depth, 0, 'All CSS blocks close');
});

test('V20 compare changes the second case without moving the event globe', () => {
  let focusCount = 0;
  class FakeElement {
    constructor(id='') {
      this.id=id;this.dataset={};this.hidden=false;this.innerHTML='';
      this.scrollTop=0;this.children=[];this.listeners={};
      this.classList={add(){},toggle(){}};
    }
    append(...nodes){this.children.push(...nodes);}
    setAttribute(){}
    addEventListener(type,handler){this.listeners[type]=handler;}
    querySelector(){return new FakeElement();}
    querySelectorAll(){return [];}
    remove(){}
    focus(){focusCount++;}
    closest(){return null;}
  }
  const app=new FakeElement('app'),scene=new FakeElement('scene'),main=new FakeElement('main');
  app.querySelector=selector=>selector==='main'?main:new FakeElement();
  const document={
    activeElement:new FakeElement(),
    getElementById:id=>id==='app'?app:id==='scene'?scene:null,
    createElement:()=>new FakeElement(),
    createElementNS:()=>new FakeElement()
  };
  const eventFocus=[];
  const window={
    location:{href:'https://test.example/market/',search:''},
    requestAnimationFrame:()=>0,setTimeout:()=>0,
    matchMedia:()=>({matches:false}),addEventListener(){},
    MarketEventPlanet:{setActive(){},focus(point){eventFocus.push(point);}},
    MarketSignalDirector:{setEvent(){}}
  };
  const history={state:null,replaceState(){},pushState(){}};
  new Script(modes).runInNewContext({document,window,history,Element:FakeElement,URL,URLSearchParams});
  const api=window.MarketHistoryModes;
  api.setMode('events',false);
  api.setMode('connections',false);
  const panel=main.children.find(node=>node.id==='mhHistoryPanel');
  assert.ok(panel);
  assert.equal(api.activeEvent,'2008');
  assert.equal(api.comparedEvent,'1907');
  assert.match(panel.innerHTML,/class="mh-v20-compare"/);
  assert.match(panel.innerHTML,/aria-label="Выбрать второй кризис"/);
  assert.match(panel.innerHTML,/aria-pressed="true" class="is-active">1907/);
  assert.match(panel.innerHTML,/fdic\.gov\/history\/2000-2009/);
  assert.match(panel.innerHTML,/federalreservehistory\.org\/essays\/panic-of-1907/);
  assert.match(panel.innerHTML,/aria-expanded="true"/);
  assert.equal(eventFocus.length,0,'Entering compare does not re-center the globe');

  const clickTarget=new FakeElement();
  clickTarget.closest=selector=>selector==='[data-mh-compare]'?{dataset:{mhCompare:'1987'}}:null;
  panel.scrollTop=123;
  app.listeners.click({target:clickTarget});
  assert.equal(api.activeEvent,'2008','Primary case stays pinned to the globe');
  assert.equal(api.comparedEvent,'1987');
  assert.equal(panel.scrollTop,123,'Research reading position survives selection');
  assert.match(panel.innerHTML,/federalreservehistory\.org\/essays\/stock-market-crash-of-1987/);
  assert.match(panel.innerHTML,/aria-pressed="true" class="is-active">1987/);
  assert.ok(focusCount>0,'Keyboard focus is restored to the selected year');
  assert.equal(eventFocus.length,0,'Comparison must not rotate the event globe');

  const arrowTarget=new FakeElement();
  arrowTarget.closest=selector=>selector==='[data-mh-compare]'?{dataset:{mhCompare:'1987'}}:null;
  let prevented=false;
  panel.listeners.keydown({target:arrowTarget,key:'ArrowRight',preventDefault(){prevented=true;}});
  assert.ok(prevented,'ArrowRight is handled by the comparison picker');
  assert.equal(api.comparedEvent,'2020');
  assert.equal(api.activeEvent,'2008');

  // The second case can never be the same event as the primary case.
  api.selectEvent('2020');
  api.setMode('connections',false);
  assert.notEqual(api.comparedEvent,api.activeEvent);
  assert.match(panel.innerHTML,/ПЕРВОИСТОЧНИК/);
});

test('V20 comparison rejects invalid second events and exposes three valid choices', () => {
  assert.match(modes,/compareBtn\.dataset\.mhCompare!==state\.activeEvent/);
  assert.match(modes,/EVENT_BY_ID\[compareBtn\.dataset\.mhCompare\]/);
  assert.match(modes,/const candidates=EVENTS\.filter\(item=>item\.id!==state\.activeEvent\)/);
  assert.match(modes,/if\(compareButton&&state\.mode==='connections'/);
  assert.match(modes,/panel\.querySelector\('\[data-mh-compare="'\+compareEventId\+'"\]'\)\?\.focus/);
  assert.match(modes,/const scroll=panel\.scrollTop;\s*renderPanel\(\);panel\.scrollTop=scroll/);
});
