import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { getViewerSession, updatePrivacySettings } from '../lib/viewer-sync-store.js';
import { sameTelegramAccount } from '../lib/telegram-session-owner.js';
import { openJson } from '../lib/viewer-sync-crypto.js';
import { verifyTelegramClientOwner, telegramOwnerError } from '../lib/telegram-owner-runtime.js';
import { withBackupClient, listBackupDialogs } from '../lib/telegram-history-backup.js';
import { readBusinessConsentState, connectBusinessSelectedChats,
  assertBusinessConnectionAvailable, connectBusinessAllPrivateChats, CONSENT_APPROVAL, BUSINESS_BOT_USERNAME } from '../lib/telegram-business-consent.js';

const BOT = String(process.env.TELEGRAM_BOT_TOKEN || '');
const json = (res, code, body) => res.status(code).json({ ok:code >= 200 && code < 300, ...body });

function safeFailure(error) {
  const owner = telegramOwnerError(error);
  if (owner) return owner;
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599) {
    return { status:error.status,error:String(error.message).slice(0,280) };
  }
  const message = String(error?.errorMessage || error?.message || '');
  if (/FLOOD_WAIT|TOO_MANY|429/i.test(message))
    return { status:429,error:'Telegram ограничил частые подключения. Повтори позже.' };
  if (/AUTH_KEY|SESSION_REVOKED|SESSION_EXPIRED|not authorized/i.test(message))
    return { status:409,error:'Сессия Telegram истекла. Подключи свой аккаунт заново.' };
  if (/BOT_BUSINESS_MISSING/i.test(message))
    return { status:409,error:`Для @${BUSINESS_BOT_USERNAME} необходимо включить Business Mode в BotFather.` };
  if (/BUSINESS_RECIPIENTS_EMPTY/i.test(message))
    return { status:400,error:'Нужно выбрать хотя бы один личный чат.' };
  if (/TIMEOUT|timed out|ETIMEDOUT/i.test(message))
    return { status:504,error:'Telegram не ответил. Проверь состояние в настройках перед повторным подключением.' };
  return { status:503,error:'Не удалось подтвердить Business-подключение. Проверь Telegram и попробуй снова.' };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if (req.method !== 'POST') return json(res,405,{error:'Method not allowed'});
  if (!BOT) return json(res,503,{error:'Vetogram Telegram не настроен'});
  const owner = validateTelegramMiniApp(String(req.headers['x-telegram-init-data'] || ''),BOT);
  if (!owner?.id) return json(res,401,{error:'Открой Vetogram внутри своего Telegram'});
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; }
  catch { return json(res,400,{error:'Некорректный запрос'}); }
  const action = String(body.action || '');
  if (!['prepare','connect'].includes(action)) return json(res,400,{error:'Unknown action'});
  // Never auto-enable a Business connection: a fresh explicit selection
  // and exact approval marker are mandatory, and all selected peers are
  // resolved again from the same authenticated user's live MTProto session.
  if (action === 'connect' && (body.consent !== true || body.approval !== CONSENT_APPROVAL)) {
    return json(res,409,{error:'Подтверди подключение выбранных личных переписок.'});
  }
  const ownerId = String(owner.id);
  try {
    const session = await getViewerSession(ownerId);
    if (!session?.session_ciphertext || session.status !== 'active') {
      return json(res,409,{needsSession:true,error:'Сначала подключи свой Telegram через номер + код или QR в Vetogram.'});
    }
    if (!sameTelegramAccount(ownerId,session.telegram_account_user_id)) {
      return json(res,403,{error:'Эта сессия принадлежит другому Telegram-аккаунту. Подключение заблокировано.'});
    }
    const decrypted = await openJson(session.session_ciphertext,'session:'+ownerId);
    if (!decrypted?.session) return json(res,409,{needsSession:true,error:'Сессия Telegram отсутствует. Подключи аккаунт заново.'});

    if (action === 'prepare') {
      const info = await withBackupClient(decrypted.session,async client => {
        await verifyTelegramClientOwner(client,ownerId);
        const { status } = await readBusinessConsentState(client);
        const chats = status.state === 'none' ? await listBackupDialogs(client) : [];
        return { status,chats };
      });
      return json(res,200,{
        state:info.status.state,
        connectedBot:info.status.connectedBot,
        recipients:info.status.recipients,
        chats:info.chats.slice(0,55),
        allowConnect:info.status.state === 'none' && info.chats.length > 0,
        noReplaceOtherBot:true,scope:'selected-private-chats-only',
        permissions:{reply:false,readMessages:false,deleteMessages:false,manageStories:false},
      });
    }

    const allPrivate = body.scope === 'all-private';
    if (allPrivate && body.allChatsConsent !== true) return json(res,409,{error:'Разрешение на все существующие и будущие личные чаты требует отдельного подтверждения.'});
    if (!allPrivate && (!Array.isArray(body.chatIds) || body.chatIds.length < 1 || body.chatIds.length > 12)) {
      return json(res,400,{error:'Выбери от 1 до 12 личных переписок.'});
    }
    // Don't retry a write automatically after timeout. Re-run prepare first.
    const result = await withBackupClient(decrypted.session,async client => {
      await verifyTelegramClientOwner(client,ownerId);
      return allPrivate
        ? connectBusinessAllPrivateChats(client)
        : connectBusinessSelectedChats(client,body.chatIds);
    });
    // This was an explicit opt-in for an automatic archive: configure only the
    // minimal server-side retention and archive switches for this owner.
    let settingsUpdated = false;
    try {
      await updatePrivacySettings(ownerId,{ antiDelete:true,editHistory:true,ghostInbox:true });
      settingsUpdated = true;
    } catch {
      // The Business connection cannot safely be rolled back on store failure.
      // Surface partial completion and allow the user to enable privacy switches manually.
    }
    return json(res,200,{
      ...result,
      scope:allPrivate ? 'all-current-and-future-private' : 'selected-private',
      settingsUpdated,
      note:settingsUpdated
        ? 'Telegram принял подключение. Отправь тестовое сообщение из разрешённого личного чата, чтобы проверить реальное сохранение.'
        : 'Telegram принял подключение, но включение архива пока не подтверждено. Включи Anti-Delete в Privacy Center.',
    });
  } catch (error) {
    const safe = safeFailure(error);
    if (safe.status >= 500) console.warn('Business wizard unavailable',safe.status);
    return json(res,safe.status,{error:safe.error});
  }
}
