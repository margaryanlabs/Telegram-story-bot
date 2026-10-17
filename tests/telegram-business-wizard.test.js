import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  selectBusinessDialogs,connectionSummary,assertBusinessConnectionAvailable,
  eligibleBusinessDialog,MAX_SELECTED_CHATS,CONSENT_APPROVAL,
} from '../lib/telegram-business-consent.js';

const src = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

const dialogs = [
  {id:101,isUser:true,entity:{id:101,firstName:'One'}},
  {id:202,isUser:true,entity:{id:202,firstName:'Two'}},
  {id:303,isUser:true,entity:{id:303,bot:true}},
  {id:404,isGroup:true,entity:{id:404}},
  {id:505,isUser:true,entity:{id:505,self:true}},
  {id:606,isUser:true,entity:{id:606,deleted:true}},
];

test('Business consent can select only distinct, owner-visible private human chats', () => {
  assert.equal(MAX_SELECTED_CHATS,12);
  assert.equal(eligibleBusinessDialog(dialogs[0]),true);
  assert.deepEqual(selectBusinessDialogs(dialogs,['101','202']).map(d=>Number(d.id)),[101,202]);
  for (const ids of [[],['303'],['404'],['505'],['606'],['999'],['101','101'],['-101'],['101','bad'],Array.from({length:13},(_,i)=>String(i+100))]) {
    assert.throws(()=>selectBusinessDialogs(dialogs,ids));
  }
});

test('Existing unrelated Business bot cannot be replaced automatically', () => {
  assert.equal(connectionSummary({connectedBots:[]},'999').state,'none');
  const other=connectionSummary({connectedBots:[{botId:123}],users:[{id:123,username:'AnotherBot'}]},'999');
  assert.equal(other.state,'other_bot');
  assert.equal(other.connectedBot.username,'AnotherBot');
  assert.throws(()=>assertBusinessConnectionAvailable(other),/другой Business-бот/);
  const own=connectionSummary({connectedBots:[{botId:999,recipients:{users:[{id:101}]}}]},'999');
  assert.equal(own.state,'storylab');
  assert.equal(own.recipients.selectedCount,1);
  assert.throws(()=>assertBusinessConnectionAvailable(own),/уже подключён/);
});

test('Wizard requires owner-verified session and explicit opt-in before MTProto write', () => {
  const api=src('api/business-wizard.js');
  const backend=src('lib/telegram-business-consent.js');
  const frontend=src('public/privacy.js');
  const html=src('public/studio.html');
  assert.equal(CONSENT_APPROVAL,'CONNECT_SELECTED_PRIVATE_CHATS');
  assert.match(api,/validateTelegramMiniApp/);
  assert.match(api,/sameTelegramAccount\(ownerId,session.telegram_account_user_id\)/);
  assert.match(api,/verifyTelegramClientOwner\(client,ownerId\)/);
  assert.match(api,/body.consent !== true \|\| body.approval !== CONSENT_APPROVAL/);
  assert.match(backend,/assertBusinessConnectionAvailable\(status\)/);
  assert.match(backend,/new Api\.account\.UpdateConnectedBot\(/);
  assert.match(backend,/new Api\.BusinessBotRights\(\{\}\)/);
  assert.match(backend,/existingChats:false,newChats:false,contacts:false,nonContacts:false/);
  assert.match(backend,/excludeSelected:false,users,excludeUsers:\[\]/);
  assert.match(frontend,/data-business-apply/);
  assert.match(frontend,/businessWizardConsent/);
  assert.match(frontend,/data-business-selected/);
  assert.match(frontend,/needsMessageProof/); // user must test actual event delivery (not simulated)
  assert.match(html,/id="privacyBusinessWizardButton"/);
  assert.match(html,/veto-native-business-wizard-v1/);
});

test('Business wizard does not silently request control over read, delete, profile, Stories or gifts', () => {
  const backend=src('lib/telegram-business-consent.js');
  const frontend=src('public/privacy.js');
  assert.doesNotMatch(backend,/rights:\s*new Api\.BusinessBotRights\(\{\s*readMessages:true/);
  assert.match(frontend,/Без права отвечать, удалять, отмечать прочитанным/);
  assert.match(frontend,/конкретных выбранных|выбранным личным перепискам|выбранных личных переписок/);
});
