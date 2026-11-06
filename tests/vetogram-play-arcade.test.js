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
function setup(initial=[]) {
  const ids=['#vpTttGrid','#vpTttStatus','#vpTttWins','#vpTttReset','#vp2048Grid','#vp2048Score','#vp2048Best','#vp2048Status','#vp2048Reset','#vp2048Undo'];
  const elements=new Map(ids.map(id=>[id,node()]));
  const arrows=['left','right','up','down'].map(d=>{const el=node();el.dataset.vp2048=d;return el;});
  const root={
    dataset:{},
    classList:{contains:()=>true},
    querySelector:s=>elements.get(s)||null,
    querySelectorAll:s=>s==='[data-vp-2048]'?arrows:[],
  };
  const keyboard={};
  const storage=new Map(initial);
  const document={
    querySelector:s=>s==='.screen[data-screen="play"]'?root:null,
    createElement:node,
    addEventListener:(k,fn)=>keyboard[k]=fn,
  };
  const window={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};
  runInNewContext(js,{document,window,Math,Set});
  return {elements,arrows,keyboard,storage,root};
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
  const cards=['blotenq','who','reaction','pairs','tic','2048','mines','snake'].map(id=>{const c=node();c.dataset.vpGame=id;c.hidden=false;return c;});
  const buttons=['all','online','offline','cards'].map(id=>{const c=node();c.dataset.vpFilter=id;c.classList={toggle(){}};return c;});
  const root={
    querySelector(s){return {'#vpCatalogCount':count,'#vpGameSearch':search,'#vpNoResults':empty}[s]??null;},
    querySelectorAll(s){return s==='[data-vp-game]'?cards:buttons;},
  };
  const window={};
  const document={querySelector:s=>s==='.screen[data-screen="play"]'?root:null};
  runInNewContext(registry,{document,window,Map,Set,Object,String,Array});
  assert.equal(window.VetogramPlayCatalog.length,8);
  assert.ok(cards.every(c=>!c.hidden));
  buttons[2].click();
  assert.equal(cards.filter(c=>!c.hidden).length,6);
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

test('keyboard arrows never hijack page or Snake; only the open 2048 dialog owns keys',()=>{
  const ui=setup(),grid=ui.elements.get('#vp2048Grid');
  const handler=ui.keyboard.keydown;
  assert.equal(typeof handler,'function');
  const key=(tagName)=>{let prevented=0;handler({key:'ArrowRight',target:{tagName},preventDefault(){prevented++;}});return prevented;};
  assert.equal(key('BODY'),0,'closed 2048 must not steal page scrolling');
  grid.closest=selector=>selector==='.vp-game-in-dialog'?{}:null;
  assert.equal(key('INPUT'),0,'typing in search must not move 2048');
  assert.equal(key('BODY'),1,'active 2048 owns only its dialog arrow input');
  grid.closest=()=>null;
  assert.equal(key('BODY'),0,'after closing modal, keyboard is released');
});

test('V9 inline 2048 captures arrows only when selected, without a modal',()=>{
  const ui=setup(),grid=ui.elements.get('#vp2048Grid');
  grid.closest=()=>null;
  const key=()=>{let count=0;ui.keyboard.keydown({key:'ArrowLeft',target:{tagName:'BODY'},preventDefault(){count++;}});return count;};
  assert.equal(key(),0);
  ui.root.dataset.v9ActiveGame='2048';
  assert.equal(key(),1);
  ui.root.dataset.v9ActiveGame='snake';
  assert.equal(key(),0);
});

test('2048 undo restores the exact previous board and score without deleting a record',()=>{
  const ui=setup(),grid=ui.elements.get('#vp2048Grid'),undo=ui.elements.get('#vp2048Undo');
  const snapshot=()=>grid.children.map(cell=>cell.textContent).join('|');
  assert.equal(undo.disabled,true,'undo must start disabled');
  const initial=snapshot();
  const controls=['left','up','right','down'];
  for(const dir of controls){
    ui.arrows.find(a=>a.dataset.vp2048===dir).click();
    if(!undo.disabled)break;
  }
  assert.equal(undo.disabled,false,'one legal move must enable undo');
  assert.notEqual(snapshot(),initial,'the first successful move must change the board');
  const savedHigh=Number(ui.storage.get('vetogram:play:2048-best:v1')||0);
  undo.click();
  assert.equal(snapshot(),initial,'undo must restore exact board, not generate a new random tile');
  assert.equal(ui.elements.get('#vp2048Score').textContent,'Очки: 0');
  assert.equal(undo.disabled,true,'only a single level of undo is offered');
  assert.ok(Number(ui.storage.get('vetogram:play:2048-best:v1')||0)>=savedHigh);
  ui.elements.get('#vp2048Reset').click();
  assert.equal(undo.disabled,true);
});

test('2048 session survives reload without restoring an old undo button',()=>{
 const first=setup(),board=first.elements.get('#vp2048Grid'),undo=first.elements.get('#vp2048Undo');
 const moves=['left','right','up','down'];
 for(const dir of moves){
   first.arrows.find(a=>a.dataset.vp2048===dir).click();
   if(!undo.disabled)break;
 }
 assert.equal(undo.disabled,false,'at least one first move should be legal');
 const previous=board.children.map(c=>c.textContent).join('|');
 const score=first.elements.get('#vp2048Score').textContent;
 const saved=first.storage.get('vetogram:play:2048-session:v1');
 assert.ok(saved?.includes('"board"'));
 const resumed=setup([...first.storage]);
 assert.equal(resumed.elements.get('#vp2048Grid').children.map(c=>c.textContent).join('|'),previous);
 assert.equal(resumed.elements.get('#vp2048Score').textContent,score);
 assert.equal(resumed.elements.get('#vp2048Undo').disabled,true,'undo stack is not persisted across reloads');
 assert.match(resumed.elements.get('#vp2048Status').textContent,/восстановлена/);
 resumed.elements.get('#vp2048Reset').click();
 const fresh=JSON.parse(resumed.storage.get('vetogram:play:2048-session:v1'));
 assert.equal(fresh.points,0);
 assert.equal(fresh.board.filter(Boolean).length,2);
});
test('2048 ignores malformed local session and starts a safe clean board',()=>{
 const candidates=[
   '{broken json',
   JSON.stringify({board:['<script>'],points:-1,finished:false,achieved2048:false}),
   JSON.stringify({board:Array(16).fill(99999),points:4,finished:false,achieved2048:false}),
   JSON.stringify({board:Array(16).fill(0),points:0,finished:false,achieved2048:false}),
 ];
 for(const value of candidates){
   const ui=setup([['vetogram:play:2048-session:v1',value]]);
   const tiles=ui.elements.get('#vp2048Grid').children;
   assert.equal(tiles.length,16);
   assert.equal(tiles.filter(cell=>['2','4'].includes(cell.textContent)).length,2);
   assert.equal(ui.elements.get('#vp2048Score').textContent,'Очки: 0');
   assert.equal(ui.elements.get('#vp2048Undo').disabled,true);
 }
});
