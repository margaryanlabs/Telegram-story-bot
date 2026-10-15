import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Repair API requires Telegram Mini App signature and explicit recovery confirmation',()=>{
 const api=read('api/privacy-media-recover.js');
 assert.ok(api.includes('validateTelegramMiniApp('));
 assert.ok(api.includes('if(!user?.id)return json(res,401'));
 assert.ok(api.includes("action==='recover' && body.confirm!==true"));
 assert.ok(api.includes("listRecoverablePrivacyMedia(owner,action==='recover'?3:1)"));
 assert.ok(api.includes('(pending.rows||[]).slice(0,3)'));
 assert.ok(api.includes('Date.now()-startedAt>36000'));
 assert.ok(api.includes("if(String(media.telegram_user_id)!==owner"));
});

test('Only already captured owner Business media can be recovered; no messages altered',()=>{
 const store=read('supabase/functions/story-pilot-store/index.ts');
 const op=store.split('async function opListRecoverablePrivacyMedia(args:any) {')[1]
   ?.split('async function opCreateHistoryMediaUpload')[0] || '';
 assert.ok(op.includes('.eq("telegram_user_id",userId)'));
 assert.ok(op.includes('.not("media_file_id","is",null)'));
 assert.ok(op.includes('.in("media_archive_status",["pending","failed"])'));
 assert.ok(op.includes('.is("media_storage_path",null)'));
 assert.ok(op.includes('if (!settings.antiDelete)'));
 assert.ok(op.includes('.limit(limit)'));
 assert.ok(!op.includes('.delete('));
 assert.ok(!op.includes('.update('));
 assert.ok(store.includes('case "list_recoverable_privacy_media"'));
});

test('Old Telegram Business media recovery reuses existing trusted private Media Vault',()=>{
 const api=read('api/privacy-media-recover.js');
 assert.ok(api.includes("archiveBusinessMediaVault(BOT,media)"));
 assert.ok(!api.includes('media_file_id:media.media_file_id'));
 assert.ok(!api.includes('signedUrl:'));
 assert.ok(!api.includes('path:media.media_storage_path'));
 assert.ok(api.includes('recovered,unavailable'));
});

test('Owner receives accurate state and can repair max three files explicitly',()=>{
 const html=read('public/studio.html'),ui=read('public/privacy.js');
 assert.ok(html.includes('id="privacyVaultCheckButton"'));
 assert.ok(ui.includes("mediaRecoveryApi('status')"));
 assert.ok(ui.includes("mediaRecoveryApi('recover')"));
 assert.ok(ui.includes('data-privacy-repair-media="1"'));
 assert.ok(ui.includes('data-privacy-check-media="1"'));
 assert.ok(ui.includes('Не удалось загрузить'));
 assert.ok(ui.includes('Если Telegram уже удалил или отозвал исходный файл'));
 assert.ok(ui.includes('Попробовать восстановить до 3 файлов'));
});

test('History Backup clarifies actual media bytes are opt-in and 5MB limited',()=>{
 const html=read('public/studio.html'),ui=read('public/privacy.js');
 assert.ok(html.includes('до 5 МБ'));
 assert.ok(ui.includes('backupMedia'));
 assert.ok(ui.includes('небольшие документы до 5 МБ'));
 assert.ok(ui.includes('без самих файлов')===false || ui.includes('Без согласия'));
});
