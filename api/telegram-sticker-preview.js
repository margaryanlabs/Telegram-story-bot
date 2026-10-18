import {Api} from 'teleproto';
import {validateTelegramMiniApp} from '../lib/telegram-miniapp-auth.js';
import {getViewerSession} from '../lib/viewer-sync-store.js';
import {sameTelegramAccount} from '../lib/telegram-session-owner.js';
import {openJson} from '../lib/viewer-sync-crypto.js';
import {withBackupClient} from '../lib/telegram-history-backup.js';
import {verifyTelegramClientOwner,telegramOwnerError} from '../lib/telegram-owner-runtime.js';
import {recentStickers} from '../lib/telegram-chat-rich.js';
import {resolveOwnerSticker} from '../lib/telegram-sticker-catalog.js';

// Only the currently authenticated owner's actual recent static WEBP stickers.
// Animated .tgs and video stickers are intentionally NOT served as images.
export const MAX_STICKER_BYTES=160*1024;
export default async function handler(req,res){
  res.setHeader('Cache-Control','private,no-store,max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const bot=String(process.env.TELEGRAM_BOT_TOKEN||'');
  if(!bot)return res.status(503).json({error:'Telegram не настроен'});
  const owner=validateTelegramMiniApp(String(req.headers['x-telegram-init-data']||''),bot);
  if(!owner?.id)return res.status(401).json({error:'Открой приложение внутри Telegram'});
  let body={};
  try{body=typeof req.body==='string'?JSON.parse(req.body):req.body||{}}
  catch{return res.status(400).json({error:'Неверный запрос'})}
  const stickerId=String(body.stickerId||'');
  if(!/^[0-9]{1,22}$/.test(stickerId))return res.status(400).json({error:'Неверный стикер'});
  const userId=String(owner.id);
  try{
    const session=await getViewerSession(userId);
    if(!session||session.status!=='active'||!session.session_ciphertext)
      return res.status(409).json({error:'Подключи собственный Telegram'});
    if(!sameTelegramAccount(userId,session.telegram_account_user_id))
      return res.status(403).json({error:'Telegram-аккаунт не совпадает'});
    const decrypted=await openJson(session.session_ciphertext,'session:'+userId);
    if(!decrypted?.session)return res.status(409).json({error:'Сессия недоступна'});
    const data=await withBackupClient(decrypted.session,async client=>{
      await verifyTelegramClientOwner(client,userId);
      const doc=await resolveOwnerSticker(client,stickerId,body.setId,{recentStickers});
      if(!doc||String(doc.mimeType||'').toLowerCase()!=='image/webp'||
         !Number.isFinite(Number(doc.size))||Number(doc.size)<=0||
         Number(doc.size)>MAX_STICKER_BYTES)return null;
      const media=new Api.MessageMediaDocument({document:doc});
      const raw=await client.downloadMedia(media,{
        progressCallback:(current,total)=>{
          if(Number(current)>MAX_STICKER_BYTES||Number(total)>MAX_STICKER_BYTES)
            throw new Error('too_large');
        },
      });
      const bytes=Buffer.isBuffer(raw)?raw:raw instanceof Uint8Array?Buffer.from(raw):null;
      if(!bytes||!bytes.length||bytes.length>MAX_STICKER_BYTES)return null;
      // Require a genuine RIFF/WEBP signature; no SVG/HTML or arbitrary media.
      if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')return null;
      return bytes;
    });
    if(!data)return res.status(404).json({error:'Нет статичного предпросмотра'});
    res.setHeader('Content-Type','image/webp');
    res.setHeader('Content-Disposition','inline');
    res.setHeader('Content-Length',String(data.length));
    return res.status(200).end(data);
  }catch(error){
    const deny=telegramOwnerError(error);
    if(deny)return res.status(deny.status).json({error:deny.error});
    return res.status(503).json({error:'Стикер временно не загружается'});
  }
}
