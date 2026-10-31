/* VETOGRAM 6.3: user-visible Play means original approved source, not title metadata. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const musicHtml=read('public/music-module.html');
const cinemaHtml=read('public/cinema.html');
const musicCore=read('public/vetogram-music.js');
const musicHome=read('public/vetogram-music-licensed-home-63.js');
const cinema=read('public/cinema.js');
const api=read('api/books-wikisource.js');
const books=read('public/books.js');
const css=read('public/vetogram-media-edition-62.css');
function parseSource(path,name){
  const ctx={window:{}};
  vm.runInNewContext(read(path),ctx);
  return Array.from(ctx.window[name]);
}
test('160 licensed full MP3 metadata records exist with original attribution and no NC/ND works',()=>{
  const tracks=parseSource('public/vetogram-music-mixter-seeds.js','VetogramMixterSeeds');
  assert.equal(tracks.length,160);
  assert.equal(new Set(tracks.map(x=>x.upload_id)).size,160);
  for(const track of tracks){
    assert.match(track.file_page_url,/^https:\/\/ccmixter\.org\/files\/[^/]+\/\d+$/i);
    assert.match(track.license_url,/^https?:\/\/creativecommons\.org\/licenses\/by\/(?:2\.0|2\.5|3\.0|4\.0)\/$/i);
    assert.ok(track.upload_name&&track.user_real_name);
    assert.ok(track.files.some(x=>/^https:\/\/ccmixter\.org\/content\/[^?#]+\.mp3$/i.test(x.download_url)));
  }
});
test('music home mounts real on-demand player buttons and hides failures rather than inventing replacement audio',()=>{
  assert.match(musicHtml,/id="licensedHomeTracks"/);
  assert.match(musicHtml,/vetogram-music-licensed-home-63\.js/);
  assert.ok(musicHtml.indexOf('vetogram-music-mixter-seeds.js')<musicHtml.indexOf('vetogram-music-licensed-home-63.js'));
  assert.match(musicHome,/V\.play\(t,playable\(\)\)/);
  assert.match(musicHome,/vetogram:audio-error/);
  assert.match(musicHome,/unavailable\.add\(id\);render\(\)/);
  assert.match(musicCore,/detail:\{trackId\}/);
  assert.match(musicHome,/licensed-home-license/);
});
test('260 additional real video IDs refer to approved RUTUBE publisher embed endpoints',()=>{
  const films=parseSource('public/cinema-additional-official-63.js','VetogramCinemaAdditionalOfficial63');
  assert.equal(films.length,260);
  assert.equal(new Set(films.map(f=>f.id)).size,260);
  const authorities=new Map([
    ['mosfilm','Киноконцерн «Мосфильм»'],
    ['lenfilm','Киностудия «Ленфильм»'],
    ['gorky','Киностудия Горького'],
    ['starmedia','Star Media'],['marsmedia','Марс Медиа'],
    ['soyuzmultfilm','Союзмультфильм']
  ]);
  for(const f of films){
    assert.match(f.id,/^rutube-(mosfilm|lenfilm|gorky|starmedia|marsmedia|soyuzmultfilm)-[a-f0-9]{32}$/i);
    const publisher=f.id.match(/^rutube-([a-z]+)-/)[1];
    assert.equal(f.creator,authorities.get(publisher));
    const id=f.id.slice(-32);
    assert.equal(f.sourcePage,'https://rutube.ru/video/'+id+'/');
    assert.equal(f.player.url,'https://rutube.ru/play/embed/'+id);
    assert.equal(f.player.type,'iframe');
    assert.equal(f.player.licensed,true);
    assert.ok(f.minutes>=3&&f.minutes<=360);
    assert.ok(f.sourceCatalog==='rutube-official-channel');
  }
});
test('film app includes extra original studio sources but hides unlicensed discovery-only play cards',()=>{
  assert.match(cinemaHtml,/src="\.\/cinema-additional-official-63\.js"/);
  assert.ok(cinemaHtml.indexOf('src="./cinema-additional-official-63.js"')<cinemaHtml.indexOf('src="./cinema.js"'));
  assert.match(cinema,/window\.VetogramCinemaAdditionalOfficial63/);
  assert.match(cinema,/let list=films\.filter\(f=>!f\.externalRutube&&!f\.discoveryOnly/);
  assert.match(cinema,/function renderWatchNow\(\)/);
  assert.match(cinema,/actuallyPlayable/);
  assert.match(css,/\[data-tab="foreign"\]/);
  assert.match(cinema,/if\(tab==="foreign"\)tab="catalog"/);
});
test('124 validated Wikisource IDs are unique and full readers keep the chapter cap above 365',()=>{
  const start=books.indexOf('  const verifiedWholeEditions=');
  const end=books.indexOf('  function setSourceInfo(){',start);
  assert.ok(start>0&&end>start);
  const inventory=new Function(books.slice(start,end)+'\nreturn completeEditionBooks;')();
  assert.equal(inventory.length,124);
  assert.equal(new Set(inventory.map(b=>b.id)).size,124);
  assert.ok(inventory.every(b=>b.provider==='wikisource'&&b.wiki==='ru'&&b.readable));
  assert.match(api,/const MAX_CHAPTERS = 600/);
  assert.match(books,/indexedParts/);
  assert.match(books,/verifiedSourceBytes/);
});
