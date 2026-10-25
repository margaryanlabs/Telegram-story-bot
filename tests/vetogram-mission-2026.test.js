import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {missionPresentation} from '../public/vetogram-mission-core.js';

const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/vetogram-mission-2026.css',import.meta.url),'utf8');
const runtime=readFileSync(new URL('../public/vetogram-mission-2026.js',import.meta.url),'utf8');

test('loading renders unknown status, not fake green readiness',()=>{
  const x=missionPresentation();
  assert.equal(x.account,'Проверяем');
  assert.equal(x.stories,'Проверяем');
  assert.equal(x.actionKind,'connect');
  assert.equal(x.accountState,'checking');
});
test('a real account connection never proves Anti-Delete or Story publishing',()=>{
  const x=missionPresentation({hasStatus:true,accountReady:true});
  assert.equal(x.account,'Подключение найдено');
  assert.equal(x.privacy,'Настроить отдельно');
  assert.equal(x.stories,'Проверить публикацию');
  assert.equal(x.actionKind,'chats');
});
test('Business Story permission and Privacy permission are distinct from delivered results',()=>{
  const x=missionPresentation({hasStatus:true,accountReady:true,
    privacyPermission:true,storiesBusiness:true});
  assert.equal(x.privacyState,'permission');
  assert.equal(x.stories,'Business-доступ найден');
  assert.doesNotMatch(x.stories,/опубликован|готова|работает/i);
});
test('a stale Business flag never grants Story access without an account',()=>{
  const x=missionPresentation({hasStatus:true,accountReady:false,
    storiesBusiness:true,privacyPermission:true});
  assert.equal(x.stories,'После входа');
  assert.equal(x.storiesState,'setup');
});
test('premium Mission Control is wired AFTER existing app status sources',()=>{
  assert.match(html,/id="vg27Mission"/);
  for(const id of ['vg27MissionTitle','vg27MissionDetail','vg27MissionAccount',
    'vg27MissionPrivacy','vg27MissionStories','vg27MissionAction'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.ok(html.indexOf('/vetogram-2026.css')<html.indexOf('/vetogram-mission-2026.css'));
  assert.ok(html.indexOf('/app.js')<html.indexOf('/vetogram-mission-2026.js'));
  assert.match(html,/data-open-screen="privacy"/);
  assert.match(html,/data-open-screen="publish"/);
  assert.match(css,/\.vg27-mission-statuses\{/);
  assert.match(css,/@media\(max-width:350px\)/);
  assert.match(css,/prefers-reduced-motion/);
});
test('navigation cannot silently request permissions, scan chats, or publish Stories',()=>{
  assert.doesNotMatch(runtime,/\b(fetch|localStorage|sessionStorage|indexedDB|sendMessage|postStory)\s*\(/);
  assert.match(runtime,/call\?\.addEventListener\('click'/);
  assert.match(runtime,/window\.VetoTelegramOpenAccountConnection/);
});
function mockRuntime(connected=false){
  const elements=new Map(),handlers=new Map();
  const node=id=>{
    if(!elements.has(id))elements.set(id,{
      id,textContent:id==='vetoAccountBadge'?'Account · '+(connected?'Secure':'Not connected'):
        id==='vetoStoriesBadge'?'Stories · Waiting':'Privacy · Optional',
      classList:{contains:c=>connected&&id==='vetoAccountBadge'&&c==='ready'},
      dataset:{},addEventListener:(name,fn)=>handlers.set(id+':'+name,fn)
    });
    return elements.get(id);
  };
  const observed=[];
  let nav=[],login=0;
  const document={
    getElementById:node,
    querySelector:()=>null
  };
  class Observer{
    constructor(fn){this.update=fn}
    observe(node){observed.push(node.id)}
  }
  const code=runtime.replace(/^import .*?;\n/m,'');
  vm.runInNewContext(code,{document,MutationObserver:Observer,missionPresentation,
    window:{VetoTelegramNavigate:id=>{nav.push(id)},VetoTelegramOpenAccountConnection:()=>{login++}}});
  return {node,handlers,observed,nav,login:()=>login};
}
test('Mission Control opens account login only from a click; connected goes to Chats',()=>{
  const f=mockRuntime(false);
  assert.equal(f.login(),0);
  assert.equal(f.node('vg27MissionAccount').textContent,'Требуется вход');
  f.handlers.get('vg27MissionAction:click')();
  assert.equal(f.login(),1);
  const connected=mockRuntime(true);
  assert.equal(connected.node('vg27MissionAction').textContent,'Открыть чаты →');
  connected.handlers.get('vg27MissionAction:click')();
  assert.deepEqual(connected.nav,['telegram']);
  assert.equal(connected.login(),0);
  assert.deepEqual(f.observed,['vetoAccountBadge','vetoPrivacyBadge','vetoStoriesBadge']);
});
