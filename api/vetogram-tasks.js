import {validateTelegramMiniApp} from '../lib/telegram-miniapp-auth.js';
import {loadTaskCloud,saveTaskCloud,eraseTaskCloud} from '../lib/vetogram-task-cloud-store.js';
const respond=(res,status,body)=>res.status(status).json({ok:status<400,...body});
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return respond(res,405,{error:'POST required'});
  const token=String(process.env.TELEGRAM_BOT_TOKEN||'');
  if(!token)return respond(res,503,{error:'Telegram не настроен'});
  const user=validateTelegramMiniApp(String(req.headers['x-telegram-init-data']||''),token);
  if(!user?.id)return respond(res,401,{error:'Нужно открыть VETOGRAM внутри Telegram'});
  if(process.env.VETOGRAM_TASKS_CLOUD_ENABLED!=='true')
    return respond(res,503,{error:'Облачные задачи ещё не включены'});
  let body;
  try{
    body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||typeof body!=='object'||Array.isArray(body)||
      JSON.stringify(body).length>46000||
      !['load','save','erase'].includes(body.action))throw Error('TASK_CLOUD_INVALID_BODY');
  }catch{return respond(res,400,{error:'Неверный запрос Task Center'})}
  try{
    if(body.action==='load')return respond(res,200,await loadTaskCloud(user.id));
    if(req.headers['x-vetogram-tasks-consent']!=='yes')
      return respond(res,403,{error:'Нужно отдельное подтверждение сохранения или удаления'});
    if(body.action==='erase')return respond(res,200,await eraseTaskCloud(user.id,body.revision));
    return respond(res,200,await saveTaskCloud(user.id,body.revision,body.tasks));
  }catch(error){
    if(/VETO_TASK_PENDING_REMINDERS/.test(error?.message||''))
      return respond(res,409,{error:'Есть ожидающие серверные напоминания. Сначала отмени их в VETO Reminders, затем повтори сохранение или удаление.'});
    if(/VETO_TASK_REVISION_CONFLICT/.test(error?.message||'')||error?.message==='TASK_CLOUD_VERSION_CONFLICT')
      return respond(res,409,{error:'Задачи изменились в другом окне. Загрузи облачную версию перед изменением.'});
    if(/^(?:TASK_CLOUD_(?:INVALID|COUNT|ITEM|DUPLICATE|TOO_LARGE|REVISION|DATE|OWNER)|TASK_INVALID|TASK_DATE_INVALID)/.test(error?.message||''))
      return respond(res,400,{error:'Неверные данные задач'});
    // No ciphertext, user IDs or keys in logs.
    return respond(res,503,{error:'Облачное хранилище задач сейчас недоступно. Локальные задачи не удалены.'});
  }
}
