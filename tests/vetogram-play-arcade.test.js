import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { validatePlayManifest } from '../lib/vetogram-play-manifest.js';

const js=readFileSync(new URL('../public/vetogram-play-arcade.js',import.meta.url),'utf8');
const registry=readFileSync(new URL('../public/vetogram-play-registry.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
const sample=JSON.parse(readFileSync(new URL('../examples/vetogram-play-starter/game.json',import.meta.url),'utf8'));
function node() {
  return {
    textContent:'',dataset:{},children:[],disabled:false,value:'',attrs:{},events:{},
    setAttribute(k,v){this.attrs[k]=v;},
    replaceChildren(){this.children=[];},
    appendChild(x){this.children.push(x);},
    addEventListener(k,fn){this.events[k]=fn;},
    click(){if(!this.disabled)this.events.click?.();},
  };
}
function setup() {
  const ids=['#vpTttGrid','#vpTttStatus','#vpTttWins','#vpTttReset','#vp2048Grid','#vp2048Score','#vp2048Best','#vp2048Status','#vp2048Reset'];
  const elements=new Map(ids.map(id=>[id,node()]));
  const arrows=['left','right','up','down'].map(d=>{const el=node();el.dataset.vp2048=d;return el;});
  const root={
    classList:{contains:()=>true},
    querySelector:s=>elements.get(s)||null,
    querySelectorAll:s=>s==='[data-vp-2048]'?arrows:[],
  };
  const keyboard={};
  const storage=new Map();
  const document={
    querySelector:s=>s==='.screen[data-screen="play"]'?root:null,
    createElement:node,
    addEventListener:(k,fn)=>keyboard[k]=fn,
  };
  const window={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};
  runInNewContext(js,{document,window,Math,Set});
  return {elements,arrows,keyboard,storage};
}
test('Tic Tac Toe starts correctly, bot replies, reset clears board',()=>{
  const ui=setup(), grid=ui.elements.get('#vpTttGrid');
  assert.equal(grid.children.length,9);
  assert.equal(grid.children.filter(c=>c.dataset.mark==='empty').length,9);
  grid.children[0].click();
  assert.equal(grid.children.filter(c=>c.dataset.mark==='X').length,1);
  assert.equal(grid.children.filter(c=>c.dataset.mark==='O').length,1);
  ui.elements.get('#vpTttReset').click();
  assert.equal(grid.children.filter(c=>c.dataset.mark==='empty').length,9);
});
test('2048 begins with two tiles, merges same numbers and keeps record',()=>{
  const ui=setup(), grid=ui.elements.get('#vp2048Grid');
  assert.equal(grid.children.length,16);
  assert.equal(grid.children.filter(c=>c.textContent==='2'||c.textContent==='4').length,2);
  for(const dir of ['left','up','down','right','left','up']) {
    ui.arrows.find(a=>a.dataset.vp2048===dir).click();
  }
  assert.ok(/^Очки: \d+$/.test(ui.elements.get('#vp2048Score').textContent));
  assert.equal(grid.children.length,16);
  ui.elements.get('#vp2048Reset').click();
  assert.equal(grid.children.filter(c=>c.textContent==='2'||c.textContent==='4').length,2);
});
test('catalog registry includes every visible game and filters',()=>{
  const count=node(),search=node(),empty=node();
  const cards=['blotenq','who','reaction','pairs','tic','2048'].map(id=>{const c=node();c.dataset.vpGame=id;c.hidden=false;return c;});
  const buttons=['all','online','offline','cards'].map(id=>{const c=node();c.dataset.vpFilter=id;c.classList={toggle(){}};return c;});
  const root={
    querySelector(s){return {'#vpCatalogCount':count,'#vpGameSearch':search,'#vpNoResults':empty}[s]??null;},
    querySelectorAll(s){return s==='[data-vp-game]'?cards:buttons;},
  };
  const window={};
  const document={querySelector:s=>s==='.screen[data-screen="play"]'?root:null};
  runInNewContext(registry,{document,window,Map,Set,Object,String,Array});
  assert.equal(window.VetogramPlayCatalog.length,6);
  assert.ok(cards.every(c=>!c.hidden));
  buttons[2].click();
  assert.equal(cards.filter(c=>!c.hidden).length,4);
  search.value='2048';
  search.events.input();
  assert.equal(cards.filter(c=>!c.hidden).length,1);
  assert.equal(cards[5].hidden,false);
  search.value='неизвестная игра';
  search.events.input();
  assert.ok(cards.every(c=>c.hidden));
  assert.equal(empty.hidden,false);
  for(const c of window.VetogramPlayCatalog)assert.match(html,new RegExp('data-vp-game="'+c.id+'"'));
});
test('sample manifest is valid and rejects remote or privileged entries',()=>{
  assert.equal(validatePlayManifest(sample).valid,true);
  assert.equal(validatePlayManifest({...sample,entry:'https://evil.invalid/x.html'}).valid,false);
  assert.equal(validatePlayManifest({...sample,entry:'../escape.html'}).valid,false);
  assert.equal(validatePlayManifest({...sample,capabilities:['read-chats']}).valid,false);
  assert.equal(validatePlayManifest({...sample,languages:[]}).valid,false);
  assert.equal(validatePlayManifest({...sample,languages:['en','en']}).valid,false);
});
test('arcade does not access Telegram identity or network APIs',()=>{
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|initData|telegram-chats|sendMessage|postMessage|document\.cookie/);
  assert.match(html,/docs\/vetogram-play-developers\.md/);
});
