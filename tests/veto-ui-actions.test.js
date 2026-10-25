import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('All static named buttons on VETO Telegram have a controller or declared action',()=>{
 const html=read('public/studio.html');
 const controllers=['public/app.js','public/privacy.js','public/relay-module.js','public/studio-module.js','public/story-engine.js','public/brand-pack.js','public/telegram-chats.js','public/voice-studio.js','public/chat-theme.js','public/vetogram-header.js','public/vetogram-ai.js',
  'public/vetogram-command-2026.js','public/vetogram-mission-2026.js'].map(read).join('\n');
 const buttons=[...html.matchAll(/<button\b([\s\S]*?)>/g)].map(match=>match[1]);
 const missing=[];
 for(const attrs of buttons) {
   const id=attrs.match(/\bid="([^"]+)"/)?.[1];
   const hasDataAction=/(?:data-[a-z0-9-]+)=/.test(attrs);
   if(id && !controllers.includes(id) && !hasDataAction) missing.push(id);
   if(!id && !hasDataAction) missing.push('(unnamed button) '+attrs.slice(0,90));
 }
 assert.deepEqual(missing,[]);
});

test('Static screen navigation aliases resolve to existing section screens',()=>{
 const app=read('public/app.js');
 const html=read('public/studio.html');
 const aliasMatch=app.match(/const SCREEN_ALIASES = \{([\s\S]*?)\};/);
 assert.ok(aliasMatch,'SCREEN_ALIASES missing');
 const targets=[...aliasMatch[1].matchAll(/:\s*'([a-z-]+)'/g)].map(x=>x[1]);
 for(const target of targets) assert.ok(html.includes('data-screen="'+target+'"'),'Invalid screen '+target);
 assert.ok(!read('public/privacy.js').includes('data-nav="chats"'));
});

test('Every new archive control is backed by click handler, API and safe feedback',()=>{
 const html=read('public/studio.html'),ui=read('public/privacy.js');
 const api=read('api/privacy.js'),store=read('supabase/functions/story-pilot-store/index.ts');
 for(const id of ['privacyBackupGuideButton','privacyDeletedMore','privacyClearButton','privacyAccessAction'])
   assert.ok(ui.includes(id),'Missing handler '+id);
 for(const key of ['privacyBusinessGuideSheet','loadMoreDeletedFeed','loadOlderThread','clearArchive'])
   assert.ok(ui.includes(key),'Missing routine '+key);
 assert.ok(api.includes('confirmRetentionPurge'));
 assert.ok(store.includes('idsByChat'));
 assert.ok(html.includes('ghost-archive-promise'));
});

test('Every navigation path refreshes Privacy and Chats (tabs, cards, deep links)',()=>{
 const app=read('public/app.js');
 const privacy=read('public/privacy.js');
 assert.ok(app.includes("new CustomEvent('veto:screen-changed'"));
 assert.ok(privacy.includes("window.addEventListener('veto:screen-changed', onVetoScreenChanged)"));
 assert.ok(privacy.includes("screen !== 'privacy' && screen !== 'chats'"));
 assert.ok(privacy.includes('privacyScreenActive()) onVetoScreenChanged'));
 assert.ok(!privacy.includes("document.querySelector('[data-nav=\"privacy\"]')?.addEventListener('click'"));
});
