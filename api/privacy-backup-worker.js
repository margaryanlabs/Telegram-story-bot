import { openJson } from '../lib/viewer-sync-crypto.js';
import { verifyEdgeSignature } from '../lib/viewer-sync-signing.js';
import {
  claimBackupJobs,completeBackupJob,getViewerSession,getPrivacySettings,
  importUserHistoryBatch,pauseBackupJob,viewerDbConfigured,
} from '../lib/viewer-sync-store.js';
import { withBackupClient,fetchBackupPage } from '../lib/telegram-history-backup.js';
import { verifyTelegramClientOwner } from '../lib/telegram-owner-runtime.js';
import { archiveHistoryMedia } from '../lib/telegram-history-media.js';

// Keep exact production verifier key aligned with the viewer watcher.
const WATCH_SIGNING_KEY='idl_pp6aznx3_qyvmQV6CI5Um0cRt2VLI9-o-raIsVc';
const MAX_JOBS=2;
const BOT=String(process.env.TELEGRAM_BOT_TOKEN||'');

function authorized(req) {
  const timestamp=String(req.headers['x-story-trigger-timestamp']||'');
  const signature=String(req.headers['x-story-trigger-signature']||'');
  const body=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
  return verifyEdgeSignature({
    publicKey:WATCH_SIGNING_KEY,timestamp,body,signature,maxAgeMs:120000,
  });
}
async function notifyCompleted(ownerId, job, total,media) {
  if(!BOT||job.notify_completion===false)return false;
  const url=new URL('https://telegram-story-bot-murex.vercel.app/studio.html');
  url.searchParams.set('screen','chats');
  url.searchParams.set('chat',String(job.chat_id));
  url.searchParams.set('v','20261016-veto-owner-proof-v3');
  const response=await fetch('https://api.telegram.org/bot'+BOT+'/sendMessage',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({
      chat_id:String(ownerId),disable_notification:false,
      text:'✅ VETO · Резервная копия готова\n\n'+String(job.chat_title||'Личный чат')
        +'\nСохранено текстовых сообщений: '+Number(total||0)
        +'\nМедиафайлов в Vault: '+Number(media||0)
        +'\n\nАрхив остаётся отдельно от Telegram согласно выбранному сроку хранения.',
      reply_markup:{inline_keyboard:[[{text:'Открыть копию',web_app:{url:url.toString()}}]]},
    }),
    signal:AbortSignal.timeout(4500),
  });
  return response.ok;
}
async function runJob(job) {
  const userId=String(job.telegram_user_id),chatId=String(job.chat_id);
  let finished=false,progress=null;
  try {
    const session=await getViewerSession(userId);
    if(!session || session.status!=='active' || String(session.telegram_account_user_id)!==userId){
      await pauseBackupJob(userId,chatId);
      return {result:'session_not_active'};
    }
    const decrypted=await openJson(session.session_ciphertext,'session:'+userId);
    if(!decrypted?.session)throw new Error('session_unavailable');
    const settings=await getPrivacySettings(userId);
    if(!settings.ghostInbox){
      await pauseBackupJob(userId,chatId);
      return {result:'private_archive_disabled'};
    }
    progress=await withBackupClient(decrypted.session,async client=>{
      await verifyTelegramClientOwner(client,userId);
      const page=await fetchBackupPage(client,{
        ownerId:userId,chatId,offsetId:job.offset_id,retentionDays:settings.retentionDays,
        mediaEnabled:job.media_enabled === true,
      });
      const result=page.rows.length?await importUserHistoryBatch(userId,chatId,page.rows):{inserted:0};
      const media=await archiveHistoryMedia(client,userId,chatId,page.mediaCandidates,{
        enabled:job.media_enabled===true,
      });
      return {
        read:page.fetched,saved:result.inserted,mediaSaved:media.saved,
        nextOffsetId:page.nextOffsetId,complete:!page.hasMore,
      };
    });
    finished=progress.complete;
    const outcome=await completeBackupJob(userId,chatId,progress);
    if(finished && outcome?.state==='done'){
      await notifyCompleted(userId,job,outcome.total_saved,outcome.total_media).catch(()=>false);
    }
    return {result:outcome?.state||'updated',complete:finished,saved:progress.saved,media:progress.mediaSaved};
  }catch(error){
    const e=String(error?.errorMessage||error?.message||'backup_failed');
    await completeBackupJob(userId,chatId,{error:/FLOOD_WAIT|429/i.test(e)?'telegram_rate_limit':'temporary_import_error'})
      .catch(()=>{});
    return {result:'retry_later'};
  }
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST required'});
  if(!viewerDbConfigured())return res.status(503).json({ok:false,error:'Telegram backend unavailable'});
  if(!authorized(req))return res.status(401).json({ok:false,error:'Unauthorized scheduled trigger'});
  try{
    const jobs=await claimBackupJobs(MAX_JOBS);
    const result=[];
    for(const job of jobs)result.push({job:'processed',...await runJob(job)});
    res.status(200).json({ok:true,claimed:jobs.length,results:result});
  }catch(error){
    res.status(503).json({ok:false,error:'Backup schedule temporarily unavailable'});
  }
}
