import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const js=readFileSync(new URL('../public/books.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/books.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/books.css',import.meta.url),'utf8');
const first=js.indexOf('  function readableViewport(){');
const last=js.indexOf('  function chapterFromPage(',first);
assert.ok(first>=0&&last>first,'Reader layout function block not found');
const makeReader=new Function('state','prefs','$','window',
  js.slice(first,last)+'\nreturn {readableViewport,paginate,nearestPage};');
function simulate({width=380,height=660,font=19,leading='comfortable',column='normal',text=''}) {
  const state={pageOffsets:[],rawText:'',pages:[],currentPage:0};
  const prefs={font,leading,width:column,fontFace:'literary'};
  const dom=id=>id==='readerScroll'?{clientWidth:width,clientHeight:height}:null;
  const api=makeReader(state,prefs,dom,{innerWidth:width,innerHeight:height});
  const pages=api.paginate(text);
  return {state,api,pages,budget:api.readableViewport()};
}
const sample=('Глава первая. Вечером в городе началась история. Герой открыл письмо, '+
  'прочитал несколько строк и поспешил выйти на улицу.\n\n').repeat(800);

test('adaptive page size changes with screen dimensions and font',()=>{
  const mobile=simulate({text:sample,width:375,height:590,font:19});
  const large=simulate({text:sample,width:980,height:890,font:19});
  const enlarged=simulate({text:sample,width:375,height:590,font:28});
  assert.ok(mobile.pages.length>large.pages.length);
  assert.ok(enlarged.pages.length>=mobile.pages.length);
  assert.ok(mobile.state.pageOffsets.every((x,i,a)=>i===0||x>a[i-1]));
});
test('reflow relocates to the same text offset',()=>{
  const before=simulate({text:sample,width:375,height:620,font:19});
  const after=simulate({text:sample,width:375,height:620,font:26});
  const anchor=before.state.pageOffsets[Math.floor(before.pages.length*.45)];
  const next=after.api.nearestPage(anchor);
  assert.ok(next>=0&&next<after.pages.length);
  assert.ok(after.state.pageOffsets[next]<=anchor);
  assert.ok(anchor-after.state.pageOffsets[next]<=after.budget*1.15);
});
test('empty and Armenian short texts create a readable page',()=>{
  assert.equal(simulate({text:''}).pages.length,1);
  assert.deepEqual(simulate({text:'Մեկ փոքր պատմություն.'}).pages,['Մեկ փոքր պատմություն.']);
});
test('reader controls referenced by JS are in HTML',()=>{
  const ids=[...js.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]);
  assert.deepEqual([...new Set(ids)].filter(id=>!html.includes('id="'+id+'"')),[]);
  for(const id of ['continueShelf','continueAction','readerFocusExit','readerFocusButton','readerProgressPercent']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
});
test('accessibility, focus and reduced motion are preserved',()=>{
  assert.match(js,/function setFocus\(enabled\)/);
  assert.match(js,/function reflowReader\(/);
  assert.match(js,/function renderContinueShelf\(/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/reader\[data-focus="true"\]/);
  assert.match(html,/data-read-font="modern"/);
  assert.match(html,/data-read-leading="airy"/);
});

test('VETOGRAM Noir identity and real hero entry controls are wired',()=>{
  for(const id of ['heroReadNow','heroMyBooks','readerVolumeStatus','readerTocButton',
    'readerChapterCount','libraryClarity']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.match(html,/veto-book-world/);
  assert.match(css,/VETOGRAM NOIR \/ BOOKS 04/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(js,/heroReadNow'\)\.addEventListener/);
  assert.match(js,/heroMyBooks'\)\.addEventListener/);
  assert.match(js,/readerTocButton'\)\.addEventListener/);
});
test('reader never advertises an unverified Wikisource page as a complete volume',()=>{
  assert.match(js,/function setVolumeStatus\(book,coverage\)/);
  assert.match(js,/полнота не подтверждена/);
  assert.match(js,/каталог ограничен/);
  assert.match(js,/КАТАЛОГ · ОПИСАНИЕ/);
  assert.match(js,/ПОЛНЫЙ ТЕКСТ ИСТОЧНИКА/);
});

test('full-work progress is monotonic across chapter boundaries and saved for resume',()=>{
  const start=js.indexOf('  function workProgress(');
  const end=js.indexOf('  function renderContinueShelf(',start);
  assert.ok(start>=0&&end>start);
  const fn=new Function(js.slice(start,end)+'return workProgress;')();
  const chapter1End=fn(0,25,900,1000,true);
  const chapter2Start=fn(1,25,0,1400,true);
  const middle=fn(12,25,700,1000,true);
  const last=fn(24,25,999,1000,true);
  assert.ok(chapter1End.fraction<chapter2Start.fraction);
  assert.ok(chapter2Start.fraction<middle.fraction);
  assert.ok(middle.fraction<last.fraction);
  assert.equal(middle.approx,true);
  assert.equal(fn(null,0,500,1000,false).fraction,.5);
  assert.equal(fn(0,0,500,1000,false).approx,false);
  assert.match(js,/workFraction:progressValue\.fraction/);
  assert.match(js,/p\.workFraction\?\?p\.fraction/);
});
test('saving Wikisource parts preserves source identity and allows reopening local edition',()=>{
  assert.match(js,/async function saveWholeEditionOffline\(\)/);
  assert.match(js,/local\.sourceWikiId=book\.id/);
  assert.match(js,/local\.sourceWiki=book\.wiki/);
  assert.match(js,/button\.textContent='ЧИТАТЬ ОФЛАЙН ↗'/);
  assert.match(js,/await openBook\(local\)/);
  assert.match(js,/async function prefetchNextChapter\(\)/);
  assert.match(js,/connectivity\?\.saveData/);
});

test('device narration can cross chapter boundary without cutting the last page',()=>{
  assert.match(js,/async function narrateNextPart\(token\)/);
  assert.match(js,/await loadChapter\(book,next\)/);
  assert.match(js,/else void narrateNextPart\(token\)/);
  assert.match(js,/SpeechSynthesisUtterance\(text\)/);
});


test('whole-edition offline pack preserves chapter order and never persists partial copies',async()=>{
  const begin=js.indexOf('  async function saveWholeEditionOffline(){');
  const end=js.indexOf('  function setVolumeStatus(',begin);
  assert.ok(begin>=0&&end>begin,'Offline edition pack missing');
  const source=js.slice(begin,end);
  async function verify(failing=-1){
    const book={provider:'wikisource',id:145,wiki:'ru',title:'Роман'};
    const chapters=Array.from({length:4},(_,i)=>({
      title:'Роман/Глава '+(i+1),label:'Глава '+(i+1)
    }));
    const state={current:book,isTranslationIndex:false,chapters,rawText:''};
    const elements={
      reader:{hidden:false},readerSaveAllChapters:{disabled:false,textContent:''},
      readerDownloadHint:{textContent:''}
    };
    const savedCopies=[];
    const imported={saveWikisourceEdition:async(_book,items,parts)=>{
      savedCopies.push({chapters:items,parts});
      return {provider:'local',id:99,title:'Роман'};
    }};
    const factory=new Function('state','$','isWiki','window','bookKey','cachedText',
      'cacheText','fetch','persist','saved','updateSavedCount','toast','openBook',
      'let offlineSavedBook=null;let offlineEditionToken=0;'+source+
      'return saveWholeEditionOffline;');
    const download=factory(state,id=>elements[id],book=>book.provider==='wikisource',
      {VetogramBooksImport:imported},book=>'ws-'+book.id,
      async()=>null,async()=>{},
      async url=>{
        const i=Number(new URL('https://unit.invalid/'+url).searchParams.get('chapter'));
        if(i===failing)return {ok:false,json:async()=>({ok:false})};
        await Promise.resolve();
        return {ok:true,json:async()=>({
          ok:true,text:('Глава '+i+' — русский текст. ').repeat(6),book,chapters
        })};
      },
      ()=>{},{},()=>{},()=>{},async()=>{});
    await download();
    return {savedCopies,notice:elements.readerDownloadHint.textContent};
  }
  const complete=await verify();
  assert.equal(complete.savedCopies.length,1);
  assert.equal(complete.savedCopies[0].parts.length,4);
  assert.deepEqual(complete.savedCopies[0].parts.map(x=>Number(x.match(/^Глава (\d+)/)[1])),[0,1,2,3]);
  const failed=await verify(2);
  assert.equal(failed.savedCopies.length,0);
  assert.match(failed.notice,/недоступна/);
});
