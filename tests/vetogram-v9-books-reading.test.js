import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const html=read('books.html'),js=read('books.js'),css=read('vetogram-v9-books-reading.css');
function block(from,to){
  const a=js.indexOf('  function '+from+'('),b=js.indexOf('  function '+to+'(',a);
  assert.ok(a>=0&&b>a,'missing live function '+from);
  return js.slice(a,b);
}
const historySource=block('readingHistory','readingPosition');
const positionSource=block('readingPosition','readingCover');
const renderSource=block('renderContinueShelf','setFocus');

test('real Reading Room mounts in existing Books reader without a second app/router',()=>{
  assert.match(html,/id="continueShelf"/);
  assert.match(html,/id="v9ReadingHistory"[^>]*hidden/);
  assert.match(html,/id="reader"/);
  assert.equal((html.match(/id="reader"/g)||[]).length,1);
  assert.ok(html.indexOf('vetogram-v9-books-reading.css')>html.indexOf('vetogram-reborn-modules.css'));
  assert.ok(html.indexOf('id="v9ReadingHistory"')<html.indexOf('id="featuredEditions"'));
  assert.match(js,/function renderContinueShelf\(\)/);
  assert.match(js,/openBook\(nextBook\)/);
  assert.match(js,/openBook\(book\)/);
});

test('reading history is sorted, capped and rejects metadata-only/invalid progress',()=>{
  const progress={
    a:{id:1,title:'Older',at:20},
    b:{id:2,title:'Newest',at:90},
    c:{id:3,title:'Catalog',at:95,provider:'editorial'},
    d:{id:'bad',title:'Broken',at:99},
    e:{id:5,title:'Mid',at:40},
    f:{id:6,title:'Early',at:10},
    g:{id:7,title:'Extra',at:5},
    h:{id:8,title:'Missing time'},
  };
  const context={progress,Number,Object,
    bookFromProgress:(key,item)=>Number.isSafeInteger(Number(item.id))?item:null,
    isCatalogBook:book=>book.provider==='editorial'};
  runInNewContext(historySource+'this.run=readingHistory;',context);
  const rows=context.run();
  assert.deepEqual(Array.from(rows,x=>x.book.title),['Newest','Mid','Older','Early']);
});

test('reader progress percentage is bounded, chapter status is explicitly approximate',()=>{
  const context={Number,Math};
  runInNewContext(positionSource+'this.position=readingPosition;',context);
  assert.equal(context.position({page:0,chapter:null,workFraction:.45}).label,'стр. 1 · 45%');
  assert.equal(context.position({page:3,chapter:1,workFraction:.25}).label,'Часть 2 · стр. 4 · ≈ 25%');
  assert.equal(context.position({page:-9,chapter:null,workFraction:-20}).percent,0);
  assert.equal(context.position({page:2,chapter:null,workFraction:20}).percent,100);
});

test('rendering real progress creates working resume controls for all visible entries',()=>{
  function el(){return {hidden:false,children:[],style:{},attributes:{},append(...nodes){this.children.push(...nodes)},
    replaceChildren(...nodes){this.children=nodes},setAttribute(k,v){this.attributes[k]=v},
    addEventListener(k,fn){this[k]=fn},querySelector(){return cover}}}
  const cover=el(),shelf=el(),history=el(),action=el();
  const els={continueShelf:shelf,v9ReadingHistory:history,continueTitle:el(),continueDetails:el(),
    continueFill:el(),continueAction:action};
  const books=[{id:1,title:'Book A',authors:['Author A']},{id:2,title:'Book B',authors:[]}];
  const entries=books.map((book,i)=>({book,item:{page:i,chapter:null,workFraction:.25+i*.25,at:2-i}}));
  const opened=[];
  const ctx={readingHistory:()=>entries,$:id=>els[id],readingCover:(host,book)=>{host.book=book},
    readingPosition:item=>({label:'стр. '+(item.page+1),percent:25}),
    compactTitle:x=>x,openBook:book=>opened.push(book.id),
    node:(tag,klass,label)=>Object.assign(el(),{tag,klass,textContent:label})};
  runInNewContext(renderSource+'this.render=renderContinueShelf;',ctx);
  ctx.render();
  assert.equal(shelf.hidden,false);
  assert.equal(els.continueTitle.textContent,'Book A');
  assert.equal(els.continueFill.style.width,'25%');
  assert.equal(action.attributes['aria-label'],'Продолжить чтение: Book A');
  assert.equal(history.children.length,1);
  action.onclick();history.children[0].click();
  assert.deepEqual(opened,[1,2]);
  ctx.readingHistory=()=>[];ctx.render();
  assert.equal(shelf.hidden,true);
  assert.equal(history.hidden,true);
  assert.equal(history.children.length,0);
});

test('cover source never uses arbitrary user URL and failures return to authored jacket',()=>{
  assert.match(js,/const imageUrl=safeCover\(book.cover\)/);
  assert.match(js,/failedCoverUrls\.has\(imageUrl\)/);
  assert.match(js,/image\.onerror=\(\)=>\{failedCoverUrls\.add\(imageUrl\);image\.remove\(\)/);
  assert.match(js,/coverArtwork\(jacket,book\)/);
  assert.doesNotMatch(js.slice(js.indexOf('function readingCover'),js.indexOf('function renderContinueShelf')),/innerHTML/);
});

test('no new reader or download capability, existing owner-scoped progress is preserved',()=>{
  assert.match(js,/const STORAGE = 'vetogram-books-v1:'\+\(window\.VetogramMediaContext\?\.scope\|\|'device'\)/);
  assert.match(js,/const progress = readJSON\('progress', \{\}\)/);
  assert.match(js,/function openBook\(book\)/);
  assert.match(js,/renderContinueShelf\(\);/);
  assert.doesNotMatch(renderSource,/fetch\(/);
});

test('monochrome visual contract includes real covers, responsive cards, motion and light themes',()=>{
  assert.match(css,/\.books-main #continueShelf/);
  assert.match(css,/\.source-edition-cover/);
  assert.match(css,/\.reader\[data-theme="dark"\]/);
  assert.match(css,/@media\(max-width:740px\)/);
  assert.match(css,/@media\(max-width:420px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/data-universe-theme="pearl"/);
  assert.match(css,/data-universe-theme="linen"/);
  assert.match(css,/\.reader :is\(button,select\):focus-visible/);
});

test('books V9 JS and CSS are structurally balanced',()=>{
  assert.doesNotThrow(()=>new Function(js));
  let depth=0;
  for(const c of css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'""')){
    if(c==='{')depth++;
    if(c==='}')depth--;
    assert.ok(depth>=0);
  }
  assert.equal(depth,0);
});
