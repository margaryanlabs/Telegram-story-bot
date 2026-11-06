/* V9 editorial navigation source contracts. Does not use network, secrets or Telegram. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const edition='20261106-v9-08';
const screens=['studio','cinema','books','music-module'];

test('V9 explore assets exist, parse and respect reduced motion',()=>{
  assert.ok(existsSync(new URL('../public/vetogram-v9-explore.js',import.meta.url)));
  const js=read('public/vetogram-v9-explore.js');
  const css=read('public/vetogram-v9-explore.css');
  assert.doesNotThrow(()=>new Function(js));
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/v9-arcade-launch\[hidden\]/);
  assert.match(css,/v9-arcade-active #vpQuickGames/);
  assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|postMessage|TELEGRAM_BOT_TOKEN/);
});

test('Every source shell mounts a single, cache-consistent V9 navigation',()=>{
  for(const name of screens){
    const html=read('public/'+name+'.html');
    assert.equal((html.match(/<script[^>]+vetogram-v9-explore\.js\?/g)||[]).length,1,name+' JS');
    assert.equal((html.match(/<link[^>]+vetogram-v9-explore\.css\?/g)||[]).length,1,name+' CSS');
    const assets=[...html.matchAll(/(?:src|href)=["']((?:\/|\.\/)[^"']+\.(?:css|js)(?:\?[^"']*)?)["']/g)]
      .map(match=>match[1]);
    assert.ok(assets.length>5,name+' linked assets');
    for(const asset of assets)assert.ok(asset.endsWith('?v='+edition),
      name+' mixed or uncached: '+asset);
  }
});

test('Native Games remain six offline controllers and have one catalog',()=>{
  const html=read('public/studio.html');
  const css=read('public/vetogram-v9-explore.css');
  const js=read('public/vetogram-v9-explore.js');
  const expected=['reaction','pairs','tic','2048','mines','snake'];
  for(const id of expected){
    assert.match(html,new RegExp('data-v9-launch="'+id+'"'));
    assert.match(html,new RegExp('data-vp-game="'+id+'"'));
  }
  assert.equal((html.match(/data-v9-launch="/g)||[]).length,6);
  assert.match(js,/v9-arcade-filter-tabs/);
  assert.match(js,/aria-pressed/);
  assert.match(css,/not\(\.v9-arcade-active\) #vpQuickGames/);
  assert.match(css,/\.vp-mini\[hidden\]/);
});

test('Cinema and Books use their real native controllers and single media dock',()=>{
  const js=read('public/vetogram-v9-explore.js');
  const cinema=read('public/cinema.html');
  const books=read('public/books.html');
  assert.match(js,/\.v79-media-switcher/);
  assert.match(js,/\.cinema-section-nav/);
  assert.match(cinema,/id="cinemaTabs"/);
  assert.match(cinema,/id="cinemaHero"/);
  assert.match(books,/id="reader"/);
  assert.match(books,/id="bookSearch"/);
});

test('Media quick links delegate to original modules without duplicating the menu',()=>{
  const js=read('public/vetogram-v9-explore.js');
  class Element {
    constructor(tag){this.tag=tag;this.dataset={};this.children=[];this.events={};this.attributes={};}
    append(...elements){this.children.push(...elements);}
    appendChild(element){this.append(element);}
    setAttribute(name,value){this.attributes[name]=value;}
    addEventListener(name,fn){this.events[name]=fn;}
    click(){this.events.click?.();}
  }
  const routes=['cinema','music','books'];
  const calls={cinema:0,music:0,books:0};
  const buttons=Object.fromEntries(routes.map(name=>[name,{click(){calls[name]++;}}]));
  const grid={querySelector(selector){
    const name=selector.match(/\[data-v6-module="([^"]+)"\]/)?.[1];
    return buttons[name]||null;
  }};
  const home=new Element('div');
  home.firstElementChild={tag:'header'};
  home.querySelector=selector=>selector==='.v72-media-grid'?grid:
    selector==='#v9MediaQuickNav'?home.children.find(item=>item.id==='v9MediaQuickNav')||null:null;
  home.insertBefore=element=>{home.children.unshift(element);};
  const doc={
    createElement:tag=>new Element(tag),
    querySelector:selector=>selector==='#v6MediaHome'?home:null
  };
  const context={document:doc,window:{}};
  runInNewContext(js,context);
  runInNewContext(js,context);
  assert.equal(home.children.length,1,'should not duplicate shortcut menu');
  const nav=home.children[0];
  assert.equal(nav.attributes['aria-label'],'Быстрый переход к медиа');
  assert.deepEqual(nav.children.map(item=>item.dataset.v9Module),routes);
  nav.children.forEach(item=>item.click());
  assert.deepEqual(calls,{cinema:1,music:1,books:1});
});
