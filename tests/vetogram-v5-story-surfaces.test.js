import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/vetogram-noir.js',import.meta.url),'utf8');
function controller({missingStrip=false}={}){
  const events=new Map(),moves=[];
  const style={values:{},setProperty(k,v){this.values[k]=v;}};
  const root={classList:{add(){}},style,dataset:{}};
  const nav={hidden:false,classList:{contains:()=>false},getBoundingClientRect:()=>({height:65})};
  const action={hidden:true,classList:{contains:()=>true},getBoundingClientRect:()=>({height:100})};
  const refresh={focus(x){this.focused=x;}};
  const target={appendChild(el){el.parentElement=this;moves.push('stories');},querySelector:()=>refresh,scrollIntoView(x){this.scrolled=x;}};
  const inbox={querySelector(){return heading;}};
  const strip={parentElement:inbox};
  const heading={insertAdjacentElement(where,el){assert.equal(where,'afterend');el.parentElement=inbox;moves.push('inbox');}};
  const watch={addEventListener(k,v){this[k]=v;}};
  const orb={dataset:{},setAttribute(k,v){this[k]=v;}};
  const ids={actionDock:action,v5StoriesWatch:target,telegramChatsView:inbox,v5StoriesWatchButton:watch,vetoOrb:orb};
  const doc={documentElement:root,getElementById:k=>ids[k],querySelectorAll:()=>[],querySelector:s=>s==='.bottom-nav'?nav:s==='.veto-story-strip'?(missingStrip?null:strip):s==='.screen.active'?{dataset:{screen:'telegram'}}:null};
  const window={addEventListener(k,v){events.set(k,v);},matchMedia:()=>({matches:true})};
  vm.runInNewContext(source,{document:doc,window,getComputedStyle:()=>({display:'block'}),requestAnimationFrame:f=>f(),Math});
  return {events,moves,strip,target,inbox,watch,root,orb};
}
test('the existing Story strip keeps its identity across Stories, Chats and other modules',()=>{
 const c=controller(),identity=c.strip;
 c.events.get('veto:screen-changed')({detail:{screen:'publish'}});
 assert.equal(c.strip,identity);assert.equal(c.strip.parentElement,c.target);
 c.events.get('veto:screen-changed')({detail:{screen:'publish'}});
 assert.deepEqual(c.moves,['stories']);
 c.events.get('veto:screen-changed')({detail:{screen:'ai'}});
 assert.equal(c.strip.parentElement,c.inbox);assert.deepEqual(c.moves,['stories','inbox']);
});
test('missing optional Stories controller does not break navigation of independent modules',()=>{
 const c=controller({missingStrip:true});
 assert.doesNotThrow(()=>c.events.get('veto:screen-changed')({detail:{screen:'voice'}}));
 assert.equal(c.root.dataset.noirScreen,'voice');assert.deepEqual(c.moves,[]);
});
test('watch navigation focuses existing refresh control without requesting media or starting playback',()=>{
 const c=controller();c.watch.click();
 assert.equal(c.target.scrolled.behavior,'auto');
 assert.equal(c.target.scrolled.block,'start');
 assert.equal(c.target.querySelector().focused.preventScroll,true);
 assert.deepEqual(c.moves,[]);
});
test('chrome spacing measures only visible controls and the AI indicator requires a real busy event',()=>{
 const c=controller();
 assert.equal(c.root.style.values['--noir-nav-height'],'65px');
 assert.equal(c.root.style.values['--noir-action-height'],'0px');
 assert.equal(c.orb.dataset.busy,undefined);
 c.events.get('vetogram:ai-busy')({detail:{busy:true}});
 assert.equal(c.orb.dataset.busy,'true');
 c.events.get('vetogram:ai-busy')({detail:{busy:false}});
 assert.equal(c.orb.dataset.busy,'false');
});
