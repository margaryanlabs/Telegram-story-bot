import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext, Script} from 'node:vm';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const ui=source('public/telegram-stories.js');
const css=source('public/telegram-stories.css');

function ordered(state) {
  // Exercise the exact filtering/sorting logic used in the browser without a DOM.
  const begin=ui.indexOf('  function storyOrder() {');
  const end=ui.indexOf('  function toggleFavorite(',begin);
  assert.ok(begin>=0 && end>begin);
  return Array.from(runInNewContext(ui.slice(begin,end)+';storyOrder()', {state}));
}

const contacts=[
  {userId:'1',name:'Александр',username:'alex',stories:[{id:101}]},
  {userId:'2',name:'Мария',username:'maria',stories:[{id:102}]},
  {userId:'3',name:'Марина',username:'other',stories:[{id:103}]},
];

test('Stories 2.0 shows session favorites first with stable original order',()=>{
  const state={contacts,favorites:new Set(['3','2']),query:'',onlyFavorites:false};
  assert.deepEqual(ordered(state),[1,2,0]);
  state.favorites.clear();
  assert.deepEqual(ordered(state),[0,1,2]);
});

test('Stories 2.0 filters contact names and usernames without losing real indices',()=>{
  const state={contacts,favorites:new Set(['3']),query:'ма',onlyFavorites:false};
  assert.deepEqual(ordered(state),[2,1]);
  state.onlyFavorites=true;
  assert.deepEqual(ordered(state),[2]);
  state.query='alex';
  assert.deepEqual(ordered(state),[]);
  state.onlyFavorites=false;
  assert.deepEqual(ordered(state),[0]);
});

test('Story UI remains syntax-valid, private and embedded in existing messenger',()=>{
  assert.doesNotThrow(()=>new Script(ui));
  assert.match(ui,/data-veto-story-search/);
  assert.match(ui,/data-veto-story-only-favorites/);
  assert.match(ui,/data-veto-story-favorite/);
  assert.match(ui,/state\.favorites\.clear\(\);state\.seen\.clear\(\)/);
  assert.match(ui,/state\.seen\.add\(String\(person\.userId\)/);
  assert.match(ui,/Math\.abs\(dx\)>65/);
  assert.match(ui,/aria-pressed/);
  assert.match(css,/\.veto-story-contact-shell/);
  assert.match(css,/\.veto-story-stage-pin/);
  assert.doesNotMatch(ui,/localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(ui,/readStories|incrementStoryViews|sendReaction|ActivateStealthMode/);
  assert.match(ui,/x-veto-story-mode/);
  assert.match(ui,/owner!==state\.owner/);
  assert.match(source('public/studio.html'),/telegram-stories\.js\?v=\d{8}-[a-z0-9-]+/);
});
