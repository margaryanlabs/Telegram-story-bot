import {Api} from 'teleproto';

// Installed pack metadata and document IDs never expose Telegram access hashes to clients.
// Each read/write revalidates membership against the current owner's Telegram account.
const docId=value=>String(value?.toString?.()||value||'');
const fail=(text,status=400)=>Object.assign(new Error(text),{status});
export const MAX_STICKER_SETS=64;
export const MAX_STICKERS_PER_PACK=96;

export function publicInstalledSets(sets=[]){
  return (Array.isArray(sets)?sets:[]).filter(set=>set?.id && set?.accessHash)
    .slice(0,MAX_STICKER_SETS).map(set=>({
      id:docId(set.id),title:String(set.title||'Стикеры').slice(0,72),
      shortName:String(set.shortName||'').slice(0,64),
      count:Math.max(0,Math.min(1000,Number(set.count||0))),
    }));
}
export async function getInstalledStickerSets(client){
  const result=await client.invoke(new Api.messages.GetAllStickers({hash:0n}));
  return Array.isArray(result?.sets)?result.sets.filter(set=>
    set?.id&&set?.accessHash&&!set?.archived).slice(0,MAX_STICKER_SETS):[];
}
export function publicStickerDocuments(documents=[]){
  return (Array.isArray(documents)?documents:[]).filter(doc=>
    doc?.id&&doc?.accessHash&&doc?.fileReference&&
    doc?.attributes?.some(attr=>/DocumentAttributeSticker/i.test(attr?.className||'')))
    .slice(0,MAX_STICKERS_PER_PACK).map(doc=>{
      const sticker=doc.attributes.find(attr=>/DocumentAttributeSticker/i.test(attr?.className||''))||{};
      return {id:docId(doc.id),emoji:String(sticker.alt||'🎭').slice(0,12)};
    });
}
export async function getInstalledStickerPack(client,setId){
  const selected=docId(setId);
  if(!/^\d{1,22}$/.test(selected))throw fail('Некорректный набор стикеров');
  const sets=await getInstalledStickerSets(client);
  const found=sets.find(set=>docId(set.id)===selected);
  if(!found)throw fail('Набор больше не установлен в твоём Telegram',404);
  const result=await client.invoke(new Api.messages.GetStickerSet({
    stickerset:new Api.InputStickerSetID({id:found.id,accessHash:found.accessHash}),
    hash:0,
  }));
  return {set:publicInstalledSets([found])[0],
    documents:(Array.isArray(result?.documents)?result.documents:[])
      .filter(doc=>doc?.id&&doc?.accessHash&&doc?.fileReference&&
        doc?.attributes?.some(attr=>/DocumentAttributeSticker/i.test(attr?.className||'')))
      .slice(0,MAX_STICKERS_PER_PACK)};
}
export async function resolveOwnerSticker(client,stickerId,setId,{recentStickers}={}){
  const requested=docId(stickerId);
  if(!/^\d{1,22}$/.test(requested))throw fail('Неверный стикер');
  if(setId!==undefined&&setId!==null&&String(setId)!==''){
    const pack=await getInstalledStickerPack(client,setId);
    const doc=pack.documents.find(item=>docId(item.id)===requested);
    if(!doc)throw fail('Стикер не принадлежит установленному набору',403);
    return doc;
  }
  if(typeof recentStickers!=='function')throw fail('Недавние стикеры недоступны',503);
  const recent=await recentStickers(client);
  const doc=recent.find(item=>docId(item.id)===requested);
  if(!doc)throw fail('Стикер больше не находится в недавних',409);
  return doc;
}
