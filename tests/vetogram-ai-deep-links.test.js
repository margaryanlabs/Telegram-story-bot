import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
const html=read('studio.html');
const controller=read('vetogram-ai.js');

test('chat shortcuts explicitly open AI Reply and Story Engine keeps Director',()=>{
  assert.match(html,/AI-ответ<\/button>/);
  assert.match(html,/data-open-screen="ai" data-ai-mode="reply"/);
  assert.match(html,/data-open-screen="ai" data-ai-mode="story"/);
  assert.match(controller,/document\.querySelectorAll\('\[data-open-screen="ai"\]\[data-ai-mode\]'\)/);
});

test('real deep-link controller switches only into allowlisted draft modes',()=>{
  const begin=controller.indexOf('document.querySelectorAll(\'[data-open-screen="ai"][data-ai-mode]\')');
  const end=controller.indexOf('// One-tap reply',begin);
  assert.ok(begin>=0&&end>begin,'must test real deep-link event binding');
  const source=controller.slice(begin,end).trim();
  const clicks=[];
  const modes=['reply','story','unknown','action'];
  const buttons=modes.map(aiMode=>({dataset:{aiMode},
    addEventListener(type,cb){assert.equal(type,'click');this.activate=cb}}));
  const document={querySelectorAll:selector=>{
    assert.equal(selector,'[data-open-screen="ai"][data-ai-mode]');
    return buttons;
  }};
  vm.runInNewContext(source,{document,setMode:mode=>clicks.push(mode)});
  buttons.forEach(b=>b.activate());
  assert.deepEqual(clicks,['reply','story']);
  assert.doesNotMatch(source,/\b(fetch|send|generate|publish|request)\s*\(/);
});
