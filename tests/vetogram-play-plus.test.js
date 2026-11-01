import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../public/vetogram-play-plus.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
const style=readFileSync(new URL('../public/vetogram-showcase-v72.css',import.meta.url),'utf8');
function element() {
 return {
   textContent:'',className:'',dataset:{},disabled:false,children:[],attributes:{},events:{},
   setAttribute(k,v){this.attributes[k]=v;},
   appendChild(child){this.children.push(child);},
   replaceChildren(){this.children=[];},
   addEventListener(k,fn){this.events[k]=fn;},
   click(){if(!this.disabled)this.events.click?.({preventDefault(){}});}
 };
}
function makeGame(){
 const ids=['vpMinesGrid','vpMinesStatus','vpMinesMode','vpMinesReset','vpMinesRemaining','vpMinesWins','vpSnakeGrid','vpSnakeStatus','vpSnakeScore','vpSnakeBest','vpSnakeToggle','vpSnakeReset'];
 const nodes=new Map(ids.map(id=>['#'+id,element()]));
 const arrows=['left','right','up','down'].map(dir=>{const n=element();n.dataset.vpSnake=dir;return n;});
 const local=new Map(),winEvents={},docEvents={},intervals=new Map();let next=1;
 const root={
   querySelector:id=>nodes.get(id)||null,
   querySelectorAll:id=>id==='[data-vp-snake]'?arrows:[],
 };
 const document={
   hidden:false,
   querySelector:sel=>sel==='.screen[data-screen="play"]'?root:null,
   createElement:element,
   addEventListener:(name,handler)=>{docEvents[name]=handler;}
 };
 const window={
   localStorage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v)},
   addEventListener:(name,handler)=>{winEvents[name]=handler;}
 };
 runInNewContext(code,{
   document,window,Math,Set,Array,Number,String,
   setInterval:(fn)=>{const id=next++;intervals.set(id,fn);return id;},
   clearInterval:id=>intervals.delete(id),
 });
 return {nodes,local,arrows,intervals,winEvents,docEvents,document,
    step(){for(const fn of [...intervals.values()])fn();}
 };
}
test('all six local games have a real launch surface and offline game contract',()=>{
 for(const name of ['reaction','pairs','tic','2048','mines','snake'])assert.match(html,new RegExp('data-vp-game="'+name+'"'));
 assert.match(html,/vetogram-play-plus\.js/);
 assert.match(style,/\.v73-mines-grid/);
 assert.match(style,/\.v73-snake-grid/);
 assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|initData|sendMessage|postMessage|document\.cookie/);
});
test('Mines first opened square is safe, flagging works, reset clears the field',()=>{
 const g=makeGame();
 const grid=g.nodes.get('#vpMinesGrid'),mode=g.nodes.get('#vpMinesMode');
 assert.equal(grid.children.length,36);
 mode.click();assert.equal(mode.attributes['aria-pressed'],'true');
 grid.children[35].click();assert.equal(grid.children[35].textContent,'⚑');
 mode.click();grid.children[0].click();
 assert.match(grid.children[0].className,/is-open/);
 assert.doesNotMatch(grid.children[0].className,/is-mine/);
 assert.equal(grid.children.filter(x=>x.className.includes('is-mine')).length,0);
 g.nodes.get('#vpMinesReset').click();
 assert.equal(grid.children.length,36);
 assert.equal(grid.children.filter(x=>x.className.includes('is-open')).length,0);
});
test('Snake starts only on demand, eats food, stores best, pauses on close',()=>{
 const g=makeGame();
 assert.equal(g.nodes.get('#vpSnakeGrid').children.length,144);
 assert.equal(g.intervals.size,0);
 g.nodes.get('#vpSnakeToggle').click();assert.equal(g.intervals.size,1);
 for(let i=0;i<4;i++)g.step();
 assert.equal(g.nodes.get('#vpSnakeScore').textContent,'Очки: 10');
 assert.equal(g.local.get('vetogram:play:snake-best:v1'),'10');
 g.winEvents['vetogram:game-close']({detail:{game:'snake'}});
 assert.equal(g.intervals.size,0);
 g.nodes.get('#vpSnakeToggle').click();assert.equal(g.intervals.size,1);
 g.nodes.get('#vpSnakeReset').click();assert.equal(g.intervals.size,0);
 assert.equal(g.nodes.get('#vpSnakeScore').textContent,'Очки: 0');
});
test('Snake prevents immediate reversal and pauses when backgrounded',()=>{
 const g=makeGame();
 g.nodes.get('#vpSnakeToggle').click();
 g.arrows.find(x=>x.dataset.vpSnake==='left').click();
 g.step();
 assert.equal(g.nodes.get('#vpSnakeGrid').children[79].className.includes('is-head'),true);
 g.document.hidden=true;
 g.docEvents.visibilitychange();
 assert.equal(g.intervals.size,0);
 assert.match(g.nodes.get('#vpSnakeStatus').textContent,/Пауза/);
});
