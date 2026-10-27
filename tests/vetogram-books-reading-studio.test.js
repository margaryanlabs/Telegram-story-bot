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
