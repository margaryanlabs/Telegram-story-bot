import {Api} from 'teleproto';
import {validateTelegramMiniApp} from '../lib/telegram-miniapp-auth.js';
import {getViewerSession,listPrivacyThreads,listPrivacyMessages} from '../lib/viewer-sync-store.js';
import {sameTelegramAccount} from '../lib/telegram-session-owner.js';
import {openJson} from '../lib/viewer-sync-crypto.js';
import {withBackupClient} from '../lib/telegram-history-backup.js';
import {verifyTelegramClientOwner,telegramOwnerError} from '../lib/telegram-owner-runtime.js';
import {planSearch,mergeSearchResults,searchResultsFromTelegram} from '../lib/veto-intelligence-search.js';
import {
 prioritizeArchiveThreads,normalizeOwnerArchive,mergeEvidence,evidenceTimeline
} from '../lib/veto-evidence-timeline.js';

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


export const VAULT_MAX_CHATS=6;
export const VAULT_MESSAGES_PER_CHAT=60;
// Owner-scoped, limited sample of newest saved chats. Never imply full
// archive coverage or silently turn store failures into "no evidence".
export async function searchOwnerVault(userId,plan){
  const data=await listPrivacyThreads(userId);
  if(!data||!Array.isArray(data.threads))
    throw new Error('Не удалось получить список сохранённых чатов');
  const allThreads=data.threads.filter(row=>Number(row?.messageCount||0)>0);
  const picked=prioritizeArchiveThreads(allThreads,VAULT_MAX_CHATS);
  const minMs=plan.months?afterMonths(plan.months)*1000:0;
  const found=[],failed=[];
  let pointer=0;
  async function worker(){
    while(pointer<picked.length){
      const thread=picked[pointer++];
      try{
        const reply=await listPrivacyMessages(userId,String(thread.chatId),VAULT_MESSAGES_PER_CHAT,0);
        if(!reply||!Array.isArray(reply.messages))throw new Error('Архив ответил некорректно');
        for(const row of reply.messages){
          const evidence=normalizeOwnerArchive(row,thread,plan,minMs);
          if(evidence)found.push(evidence);
        }
      }catch{failed.push(String(thread.chatId))}
    }
  }
  // At most three concurrent bounded store calls, never unbounded per-chat
  // crawling or plaintext search indexing.
  await Promise.all([worker(),worker(),worker()]);
  return {
    results:found,scannedChats:picked.length,availableChats:allThreads.length,
    perChatLimit:VAULT_MESSAGES_PER_CHAT,
    partial:failed.length>0||picked.length<allThreads.length||
      picked.some(row=>Number(row.messageCount||0)>VAULT_MESSAGES_PER_CHAT),
    failedChats:failed.length,
  };
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
    const includeVault=body?.includeVault===true;
    const searched=await withBackupClient(decrypted.session,async client=>{
      await verifyTelegramClientOwner(client,userId);
      const requests=[
        searchOwnerCloud(client,plan),
        includeVault?searchOwnerVault(userId,plan):Promise.resolve(null),
      ];
      const settled=await Promise.allSettled(requests);
      return {cloud:settled[0],vault:settled[1]};
    });
    const cloudOk=searched.cloud.status==='fulfilled';
    const vaultOk=!includeVault||searched.vault.status==='fulfilled';
    if(!cloudOk&&!vaultOk)throw new Error('telegram_cloud_and_vault_unavailable');
    const cloud=cloudOk?searched.cloud.value:[];
    const vault=includeVault&&vaultOk?searched.vault.value:null;
    const results=mergeEvidence(cloud,vault?.results||[],plan,30);
    const timeline=evidenceTimeline(results,plan);
    return send(res,200,{
      results,timeline,count:results.length,terms:plan.terms,
      scope:includeVault?'telegram-cloud+owner-vault':'telegram-cloud',
      mode:'lexical-concept+evidence-timeline',searchedAfter:plan.months||null,
      coverage:{
        telegramCloud:cloudOk?'searched':'unavailable',
        vault:!includeVault?'not-requested':vaultOk?'sampled':'unavailable',
        chatsScanned:vault?.scannedChats||0,
        chatsAvailable:vault?.availableChats||0,
        perChatLimit:vault?.perChatLimit||0,
        partial:Boolean((includeVault&&!vaultOk)||vault?.partial||!cloudOk),
        failedVaultChats:vault?.failedChats||0,
      },
      note:'Только исходные тексты, не подтверждённые обязательства. Архив VETO просматривается лишь по выбору, ограниченно: до 6 недавних сохранённых чатов и 60 сообщений из каждого. Отсутствие совпадений не доказывает отсутствие переписки.',
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
