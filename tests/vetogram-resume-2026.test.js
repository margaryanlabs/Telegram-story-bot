import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const code=readFileSync(new URL('../public/vetogram-resume-2026.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/vetogram-2026.css',import.meta.url),'utf8');
function fixture(){
  let active='home',observed=null,storage=0,net=0;
  const screens=['home','telegram','privacy','publish','story-engine','ai','voice'];
  const holders=[],called=[];
  function node(name){
    return {tagName:name,children:[],dataset:{},attributes:{},
      append(...items){this.children.push(...items)},
      replaceChildren(...items){this.children=[...items]},
      setAttribute(k,v){this.attributes[k]=v},
      addEventListener(event,fn){this['on'+event]=fn},
      click(){called.push(this.dataset.vg26Recent)}
    };
  }
  const holder=node('div');
  const doc={
    getElementById:id=>id==='vg26ResumeRecent'?holder:null,
    createElement:node,
    querySelector:selector=>{
      if(selector==='.screen.active')return {dataset:{screen:active}};
      if(selector.startsWith('[data-nav=')||selector.startsWith('[data-open-screen='))
        return {click:()=>called.push('fallback')};
      return null;
    },
    querySelectorAll:selector=>selector==='.screen[data-screen]'
      ?screens.map(screen=>({dataset:{screen}})):[]
  };
  const win={VetoTelegramNavigate:screen=>{called.push(screen);return true}};
  class Observer{
    constructor(fn){observed=fn}
    observe(target,options){assert.equal(options.attributes,true);
      assert.deepEqual(options.attributeFilter,['class']);}
  }
  vm.runInNewContext(code,vm.createContext({
    document:doc,window:win,MutationObserver:Observer,
    localStorage:{setItem(){storage++},getItem(){storage++}},
    sessionStorage:{setItem(){storage++},getItem(){storage++}},
    fetch(){net++}
  }));
  return {holder,called,
    move(id){active=id;observed()},
    calls:()=>({storage,net})};
}
const buttons=f=>f.holder.children.filter(x=>x.tagName==='button');
test('no chat text, account data, storage or network accesses in resume module',()=>{
  const f=fixture();
  assert.deepEqual(f.calls(),{storage:0,net:0});
  assert.equal(buttons(f).length,0);
  assert.match(f.holder.children[0].textContent,/Начни с чатов/);
});
test('recent destinations are unique, most recent first, at most three',()=>{
  const f=fixture();
  f.move('telegram');f.move('privacy');f.move('ai');f.move('story-engine');
  assert.deepEqual(buttons(f).map(x=>x.dataset.vg26Recent),
    ['story-engine','ai','privacy']);
  f.move('privacy');f.move('privacy');f.move('home');
  assert.deepEqual(buttons(f).map(x=>x.dataset.vg26Recent),
    ['privacy','story-engine','ai']);
});
test('clicking a recent tool performs explicit normal screen navigation',()=>{
  const f=fixture();
  f.move('telegram');
  const button=buttons(f)[0];
  assert.equal(button.attributes['aria-label'],'Открыть Чаты');
  button.onclick();
  assert.deepEqual(f.called,['telegram']);
});
test('unrecognized screens and the home itself never enter recent list',()=>{
  const f=fixture();
  f.move('home');f.move('private-chat-data');f.move('__proto__');
  assert.equal(buttons(f).length,0);
});
test('real page includes new module and responsive, keyboard accessible UI',()=>{
  assert.match(html,/id="vg26ResumeRecent"/);
  assert.match(html,/src="\/vetogram-resume-2026\.js\?/);
  assert.match(html,/class="vg26-resume-flows"/);
  assert.match(css,/\.vg26-resume-flows\{display:grid/);
  assert.match(css,/@media\(max-width:620px\)/);
  assert.match(css,/\.vg26-resume :is\(button\):focus-visible/);
});
