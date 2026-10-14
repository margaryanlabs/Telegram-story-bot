import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const get = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('server exposes only expiry and stage for a pending Telegram login',()=>{
 const api = get('api/viewer-sync.js');
 assert.match(api,/getAuthChallenge\(userId\)\.catch\(\(\) => null\)/);
 assert.match(api,/loginPending,/);
 assert.match(api,/stage: loginChallenge.stage, expiresAt: new Date\(expiry\)\.toISOString\(\)/);
 assert.doesNotMatch(api,/loginPending: loginChallenge/);
});
test('Mini App restores code and 2FA login after Telegram WebView closes',()=>{
 const app=get('public/app.js');
 assert.match(app,/function pendingLoginMarkup/);
 assert.match(app,/loginPending: data.loginPending \|\| null/);
 assert.match(app,/data-sheet-action="viewer-resume-login"/);
 assert.match(app,/action === 'viewer-resume-login'/);
 assert.match(app,/viewerCodeSheet\('telegram_app'\)/);
 assert.match(app,/viewerPasswordSheet\(\)/);
 assert.match(app,/await refreshViewerSync\(\{ silent: true \}\);[\s\S]*?const connected/);
});
