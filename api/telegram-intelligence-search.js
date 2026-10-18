import {Api} from 'teleproto';
import {validateTelegramMiniApp} from '../lib/telegram-miniapp-auth.js';
import {getViewerSession} from '../lib/viewer-sync-store.js';
import {sameTelegramAccount} from '../lib/telegram-session-owner.js';
import {openJson} from '../lib/viewer-sync-crypto.js';
import {withBackupClient} from '../lib/telegram-history-backup.js';
import {verifyTelegramClientOwner,telegramOwnerError} from '../lib/telegram-owner-runtime.js';
import {planSearch,mergeSearchResults,searchResultsFromTelegram} from '../lib/veto-intelligence-search.js';

const send=(res,status,data)=>res.status(status).json({ok:status<400,...data});
export function afterMonths(months,now=new Date()){
  if(!Number.isInteger(months)||months<1||months>12)return 0;
  const date=new Date(now);
  date.setUTCMonth(date.getUTCMonth()-months);
  return Math.floor(date.getTime()/1000);
}
export async function searchOwnerCloud(client,plan){
  // One authenticated owner, max two Telegram-native global searches. This is
  // NOT LLM/embedding search and never sends private text to an outside AI.
  const groups=[];
  const minDate=afterMonths(plan.months);
  for(const term of plan.terms.slice(0,2)){
    const result=await client.invoke(new Api.messages.SearchGlobal({
      q:term,filter:new Api.InputMessagesFilterEmpty(),
      minDate,maxDate:0,offsetRate:0,offsetPeer:new Api.InputPeerEmpty(),
      offsetId:0,limit:25,
    }));
    groups.push(searchResultsFromTelegram(result,term));
    // Avoid unnecessary second request when the first gives sufficient evidence.
    if(groups[0].length>=12)break;
  }
  return mergeSearchResults(groups,plan,30);
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
  const bot=String(process.env.TELEGRAM_BOT_TOKEN||'');
  if(!bot)return send(res,503,{error:'Telegram не настроен'});
  const owner=validateTelegramMiniApp(String(req.headers['x-telegram-init-data']||''),bot);
  if(!owner?.id)return send(res,401,{error:'Открой VETO в собственном Telegram'});
  let body;
  try{body=typeof req.body==='string'?JSON.parse(req.body):req.body||{}}
  catch{return send(res,400,{error:'Неверный запрос'})}
  let plan;
  try{plan=planSearch(body?.query)}
  catch(error){return send(res,error.status||400,{error:error.message})}
  const userId=String(owner.id);
  try{
    const session=await getViewerSession(userId);
    if(!session||session.status!=='active'||!session.session_ciphertext)
      return send(res,409,{error:'Сначала подключи свой Telegram'});
    if(!sameTelegramAccount(userId,session.telegram_account_user_id))
      return send(res,403,{error:'Подключён другой Telegram-аккаунт; поиск заблокирован'});
    const decrypted=await openJson(session.session_ciphertext,'session:'+userId);
    if(!decrypted?.session)return send(res,409,{error:'Сессия Telegram недоступна'});
    const results=await withBackupClient(decrypted.session,async client=>{
      await verifyTelegramClientOwner(client,userId);
      return searchOwnerCloud(client,plan);
    });
    return send(res,200,{
      results,count:results.length,terms:plan.terms,scope:'telegram-cloud',
      mode:'lexical-concept',searchedAfter:plan.months||null,
      note:'Совпадения из Telegram с исходным текстом и датой. Это поиск по словам и близким понятиям, а не AI-анализ содержания. Удалённый архив здесь не индексируется.',
    });
  }catch(error){
    const denied=telegramOwnerError(error);
    if(denied)return send(res,denied.status,{error:denied.error});
    const raw=String(error?.errorMessage||error?.message||'');
    if(/FLOOD_WAIT|SEARCH_FLOOD|429/i.test(raw))
      return send(res,429,{error:'Telegram временно ограничил поиск. Повтори позже.'});
    if(/AUTH_KEY|SESSION_REVOKED|not authorized/i.test(raw))
      return send(res,409,{error:'Сессия Telegram истекла. Подключи аккаунт снова.'});
    return send(res,503,{error:'Поиск Telegram недоступен. Попробуй повторить.'});
  }
}
