import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');

test('phone code resume from Telegram service chat does not resend code',()=>{
 const html=read('public/studio.html'),app=read('public/app.js');
 assert.match(html,/id="viewerPendingLoginNotice"/);
 assert.match(app,/function renderViewerPendingLoginNotice\(/);
 assert.match(app,/viewerPendingLoginNotice'\)\?\.addEventListener\('click'/);
 assert.match(app,/await refreshViewerSync\(\{silent:true\}\)/);
 const resume=app.split("viewerPendingLoginNotice')?.addEventListener('click'")[1]?.split("connectTelegramButton')?.addEventListener('click'")[0]||'';
 assert.match(resume,/viewerCodeSheet\(pending\.delivery\|\|'unknown',true\)/);
 assert.doesNotMatch(resume,/viewerApi\('send_code'/);
 assert.match(app,/pending\.stage==='code'/);
});
test('composer is visible when user opens recording effects on mobile',()=>{
 const html=read('public/studio.html'),css=read('public/vetogram-noir.css');
 assert.match(html,/id="telegramThreadCompose"/);
 assert.match(html,/id="telegramThreadComposer"/);
 assert.match(css,/body\.veto-chat-thread #telegramMirror \.veto-mirror-thread-bottom/);
 assert.match(css,/body\.veto-chat-thread #vetoVoiceTools\[open\]/);
 assert.match(css,/position:absolute!important;bottom:calc\(65px/);
 assert.match(css,/max-height:39dvh/);
 assert.match(css,/body\.veto-chat-active:not\(\.veto-chat-thread\) #telegramMirror \.veto-mirror-heading\.vetogram-header/);
 assert.match(css,/max-height:59px!important/);
});
