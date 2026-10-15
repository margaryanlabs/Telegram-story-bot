import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { listRecoverablePrivacyMedia } from '../lib/viewer-sync-store.js';
import { archiveBusinessMediaVault } from '../lib/privacy-business.js';

const BOT=String(process.env.TELEGRAM_BOT_TOKEN||'');
function json(res,status,data){res.status(status).json({ok:status<400,...data});}

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  if(!BOT)return json(res,503,{error:'Telegram не настроен'});
  const user=validateTelegramMiniApp(String(req.headers['x-telegram-init-data']||''),BOT);
  if(!user?.id)return json(res,401,{error:'Открой VETO Telegram внутри Telegram'});
  let body={};
  try {body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};}
  catch{return json(res,400,{error:'Неверный формат запроса'});}
  const action=String(body.action||'status');
  if(!['status','recover'].includes(action))return json(res,400,{error:'Неизвестное действие'});
  if(action==='recover' && body.confirm!==true){
    return json(res,409,{error:'Подтверди повторное сохранение медиа'});
  }
  try {
    const owner=String(user.id);
    const pending=await listRecoverablePrivacyMedia(owner,action==='recover'?3:1);
    if(pending.eligible===false){
      return json(res,200,{eligible:false,pending:0,attempted:0,recovered:0,
        message:'Для резервного Media Vault включи Anti-Delete.'});
    }
    if(action==='status'){
      return json(res,200,{eligible:true,pending:Number(pending.pending||0),
        recoveryLimit:3,scope:'owner-captured-bot-media-only'});
    }

    let recovered=0,attempted=0,unavailable=0;
    const startedAt=Date.now();
    for(const media of (pending.rows||[]).slice(0,3)){
      if(Date.now()-startedAt>36000)break;
      // Owner is fixed by verified Telegram Mini App signature. The archive
      // row is supplied by signed server store, never by the client.
      if(String(media.telegram_user_id)!==owner || !media.media_file_id)continue;
      attempted++;
      const result=await archiveBusinessMediaVault(BOT,media);
      if(result?.archived) recovered++;
      else unavailable++;
    }
    return json(res,200,{eligible:true,pending:Number(pending.pending||0),
      attempted,recovered,unavailable,
      remainingEstimate:Math.max(0,Number(pending.pending||0)-recovered),
      message:unavailable
        ? 'Часть Telegram-файлов уже недоступна. Ранее сохранённый текст VETO не затронут.'
        : 'Резервные копии доступных вложений сохранены в защищённом Media Vault.',
      scope:'owner-captured-bot-media-only'});
  } catch(error) {
    // No file_ids, tokens, private message texts or storage paths in responses.
    console.warn('Privacy vault repair unavailable',{
      kind:error?.name==='AbortError'?'timeout':'store_or_telegram',
    });
    return json(res,503,{error:'Проверка медиа временно недоступна. Попробуй ещё раз.'});
  }
}
