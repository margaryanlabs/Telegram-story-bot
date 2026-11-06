import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const modes=read('v10/market-history-modes.js');
const css=read('v10/v20-chronosphere.css');
const html=read('index.html');

function mountFixture() {
  let focusCount=0;
  class FakeElement {
    constructor(id='') {
      this.id=id;this.children=[];this.listeners={};this.dataset={};
      this.hidden=false;this.innerHTML='';this.scrollTop=0;this.textContent='';
      this.attributes={};this.style={left:'',top:'',opacity:'',pointerEvents:''};
      this.classList={
        classes:new Set(),
        add:x=>this.classList.classes.add(x),
        toggle:(x,enabled)=>enabled?this.classList.classes.add(x):this.classList.classes.delete(x)
      };
    }
    append(...children){this.children.push(...children);}
    remove(){}
    addEventListener(type,callback){this.listeners[type]=callback;}
    setAttribute(k,v){this.attributes[k]=v;}
    getAttribute(k){return this.attributes[k];}
    querySelector(selector) {
      if(selector==='main')return main;
      if(selector.startsWith('[data-mh-chrono-event')) {
        const id=selector.match(/="([0-9]+)"/)?.[1];
        return chronoButtons.find(b=>b.dataset.mhChronoEvent===id) || null;
      }
      return new FakeElement();
    }
    querySelectorAll(selector) {
      if(selector==='[data-mh-chrono-event]')return chronoButtons;
      return [];
    }
    focus(){focusCount++;}
    closest(){return null;}
  }
  const chronoButtons=['1907','1987','2008','2020'].map(id=>{
    const el=new FakeElement('chrono'+id);el.dataset.mhChronoEvent=id;return el;
  });
  const app=new FakeElement('app'),scene=new FakeElement('scene'),main=new FakeElement('main');
  const document={
    activeElement:{closest:()=>null},
    getElementById:id=>id==='app'?app:id==='scene'?scene:null,
    createElement:()=>new FakeElement(),
    createElementNS:()=>new FakeElement()
  };
  const globeFocus=[];
  const window={
    location:{href:'https://preview.example/market/',search:''},
    matchMedia:()=>({matches:false}),
    requestAnimationFrame:()=>0,setTimeout:()=>0,addEventListener(){},
    MarketEventPlanet:{setActive(){},focus:p=>globeFocus.push(p)},
    MarketSignalDirector:{setEvent(){}},
    MarketShockReplay2008:{unmount(){},syncScene(){},mount(){}}
  };
  const history={state:null,replaceState(){},pushState(){}};
  new Script(modes).runInNewContext({window,document,history,Element:FakeElement,URL,URLSearchParams});
  const nav=scene.children.find(el=>el.id==='mhChronosphere');
  const panel=main.children.find(el=>el.id==='mhHistoryPanel');
  return {window,app,scene,main,nav,panel,document,FakeElement,chronoButtons,globeFocus,focused:()=>focusCount};
}

test('Chronosphere is chronological, sourced from actual event records and hidden in PEOPLE',()=>{
  new Script(modes);
  const f=mountFixture();
  assert.ok(f.nav);
  assert.equal(f.nav.hidden,true);
  assert.match(f.nav.innerHTML,/CHRONOSPHERE \/ ARCHIVE/);
  assert.match(f.nav.innerHTML,/Порядок хронологический/);
  for(const year of ['1907','1987','2008','2020']){
    assert.match(f.nav.innerHTML,new RegExp('data-mh-chrono-event="'+year+'"'));
  }
  assert.doesNotMatch(f.nav.innerHTML,/2030|2040|stock-prices|ROI/);
  assert.equal(f.window.MarketHistoryModes.activeEvent,'2008');
  f.window.MarketHistoryModes.setMode('events',false);
  assert.equal(f.nav.hidden,false);
  assert.equal(f.chronoButtons.find(b=>b.dataset.mhChronoEvent==='2008').getAttribute('aria-pressed'),'true');
  assert.equal(f.chronoButtons.find(b=>b.dataset.mhChronoEvent==='1907').getAttribute('aria-pressed'),'false');
  f.window.MarketHistoryModes.setMode('people',false);
  assert.equal(f.nav.hidden,true,'People world must not show event chronology');
});

