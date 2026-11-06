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
 const local=new Map(),winEvents={},docEvents={},intervals=new Map(),timeouts=new Map();let next=1;
 const root={
   dataset:{},classList:{contains:()=>true},
   querySelector:id=>nodes.get(id)||null,
   querySelectorAll:id=>id==='[data-vp-snake]'?arrows:[],
 };
 const document={
   hidden:false,
   querySelector:sel=>sel==='.screen[data-screen="play"]'?root:null,
   createElement:element,
   addEventListener:(name,handler)=>{const prev=docEvents[name];docEvents[name]=prev?(e=>{prev(e);handler(e);}):handler;}
 };
 const window={
   localStorage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v)},
   addEventListener:(name,handler)=>{const prev=winEvents[name];winEvents[name]=prev?(e=>{prev(e);handler(e);}):handler;}
 };
 runInNewContext(code,{
   document,window,Math,Set,Array,Number,String,
   setInterval:(fn)=>{const id=next++;intervals.set(id,fn);return id;},
   clearInterval:id=>intervals.delete(id),
   setTimeout:fn=>{const id=next++;timeouts.set(id,fn);return id;},
   clearTimeout:id=>timeouts.delete(id),
 });
 return {nodes,local,arrows,intervals,timeouts,winEvents,docEvents,document,root,
    step(){for(const fn of [...intervals.values()])fn();},
    flushHolds(){for(const [id,fn] of [...timeouts]){timeouts.delete(id);fn();}}
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

test('Snake keyboard never steals arrows from page, inputs or 2048',()=>{
 const g=makeGame(),grid=g.nodes.get('#vpSnakeGrid'),toggle=g.nodes.get('#vpSnakeToggle');
 toggle.click();
 const key=(tagName)=>{let prevented=0;g.docEvents.keydown({key:'ArrowUp',target:{tagName},preventDefault(){prevented++;}});return prevented;};
 assert.equal(key('BODY'),0,'Snake is not allowed to capture keys outside its dialog');
 grid.closest=selector=>selector==='.vp-game-in-dialog'?{}:null;
 assert.equal(key('INPUT'),0,'search field retains keyboard arrows');
 assert.equal(key('BODY'),1,'Snake captures arrows when its own modal is open');
 grid.closest=()=>null;
 assert.equal(key('BODY'),0,'keyboard is released on close');
 g.winEvents['vetogram:game-close']({detail:{game:'snake'}});
 assert.equal(g.intervals.size,0);
});

test('V9 inline Snake accepts arrows only when focused and running',()=>{
 const g=makeGame(),grid=g.nodes.get('#vpSnakeGrid');
 g.nodes.get('#vpSnakeToggle').click();
 grid.closest=()=>null;
 const key=()=>{let n=0;g.docEvents.keydown({key:'ArrowUp',target:{tagName:'BODY'},preventDefault(){n++;}});return n;};
 assert.equal(key(),0);
 g.root.dataset.v9ActiveGame='snake';
 assert.equal(key(),1);
 g.root.dataset.v9ActiveGame='2048';
 assert.equal(key(),0);
});

test('touch long press marks one Mines flag without opening or double-toggling',()=>{
 const g=makeGame(),btn=g.nodes.get('#vpMinesGrid').children[20];
 btn.events.pointerdown({pointerType:'touch'});
 assert.equal(g.timeouts.size,1);
 g.flushHolds();
 assert.equal(btn.textContent,'⚑');
 assert.equal(btn.className.includes('is-open'),false);
 btn.events.pointerup({});
 btn.click(); // WebView synthesizes a click after pointerup; must be ignored.
 assert.equal(btn.textContent,'⚑','the synthetic click must not remove the flag');
 assert.equal(g.nodes.get('#vpMinesRemaining').textContent,'Мины: 5');
 btn.events.pointerdown({pointerType:'touch'});
 btn.events.pointerup({});
 btn.click(); // flagged cells remain safe in reveal mode
 assert.equal(btn.textContent,'⚑');
 g.nodes.get('#vpMinesMode').click();
 btn.click(); // explicit flag mode can remove the mark
 assert.equal(btn.textContent,'');
});
test('touch tap and cancelled hold never place a Mines flag',()=>{
 const g=makeGame(),btn=g.nodes.get('#vpMinesGrid').children[10];
 btn.events.pointerdown({pointerType:'touch'});
 btn.events.pointercancel({});
 assert.equal(g.timeouts.size,0);
 btn.click();
 assert.notEqual(btn.textContent,'⚑');
 assert.equal(g.nodes.get('#vpMinesRemaining').textContent,'Мины: 6');
});

test('Mines hold timer cannot leak into reset, close or background state',()=>{
 const g=makeGame();
 let btn=g.nodes.get('#vpMinesGrid').children[12];
 btn.events.pointerdown({pointerType:'touch'});
 assert.equal(g.timeouts.size,1);
 g.nodes.get('#vpMinesReset').click();
 assert.equal(g.timeouts.size,0,'reset must cancel hold timers of removed grid buttons');
 btn=g.nodes.get('#vpMinesGrid').children[12];
 btn.events.pointerdown({pointerType:'touch'});
 g.winEvents['vetogram:game-close']({detail:{game:'mines'}});
 assert.equal(g.timeouts.size,0,'closing Mines must cancel pending touch actions');
 btn.events.pointerdown({pointerType:'touch'});
 g.document.hidden=true;g.docEvents.visibilitychange();
 assert.equal(g.timeouts.size,0,'backgrounding the app must cancel pending touch actions');
});
test('tapping revealed numbered Mines tile never opens neighbors without enough flags',()=>{
 const g=makeGame(),grid=g.nodes.get('#vpMinesGrid');
 grid.children[0].click();
 const numbered=grid.children.find(x=>x.className.includes('is-open')&&Number(x.dataset.count)>0);
 assert.ok(numbered,'a mine boundary should expose at least one numbered cell');
 const remaining=g.nodes.get('#vpMinesRemaining').textContent;
 numbered.click();
 assert.match(g.nodes.get('#vpMinesStatus').textContent,/Для раскрытия соседей отметь/);
 assert.equal(g.nodes.get('#vpMinesRemaining').textContent,remaining);
});
