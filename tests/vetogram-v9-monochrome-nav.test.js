/* Vetogram V9: monochrome information architecture and source-bound safety.
 * Offline contract; browser/Telegram QA is a separate mandatory release gate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const html=read('studio.html');
const app=read('app.js');
const css=read('vetogram-reborn-ui.css');
const modules=read('vetogram-reborn-modules.css');

test('five immediate destinations exist in correct bottom navigation order',()=>{
  const nav=html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0]||'';
  const tabs=[...nav.matchAll(/<button class="nav-item(?: active)?" data-nav="([^"]+)"/g)].map(x=>x[1]);
  assert.deepEqual(tabs,['telegram','publish','media','play','privacy']);
  assert.match(nav,/aria-label="Игры"/);
  assert.match(nav,/data-reborn-nav="five"/);
  assert.match(css,/grid-template-columns:\s*repeat\(5,minmax\(0,1fr\)\)/);
});

test('Games is an actual independent route, not swallowed by Media',()=>{
  assert.match(html,/data-screen="play"/);
  assert.match(app,/play:'play',chats:'privacy'/);
  assert.doesNotMatch(app,/play:'media'/);
  assert.match(app,/\['home','telegram','publish','media','play','privacy'\]/);
  assert.match(html,/id="vpCatalogCount"/);
});

test('cinema music books are real modules, local games are not a media catalog tile',()=>{
  for(const module of ['music','cinema','books'])
    assert.match(html,new RegExp('data-v6-module="'+module+'"'));
  assert.doesNotMatch(html,/class="v6-world v6-world-play v72-media-card"/);
  assert.match(html,/data-screen="media"/);
  assert.match(html,/id="v6MediaStage"/);
  assert.match(html,/id="v61Player"/);
});

test('a unified cache release prevents stale Android/WebView CSS and JS',()=>{
  const values=[...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']\/[^"']+\.(?:js|css)\?v=([^"'&#]+)["']/g)].map(x=>x[1]);
  assert.ok(values.length>=60);
  assert.deepEqual([...new Set(values)],['20261105-v9-02']);
  for(const file of ['music-module.html','cinema.html','books.html'])
    assert.match(read(file),/\/vetogram-reborn-modules\.css\?v=20261105-v9-02/);
});

test('monochrome source token system does not reintroduce the blue presentation',()=>{
  for(const col of ['#121d2f','#111a2a','#151e30','#b9d2ff'])
    assert.ok(!css.includes(col)&&!modules.includes(col),'legacy blue token: '+col);
  assert.match(css,/V9 \/ EDITORIAL MEDIA ENTRY/);
  assert.match(css,/background:#050505\s*!important/);
  assert.match(css,/prefers-reduced-motion/);
});

test('No Telegram auth, ownership, music playback or protected sheet is replaced',()=>{
  for(const id of ['telegramThreadCompose','telegramThreadMessages',
    'v6Frames','v61Player','sheet'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(app,/viewerOwnerEpoch/);
  assert.match(html,/vetogram-reborn-ui\.css/);
});


test('six local playable games are visible in launcher before progress and future roadmap',()=>{
  const launchButtons=[...html.matchAll(/data-v9-launch="(reaction|pairs|tic|2048|mines|snake)"/g)].map(x=>x[1]);
  assert.deepEqual(launchButtons,['reaction','pairs','tic','2048','mines','snake']);
  assert.ok(html.indexOf('id="v9ArcadeLauncher"')<html.indexOf('id="vpLocalStats"'));
  assert.ok(html.indexOf('id="vpQuickGames"')<html.indexOf('id="vpLocalStats"'));
  const games=read('vetogram-play.js');
  assert.match(games,/window\.VetogramV9GameBack/);
  assert.match(games,/window\.VetogramV9GameIsOpen/);
  assert.match(app,/vetogram:game-view-changed/);
  assert.match(app,/window\.VetogramV9GameBack\?\.\(\)/);
});
test('personal library search is a disclosure and media modules have one direct entry per category',()=>{
  assert.match(html,/<details class="v9-saved-search" id="v9SavedSearch">/);
  const world=html.slice(html.indexOf('class="v6-media-grid'),html.indexOf('class="v72-discovery-note'));
  for(const name of ['music','cinema','books'])
    assert.match(world,new RegExp('data-v6-module="'+name+'"'));
  assert.doesNotMatch(world,/data-open-screen="play"/);
});
test('embedded media accepts theme synchronization from verified same-origin parent only',()=>{
  const ctx=read('vetogram-media-context.js');
  assert.match(ctx,/event\.origin!==location\.origin\|\|event\.source!==parent/);
  assert.match(ctx,/dataset\.universeTheme=next/);
  assert.match(modules,/EMBEDDED APPEARANCE SYNC/);
});
