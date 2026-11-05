import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const studio=read('public/studio.html');
const shell=read('public/vetogram-reborn-foundation.css');
const experience=read('public/vetogram-experience-v4.js');
const app=read('public/app.js');
const mission=read('public/vetogram-mission-2026.js');

test('RB2 first-screen copy communicates the purpose and does not fake connection',()=>{
  const home=studio.split('<section class="screen active control-home" data-screen="home">')[1]
    ?.split('<section class="screen" data-screen="telegram"')[0];
  assert.ok(home,'the home section exists');
  assert.match(home,/Твои чаты\.<br><em>Твой контроль\.<\/em>/);
  assert.match(home,/id="vetoHomeChatsPrimary" data-open-screen="telegram"/);
  assert.match(home,/id="vetoHomeConnectPrimary"/);
  assert.match(home,/id="vg27MissionTitle">Проверяем подключение/);
  for(const id of ['vg27MissionAccount','vg27MissionPrivacy','vg27MissionStories'])
    assert.ok(home.includes('id="'+id+'"'),id);
  assert.match(home,/Anti-Delete работает только для новых доступных событий/);
  assert.match(home,/Ранее удалённые сообщения не восстановятся/);
  assert.doesNotMatch(home,/<span class="tiny-note">live<\/span>/);
});

test('RB2 keeps the original controller entry points and explicit consent boundaries',()=>{
  assert.match(app,/\$\('vetoHomeConnectPrimary'\)\?\.addEventListener\('click'/);
  assert.match(app,/window\.VetoTelegramOpenAccountConnection\?\.\(\)/);
  assert.match(app,/\[data-open-screen\]/);
  assert.match(mission,/missionPresentation\(/);
  assert.match(mission,/if\(typeof window\.VetoTelegramOpenAccountConnection==='function'\)/);
  assert.match(studio,/id="vg27MissionAction"/);
});

test('RB2 secondary panels are progressive disclosures, preserving their live nodes',()=>{
  assert.match(experience,/function progressive\(\{scope, selector/);
  assert.match(experience,/body\.append\(content\)/);
  assert.match(experience,/selector:'\.vg33-tools-panel'/);
  assert.match(experience,/selector:'#vg26Resume'/);
  assert.match(experience,/selector:'\.control-activity'/);
  for(const id of ['vg26Resume','vg26ResumeRecent','homeActivityList'])
    assert.match(studio,new RegExp('id="'+id+'"'));
  assert.match(shell,/\.v4-home-toolbox,\.v4-home-recent,\.v4-home-activity/);
});

test('RB2 main nav has four equal tracks on desktop and mobile without deleting Games or Profile',()=>{
  const nav=studio.match(/<nav class="bottom-nav"[^>]*>[\s\S]*?<\/nav>/)?.[0]||'';
  assert.deepEqual([...nav.matchAll(/data-nav="([^"]+)"/g)].map(m=>m[1]),
    ['telegram','publish','media','privacy']);
  assert.match(shell,/grid-template-columns: repeat\(4, minmax\(0, 1fr\)\) !important/);
  assert.match(shell,/\.v6-nav-brand,\.v6-nav-foot/);
  assert.match(studio,/data-screen="play"/);
  assert.match(studio,/data-screen="profile"/);
  assert.match(studio,/id="profileButton"/);
  assert.match(app,/data-sheet-action="open-profile"/);
  assert.match(app,/if \(action === 'open-profile'\) \{\s*closeSheet\(\);\s*switchScreen\('profile'\);/);
});

test('RB2 respects chosen chat backgrounds and optional light themes',()=>{
  assert.match(shell,/:not\(\[data-veto-theme="pearl"\]\):not\(\[data-veto-theme="linen"\]\)/);
  assert.match(shell,/body:not\(\.veto-chat-active\):not\(\.veto-chat-thread\)/);
  assert.match(shell,/prefers-reduced-motion: reduce/);
  assert.match(shell,/focus-visible/);
  assert.doesNotMatch(shell,/#[a-f0-9]{6}\s*!important;\s*\/\*override-chat-background\*\//i);
});
