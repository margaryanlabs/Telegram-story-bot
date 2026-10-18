import {Api} from 'teleproto';
import {validateTelegramMiniApp} from '../lib/telegram-miniapp-auth.js';
import {getViewerSession} from '../lib/viewer-sync-store.js';
import {sameTelegramAccount} from '../lib/telegram-session-owner.js';
import {openJson} from '../lib/viewer-sync-crypto.js';
import {withBackupClient} from '../lib/telegram-history-backup.js';
import {verifyTelegramClientOwner,telegramOwnerError} from '../lib/telegram-owner-runtime.js';
import {recentStickers} from '../lib/telegram-chat-rich.js';
import {getInstalledStickerPack} from '../lib/telegram-sticker-catalog.js';

export const MAX_PREVIEWS=8;
export const MAX_STICKER_BYTES=160*1024;
export const MAX_BATCH_RESPONSE_BYTES=800*1024;
export function requestedStickerIds(items){
  if(!Array.isArray(items)||items.length<1||items.length>MAX_PREVIEWS)
    throw Object.assign(new Error('Выбери от 1 до 8 стикеров'),{status:400});
  if(items.some(id=>!/^\d{1,22}$/.test(String(id))))
    throw Object.assign(new Error('Неверный идентификатор стикера'),{status:400});
  return [...new Set(items.map(String))];
}
export function isStaticWebp(doc){
  return Boolean(doc&&String(doc.mimeType||'').toLowerCase()==='image/webp'&&
    Number.isSafeInteger(Number(doc.size))&&Number(doc.size)>0&&
    Number(doc.size)<=MAX_STICKER_BYTES);
}
const id=d=>String(d?.id?.toString?.()||d?.id||'');
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const bot=String(process.env.TELEGRAM_BOT_TOKEN||'');
  if(!bot)return res.status(503).json({error:'Telegram не настроен'});
  const owner=validateTelegramMiniApp(String(req.headers['x-telegram-init-data']||''),bot);
  if(!owner?.id)return res.status(401).json({error:'Открой VETO в собственном Telegram'});
  const body=typeof req.body==='string'?(()=>{try{return JSON.parse(req.body)}catch{return null}})():req.body;
  if(!body||typeof body!=='object')return res.status(400).json({error:'Неверный запрос'});
  let ids;
  try{ids=requestedStickerIds(body.stickerIds)}
  catch(error){return res.status(error.status||400).json({error:error.message})}
  const userId=String(owner.id);
  try{
    const session=await getViewerSession(userId);
    if(!session||session.status!=='active'||!session.session_ciphertext)
      return res.status(409).json({error:'Telegram не подключён'});
    if(!sameTelegramAccount(userId,session.telegram_account_user_id))
      return res.status(403).json({error:'Несовпадение владельца Telegram'});
    const key=await openJson(session.session_ciphertext,'session:'+userId);
    if(!key?.session)return res.status(409).json({error:'Telegram-сессия недоступна'});
    const images=await withBackupClient(key.session,async client=>{
      await verifyTelegramClientOwner(client,userId);
      const candidates=body.setId
        ?(await getInstalledStickerPack(client,body.setId)).documents
        :await recentStickers(client);
      const available=new Map(candidates.filter(isStaticWebp).map(doc=>[id(doc),doc]));
      let budget=MAX_BATCH_RESPONSE_BYTES,cursor=0;
      const result=[];
      async function worker(){
        while(cursor<ids.length){
          const current=ids[cursor++],doc=available.get(current);
          if(!doc)continue;
          try{
            const raw=await client.downloadMedia(new Api.MessageMediaDocument({document:doc}),{
              progressCallback:(now,total)=>{
                if(Number(now)>MAX_STICKER_BYTES||Number(total)>MAX_STICKER_BYTES)
                  throw new Error('too_large');
              },
            });
            const bytes=Buffer.isBuffer(raw)?raw:raw instanceof Uint8Array?Buffer.from(raw):null;
            if(!bytes||!bytes.length||bytes.length>MAX_STICKER_BYTES||
               bytes.toString('ascii',0,4)!=='RIFF'||
               bytes.toString('ascii',8,12)!=='WEBP')continue;
            // Avoid publishing an oversized batch or storing thumbnails.
            if(bytes.length>budget)continue;
            budget-=bytes.length;
            result.push({id:current,base64:bytes.toString('base64')});
          }catch{/* Static thumbnail unavailable; emoji fallback remains. */}
        }
      }
      await Promise.all([worker(),worker()]);
      return result;
    });
    return res.status(200).json({ok:true,images,source:'owner-mtproto',notCached:true});
  }catch(error){
    const deny=telegramOwnerError(error);
    if(deny)return res.status(deny.status).json({error:deny.error});
    return res.status(503).json({error:'Предпросмотр недоступен, стикеры можно отправлять без картинки'});
  }
}
