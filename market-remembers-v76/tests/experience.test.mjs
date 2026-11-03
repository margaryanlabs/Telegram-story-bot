import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const file=resolve(dirname(fileURLToPath(import.meta.url)),'../index.html');
const html=readFileSync(file,'utf8');
const script=html.match(/<script>([\\s\\S]*?)<\\/script>/);
test('self-contained renderer and JS parse',()=>{
  assert.ok(script,'inline runtime must exist');
  assert.doesNotThrow(()=>new Script(script[1]));
  assert.match(html,/id="gl"/);
  assert.match(html,/id="fallback"/);
  assert.match(html,/function beginDive\\(i\\)/);
  assert.match(html,/veto-market-remembers-demo-v4/);
});
test('story fragment and reader controls preserved',()=>{
  for(const id of ['selectedCard','selectedMood','selectedQuote','openSelected','nextSignal','drawer','drawerContents','closeDrawer','memoryDive','starFocusLabel']){
    assert.ok(html.includes('id="'+id+'"'),id+' missing');
  }
  assert.match(html,/reader-progress-rail/);
  assert.match(html,/v76UpdateReader/);
  assert.match(html,/MEMORY FRAGMENT/);
  assert.match(html,/memory-navigation/);
});
test('archive provenance and protection of demo records',()=>{
  assert.match(html,/archive-card-foot/);
  assert.match(html,/FICTIONAL/);
  assert.match(html,/LOCAL · PRIVATE/);
  assert.match(html,/не опубликована/);
  assert.match(html,/localStorage/);
});
test('mobile and reduced motion accommodations remain',()=>{
  assert.match(html,/@media\\(max-width:820px\\)/);
  assert.match(html,/@media\\(prefers-reduced-motion:reduce\\)/);
  assert.match(html,/pointercancel/);
  assert.match(html,/touch-action/);
});
