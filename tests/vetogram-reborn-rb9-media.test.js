/* RB9: source-based protection for real Media navigation and catalogs.
 * Never substitute fake posters or bypass player/reader permissions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const html=read('studio.html');
const media=read('vetogram-reborn-media.css');
const modules=read('vetogram-reborn-modules.css');
const music=read('music-module.html');
const cinema=read('cinema.html');
const books=read('books.html');
const router=read('vetogram-universe.js');
const reader=read('books.js');
const context=read('vetogram-media-context.js');
const play=read('vetogram-play.js');

function balanced(css){
  const noComments=css.replace(/\/\*[\s\S]*?\*\//g,'');
  let depth=0;
  for(const c of noComments){
    if(c==='{')depth++;
    if(c==='}')depth--;
    assert.ok(depth>=0,'unmatched closing CSS scope');
  }
  assert.equal(depth,0,'unclosed CSS scope');
}

test('real host loads one bundled RB8–RB11 stylesheet after foundation',()=>{
  const foundation=html.indexOf('/vetogram-reborn-foundation.css?v=');
  const bundle=html.indexOf('/vetogram-reborn-ui.css?v=');
  assert.ok(foundation>0&&bundle>foundation);
  assert.ok(html.indexOf('</head>')>bundle);
  assert.equal((html.match(/vetogram-reborn-ui\.css/g)||[]).length,1);
});

test('four real Media destinations remain wired to existing buttons',()=>{
  for(const [module,title] of [['music','Музыка'],['cinema','Кино'],['books','Книги']]){
    assert.ok(html.includes('data-v6-module="'+module+'"'));
    assert.ok(html.includes('<strong>'+title+'</strong>'));
  }
  assert.ok(html.includes('data-open-screen="play"'));
  assert.ok(html.includes('id="vpQuickGames"'));
  assert.match(router,/music:\{title:'Музыка',path:'\/music-module\.html'\}/);
  assert.match(router,/cinema:\{title:'Кино',path:'\/cinema\.html'\}/);
  assert.match(router,/books:\{title:'Книги',path:'\/books\.html'\}/);
});

test('genuine Music Cinema and Books documents all load the final module style',()=>{
  for(const doc of [music,cinema,books]){
    const last=doc.lastIndexOf('vetogram-reborn-modules.css?v=');
    assert.ok(last>doc.lastIndexOf('vetogram-editorial-80.css'));
    assert.ok(last<doc.lastIndexOf('</head>'));
    assert.ok(last>0);
    assert.equal((doc.match(/vetogram-reborn-modules\.css/g)||[]).length,1);
  }
});

test('host Media skin covers discovery search collection player and Play',()=>{
  for(const selector of [
    '.v72-media-hero','.v72-media-card','.v75-discovery',
    '#v61Search','#v61VaultButton','#v6MediaStage',
    '.v61-player-record','#v61PlayerPlay','.v72-play-hero','.vp-card'
  ])assert.ok(media.includes(selector),selector);
  assert.match(html,/id="v61VaultPanel"/);
  assert.match(html,/id="v61PlayerClose"/);
  assert.match(html,/id="v6MediaBack"/);
});

test('module skin targets real catalog art while leaving all sources unchanged',()=>{
  assert.match(modules,/\.cinema-card-art img/);
  assert.match(modules,/\.books-main \.book/);
  assert.match(modules,/#app\.app \.section-head/);
  assert.match(modules,/object-fit:cover/);
  assert.doesNotMatch(modules,/url\(['"]?https?:\/\//i);
  assert.match(cinema,/id="cinemaHeroBackdrop"/);
  assert.match(cinema,/id="cinemaGrid"/);
  assert.match(books,/id="catalogGrid"/);
  assert.match(music,/id="licensedHomeTracks"/);
});

test('one persistent music transport and real iframe trail unchanged',()=>{
  assert.match(router,/const frames=new Map\(\)/);
  assert.match(router,/const mediaTrail=\[\]/);
  assert.match(router,/function backInMedia\(\)/);
  assert.match(router,/lastAudio/);
  assert.match(router,/contentWindow\?\.postMessage/);
  assert.doesNotMatch(modules,/new Audio\(|postMessage\(|fetch\(/);
  assert.doesNotMatch(media,/new Audio\(|postMessage\(|fetch\(/);
});

test('reader fonts, settings, progress and source remain user-controlled',()=>{
  assert.match(books,/id="readerScroll"/);
  assert.match(books,/id="readerSettings"/);
  assert.match(books,/id="progressFill"/);
  assert.match(reader,/reader\.dataset\.theme=prefs\.theme/);
  assert.doesNotMatch(modules,/\.(reader|reader-scroll|reader-paper|reader-copy)\s*\{/);
});

test('nested module theme inherits Pearl Linen from parent',()=>{
  assert.match(context,/document\.documentElement\.dataset\.universeTheme=context\.theme/);
  assert.match(modules,/data-universe-theme="pearl"/);
  assert.match(modules,/data-universe-theme="linen"/);
  assert.match(media,/data-veto-theme="pearl"/);
  assert.match(media,/data-veto-theme="linen"/);
});

test('no unverified catalog totals are fabricated by CSS',()=>{
  assert.match(html,/id="v61VaultCount"/);
  assert.match(html,/id="vpCatalogCount"/);
  assert.doesNotMatch(media,/content:\s*['"](?:[0-9]+|LIVE|ONLINE|PLAYING)/);
  assert.doesNotMatch(modules,/content:\s*['"](?:[0-9]+|LIVE|ONLINE|PLAYING)/);
});

test('CSS block syntax balanced and meaningful mobile/reduced-motion support',()=>{
  balanced(media);balanced(modules);
  for(const marker of ['@media(max-width:350px)','@media(max-width:430px)','@media(max-width:850px)','prefers-reduced-motion:reduce'])assert.ok(media.includes(marker),marker);
  assert.match(modules,/@media\(max-width:370px\)/);
  assert.match(modules,/prefers-reduced-motion:reduce/);
  assert.match(media,/:focus-visible/);
  assert.match(modules,/:focus-visible/);
});

test('Play still includes actual games instead of a static placeholder',()=>{
  assert.match(html,/id="vpQuickGames"/);
  assert.match(html,/id="v75SurpriseMe"/);
  assert.ok(play.length>1000);
  assert.doesNotMatch(media,/data-v74-launch=/);
});

test('no changes to Telegram account, media URL or licensing logic',()=>{
  assert.doesNotMatch(media,/x-telegram-init-data|Bearer|initData|Telegram\.WebApp\.initData/);
  assert.doesNotMatch(modules,/x-telegram-init-data|Bearer|initData|Telegram\.WebApp\.initData/);
  assert.match(html,/Воспроизведение зависит от доступности контента/);
  assert.match(html,/Доступность воспроизведения и текстов зависит от источников/);
});
