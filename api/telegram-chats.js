import { openJson } from '../lib/viewer-sync-crypto.js';
import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { getViewerSession } from '../lib/viewer-sync-store.js';
import { withBackupClient } from '../lib/telegram-history-backup.js';

const BOT=String(process.env.TELEGRAM_BOT_TOKEN||'');
const PAGE_SIZE=50;
const MAX_DIALOGS=500;
const MESSAGE_PAGE=35;
const safeId=value=>String(value?.toString?.()||value||'');
const clean=(value,limit=200)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').slice(0,limit);
const validChatId=value=>/^-?\d{1,22}$/.test(String(value||''));
const userText=m=>clean(m?.message||m?.text||'',5000);
function dateString(value){
  const seconds=Number(value?.date||value||0);
  return seconds>0&&Number.isFinite(seconds)?new Date(seconds*1000).toISOString():null;
}
function kind(dialog){
  if(dialog?.entity?.self)return 'saved';
  if(dialog?.isUser)return dialog?.entity?.bot?'bot':'private';
  if(dialog?.isGroup)return 'group';
  if(dialog?.isChannel)return dialog?.entity?.broadcast?'channel':'group';
  return 'other';
}
function title(dialog){
  return clean(dialog?.title||dialog?.entity?.title||
    [dialog?.entity?.firstName,dialog?.entity?.lastName].filter(Boolean).join(' ')||
    dialog?.entity?.username||'Telegram чат',100);
}
function mediaType(m){
  if(m?.photo)return 'photo';
  const media=m?.media;
  if(!media)return null;
  const cls=String(media?.className||'');
  if(/Photo/i.test(cls))return 'photo';
  if(/Document/i.test(cls)){
    const attrs=media.document?.attributes||[];
    if(attrs.some(a=>a?.roundMessage))return 'video_note';
    if(attrs.some(a=>a?.voice))return 'voice';
    if(attrs.some(a=>a?.className==='DocumentAttributeAudio'))return 'audio';
    if(attrs.some(a=>a?.className==='DocumentAttributeVideo'))return 'video';
    return 'document';
  }
  if(/Geo/i.test(cls))return 'location';
  if(/Contact/i.test(cls))return 'contact';
  if(/WebPage/i.test(cls))return 'link';
  return 'attachment';
}
function preview(message){
  if(!message)return '';
  const txt=userText(message);
  if(txt)return txt.slice(0,180);
  const type=mediaType(message);
  const names={photo:'Фотография',video:'Видео',voice:'Голосовое сообщение',
    audio:'Аудио',document:'Документ',video_note:'Видеосообщение',
    location:'Местоположение',contact:'Контакт',link:'Ссылка'};
  return type?(names[type]||'Вложение'):'';
}
function dialogInfo(d){
  const username=clean(d?.entity?.username||'',65).replace(/[^A-Za-z0-9_]/g,'');
  const type=kind(d);
  const peerId=safeId(d?.entity?.id);
  const publicUrl=username?'https://t.me/'+username:null;
  const nativeUrl=type==='private'&&/^\d+$/.test(peerId)?'tg://user?id='+peerId:null;
  return {
    id:safeId(d?.id),title:title(d),type,username:username||null,
    peerId:peerId||null,
    preview:preview(d?.message),date:dateString(d?.message),
    unreadCount:Math.max(0,Math.min(99999,Number(d?.unreadCount||0))),
    pinned:Boolean(d?.pinned),muted:Boolean(d?.dialog?.notifySettings?.muteUntil),
    verified:Boolean(d?.entity?.verified),scam:Boolean(d?.entity?.scam),
    nativeUrl:publicUrl||nativeUrl,
  };
}
export function messageInfo(message,group=false){
  const mid=Number(message?.id||0);
  if(!Number.isSafeInteger(mid)||mid<=0)return null;
  const peer=message?.sender||{};
  const sender=clean(
    [peer.firstName,peer.lastName].filter(Boolean).join(' ')||peer.title||peer.username||'',
    90);
  return {
    id:mid,date:dateString(message),out:Boolean(message?.out),
    text:userText(message),media:mediaType(message),
    edited:Boolean(message?.editDate),sender:group?sender:null,
    // Live viewer deliberately never pulls Telegram attachments into our DB.
    // For protected media copies use independent owner-approved Media Vault.
  };
}
function errorMessage(error){
  const raw=String(error?.errorMessage||error?.message||'');
  if(/FLOOD_WAIT|429/i.test(raw))return {status:429,error:'Telegram ограничил запросы. Попробуй позже.'};
  if(/AUTH_KEY|SESSION_REVOKED|not authorized/i.test(raw))return {status:409,error:'Telegram-сессия недействительна. Подключи аккаунт заново.'};
  if(/timeout|ETIMEDOUT/i.test(raw))return {status:504,error:'Telegram отвечает слишком долго. Повтори запрос.'};
  return {status:503,error:'Не удалось открыть чаты. Проверь подключение Telegram.'};
}
function respond(res,status,data){res.status(status).json({ok:status<400,...data});}
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
  if(!BOT)return respond(res,503,{error:'Telegram не настроен'});
  const owner=validateTelegramMiniApp(String(req.headers['x-telegram-init-data']||''),BOT);
  if(!owner?.id)return respond(res,401,{error:'Открой VETO внутри Telegram'});
  let body={};
  try{body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};}
  catch{return respond(res,400,{error:'Некорректный запрос'});}
  const action=String(body.action||'list');
  if(!['list','thread'].includes(action))return respond(res,400,{error:'Неизвестная операция'});
  const userId=String(owner.id);
  try{
    const linked=await getViewerSession(userId);
    if(!linked||linked.status!=='active'||!linked.session_ciphertext)
      return respond(res,409,{error:'Подключи личный Telegram-аккаунт в VETO через номер или QR.'});
    if(String(linked.telegram_account_user_id||'')!==userId)
      return respond(res,403,{error:'Для просмотра подключи именно свой Telegram-аккаунт.'});
    const creds=await openJson(linked.session_ciphertext,'session:'+userId);
    if(!creds?.session)throw new Error('SESSION_REVOKED');
    const data=await withBackupClient(creds.session,async client=>{
      if(action==='list'){
        const page=Number(body.page??0);
        if(!Number.isSafeInteger(page)||page<0||page>=Math.ceil(MAX_DIALOGS/PAGE_SIZE))
          throw new Error('invalid_page');
        // Bounded, cursor-independent re-fetch avoids leaking MTProto access
        // hashes to the browser and keeps navigation valid after reconnect.
        const totalToFetch=Math.min(MAX_DIALOGS,(page+1)*PAGE_SIZE+1);
        const dialogs=await client.getDialogs({limit:totalToFetch});
        const start=page*PAGE_SIZE;
        return {
          chats:dialogs.slice(start,start+PAGE_SIZE).map(dialogInfo),
          page,hasMore:dialogs.length>start+PAGE_SIZE,
          limit:MAX_DIALOGS,updatedAt:new Date().toISOString(),
          scope:'read-only-cloud-chats',isCopy:false,
        };
      }
      const chatId=String(body.chatId||'');
      const cursor=Number(body.offsetId||0);
      if(!validChatId(chatId)||!Number.isSafeInteger(cursor)||cursor<0)
        throw new Error('invalid_thread');
      // A client may only open a dialog actually returned from the owner's
      // MTProto dialog list, never arbitrary foreign user/chat IDs.
      const dialogs=await client.getDialogs({limit:MAX_DIALOGS});
      const dialog=dialogs.find(d=>safeId(d.id)===chatId);
      if(!dialog)return {missing:true,limit:MAX_DIALOGS};
      const received=await client.getMessages(dialog.entity,{
        limit:MESSAGE_PAGE+1,offsetId:cursor,
      });
      const slice=received.slice(0,MESSAGE_PAGE);
      const oldest=Number(slice.at(-1)?.id||0);
      return {
        chat:dialogInfo(dialog),
        messages:slice.map(m=>messageInfo(m,kind(dialog)==='group')).filter(Boolean).reverse(),
        hasMore:received.length>MESSAGE_PAGE&&oldest>1,
        nextOffsetId:oldest>0&&oldest<(cursor||Number.MAX_SAFE_INTEGER)?oldest:null,
        readOnly:true,isCopy:false,
      };
    });
    if(data.missing)return respond(res,404,{error:'Чат не найден в последних 500 диалогах аккаунта. Используй оригинальный Telegram.'});
    return respond(res,200,data);
  }catch(error){
    const e=errorMessage(error);
    return respond(res,e.status,{error:e.error});
  }
}
