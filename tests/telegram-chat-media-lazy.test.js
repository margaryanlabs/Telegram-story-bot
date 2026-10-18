import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('photo previews are viewport-driven and rate-limited to two in-flight owner-authenticated Telegram requests',()=>{
 const ui=read('public/telegram-chats.js');
 assert.match(ui,/function photoInViewport\(el,scroller\)/);
 assert.match(ui,/item\.bottom>box\.top-200&&item\.top<box\.bottom\+200/);
 assert.match(ui,/state\.previewActive>=2/);
 assert.match(ui,/state\.previewInflight\.has\(id\)/);
 assert.match(ui,/state\.previewInflight\.add\(id\)/);
 assert.match(ui,/state\.previewInflight\.delete\(id\)/);
 assert.match(ui,/previewEpoch!==state\.previewEpoch/);
 assert.match(ui,/ownerKey!==String\(tg\?\.initData\|\|''\)/);
 assert.match(ui,/loadInlinePreviews\(\{requestedId:id\}\)/);
 assert.doesNotMatch(ui,/\.slice\(-3\)/);
});

test('expanded attachment snapshots are RAM only, survive markup refresh, and cannot leak across owner switches',()=>{
 const ui=read('public/telegram-chats.js'),html=read('public/studio.html');
 assert.match(ui,/expandedAttachments:new Map\(\),expandedBytes:0/);
 assert.match(ui,/function cacheExpandedAttachment\(button,id,blob,archive\)/);
 assert.match(ui,/function restoreExpandedAttachments\(\)/);
 assert.match(ui,/state\.expandedAttachments\.set\(key,\{href,mime,size:blob\.size,archive,node:wrapper\}\)/);
 assert.match(ui,/if\(entry\?\.node\?\.parentNode===slot\)entry\.node\.remove\(\)/);
 assert.match(ui,/restoreExpandedAttachments\(\)/);
 assert.match(ui,/state\.expandedAttachments\.clear\(\);state\.expandedBytes=0/);
 assert.match(ui,/function revokeMediaUrls\(\)/);
 assert.match(ui,/cacheExpandedAttachment\(button,id,blob,true\)/);
 assert.match(ui,/cacheExpandedAttachment\(button,id,blob,false\)/);
 assert.match(ui,/URL\.revokeObjectURL\(old\.href\)/);
 assert.match(ui,/state\.expandedAttachments\.size>6\|\|state\.expandedBytes>24\*1024\*1024/);
 assert.doesNotMatch(ui,/indexedDB|localStorage|sessionStorage/);
 assert.ok(html.includes('telegramThreadMessages'));
});

test('eviction pauses media, invalidates inline photo link, and permits an owner-initiated reload',()=>{
 const ui=read('public/telegram-chats.js'),css=read('public/app.css');
 assert.match(ui,/old\.node\.querySelectorAll\('audio,video'\)/);
 assert.match(ui,/oldSlot\.replaceWith\(expandedFileButton\(oldestKey,old\.archive\)\)/);
 assert.match(ui,/if\(current===old\.href\)state\.mediaPreviewUrls\.delete\(oldestKey\)/);
 assert.match(ui,/if\(\$\('telegramThreadPhotoFull'\)\?\.getAttribute\('src'\)===old\.href\)closePhotoViewer\(\)/);
 assert.match(css,/veto-mirror-expanded-slot/);
 assert.match(css,/veto-mirror-inline-placeholder:focus-visible/);
});

test('media UI never downloads deleted, uncaptured content by guessing, and keeps credentials server-side',()=>{
 const ui=read('public/telegram-chats.js');
 const api=read('api/telegram-chat-media.js');
 assert.match(ui,/msg\.deleted&&!msg\.mediaAvailable/);
 assert.match(ui,/msg\.saved&&msg\.mediaAvailable/);
 assert.match(ui,/fetch\('\/api\/privacy-media\?'/);
 assert.match(ui,/photoRequest\('photo',ownerChatId,id\)/);
 assert.match(api,/validateTelegramMiniApp/);
 assert.match(api,/verifyTelegramClientOwner\(client,userId\)/);
 assert.match(api,/const recent=await client\.getDialogs\(\{limit:60\}\)/);
 assert.match(api,/const dialogs=await client\.getDialogs\(\{limit:MAX_DIALOGS\}\)/);
 assert.doesNotMatch(ui,/TelegramClient\(/);
});
