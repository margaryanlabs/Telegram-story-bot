import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { getViewerSession } from '../lib/viewer-sync-store.js';
import { openJson } from '../lib/viewer-sync-crypto.js';
import { withBackupClient } from '../lib/telegram-history-backup.js';

const BOT=String(process.env.TELEGRAM_BOT_TOKEN||'');
const AVATAR_LIMIT=180*1024;
const PHOTO_LIMIT=4*1024*1024;
const MAX_DIALOGS=500;
const validId=value=>/^-?\d{1,22}$/.test(String(value||''));
const safeId=value=>String(value?.toString?.()||value||'');
function deny(res,status,msg){
  res.setHeader('Cache-Control','private,no-store,max-age=0');
  return res.status(status).json({ok:false,error:msg});
}
async function getPhoto(client,dialog,messageId) {
  const id=Number(messageId);
  if(!Number.isSafeInteger(id)||id<1)return null;
  const messages=await client.getMessages(dialog.entity,{ids:[id]});
  const message=Array.isArray(messages)?messages.find(m=>Number(m?.id)===id):null;
  if(!message?.photo && !/Photo/i.test(String(message?.media?.className||'')))return null;
  const documentedSize=Number(message?.media?.photo?.sizes?.at?.(-1)?.size||0);
  if(documentedSize>PHOTO_LIMIT)return null;
  return client.downloadMedia(message,{
    progressCallback:(loaded,total)=>{
      if(Number(loaded)>PHOTO_LIMIT||Number(total)>PHOTO_LIMIT)
        throw new Error('media_limit');
    },
  });
}
async function getAvatar(client,dialog) {
  if(!dialog?.entity?.photo)return null;
  return client.downloadProfilePhoto(dialog.entity,{isBig:false});
}
export default async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','private,no-store,max-age=0');
  if(req.method!=='POST')return deny(res,405,'Method not allowed');
  if(!BOT)return deny(res,503,'Telegram не подключён');
  const owner=validateTelegramMiniApp(String(req.headers['x-telegram-init-data']||''),BOT);
  if(!owner?.id)return deny(res,401,'Открой VETO внутри Telegram');
  let body={};
  try { body=typeof req.body==='string'?JSON.parse(req.body):req.body||{}; }
  catch { return deny(res,400,'Некорректный запрос'); }
  const chatId=String(body.chatId||''),action=String(body.action||'');
  if(!validId(chatId)||!['avatar','photo'].includes(action))
    return deny(res,400,'Некорректное фото или чат');
  const userId=String(owner.id);
  try{
    const session=await getViewerSession(userId);
    if(!session||session.status!=='active'
      ||String(session.telegram_account_user_id||'')!==userId)
      return deny(res,409,'Подключи личный Telegram в VETO');
    const credentials=await openJson(session.session_ciphertext,'session:'+userId);
    if(!credentials?.session)return deny(res,409,'Telegram-сессия недоступна');
    const buffer=await withBackupClient(credentials.session,async client=>{
      // Never accept peer/access hashes from the browser: the dialog must be
      // reachable in the authenticated owner's real Telegram account.
      const dialogs=await client.getDialogs({limit:MAX_DIALOGS});
      const dialog=dialogs.find(d=>safeId(d?.id)===chatId);
      if(!dialog)return null;
      const raw=action==='avatar'
        ? await getAvatar(client,dialog)
        : await getPhoto(client,dialog,body.messageId);
      const max=action==='avatar'?AVATAR_LIMIT:PHOTO_LIMIT;
      const bytes=Buffer.isBuffer(raw)?raw:raw instanceof Uint8Array?Buffer.from(raw):null;
      return bytes&&bytes.length>0&&bytes.length<=max?bytes:null;
    });
    if(!buffer)return deny(res,404,'Фото недоступно или превышает лимит');
    // Telegram profile photos and MessageMediaPhoto are JPEG; no user-supplied mime.
    res.setHeader('Content-Type','image/jpeg');
    res.setHeader('Content-Disposition','inline');
    res.setHeader('Content-Length',String(buffer.length));
    return res.status(200).end(buffer);
  }catch(error){
    const msg=String(error?.errorMessage||error?.message||'');
    if(/FLOOD_WAIT|429/i.test(msg))return deny(res,429,'Telegram ограничил загрузку фото');
    if(/AUTH_KEY|SESSION_REVOKED/i.test(msg))return deny(res,409,'Восстанови подключение Telegram');
    return deny(res,503,'Не удалось получить фото из Telegram');
  }
}
