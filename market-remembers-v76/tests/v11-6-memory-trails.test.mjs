import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext,Script} from 'node:vm';

const source=await readFile(new URL('../v10/memory-trails.js',import.meta.url),'utf8');
const css=await readFile(new URL('../v10/memory-trails-v11.css',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const app=await readFile(new URL('../v10/living-universe.js',import.meta.url),'utf8');
const curated=[
  {id:'orbit',alias:'ORBIT',category:'FOMO',type:'fictional',local:false},
  {id:'northstar',alias:'NORTHSTAR',category:'Patience',type:'editorial',local:false},
  {id:'legend',alias:'SOURCE',category:'Risk',type:'legend',local:false}
];
const mine={id:'my-private-id',alias:'PRIVATE',type:'fictional',local:true};

function setup(throwStorage=false){
  const writes=[];
  const values=new Map();
  const storage={
    getItem:key=>{if(throwStorage)throw Error('disabled');return values.get(key)||null;},
    setItem:(key,value)=>{if(throwStorage)throw Error('disabled');writes.push([key,value]);values.set(key,value);}
  };
  const context={window:{localStorage:storage,MarketV10:{data:{themes:{FOMO:'FOMO',Patience:'Терпение',Risk:'Риск'}}}}};
  runInNewContext(source,context);
  return {model:context.window.MarketV10.trails.createModel(storage),storage,writes,values};
}
const ids=records=>Array.from(records,record=>String(record.id));

test('V11.6 adds memory trails only after V11.5 without replacing scene or reader',()=>{
  assert.doesNotThrow(()=>new Script(source));
  assert.match(html,/(?:MEMORY TRAILS \/ OBSERVATORY № 11\.6|EXPLAINABLE CONSTELLATIONS \/ OBSERVATORY № 11\.7)/);
  assert.match(html,/v10\/memory-trails-v11\.css/);
  assert.match(html,/v10\/memory-trails\.js/);
  assert.match(html,/v10\/memory-atlas-v11\.css/);
  assert.ok(html.indexOf('v10/memory-trails.js')<html.indexOf('v10/living-universe.js'));
  assert.match(app,/V\.trails\.onStory\(record,shared\)/);
  assert.match(app,/V\.trails\.mountArchive\(shared\)/);
  assert.match(app,/travel\(record\)/);
});
test('Visiting curated and private stars does not write without explicit save',()=>{
  const {model,writes}=setup();
  model.visit(curated[0]);model.visit(curated[1]);model.visit(mine);
  assert.deepEqual(ids(model.viewed([...curated,mine])),['orbit','northstar','my-private-id']);
  assert.equal(writes.length,0);
});
test('Session route deduplicates consecutive IDs and stays within seven stars',()=>{
  const {model}=setup();
  model.visit(curated[0]);model.visit(curated[0]);
  assert.equal(model.viewed(curated).length,1);
  const extra=Array.from({length:9},(_,i)=>({id:'extra'+i,type:'fictional'}));
  extra.forEach(record=>model.visit(record));
  assert.deepEqual(ids(model.viewed([...curated,...extra])),extra.slice(-7).map(record=>record.id));
});
test('Saving after explicit click persists IDs only, never aliases or story text',()=>{
  const {model,writes,values}=setup();
  model.visit(curated[0]);model.visit(curated[1]);
  assert.equal(model.save(curated).ok,true);
  assert.equal(writes.length,1);
  const raw=[...values.values()][0];
  const stored=JSON.parse(raw);
  assert.equal(stored.version,1);
  assert.deepEqual(Array.from(stored.routes[0].ids),['orbit','northstar']);
  assert.doesNotMatch(raw,/ORBIT|NORTHSTAR|alias|quote|story/);
  assert.equal(model.saved(curated).length,1);
  assert.equal(model.save(curated).duplicate,true);
  assert.equal(writes.length,1);
});
test('A private star prevents route persistence and is never written',()=>{
  const {model,writes}=setup();
  model.visit(curated[0]);model.visit(mine);
  const result=model.save([...curated,mine]);
  assert.equal(result.ok,false);
  assert.match(result.reason,/личной записью/);
  assert.equal(writes.length,0);
  model.reset(curated[0]);model.visit(curated[1]);
  assert.equal(model.save([...curated,mine]).ok,true);
  assert.equal(writes.length,1);
  assert.doesNotMatch(writes[0][1],/my-private-id/);
});
test('Saved routes are bounded, deletable and rehydrated from same-origin storage',()=>{
  const {model,storage,writes}=setup();
  const records=Array.from({length:8},(_,i)=>({id:'test'+i,alias:'TEST',type:'fictional'}));
  for(let i=0;i<6;i++){
    model.reset(records[i]);model.visit(records[i+1]);
    assert.equal(model.save(records).ok,true);
  }
  assert.equal(model.saved(records).length,4);
  const context={window:{localStorage:storage,MarketV10:{data:{themes:{}}}}};
  runInNewContext(source,context);
  const hydrated=context.window.MarketV10.trails.createModel(storage);
  const items=hydrated.saved(records);
  assert.equal(items.length,4);
  const removed=items[0].id;
  assert.equal(hydrated.remove(removed),true);
  assert.equal(hydrated.saved(records).length,3);
  assert.ok(writes.length>=7);
});
test('Missing or blocked browser storage fails gracefully without claiming success',()=>{
  const {model}=setup(true);
  model.visit(curated[0]);model.visit(curated[1]);
  const result=model.save(curated);
  assert.equal(result.ok,false);
  assert.match(result.reason,/недоступно/);
});
test('Stale/unknown records are not rendered as existing saved routes',()=>{
  const {model,storage}=setup();
  model.visit(curated[0]);model.visit(curated[1]);model.save(curated);
  assert.equal(model.saved([curated[0]]).length,0);
  assert.equal(model.remove('unknown'),false);
  const context={window:{localStorage:storage,MarketV10:{data:{themes:{}}}}};
  runInNewContext(source,context);
  assert.ok(context.window.MarketV10.trails);
});
test('Saved-route panel is stable during filtering, clickable and never uploads data',()=>{
  assert.match(source,/if\(existing&&!force\)return/);
  assert.match(source,/renderArchive\(api,true\)/);
  assert.match(source,/api\.travel\(record\)/);
  assert.match(source,/api\.travel\(item\)/);
  assert.match(source,/Сохранить маршрут на устройстве/);
  assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
  assert.match(css,/@media\(max-width:819px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
