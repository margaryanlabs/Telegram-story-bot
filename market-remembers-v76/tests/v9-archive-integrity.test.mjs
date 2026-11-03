import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'V9 application script missing');
function extract(name){
  const start=script.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' absent');
  const open=script.indexOf('{',start);
  let depth=0;
  for(let i=open;i<script.length;i++){
    if(script[i]==='{')depth++;
    if(script[i]==='}'&&--depth===0)return script.slice(start,i+1);
  }
  throw Error('Unbalanced function: '+name);
}
const fn=(name,ctx={})=>runInNewContext('('+extract(name)+')',ctx);
const story=id=>({
  id,local:true,type:'local',alias:'LOCAL STAR',quote:'I learned risk management the hard way.',
  rule:'Protect capital',story:'I learned a lesson.',capsule:'',market:'CRYPTO',
  category:'Risk',createdAt:'2026-11-03T12:00:00Z',p:[0.5,0.5,0.70710678]
});
function fixture(stored=[story('local-old')],loaded=stored,marks={}){
  const KEY='local-records',CHECK_KEY='local-marks';
  const values={[KEY]:JSON.stringify(stored),[CHECK_KEY]:JSON.stringify(marks)};
  let writes=0;
  const localStorage={
    getItem:key=>Object.prototype.hasOwnProperty.call(values,key)?values[key]:null,
    setItem(key,value){writes++;values[key]=value},
    removeItem(key){delete values[key]}
  };
  const ctx={KEY,CHECK_KEY,localStorage,saved:loaded};
  ctx.v96ReadStoredRecords=fn('v96ReadStoredRecords',ctx);
  return {values,ctx,localStorage,writeCount:()=>writes};
}
function rejects(fun,message){
  assert.throws(fun,e=>String(e.message||e).includes(message));
}
test('MY LEGACY can switch personal stars without inventing new records',()=>{
  const code=extract('showLegacy');
  assert.match(script,/let legacyActiveId=null/);
  assert.match(code,/saved\.find\(item=>item\.id===legacyActiveId\)/);
  assert.match(code,/legacyStarSelect/);
  assert.match(code,/starPicker\.onchange=\(\)=>\{legacyActiveId=starPicker\.value;showLegacy\(\)\}/);
  assert.match(code,/escapeHtml\(item\.id\)/);
});
test('new birth appends to the freshest archive, including new records from another tab',()=>{
  const original=story('local-first'),concurrent=story('local-second');
  const f=fixture([original,concurrent],[original]);
  const save=fn('v94StoreLocal',f.ctx);
  assert.equal(save(story('local-third')),true);
  assert.deepEqual(JSON.parse(f.values['local-records']).map(x=>x.id),[
    'local-first','local-second','local-third']);
});
test('stale browser with a cleared archive refuses to resurrect deleted history',()=>{
  const f=fixture([],[story('local-previous')]);
  assert.equal(fn('v94StoreLocal',f.ctx)(story('local-new')),false);
  assert.equal(f.writeCount(),0);
});
test('damaged, duplicate or non-finite local coordinates are never overwritten',()=>{
  for(const damaged of [
    [story('local-duplicate'),story('local-duplicate')],
    [{...story('local-bad'),p:[1.7e308,1.7e308,0]}],
    [{...story('local-bad'),quote:42}],
    [{...story('local-bad'),local:false}]
  ]){
    const f=fixture(damaged,[]);
    assert.equal(fn('v94StoreLocal',f.ctx)(story('local-new')),false);
    assert.equal(f.writeCount(),0);
  }
});
test('import uses latest stored records and merges check-ins while honoring newer local marks',()=>{
  const first=story('local-first'),second=story('local-second');
  const f=fixture([first,second],[first],{'local-first':{'2026-11-02':'missed'}});
  const merge=fn('v95ImportBackupData',f.ctx);
  const result=merge({
    stories:[story('local-third')],
    checkins:{'local-first':{'2026-11-02':'kept','2026-11-03':'kept'}}
  });
  assert.equal(result.added,1);
  assert.equal(result.updatedChecks,true);
  assert.deepEqual(JSON.parse(f.values['local-records']).map(x=>x.id),[
    'local-first','local-second','local-third']);
  const marks=JSON.parse(f.values['local-marks']);
  assert.equal(marks['local-first']['2026-11-02'],'missed');
  assert.equal(marks['local-first']['2026-11-03'],'kept');
});
test('mark-only backup import reports updates even when all star IDs are already present',()=>{
  const first=story('local-first'),f=fixture([first]);
  const result=fn('v95ImportBackupData',f.ctx)({
    stories:[first],checkins:{'local-first':{'2026-11-03':'kept'}}
  });
  assert.equal(result.added,0);
  assert.equal(result.updatedChecks,true);
});
test('import refuses to discard records when another tab removed the cached records',()=>{
  const f=fixture([],[story('local-previous')]);
  rejects(()=>fn('v95ImportBackupData',f.ctx)({stories:[story('local-new')],checkins:{}}),'другой вкладке');
  assert.equal(f.writeCount(),0);
});
test('fresh export uses the browser archive, not a stale page-load copy',()=>{
  const code=extract('showLegacy');
  assert.match(code,/const exportStories=v96ReadStoredRecords\(\)/);
  assert.match(code,/stories:exportStories,checkins:exportChecks/);
});
test('backup refuses extreme coordinates which overflow into non-finite radius',()=>{
  const normalize=fn('v95NormalizeBackup',{
    safeString:(x,n)=>typeof x==='string'?x.slice(0,n):'',
    norm:p=>p.map(n=>n/(Math.hypot(...p)||1)),
    categories:['Risk']
  });
  rejects(()=>normalize({
    localOnly:true,stories:[{...story('local-bad'),p:[1.7e308,1.7e308,1.7e308]}]
  }),'повреждённую');
});
