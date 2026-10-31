import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../public/studio.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const play = readFileSync(new URL('../public/vetogram-play.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/vetogram-play.css', import.meta.url), 'utf8');

test('Play Hub is routed inside the existing Vetogram shell', () => {
  assert.match(html, /data-screen="play"/);
  assert.match(html, /data-nav="play"/);
  assert.match(html, /vetogram-play\.css/);
  assert.match(html, /vetogram-play\.js/);
  assert.match(app, /play:'play'/);
  assert.match(app, /games:'play'/);
  assert.match(css, /repeat\(6,minmax\(0,1fr\)\)/);
});
test('BLOTENQ uses its own documented origin and honest standalone state', () => {
  assert.match(html, /BLOTENQ\?/);
  assert.match(html, /blot-armenian-digital-club\.lovable\.app/);
  assert.match(html, /Пока открывается отдельно/);
  assert.match(html, /rel="noopener noreferrer"/);
});
test('WHO? is linked as the separate Group DNA game without pretending native embedding', () => {
  assert.match(html, /WHO\? \/ Group DNA/);
  assert.match(html, /id-preview--7643d21a-8d1e-459e-8136-11eded1ed4ae\.lovable\.app/);
  assert.match(html, /Открыть предпросмотр WHO\?/);
});
test('Play bundle does not read messages, Telegram tokens or call remote endpoints', () => {
  assert.doesNotMatch(play, /\bfetch\s*\(|XMLHttpRequest|initData|telegram-chats|sessionStorage|sendMessage|postMessage/);
});

function harness() {
  const storage = new Map();
  const handlers = new Map();
  let clock = 100;
  let nextTimer = 1;
  const timers = new Map();
  const element = () => ({
    textContent:'', dataset:{}, disabled:false, children:[],
    setAttribute(){},
    replaceChildren(){ this.children=[]; },
    appendChild(child){ this.children.push(child); },
    addEventListener(name, callback){ this.events??={}; this.events[name]=callback; },
    click(){ this.events?.click?.(); },
  });
  const selectors = new Map([
    '#vpReactionButton', '#vpReactionInfo', '#vpReactionBest',
    '#vpMemoryGrid', '#vpMemoryInfo', '#vpMemoryBest', '#vpMemoryReset',
  ].map(key => [key, element()]));
  const root = { querySelector(selector) { return selectors.get(selector) || null; } };
  const document = {
    hidden:false,
    querySelector(selector) { return selector === '.screen[data-screen="play"]' ? root : null; },
    createElement() { return element(); },
    addEventListener(name, fn) { handlers.set('document:'+name, fn); },
  };
  const window = {
    performance:{now:()=>clock},
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
    setTimeout(fn){const id=nextTimer++;timers.set(id,fn);return id;},
    addEventListener(name, fn){handlers.set('window:'+name,fn);},
  };
  const clearTimeout = id => timers.delete(id);
  runInNewContext(play, { document,window,clearTimeout,Math,Date });
  return {
    selectors, storage, handlers,
    advance(ms){clock+=ms; const [id,fn]=timers.entries().next().value || [];if(fn){timers.delete(id);fn();}},
    pending(){return timers.size;},
  };
}

test('reaction game validates the signal and records a local best', () => {
  const ui=harness();
  const button=ui.selectors.get('#vpReactionButton');
  assert.equal(button.dataset.state,'idle');
  button.click();
  assert.equal(button.dataset.state,'waiting');
  button.click();
  assert.equal(button.dataset.state,'result');
  assert.equal(ui.storage.size,0, 'early tapping must never earn a score');
  button.click();
  ui.advance(240);
  assert.equal(button.dataset.state,'ready');
  ui.advance(233);
  button.click();
  assert.equal(button.dataset.state,'result');
  assert.equal(ui.storage.get('vetogram:play:reaction-best:v1'),'233');
});

test('memory game has eight playable cards and supports reset', () => {
  const ui=harness();
  const grid=ui.selectors.get('#vpMemoryGrid');
  assert.equal(grid.children.length,8);
  assert.ok(grid.children.every(card=>card.dataset.revealed==='false'));
  grid.children[0].click();
  assert.equal(grid.children[0].dataset.revealed,'true');
  ui.selectors.get('#vpMemoryReset').click();
  assert.equal(grid.children.length,8);
  assert.ok(grid.children.every(card=>card.dataset.revealed==='false'));
});
