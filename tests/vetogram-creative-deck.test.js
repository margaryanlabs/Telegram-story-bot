import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {CREATIVE_PRESETS,buildCreativeDraft} from '../public/vetogram-creative-presets-core.js';

const load=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('premium presets exist for real Reply / Story / Campaign modes only',()=>{
  for(const mode of ['reply','story','campaign']){
    assert.equal(CREATIVE_PRESETS[mode].length,4);
    assert.equal(new Set(CREATIVE_PRESETS[mode].map(x=>x.id)).size,4);
    for(const item of CREATIVE_PRESETS[mode]){
      assert.ok(item.title&&item.description&&item.instruction);
      assert.ok(item.instruction.length<350);
    }
  }
  for(const mode of ['negotiator','action','chat','translate','brief']){
    assert.equal(buildCreativeDraft(mode,'clear','Private data').ok,false);
  }
});
test('style adds explicit instructions without losing the original typed content',()=>{
  const original='Ответь по встрече на следующей неделе.';
  const result=buildCreativeDraft('reply','clear',original);
  assert.equal(result.ok,true);
  assert.ok(result.value.includes(original));
  assert.match(result.value,/черновик, не отправлять автоматически/);
  assert.match(result.value,/МОЙ ИСХОДНЫЙ ЗАПРОС:/);
  assert.equal(result.mode,'reply');
});
test('new Story prompt asks user for subject and does not fabricate user details',()=>{
  const result=buildCreativeDraft('story','cinema','');
  assert.equal(result.ok,true);
  assert.match(result.value,/ТЕМА И ДЕТАЛИ:/);
  assert.doesNotMatch(result.value,/\b\d{10,}\b/);
});
test('length limit and invalid IDs fail closed before editing any user input',()=>{
  assert.deepEqual(buildCreativeDraft('reply','missing','Something'),
    {ok:false,reason:'unknown-preset'});
  assert.deepEqual(buildCreativeDraft('reply','clear','x'.repeat(2990)),
    {ok:false,reason:'too-long'});
  assert.equal(buildCreativeDraft('story','cinema','Idea',3000).ok,true);
});
test('real Mini App HTML includes the visual deck, latest stylesheet and JS module',()=>{
  const html=load('../public/studio.html');
  assert.match(html,/id="vg26CreativeDeck"[^>]*hidden/);
  assert.match(html,/id="vg26CreativeOptions"/);
  assert.match(html,/id="vtaiText"/);
  assert.match(html,/vetogram-experience-2026\.css/);
  assert.match(html,/type="module" src="\/vetogram-creative-presets\.js/);
  assert.ok(html.indexOf('vetogram-creative-presets.js')>html.indexOf('vetogram-ai.js'));
});
test('client script is draft-only: no network, no storage, no send or consent impersonation',()=>{
  const script=load('../public/vetogram-creative-presets.js');
  assert.doesNotMatch(script,/\bfetch\s*\(/);
  assert.doesNotMatch(script,/\b(localStorage|sessionStorage|indexedDB)\b\s*\./);
  assert.doesNotMatch(script,/\.click\(\)/);
  assert.doesNotMatch(script,/\brequest\s*\(/);
  assert.doesNotMatch(script,/vtaiConsent/);
  assert.match(script,/new MutationObserver\(render\)/);
});
function harness(){
  const nodes={};
  let active='reply',observer;
  const modeNodes=['reply','story','campaign','action'].map(mode=>({
    dataset:{vtaiMode:mode},
    classList:{contains:key=>key==='active'&&active===mode},
    getAttribute:attr=>attr==='aria-pressed'?String(active===mode):null
  }));
  const container={
    children:[],replaceChildren(){this.children=[]},
    append(child){this.children.push(child)}
  };
  const input={value:'Начальный текст пользователя',maxLength:3000,
    dispatchEvent(){this.events=(this.events||0)+1},
    focus(){this.focused=true}};
  const feedback={textContent:''},title={textContent:''},
    deck={hidden:true};
  nodes.vg26CreativeDeck=deck;
  nodes.vg26CreativeOptions=container;
  nodes.vg26CreativeFeedback=feedback;
  nodes.vg26CreativeTitle=title;
  nodes.vtaiText=input;
  const makeNode=tag=>({
    tagName:tag,dataset:{},textContent:'',type:'',className:'',
    children:[],attributes:{},handlers:{},
    append(...items){this.children.push(...items)},
    setAttribute(name,value){this.attributes[name]=value},
    addEventListener(name,fn){this.handlers[name]=fn}
  });
  const scope={
    CREATIVE_PRESETS,buildCreativeDraft,
    document:{
      getElementById:id=>nodes[id]||null,
      querySelectorAll:q=>q==='[data-vtai-mode]'?modeNodes:[]
    },
    MutationObserver:class{
      constructor(fn){observer=fn}
      observe(){}
    },
    Event:class{constructor(type){this.type=type}}
  };
  const js=load('../public/vetogram-creative-presets.js')
    .replace(/^import .*?;\n/gm,'');
  vm.runInNewContext(js,vm.createContext({...scope,document:{
    ...scope.document,createElement:makeNode
  }}));
  return {input,deck,container,feedback,title,
    setMode:mode=>{active=mode;observer?.()},
    click:i=>container.children[i].handlers.click()};
}
test('actual UI changes one style at a time without erasing typed text or sending',()=>{
  const h=harness();
  assert.equal(h.deck.hidden,false);
  assert.equal(h.container.children.length,4);
  h.click(0);
  const first=h.input.value;
  assert.match(first,/Начальный текст пользователя/);
  assert.match(first,/уверенный/);
  h.click(1);
  assert.match(h.input.value,/Начальный текст пользователя/);
  assert.match(h.input.value,/тёплый/);
  assert.doesNotMatch(h.input.value,/уверенный/);
  assert.equal(h.input.value.split('МОЙ ИСХОДНЫЙ ЗАПРОС:').length,2);
  assert.equal(h.input.focused,true);
  h.setMode('story');
  assert.equal(h.container.children.length,4);
  assert.equal(h.title.textContent,'Как выглядит твоя Story?');
  h.setMode('action');
  assert.equal(h.deck.hidden,true);
  assert.equal(h.container.children.length,0);
});
test('UI refuses to exceed textarea length and preserves long user draft',()=>{
  const h=harness();
  const long='x'.repeat(2990);
  h.input.value=long;
  h.click(0);
  assert.equal(h.input.value,long);
  assert.match(h.feedback.textContent,/слишком длинный/);
});
