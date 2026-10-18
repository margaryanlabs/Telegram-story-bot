import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 publicInstalledSets,publicStickerDocuments,getInstalledStickerPack,resolveOwnerSticker,
 MAX_STICKER_SETS,MAX_STICKERS_PER_PACK,
} from '../lib/telegram-sticker-catalog.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

const validSet={id:101n,accessHash:32n,title:'Пакет стикеров',shortName:'great_pack',count:44};
const otherSet={id:222n,accessHash:44n,title:'Другой набор',shortName:'other',count:7};
const sticker={id:1234n,accessHash:543n,fileReference:Buffer.from([1]),
  mimeType:'image/webp',
  attributes:[{className:'DocumentAttributeSticker',alt:'🦊'}]};
const second={...sticker,id:5678n};
function fakeClient(){
 let calls=0;
 return {invoke:async ()=>{
   calls++;
   return calls%2?{sets:[validSet,otherSet]}:{documents:[sticker,second]};
 }};
}

test('installed pack metadata is bounded, sanitized and omits MTProto hashes',()=>{
 const output=publicInstalledSets([validSet,otherSet]);
 assert.equal(output[0].id,'101');
 assert.equal(output[0].title,'Пакет стикеров');
 assert.equal(output[1].shortName,'other');
 assert.ok(!('accessHash' in output[0]));
 assert.equal(MAX_STICKER_SETS,64);
 assert.equal(MAX_STICKERS_PER_PACK,96);
 assert.equal(publicInstalledSets(Array(80).fill(validSet)).length,64);
});

test('only sticker documents with owner-verified metadata are returned',()=>{
 const output=publicStickerDocuments([sticker,{id:2000n,fileReference:Buffer.from([1]),accessHash:90n},second]);
 assert.deepEqual(output,[{id:'1234',emoji:'🦊'},{id:'5678',emoji:'🦊'}]);
 assert.ok(!('accessHash' in output[0]));
 assert.ok(!('fileReference' in output[0]));
});

test('installed pack only resolves after current-owner set membership verification',async()=>{
 const pack=await getInstalledStickerPack(fakeClient(),'101');
 assert.equal(pack.set.id,'101');
 assert.equal(pack.documents.length,2);
 assert.equal((await resolveOwnerSticker(fakeClient(),'1234','101')).id,1234n);
 await assert.rejects(getInstalledStickerPack(fakeClient(),'999'),/не установлен/);
 await assert.rejects(getInstalledStickerPack(fakeClient(),'wrong'),/Некорректный/);
 await assert.rejects(resolveOwnerSticker(fakeClient(),'9999','101'),/не принадлежит/);
});

test('recent stickers still work without installed set; forged sticker IDs are rejected',async()=>{
 const recent=async()=>[sticker];
 assert.equal((await resolveOwnerSticker({},'1234',null,{recentStickers:recent})).id,1234n);
 await assert.rejects(resolveOwnerSticker({},'9999',null,{recentStickers:recent}),/не находится/);
 await assert.rejects(resolveOwnerSticker({},'garbage',null,{recentStickers:recent}),/Неверный/);
});

test('catalog, preview and send only use signed Telegram owner with no access hash leak',()=>{
 const api=read('api/telegram-send.js'),preview=read('api/telegram-sticker-preview.js');
 const rich=read('lib/telegram-chat-rich.js'),ui=read('public/telegram-chats.js');
 const html=read('public/studio.html'),styles=read('public/veto-global-ui.css');
 assert.match(api,/validateTelegramMiniApp/);
 assert.match(api,/verifyTelegramClientOwner\(client,userId\)/);
 assert.match(api,/sameTelegramAccount/);
 assert.match(api,/action==='sticker_sets'/);
 assert.match(api,/action==='sticker_set'/);
 assert.match(api,/getInstalledStickerPack\(client,body.setId\)/);
 assert.match(preview,/resolveOwnerSticker\(client,stickerId,body.setId/);
 assert.match(preview,/verifyTelegramClientOwner\(client,userId\)/);
 assert.match(rich,/resolveOwnerSticker\(client,selected,inputs.setId/);
 assert.match(ui,/async function openStickerPack\(setId\)/);
 assert.match(ui,/state\.stickerEpoch\+\+/);
 assert.match(ui,/stickerRequestValid\(chatId,ownerKey,epoch\)/);
 assert.match(ui,/stickerSetId:a/);
 assert.match(html,/id="vetoStickersSearch"/);
 assert.match(html,/data-sticker-tab="packs"/);
 assert.match(styles,/veto-sticker-pack-card/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|indexedDB/);
});
