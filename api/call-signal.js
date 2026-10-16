import {validateTelegramMiniApp} from '../lib/telegram-miniapp-auth.js';
import {createCallRoom,inspectCallRoom,answerCallRoom,pollCallRoom,endCallRoom}
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
  if(!['create','inspect','answer','poll','end','ice'].includes(action))
    return reply(res,400,{error:'Неизвестная операция'});
  try{
    if(action==='ice'){
      // Authenticated access only. TURN shared secret never leaves Vercel.
      return reply(res,200,createIceConfig({secret:process.env.VETO_TURN_SECRET,
        turnUrls:process.env.VETO_TURN_URLS}));
    }
    if(action==='create'){
      const offer=checkCallDescription(body.sdp,'offer');
      const room=newCallInvite();
      const stored=await createCallRoom(userId,room.roomId,room.tokenHash,offer);
      const botUsername=await resolveBotUsername();
      const shareUrl=botUsername?makeCallInviteUrl(botUsername,room.invite):null;
      return reply(res,200,{invite:room.invite,shareUrl,roomId:room.roomId,
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
    if(/^(INVALID_|call_bad_)/.test(reason))return reply(res,400,{error:'Неверные параметры звонка'});
    // Suppress sensitive SDP and storage details in user-visible errors.
    return reply(res,503,{error:'Сигнальный сервер недоступен. Ручной режим остаётся доступен.'});
  }
}
