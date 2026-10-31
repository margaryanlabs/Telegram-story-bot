import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const registry = readFileSync(new URL('../public/vetogram-play-registry.js', import.meta.url), 'utf8');
const store = readFileSync(new URL('../public/vetogram-play-store.js', import.meta.url), 'utf8');
const developer = readFileSync(new URL('../public/vetogram-play-developer.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/studio.html', import.meta.url), 'utf8');

function element(dataset = {}) {
  return {
    dataset, textContent:'', hidden:false, value:'', attrs:{}, children:[], events:{},
    classList:{toggle(){},add(){}},
    setAttribute(name,value){this.attrs[name]=value;},
    removeAttribute(name){delete this.attrs[name];},
    addEventListener(name,fn){this.events[name]=fn;},
    appendChild(child){this.children.push(child);},
    querySelector(){return null;},
    click(){this.events.click?.({preventDefault(){}});},
    focus(){},select(){},
    scrollIntoView(){},
  };
}
function playground() {
  const ids=['blotenq','who','reaction','pairs','tic','2048'];
  const cards=ids.map(id=>element({vpGame:id}));
  const filters=['all','online','offline','cards','favorites'].map(id=>element({vpFilter:id}));
  const search=element(),count=element(),empty=element();
  const panel=element(),shareInput=element(),copy=element(),shareNotice=element(),close=element(),status=element();
  panel.hidden=true;
  const selectors={
    '#vpGameSearch':search, '#vpCatalogCount':count, '#vpNoResults':empty,
    '#vpSharePanel':panel,'#vpShareUrl':shareInput,'#vpCopyShare':copy,
    '#vpShareNotice':shareNotice,'#vpCloseShare':close,'#vpStoreStatus':status,
  };
  const root={
    querySelector:key=>selectors[key]||null,
    querySelectorAll:key=>key==='[data-vp-game]'?cards:key==='[data-vp-filter]'?filters:[],
  };
  const stored = new Map();
  const events=new Map();
  const copied=[];
  const win={
    location:{protocol:'https:',origin:'https://vetogram.example',search:'?screen=play&token=SECRET'},
    navigator:{clipboard:{writeText:async value=>{copied.push(value);}}},
    localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},
    addEventListener:(n,callback)=>events.set(n,callback),
    dispatchEvent:evt=>events.get(evt.type)?.(evt),
  };
  const doc={querySelector:key=>key==='.screen[data-screen="play"]'?root:null,createElement:()=>element()};
  const context={window:win,document:doc,URL,URLSearchParams,CustomEvent:class {constructor(type){this.type=type;}},Set,Map,Array};
  runInNewContext(registry,context);
  runInNewContext(store,context);
  return {win,doc,root,stored,cards,filters,search,count,empty,panel,shareInput,copy,status,copied};
}

test('Play Store shows six curated games and attaches local favorite/share controls',()=>{
  const p=playground();
  assert.equal(p.win.VetogramPlayCatalog.length,6);
  assert.ok(p.cards.every(c=>c.children.length===1));
  assert.ok(p.cards.every(c=>c.children[0].children.length===2));
  assert.match(html,/data-vp-filter="favorites"/);
});
test('Favorites persist only catalog ids and react to Favorites filter',()=>{
  const p=playground();
  p.cards[0].children[0].children[0].click();
  assert.deepEqual(JSON.parse(p.stored.get('vetogram:play:favorites:v1')),['blotenq']);
  p.filters[4].click();
  assert.deepEqual(p.cards.filter(c=>!c.hidden).map(c=>c.dataset.vpGame),['blotenq']);
  p.cards[0].children[0].children[0].click();
  assert.ok(p.cards.every(c=>c.hidden));
  assert.equal(p.empty.hidden,false);
});
test('Sharing is explicit and produces only an allowlisted catalog deep link',async()=>{
  const p=playground();
  p.cards[2].children[0].children[1].click();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(p.copied.length,1);
  const url=new URL(p.copied[0]);
  assert.equal(url.origin,'https://vetogram.example');
  assert.equal(url.searchParams.get('screen'),'play');
  assert.equal(url.searchParams.get('game'),'reaction');
  assert.equal(url.searchParams.has('token'),false);
  assert.equal(url.searchParams.has('initData'),false);
  assert.match(p.status.textContent,/скопирована/);
});

function developerFormHarness(){
  const ids=['#vpDeveloperForm','#vpDeveloperDraftLink','#vpDeveloperStatus',
    '#vpDeveloperName','#vpDeveloperRepo','#vpDeveloperMode','#vpDeveloperPitch'];
  const map=new Map(ids.map(id=>[id,element()]));
  const form=map.get('#vpDeveloperForm'),output=map.get('#vpDeveloperDraftLink');
  output.hidden=true;
  const root={querySelector:id=>map.get(id)||null};
  runInNewContext(developer,{document:{querySelector:key=>key==='.screen[data-screen="play"]'?root:null},URL});
  map.get('#vpDeveloperName').value='Проверочная игра';
  map.get('#vpDeveloperRepo').value='https://github.com/example/game';
  map.get('#vpDeveloperMode').value='solo';
  map.get('#vpDeveloperPitch').value='Безопасная мини-игра с лицензированными изображениями и без персональных данных.';
  return {map,form,output,status:map.get('#vpDeveloperStatus')};
}
test('Developer form prepares, but never submits a GitHub Issue',()=>{
  const p=developerFormHarness();
  p.form.events.submit({preventDefault(){}});
  assert.equal(p.output.hidden,false);
  const url=new URL(p.output.href);
  assert.equal(url.origin,'https://github.com');
  assert.equal(url.pathname,'/margaryanlabs/Telegram-story-bot/issues/new');
  assert.match(url.searchParams.get('title'),/Проверочная игра/);
  assert.match(url.searchParams.get('body'),/без персональных данных/);
  assert.match(p.status.textContent,/Ничего не отправлено/);
  p.form.events.input();
  assert.equal(p.output.hidden,true,'stale link should be invalidated after edits');
});
test('Developer form rejects http and URLs containing token query strings',()=>{
  const p=developerFormHarness();
  p.map.get('#vpDeveloperRepo').value='http://example.com/game';
  p.form.events.submit({preventDefault(){}});
  assert.equal(p.output.hidden,true);
  assert.match(p.status.textContent,/HTTPS/);
  p.map.get('#vpDeveloperRepo').value='https://github.com/example/game?token=PRIVATE';
  p.form.events.submit({preventDefault(){}});
  assert.equal(p.output.hidden,true);
  assert.match(p.status.textContent,/без параметров/);
});
test('Store and developer scripts never transmit data silently',()=>{
  for (const code of [store,developer]) {
    assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|sendMessage|initData|telegram-chats|document\.cookie/);
  }
  assert.match(html,/id="vpDeveloperForm"/);
  assert.match(html,/id="vpSharePanel"/);
});
