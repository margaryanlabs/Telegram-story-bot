import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {vetogramAppUrl} from '../lib/vetogram-app-url.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Story audience mismatch never silently acknowledges failed deletion',()=>{
  const s=read('lib/story-app-publisher.js');
  assert.match(s,/async function revokeMismatchedStory/);
  assert.match(s,/STORY_PRIVACY_DELETE_UNCONFIRMED/);
  assert.doesNotMatch(s,/deleteStories\([^;]+\.catch\(\(\) => \{\}\)/s);
  assert.match(read('api/miniapp.js'),/STORY_PRIVACY_DELETE_UNCONFIRMED\|STORY_PUBLISH_RESULT_UNCERTAIN/);
});
test('Archive clear revokes capture and pauses backup jobs for both storage adapters',()=>{
  const neon=read('lib/neon-media-store.js');
  const supa=read('supabase/functions/story-pilot-store/index.ts');
  for(const s of [neon,supa]){
    assert.match(s,/anti_delete=false|anti_delete:false/);
    assert.match(s,/edit_history=false|edit_history:false/);
    assert.match(s,/ghost_inbox=false|ghost_inbox:false/);
    assert.match(s,/state='paused'|state:"paused"/);
    assert.match(s,/story_pilot_message_versions/);
  }
});
test('Worker rechecks live consent and exact backup job after Telegram fetch',()=>{
  const s=read('api/privacy-backup-worker.js');
  assert.match(s,/const latest=await getPrivacySettings\(userId\)/);
  assert.match(s,/const jobState=await getBackupJob\(userId,chatId\)/);
  assert.match(s,/if\(!latest\.ghostInbox \|\| !active\)return \{paused:true\}/);
  assert.match(read('lib/neon-worker-store.js'),/case 'get_backup_job'/);
  assert.match(read('supabase/functions/story-pilot-store/index.ts'),/case "get_backup_job"/);
});
test('Archive deletion UI warns that protection is turned off',()=>{
  assert.match(read('public/privacy.js'),/Anti-Delete, сохранение сообщений и все фоновые копии будут остановлены/);
});
test('Backup notifications never contain a hardcoded old Vercel address',()=>{
  for(const path of ['api/privacy-backup.js','api/privacy-backup-worker.js'])
    assert.doesNotMatch(read(path),/telegram-story-bot-murex\.vercel\.app/);
});
test('Deep links use only configured HTTPS production origins',()=>{
  const before=process.env.VETOGRAM_APP_URL,old=process.env.STORY_PILOT_BASE_URL;
  try{
    delete process.env.VETOGRAM_APP_URL;delete process.env.STORY_PILOT_BASE_URL;
    assert.equal(vetogramAppUrl(),null);
    process.env.VETOGRAM_APP_URL='http://localhost:3000';
    assert.equal(vetogramAppUrl(),null);
    process.env.VETOGRAM_APP_URL='https://vetogram.example';
    assert.equal(vetogramAppUrl({screen:'chats',chatId:'123'}),'https://vetogram.example/studio.html?screen=chats&chat=123');
  }finally{
    if(before===undefined)delete process.env.VETOGRAM_APP_URL;else process.env.VETOGRAM_APP_URL=before;
    if(old===undefined)delete process.env.STORY_PILOT_BASE_URL;else process.env.STORY_PILOT_BASE_URL=old;
  }
});

test('Automatic post-login Business offer reports disabled server readiness and never pretends existing unprotected connection is ready',()=>{
 const app=read('public/privacy.js');
 assert.match(app,/if \(result\.enabled === false\)/);
 assert.match(app,/Сообщения НЕ архивируются автоматически/);
 assert.match(app,/result\.state === 'storylab' && result\.diagnostics\?\.antiDelete === true/);
});

test('First onboarding always starts with explicit selection of individual chats, not all private chats',()=>{
  const ui=read('public/privacy.js');
  assert.match(ui,/value==='selected-private'\?'checked':''/);
  assert.doesNotMatch(ui,/value==='all-private'\?'checked':''/);
  assert.match(ui,/id="businessWizardChatSearch"/);
  assert.match(ui,/data-business-chat-item/);
  assert.match(ui,/data-business-chat-name/);
  assert.match(ui,/Всё делается прямо в Vetogram/);
});
test('Post-login ready-but-unverified protection stays visible and actionable',()=>{
  const ui=read('public/privacy.js');
  assert.match(ui,/messageEventsProven !== true/);
  assert.match(ui,/data-business-diagnostics="1"/);
  assert.match(ui,/Не нужно выходить из Vetogram/);
});
test('Backend supports explicit in-app MTProto permission handoff and revocation truth',()=>{
  const api=read('api/business-wizard.js');
  assert.match(api,/canConnectInsideVetogram:true,requiresManualTelegramSettings:false/);
  assert.match(api,/if \(action === 'disconnect' && result\?\.disconnected === true\)/);
  assert.match(api,/updatePrivacySettings\(ownerId,\{antiDelete:false\}\)/);
  assert.match(api,/archiveOptInRevoked/);
  assert.match(read('lib/telegram-business-consent.js'),/new Api\.account\.UpdateConnectedBot\(/);
});

test('Neon archive readiness accepts the direct SQL provider and valid schema',()=>{
  const source=read('api/privacy.js');
  assert.match(source,/storeHealth\?\.backend === 'neon' && Number\(storeHealth\?\.schemaVersion\) >= 6/);
  assert.match(source,/storeHealth\?\.directGhostWrites === true/);
  assert.match(source,/storeHealth\?\.postgrestFallback === true/);
  assert.match(source,/Neon archive connected/);
});
