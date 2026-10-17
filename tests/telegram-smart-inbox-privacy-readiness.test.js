import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { privacyReadiness, inboxSignals } from '../lib/telegram-inbox-signals.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Privacy readiness requires opted-in owner protection and Business connection, not mark-as-read',()=>{
 const rows=[{messageCount:24,deletedCount:3},{messageCount:7,deletedCount:1}];
 const settings={antiDelete:true,ghostInbox:true,retentionDays:365};
 const business={isEnabled:true,businessConnectionId:'test',canReadMessages:true};
 const ready=privacyReadiness(settings,business,rows);
 assert.equal(ready.ready,true);
 assert.equal(ready.nextAction,'test_archive');
 assert.equal(ready.savedChats,2);
 assert.equal(ready.savedMessages,31);
 assert.equal(ready.confirmedDeleted,4);
 assert.equal(ready.retentionDays,365);
 assert.equal(privacyReadiness({...settings,antiDelete:false},business,rows).nextAction,'enable_privacy');
 assert.equal(privacyReadiness(settings,null,rows).nextAction,'connect_business');
 assert.equal(privacyReadiness(settings,{...business,canReadMessages:false},rows).nextAction,'test_archive');
 assert.equal(privacyReadiness(settings,{...business,canReadMessages:false},rows).markReadAllowed,false);
 assert.equal(privacyReadiness(null,business,rows).nextAction,'unavailable');
});
test('Smart Inbox focuses on unanswered-looking messages, never sends or marks read',()=>{
 const urgent=inboxSignals({preview:'Срочно, оплатить до вечера?',unreadCount:2});
 assert.equal(urgent.needsAttention,true);
 assert.equal(urgent.question,true);
 assert.equal(urgent.action,true);
 const neutral=inboxSignals({preview:'Срочно, оплатить до вечера?',unreadCount:0});
 assert.equal(neutral.needsAttention,false);
 assert.equal(inboxSignals({preview:'Привет!',unreadCount:1}).needsAttention,false);
 assert.equal(inboxSignals({preview:'Please confirm the invoice',unreadCount:1}).needsAttention,true);
 assert.equal(inboxSignals({preview:'Հարց ունեմ',unreadCount:1}).needsAttention,true);
});
test('Chat API reads Privacy metadata using Telegram owner-scoped keys only',()=>{
 const api=read('api/telegram-chats.js');
 assert.ok(api.includes('getPrivacySettings(userId)'));
 assert.ok(api.includes('getBusinessConnectionState(userId)'));
 assert.ok(api.includes('privacyReadiness(permissionState.settings,permissionState.business,history)'));
 assert.ok(api.includes('inbox:inboxSignals(chat)'));
 assert.ok(api.includes('verifyTelegramClientOwner(client,userId)'));
 assert.ok(api.includes('validateTelegramMiniApp('));
 assert.ok(api.includes('archiveThreads(userId)'));
 assert.ok(!api.includes('admin_chat_id'));
});
test('Mobile Smart Inbox and Privacy explanation are consented and not labeled as AI',()=>{
 const html=read('public/studio.html'),ui=read('public/telegram-chats.js');
 assert.ok(html.includes('data-mirror-filter="focus"'));
 assert.ok(html.includes('id="telegramMirrorPrivacyDiagnostics"'));
 assert.ok(html.includes('локальная сортировка'));
 assert.ok(ui.includes("if(state.filter==='focus' && !chat.inbox?.needsAttention)return false;"));
 assert.ok(ui.includes('function renderPrivacyDiagnostics()'));
 assert.ok(ui.includes('privacy.confirmedDeleted'));
 assert.ok(ui.includes('privacy.retentionDays'));
 assert.ok(ui.includes('data-mirror-privacy-setup'));
 assert.ok(ui.includes("window.VetoTelegramNavigate?.('privacy')"));
 assert.ok(!read('lib/telegram-inbox-signals.js').includes('fetch('));
});
