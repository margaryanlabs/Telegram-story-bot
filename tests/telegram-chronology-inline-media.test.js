import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  orderChatRows,archivedDialog,decorateRemote,combineLiveAndPreserved,
} from '../api/telegram-chats.js';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('Delete never moves a chat to deletion time; it retains original sent-time row',()=>{
  const archive=[
    {chatId:'12',title:'Deleted message chat',lastAt:'2026-10-11T12:00:00Z',
      lastDeletedAt:'2026-10-15T14:00:00Z',
      preview:'message before delete',deletedCount:1,messageCount:4},
    {chatId:'13',title:'Cleared chat',lastAt:'2026-10-09T10:00:00Z',
      lastDeletedAt:'2026-10-15T21:00:00Z',
      preview:'last visible before clear',deletedCount:7,messageCount:10},
  ];
  const live=[
    {id:'11',title:'Recent',date:'2026-10-13T12:00:00Z',pinned:false},
    {id:'12',title:'Deleted message chat',date:'2026-10-10T12:00:00Z',
      preview:'Older Telegram message',pinned:false},
    {id:'14',title:'Pinned',date:'2026-09-01T12:00:00Z',pinned:true},
  ];
  const retained=decorateRemote(live,archive);
  const absent=archivedDialog(archive[1]);
  const sorted=orderChatRows([...retained,absent]);
  assert.deepEqual(sorted.map(x=>x.id),['14','11','12','13']);
  assert.equal(sorted[2].date,'2026-10-11T12:00:00Z');
  assert.equal(sorted[2].preview,'message before delete');
  assert.equal(sorted[3].date,'2026-10-09T10:00:00Z');
  assert.equal(sorted[3].archiveOnly,true);
  assert.equal(sorted[3].deletedCount,7);
  // Changing a deletion timestamp must not move the preserved conversation.
  archive[0].lastDeletedAt='2026-10-16T23:59:00Z';
  const next=orderChatRows([...decorateRemote(live,archive),archivedDialog(archive[1])]);
  assert.deepEqual(next.map(x=>x.id),['14','11','12','13']);
});
test('Deleted message appears BETWEEN original neighbors, not appended at bottom',()=>{
  const rows=combineLiveAndPreserved([
    {id:20,date:'2026-10-10T12:00:00Z',text:'before'},
    {id:22,date:'2026-10-10T12:02:00Z',text:'after'},
  ],[
    {id:21,date:'2026-10-10T12:01:00Z',text:'kept',deleted:true,saved:true},
  ]);
  assert.deepEqual(rows.map(m=>m.id),[20,21,22]);
  assert.equal(rows[1].deleted,true);
  assert.equal(rows[1].preservedOnly,true);
});
test('Avatar/photo download is owner-authenticated, size-capped and read-only',()=>{
  const api=read('api/telegram-chat-media.js');
  assert.ok(api.includes('validateTelegramMiniApp('));
  assert.ok(api.includes('getViewerSession(userId)'));
  assert.ok(api.includes("String(session.telegram_account_user_id||'')!==userId"));
  assert.ok(api.includes('dialogs.find(d=>safeId(d?.id)===chatId)'));
  assert.ok(api.includes('const AVATAR_LIMIT=180*1024'));
  assert.ok(api.includes('const PHOTO_LIMIT=4*1024*1024'));
  assert.ok(api.includes('downloadProfilePhoto'));
  assert.ok(api.includes('downloadMedia(message'));
  assert.ok(api.includes('getMessages(dialog.entity,{ids:[id]})'));
  assert.ok(api.includes("mime:'image/jpeg'"));
  assert.ok(api.includes("Content-Type',result.mime"));
  assert.ok(api.includes("Content-Disposition',action==='attachment'"));
  assert.ok(api.includes("Cache-Control','private,no-store"));
  assert.ok(!api.includes('upload('));
  assert.ok(!api.includes('saveMessage('));
});
test('Live mobile UI pins chats and loads bounded inline photo thumbnails',()=>{
  const ui=read('public/telegram-chats.js');
  const html=read('public/studio.html');
  const css=read('public/app.css');
  assert.ok(html.includes('data-mirror-filter="pinned"'));
  assert.ok(ui.includes("state.filter==='pinned'"));
  assert.ok(ui.includes('function orderedChats(chats)'));
  assert.ok(ui.includes("avatarRequested:new Set()"));
  assert.ok(ui.includes("photoRequest('avatar',id)"));
  assert.ok(ui.includes("photoRequest('photo',ownerChatId,id)"));
  assert.ok(ui.includes('function loadInlinePreviews({requestedId=null}={})'));
  assert.ok(ui.includes("scroller.querySelectorAll('[data-mirror-preview]')"));
  assert.ok(ui.includes('photoInViewport(el,scroller)'));
  assert.ok(ui.includes('state.previewActive>=2'));
  assert.ok(ui.includes('loadInlinePreviews({requestedId:id})'));
  assert.ok(ui.includes("URL.revokeObjectURL"));
  assert.ok(css.includes('.veto-mirror-inline-photo'));
  assert.ok(css.includes('.veto-mirror-avatar-img'));
});
test('Refreshing or loading older messages restores the same visual anchor',()=>{
  const ui=read('public/telegram-chats.js');
  assert.ok(ui.includes('function visibleMessageAnchor()'));
  assert.ok(ui.includes('data-mirror-message-id'));
  assert.ok(ui.includes('anchor:rememberedAnchor'));
  assert.ok(ui.includes('el.getBoundingClientRect().top-box.getBoundingClientRect().top-anchor.top'));
  assert.ok(ui.includes('state.archiveOffset'));
  assert.ok(ui.includes('УДАЛЕНО В TELEGRAM · СОХРАНЕНО В Vetogram'));
});
