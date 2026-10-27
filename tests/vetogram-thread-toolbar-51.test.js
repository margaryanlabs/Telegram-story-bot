/* VETOGRAM: real messenger header navigation and keyboard interaction.
 * No browser, Telegram account, Node packages, or hosted build required.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const html=read('studio.html');
const css=read('vetogram-noir.css');
const source=read('telegram-chats.js');
const start=html.indexOf('<div class="veto-mirror-thread-bar">');
const end=html.indexOf('<div class="veto-mirror-thread-find"',start);
assert.ok(start>0&&end>start);
const toolbar=html.slice(start,end);

test('chat bar retains only essential controls, with one native overflow menu',()=>{
  assert.match(toolbar,/<details id="telegramThreadActions"/);
  assert.match(toolbar,/<summary aria-label="Дополнительные действия с чатом"/);
  assert.match(toolbar,/id="telegramThreadSearchToggle"/);
  assert.match(toolbar,/id="telegramThreadBack"/);
  assert.match(toolbar,/id="telegramThreadAvatar"/);
  assert.match(toolbar,/id="telegramThreadTitle"/);
  const menu=toolbar.slice(toolbar.indexOf('<details id="telegramThreadActions"'));
  for(const id of [
    'telegramThreadOpenNative','telegramThreadReplyAI','telegramThreadBriefAI',
    'telegramThreadRefresh',
  ]){
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
    assert.match(menu,new RegExp('id="'+id+'"'));
  }
  assert.equal((toolbar.match(/<details /g)||[]).length,1);
});

test('all secondary controls preserve real routing, semantics, and labels',()=>{
  const menu=toolbar.slice(toolbar.indexOf('class="veto-mirror-thread-actions-menu"'));
  assert.equal((menu.match(/data-thread-menu-action/g)||[]).length,5);
  assert.match(menu,/data-open-screen="ai" data-ai-mode="reply"/);
  assert.match(menu,/id="telegramThreadOpenNative"[^>]+target="_blank"[^>]+rel="noopener noreferrer" hidden/);
  assert.match(menu,/Обновить переписку/);
  assert.match(menu,/Предложить ответ/);
  assert.match(menu,/Разобрать сообщение/);
});

function wiring(){
  const a=source.indexOf("  const threadActions=$('telegramThreadActions');");
  const b=source.indexOf("  $('telegramThreadMessages')?.addEventListener('click',event=>{",a);
  assert.ok(a>0&&b>a);
  const snippet=source.slice(a,b);
  const nativeFocus={focused:false,focus(){this.focused=true}};
  const panel={
    open:true,listeners:{},removed:0,
    addEventListener(type,fn){this.listeners[type]=fn},
    removeAttribute(key){assert.equal(key,'open');this.open=false;this.removed++},
    contains(target){return target===this},
    querySelector:sel=>sel==='summary'?nativeFocus:null,
  };
  const docListeners={},composer={listeners:{},
    addEventListener(type,fn){this.listeners[type]=fn}};
  const ctx=vm.createContext({
    $:id=>id==='telegramThreadActions'?panel:id==='telegramThreadCompose'?composer:null,
    document:{addEventListener:(name,fn)=>{docListeners[name]=fn}},
  });
  new vm.Script(snippet).runInContext(ctx);
  return {panel,nativeFocus,docListeners,composer};
}

test('selecting a menu action closes it without losing the original action event',()=>{
  const f=wiring();
  f.panel.listeners.click({target:{closest:selector=>
    selector==='[data-thread-menu-action]'?{id:'action'}:null}});
  assert.equal(f.panel.open,false);
  assert.equal(f.panel.removed,1);
});

test('Escape closes menu and returns focus to its trigger',()=>{
  const f=wiring();
  let prevented=false,stopped=false;
  f.panel.listeners.keydown({
    key:'Escape',
    preventDefault:()=>{prevented=true},
    stopPropagation:()=>{stopped=true},
  });
  assert.equal(f.panel.open,false);
  assert.equal(f.nativeFocus.focused,true);
  assert.equal(prevented,true);
  assert.equal(stopped,true);
});

test('outside tap and composer focus dismiss overflow without hiding chat',()=>{
  const f=wiring();
  f.docListeners.pointerdown({target:{id:'outside'}});
  assert.equal(f.panel.open,false);
  f.panel.open=true;
  f.composer.listeners.focus();
  assert.equal(f.panel.open,false);
});

test('mobile menu remains a single toolbar row above scrolling messages',()=>{
  const tail=css.slice(css.indexOf('/* VETOGRAM V5.1 — one-line'));
  assert.match(tail,/flex-wrap:nowrap!important/);
  assert.match(tail,/z-index:20/);
  assert.match(tail,/\.veto-mirror-thread-actions-menu\{/);
  assert.match(tail,/min-height:46px!important/);
  assert.match(tail,/\[data-thread-menu-action\]\[hidden\]/);
  assert.match(source,/\$\('telegramThreadActions'\)\?\.removeAttribute\?\.\('open'\)/);
});
