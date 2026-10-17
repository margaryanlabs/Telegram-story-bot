import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { privacyReadiness } from '../lib/telegram-inbox-signals.js';

const file = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('full Business scope is explicit, limited to private chats, and has no messaging permissions', () => {
  const lib=file('lib/telegram-business-consent.js');
  const api=file('api/business-wizard.js');
  const ui=file('public/privacy.js');
  assert.match(lib,/connectBusinessAllPrivateChats/);
  assert.match(lib,/existingChats:true,newChats:true,contacts:true,nonContacts:true/);
  assert.match(lib,/excludeSelected:false,users:\[\],excludeUsers:\[\]/);
  assert.match(lib,/new Api\.BusinessBotRights\(\{\}\)/);
  assert.match(api,/body.scope === 'all-private'/);
  assert.match(api,/body.allChatsConsent !== true/);
  assert.match(api,/verifyTelegramClientOwner\(client,ownerId\)/);
  assert.match(ui,/name="vetoBusinessScope" value="all-private"/);
  assert.match(ui,/name="vetoBusinessScope" value="selected"/);
  assert.match(ui,/allChatsConsent:all/);
});

test('Private archive readiness does not depend on mark-as-read permission', () => {
  const enabled={antiDelete:true,ghostInbox:true};
  const business={isEnabled:true,businessConnectionId:'owner-connected',canReadMessages:false};
  const result=privacyReadiness(enabled,business,[]);
  assert.equal(result.ready,true);
  assert.equal(result.nextAction,'test_archive');
  assert.equal(result.readMessagesAllowed,false);
  assert.equal(privacyReadiness(enabled,null,[]).ready,false);
  assert.equal(privacyReadiness({antiDelete:false,ghostInbox:false},business,[]).ready,false);
});

test('all-chat history queue is explicitly authorized, resumable, limited and opt-in', () => {
  const api=file('api/privacy-backup.js');
  const backup=file('lib/telegram-history-backup.js');
  const ui=file('public/privacy.js');
  const html=file('public/studio.html');
  assert.match(api,/action === 'background_all_preview' \|\| action === 'background_enable_all'/);
  assert.match(api,/body.confirm !== true \|\| body.backgroundConsent !== true \|\| body.allChatsConsent !== true/);
  assert.match(api,/verifyTelegramClientOwner\(client,userId\)/);
  assert.match(api,/dialogs\.slice\(start,Math\.min\(start\+4,total\)\)/);
  assert.match(api,/nextOffset:offset,hasMore:offset<total/);
  assert.match(backup,/const MAX_DIALOGS = 500/);
  assert.match(ui,/background_all_preview/);
  assert.match(ui,/background_enable_all/);
  assert.match(ui,/allBackupConsent/);
  assert.match(html,/id="privacyBackupAllButton"/);
  assert.match(ui,/Секретные чаты, группы и каналы в этой очереди не сохраняются/);
});

test('native-like chat interface keeps saved copies visible and supports owner-only sends', () => {
  const html=file('public/studio.html'),css=file('public/app.css'),ui=file('public/telegram-chats.js');
  assert.match(html,/id="telegramMirrorAccessDrawer"/);
  assert.match(html,/id="telegramMirrorArchiveLink"/);
  assert.match(html,/veto-mirror-composer/);
  assert.match(css,/CHAT SURFACE v2/);
  assert.match(css,/border-radius:50%/);
  assert.match(css,/veto-mirror-bubble\.outgoing/);
  assert.match(ui,/function messageTime\(value\)/);
  assert.match(ui,/const compact=previous/);
  assert.match(ui,/message\.saved&&!message\.deleted/);
  assert.match(ui,/sendChatRequest\(/);
  assert.doesNotMatch(ui,/readBusinessMessage\(/);
});
