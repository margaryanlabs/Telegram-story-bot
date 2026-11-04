import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const runtime=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(runtime,'runtime exists');
function extract(name){
 const start=runtime.indexOf('function '+name+'(');
 assert.ok(start>=0,name+' function missing');
 const open=runtime.indexOf('{',start);let d=0;
 for(let i=open;i<runtime.length;i++){
   if(runtime[i]==='{')d++;
   if(runtime[i]==='}'&&--d===0)return runtime.slice(start,i+1);
 }
 throw new Error('unbalanced '+name);
}
const ctxFn=(name,context)=>runInNewContext('('+extract(name)+')',context);
const stories=[
 {alias:'MIRA',market:'STOCKS',category:'Risk',type:'fictional',quote:'Short loss',
  p:[.3,-.2,.9],story:'Demo experience',rule:'Hard stop'},
 {alias:'ANNA',market:'FOREX',category:'Patience',type:'editorial',quote:'Wait',
  p:[.1,.6,.8],story:'Editorial fictional scenario',rule:'Patience'},
 {alias:'SOURCE',market:'STOCKS',category:'Discipline',type:'legend',quote:'Doc title',
  legend:{quoteKind:'memo-title',source:'Source document'},p:[-.7,.2,.3]},
 {alias:'LOCAL ALIAS',market:'CRYPTO',category:'Risk',type:'fictional',local:true,
  p:[-.2,.5,.5],story:'Private note',rule:'Take time'}
];
const palette={Risk:'#75d8ff',Patience:'#f5d19c',Discipline:'#a79cff',
 FOMO:'#f2a4e7',Legends:'#e3bf79',Lessons:'#8cbfc2'};
const meta=ctxFn('v93ReaderInfo',{stories,lensColors:palette});
test('reader identifies the exact selected star and correct category color',()=>{
 const m=meta(stories[0]);
 assert.equal(m.index,0);assert.equal(m.number,'001');
 assert.equal(m.alias,'@MIRA');
 assert.equal(m.color,palette.Risk);
 assert.match(m.kind,/ВЫМЫШЛЕННАЯ/);
});
test('editorial example is labeled fictional and uses editorial lighting',()=>{
 const m=meta(stories[1]);
 assert.equal(m.index,1);assert.equal(m.number,'002');
 assert.match(m.kind,/РЕДАКЦИОННАЯ ВЫМЫШЛЕННАЯ/);
 assert.equal(m.color,palette.Lessons);
});
test('source document headline is not presented as a verbatim quotation',()=>{
 const m=meta(stories[2]);
 assert.match(m.kind,/ЗАГОЛОВОК/);
 assert.doesNotMatch(m.kind,/ЦИТАТА/);
 assert.equal(m.color,palette.Legends);
 assert.match(m.alias,/SOURCE/);
});
test('personal star remains explicitly local and is not published',()=>{
 const m=meta(stories[3]);
 assert.match(m.kind,/НА ЭТОМ УСТРОЙСТВЕ/);
 assert.equal(m.alias,'@LOCAL ALIAS');
 assert.equal(m.number,'004');
});
function element(tag='div'){
 return {tag,attributes:{},style:{setProperty(key,value){this[key]=value}},
   children:[],className:'',textContent:'',type:'',
   classList:{added:[],add(value){this.added.push(value)}},
   setAttribute(key,value){this.attributes[key]=value},
   append(...parts){this.children.push(...parts)},
   insertAdjacentElement(place,node){this.inserted={place,node}}
 };
}
function mount(record,options={}){
 const top=element('div');
 const article=element('article');
 article.querySelector=selector=>selector==='.memory-topline'?top:null;
 const drawer=element('aside');
 const env={
   stories,lensColors:palette,clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),
   v93ReaderInfo:meta,
   $:id=>id==='drawer'?drawer:{querySelector:selector=>selector==='.memory-experience'?article:null},
   document:{createElement:element},
   closeDrawer(){options.onBack?.()},
 };
 ctxFn('v93MountReaderScene',env)(record);
 return {top,article,drawer,record};
}
test('a single observatory inserts directly after reader context, not a disconnected overlay',()=>{
 const {top,drawer,article}=mount(stories[0]);
 assert.equal(top.inserted.place,'afterend');
 const section=top.inserted.node;
 assert.equal(section.className,'v93-observatory');
 assert.equal(section.attributes['aria-label'],'Выбранная звезда и возвращение во вселенную');
 assert.equal(section.children.length,2);
 assert.equal(drawer.style['--v93-reader-accent'],palette.Risk);
 assert.ok(article.classList.added.includes('v93-memory-reveal'));
});
test('observatory has exactly seven inert background pinpoints and one selected star',()=>{
 const {top}=mount(stories[1]);
 const motif=top.inserted.node.children[0];
 assert.equal(motif.className,'v93-observatory-motif');
 assert.equal(motif.attributes['aria-hidden'],'true');
 assert.equal(motif.children.filter(x=>x.tag==='i').length,7);
 assert.equal(motif.children.at(-1).className,'v93-observatory-star');
});
test('reader return control is a working accessible button to the same sphere',()=>{
 let back=0;
 const {top}=mount(stories[0],{onBack(){back++}});
 const details=top.inserted.node.children[1];
 const footer=details.children.at(-1);
 const button=footer.children[1];
 assert.equal(button.tag,'button');
 assert.equal(button.type,'button');
 assert.match(button.attributes['aria-label'],/выбранной звезде/);
 assert.equal(typeof button.onclick,'function');
 button.onclick();
 assert.equal(back,1);
});
test('reader uses text nodes for untrusted local alias, never HTML interpolation',()=>{
 const adversarial={...stories[3],alias:'<script>alert(1)</script>'};
 stories.push(adversarial);
 try{
   const {top}=mount(adversarial);
   const details=top.inserted.node.children[1];
   const alias=details.children[1];
   assert.equal(alias.textContent,'@<script>alert(1)</script>');
   assert.equal(alias.children.length,0);
 }finally{stories.pop()}
});
test('legend and ordinary reader both mount observatory without replacing saved actions',()=>{
 assert.match(runtime,/v76EnhanceReader\(true\);v78MountBreadcrumb\(s\);v93MountReaderScene\(s\);v77MountThreads\(s\)/);
 assert.match(runtime,/v76EnhanceReader\(false\);v78MountBreadcrumb\(s\);v93MountReaderScene\(s\);v77MountThreads\(s\)/);
 assert.match(runtime,/bindLessonBookmark\(s\)/);
 assert.match(runtime,/function v762RestoreStar\(\)/);
 assert.match(runtime,/function v9Tick\(t\)/);
});
test('reader has reduced-motion opt-out and preserves original quote and sources',()=>{
 assert.match(html,/\.v93-observatory-star/);
 assert.match(html,/\.v93-memory-reveal \.memory-title/);
 assert.match(html,/@media\(prefers-reduced-motion:reduce\)[\s\S]*?\.v93-observatory-star/);
 assert.match(runtime,/ПРОВЕРЯЕМЫЙ ИСТОЧНИК/);
 assert.match(runtime,/ЛОКАЛЬНАЯ ЗАПИСЬ/);
 assert.match(runtime,/veto-market-remembers-demo-v4/);
});
