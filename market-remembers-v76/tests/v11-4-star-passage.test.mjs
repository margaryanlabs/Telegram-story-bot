import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../v10/star-passage-v11.css',import.meta.url),'utf8');
const runtime=html.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'';
const fragment=(name,until)=>runtime.slice(runtime.indexOf(name),runtime.indexOf(until,runtime.indexOf(name)));

test('Star Passage V11.4 loads as a separate versioned layer without replacing V11.3',()=>{
  assert.match(html,/(?:STAR PASSAGE \/ OBSERVATORY № 11\.4|MEMORY ATLAS \/ OBSERVATORY № 11\.5)/);
  assert.match(html,/v10\/cosmic-awakening\.css/);
  assert.match(html,/v10\/star-passage-v11\.css/);
  assert.doesNotThrow(()=>new Script(runtime));
});

test('Star gate anchors to the real projected 3D story star',()=>{
  assert.equal((html.match(/id="v114PassageQuote"/g)||[]).length,1);
  assert.equal((html.match(/class="v114-star-gate"/g)||[]).length,1);
  assert.match(fragment('function updateDivePosition()', 'function showToast('),/project\(stories\[diveIndex\]\.p\)/);
  assert.match(fragment('function updateDivePosition()', 'function showToast('),/--dx/);
  assert.match(fragment('function updateDivePosition()', 'function showToast('),/--dy/);
  assert.match(css,/left:var\(--dx\);top:var\(--dy\)/);
});

test('Prelude is sourced from selected star and preserves accurate privacy/type labels',()=>{
  const begin=fragment('function beginDive(i)', 'function updateDivePosition()');
  assert.match(begin,/const source=stories\[index\]/);
  assert.match(begin,/source\.quote\|\|''/);
  assert.match(begin,/slice\(0,155\)/);
  assert.match(begin,/ЛИЧНАЯ ЗАПИСЬ · ТОЛЬКО В ЭТОМ БРАУЗЕРЕ/);
  assert.match(begin,/ВЫМЫШЛЕННАЯ ИСТОРИЯ/);
  assert.match(begin,/ИСТОЧНИК · ИСТОРИЧЕСКАЯ ЦИТАТА/);
  assert.doesNotMatch(begin,/innerHTML/);
});

test('Flight state stays finite and 1.35s, with cancel and background pause intact',()=>{
  assert.match(runtime,/function v9PhaseFor\(elapsed\)/);
  assert.match(runtime,/setTimeout\(\(\)=>finishDive\(token\),1350\)/);
  assert.match(runtime,/function cancelDive\(suppressFocus=false\)/);
  assert.match(runtime,/function v93SuspendPassage\(\)/);
  assert.match(runtime,/function v93ResumePassage\(\)/);
  assert.match(runtime,/if\(reduceMotion\)\{showStory\(stories\[index\]\);return\}/);
  assert.match(css,/data-suspended="true"/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test('Mobile story preview remains editorial and lightweight',()=>{
  assert.match(css,/@media\(max-width:819px\)/);
  assert.match(css,/v114-passage-quote/);
  assert.match(css,/-webkit-line-clamp:2/);
  assert.doesNotMatch(css,/canvas\.getContext|new WebGLRenderingContext|requestAnimationFrame/);
  assert.match(css,/pointer-events:none/);
});
