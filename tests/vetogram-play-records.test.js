import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const js=readFileSync(new URL('../public/vetogram-play-records.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/vetogram-play.css',import.meta.url),'utf8');
function fixture(){
 const keys=['Reaction','Pairs','Tic','2048','Mines','Snake'];
 const elements=Object.fromEntries(keys.map(key=>['#v74Score'+key,{textContent:''}]));
 const saved=new Map(),calls=[],events={};
 const surprise={events:{},addEventListener(k,fn){this.events[k]=fn;},click(){this.events.click?.();}};
 const search={value:'old game'},all={click(){calls.push('reset-filter')}};
 const buttons=['reaction','pairs','tic','2048','mines','snake'].map(id=>({
   dataset:{v74Launch:id},events:{},addEventListener(k,fn){this.events[k]=fn;},
   click(){this.events.click?.();}
 }));
 const cards=buttons.map(b=>({dataset:{vpGame:b.dataset.v74Launch},hidden:false,
   querySelector(sel){return sel==='.vp-open-game'?{click(){calls.push(b.dataset.v74Launch);}}:null;}
 }));
 const root={
   querySelector(selector){return elements[selector]||(selector==='#vpGameSearch'?search:selector==='[data-vp-filter="all"]'?all:selector==='#v75SurpriseMe'?surprise:null);},
   querySelectorAll(selector){return selector==='[data-v74-launch]'?buttons:selector==='.vp-mini[data-vp-game]'?cards:[];}
 };
 const window={
   localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,String(v))},
   addEventListener:(k,fn)=>{events[k]=fn;}
 };
 const document={querySelector:sel=>sel==='.screen[data-screen="play"]'?root:null};
 runInNewContext(js,{document,window,Math,Number,Set,Array,String,Object});
 return {elements,saved,calls,search,buttons,events,cards,surprise};
}
test('all 6 stats refer only to original local scores with safe empty values',()=>{
 const x=fixture();
 assert.equal(x.elements['#v74ScoreReaction'].textContent,'—');
 assert.equal(x.elements['#v74ScoreTic'].textContent,'0');
 x.saved.set('vetogram:play:reaction-best:v1','237');
 x.saved.set('vetogram:play:memory-best:v1','9');
 x.saved.set('vetogram:play:tic-wins:v1','5');
 x.saved.set('vetogram:play:2048-best:v1','1024');
 x.saved.set('vetogram:play:mines-wins:v1','2');
 x.saved.set('vetogram:play:snake-best:v1','90');
 x.events['vetogram:game-close']();
 for(const [key,v] of Object.entries({Reaction:'237',Pairs:'9',Tic:'5','2048':'1024',Mines:'2',Snake:'90'})){
   assert.equal(x.elements['#v74Score'+key].textContent,v);
 }
 x.saved.set('vetogram:play:snake-best:v1','NaN');
 x.events.focus();
 assert.equal(x.elements['#v74ScoreSnake'].textContent,'0');
});
test('record buttons clear stale catalog filter and reuse the real native runner',()=>{
 const x=fixture();
 x.buttons.find(b=>b.dataset.v74Launch==='snake').click();
 assert.equal(x.search.value,'');
 assert.deepEqual(x.calls,['reset-filter','snake']);
});
test('all links and game stat tiles are data-local and accessible',()=>{
 assert.match(html,/id="vpLocalStats"/);
 for(const id of ['reaction','pairs','tic','2048','mines','snake'])
   assert.match(html,new RegExp('data-v74-launch="'+id+'"'));
 assert.match(html,/vetogram-play-records\.js\?v=20261101-rebuild04/);
 assert.match(html,/Только на этом устройстве/);
 assert.match(css,/:not\(\.vp-game-art\)/,'game art must be visible in the catalog');
 assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|initData|telegram-chats|sessionStorage|sendMessage|postMessage|document\.cookie/);
});

test('surprise selects only a built-in local game via the original game runner',()=>{
 const x=fixture();
 x.surprise.click();
 assert.equal(x.calls[0],'reset-filter');
 assert.ok(['reaction','pairs','tic','2048','mines','snake'].includes(x.calls[1]));
 assert.equal(x.calls.length,2);
 assert.match(html,/id="v75SurpriseMe"/);
});