test('Chronosphere selects and focuses all years without requiring visible globe beacons',()=>{
  const f=mountFixture();
  const api=f.window.MarketHistoryModes;
  api.setMode('events',false);
  const target=new f.FakeElement();
  target.dataset.mhChronoEvent='1907';
  target.closest=selector=>selector==='[data-mh-chrono-event]'?target:null;
  f.app.listeners.click({target});
  assert.equal(api.activeEvent,'1907');
  assert.equal(f.chronoButtons[0].getAttribute('aria-pressed'),'true');
  assert.equal(f.globeFocus.length,1);
  const yearBtn=f.chronoButtons[0];
  yearBtn.closest=selector=>selector==='[data-mh-chrono-event]'?yearBtn:null;
  let prevented=false;
  f.nav.listeners.keydown({target:yearBtn,key:'ArrowRight',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(api.activeEvent,'1987');
  assert.equal(f.chronoButtons[1].getAttribute('aria-pressed'),'true');
  assert.ok(f.focused()>0,'Selected year receives keyboard focus');
  assert.equal(f.globeFocus.length,2);
  assert.equal(f.panel.hidden,false);
});

test('Chronosphere preserves replay and comparison entry points',()=>{
  const f=mountFixture();
  f.window.MarketHistoryModes.setMode('events',false);
  assert.match(f.panel.innerHTML,/▶ 6 ЭТАПОВ/);
  assert.match(modes,/MarketShockReplay2008\?\.mount/);
  f.window.MarketHistoryModes.setMode('connections',false);
  assert.match(f.panel.innerHTML,/mh-v20-compare/);
  assert.equal(f.window.MarketHistoryModes.comparedEvent,'1907');
  f.window.MarketHistoryModes.setMode('events',false);
  assert.match(f.panel.innerHTML,/aria-expanded="false"/);
  assert.equal(f.nav.hidden,false);
});

test('Chronosphere styling is scoped to EVENT and mobile/reduced-motion safe',()=>{
  assert.ok(html.indexOf('v10/v20-chronosphere.css')>html.indexOf('v10/v20-compare-lens.css'));
  assert.match(css,/#app \.mh-chrono-nav\[hidden\]/);
  assert.match(css,/#app \.mh-chrono-entries button:focus-visible/);
  assert.match(css,/@media\(max-width:819px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/min-height:45px/);
  assert.match(css,/data-mh-label-side="left"/);
  assert.doesNotMatch(css,/\.selected-card|\.signal-dock|#markers|#drawer|#app \.mh-planet-surface/);
  let balance=0;
  for(const c of css) {
    if(c==='{')balance++;
    if(c==='}')balance--;
    assert.ok(balance>=0);
  }
  assert.equal(balance,0);
});


test('Active globe beacon carries a sourced meaning, while inactive stars retain years',()=>{
  const f=mountFixture();
  f.window.MarketHistoryModes.setMode('events',false);
  const layer=f.scene.children.find(el=>el.id==='mhEventLayer');
  assert.ok(layer);
  const active=layer.children.find(el=>el.dataset.mhBeacon==='2008');
  const inactive=layer.children.find(el=>el.dataset.mhBeacon==='1987');
  assert.ok(active&&inactive);
  assert.match(active.innerHTML,/<b>2008<\/b><small>Кризис доверия<\/small>/);
  assert.match(inactive.innerHTML,/<b>1987<\/b>/);
  assert.doesNotMatch(inactive.innerHTML,/<small>/);
  assert.match(modes,/button\.dataset\.mhLabelSide = label\?\.side \|\| \(pos\.x > w-/);
  f.window.MarketHistoryModes.selectEvent('1907');
  const selected=layer.children.filter(el=>el.dataset.mhBeacon==='1907').at(-1);
  assert.match(selected.innerHTML,/<small>Банковская паника<\/small>/);
});

test('Short mobile screens keep the time navigator out of the mode-switch',()=>{
  assert.match(css,/@media\(max-width:819px\) and \(max-height:750px\)/);
  assert.match(css,/@media\(max-width:819px\) and \(max-height:660px\)/);
  assert.match(css,/#app \.mh-chrono-nav\{top:149px;padding:7px 10px/);
  assert.match(css,/#app \.mh-chrono-focus\{display:none\}/);
  assert.match(css,/#app \.mh-chrono-overline\{font-size:10px/);
});
