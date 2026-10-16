import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sameTelegramAccount,requireOwnTelegramAccount,TELEGRAM_OWNER_MESSAGE}
  from '../lib/telegram-session-owner.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Each VETO owner may link only their own Telegram account',()=>{
  assert.equal(sameTelegramAccount('100','100'),true);
  assert.equal(sameTelegramAccount(100,{toString:()=> '100'}),true);
  assert.equal(sameTelegramAccount('100','101'),false);
  assert.equal(sameTelegramAccount('100',null),false);
  assert.equal(sameTelegramAccount('',0),false);
  assert.equal(sameTelegramAccount('100','0100'),false);
  assert.equal(requireOwnTelegramAccount('100',{id:100}),true);
  assert.throws(()=>requireOwnTelegramAccount('100',{id:'200'}),
    error=>error.code==='TELEGRAM_ACCOUNT_MISMATCH');
  assert.match(TELEGRAM_OWNER_MESSAGE,/Чужой аккаунт подключить нельзя/);
});
test('Phone code, 2FA and QR sign-in all reject cross-account sessions BEFORE DB write',()=>{
  const sync=read('api/viewer-sync.js');
  const qr=read('api/viewer-qr.js');
  const mini=read('api/miniapp.js');
  const safety="requireOwnTelegramAccount(userId, result.user)";
  assert.equal(sync.split(safety).length-1,2);
  assert.equal(qr.split(safety).length-1,1);
  const codeSection=sync.split("if (action === 'verify_code')")[1].split("if (action === 'verify_password')")[0];
  const passwordSection=sync.split("if (action === 'verify_password')")[1].split("if (action === 'disconnect')")[0];
  for (const section of [codeSection,passwordSection]) {
    assert.ok(section.indexOf(safety)>0);
    assert.ok(section.indexOf(safety)<section.indexOf('await upsertViewerSession({'));
  }
  assert.ok(qr.indexOf(safety)<qr.indexOf('await upsertViewerSession({'));
  assert.ok(sync.includes('revokeUserSession(result.session)'));
  assert.ok(qr.includes('revokeUserSession(result.session)'));
  assert.ok(sync.includes("identityMismatch: row.status === 'active'"));
  assert.ok(sync.includes("sameTelegramAccount(userId, row.telegram_account_user_id)"));
  assert.ok(mini.includes("String(userSessionRow.telegram_account_user_id || '') === String(chatId)"));
  assert.ok(qr.includes("error:TELEGRAM_OWNER_MESSAGE"));
});
test('Second user can open own connection from My Chats and sees Privacy as separate option',()=>{
  const html=read('public/studio.html');
  const client=read('public/telegram-chats.js');
  const app=read('public/app.js');
  assert.ok(html.includes('id="telegramMirrorAccessButton"'));
  assert.ok(html.includes('Живые чаты'));
  assert.ok(html.includes('Privacy · по желанию'));
  assert.ok(client.includes("window.VetoTelegramOpenAccountConnection()"));
  assert.ok(app.includes('window.VetoTelegramOpenAccountConnection = async () =>'));
  assert.ok(app.includes("viewerState.session?.identityMismatch === true"));
  assert.ok(app.includes('data-sheet-action="viewer-disconnect"'));
  assert.ok(app.includes("connectionHelpSheet();\n      return;"));
  assert.ok(app.includes("viewerState.session?.connected === true && viewerState.session?.identityMismatch !== true"));
  assert.ok(!client.includes('localStorage'));
});
test('Live Chats and Privacy isolation remains intact for any second user',()=>{
  const live=read('api/telegram-chats.js'),media=read('api/telegram-chat-media.js');
  const privacy=read('api/privacy-backup.js');
  assert.ok(live.includes('validateTelegramMiniApp('));
  assert.ok(live.includes('sameTelegramAccount(userId, linked.telegram_account_user_id)'));
  assert.ok(live.includes('verifyTelegramClientOwner(client,userId)'));
  assert.ok(media.includes("String(session.telegram_account_user_id||'')!==userId"));
  assert.ok(privacy.includes("String(session.telegram_account_user_id || '') !== userId"));
  assert.ok(!live.includes('admin_chat_id'));
});
