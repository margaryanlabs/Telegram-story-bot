import {validateTelegramMiniApp} from '../lib/telegram-miniapp-auth.js';
import {readAiMemory,saveAiMemory,eraseAiMemory} from '../lib/vetogram-ai-memory-store.js';
const respond=(res,status,body)=>res.status(status).json({ok:status<400,...body});
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return respond(res,405,{error:'POST required'});
  const token=String(process.env.TELEGRAM_BOT_TOKEN||'');
  if(!token)return respond(res,503,{error:'Telegram не настроен'});
  const identity=validateTelegramMiniApp(String(req.headers['x-telegram-init-data']||''),token);
  if(!identity?.id)return respond(res,401,{error:'Открой VETOGRAM через Telegram'});
  if(process.env.VETOGRAM_AI_MEMORY_ENABLED!=='true')
    return respond(res,503,{error:'Защищённая AI Memory пока не включена'});
  let body;
  try{
    body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||typeof body!=='object'||Array.isArray(body)||
      JSON.stringify(body).length>12000)throw Error('INVALID_BODY');
    if(!['list','replace','erase'].includes(body.action))throw Error('INVALID_ACTION');
  }catch{return respond(res,400,{error:'Неверный запрос AI Memory'})}
  try{
    if(body.action==='list'){
      // Explicit request only. Not loaded into an AI prompt automatically.
      return respond(res,200,await readAiMemory(identity.id));
    }
    if(req.headers['x-vetogram-memory-consent']!=='yes')
      return respond(res,403,{error:'Требуется отдельное разрешение на сохранение заметок'});
    if(body.action==='erase')return respond(res,200,await eraseAiMemory(identity.id,body.revision));
    return respond(res,200,await saveAiMemory(identity.id,body.revision,body.notes));
  }catch(error){
    if(error?.message==='AI_MEMORY_VERSION_CONFLICT')
      return respond(res,409,{error:'Заметки изменились в другом окне. Сначала загрузите их заново.'});
    if(String(error?.message||'').startsWith('AI_MEMORY_ITEM')||
       String(error?.message||'').endsWith('_INVALID'))
      return respond(res,400,{error:'Неверные данные AI Memory'});
    // Never log content, encryption keys, or identities.
    return respond(res,503,{error:'AI Memory сейчас недоступна. Локальные заметки не удалены.'});
  }
}
