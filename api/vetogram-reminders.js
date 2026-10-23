import {validateTelegramMiniApp} from '../lib/telegram-miniapp-auth.js';
import {listOwnerReminders,scheduleOwnerReminder,cancelOwnerReminder,cancelAllOwnerPendingReminders} from '../lib/vetogram-reminder-store.js';
const respond=(res,status,data)=>res.status(status).json({ok:status<400,...data});
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return respond(res,405,{error:'POST required'});
  const token=String(process.env.TELEGRAM_BOT_TOKEN||'');
  if(!token)return respond(res,503,{error:'Telegram не настроен'});
  const owner=validateTelegramMiniApp(String(req.headers['x-telegram-init-data']||''),token);
  if(!owner?.id)return respond(res,401,{error:'Открой VETOGRAM внутри Telegram'});
  if(process.env.VETOGRAM_REMINDERS_ENABLED!=='true')
    return respond(res,503,{error:'Напоминания VETOGRAM ещё не включены'});
  let body;
  try{
    body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||typeof body!=='object'||Array.isArray(body)||
      JSON.stringify(body).length>1200||
      !['list','schedule','cancel','cancel_all'].includes(body.action))throw Error('INVALID_BODY');
  }catch{return respond(res,400,{error:'Неверный запрос напоминаний'})}
  try{
    if(body.action==='list')return respond(res,200,await listOwnerReminders(owner.id));
    if(req.headers['x-vetogram-reminder-consent']!=='yes')
      return respond(res,403,{error:'Нужно явное разрешение на создание или отмену уведомления'});
    if(body.action==='schedule')return respond(res,200,await scheduleOwnerReminder(owner.id,body));
    if(body.action==='cancel_all')return respond(res,200,await cancelAllOwnerPendingReminders(owner.id));
    const result=await cancelOwnerReminder(owner.id,body.taskId);
    if(!result.canceled)return respond(res,409,{
      error:'Напоминание уже отправлено, обрабатывается или не существует'});
    return respond(res,200,result);
  }catch(error){
    if(/VETO_REMINDER_(?:LIMIT|ALREADY_ATTEMPTED)/.test(error?.message||''))
      return respond(res,409,{error:'Достигнут лимит или отправка уже выполнялась'});
    if(error?.message==='REMINDER_UNSAVED_TASK_CHANGES')
      return respond(res,409,{error:'Срок задачи изменился. Сначала сохрани облачную копию.'});
    if(/REMINDER_(?:TASK|TIME|ZONE|AFTER|OWNER|STATUS)/.test(error?.message||''))
      return respond(res,400,{error:'Неверный срок, задача или часовой пояс'});
    return respond(res,503,{error:'Напоминания недоступны. Проверь соединение и облачную копию задач.'});
  }
}
