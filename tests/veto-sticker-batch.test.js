import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 requestedStickerIds,isStaticWebp,MAX_PREVIEWS,MAX_STICKER_BYTES,MAX_BATCH_RESPONSE_BYTES,
} from '../api/telegram-sticker-previews.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('sticker batch rejects empty, oversized and non-numeric requests and deduplicates IDs',()=>{
 assert.equal(MAX_PREVIEWS,8);
 assert.deepEqual(requestedStickerIds(['12','12','13']),['12','13']);
 assert.throws(()=>requestedStickerIds([]),/от 1 до 8/);
 assert.throws(()=>requestedStickerIds(Array(9).fill('1')),/от 1 до 8/);
 assert.throws(()=>requestedStickerIds(['hello']),/Неверный/);
 assert.throws(()=>requestedStickerIds(['-99']),/Неверный/);
 assert.throws(()=>requestedStickerIds(['1;DROP']),/Неверный/);
});

test('only bounded static webp document sizes get preview bytes',()=>{
 assert.equal(MAX_STICKER_BYTES,160*1024);
 assert.ok(MAX_BATCH_RESPONSE_BYTES<=800*1024);
 assert.equal(isStaticWebp({mimeType:'image/webp',size:1024}),true);
 assert.equal(isStaticWebp({mimeType:'application/x-tgsticker',size:1024}),false);
 assert.equal(isStaticWebp({mimeType:'image/webp',size:2*1024*1024}),false);
 assert.equal(isStaticWebp({mimeType:'image/webp',size:0}),false);
});

test('batch thumbnails verify owner and reuse one session + one installed lookup',()=>{
 const api=read('api/telegram-sticker-previews.js');
 const ui=read('public/telegram-chats.js');
 assert.match(api,/validateTelegramMiniApp/);
 assert.match(api,/sameTelegramAccount\(userId,session.telegram_account_user_id\)/);
 assert.match(api,/verifyTelegramClientOwner\(client,userId\)/);
 assert.match(api,/getInstalledStickerPack\(client,body.setId\)/);
 assert.match(api,/recentStickers\(client\)/);
 assert.match(api,/Cache-Control','private, no-store/);
 assert.match(api,/getViewerSession\(userId\)/);
 assert.match(api,/client\.downloadMedia/);
 assert.match(api,/toString\('ascii',0,4\)!=='RIFF'/);
 assert.match(api,/toString\('ascii',8,12\)!=='WEBP'/);
 assert.doesNotMatch(api,/localStorage|uploadMedia|publicUrl|signedUrl/);
 assert.match(ui,/fetch\('\/api\/telegram-sticker-previews'/);
 assert.match(ui,/stickerRequestValid\(chatId,ownerKey,epoch\)/);
 assert.match(ui,/URL\.createObjectURL\(new Blob/);
 assert.match(ui,/new Set\(selected\.map/);
});
