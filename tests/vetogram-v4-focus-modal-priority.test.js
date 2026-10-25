/* V4.8 Studio focus and modal-priority regression on real production handler.
 * Tests DOM events with minimal deterministic DOM; not a visual screenshot. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../public/vetogram-experience-v4.js',import.meta.url),'utf8');
const section=src.slice(src.indexOf('  const exitFocus = () => {'),
  src.indexOf('  const accessibleStatus ='));
assert.match(section,/document\.addEventListener\('keydown'/);

function focusHarness(){
  const elements=new Map(),listeners=new Map(),announcements=[];
  const clazz=()=>{const names=new Set();return {
    add(...n){n.forEach(x=>names.add(x))},
    remove(...n){n.forEach(x=>names.delete(x))},
    contains:n=>names.has(n),
    toggle(n){const yes=!names.has(n);if(yes)names.add(n);else names.delete(n);return yes},
  }};
  const el=id=>{
    if(!elements.has(id)){
      const handlers={};
      elements.set(id,{
        id,textContent:'',hidden:false,type:'',className:'',
        classList:clazz(),dataset:{},isConnected:true,
        attributes:{},setAttribute(k,v){this.attributes[k]=v},
        getAttribute(k){return this.attributes[k]},
        focus(){this.focusCount=(this.focusCount||0)+1},
        addEventListener(name,fn){handlers[name]=fn},
        emit(name,arg={}){handlers[name]?.(arg)},
        append(){},prepend(){},click(){this.emit('click')},
        closest(){return null},querySelector(){return null},
      });
    }
    return elements.get(id);
  };
  const engine=el('seEngine');engine.classList.add('active');
  const stage=el('stage'),actions=el('canvasActions'),controls=el('controls');
  const body={classList:clazz()},sheet=el('sheet');sheet.hidden=true;
  const doc={
    body,activeElement:el('originalFocus'),
    createElement:tag=>el('created-'+tag+'-'+elements.size),
    querySelector:selector=>selector==='dialog[open]'?doc.openDialog?el('dialog'):null:null,
    addEventListener(name,fn){listeners.set('doc:'+name,fn)}
  };
  const win={addEventListener(name,fn){listeners.set('win:'+name,fn)}};
  const byId=id=>elements.get(id)||null;
  const $=(selector,base)=>{
    if(base!==engine)return null;
    if(selector==='.se-stage')return stage;
    if(selector==='.noir-canvas-actions')return actions;
    if(selector==='.se-controls')return controls;
    return null;
  };
  const ctx=vm.createContext({
    engine,stage,canvasActions:actions,controls,byId,$,document:doc,window:win,
    announce:msg=>announcements.push(msg),
    lastFocus:null,focusActive:false,
    CustomEvent:class {},
  });
  new vm.Script(section+'\nthis.exports={exitFocus,isFocused:()=>focusActive};').runInContext(ctx);
  const sendEscape=()=>{
    let prevented=false;
    listeners.get('doc:keydown')?.({key:'Escape',preventDefault(){prevented=true}});
    return prevented;
  };
  return {ctx,el,body,sheet,doc,engine,listeners,announcements,sendEscape,
    focusButton:el('v4CanvasFocus'),toolsButton:el('v4CanvasTools'),
    ...ctx.exports};
}

test('Escape closes only modal, leaving active full-screen editor untouched',()=>{
  const v=focusHarness();
  v.focusButton.emit('click');
  assert.equal(v.isFocused(),true);
  v.sheet.hidden=false;
  assert.equal(v.sendEscape(),false,'V4 handler must let shared modal consume Escape');
  assert.equal(v.isFocused(),true);
  assert.equal(v.body.classList.contains('v4-lock-scroll'),true);
});
test('after modal closes Escape dismisses tools then exits full-screen',()=>{
  const v=focusHarness();
  v.focusButton.emit('click');
  v.toolsButton.emit('click');
  assert.equal(v.engine.classList.contains('v4-studio-tools-open'),true);
  assert.equal(v.sendEscape(),true);
  assert.equal(v.isFocused(),true);
  assert.equal(v.engine.classList.contains('v4-studio-tools-open'),false);
  assert.equal(v.sendEscape(),true);
  assert.equal(v.isFocused(),false);
  assert.equal(v.body.classList.contains('v4-lock-scroll'),false);
});
test('screen switch leaves no fullscreen body lock or hidden-editor focus restoration',()=>{
  const v=focusHarness();
  v.focusButton.emit('click');
  const before=v.el('originalFocus').focusCount||0;
  v.engine.classList.remove('active');
  v.listeners.get('win:veto:screen-changed')?.({detail:{screen:'ai'}});
  assert.equal(v.isFocused(),false);
  assert.equal(v.body.classList.contains('v4-lock-scroll'),false);
  assert.equal(v.el('originalFocus').focusCount||0,before);
});
test('open native dialog also has priority over V4 full-screen Escape',()=>{
  const v=focusHarness();
  v.focusButton.emit('click');
  v.doc.openDialog=true;
  assert.equal(v.sendEscape(),false);
  assert.equal(v.isFocused(),true);
});
test('V4 source keeps the real editor, one body lock and actual modal order',()=>{
  assert.match(section,/engine\.classList\.contains\('active'\) && lastFocus\?\.isConnected/);
  assert.match(section,/byId\('sheet'\)\?\.hidden!==false/);
  assert.match(section,/!document\.querySelector\('dialog\[open\]'\)/);
  assert.doesNotMatch(section,/setTimeout\(.*publish_story/);
});
