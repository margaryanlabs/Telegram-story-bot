import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=p=>readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
const html=read('studio.html');
const css=read('vetogram-finish-2026.css');
const chat=read('telegram-chats.js');
const pulseCore=read('vetogram-inbox-pulse-core.js');

test('Smart Inbox counts and links describe the same signed loaded chats',()=>{
  assert.match(html,/id="vgxPulseUnread"[^>]*>0<\/strong><small>Непрочитанные чаты/);
  assert.match(html,/id="vgxPulseSaved"[^>]*>0<\/strong><small>Сохранённые/);
  assert.match(html,/data-vgx-pulse-filter="copies"/);
  assert.match(html,/data-mirror-filter="copies"/);
  assert.match(chat,/vgxPulseSaved:summary\.savedChats/);
  assert.doesNotMatch(chat,/vgxPulseDeleted:summary\.deletedMessages/);
  assert.match(html,/Из загруженных чатов · по запросу/);
});
test('filter and pulse selection always follow actual current view',()=>{
  assert.match(chat,/button\.dataset\.mirrorFilter===state\.filter/);
  assert.match(chat,/button\.setAttribute\('aria-pressed',String\(active\)\)/);
  assert.match(chat,/button\.dataset\.vgxPulseFilter===state\.filter/);
  assert.match(chat,/if\(!button\|\|resetOwner\(\)\)return/);
  const core={window:{}};runInNewContext(pulseCore,core);
  const summary=core.window.VetogramInboxPulse.summarize([
    {id:'a',savedCopy:true,deletedCount:6,unreadCount:3,inbox:{needsAttention:true}},
    {id:'b',savedCopy:true,deletedCount:0,unreadCount:0},
    {id:'a',savedCopy:true,deletedCount:6},
  ]);
  assert.equal(summary.savedChats,2);
  assert.equal(summary.deletedMessages,6);
  assert.equal(summary.unreadChats,1);
  assert.equal(summary.attentionChats,1);
});
test('focus is an explainable signal, not an invented deadline or read receipt',()=>{
  assert.match(chat,/Возможное действие/);
  assert.match(chat,/Может требовать ответа/);
  assert.doesNotMatch(chat,/Есть срок или действие/);
  assert.match(chat,/aria-label/);
  assert.match(chat,/unread\+' непрочитанных'/);
  assert.match(chat,/chat\.savedCopy\?' has-copy'/);
  assert.match(chat,/chat\.inbox\?\.needsAttention\?' has-attention'/);
  assert.match(chat,/чатов загружено · по запросу/);
  assert.doesNotMatch(chat,/загружено · LIVE/);
});
test('real message delivery states remain owner-scoped and truthful',()=>{
  const start=chat.indexOf('  function renderDeliveryStatus(){');
  const end=chat.indexOf('  function setDeliveryStatus(',start);
  assert.ok(start>0&&end>start);
  const snippet=chat.slice(start,end);
  const info={stage:'accepted',chatId:'123',kind:'voice'};
  const bar={hidden:true,dataset:{},removeAttribute(k){delete this.dataset.state}};
  const label={textContent:''},icon={textContent:''};
  const state={deliveryStage:info,thread:{id:'123'},ownerInitData:'signed'};
  const tg={initData:'signed'};
  const byId={telegramThreadDeliveryStatus:bar,telegramThreadDeliveryText:label,telegramThreadDeliveryIcon:icon};
  // The function is run against the real source in a sandbox to check actual text.
  const execute=()=>runInNewContext(snippet+';renderDeliveryStatus()',{
    state,tg,$:id=>byId[id]
  });
  execute();
  assert.equal(bar.hidden,false);
  assert.equal(bar.dataset.state,'accepted');
  assert.match(label.textContent,/это не означает, что сообщение прочитано/);
  info.stage='uncertain';execute();
  assert.match(label.textContent,/Нет подтверждения/);
  info.stage='failed';execute();
  assert.match(label.textContent,/Отправка не выполнена/);
  info.stage='sending';execute();
  assert.match(label.textContent,/Отправляю в Telegram/);
  tg.initData='other';execute();
  assert.equal(bar.hidden,true);
  assert.equal(bar.dataset.state,undefined);
  assert.doesNotMatch(snippet,/markAsRead|readReceipt|sendOutgoing\(/);
});
test('Smart Inbox has compact mobile rail, visible selected states and reduced motion',()=>{
  const section=css.slice(css.indexOf('VETOGRAM 4.0 · Smart Inbox'));
  assert.ok(section.length>5500);
  assert.match(section,/@media\(max-width:420px\)/);
  assert.match(section,/grid-auto-flow:column/);
  assert.match(section,/scroll-snap-type:x proximity/);
  assert.match(section,/\.veto-mirror-chat\.has-attention::before/);
  assert.match(section,/\.veto-mirror-chat\.has-copy/);
  assert.match(section,/\.veto-mirror-delivery-status\[data-state="uncertain"\]/);
  assert.match(section,/@media\(prefers-reduced-motion:reduce\)/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
  assert.doesNotMatch(section,/fetch\(|setInterval\(|localStorage/);
});
test('source keeps localized priority card labels without touching their routes',()=>{
  for(const [filter,text] of [
    ['action','Действия'],['watch','Изменения'],['all','Все']
  ]){
    assert.ok(html.includes('data-smart-filter="'+filter+'"><span>'+text+'</span>'));
  }
  assert.match(html,/<h1>Чаты<\/h1>/);
  assert.match(html,/<span class="kicker">ПРИОРИТЕТЫ<\/span>/);
  assert.match(html,/id="telegramMirrorUpdated">Обновление по запросу/);
});
