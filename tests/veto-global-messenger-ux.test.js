import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('one app-wide palette instead of a fixed four-button chat stripe',()=>{
 const html=read('public/studio.html'),js=read('public/chat-theme.js'),css=read('public/veto-global-ui.css');
 assert.match(html,/id="vetoGlobalThemeToggle"/);
 assert.match(html,/id="vetoGlobalThemeMenu"/);
 assert.match(html,/id="telegramChatThemes"/);
 assert.equal((html.match(/id="telegramChatThemes"/g)||[]).length,1);
 assert.doesNotMatch(html,/<div class="veto-chat-appearance" role="group"/);
 assert.match(js,/document\.documentElement\.dataset\.vetoTheme=theme/);
 assert.match(js,/root\.dataset\.chatTheme=theme/);
 assert.match(js,/document\.body\.classList\.toggle\('veto-chat-active',inMessenger\)/);
 assert.match(js,/window\.VetoThemeDock=dock/);
 assert.match(css,/html\[data-veto-theme="pearl"\]/);
 assert.match(css,/html\[data-veto-theme="linen"\]/);
 assert.match(css,/body\.veto-chat-active \.topbar\{display:none\}/);
 assert.match(css,/body\.veto-chat-thread \.bottom-nav\{display:none!important\}/);
});

test('chat screen opens directly without showing permission manual by default',()=>{
 const ui=read('public/telegram-chats.js'),html=read('public/studio.html');
 assert.match(ui,/drawer\.open=false/);
 assert.match(html,/class="veto-messenger-exit" data-open-screen="home"/);
 assert.match(ui,/window\.VetoThemeDock\?\.\('thread'\)/);
 assert.match(ui,/window\.VetoThemeDock\?\.\('inbox'\)/);
 assert.match(ui,/veto-mirror-first-preview/);
 assert.match(ui,/if\(reset&&state\.messages\.length\)renderMessages\(\)/);
});

test('sticker previews fetch only signed owner recent static WEBP and revoke local URLs',()=>{
 const api=read('api/telegram-sticker-preview.js'),ui=read('public/telegram-chats.js');
 assert.match(api,/validateTelegramMiniApp/);
 assert.match(api,/sameTelegramAccount/);
 assert.match(api,/verifyTelegramClientOwner/);
 assert.match(api,/resolveOwnerSticker\(client,stickerId,body.setId,\{recentStickers\}\)/);
 assert.match(api,/image\/webp/);
 assert.match(api,/WEBP/);
 assert.match(api,/MAX_STICKER_BYTES=160\*1024/);
 assert.doesNotMatch(api,/signedUrl|publicUrl|localStorage/i);
 assert.match(ui,/fetchStickerPreviews\(chatId,ownerKey/);
 assert.match(ui,/slice\(0,8\)/);
 assert.match(ui,/state\.stickerPreviewUrls\.clear\(\)/);
 assert.match(ui,/fetch\('\/api\/telegram-sticker-preview'/);
});
