import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const get = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('server exposes resume stage, expiry and privacy-safe delivery metadata to the Mini App',()=>{
 const api = get('api/viewer-sync.js');
 assert.ok(api.includes('getAuthChallenge(userId).catch(() => null)'));
 assert.ok(api.includes('loginPending,'));
 assert.ok(api.includes('stage: loginChallenge.stage, expiresAt: new Date(expiry).toISOString()'));
 assert.ok(!api.includes('loginPending: loginChallenge'));
});

test('Telegram Mini App can resume a code or 2FA challenge after reopening',()=>{
 const app = get('public/app.js');
 for (const snippet of [
   'function pendingLoginMarkup()',
   'loginPending: data.loginPending || null',
   'data-sheet-action="viewer-resume-login"',
   "action === 'viewer-resume-login'",
   "viewerCodeSheet(viewerState.loginPending?.delivery || 'other', true)",
   'viewerPasswordSheet()',
 ]) assert.ok(app.includes(snippet), 'Missing Mini App continuation: '+snippet);
});
