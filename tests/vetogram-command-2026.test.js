import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/vetogram-command-2026.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/vetogram-2026.css',import.meta.url),'utf8');

function element(id,textContent=''){
  const handlers=new Map();
  return {id,textContent,hidden:false,disabled:false,open:false,value:'',
    dataset:{},handlers,focused:false,
    addEventListener(type,callback){handlers.set(type,callback)},
    focus(){this.focused=true},
    click(){handlers.get('click')?.({target:this})},
    setAttribute(name,value){this[name]=value},
    close(){this.open=false},
    showModal(){this.open=true},
    querySelectorAll(){return []}
  };
}
function instance({withNavigate=true}={}){
  const keys=['vg26CommandDialog','vg26CommandOpen','vg26CommandSearch',
    'vg26CommandEmpty','vg26CommandClose'];
  const el=Object.fromEntries(keys.map(k=>[k,element(k)]));
  const destinations=['telegram','privacy','story-engine','ai','connect'];
  const items=destinations.map(v=>{
    const e=element(v,'Открыть '+v);
    e.dataset={vg26Destination:v,vg26Keywords:v==='telegram'?'чаты сообщения':v};
    return e;
  });
  el.vg26CommandDialog.querySelectorAll=()=>items;
  const calls=[];
  const document={
    activeElement:el.vg26CommandOpen,
    listeners:new Map(),
    getElementById:id=>el[id]||null,
    querySelector:()=>null,
    addEventListener(type,fn){this.listeners.set(type,fn)}
  };
  const window={VetoTelegramOpenAccountConnection:()=>{calls.push('connect')}};
  if(withNavigate)window.VetoTelegramNavigate=screen=>{calls.push(screen);return true};
  vm.runInNewContext(source,vm.createContext({document,window}));
  function key(key,mods={}){let prevented=false;
    document.listeners.get('keydown')?.({
      key,ctrlKey:!!mods.ctrlKey,metaKey:!!mods.metaKey,
      altKey:false,defaultPrevented:false,target:mods.target||el.vg26CommandOpen,
      preventDefault(){prevented=true}
    });return prevented;
  }
  return {el,items,calls,key,window};
}
test('command opens on tap and Escape closes, restoring originating focus',()=>{
  const f=instance();
  f.el.vg26CommandOpen.click();
  assert.equal(f.el.vg26CommandDialog.open,true);
  assert.equal(f.el.vg26CommandSearch.focused,true);
  f.key('Escape');
  assert.equal(f.el.vg26CommandDialog.open,false);
  assert.equal(f.el.vg26CommandOpen.focused,true);
});
test('keyboard search filters the existing tools without reading or sending messages',()=>{
  const f=instance();
  assert.equal(f.key('k',{ctrlKey:true}),true);
  assert.equal(f.el.vg26CommandDialog.open,true);
  f.el.vg26CommandSearch.value='чаты';
  f.el.vg26CommandSearch.handlers.get('input')();
  assert.equal(f.items[0].hidden,false);
  assert.equal(f.items[1].hidden,true);
  assert.equal(f.calls.length,0);
  f.el.vg26CommandSearch.handlers.get('keydown')({key:'Enter',preventDefault(){}});
  assert.deepEqual(f.calls,['telegram']);
  assert.equal(f.el.vg26CommandDialog.open,false);
});
test('search with no matching tools displays a helpful empty state',()=>{
  const f=instance();f.el.vg26CommandOpen.click();
  f.el.vg26CommandSearch.value='zz-nonexistent';
  f.el.vg26CommandSearch.handlers.get('input')();
  assert.equal(f.el.vg26CommandEmpty.hidden,false);
  assert.ok(f.items.every(el=>el.hidden));
});
test('connection helper requires an explicit click and never runs from search or open',()=>{
  const f=instance();f.el.vg26CommandOpen.click();
  f.el.vg26CommandSearch.value='connect';
  f.el.vg26CommandSearch.handlers.get('input')();
  assert.deepEqual(f.calls,[]);
  f.items.find(x=>x.dataset.vg26Destination==='connect').click();
  assert.deepEqual(f.calls,['connect']);
});
test('navigation failure preserves menu and still allows another tool',()=>{
  const f=instance();
  f.window.VetoTelegramNavigate=screen=>{
    f.calls.push(screen);
    return screen!=='privacy';
  };
  f.el.vg26CommandOpen.click();
  f.items.find(x=>x.dataset.vg26Destination==='privacy').click();
  assert.equal(f.el.vg26CommandDialog.open,true);
  f.items.find(x=>x.dataset.vg26Destination==='ai').click();
  assert.equal(f.el.vg26CommandDialog.open,false);
  assert.deepEqual(f.calls,['privacy','ai']);
});
test('integration stays within app navigation and has an accessible search modal',()=>{
  assert.match(html,/id="vg26CommandOpen"/);
  assert.match(html,/id="vg26CommandDialog" aria-labelledby="vg26CommandTitle"/);
  assert.match(html,/id="vg26CommandSearch" type="search"/);
  assert.match(html,/src="\/vetogram-command-2026\.js/);
  assert.match(html,/href="\/vetogram-2026\.css/);
  assert.match(html,/class="vg26-inbox-shortcuts"/);
  assert.match(css,/\.vg26-command-dialog::backdrop/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.doesNotMatch(source,/localStorage|sessionStorage|fetch\(|XMLHttpRequest/);
});


test('all declarative navigation buttons point to real screens, including Story Engine and Vault',()=>{
  const actualScreens=[...html.matchAll(/<section[^>]+data-screen="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(new Set(actualScreens).size,actualScreens.length);
  const allButtons=[...html.matchAll(/data-open-screen="([^"]+)"/g)].map(x=>x[1]);
  const missing=allButtons.filter(x=>!actualScreens.includes(x));
  assert.deepEqual(missing,[]);
  assert.ok(actualScreens.includes('publish'));
  assert.ok(actualScreens.includes('privacy'));
  assert.ok(actualScreens.includes('studio'));
  assert.doesNotMatch(html,/data-open-screen="(?:stories|ghost|creator)"/);
});
