import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const host=readFileSync(new URL('../public/vetogram-universe.js',import.meta.url),'utf8');
const start=host.indexOf(' function moduleStatus(');
const end=host.indexOf(' function destroyMedia(){',start);
assert.ok(start>0&&end>start,'Production module status function must exist');
const implementation=host.slice(start,end);
function harness(){
 const nodes={v6ModuleStatus:{textContent:'',hidden:true,dataset:{}},v6ModuleRetry:{hidden:true},
  v6Frames:{attributes:{},setAttribute(name,value){this.attributes[name]=value}}};
 const context={$:name=>nodes[name]};
 vm.runInNewContext(implementation+'\nthis.moduleStatus=moduleStatus;',context,
  {filename:'vetogram-module-status.js',timeout:1000});
 return {apply:context.moduleStatus,nodes};
}

test('genuine module load exposes a progress indicator and accessibility busy status',()=>{
 const h=harness();h.apply('Загружаем кино…');
 assert.equal(h.nodes.v6ModuleStatus.dataset.phase,'loading');
 assert.equal(h.nodes.v6ModuleStatus.hidden,false);
 assert.equal(h.nodes.v6Frames.attributes['aria-busy'],'true');
 assert.equal(h.nodes.v6ModuleRetry.hidden,true);
});

test('informational metadata notice does not trigger an endless spinner',()=>{
 const h=harness();h.apply('Найдены только сведения о треке',false,true);
 assert.equal(h.nodes.v6ModuleStatus.dataset.phase,'notice');
 assert.equal(h.nodes.v6Frames.attributes['aria-busy'],'false');
 assert.equal(h.nodes.v6ModuleRetry.hidden,true);
});

test('unavailable saved item is a notice, not a broken network iframe',()=>{
 assert.match(host,/message\.status==='search'\)moduleStatus\([^\n]*false,true\)/);
 assert.match(host,/message\.ok===false\)moduleStatus\([^\n]*false,true\)/);
});

test('real loading failures still permit manual retry without a busy flag',()=>{
 const h=harness();h.apply('Модуль недоступен',true);
 assert.equal(h.nodes.v6ModuleStatus.dataset.phase,'failed');
 assert.equal(h.nodes.v6Frames.attributes['aria-busy'],'false');
 assert.equal(h.nodes.v6ModuleRetry.hidden,false);
});

test('success hides previous warnings and clears status state',()=>{
 const h=harness();h.apply('Сведения найдены',false,true);h.apply('');
 assert.equal(h.nodes.v6ModuleStatus.dataset.phase,'ready');
 assert.equal(h.nodes.v6ModuleStatus.hidden,true);
 assert.equal(h.nodes.v6Frames.attributes['aria-busy'],'false');
});

test('notice visual state has no loading spinner animation',()=>{
 const css=readFileSync(new URL('../public/vetogram-universe.css',import.meta.url),'utf8');
 assert.match(css,/\.v6-module-status\[data-phase="notice"\]/);
 assert.match(css,/\.v6-module-status\[data-phase="loading"\]::before/);
 assert.doesNotMatch(css,/\.v6-module-status\[data-phase="notice"\]::before/);
});
