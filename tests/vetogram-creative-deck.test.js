import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {CREATIVE_PRESETS,buildCreativeDraft} from '../public/vetogram-creative-presets-core.js';

const load=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('premium presets exist for real Reply / Story / Campaign modes only',()=>{
  for(const [mode,size] of [['reply',8],['story',6],['campaign',4]]){
    assert.equal(CREATIVE_PRESETS[mode].length,size);
    assert.equal(new Set(CREATIVE_PRESETS[mode].map(x=>x.id)).size,size);
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
    classList:{values:new Set(),toggle(name,active){
      if(active)this.values.add(name);else this.values.delete(name);
    },contains(name){return this.values.has(name)}},
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
  assert.equal(h.container.children.length,8);
  h.click(0);
  assert.equal(h.container.children[0].attributes['aria-pressed'],'true');
  assert.equal(h.container.children[0].classList.contains('is-selected'),true);
  const first=h.input.value;
  assert.match(first,/Начальный текст пользователя/);
  assert.match(first,/уверенный/);
  h.click(1);
  assert.equal(h.container.children[0].attributes['aria-pressed'],'false');
  assert.equal(h.container.children[1].attributes['aria-pressed'],'true');
  assert.match(h.input.value,/Начальный текст пользователя/);
  assert.match(h.input.value,/тёплый/);
  assert.doesNotMatch(h.input.value,/уверенный/);
  assert.equal(h.input.value.split('МОЙ ИСХОДНЫЙ ЗАПРОС:').length,2);
  assert.equal(h.input.focused,true);
  h.setMode('story');
  assert.equal(h.input.value,'Начальный текст пользователя');
  assert.equal(h.container.children.length,6);
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


test('switching AI modes retains manually edited text instead of restoring stale template',()=>{
  const h=harness();
  h.click(0);
  h.input.value+='\nМоя дополнительная ручная правка';
  h.setMode('story');
  assert.match(h.input.value,/Моя дополнительная ручная правка/);
  assert.match(h.input.value,/уверенный/);
});


test('premium chat filters expose real Focus and saved-copy navigation, not mock buttons',()=>{
  const html=load('../public/studio.html');
  const filters=html.slice(html.indexOf('id="telegramMirrorFilters"'),
    html.indexOf('id="telegramMirrorAccountProof"'));
  assert.ok(filters.includes('data-mirror-filter="focus"'));
  assert.ok(filters.includes('data-mirror-filter="copies"'));
  assert.doesNotMatch(filters,/class="veto-filter-advanced"[^>]*data-mirror-filter="focus"/);
  assert.doesNotMatch(filters,/class="veto-filter-advanced"[^>]*data-mirror-filter="copies"/);
  const labels=html.slice(html.indexOf('<nav class="bottom-nav"'),
    html.indexOf('</nav>',html.indexOf('<nav class="bottom-nav"')));
  for(const label of ['Чаты','Истории','VETO AI','Защита'])
    assert.match(labels,new RegExp('<small(?: [^>]*)?>'+label+'</small>'));
});


test('new high-value Reply/Story personas are draft-only and do not invent facts',()=>{
  for(const id of ['premium','boundary','followup','persuasive']){
    const item=CREATIVE_PRESETS.reply.find(p=>p.id===id);
    assert.ok(item?.instruction&&item.title);
    const draft=buildCreativeDraft('reply',id,'Привет, отвечаю завтра');
    assert.equal(draft.ok,true);
    assert.match(draft.value,/Привет, отвечаю завтра/);
    assert.match(draft.value,/не отправлять автоматически/);
  }
  for(const id of ['editorial','minimal']){
    const draft=buildCreativeDraft('story',id,'Запуск новой коллекции');
    assert.equal(draft.ok,true);
    assert.match(draft.value,/Запуск новой коллекции/);
  }
});
