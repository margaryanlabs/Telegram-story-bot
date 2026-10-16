import {validateTelegramMiniApp} from '../lib/telegram-miniapp-auth.js';
import {createCallRoom,inspectCallRoom,answerCallRoom,pollCallRoom,endCallRoom}
  from '../lib/veto-call-signal-store.js';
import {newCallInvite,parseCallInvite,checkCallDescription,checkCallRoom}
  from '../lib/veto-call-signals.js';

const BOT=String(process.env.TELEGRAM_BOT_TOKEN||'');
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
  if(!['create','inspect','answer','poll','end'].includes(action))
    return reply(res,400,{error:'Неизвестная операция'});
  try{
    if(action==='create'){
      const offer=checkCallDescription(body.sdp,'offer');
      const room=newCallInvite();
      const stored=await createCallRoom(userId,room.roomId,room.tokenHash,offer);
      return reply(res,200,{invite:room.invite,roomId:room.roomId,expiresAt:stored.expiresAt,
        scope:'temporary-peer-to-peer-sdp',callerId:userId});
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
