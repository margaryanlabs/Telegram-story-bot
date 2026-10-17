import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { getViewerSession,listPrivacyMessages } from '../lib/viewer-sync-store.js';
import { openJson } from '../lib/viewer-sync-crypto.js';
import { sameTelegramAccount } from '../lib/telegram-session-owner.js';
import { verifyTelegramClientOwner,telegramOwnerError } from '../lib/telegram-owner-runtime.js';
import { withBackupClient } from '../lib/telegram-history-backup.js';
import { messageInfo,combineLiveAndPreserved } from './telegram-chats.js';

const BOT=String(process.env.TELEGRAM_BOT_TOKEN||'');
export const ACTIVE_DIALOG_SCAN=70;
export const ACTIVE_LATEST_MESSAGES=28;
const id=v=>String(v?.toString?.()||v||'');
const reply=(res,status,data)=>res.status(status).json({ok:status<400,...data});

export function normalizePolledArchive(rows=[]) {
  return (Array.isArray(rows)?rows:[]).map(row=>({
    id:Number(row.message_id),date:row.sent_at||null,
    out:row.direction==='outgoing',
    text:String(row.text_content||row.caption||'').slice(0,5000),
    media:row.media_type||null,
    mediaAvailable:Boolean(row.media_file_id)||row.media_archive_status==='archived',
    edited:Boolean(row.edited_at),deleted:Boolean(row.deleted_at),saved:true,
    sender:String(row.sender_display_name||'').slice(0,90)||null,
  })).filter(row=>Number.isSafeInteger(row.id)&&row.id>0);
}

// Short-lived MTProto sessions in Vercel cannot subscribe continuously like
// native Telegram clients. Refresh only the currently open, owner-verified chat.
// Never mark messages read and never infer 'deleted' from missing live items.
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return reply(res,405,{error:'POST required'});
  if(!BOT)return reply(res,503,{error:'Telegram не настроен'});
  const owner=validateTelegramMiniApp(String(req.headers['x-telegram-init-data']||''),BOT);
  if(!owner?.id)return reply(res,401,{error:'Открой VETO внутри своего Telegram'});
  let body={};
  try{body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};}
  catch{return reply(res,400,{error:'Некорректный запрос'});}
  if(body.action!=='poll_thread')return reply(res,400,{error:'Unknown action'});
  const chatId=String(body.chatId||'');
  if(!/^-?\d{1,22}$/.test(chatId))return reply(res,400,{error:'Некорректный чат'});
  const userId=String(owner.id);
  try{
    const session=await getViewerSession(userId);
    if(!session||session.status!=='active'||!session.session_ciphertext){
      return reply(res,409,{error:'Подключи личный Telegram для обновления переписки'});
    }
    if(!sameTelegramAccount(userId,session.telegram_account_user_id)){
      return reply(res,403,{error:'Чужая Telegram-сессия. Обновление запрещено'});
    }
    const decrypted=await openJson(session.session_ciphertext,'session:'+userId);
    if(!decrypted?.session)return reply(res,409,{error:'Telegram-сессия недоступна'});
    // Archive evidence is a separate owner-scoped read. The archive is NOT
    // inferred from the live snapshot, and never fabricated on store outages.
    const archive= listPrivacyMessages(userId,chatId,ACTIVE_LATEST_MESSAGES,0)
      .then(result=>normalizePolledArchive(result?.messages))
      .catch(()=>[]);
    const live=await withBackupClient(decrypted.session,async client=>{
      await verifyTelegramClientOwner(client,userId);
      let dialogs=await client.getDialogs({limit:ACTIVE_DIALOG_SCAN});
      let dialog=dialogs.find(item=>id(item?.id)===chatId);
      if(!dialog){
        dialogs=await client.getDialogs({limit:500});
        dialog=dialogs.find(item=>id(item?.id)===chatId);
      }
      if(!dialog)return {missing:true};
      const messages=await client.getMessages(dialog.entity,{limit:ACTIVE_LATEST_MESSAGES});
      return {missing:false,
        messages:messages.map(m=>messageInfo(m,Boolean(dialog.isGroup))).filter(Boolean).reverse()};
    });
    if(live.missing)return reply(res,404,{error:'Чат больше не доступен в Telegram'});
    const saved=await archive;
    return reply(res,200,{
      chatId,source:'owner-mtproto-poll',readReceiptsSent:false,
      // Archived evidence merges into new live messages; a missing live item
      // alone is NOT evidence of deletion or preservation.
      messages:combineLiveAndPreserved(live.messages,saved),
      verifiedAt:new Date().toISOString(),latestWindow:ACTIVE_LATEST_MESSAGES,
    });
  }catch(error){
    const ownerError=telegramOwnerError(error);
    if(ownerError)return reply(res,ownerError.status,{error:ownerError.error});
    const raw=String(error?.errorMessage||error?.message||'');
    if(/FLOOD_WAIT|429|SLOWMODE_WAIT/.test(raw))return reply(res,429,{error:'Telegram ограничил частоту обновления'});
    if(/AUTH_KEY|SESSION_REVOKED|not authorized/i.test(raw))
      return reply(res,409,{error:'Сессия Telegram истекла. Подключи аккаунт заново'});
    return reply(res,503,{error:'Не удалось обновить сообщения. Повтори позже'});
  }
}
