import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Privacy archive starts on All instead of hiding saved archived chats behind Smart',()=>{
 const p=read('public/privacy.js'), html=read('public/studio.html');
 assert.ok(p.includes("filter: allowedInitialFilters.has(ghostDeepLink.filter) ? ghostDeepLink.filter : 'all'"));
 assert.ok(html.includes('class="active" type="button" data-privacy-filter="all"'));
});

test('Disconnected Privacy access opens true Telegram Business setup, not Stories check screen',()=>{
 const p=read('public/privacy.js');
 assert.ok(p.includes('function privacyBusinessGuideSheet()'));
 assert.ok(p.includes("privacyBusinessGuideSheet();"));
 assert.ok(!p.includes("document.querySelector('[data-nav=\"publish\"]')?.click()"));
});

test('Real archive pagination distinguishes pages and retains deleted feed continuity',()=>{
 const edge=read('supabase/functions/story-pilot-store/index.ts');
 const api=read('api/privacy.js');
 const ui=read('public/privacy.js');
 assert.ok(edge.includes('const hasMore = messages.length > limit'));
 assert.ok(edge.includes('const hasMore = rows.length > limit'));
 assert.ok(edge.includes('offset, hasMore, messages:'));
 assert.ok(api.includes("listPrivacyMessages(userId, chatId, body.limit || 80, body.offset || 0)"));
 assert.ok(ui.includes("action === 'viewer-start-qr'") === false); // Privacy event handlers stay scoped
 assert.ok(ui.includes('data-privacy-thread-more="1"'));
 assert.ok(ui.includes('loadOlderThread()'));
 assert.ok(ui.includes("await request('list_deleted', { limit: 160, offset: privacyState.deletedFeed.length })"));
});

test('Cleanup respects chat+message compound identity (IDs can overlap across chats)',()=>{
 const edge=read('supabase/functions/story-pilot-store/index.ts');
 assert.ok(edge.includes('.select("chat_id,message_id,media_storage_path")'));
 assert.ok(edge.includes('const idsByChat = new Map<string, number[]>()'));
 assert.ok(edge.includes('.eq("chat_id", chatId)'));
});

test('Explicit confirmation protects retained VETO copies and reducing retention',()=>{
 const api=read('api/privacy.js');
 const ui=read('public/privacy.js');
 assert.ok(api.includes("body.confirm !== 'DELETE_MY_VETO_ARCHIVE'"));
 assert.ok(api.includes('body.confirmRetentionPurge !== true'));
 assert.ok(ui.includes('id="privacyConfirmDelete"'));
 assert.ok(ui.includes("confirm:'DELETE_MY_VETO_ARCHIVE'"));
 assert.ok(ui.includes('confirmRetentionPurge:true'));
});

test('10-year archival remains opt-in and never claims recovery of previously deleted chats',()=>{
 const html=read('public/studio.html');
 assert.ok(html.includes('data-retention="3650"'));
 assert.ok(html.includes('до удаления'));
 assert.ok(html.includes('задним числом восстановить нельзя'));
});
