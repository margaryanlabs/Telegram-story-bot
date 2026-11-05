import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const base = new URL('../', import.meta.url);
const file = (p) => readFileSync(new URL(p, base), 'utf8');
const html = file('index.html');
const js = file('v10/market-history-modes.js');
const css = file('v10/market-history-modes.css');

test('history modes are loaded after original world, without removing the People scene', () => {
  assert.match(html, /v10\/market-history-modes\.css/);
  assert.match(html, /v10\/market-history-modes\.js/);
  assert.ok(html.indexOf('window.MarketV10?.start()') < html.indexOf('src="v10/market-history-modes.js"'));
  for (const marker of ['id="scene"','id="markers"','id="selectedCard"','id="signalDock"','id="lensPanel"','id="drawer"']) assert.ok(html.includes(marker), marker);
});

test('the selected historical events carry explicit dates and primary institutional sources', () => {
  for (const year of ['1907','1929','1987','1998','2008','2010','2020','2023']) assert.ok(js.includes('"id": "' + year + '"'),year);
  for (const url of ['federalreservehistory.org/essays/panic-of-1907','federalreservehistory.org/essays/stock-market-crash-of-1987','fdic.gov/history/2000-2009','libertystreeteconomics.newyorkfed.org/2020/05/treasury-market-liquidity'])
    assert.ok(js.includes(url),url);
  assert.match(js,/NOT geographic coordinates/);
  assert.match(js,/NOT causation or real user participation/);
});

test('event and connection modes restore People and route to the existing Lens themes', () => {
  for (const mode of ['people','events','connections']) assert.ok(js.includes(mode),mode);
  assert.match(js,/function openPeopleTheme/);
  assert.match(js,/data-lens/);
  assert.match(js,/aria-pressed/);
  assert.match(js,/Prevent symbolic event beacons/);
  assert.match(js,/event\.stopPropagation\(\)/);
  assert.match(js,/history\.replaceState/);
  assert.match(js,/window\.MarketHistoryModes/);
});

test('responsive overlays cannot modify the original People sphere or storage', () => {
  assert.match(css, /@media\(max-width:819px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /#app\[data-mh-mode="events"\]/);
  assert.doesNotMatch(js,/localStorage\.setItem|sessionStorage\.setItem|fetch\(|XMLHttpRequest/);
});
