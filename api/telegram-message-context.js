import {validateTelegramMiniApp} from '../lib/telegram-miniapp-auth.js';
import {getViewerSession,listPrivacyMessages} from '../lib/viewer-sync-store.js';
import {sameTelegramAccount} from '../lib/telegram-session-owner.js';
import {openJson} from '../lib/viewer-sync-crypto.js';
import {withBackupClient} from '../lib/telegram-history-backup.js';
import {verifyTelegramClientOwner,telegramOwnerError} from '../lib/telegram-owner-runtime.js';
import {messageInfo} from './telegram-chats.js';

// A search result can open its exact message, NOT a guessed timestamp or a
// scroll through potentially thousands of unrelated messages. Re-resolve the
// source against the signed owner's own MTProto or saved Vault on every tap.
export const CONTEXT_MAX_VAULT_OFFSET=5000;
export function validateSourceRequest(body){
  const chatId=String(body?.chatId||'');
  const messageId=body?.messageId;
  const source=String(body?.source||'');
  const vaultOffset=body?.vaultOffset;
  if(!/^-?\d{1,22}$/.test(chatId)||
    !Number.isSafeInteger(messageId)||messageId<1||!['telegram-cloud','veto-vault'].includes(source))
    throw Object.assign(new Error('Некорректная ссылка на сообщение'),{status:400});
  if(source==='veto-vault'&&(!Number.isSafeInteger(vaultOffset)||
      vaultOffset<0||vaultOffset>CONTEXT_MAX_VAULT_OFFSET))
    throw Object.assign(new Error('У сохранённого сообщения нет точного смещения'),{status:400});
  return {chatId,messageId,source,vaultOffset};
}
const response=(res,status,extra)=>res.status(status).json({ok:status<400,...extra});
const safe=value=>String(value||'').replace(/[\u0000-\u001f]/g,' ').slice(0,5000);
export function preservedMessage(row){
  return {
    id:Number(row.message_id),date:row.sent_at||row.created_at||null,
    out:row.direction==='outgoing',
    text:safe(row.text_content||row.caption),
    sender:safe(row.sender_display_name).slice(0,90)||null,
    media:row.media_type||null,
    saved:true,deleted:Boolean(row.deleted_at),
    preservedOnly:true,sourceIsolated:true,
  };
}
export async function exactVaultMessage(userId,chatId,messageId,vaultOffset){
  const offset=Math.max(0,vaultOffset-1);
  const raw=await listPrivacyMessages(userId,chatId,3,offset);
  const rows=Array.isArray(raw?.messages)?raw.messages:[];
  const found=rows.find(row=>Number(row.message_id)===messageId);
  return found?preservedMessage(found):null;
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return response(res,405,{error:'Method not allowed'});
  const token=String(process.env.TELEGRAM_BOT_TOKEN||'');
  if(!token)return response(res,503,{error:'Telegram не настроен'});
  const owner=validateTelegramMiniApp(String(req.headers['x-telegram-init-data']||''),token);
  if(!owner?.id)return response(res,401,{error:'Открой VETO внутри собственного Telegram'});
  let body;
  try{body=typeof req.body==='string'?JSON.parse(req.body):req.body||{}}
  catch{return response(res,400,{error:'Неверный запрос'})}
  let params;
  try{params=validateSourceRequest(body)}
  catch(error){return response(res,error.status||400,{error:error.message})}
  const userId=String(owner.id);
  try{
    const session=await getViewerSession(userId);
    if(!session||session.status!=='active'||!session.session_ciphertext)
      return response(res,409,{error:'Подключи собственный Telegram'});
    if(!sameTelegramAccount(userId,session.telegram_account_user_id))
      return response(res,403,{error:'Подключён другой аккаунт Telegram'});
    const unlocked=await openJson(session.session_ciphertext,'session:'+userId);
    if(!unlocked?.session)return response(res,409,{error:'Telegram-сессия недоступна'});
    const {chatId,messageId,source,vaultOffset}=params;
    if(source==='veto-vault'){
      const item=await exactVaultMessage(userId,chatId,messageId,vaultOffset);
      if(!item)return response(res,404,{error:'Сохранённое сообщение по этому адресу не найдено. Архив мог измениться.'});
      return response(res,200,{message:item,source:'owner-vault',exact:true});
    }
    const message=await withBackupClient(unlocked.session,async client=>{
      await verifyTelegramClientOwner(client,userId);
      let dialogs=await client.getDialogs({limit:80});
      let dialog=dialogs.find(x=>String(x.id)===chatId);
      if(!dialog){
        dialogs=await client.getDialogs({limit:500});
        dialog=dialogs.find(x=>String(x.id)===chatId);
      }
      if(!dialog)return null;
      const entries=await client.getMessages(dialog.entity,{ids:[messageId]});
      const exact=Array.isArray(entries)?entries.find(m=>Number(m?.id)===messageId):null;
      return exact?messageInfo(exact,Boolean(dialog.isGroup)):null;
    });
    if(!message)return response(res,404,{
      error:'Сообщение недоступно в текущем Telegram. Возможно, оно удалено или чат отсутствует в доступном списке.'
    });
    return response(res,200,{message:{...message,sourceIsolated:true},source:'owner-telegram',exact:true});
  }catch(error){
    const deny=telegramOwnerError(error);
    if(deny)return response(res,deny.status,{error:deny.error});
    return response(res,503,{error:'Источник временно недоступен. Сообщение не подменено примером.'});
  }
}
