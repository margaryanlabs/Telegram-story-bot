import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const styles=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
test('Story Engine mobile layout keeps template labels readable and tap targets large',()=>{
  const css=styles('story-engine.css');
  const section=css.slice(css.indexOf('VETOGRAM mobile design pass'));
  assert.ok(section.length>200);
  assert.match(section,/\.se-templates\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(section,/\.se-template strong\{font-size:11px/);
  assert.match(section,/\.se-controls-row \.se-button\{flex:1 1 120px;min-height:46px/);
  assert.match(section,/#seUndoAiText:not\(\[hidden\]\)/);
  assert.match(section,/\.se-input\{font-size:16px/);
  assert.match(section,/:focus-visible/);
});
test('VETO AI buttons and fields have touch/mobile and reduced-motion protection',()=>{
  const css=styles('vetogram-ai.css');
  const section=css.slice(css.indexOf('VETOGRAM mobile polish · UI-only'));
  assert.ok(section.length>200);
  assert.match(section,/\.vtai-modes button,\.vtai-action\{min-height:44px/);
  assert.match(section,/\.vtai-input\{font-size:16px/);
  assert.match(section,/overflow-x:auto/);
  assert.match(section,/prefers-reduced-motion:reduce/);
  assert.match(section,/#vtaiTasksList|\.vtai-task-date-row/);
});
