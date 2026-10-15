import { openJson } from '../lib/viewer-sync-crypto.js';
import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { getViewerSession, getPrivacySettings, updatePrivacySettings, importUserHistoryBatch, saveBackupJob, listBackupJobs, pauseBackupJob } from '../lib/viewer-sync-store.js';
import { withBackupClient, listBackupDialogs, fetchBackupPage } from '../lib/telegram-history-backup.js';
import { archiveHistoryMedia } from '../lib/telegram-history-media.js';

const BOT = String(process.env.TELEGRAM_BOT_TOKEN || '');

function respond(res, code, data) {
  res.status(code).json({ ok:code >= 200 && code < 300, ...data });
}

async function sendBackupNotice(userId, chatId, title, count) {
  if (!BOT) return false;
  const url = new URL('https://telegram-story-bot-murex.vercel.app/studio.html');
  url.searchParams.set('screen', 'chats');
  url.searchParams.set('filter', 'all');
  url.searchParams.set('chat', chatId);
  url.searchParams.set('v', '20261015-veto-backup-media-v1');
  const response = await fetch('https://api.telegram.org/bot'+BOT+'/sendMessage', {
    method:'POST',
    headers:{ 'content-type':'application/json' },
    body:JSON.stringify({
      chat_id:userId,
      text:'✅ VETO · Копирование диалога завершено\n\n'+title
        +'\nСохранено новых сообщений в последней части: '+count
        +'\n\nКопия хранится в VETO Inbox согласно выбранному сроку хранения. Удаление чата в Telegram не удаляет эту копию. Медиа из старой истории могут быть доступны только как отметки.',
      disable_notification:false,
      reply_markup:{ inline_keyboard:[[{ text:'Открыть сохранённый чат',web_app:{url:url.toString()} }]] },
    }),
  });
  return response.ok;
}

function safeError(error) {
  const raw = String(error?.errorMessage || error?.message || '');
  if (/FLOOD_WAIT|429|Too Many Requests/i.test(raw)) return [429,'Telegram временно ограничил частые запросы. Попробуй позже.'];
  if (/AUTH_KEY|SESSION_REVOKED|not authorized/i.test(raw)) return [409,'Telegram-сессия истекла. Подключи аккаунт заново.'];
  if (/timed out|timeout|ETIMEDOUT/i.test(raw)) return [504,'Telegram отвечает слишком долго. Повтори этот шаг позже.'];
  return [503,'Не удалось загрузить историю. Проверь подключение Telegram и повтори попытку.'];
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method !== 'POST') return respond(res,405,{error:'Method not allowed'});
  if(!BOT) return respond(res,503,{error:'Telegram не настроен'});
  const user=validateTelegramMiniApp(String(req.headers['x-telegram-init-data'] || ''),BOT);
  if(!user?.id) return respond(res,401,{error:'Открой VETO Telegram внутри Telegram'});
  const userId=String(user.id);
  const body=typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const action=String(body.action || '');
  if(!['list_chats','backup_chat','background_enable','background_pause','background_status'].includes(action)) return respond(res,400,{error:'Неизвестное действие'});
  try {
    // Revocation must remain possible even when the MTProto session has
    // expired or the user deliberately disconnected their Telegram account.
    if(action === 'background_status') {
      const jobs=await listBackupJobs(userId);
      return respond(res,200,{jobs,worker:'scheduled',optInOnly:true});
    }
    if(action === 'background_pause') {
      const chatId=String(body.chatId || '');
      if(!/^\d{1,19}$/.test(chatId)) return respond(res,400,{error:'Неверный ID переписки'});
      const job=await pauseBackupJob(userId,chatId);
      return respond(res,200,{job});
    }
    const session=await getViewerSession(userId);
    if(!session || session.status !== 'active' || !session.session_ciphertext) {
      return respond(res,409,{error:'Сначала подключи собственный Telegram-аккаунт через номер и код в VETO.'});
    }
    // A logged-in Mini App user can archive only their own linked Telegram account.
    if(String(session.telegram_account_user_id || '') !== userId) {
      return respond(res,403,{error:'Для резервной копии войди в Telegram через свой аккаунт.'});
    }
    const decrypted=await openJson(session.session_ciphertext, 'session:'+userId);
    if(!decrypted?.session) throw new Error('SESSION_REVOKED');

    if(action === 'list_chats') {
      const chats=await withBackupClient(decrypted.session,client=>listBackupDialogs(client));
      return respond(res,200,{chats,scope:'private-dialogs-only',requiresSelection:true});
    }
    if(action === 'background_enable') {
      if(body.confirm !== true || body.backgroundConsent !== true)
        return respond(res,409,{error:'Нужно отдельное согласие на фоновое хранение переписки.'});
      const chatId=String(body.chatId || '');
      if(!/^\d{1,19}$/.test(chatId)) return respond(res,400,{error:'Неверный ID переписки'});
      // Check membership and eligible personal chat before storing consent.
      const dialogs=await withBackupClient(decrypted.session,client=>listBackupDialogs(client));
      const chat=dialogs.find(c=>String(c.chatId)===chatId);
      if(!chat) return respond(res,403,{error:'Можно подключать только свои обычные личные переписки'});
      const settings=await getPrivacySettings(userId);
      if(!settings.ghostInbox) await updatePrivacySettings(userId,{ghostInbox:true});
      const job=await saveBackupJob(userId,chatId,chat.title,body.mediaEnabled === true,body.notifyCompletion !== false);
      return respond(res,200,{job,backgroundEnabled:true,
        note:'Фоновое сохранение только выбранной переписки, пока опция включена.'});
    }
    if(body.confirm !== true) return respond(res,409,{error:'Подтверди копирование выбранного чата в VETO.'});
    const chatId=String(body.chatId || '');
    if(!/^\d{1,19}$/.test(chatId)) return respond(res,400,{error:'Выбери личный диалог из списка'});
    let settings=await getPrivacySettings(userId);
    // Consent to backup explicitly enables the private VETO Inbox for this user,
    // without silently enabling Business chat access or deletion notifications.
    if(!settings.ghostInbox) settings=await updatePrivacySettings(userId,{ghostInbox:true});
    const includeMedia = body.includeMedia === true;
    const {page,result,media} = await withBackupClient(decrypted.session, async client => {
      const page=await fetchBackupPage(client,{
        ownerId:userId,chatId,offsetId:body.offsetId,retentionDays:settings.retentionDays,
        mediaEnabled:includeMedia,
      });
      const result=page.rows.length
        ? await importUserHistoryBatch(userId,chatId,page.rows)
        : {inserted:0,accepted:0};
      const media=await archiveHistoryMedia(client,userId,chatId,page.mediaCandidates,{
        enabled:includeMedia,
      });
      return {page,result,media};
    });
    let alerted=false;
    if(!page.hasMore && body.notifyCompletion !== false) {
      alerted=await sendBackupNotice(userId,chatId,page.chatTitle,result.inserted).catch(()=>false);
    }
    return respond(res,200,{
      chatId, chatTitle:page.chatTitle,
      fetched:page.fetched,eligible:page.eligible,
      saved:result.inserted,mediaSaved:media.saved,mediaAttempted:media.attempted,
      hasMore:page.hasMore,nextOffsetId:page.nextOffsetId,
      olderThanRetention:page.olderThanRetention,
      retentionDays:settings.retentionDays,
      notified:alerted,
      mediaScope:includeMedia ? 'bounded-private-media-vault' : 'metadata-only',
    });
  } catch(error) {
    // Never disclose MTProto session details, phone numbers or message bodies.
    const [status,message]=safeError(error);
    return respond(res,status,{error:message});
  }
}
