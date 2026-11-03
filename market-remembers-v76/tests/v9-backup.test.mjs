import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
function extract(name){
 const a=script.indexOf('function '+name+'(');
 assert.ok(a>=0,'missing '+name);
 const b=script.indexOf('{',a);let d=0;
 for(let i=b;i<script.length;i++){
  if(script[i]==='{')d++;
  if(script[i]==='}'&&--d===0)return script.slice(a,i+1);
 }
 throw Error('unbalanced '+name);
}
const run=(name,ctx={})=>runInNewContext('('+extract(name)+')',ctx);
const safeString=(v,len)=>typeof v==='string'?v.slice(0,len):'';
const norm=p=>{const len=Math.hypot(...p)||1;return p.map(v=>v/len)};
const categories=['Risk','Patience','Discipline','FOMO'];
const record=(id,alias='MY STAR')=>({
 id,local:true,type:'local',alias,
 quote:'I should have protected the downside first.',
 rule:'Always calculate risk first',story:'I made a trade.',capsule:'',
 market:'CRYPTO',category:'Risk',createdAt:'2026-11-01T12:00:00.000Z',
 p:[0.4,0.5,0.76]
});
const normalizer=run('v95NormalizeBackup',{safeString,norm,categories});
const payload=(stories,checkins={})=>({demo:true,localOnly:true,stories,checkins});
const throwsWith=(cb,pattern)=>{
 let err=null;try{cb()}catch(e){err=e}
 assert.ok(err,'expected an error');
 assert.match(String(err.message||err),pattern);
};
test('archive exports remain compatible with the existing JSON format',()=>{
 assert.match(script,/JSON\.stringify\(\{demo:true,localOnly:true,stories:saved,checkins\}/);
 const b=normalizer(payload([record('local-a123')]));
 assert.equal(b.stories.length,1);
 assert.equal(b.stories[0].id,'local-a123');
 assert.ok(b.stories[0].local);
 assert.ok(Math.abs(Math.hypot(...b.stories[0].p)-1)<1e-9);
});
test('restored private aliases remain literal text, not injected markup',()=>{
 const b=normalizer(payload([record('local-b123','<img src=x onerror=alert(1)>')]));
 assert.equal(b.stories[0].alias,'<img src=x onerror=alert(1)>');
 assert.equal(b.stories[0].type,'local');
 assert.match(script,/escapeHtml\(s\.alias\)/);
});
test('malformed JSON structures and nonlocal records are never imported',()=>{
 throwsWith(()=>normalizer({stories:[]}),/не является/);
 throwsWith(()=>normalizer(payload([{...record('local-a123'),local:false}])),/поврежд/);
 throwsWith(()=>normalizer(payload([{...record('local-a123'),p:[1,Infinity,0]}])),/поврежд/);
 throwsWith(()=>normalizer(payload([{...record('local-a123'),p:[0,0,0]}])),/поврежд/);
});
test('backup with duplicate IDs rejects the entire batch without partial import',()=>{
 const item=record('local-duplicate');
 throwsWith(()=>normalizer(payload([item,item])),/поврежд/);
});
test('source attribution and invalid date are rejected, while unknown categories safely normalize',()=>{
 const b=normalizer(payload([{...record('local-a123'),category:'Unknown'}]));
 assert.equal(b.stories[0].category,'Risk');
 throwsWith(()=>normalizer(payload([{...record('local-a123'),createdAt:'bad date'}])),/неполная/);
});
test('only valid check-in dates and known statuses survive file validation',()=>{
 const marks={
  '2026-11-01':'kept','2026-11-02':'missed','2026-11-03':'hacked',
  '__proto__':'evil','not-a-date':'kept'
 };
 const b=normalizer(payload([record('local-a123')],{'local-a123':marks}));
 assert.deepEqual(Object.keys(b.checkins['local-a123']),['2026-11-01','2026-11-02']);
 assert.equal(b.checkins['local-a123']['2026-11-01'],'kept');
});
function storeFixture(existing=[record('local-existing')],failOn=null){
 const key='private-records',checkKey='private-checkins';
 const state={[key]:JSON.stringify(existing),[checkKey]:JSON.stringify({'local-existing':{'2026-11-01':'missed'}})};
 const storage={
  getItem:k=>Object.prototype.hasOwnProperty.call(state,k)?state[k]:null,
  setItem(k,value){if(k===failOn)throw Error('QuotaExceededError');state[k]=value},
  removeItem(k){delete state[k]}
 };
 const checkins={'local-existing':{'2026-11-01':'missed'}};
 const context={saved:existing,checkins,KEY:key,CHECK_KEY:checkKey,localStorage:storage};
 return {state,storage,context,commit:run('v95ImportBackupData',context)};
}
test('merge adds new star without deleting older stars or duplicating existing IDs',()=>{
 const f=storeFixture();
 const input=normalizer(payload([record('local-existing'),record('local-new123')]));
 const outcome=f.commit(input);
 assert.equal(outcome.added,1);
 assert.equal(outcome.alreadyPresent,1);
 const saved=JSON.parse(f.state['private-records']);
 assert.deepEqual(saved.map(s=>s.id),['local-existing','local-new123']);
});
test('import preserves the browser current check-in when backup has an older conflicting mark',()=>{
 const f=storeFixture();
 const data=normalizer(payload([record('local-existing')],
   {'local-existing':{'2026-11-01':'kept','2026-11-02':'kept'}}));
 f.commit(data);
 const check=JSON.parse(f.state['private-checkins']);
 assert.equal(check['local-existing']['2026-11-01'],'missed');
 assert.equal(check['local-existing']['2026-11-02'],'kept');
});
test('failed storage write rolls back original stars and check-in state',()=>{
 const f=storeFixture([record('local-existing')],'private-checkins');
 const before=f.state['private-records'];
 const data=normalizer(payload([record('local-new123')]));
 throwsWith(()=>f.commit(data),/Импорт отменён/);
 assert.equal(f.state['private-records'],before);
 assert.deepEqual(JSON.parse(before).map(s=>s.id),['local-existing']);
});
test('existing story retention never truncates at forty or before export',()=>{
 assert.doesNotMatch(extract('safeStored'),/slice\(-40\)/);
 assert.doesNotMatch(extract('v94StoreLocal'),/slice\(-40\)/);
 const all=Array.from({length:45},(_,i)=>record('local-archive-'+i));
 const f=storeFixture(all);
 f.commit(normalizer(payload([record('local-archive-46')])));
 assert.equal(JSON.parse(f.state['private-records']).length,46);
});
test('restore is browser-local and explicitly confirmed by user',()=>{
 const code=extract('v95BindBackupImport');
 assert.match(code,/file\.text\(\)/);
 assert.match(code,/confirm\(/);
 assert.match(code,/file\.size>5\*1024\*1024/);
 assert.match(code,/window\.location\.reload\(\)/);
 assert.doesNotMatch(code,/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
});
test('restore controls exist in empty and filled archives',()=>{
 const code=extract('showLegacy');
 assert.match(code,/id="importLegacy"/);
 assert.match(code,/id="legacyBackupFile"/);
 assert.match(code,/v95BindBackupImport\(\);return/);
 assert.match(code,/v95BindBackupImport\(\);/);
 assert.match(code,/id="exportLegacy"/);
});
