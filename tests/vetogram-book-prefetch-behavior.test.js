import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the exact book-prefetch functions shipped to the browser. A fake
// IndexedDB/network layer is used; no real books or user libraries are touched.
const source=readFileSync(new URL('../public/books.js',import.meta.url),'utf8');
const cancel=source.match(/  function cancelChapterPrefetch\(\)\{[\s\S]*?\n  \}/)?.[0];
const start=source.indexOf('  async function prefetchNextChapter(){');
const end=source.indexOf('  function showPage(page, scroll=true){',start);
assert.ok(cancel&&start>=0&&end>start,'Reader prefetch code must exist');
const prefetch=source.slice(start,end);

function harness({fetch,cachedText=async()=>null,cacheText=async()=>{},connection={}}={}){
 const book={id:42,provider:'wikisource',wiki:'ru',title:'Book'};
 const state={current:book,chapters:[{label:'A'},{label:'B'}],activeChapter:0,isTranslationIndex:false,requestBook:1};
 const reader={hidden:false};
 const context={state,navigator:{connection},AbortController,URLSearchParams,setTimeout,clearTimeout,
  $:id=>id==='reader'?reader:null,
  isWiki:b=>b?.provider==='wikisource',
  bookKey:b=>b?.id==null?'':String(b.id),
  cachedText,cacheText,fetch};
 vm.runInNewContext('const pendingChapterPrefetch=new Map();\n'+cancel+'\n'+prefetch+
  '\nthis.exported={prefetchNextChapter,cancelChapterPrefetch,pendingChapterPrefetch}',context,
  {filename:'books-prefetch-extracted.js',timeout:1000});
 return {...context.exported,state,reader,book};
}

test('reader close cancels the active chapter download',async()=>{
 let started,aborted=false,stored=false;
 const began=new Promise(resolve=>{started=resolve;});
 const h=harness({
  fetch:(_url,{signal})=>new Promise((_resolve,reject)=>{
   signal.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted'));},{once:true});
   started();
  }),
  cacheText:async()=>{stored=true;}
 });
 const pending=h.prefetchNextChapter();
 await began;
 h.reader.hidden=true;
 h.cancelChapterPrefetch();
 await pending;
 assert.equal(aborted,true);
 assert.equal(stored,false);
 assert.equal(h.pendingChapterPrefetch.size,0);
});

test('old book prefetch cannot overwrite cache after switching books',async()=>{
 let release,stored=false,started;
 const began=new Promise(resolve=>{started=resolve;});
 const h=harness({
  fetch:()=>new Promise(resolve=>{release=resolve;started();}),
  cacheText:async()=>{stored=true;}
 });
 const pending=h.prefetchNextChapter();
 await began;
 h.state.current={id:99,provider:'wikisource',wiki:'ru'};
 release({ok:true,json:async()=>({ok:true,text:'Chapter B',chapters:[],coverage:{limited:false}})});
 await pending;
 assert.equal(stored,false);
 assert.equal(h.pendingChapterPrefetch.size,0);
});

test('prefetch preserves source coverage and caches valid next chapter',async()=>{
 let saved=null;
 const h=harness({
  fetch:async()=>({ok:true,json:async()=>({
   ok:true,book:{id:42},text:'Full chapter',chapters:[{label:'A'},{label:'B'}],
   coverage:{kind:'chaptered',limited:true,completeness:'unverified'}})}),
  cacheText:async(key,data)=>{saved={key,data};}
 });
 await h.prefetchNextChapter();
 assert.equal(saved.key,'42:1');
 assert.equal(saved.data.coverage.limited,true);
 assert.equal(saved.data.text,'Full chapter');
 assert.equal(h.pendingChapterPrefetch.size,0);
});

test('Data Saver and slow connections prevent speculative downloads',async()=>{
 let calls=0;
 for(const connection of [{saveData:true},{effectiveType:'2g'}]){
  const h=harness({connection,fetch:async()=>{calls++;throw new Error('not expected');}});
  await h.prefetchNextChapter();
  assert.equal(h.pendingChapterPrefetch.size,0);
 }
 assert.equal(calls,0);
});
