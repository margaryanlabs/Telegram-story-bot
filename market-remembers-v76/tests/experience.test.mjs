import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const file=resolve(dirname(fileURLToPath(import.meta.url)),'../index.html');
const html=readFileSync(file,'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];

test('original renderer and inline JavaScript parse',()=>{
  assert.equal(scripts.length,1,'exactly one inline runtime');
  assert.doesNotThrow(()=>new Script(scripts[0][1]));
  assert.match(html,/id="gl"/);
  assert.match(html,/id="fallback"/);
  assert.match(html,/function beginDive\(i\)/);
  assert.match(html,/veto-market-remembers-demo-v4/);
});
test('selected story fragment and reader are connected',()=>{
  for(const id of ['selectedCard','selectedMood','selectedQuote','openSelected','nextSignal','drawer','drawerContents','closeDrawer','memoryDive','starFocusLabel']){
    assert.ok(html.includes('id="'+id+'"'),id+' missing');
  }
  assert.match(html,/reader-progress-rail/);
  assert.match(html,/v76UpdateReader/);
  assert.match(html,/MEMORY FRAGMENT/);
  assert.match(html,/memory-navigation/);
});
test('archive provenance and demo data safeguards remain',()=>{
  assert.match(html,/archive-card-foot/);
  assert.match(html,/FICTIONAL/);
  assert.match(html,/LOCAL · PRIVATE/);
  assert.match(html,/не опубликована/);
  assert.match(html,/localStorage/);
});
test('mobile and reduced motion accommodations remain',()=>{
  assert.match(html,/@media\(max-width:820px\)/);
  assert.match(html,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html,/pointercancel/);
  assert.match(html,/touch-action/);
});
