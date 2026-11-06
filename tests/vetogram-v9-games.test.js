import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const html=read('studio.html');
const play=read('vetogram-play.js');
const css=read('vetogram-v9-games.css');
const legacy=read('vetogram-play.css');
const ids=['reaction','pairs','tic','2048','mines','snake'];
const begin=play.indexOf('  // V9 Games: one premium catalog');
assert.ok(begin>=0,'V9 block must exist');
const block=play.slice(begin,play.lastIndexOf('\n})();'));

function element(){
  const listeners={};
  return {
    hidden:false,disabled:false,textContent:'',dataset:{},events:listeners,attrs:{},open:false,
    addEventListener:(type,fn)=>listeners[type]=fn,
    setAttribute(k,v){this.attrs[k]=v;},
    click(){this.events.click?.();},
    focus(){this.focused=true;},
    scrollIntoView(){this.scrolled=true;},
    querySelector(){return null;},
    querySelectorAll(){return [];}
  };
}
function harness({storage=new Map(),denied=false,user='42'}={}){
  const nodes=new Map(['v9ArcadeLauncher','v9ArcadeBack','vpQuickGames',
    'v9ArcadeResume','v9ArcadeResumeLabel','v9ArcadeResumeButton','v9GameCreate']
    .map(id=>['#'+id,element()]));
  const buttons=ids.map(id=>{const b=element();b.dataset.v9Launch=id;return b;});
  nodes.get('#v9ArcadeLauncher').querySelectorAll=()=>buttons;
  const cards=ids.map(id=>{const card=element();card.dataset.vpGame=id;return card;});
  const details=element(),summary=element(),developer=element();
  details.querySelector=selector=>selector==='summary'?summary:null;
  developer.querySelector=selector=>selector==='.vp-dev-details'?details:null;
  const classes=new Set(),listeners={},emitted=[];
  const root={
    dataset:{},
    classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v)},
    querySelectorAll:selector=>selector==='#vpQuickGames > .vp-mini[data-vp-game]'?cards:[],
    querySelector:selector=>selector==='.vp-developer'?developer:null
  };
  const web={initData:'signed',initDataUnsafe:{user:{id:user}}};
  const window={
    Telegram:{WebApp:web},
    localStorage:{
      getItem(key){if(denied)throw Error('storage denied');return storage.get(key)||null;},
      setItem(key,value){if(denied)throw Error('storage denied');storage.set(key,value);}
    },
    matchMedia:()=>({matches:true}),
    addEventListener:(type,fn)=>listeners[type]=fn,
    dispatchEvent:event=>emitted.push({type:event.type,detail:event.detail})
  };
  class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail;}}
  const $=selector=>nodes.get(selector)||null;
  runInNewContext('(function(){\'use strict\';\n'+block+'\n})()',
    {window,root,$,CustomEvent,haptic(){}},{timeout:1500});
  return {nodes,buttons,cards,root,classes,listeners,emitted,storage,window,details,summary,developer};
}
test('six unique offline launcher buttons have original embedded vector covers',()=>{
  assert.equal((html.match(/class="v9-cover-art"/g)||[]).length,6);
  for(const id of ids)assert.match(html,new RegExp('data-v9-launch="'+id+'"'));
  assert.match(html,/v9ArcadeResumeButton/);
  assert.match(html,/v9GameCreate/);
  assert.match(html,/НА ПОДХОДЕ \/ НЕ ЗАПУЩЕНЫ/);
  assert.doesNotMatch(html,/class="v9-cover-art"[^]*?<img[^>]+src="https?:/);
});
test('real game controls remain visible in V9 inline focused mode',()=>{
  assert.match(legacy,/\.vp-screen:not\(\.v9-arcade-active\) \.vp-mini\[data-vp-game\]/);
  assert.match(css,/\.v9-arcade-active #vpQuickGames \.vp-mini>/);
  assert.match(css,/\.vp-open-game\{\s*display:none !important;/);
  for(const selector of ['vp-memory-grid','vp-ttt-grid','vp-2048-grid','v73-mines-grid','v73-snake-grid'])assert.match(css,new RegExp(selector));
  assert.match(css,/V7 card-preview CSS also hid native controls/);
  assert.match(css,/display:grid !important/);
  assert.match(css,/display:flex !important/);
  assert.match(play,/vetogram:game-close/);
});
test('enhanced catalog starts with six real games and no accidental autoplay',()=>{
  const h=harness();
  assert.equal(h.classes.has('v9-arcade-enhanced'),true);
  assert.equal(h.nodes.get('#v9ArcadeLauncher').hidden,false);
  assert.equal(h.nodes.get('#v9ArcadeResume').hidden,true);
  assert.equal(h.root.dataset.v9ActiveGame,undefined);
  assert.equal(h.cards.filter(c=>c.hidden).length,0);
  assert.equal(h.emitted.length,0);
});
test('all six launch buttons open the existing inline game and Back restores catalog',()=>{
  const h=harness();
  for(const id of ids){
    const b=h.buttons.find(x=>x.dataset.v9Launch===id);
    b.click();
    assert.equal(h.root.dataset.v9ActiveGame,id);
    assert.equal(h.classes.has('v9-arcade-active'),true);
    assert.deepEqual(h.cards.filter(x=>!x.hidden).map(x=>x.dataset.vpGame),[id]);
    assert.equal(h.nodes.get('#v9ArcadeBack').focused,true);
    h.nodes.get('#v9ArcadeBack').click();
    assert.equal(h.root.dataset.v9ActiveGame,undefined);
    assert.equal(h.cards.filter(x=>x.hidden).length,0);
    assert.equal(b.focused,true);
  }
  assert.equal(h.emitted.filter(e=>e.type==='vetogram:game-close').length,6);
});
test('last played game resumes on same owner only; invalid values are discarded',()=>{
  const storage=new Map();
  const h=harness({storage,user:'42'});
  h.buttons[3].click();
  assert.equal(storage.get('vetogram:play:last-game:v9:owner-42'),'2048');
  h.nodes.get('#v9ArcadeBack').click();
  assert.equal(h.nodes.get('#v9ArcadeResumeLabel').textContent,'2048');
  h.nodes.get('#v9ArcadeResumeButton').click();
  assert.equal(h.root.dataset.v9ActiveGame,'2048');
  const other=harness({storage,user:'43'});
  assert.equal(other.nodes.get('#v9ArcadeResume').hidden,true);
  storage.set('vetogram:play:last-game:v9:owner-43','blotenq');
  const invalid=harness({storage,user:'43'});
  assert.equal(invalid.nodes.get('#v9ArcadeResume').hidden,true);
});
test('storage denial never prevents opening an offline game',()=>{
  const h=harness({denied:true});
  h.buttons[0].click();
  assert.equal(h.root.dataset.v9ActiveGame,'reaction');
  assert.equal(h.nodes.get('#v9ArcadeResume').hidden,true);
});
test('developer CTA reveals existing opt-in proposal form without submitting',()=>{
  const h=harness();
  h.nodes.get('#v9GameCreate').click();
  assert.equal(h.details.open,true);
  assert.equal(h.developer.scrolled,true);
  assert.equal(h.summary.focused,true);
});
test('leaving Play stops current game and does not erase resume',()=>{
  const h=harness();
  h.buttons[5].click();
  h.listeners['veto:screen-changed']({detail:{screen:'chat'}});
  assert.equal(h.root.dataset.v9ActiveGame,undefined);
  assert.equal(h.emitted.some(e=>e.type==='vetogram:game-close'&&e.detail.game==='snake'),true);
  assert.equal(h.nodes.get('#v9ArcadeResumeLabel').textContent,'Змейка');
});
test('responsive, reduced-motion and light themes preserve accessible controls',()=>{
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:400px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/data-veto-theme="pearl"/);
  assert.match(css,/data-veto-theme="linen"/);
  assert.match(css,/Focused game controls must remain legible in Pearl\/Linen/);
  assert.match(css,/\.v9-arcade-active #vpQuickGames \.vp-mini :is\(h3,p,\.vp-mini-stat/);
  assert.match(css,/:focus-visible/);
  assert.match(html,/vetogram-v9-games\.css\?v=20261105-v9-games-01/);
  assert.match(html,/vetogram-play\.js\?v=20261105-v9-games-01/);
  assert.match(html,/vetogram-play\.css\?v=20261105-v9-games-01/);
  assert.match(html,/vetogram-play-arcade\.js\?v=20261105-v9-games-01/);
  assert.match(html,/vetogram-play-plus\.js\?v=20261105-v9-games-01/);
});
