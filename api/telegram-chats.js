import { openJson } from '../lib/viewer-sync-crypto.js';
import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { getViewerSession, listPrivacyThreads, listPrivacyMessages, getPrivacySettings, getBusinessConnectionState } from '../lib/viewer-sync-store.js';
import { inboxSignals, privacyReadiness } from '../lib/telegram-inbox-signals.js';
import { withBackupClient } from '../lib/telegram-history-backup.js';
import { sameTelegramAccount } from '../lib/telegram-session-owner.js';
import { verifyTelegramClientOwner, telegramOwnerError } from '../lib/telegram-owner-runtime.js';
import { SENDABLE_TYPES } from '../lib/telegram-chat-compose.js';

const BOT=String(process.env.TELEGRAM_BOT_TOKEN||'');
const PAGE_SIZE=50;
const FIRST_PAGE_SIZE=24;
const FAST_THREAD_DIALOGS=80;
const MAX_DIALOGS=500;
// Fetch only what is needed for the first paint; keep all later pages gap-free.
export function dialogPageBounds(page){
  const maxPage=Math.ceil((MAX_DIALOGS-FIRST_PAGE_SIZE)/PAGE_SIZE);
  if(!Number.isSafeInteger(page)||page<0||page>maxPage)
    throw new RangeError('Invalid chat page');
  const start=page===0?0:FIRST_PAGE_SIZE+(page-1)*PAGE_SIZE;
  return {start,count:Math.min(MAX_DIALOGS-start,page===0?FIRST_PAGE_SIZE:PAGE_SIZE)};
}
const MESSAGE_PAGE=35;
const ARCHIVE_PAGE=100;
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
    if(attrs.some(a=>a?.className==='DocumentAttributeSticker'))return 'sticker';
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
    audio:'Аудио',document:'Документ',video_note:'Видеосообщение',sticker:'Стикер',
    location:'Местоположение',contact:'Контакт',link:'Ссылка'};
  return type?(names[type]||'Вложение'):'';
}
export function dialogInfo(d){
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
    pinned:Boolean(d?.pinned),archived:Boolean(d?.archived||d?.folderId===1),
    muted:Boolean(d?.dialog?.notifySettings?.muteUntil),
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
    replyTo:Number.isSafeInteger(Number(message?.replyTo?.replyToMsgId))
      ? Number(message.replyTo.replyToMsgId) : null,
    // Live viewer deliberately never pulls Telegram attachments into our DB.
    // For protected media copies use independent owner-approved Media Vault.
  };
}

