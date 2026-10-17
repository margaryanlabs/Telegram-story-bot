import test from 'node:test';
import assert from 'node:assert/strict';
import {privacyReadiness} from '../lib/telegram-inbox-signals.js';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Business canReadMessages marks messages as read and is NOT necessary to receive opted-in archive events',()=>{
  const settings={antiDelete:true,ghostInbox:true,retentionDays:30};
  const connected={isEnabled:true,businessConnectionId:'business-test',canReadMessages:false};
  const data=privacyReadiness(settings,connected,[]);
  assert.equal(data.ready,true,'Configured Business archive must not demand mark-as-read permission');
  assert.equal(data.markReadAllowed,false);
  assert.equal(data.readMessagesAllowed,false);
  assert.equal(data.nextAction,'test_archive','Delivery still must be proven with an actual message');
  assert.equal(data.savedChats,0,'No fabricated archived message evidence');
  assert.equal(data.confirmedDeleted,0);
  const disconnected=privacyReadiness(settings,{isEnabled:false,businessConnectionId:'x'},[]);
  assert.equal(disconnected.ready,false);
  assert.equal(disconnected.nextAction,'connect_business');
  const disabled=privacyReadiness({antiDelete:false,ghostInbox:true},connected,[]);
  assert.equal(disabled.ready,false);
  assert.equal(disabled.nextAction,'enable_privacy');
});

test('UI does not mistake mark-as-read privilege for proof of Private Inbox event delivery',()=>{
  const ui=read('public/telegram-chats.js'),privacy=read('public/privacy.js');
  assert.ok(!ui.includes("checkpoint('Чтение сообщений'"));
  assert.ok(ui.includes('Право отмечать сообщения прочитанными не требуется.'));
  assert.ok(privacy.includes('Telegram can_read_messages is the ability to MARK a chat as read'));
  assert.ok(ui.includes('Настройки включены. Для подтверждения доставки'));
});
