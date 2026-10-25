import {validateTelegramMiniApp} from '../lib/telegram-miniapp-auth.js';
import {issueAiDraftGrant,getAiDraftGrant,revokeAiDraftGrant} from '../lib/vetogram-ai-grants.js';
const send=(res,status,body)=>res.status(status).json({ok:status<400,...body});
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return send(res,405,{error:'POST required'});
  const token=String(process.env.TELEGRAM_BOT_TOKEN||'');
  if(!token)return send(res,503,{error:'Telegram не настроен'});
  const owner=validateTelegramMiniApp(String(req.headers['x-telegram-init-data']||''),token);
  if(!owner?.id)return send(res,401,{error:'Войди через Telegram'});
  if(process.env.VETOGRAM_AI_GRANTS_ENABLED!=='true')
    return send(res,503,{error:'Разрешения AI пока не включены'});
  let input;
  try{
    input=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!input||typeof input!=='object'||Array.isArray(input)||JSON.stringify(input).length>2000)
      throw Error('INVALID_INPUT');
    if(!['issue','status','revoke'].includes(input.action))throw Error('INVALID_ACTION');
  }catch{return send(res,400,{error:'Некорректный запрос разрешений'})}
  try{
    if(input.action==='status'){
      const grant=await getAiDraftGrant(owner.id);
      return send(res,200,{grant});
    }
    if(req.headers['x-vetogram-grant-consent']!=='yes')
      return send(res,403,{error:'Требуется явное согласие владельца'});
    if(input.action==='issue'){
      const grant=await issueAiDraftGrant(owner.id,{
        chatId:input.chatId,currency:input.currency,minPrice:input.minPrice,
        askingPrice:input.askingPrice,maxDiscountPct:input.maxDiscountPct,
        minutes:input.minutes
      });
      return send(res,200,{grant});
    }
    const outcome=await revokeAiDraftGrant(owner.id,input.grantId);
    return send(res,200,outcome);
  }catch(error){
    if(String(error?.message||'').includes('INVALID')||
       String(error?.message||'').includes('NEGOTIATOR_'))
      return send(res,400,{error:'Неверные параметры разрешения'});
    return send(res,503,{error:'Сервер разрешений недоступен. AI не получил дополнительных прав.'});
  }
}