// Ordering mirrors the original time a message was sent, never the time
// it was deleted or archived. It keeps cleared chats in their historical row.
export function orderChatRows(chats=[]){
  return [...chats].sort((left,right)=>{
    if(Boolean(left.pinned)!==Boolean(right.pinned))return left.pinned?-1:1;
    const a=Date.parse(left.date||'')||0;
    const b=Date.parse(right.date||'')||0;
    if(a!==b)return b-a;
    return String(left.id||'').localeCompare(String(right.id||''));
  });
}
export function archivedDialog(row){
  const title=clean(row?.title||'Сохранённый чат',100);
  return {
    id:safeId(row?.chatId),title,type:'copy',username:null,peerId:null,
    preview:clean(row?.preview||row?.deletedPreview||'Есть сохранённая переписка',180),
    date:row?.lastAt||null,unreadCount:0,pinned:false,muted:false,
    verified:false,nativeUrl:null,
    archiveOnly:true,savedCopy:true,archived:true,
    savedCount:Math.max(0,Number(row?.messageCount||0)),
    deletedCount:Math.max(0,Number(row?.deletedCount||0)),
    lastDeletedAt:row?.lastDeletedAt||null,
  };
}
export function decorateRemote(remote,archiveRows){
  const archiveMap=new Map((archiveRows||[]).map(row=>[safeId(row.chatId),row]));
  return remote.map(chat=>{
    const row=archiveMap.get(chat.id);
    if(!row)return chat;
    const archivedTime=Date.parse(row.lastAt||'')||0;
    const liveTime=Date.parse(chat.date||'')||0;
    const preservedIsNewer=archivedTime>liveTime;
    return {...chat,savedCopy:true,
      date:preservedIsNewer?row.lastAt:chat.date,
      preview:preservedIsNewer?clean(row.preview||row.deletedPreview||chat.preview,180):chat.preview,
      savedCount:Math.max(0,Number(row.messageCount||0)),
      deletedCount:Math.max(0,Number(row.deletedCount||0)),
      lastDeletedAt:row.lastDeletedAt||null,
    };
  });
}
async function archiveThreads(ownerId){
  try {
    const result=await listPrivacyThreads(ownerId);
    return Array.isArray(result?.threads)
      ? result.threads.filter(row=>safeId(row?.chatId)&&Number(row?.messageCount||0)>0)
      : [];
  }catch {
    // If private archive is unavailable, do not invent saved chats.
    return [];
  }
}
async function archivedMessages(ownerId,chatId,offset=0){
  try{
    const result=await listPrivacyMessages(ownerId,chatId,ARCHIVE_PAGE,offset);
    const rows=Array.isArray(result?.messages)?result.messages:[];
    return {
      messages:rows.map(row=>({
        id:Number(row.message_id),date:row.sent_at||null,
        out:row.direction==='outgoing',
        text:clean(row.text_content||row.caption||'',5000),
        media:row.media_type||null,
        mediaAvailable:Boolean(row.media_file_id)||row.media_archive_status==='archived',
        edited:Boolean(row.edited_at),
        deleted:Boolean(row.deleted_at),saved:true,
        sender:clean(row.sender_display_name||'',90)||null,
      })).filter(row=>Number.isSafeInteger(row.id)&&row.id>0),
      hasMore:Boolean(result?.hasMore),
      nextOffset:offset+rows.length,
    };
  }catch{return {messages:[],hasMore:false,nextOffset:offset};}
}
export function combineLiveAndPreserved(live=[],preserved=[]){
  const map=new Map();
  for(const msg of live)if(msg?.id)map.set(String(msg.id),msg);
  for(const kept of preserved){
    if(!kept?.id)continue;
    const key=String(kept.id),previous=map.get(key);
    if(previous){
      map.set(key,{...previous,saved:true,deleted:Boolean(kept.deleted),
        mediaAvailable:Boolean(kept.mediaAvailable),
        archivedOriginal:Boolean(kept.deleted)});
    }else{
      map.set(key,{...kept,preservedOnly:true});
    }
  }
  return [...map.values()].sort((a,b)=>
    new Date(a.date||0).getTime()-new Date(b.date||0).getTime()||
    Number(a.id)-Number(b.id));
}
function errorMessage(error){
  const raw=String(error?.errorMessage||error?.message||'');
  const ownerError = telegramOwnerError(error);
  if(ownerError)return ownerError;
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
  if(!['list','thread','thread_archive'].includes(action))return respond(res,400,{error:'Неизвестная операция'});
  const userId=String(owner.id);
  const page=Number(body.page??0);
  const chatId=String(body.chatId||'');
  const cursor=Number(body.offsetId||0);
  const archiveOffset=Number(body.archiveOffset||0);
  if(action==='list'&&(!Number.isSafeInteger(page)||page<0||
    page>Math.ceil((MAX_DIALOGS-FIRST_PAGE_SIZE)/PAGE_SIZE)))
    return respond(res,400,{error:'Неверная страница списка чатов'});
  if((action==='thread'||action==='thread_archive')&&(!validChatId(chatId)||!Number.isSafeInteger(cursor)||cursor<0
    ||!Number.isSafeInteger(archiveOffset)||archiveOffset<0||archiveOffset>50000))
    return respond(res,400,{error:'Неверный идентификатор переписки'});
  // Fast live mode deliberately defers storage reads until after the Telegram
  // history is on screen. It is only allowed on the initial, owner-scoped page.
  // If MTProto cannot locate the peer, fall back to archived copies below.
  const fastLive=action==='thread'&&body.fastLive===true&&cursor===0&&
    archiveOffset===0&&body.archiveOnly!==true&&body.liveExhausted!==true;
  try{
    // Archive-only reads never connect to Telegram/MTProto. They are always
    // owner-scoped by the signed Mini App user id, with no public media links.
    if(action==='thread_archive'){
      const saved=await archivedMessages(userId,chatId,archiveOffset);
      return respond(res,200,{
        messages:saved.messages,archiveHasMore:saved.hasMore,
        archiveNextOffset:saved.nextOffset,source:'owner-private-archive',
      });
    }
    // Read owner-scoped archive and permission evidence concurrently. Network
    // failure must never be reported as 'Privacy disabled' without evidence.
    // Begin archive and Business diagnostics without delaying the first
    // MTProto connection. Archive retrieval and Telegram are independent
    // owner-scoped services, so the previous Promise.all created a needless
    // serial wait: STORE → Telegram → messages.
    let historyPromise=fastLive?Promise.resolve([]):archiveThreads(userId);
    const permissionStatePromise=action==='list'
      ? Promise.all([getPrivacySettings(userId).catch(()=>null),
          getBusinessConnectionState(userId).catch(()=>null)])
          .then(([settings,business])=>({settings,business}))
      : Promise.resolve({settings:null,business:null});
    const linked=await getViewerSession(userId).catch(()=>null);
    const validSession=linked?.status==='active' && linked.session_ciphertext &&
      sameTelegramAccount(userId, linked.telegram_account_user_id);
    if(linked?.status==='active' && !sameTelegramAccount(userId,linked.telegram_account_user_id)){
      return respond(res,409,telegramOwnerError({code:'TELEGRAM_OWNER_MISMATCH'}));
    }
    let creds=null;
    if(validSession){
      try{creds=await openJson(linked.session_ciphertext,'session:'+userId);}
      catch{/* Archival copies remain readable when MTProto authorization expires. */}
    }
    if(action==='list'){
      let live={chats:[],hasMore:false,account:null};
      let warning=null;
      if(creds?.session){
        try{
          live=await withBackupClient(creds.session,async client=>{
            const account=await verifyTelegramClientOwner(client,userId);
            // Bounded cursor-independent retrieval, never return access hashes.
            const {start,count}=dialogPageBounds(page);
            const dialogs=await client.getDialogs({limit:Math.min(MAX_DIALOGS,start+count+1)});
            return {chats:dialogs.slice(start,start+count).map(dialogInfo),
              hasMore:dialogs.length>start+count,account};
          });
        }catch(error){
          const stop=telegramOwnerError(error);
          if(stop)return respond(res,stop.status,{error:stop.error});
          warning=errorMessage(error).error;
        }
      }else warning='Подключи свой Telegram для живых чатов. Ранее сохранённые копии VETO доступны отдельно.';
      // Both requests were already running while MTProto connected.
      const [history,permissionState]=await Promise.all([historyPromise,permissionStatePromise]);
      const chats=decorateRemote(live.chats,history);
      if(page===0){
        const liveIds=new Set(chats.map(c=>c.id));
        for(const thread of history){
          const entry=archivedDialog(thread);
          if(!liveIds.has(entry.id))chats.push(entry);
        }
      }
      if(warning && !history.length)return respond(res,409,{error:warning});
      return respond(res,200,{
        chats:orderChatRows(chats).map(chat=>({...chat,inbox:inboxSignals(chat)})),page,hasMore:Boolean(live.hasMore),limit:MAX_DIALOGS,
        updatedAt:new Date().toISOString(),warning,
        archivedThreads:history.length,scope:'owner-cloud-chats',isCopy:false,
        connection:{verified:Boolean(live.account?.verified),
          source:live.account?.verified?'telegram-live':'owner-scoped-veto-archive',
          accountName:live.account?.name||null,username:live.account?.username||null,
          archivedThreads:history.length,
          confirmedDeleted:history.reduce((n,row)=>n+Math.max(0,Number(row.deletedCount||0)),0),
          privacy:privacyReadiness(permissionState.settings,permissionState.business,history)},
      });
    }
    // Archive and Telegram are independent reads. Do not make the first
    // message paint wait for an entire serialized archive round trip.
    let storedPromise=fastLive&&creds?.session
      ?Promise.resolve({messages:[],hasMore:false,nextOffset:archiveOffset})
      :archivedMessages(userId,chatId,archiveOffset);
    let liveMessages=[],liveMore=false,nextLive=null,chat=null,warning=null;
    // A preserved-only thread can be opened even after the chat is cleared
    // or removed from the owner's current Telegram dialog list.
    if(creds?.session && body.liveExhausted!==true){
      try{
        const fetched=await withBackupClient(creds.session,async client=>{
          await verifyTelegramClientOwner(client,userId);
          let dialogs=await client.getDialogs({limit:FAST_THREAD_DIALOGS});
          let dialog=dialogs.find(d=>safeId(d.id)===chatId);
          // Older chats still work, without scanning 500 for every common open.
          if(!dialog){
            dialogs=await client.getDialogs({limit:MAX_DIALOGS});
            dialog=dialogs.find(d=>safeId(d.id)===chatId);
          }
          if(!dialog)return {missing:true};
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
          };
        });
        if(!fetched.missing){
          chat=fetched.chat;liveMessages=fetched.messages;
          liveMore=Boolean(fetched.hasMore);
          nextLive=fetched.nextOffsetId;
        }
      }catch(error){
        const stop=telegramOwnerError(error);
        if(stop)return respond(res,stop.status,{error:stop.error});
        warning=errorMessage(error).error;
      }
    }
    // A chat that vanished from Telegram must still open its saved owner copies.
    // Falling back is mandatory even if the caller requested fast-live rendering.
    if(!chat&&fastLive){
      historyPromise=archiveThreads(userId);
      if(creds?.session)storedPromise=archivedMessages(userId,chatId,archiveOffset);
    }
    const [stored,history]=await Promise.all([storedPromise,historyPromise]);
    const threadArchive=history.find(t=>safeId(t.chatId)===chatId);
    if(!chat && threadArchive)chat=archivedDialog(threadArchive);
    if(!chat)return respond(res,404,{error:'Чат не найден в Telegram и нет ранее сохранённой копии VETO.'});
    return respond(res,200,{
      chat, messages:combineLiveAndPreserved(liveMessages,stored.messages),
      hasMore:Boolean(liveMore||stored.hasMore),liveHasMore:liveMore,
      archiveHasMore:stored.hasMore, archiveNextOffset:stored.nextOffset,
      nextOffsetId:nextLive,
      archivedMessageCount:fastLive&&chat?null:Number(threadArchive?.messageCount||0),
      deletedMessageCount:fastLive&&chat?null:Number(threadArchive?.deletedCount||0),
      archiveDeferred:Boolean(fastLive&&chat),
      warning,readOnly:!creds?.session || chat.archiveOnly===true || !SENDABLE_TYPES.includes(chat.type),
      canSend:Boolean(creds?.session && chat.archiveOnly!==true && SENDABLE_TYPES.includes(chat.type)),
      isCopy:chat.archiveOnly===true,
    });
  }catch(error){
    const e=errorMessage(error);
    return respond(res,e.status,{error:e.error});
  }
}
