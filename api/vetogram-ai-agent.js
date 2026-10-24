import {validateTelegramMiniApp} from '../lib/telegram-miniapp-auth.js';
import {getAiAgentStatus,setAiAgentPause,listAiAgentEvents} from '../lib/vetogram-ai-agent-control.js';
const respond=(res,code,data)=>res.status(code).json({ok:code<400,...data});
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return respond(res,405,{error:'POST required'});
  const token=String(process.env.TELEGRAM_BOT_TOKEN||'');
  if(!token)return respond(res,503,{error:'Telegram не настроен'});
  const authenticated=validateTelegramMiniApp(String(req.headers['x-telegram-init-data']||''),token);
  if(!authenticated?.id)return respond(res,401,{error:'Открой VETOGRAM в Telegram'});
  if(process.env.VETOGRAM_AI_GRANTS_ENABLED!=='true')
    return respond(res,503,{error:'Управление разрешениями пока выключено'});
  let body;
  try{
    body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||typeof body!=='object'||Array.isArray(body)||
        JSON.stringify(body).length>300||!['status','history','pause','resume'].includes(body.action))
      throw Error('INVALID_AGENT_REQUEST');
  }catch{return respond(res,400,{error:'Неверный запрос'})}
  try{
    if(body.action==='status')return respond(res,200,await getAiAgentStatus(authenticated.id));
    if(body.action==='history')return respond(res,200,{events:await listAiAgentEvents(authenticated.id)});
    if(req.headers['x-vetogram-agent-consent']!=='yes')
      return respond(res,403,{error:'Подтверди изменение разрешений'});
    return respond(res,200,await setAiAgentPause(authenticated.id,body.action==='pause'));
  }catch{
    // Do not expose DB details, Telegram owner ids, or signed auth data.
    return respond(res,503,{error:'Управление AI недоступно. Изменение не подтверждено.'});
  }
}
