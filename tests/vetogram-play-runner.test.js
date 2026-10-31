import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const code=readFileSync(new URL('../public/vetogram-play-runner.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
function item(){
  return {
    parentNode:null,nextSibling:null,children:[],events:{},hidden:false,className:'',textContent:'',
    classList:{add(){},remove(){},contains(){return true}},
    setAttribute(){},removeAttribute(){},focus(){},
    addEventListener(k,fn){this.events[k]=fn},
    appendChild(child){
      if(child.parentNode){child.parentNode.children=child.parentNode.children.filter(c=>c!==child);}
      this.children.push(child);
      child.parentNode=this;
    },
    insertBefore(child,next){
      if(child.parentNode){child.parentNode.children=child.parentNode.children.filter(c=>c!==child);}
      const idx=next?this.children.indexOf(next):-1;
      this.children.splice(idx<0?this.children.length:idx,0,child);
      child.parentNode=this;
    },
    querySelector(sel){return sel==='h3'?{textContent:'Мини-игра'}:null},
  };
}
function scene(){
  const grid=item(),mount=item(),dialog=item(),close=item();
  const cards=Array.from({length:4},()=>item());
  for(const card of cards)grid.appendChild(card);
  cards.forEach((card,i)=>{card.nextSibling=cards[i+1]||null});
  dialog.open=false;
  dialog.showModal=()=>{dialog.open=true};
  dialog.close=()=>{dialog.open=false;dialog.events.close?.()};
  const root={
    classList:{contains:()=>true},
    querySelector(selector){return ({
      '#vpGameDialog':dialog, '#vpGameMount':mount, '#vpGameClose':close
    })[selector]||null},
    querySelectorAll(selector){return selector==='.vp-mini[data-vp-game]'?cards:[]},
  };
  const body={classList:{added:false,add(){this.added=true},remove(){this.added=false}}};
  const events={};
  const document={
    body,querySelector:sel=>sel==='.screen[data-screen="play"]'?root:null,
    createElement:item,addEventListener:(k,fn)=>events['document:'+k]=fn,
  };
  const window={addEventListener:(k,fn)=>events[k]=fn};
  runInNewContext(code,{document,window,Array});
  return {grid,mount,dialog,close,cards,body,events};
}
test('Play runner attaches play controls only to four native local games',()=>{
  const ui=scene();
  assert.equal(ui.cards.length,4);
  assert.ok(ui.cards.every(c=>c.children.length===1));
  assert.match(html,/id="vpGameDialog"/);
  assert.match(html,/vetogram-play-runner\.js/);
});
test('Local game opens as a modal and returns to the original grid on close',()=>{
  const ui=scene(),first=ui.cards[0];
  first.children[0].events.click();
  assert.equal(ui.dialog.open,true);
  assert.equal(first.parentNode,ui.mount);
  assert.equal(ui.body.classList.added,true);
  ui.close.events.click();
  assert.equal(ui.dialog.open,false);
  assert.equal(first.parentNode,ui.grid);
  assert.equal(ui.grid.children[0],first);
  assert.equal(ui.body.classList.added,false);
});
test('Navigation away closes the current mini-game cleanly',()=>{
  const ui=scene();
  ui.cards[2].children[0].events.click();
  ui.events['veto:screen-changed']({detail:{screen:'telegram'}});
  assert.equal(ui.dialog.open,false);
  assert.equal(ui.cards[2].parentNode,ui.grid);
});
test('Game runner does not access chat session or perform remote calls',()=>{
  assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|initData|sendMessage|telegram-chats|document\.cookie/);
});
