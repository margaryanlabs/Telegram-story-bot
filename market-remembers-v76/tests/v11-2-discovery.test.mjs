import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../v10/cosmic-awakening.css',import.meta.url),'utf8');
const runtime=html.match(/<script>([\s\S]*?)<\/script>/)?.[1]??'';

test('Discovery cue is unique, readable and non-interactive',()=>{
  assert.equal((html.match(/id="universeGuide"/g)||[]).length,1);
  assert.match(html,/Коснись звезды — открой её историю/);
  assert.match(css,/v112-onboarding\{[\s\S]*?pointer-events:none/);
});
test('First-use cue yields to star focus, reader or immersive view',()=>{
  assert.match(runtime,/guide\.hidden=focusLabelActive\|\|immersive\|\|!\$\('drawer'\)\.hidden\|\|!\$\('memoryDive'\)\.hidden/);
  assert.match(runtime,/function focus\(i,open\)/);
});
test('Old reticle is hidden but real stellar selection remains',()=>{
  assert.match(css,/#app\.obsidian \.signal-reticle\{display:none!important\}/);
  assert.match(runtime,/function v97PickStarAt\(/);
  assert.match(html,/id="markers"/);
  assert.match(runtime,/function beginDive\(i\)/);
});
test('Native star radiance is upgraded without new animation loops',()=>{
  assert.match(runtime,/float depth=mix\(\.09,\.57/);
  assert.match(html,/v10\/universe-atmosphere\.js/);
  assert.match(runtime,/requestAnimationFrame\(animate\)/);
});
