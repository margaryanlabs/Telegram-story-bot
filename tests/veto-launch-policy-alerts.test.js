import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = file => readFileSync(new URL('../' + file,import.meta.url),'utf8');

test('Public privacy policy explains optional account and business scopes and VETO contact',()=>{
 const doc=read('public/privacy-policy.html');
 assert.match(doc,/Политика конфиденциальности VETO/);
 assert.match(doc,/личного Telegram-аккаунта/);
 assert.match(doc,/Business/);
 assert.match(doc,/по умолчанию 30 дней/);
 assert.match(doc,/t\.me\/vetotg_bot/);
 assert.match(doc,/невидим|скрыты|инкогнито/);
 const ui=read('public/studio.html');
 assert.match(ui,/href="\/privacy-policy\.html"/);
});

test('Brand Pack is marked coming soon and publication controls remain guarded',()=>{
 const ui=read('public/studio.html');
 const script=read('public/brand-pack.js');
 assert.match(ui,/Brand Pack Engine — СКОРО/);
 assert.match(ui,/brandPackBuildButton" type="button" disabled/);
 assert.match(script,/const BRAND_PACK_COMING_SOON = true/);
 assert.match(script,/if \(BRAND_PACK_COMING_SOON\) return;/);
});

test('Bot provides user-facing alerts settings and privacy policy deep links without collecting credentials',()=>{
 const bot=read('api/webhook-v7.js'),setup=read('api/setup.js');
 assert.match(bot,/command === '\/alerts'/);
 assert.match(bot,/command === '\/privacy'/);
 assert.match(bot,/Уведомлениями|Управление уведомлениями/);
 assert.match(bot,/privacy-policy\.html/);
 assert.match(bot,/screen:'viewers'/);
 assert.match(bot,/screen:'privacy'/);
 assert.match(setup,/command: 'alerts'/);
 assert.match(setup,/command: 'privacy'/);
 assert.doesNotMatch(bot,/if \(command === '\/alerts'\)[\s\S]{0,150}verify_code/);
});
