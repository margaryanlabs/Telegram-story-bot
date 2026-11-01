/* VETOGRAM 6.2 media expansion: source and actual deterministic-controller gates.
 * These tests do not claim that external providers allow playback in every region.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const musicHtml=read('public/music-module.html');
const music=read('public/vetogram-music.js');
const catalog=read('public/vetogram-music-catalog.js');
const cinemaHtml=read('public/cinema.html');
const cinema=read('public/cinema.js');
const booksHtml=read('public/books.html');
const books=read('public/books.js');
const wikiApi=read('api/books-wikisource.js');
const style=read('public/vetogram-media-edition-62.css');

test('one media edition is loaded after existing per-module styles on all three real module entrypoints',()=>{
  for(const html of [musicHtml,cinemaHtml,booksHtml]){
    const marker='/vetogram-media-edition-62.css?v=';
    assert.ok(html.includes(marker));
    assert.ok(html.indexOf(marker)>html.indexOf('/vetogram-media-embedded.css'));
  }
  assert.equal((style.match(/\{/g)||[]).length,(style.match(/\}/g)||[]).length);
  assert.match(style,/prefers-reduced-motion:reduce/);
  assert.doesNotMatch(style,/@import\b/);
});

test('Russian/world/Armenian music uses original Audius search and paginated discovery, not fake songs',()=>{
  assert.match(catalog,/const LIMIT=40,MAX_RESULTS=2400/);
  for(const id of ['ru-miyagi','ru-zemfira','ru-rap2','ru-remix','ru-phonk','world-lofi','world-metal','am-jazz'])
    assert.ok(catalog.includes('id:"'+id+'"'),'missing '+id);
  assert.match(catalog,/const API="https:\/\/api\.audius\.co\/v1\/tracks\/search"/);
  assert.match(catalog,/V\.play\(track,items\.filter\(item=>!failedStreams\.has\(item\.id\)\)\)/);
  assert.match(musicHtml,/data-catalog-group="ru"/);
});

test('ten live radio actions have declared direct HTTPS broadcaster streams',()=>{
  const stationIds=[...musicHtml.matchAll(/data-audio-station="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(stationIds.length,10);
  assert.equal(new Set(stationIds).size,10);
  for(const id of stationIds)assert.ok(music.includes('key:"'+id+'"'));
  assert.match(music,/source:"radio"/);
  assert.match(music,/radiorecord\.hostingradio\.ru\/russianhits96\.aacp/);
  assert.doesNotMatch(musicHtml,/youtube\.com\/watch\?/i);
});

test('Cinema displays a real one-click official embed shelf, excluding external-only film discovery',()=>{
  assert.match(cinemaHtml,/id="cinemaWatchNow"/);
  assert.match(cinemaHtml,/id="cinemaWatchNowRail"/);
  assert.match(cinema,/function renderWatchNow\(/);
  assert.match(cinema,/if\(f\.externalRutube\|\|f\.discoveryOnly\|\|f\.contentType==="Сериалы"\|\|failedEmbeds\.has\(f\.id\)\)return false/);
  assert.match(cinema,/f\.player\.licensed!==true/);
  assert.match(cinema,/url\.origin==="https:\/\/rutube\.ru"/);
  assert.match(cinema,/clean\.addEventListener\("click",\(\)=>play\(film\)\)/);
  assert.match(cinema,/const all=\[\.\.\.recents,\.\.\.films\.filter\(f=>f\.player/);
  assert.match(cinemaHtml,/src="\.\/cinema-featured-200\.js"/);
});

test('whole-book shelf contains 141 unique Wikisource original source works, including the historical Prince',()=>{
  const start=books.indexOf('  const verifiedWholeEditions=');
  const end=books.indexOf('  function setSourceInfo(){',start);
  assert.ok(start>0&&end>start);
  const data=new Function(books.slice(start,end)+'\nreturn {completeEditionBooks,filterCompleteEditionBooks};')();
  const list=data.completeEditionBooks;
  assert.equal(list.length,141);
  assert.equal(new Set(list.map(b=>b.id)).size,141);
  for(const b of list){
    assert.equal(b.provider,'wikisource');
    assert.equal(b.wiki,'ru');
    assert.equal(b.readable,true);
  }
  const prince=list.find(b=>b.id===559743);
  assert.equal(prince.title,'Государь');
  assert.equal(prince.verifiedChapters,27);
  assert.match(prince.sourceTitle,/1869 \(ВТ\)/);
  assert.ok(data.filterCompleteEditionBooks('Достоевский').length>=4);
  assert.match(books,/book\.sourceTitle\|\|book\.title/);
  assert.match(booksHtml,/id="readerOfficialEpub"/);
});

test('four additional popular Russian works keep real Wikisource IDs and non-guaranteed edition coverage',()=>{
  const first=books.indexOf('  const verifiedWholeEditions=');
  const last=books.indexOf('  function setSourceInfo(){',first);
  const works=new Function(books.slice(first,last)+'\nreturn completeEditionBooks;')();
  const byId=new Map(works.map(b=>[b.id,b]));
  for(const [id,title,parts] of [
    [1121477,'Алые паруса',18],
    [423065,'Слепой музыкант',31],
    [129409,'Кому на Руси жить хорошо',65],
    [384203,'Русские женщины',2]
  ]){
    const book=byId.get(id);
    assert.ok(book,'missing Wikisource page '+id);
    assert.equal(book.title,title);
    assert.equal(book.indexedParts,parts);
    assert.equal(book.sourceUrl,'https://ru.wikisource.org/w/index.php?curid='+id);
    assert.match(book.summary,/не подтверждена/);
  }
});
test('Roman numbered Wikisource chapters and dedication preserve historical reading order',()=>{
  const prefix='Государь (Макиавелли; Курочкин)/1869 (ВТ)/';
  const first=wikiApi.indexOf("  const collator=new Intl.Collator(wiki==='ru'?");
  const last=wikiApi.indexOf('  return {\n    chapters:chapters.length?',first);
  assert.ok(first>0&&last>first);
  const source=wikiApi.slice(first,last);
  const parts=['Глава IX','Глава V','Глава III','Глава I','Глава XXVI','Посвящение','Глава IV','Глава II'].map(x=>prefix+x);
  const chapters=new Function('wiki','prefix','leaves','MAX_CHAPTERS',source+'\nreturn chapters;')('ru',prefix,parts,320);
  assert.deepEqual(chapters.map(c=>c.label),[
    'Посвящение','Глава I','Глава II','Глава III','Глава IV','Глава V','Глава IX','Глава XXVI'
  ]);
});

test('original licensed film inventory remains 200 original publisher-linked films',()=>{
  const ctx={window:{}};
  vm.runInNewContext(read('public/cinema-featured-200.js'),ctx);
  assert.equal(ctx.window.VetogramCinemaFeatured200.length,200);
  assert.ok(ctx.window.VetogramCinemaFeatured200.every(f=>
    f.player?.type==='iframe'&&f.player?.licensed===true&&
    /^https:\/\/rutube\.ru\/play\/embed\/[a-f0-9]{32}$/i.test(f.player.url)));
});
