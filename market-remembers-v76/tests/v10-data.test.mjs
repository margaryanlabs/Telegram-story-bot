import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=name=>readFileSync(new URL('../v10/'+name+'.js',import.meta.url),'utf8');
const window={};runInNewContext(read('memory-data'),{window,URL,location:{href:'https://preview.example/?qa=1'}});
const data=window.MarketV10.data;
test('legacy account is preserved verbatim and absent decision/consequences are explicit',()=>{
 const record={story:'A complete original account. Not an invented chapter.',rule:'My own rule.'};
 const chapters=data.chapters(record);
 assert.equal(chapters.length,4);assert.equal(chapters[0].text,record.story);
 assert.equal(chapters[0].legacy,true);assert.equal(chapters[1].missing,true);
 assert.equal(chapters[2].missing,true);assert.equal(chapters[3].text,record.rule);
});
test('structured local memories use exactly the submitted chapter data',()=>{
 const chapters=data.chapters({local:true,chapters:{before:'Before',decision:'Decision',consequences:'After',remains:'Lesson'}});
 assert.deepEqual(Array.from(chapters,c=>c.text),['Before','Decision','After','Lesson']);
 assert.ok(chapters.every(c=>!c.missing&&!c.legacy));assert.match(data.provenance({local:true}),/только на этом устройстве/);
});
test('untrusted backup chapter values are bounded',()=>{
 const chapters=data.chapters({chapters:{before:{name:'object'},decision:'a'.repeat(4000),consequences:42,remains:'r'.repeat(600)}});
 assert.equal(chapters[0].text,'');assert.equal(chapters[1].text.length,1200);
 assert.equal(chapters[2].missing,true);assert.equal(chapters[3].text.length,180);
});
test('fiction labels and source distinctions cannot become real-person claims',()=>{
 assert.match(data.provenance({type:'fictional'}),/Fictional/);assert.match(data.provenance({type:'editorial'}),/Fictional/);assert.match(data.provenance({type:'legend'}),/источник/);
});
test('stable links encode identity without embedding story content',()=>{
 const url=new URL(data.permalink({id:'local-abc-123',story:'PRIVATE'}));assert.equal(url.hash,'#story/local-abc-123');assert.ok(!url.href.includes('PRIVATE'));
});
test('public publication adapter rejects instead of faking persistence',async()=>{
 runInNewContext(read('legacy-submission'),{window});assert.equal(window.MarketV10.legacy.publication.available,false);
 await assert.rejects(window.MarketV10.legacy.publication.submit({story:'private'}),/не опубликована/);
});
test('JSON restore preserves structured chapters and compatible legacy identities',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const start=js.indexOf('function v95NormalizeBackup('),end=js.indexOf('  function v95ImportBackupData',start);
 const normalize=runInNewContext('('+js.slice(start,end).trim()+')',{
  safeString:(value,max)=>typeof value==='string'?value.slice(0,max):'',norm:v=>v,categories:['Risk']
 });
 const item={id:'local-valid123',local:true,alias:'AUTHOR',quote:'An original memory quote',rule:'Always write the risk.',story:'Original account',createdAt:'2026-11-04T00:00:00Z',p:[0,0,1],category:'Risk',chapters:{before:'Before',decision:'Choice',consequences:'Outcome',remains:'Lesson'}};
 const result=normalize({localOnly:true,stories:[item]});assert.equal(result.stories[0].id,item.id);assert.equal(result.stories[0].chapters.decision,'Choice');assert.equal(result.stories[0].chapters.consequences,'Outcome');
});
