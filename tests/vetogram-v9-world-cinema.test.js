/* V9 world cinema source regression: no fake play licences and no Russian-first homepage. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
  assert.match(js,/f\.externalRutube&&f\.featuredForeign/);
  assert.match(js,/f\.seriesPopular&&f\.seriesGroup==="global"/);
  assert.match(js,/Zero Hollywood footage\/posters is a valid state/);
  const start=js.indexOf('function updateHeroDeck(){');
  const end=js.indexOf('function renderFranchise(){',start);
  assert.ok(start>=0&&end>start);
  const deck=js.slice(start,end);
  assert.doesNotMatch(deck,/const recents=films\.filter/);
  assert.doesNotMatch(deck,/russian/ig);
});

test('movie discovery must never imply that external RUTUBE upload is licensed in-app playback',()=>{
  assert.match(js,/if\(f\.discoveryOnly\|\|f\.externalRutube\)openDetails\(f\);else play\(f\)/);
  assert.match(js,/licensedHere\?"▶ Смотреть":"Подробнее и источники"/);
  assert.match(js,/const external=films\.filter\(f=>f\.externalRutube&&f\.featuredForeign\)/);
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
