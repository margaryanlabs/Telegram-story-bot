import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { getViewerSession } from '../lib/viewer-sync-store.js';
import { sameTelegramAccount } from '../lib/telegram-session-owner.js';
import { openJson } from '../lib/viewer-sync-crypto.js';
import { withBackupClient } from '../lib/telegram-history-backup.js';
import { verifyTelegramClientOwner,telegramOwnerError } from '../lib/telegram-owner-runtime.js';
import { cleanOutgoingMessage,validateSendNonce,sendOwnerMessage,safeReplyId } from '../lib/telegram-chat-compose.js';
import { recentStickers,recentStickersPublic,sendRichTelegramMessage,decodeMediaInput } from '../lib/telegram-chat-rich.js';
import { getInstalledStickerSets,publicInstalledSets,getInstalledStickerPack,publicStickerDocuments } from '../lib/telegram-sticker-catalog.js';

const BOT = String(process.env.TELEGRAM_BOT_TOKEN || '');
const respond=(res,status,data)=>res.status(status).json({ok:status<400,...data});

function safeSendError(error) {
  const ownership=telegramOwnerError(error);
  if (ownership) return ownership;
  if (Number.isInteger(error?.status) && error.status>=400 && error.status<600) {
    return { status:error.status,error:String(error.message).slice(0,240) };
  }
  const raw=String(error?.errorMessage || error?.message || '');
  if (/RANDOM_ID_DUPLICATE/i.test(raw))
    return {status:409,uncertain:true,error:'Telegram обнаружил повтор отправки. Проверь чат: сообщение могло уже дойти. Не создавай новый дубль.'};
  if (/FLOOD_WAIT|PEER_FLOOD|SLOWMODE_WAIT|TOO_MANY_REQUESTS/i.test(raw))
    return {status:429,error:'Telegram ограничил частоту отправки. Не отправляй сообщение повторно сразу.'};
  if (/CHAT_WRITE_FORBIDDEN|USER_BANNED_IN_CHANNEL|USER_IS_BLOCKED|CHAT_ADMIN_REQUIRED|PEER_ID_INVALID/i.test(raw))
    return {status:403,error:'Telegram не разрешает отправку в этот чат. Проверь ограничения или доступ.'};
  if (/PRIVACY_PREMIUM_REQUIRED|PREMIUM_ACCOUNT_REQUIRED/i.test(raw))
    return {status:403,error:'Telegram ограничил отправку этому получателю. Возможно, требуется Premium.'};
  if (/AUTH_KEY|SESSION_REVOKED|not authorized/i.test(raw))
    return {status:409,error:'Telegram-сессия истекла. Подключи свой аккаунт заново.'};
  if (/timeout|ETIMEDOUT|abort|ECONN/i.test(raw))
    return {status:504,uncertain:true,error:'Нет подтверждения от Telegram. Сообщение могло быть отправлено — проверь чат перед повтором.'};
  return {status:503,uncertain:true,error:'Telegram не подтвердил отправку. Проверь чат перед повтором.'};
}

export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
  if(!BOT)return respond(res,503,{error:'Telegram не настроен'});
  const owner=validateTelegramMiniApp(String(req.headers['x-telegram-init-data']||''),BOT);
  if(!owner?.id)return respond(res,401,{error:'Открой StoryLab в собственном Telegram'});
  let body={};
  try { body=typeof req.body==='string' ? JSON.parse(req.body) : req.body||{}; }
  catch { return respond(res,400,{error:'Неверный запрос'}); }
  const action=String(body.action||'');
  if(!['send_message','send_media','send_sticker','recent_stickers','sticker_sets','sticker_set'].includes(action))
    return respond(res,400,{error:'Неизвестное действие'});
  let message='',nonce='',replyTo=null;
  try {
    if(action==='send_message')message=cleanOutgoingMessage(body.message);
    if(action==='send_media')decodeMediaInput(body); // reject unsafe or oversized file before opening MTProto
    if(['send_message','send_media','send_sticker'].includes(action))nonce=validateSendNonce(body.nonce);
    replyTo=safeReplyId(body.replyTo);
  } catch(error) { return respond(res,error.status||400,{error:error.message}); }
  const chatId=String(body.chatId||'');
  if(!/^-?\d{1,22}$/.test(chatId))return respond(res,400,{error:'Некорректный чат'});
  const userId=String(owner.id);
  try {
    const session=await getViewerSession(userId);
    if(!session || session.status!=='active' || !session.session_ciphertext)
      return respond(res,409,{error:'Сначала подключи свой Telegram через номер + код или QR.'});
    if(!sameTelegramAccount(userId,session.telegram_account_user_id))
      return respond(res,403,{error:'Этот Telegram-аккаунт не принадлежит тебе. Отправка заблокирована.'});
    const decrypted=await openJson(session.session_ciphertext,'session:'+userId);
    if(!decrypted?.session)return respond(res,409,{error:'Сессия отсутствует. Переподключи Telegram.'});
    const result=await withBackupClient(decrypted.session,async client=>{
      await verifyTelegramClientOwner(client,userId);
      // Stickers are owner-owned account metadata: authentication and owner
      // verification already happened above. Avoid loading up to 500 dialogs
      // merely to show the user's own 24 recent sticker choices.
      if(action==='recent_stickers')
        return {stickers:recentStickersPublic(await recentStickers(client))};
      if(action==='sticker_sets')
        return {sets:publicInstalledSets(await getInstalledStickerSets(client))};
      if(action==='sticker_set'){
        const pack=await getInstalledStickerPack(client,body.setId);
        return {set:pack.set,stickers:publicStickerDocuments(pack.documents)};
      }
      // Re-check target as an existing user-owned dialog, not a client-provided
      // access hash. Do not allow sends into archive-only or arbitrary peers.
      // Start with 60 peers; search further only for older conversations.
      const recent=await client.getDialogs({limit:60});
      const recentMatch=recent.some(dialog=>String(dialog?.id?.toString?.()||dialog?.id||'')===chatId);
      const dialogs=recentMatch ? recent : await client.getDialogs({limit:500});
      if(action==='send_message')
        return sendOwnerMessage(client,dialogs,{ownerId:userId,chatId,message,nonce,replyTo});
      return sendRichTelegramMessage(client,dialogs,{
        ...body,ownerId:userId,chatId,nonce,replyTo,action,
      });
    });
    if(['recent_stickers','sticker_sets','sticker_set'].includes(action))
      return respond(res,200,{
        ...result,source:'owner-mtproto',notCached:true,
      });
    return respond(res,200,{
      sent:result.sent,chatId:result.chatId,messageId:result.messageId,
      source:result.source||'owner-mtproto',kind:result.kind||'text',delivery:result.delivery,
      note:'Telegram принял отправку из твоего личного аккаунта.',
    });
  } catch(error) {
    // NEVER log message body, auth session, peer username, or phone number.
    const safe=safeSendError(error);
    return respond(res,safe.status,{error:safe.error,uncertain:safe.uncertain===true});
  }
}
