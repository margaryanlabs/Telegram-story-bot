/* V9 world cinema source regression: no fake play licences and no Russian-first homepage. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
const html=read('cinema.html'),js=read('cinema.js'),style=read('vetogram-reborn-modules.css');

test('first cinema viewport prioritizes international shelves before technical portal',()=>{
  const hero=html.indexOf('id="cinemaHero"');
  const foreign=html.indexOf('id="cinemaForeignShelf"');
  const series=html.indexOf('id="cinemaWorldSeries"');
  const portal=html.indexOf('id="v78MediaHub"');
  assert.ok(hero>=0&&foreign>hero&&series>foreign&&portal>series);
  assert.match(html,/id="cinemaForeignRail"/);
  assert.match(html,/id="cinemaWorldSeriesRail"/);
  assert.doesNotMatch(html,/Большая коллекция русского кино/);
});

test('rotating international hero uses sourced overseas entries, not a Russian licensed fallback',()=>{
  assert.match(js,/const V9_WORLD_PRIORITY=/);
  assert.match(js,/const isWorldSpotlight=f=>Boolean\(f\.externalRutube/);
  assert.match(js,/f\.seriesPopular&&f\.seriesGroup==="global"/);
  assert.match(js,/Zero Hollywood footage\/posters is a valid state/);
  const start=js.indexOf('function updateHeroDeck(){');
  const end=js.indexOf('function renderFranchise(){',start);
  assert.ok(start>=0&&end>start);
  const deck=js.slice(start,end);
  assert.doesNotMatch(deck,/const recents=films\.filter/);
  assert.doesNotMatch(deck,/const recents=films\.filter/);
});

test('movie discovery must never imply that external RUTUBE upload is licensed in-app playback',()=>{
  assert.match(js,/if\(f\.discoveryOnly\|\|f\.externalRutube\)openDetails\(f\);else play\(f\)/);
  assert.match(js,/licensedHere\?"▶ Смотреть":"Подробнее и источники"/);
  assert.match(js,/const external=films\.filter\(f=>isWorldSpotlight\(f\)\)/);
  assert.match(js,/f\.player\?\.licensed===true/);
  assert.match(js,/if\(f\.externalRutube\|\|f\.discoveryOnly\)/);
});

test('Russian official archive shelves move to the catalog, world stays on home',()=>{
  assert.match(js,/const worldHome=state\.tab==="home"/);
  assert.match(js,/if\(worldHome\)return \[\.\.\.list\]\.sort/);
  assert.match(js,/const catalog=state\.tab==="catalog"&&!state\.query\.trim\(\)/);
  assert.match(js,/const showRussian=state\.tab==="catalog"/);
  assert.match(js,/state\.tab!=="catalog"\|\|Boolean\(state\.query\.trim\(\)\)/);
  assert.match(js,/Мировое кино и сериалы/);
});

test('editorial global carousel is cinematic, reduced-motion and light-theme aware',()=>{
  assert.match(style,/V9 WORLD CINEMA/);
  assert.match(style,/cinemaWorldSeries/);
  assert.match(style,/aspect-ratio:16\/10/);
  assert.match(style,/prefers-reduced-motion:reduce/);
  assert.match(style,/data-universe-theme="pearl"/);
});

test('featured overseas films are actual source-only metadata with HTTPS artwork, never embedded streams',()=>{
  const window={};
  runInNewContext(read('cinema-foreign-rutube.js'),{window});
  const featured=window.VetogramCinemaForeignRutube.filter(f=>f.featuredForeign);
  assert.ok(featured.length>=3,'editorial hero needs at least three real foreign source entries');
  assert.ok(featured.every(f=>f.externalRutube&&f.discoveryOnly&&!f.player));
  assert.ok(featured.every(f=>/^https:\/\//.test(f.poster)&&/^https:\/\//.test(f.sourcePage)));
  assert.ok(new Set(featured.map(f=>f.id)).size===featured.length);
});

test('international series route exposes official provider metadata without fake playback',()=>{
  const window={};
  runInNewContext(read('cinema-popular-series.js'),{window});
  const global=window.VetogramCinemaPopularSeries.filter(f=>f.seriesGroup==='global');
  assert.ok(global.length>=8);
  assert.ok(global.every(f=>f.seriesPopular&&f.discoveryOnly&&!f.player&&/^https:\/\//.test(f.sourcePage)));
  assert.match(js,/function renderPopularSeries\(\)/);
  assert.match(js,/renderPopularSeries\(\);/);
  assert.match(js,/section\.classList\.toggle\("hidden",!visible\)/);
  assert.match(js,/rail\.replaceChildren\(\.\.\.list\.map\(filmCard\)\)/);
});

test('foreign catalog opens all featured titles, regardless of unverified dubbing claims',()=>{
  assert.match(js,/foreignIncludeUnverified:true,selected:null/);
  assert.match(html,/id="cinemaForeignIncludeUnverified" type="checkbox" checked/);
  assert.match(js,/state\.foreignIncludeUnverified\|\|f\.audioClaim/);
  assert.match(js,/if\(tab==="foreign"\)\$\("cinemaForeignIncludeUnverified"\)\.checked=state\.foreignIncludeUnverified/);
});

test('Russian studio collections, watch-now and network load-more do not interrupt world home',()=>{
  assert.match(js,/cinemaStudios"\)\.classList\.toggle\("hidden",tab!=="catalog"/);
  assert.match(js,/cinemaMoreStudios"\)\.classList\.toggle\("hidden",state\.tab!=="catalog"/);
  assert.match(js,/cinemaLoadMore"\)\.classList\.toggle\("hidden"[^\n]*state\.tab==="home"/);
  assert.match(js,/section\.classList\.toggle\("hidden",state\.tab!=="catalog"/);
});

test('home editorial curation includes six distinct source-backed global hero choices',()=>{
  const window={};
  runInNewContext(read('cinema-foreign-rutube.js'),{window});
  const ids=[...js.matchAll(/"rutube-foreign-([a-f0-9]{32})"/g)].map(m=>m[0].slice(1,-1));
  const curated=window.VetogramCinemaForeignRutube.filter(f=>ids.includes(f.id));
  assert.ok(curated.length>=6);
  assert.ok(curated.every(f=>f.externalRutube&&f.discoveryOnly&&!f.player&&/^https:\/\//.test(f.poster)));
  assert.ok(new Set(curated.map(f=>f.id)).size===curated.length);
  assert.match(js,/const V9_WORLD_SPOTLIGHT_SET=new Set\(V9_WORLD_SPOTLIGHT\)/);
  assert.match(js,/const world=films\.filter\(f=>isWorldSpotlight\(f\)/);
});

test('series without licensed artwork receive honest, accessible typographic covers',()=>{
  assert.match(js,/div\.classList\.add\("cinema-world-series-art"\)/);
  assert.match(js,/МИРОВОЙ СЕРИАЛ · ИСТОЧНИК/);
  assert.match(style,/Source-only global series get an intentional monochrome typographic cover/);
  assert.match(style,/cinemaSeriesPopularRail/);
});

test('search in cinema home and search tab includes foreign metadata and restores hero on clear',()=>{
  assert.match(js,/const worldBrowse=state\.tab==="home"/);
  assert.match(js,/let list=worldBrowse\|\|state\.tab==="search"/);
  assert.match(js,/worldHome\?isWorldSpotlight\(f\):f\.externalRutube/);
  assert.match(js,/if\(key===discovery\.lastKey\)\{\$\("cinemaHero"\)\.classList\.toggle\("hidden",!isHome\(\)\|\|!deck\.length\);return;\}/);
  assert.match(js,/Поиск по мировому кино/);
});
