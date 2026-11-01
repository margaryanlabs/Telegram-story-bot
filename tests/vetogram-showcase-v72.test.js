/* VETOGRAM 7.2 media/arcade: structural and accessibility regression contracts.
 * These checks verify real entrypoints and the existing game runner; not external streaming.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const shell=read('public/studio.html');
const style=read('public/vetogram-showcase-v72.css');
const runner=read('public/vetogram-play-runner.js');
test('the real integrated shell ships V7.2 media and arcade and preserves module dispatch',()=>{
  assert.match(shell,/id="v6MediaHome"/);
  assert.match(shell,/class="v61-hero v72-media-hero"/);
  assert.match(shell,/class="v6-media-grid v72-media-grid"/);
  assert.match(shell,/class="vp-mini-grid v72-arcade-grid"/);
  assert.match(shell,/class="vp-hero v72-play-hero"/);
  for(const name of ['music','cinema','books']){
    assert.match(shell,new RegExp('class="v6-world v6-world-'+name+' v72-media-card" data-v6-module="'+name+'"'));
  }
  assert.match(shell,/class="v6-world v6-world-play v72-media-card" data-open-screen="play"/);
  assert.match(shell,/id="v6MediaStage"/);
  assert.match(shell,/id="v6MediaBack"/);
});
test('six ready mini games retain their original live node IDs and dialog focus mode',()=>{
  const games=[['reaction','vpReactionButton'],['pairs','vpMemoryGrid'],['tic','vpTttGrid'],['2048','vp2048Grid'],['mines','vpMinesGrid'],['snake','vpSnakeGrid']];
  for(const [game,id] of games){
    assert.match(shell,new RegExp('data-vp-game="'+game+'"'));
    assert.match(shell,new RegExp('id="'+id+'"'));
  }
  assert.match(shell,/id="vpGameDialog"/);
  assert.match(shell,/id="vpGameMount"/);
  assert.match(runner,/mount\.appendChild\(card\)/);
  assert.match(runner,/card\.appendChild\(button\)/);
  assert.match(style,/vp-mini:not\(\.vp-game-in-dialog\)/);
  assert.match(style,/\.vp-game-in-dialog/);
});
test('media modules load updated design last while preserving their original players and readers',()=>{
  for(const file of ['cinema.html','books.html','music-module.html']){
    const html=read('public/'+file);
    const black=html.indexOf('vetogram-black-universe.css');
    const last=html.indexOf('vetogram-showcase-v72.css');
    assert.ok(black>=0 && last>black,'missing final design in '+file);
  }
  assert.match(style,/body:has\(#cinemaPlayer\)/);
  assert.match(style,/body:has\(#playerBar\)/);
  assert.match(style,/body:has\(#reader\)/);
  assert.equal((style.match(/\{/g)||[]).length,(style.match(/\}/g)||[]).length);
  assert.match(style,/@media\s*\(max-width:720px\)/);
  assert.match(style,/@media\s*\(max-width:410px\)/);
  assert.match(style,/prefers-reduced-motion:reduce/);
  assert.doesNotMatch(style,/@import\b/);
});
