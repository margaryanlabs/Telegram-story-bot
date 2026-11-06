import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const modes = read('v10/market-history-modes.js');
const css = read('v10/v20-crisis-atlas.css');
const html = read('index.html');

test('V20 crisis navigator links exact four sourced dates, previous/next and progress', () => {
  const dates = ['1907', '1987', '2008', '2020'];
  for (const year of dates) assert.ok(modes.includes("id: '" + year + "'"));
  assert.match(modes, /const eventIndex = EVENTS\.findIndex/);
  assert.match(modes, /const previousEvent = EVENTS\[\(eventIndex - 1 \+ EVENTS\.length\) % EVENTS\.length\]/);
  assert.match(modes, /const followingEvent = EVENTS\[\(eventIndex \+ 1\) % EVENTS\.length\]/);
  assert.match(modes, /data-mh-v20-direction="prev"/);
  assert.match(modes, /data-mh-v20-direction="next"/);
  assert.match(modes, /aria-label="Событие '/);
  assert.match(modes, /panel\.innerHTML = chronicle \+/);
  new Script(modes);
});

test('V20 switching a crisis never forces the full dossier or destroys keyboard focus', () => {
  assert.match(modes, /function selectEvent\(id\)/);
  assert.match(modes, /panelExpanded = false;\s*renderPanel\(\);/);
  assert.match(modes, /const fromQuickNav=origin\?\.closest/);
  assert.match(modes, /if\(fromQuickNav\)\{\s*panel\.querySelector/);
  assert.match(modes, /data-mh-v20-direction="'\+fromQuickNav/);
  assert.match(modes, /if\(target\.closest\('\[data-mh-panel-toggle\]'\)\)/);
  assert.match(modes, /const eventBtn = target\.closest\('\[data-mh-event\]'\)/);
  assert.match(modes, /updateUrl\(\);/);
  assert.match(modes, /window\.MarketEventPlanet\?\.focus\(EVENT_BY_ID\[id\]\.p\)/);
});

test('V20 source line and impact strip only use archived event records', () => {
  assert.match(modes, /const impact=event\.mechanism\.split\('→'\)/);
  assert.match(modes, /aria-label="Схема механизма кризиса"/);
  assert.match(modes, /class="mh-v20-source-line"/);
  assert.match(modes, /escape\(event\.url\)/);
  assert.match(modes, /escape\(event\.source\)/);
  assert.match(modes, /rel="noopener noreferrer"/);
  assert.doesNotMatch(modes, /Math\.random\(|localStorage\.setItem\(|sendBeacon\(/);
});

test('V20 presentation is loaded last, scoped and mobile / reduced-motion safe', () => {
  const prior = html.indexOf('v10/v19-story-and-worlds.css');
  const current = html.indexOf('v10/v20-crisis-atlas.css');
  assert.ok(prior > -1 && current > prior, 'V20 layer must follow V19');
  assert.match(css, /#app\.mh-v16\[data-mh-mode="events"\] \.mh-history-panel/);
  assert.match(css, /#app\.mh-v16\[data-mh-mode="people"\] \.signal-dock/);
  assert.match(css, /#app \.mh-history-panel:not\(\.is-expanded\)>\.mh-panel-body/);
  assert.match(css, /@media\(max-width:819px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /focus-visible/);
  let depth = 0;
  for (const char of css) {
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    assert.ok(depth >= 0, 'No prematurely closing CSS brace');
  }
  assert.equal(depth, 0, 'No unclosed CSS block');
});
