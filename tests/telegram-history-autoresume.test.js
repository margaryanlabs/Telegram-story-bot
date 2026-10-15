import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('Historical backup runs bounded automatic pages only after chat consent',()=>{
  const ui=read('public/privacy.js'),html=read('public/studio.html');
  assert.ok(ui.includes("const backup = privacyState.backup"));
  assert.ok(ui.includes("while (!backup.stopRequested && pages < (backup.auto ? 20 : 1))"));
  assert.ok(ui.includes("confirm:true"));
  assert.ok(ui.includes("data-backup-pause=\"1\""));
  assert.ok(ui.includes("backup.stopRequested = true"));
  assert.ok(ui.includes("Math.max") || ui.includes("pages < 20"));
  assert.ok(ui.includes("b.auto = $('backupAuto')?.checked !== false"));
  assert.ok(ui.includes('privacyState.backup.notifyCompletion =') === false || ui.includes("b.notifyCompletion = $('backupNotify')?.checked !== false"));
  assert.ok(html.includes('privacyBackupHistoryButton'));
});

test('Only cursors and counts are persisted; never Telegram message content or sessions',()=>{
  const ui=read('public/privacy.js');
  const start=ui.indexOf("const BACKUP_RESUME_PREFIX =");
  const end=ui.indexOf("  function renderBackupList()",start);
  assert.ok(start>=0&&end>start);
  const scope=ui.slice(start,end);
  assert.ok(scope.includes('window.localStorage.setItem(backupResumeKey(b.selected.chatId)'));
  assert.ok(scope.includes('chatId:String(b.selected.chatId)'));
  assert.ok(scope.includes('offsetId:b.offsetId'));
  assert.ok(!scope.includes('JSON.stringify(b.selected)'));
  assert.ok(!scope.includes('message.text_content'));
  assert.ok(!scope.includes('session_ciphertext'));
  assert.ok(scope.includes('30 * 86400000'));
  assert.ok(ui.includes('savedBackupCursor(chat.chatId)'));
  assert.ok(ui.includes('data-backup-resume="1"'));
});

test('Mobile Telegram sheet close and hidden WebView stop the automatic loop',()=>{
  const ui=read('public/privacy.js');
  assert.ok(ui.includes('function closeSheet() {\n    // Telegram BackButton'));
  assert.ok(ui.includes("if (document.hidden) {"));
  assert.ok(ui.includes('privacyState.backup.stopRequested = true;'));
  assert.ok(ui.includes('data-backup-pause'));
  assert.ok(ui.includes('data-backup-next'));
  assert.ok(ui.includes('backup.offsetId = Number(data.nextOffsetId || 0)'));
});

test('Historical media metadata never promises a downloadable original',()=>{
  const ui=read('public/privacy.js'),store=read('supabase/functions/story-pilot-store/index.ts');
  assert.ok(ui.includes('const canOpenMedia = hasMedia && (Boolean(message.media_file_id) || mediaArchived)'));
  assert.ok(ui.includes('ghost-media-placeholder'));
  assert.ok(ui.includes('сам файл не сохранён'));
  assert.ok(store.includes('media_file_size, media_file_id'));
  assert.ok(store.includes('media_file_size,media_file_id,media_archive_status'));
});

test('Real privacy deletion/edit notifications and completion preference retained',()=>{
  const webhook=read('api/webhook-v7.js'),ui=read('public/privacy.js'),backup=read('api/privacy-backup.js');
  assert.ok(webhook.includes('sendGhostDeleteAlert('));
  assert.ok(webhook.includes('sendGhostEditAlert('));
  assert.ok(ui.includes('privacyTestNotificationButton'));
  assert.ok(ui.includes('data-backup-pause'));
  assert.ok(backup.includes('body.notifyCompletion !== false'));
  assert.ok(backup.includes('sendBackupNotice('));
});
