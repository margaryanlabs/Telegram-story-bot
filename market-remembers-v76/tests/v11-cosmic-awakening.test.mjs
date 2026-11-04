import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../v10/cosmic-awakening.css',import.meta.url),'utf8');

test('V11 remains a distinct preview; V10 shell is not replaced',()=>{
  assert.match(html,/<title>THE MARKET REMEMBERS V(?:11(?: — COSMIC AWAKENING|\.7 — EXPLAINABLE CONSTELLATIONS)|12 — RELEASE CANDIDATE)<\/title>/);
  assert.match(html,/v10\/cosmic-awakening\.css/);
  assert.match(html,/id="scene"/);
  assert.match(html,/id="signalDock"/);
});
test('Native WebGL orbital light, not a fake centered CSS globe',()=>{
  assert.match(html,/float planeA=abs\(dot\(vObject/);
  assert.match(html,/visibleFace\*\(vec3/);
  assert.match(html,/float depth=mix\(\.09,\.57/);
  assert.doesNotMatch(css,/\.scene\s*::(?:before|after)\s*\{/);
});
test('Canvas fallback receives equivalent orbital visual treatment',()=>{
  assert.match(html,/Canvas2D counterpart to the globe/);
  assert.match(html,/ctx\.ellipse\(c\.x,c\.y,r\*\.96,r\*\.41/);
  assert.match(html,/function init2D\(/);
});
test('Mobile shows only the four working observatory controls',()=>{
  assert.match(css,/world-controls button:nth-child\(-n\+4\)\{display:none!important\}/);
  for(const id of ['globeScale','toggleAtlas','focusMode','lensToggle'])
    assert.match(css,new RegExp('#'+id+'::before'));
  assert.match(html,/id="worldControls"/);
});
test('Still supports real storage, readers and navigation',()=>{
  assert.match(html,/v10\/living-universe\.js/);
  assert.match(html,/v10\/legacy-submission\.js/);
  assert.match(html,/v10\/navigation\.js/);
  assert.match(html,/v10\/story-experience\.js/);
});
test('Reduced motion and accessible control feedback preserved',()=>{
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/focus-visible/);
  assert.match(html,/id="focusMode"[^>]+aria-label=/);
});
