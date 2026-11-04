import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../v10/cosmic-awakening.css',import.meta.url),'utf8');

test('V11.1 uses thinner real 3D orbit guides with restrained glow',()=>{
  assert.match(html,/float traceA=1\.-smoothstep\(\.0015,\.008,planeA\)/);
  assert.match(html,/float traceB=1\.-smoothstep\(\.0015,\.007,planeB\)/);
  assert.match(html,/glowA\*\.24/);
  assert.match(html,/glowB\*\.16/);
});
test('Portrait sphere avoids excessive overlap with the memory dock',()=>{
  assert.match(html,/nominalRadius=Math\.min\(w,h\)\*\(short\?\.325:\.347\)/);
  assert.match(html,/height\*\(short\?\.56:\.552\)/);
  assert.match(html,/v9PortraitFrame\(w,h/);
  assert.match(html,/id="signalDock"/);
});
test('Mobile card remains legible without a fully opaque wall',()=>{
  assert.match(css,/#10212fe2,#0a1420ed/);
  assert.match(css,/world-controls button:nth-child\(-n\+4\)\{display:none!important\}/);
  assert.match(css,/font-size:10px;line-height:1\.2;letter-spacing:0;gap:2px/);
});
