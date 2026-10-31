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

test('successful personal MTProto link invalidates any older archive-only inbox',()=>{
 const app=read('public/app.js'),chat=read('public/telegram-chats.js');
 assert.match(app,/wasConnected=viewerState\.session\?\.connected===true/);
 assert.match(app,/new CustomEvent\('vetogram:telegram-session-connected'\)/);
 assert.match(chat,/pendingLoginRefresh=true/);
 assert.match(chat,/vetogram:telegram-session-connected/);
 assert.match(chat,/void loadChats\(\{reset:true\}\)/);
});
test('disconnected live chat shows explicit login action, not a spinner or enabled send',()=>{
 const chat=read('public/telegram-chats.js'),html=read('public/studio.html');
 assert.match(chat,/const authRejected=\[401,403,409\]/);
 assert.match(chat,/Нужно переподключить Telegram/);
 assert.match(html,/id="telegramThreadConnectNotice"/);
 assert.match(html,/id="telegramThreadConnectButton"/);
 assert.match(chat,/field\.disabled=!writable/);
 assert.match(chat,/serverCanSend !== false && !chat\.archiveOnly/);
});
test('original split V mark and compact, non-expandable header survive',()=>{
 const html=read('public/studio.html'),header=read('public/vetogram-header.js');
 const css=read('public/vetogram-header.css');
 assert.match(html,/class="veto-inbox-signature"/);
 assert.match(html,/class="veto-ai-mark" src="\/veto-telegram-mark\.svg/);
 assert.doesNotMatch(html,/id="vetogramHeaderToggle"/);
 assert.doesNotMatch(header,/toggle\.addEventListener/);
 assert.match(css,/height:54px!important/);
 assert.match(css,/vetoMessengerToolsToggle/);
});
