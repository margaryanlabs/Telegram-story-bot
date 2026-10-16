import {validateTelegramMiniApp} from '../lib/telegram-miniapp-auth.js';
import {probeCallStore,getCallPreferences,setCallPreferences,createCallRoom,inspectCallRoom,answerCallRoom,pollCallRoom,endCallRoom}
  from '../lib/veto-call-signal-store.js';
import {newCallInvite,parseCallInvite,checkCallDescription,checkCallRoom}
  from '../lib/veto-call-signals.js';
import {createIceConfig} from '../lib/veto-call-ice.js';
import {makeCallInviteUrl} from '../lib/veto-call-invite-link.js';

const BOT=String(process.env.TELEGRAM_BOT_TOKEN||'');
let botNameCache='';
async function resolveBotUsername(){
  const configured=String(process.env.TELEGRAM_BOT_USERNAME||'').trim().replace(/^@/,'');
  if(/^[A-Za-z0-9_]{5,32}$/.test(configured))return configured;
  if(botNameCache)return botNameCache;
  // Best-effort: failing to obtain a public bot username must not break Calls.
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),1800);
  try{
    const result=await fetch('https://api.telegram.org/bot'+BOT+'/getMe',{
      signal:controller.signal,cache:'no-store',
    });
    if(!result.ok)return '';
    const info=await result.json();
    const name=String(info?.result?.username||'');
    if(info?.ok&&/^[A-Za-z0-9_]{5,32}$/.test(name)){
      botNameCache=name;
      return name;
    }
  }catch{}finally{clearTimeout(timer);}
  return '';
}
// Bot push only to an account that explicitly enabled incoming call alerts
// through their signed Mini App identity (enforced atomically by Edge).
// No Telegram username search, arbitrary chat spam or raw SDP in messages.
async function deliverCallAlert(recipientId,shareUrl){
  if(!/^[1-9][0-9]{0,15}$/.test(String(recipientId))||
    !String(shareUrl||'').startsWith('https://t.me/'))return false;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),4500);
  try{
    const response=await fetch('https://api.telegram.org/bot'+BOT+'/sendMessage',{
      method:'POST',signal:controller.signal,
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        chat_id:recipientId,
        text:'📞 VETO Calls — тебе поступило приглашение на аудиозвонок. Ссылка действует около 8 минут. Открывай только если ожидаешь звонок.',
        disable_web_page_preview:true,protect_content:true,
        reply_markup:{inline_keyboard:[[{text:'↗ Открыть VETO Calls',url:shareUrl}]]},
      }),
    });
    const result=await response.json().catch(()=>({}));
    return response.ok&&result.ok===true;
  }catch{return false;}
  finally{clearTimeout(timeout);}
}
function reply(res,status,data){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  return res.status(status).json({ok:status<400,...data});
}
export default async function handler(req,res){
  if(req.method!=='POST')return reply(res,405,{error:'Метод недоступен'});
  if(!BOT)return reply(res,503,{error:'Сервис вызовов не настроен'});
  const user=validateTelegramMiniApp(String(req.headers['x-telegram-init-data']||''),BOT,3600);
  if(!user?.id)return reply(res,401,{error:'Открой VETO Calls внутри своего Telegram'});
  const userId=String(user.id);
  let body;
  try{
    body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
    if(!body||typeof body!=='object'||JSON.stringify(body).length>65000)
      return reply(res,413,{error:'Слишком большой запрос'});
  }catch{return reply(res,400,{error:'Неверный формат'});}
  const action=String(body.action||'');
  if(!['create','inspect','answer','poll','end','ice','probe','preferences_get','preferences_set'].includes(action))
    return reply(res,400,{error:'Неизвестная операция'});
  try{
    if(action==='preferences_get'){
      const prefs=await getCallPreferences(userId);
      return reply(res,200,{notificationsEnabled:prefs.notificationsEnabled===true,
        myCallId:userId});
    }
    if(action==='preferences_set'){
      if(typeof body.enabled!=='boolean')return reply(res,400,{error:'Нужно явно включить или отключить приглашения'});
      const prefs=await setCallPreferences(userId,body.enabled);
      return reply(res,200,{notificationsEnabled:prefs.notificationsEnabled===true,
        myCallId:userId});
    }
    if(action==='probe'){
      // Browser cannot call Supabase directly; both Telegram HMAC and
      // Ed25519 Vercel->Edge signature are required before DB access.
      const verified=await probeCallStore();
      return reply(res,200,{signaling:verified.signaling,
        database:verified.database,retentionMinutes:verified.retentionMinutes});
    }
    if(action==='ice'){
      // Authenticated access only. TURN shared secret never leaves Vercel.
      return reply(res,200,createIceConfig({secret:process.env.VETO_TURN_SECRET,
        turnUrls:process.env.VETO_TURN_URLS}));
    }
    if(action==='create'){
      const offer=checkCallDescription(body.sdp,'offer');
      // Recipient IDs may only be specified explicitly by the caller.
      // Edge verifies that the recipient previously opted in and atomically
      // limits new alerts to one per three minutes.
      const recipientId=body.recipientId==null||String(body.recipientId).trim()===''
        ?null:String(body.recipientId).trim();
      if(recipientId!==null&&!/^[1-9][0-9]{0,15}$/.test(recipientId))
        return reply(res,400,{error:'Неверный Telegram ID собеседника'});
      if(recipientId===userId)return reply(res,400,{error:'Нельзя позвонить самому себе'});
      const room=newCallInvite();
      const stored=await createCallRoom(userId,room.roomId,room.tokenHash,offer,recipientId);
      const botUsername=await resolveBotUsername();
      const shareUrl=botUsername?makeCallInviteUrl(botUsername,room.invite):null;
      const notificationSent=recipientId&&shareUrl
        ?await deliverCallAlert(recipientId,shareUrl):false;
      return reply(res,200,{invite:room.invite,shareUrl,roomId:room.roomId,
        notificationSent:Boolean(notificationSent),
        expiresAt:stored.expiresAt,scope:'temporary-peer-to-peer-sdp'});
    }
    if(action==='inspect'){
      const invite=parseCallInvite(body.invite);
      const data=await inspectCallRoom(userId,invite.roomId,invite.tokenHash);
      return reply(res,200,{roomId:data.roomId,offerSdp:data.offerSdp,
        callerId:data.callerId,expiresAt:data.expiresAt});
    }
    if(action==='answer'){
      const invite=parseCallInvite(body.invite);
      const answer=checkCallDescription(body.sdp,'answer');
      const data=await answerCallRoom(userId,invite.roomId,invite.tokenHash,answer);
      return reply(res,200,{roomId:data.roomId,callerId:data.callerId,status:'answered'});
    }
    const roomId=checkCallRoom(body.roomId);
    if(action==='poll'){
      const data=await pollCallRoom(userId,roomId);
      return reply(res,200,data.status==='answered'
        ?{status:'answered',answerSdp:data.answerSdp,calleeId:data.calleeId}
        :{status:data.status});
    }
    const data=await endCallRoom(userId,roomId);
    return reply(res,200,{closed:Boolean(data.closed)});
  }catch(error){
    const reason=String(error?.message||'');
    if(reason==='call_room_limit')return reply(res,429,{error:'Уже есть 3 открытых вызова. Заверши старые вызовы.'});
    if(reason==='call_invite_unavailable')
      return reply(res,410,{error:'Приглашение недействительно, использовано или истекло'});
    if(reason==='call_access_denied')return reply(res,403,{error:'Это не твой вызов'});
    if(reason==='call_recipient_unavailable')
      return reply(res,410,{error:'Собеседник не разрешил входящие VETO Calls или недавно получал приглашение'});
    if(/^(INVALID_|call_bad_)/.test(reason))return reply(res,400,{error:'Неверные параметры звонка'});
    // Suppress sensitive SDP and storage details in user-visible errors.
    return reply(res,503,{error:'Сигнальный сервер недоступен. Ручной режим остаётся доступен.'});
  }
}
