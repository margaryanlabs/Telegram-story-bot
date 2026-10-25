import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { selectedStorageProvider } from '../lib/storage-provider.js';
import {businessConnectionReadiness} from '../lib/vetogram-business-readiness.js';
import { getViewerSession, updatePrivacySettings, getPrivacySettings, getBusinessConnectionState } from '../lib/viewer-sync-store.js';
import { sameTelegramAccount } from '../lib/telegram-session-owner.js';
import { openJson } from '../lib/viewer-sync-crypto.js';
import { verifyTelegramClientOwner, telegramOwnerError } from '../lib/telegram-owner-runtime.js';
import { withBackupClient, listBackupDialogs } from '../lib/telegram-history-backup.js';
import { readBusinessConsentState, connectBusiness, disconnectBusiness, signConsentSnapshot,
  verifyConsentSnapshot, unifiedOnboardingEnabled, withBusinessWriteLock, CONSENT_APPROVAL, BUSINESS_BOT_USERNAME } from '../lib/telegram-business-consent.js';

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

export async function verifyStoredBusinessConnection(token,ownerId) {
  try {
    const stored=await getBusinessConnectionState(ownerId);
    if(!stored?.businessConnectionId) return {botApi:'pending-webhook',serverState:'pending'};
    const response=await fetch(`https://api.telegram.org/bot${token}/getBusinessConnection`,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({business_connection_id:stored.businessConnectionId}),signal:AbortSignal.timeout(4500),
    });
    const data=await response.json();
    if(!response.ok || data?.ok!==true)
      return {botApi:'not-verified',serverState:'not-verified',
        storiesPermission:'unknown',messageEventsProven:false};
    // user_chat_id is a *chat* ID, and may differ from the signed user ID.
    // Check both the requested connection token and its authenticated owner.
    return businessConnectionReadiness(ownerId,stored.businessConnectionId,data?.result);
  } catch {return {botApi:'not-verified',serverState:'pending'};}
}

// Do not expose production Business writes when the cross-instance DB lease has
// not been deployed. This read-only check is intentionally not a migration.
async function businessWriteReadiness() {
  if (process.env.VERCEL_ENV !== 'production') return {ready:true};
  if (selectedStorageProvider() !== 'neon') return {ready:false};
  try {
    const {neonStoreOperation}=await import('../lib/neon-store.js');
    const result=await neonStoreOperation('health',{});
    return {ready:result?.backend==='neon' && Number(result?.schemaVersion)>=5};
  } catch {return {ready:false};}
}

const DEFAULT_DEPENDENCIES = { getViewerSession, updatePrivacySettings, getPrivacySettings, openJson,
  withBackupClient, listBackupDialogs, verifyStoredBusinessConnection, businessWriteReadiness };
export function createBusinessWizardHandler(overrides={}) {
  const {token=BOT,...dependencies}=overrides;
  const {getViewerSession,updatePrivacySettings,getPrivacySettings,openJson,withBackupClient,
    listBackupDialogs,verifyStoredBusinessConnection,businessWriteReadiness}={...DEFAULT_DEPENDENCIES,...dependencies};
  return async function handler(req, res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if (req.method !== 'POST') return json(res,405,{error:'Method not allowed'});
  if (!token) return json(res,503,{error:'Vetogram Telegram не настроен'});
  const owner = validateTelegramMiniApp(String(req.headers['x-telegram-init-data'] || ''),token);
  if (!owner?.id) return json(res,401,{error:'Открой Vetogram внутри своего Telegram'});
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; }
  catch { return json(res,400,{error:'Некорректный запрос'}); }
  const action = String(body.action || '');
  if (!['prepare','connect','disconnect','revoke-stories'].includes(action)) return json(res,400,{error:'Unknown action'});
  // Never auto-enable a Business connection: a fresh explicit selection
  // and exact approval marker are mandatory, and all selected peers are
  // resolved again from the same authenticated user's live MTProto session.
  if (action !== 'prepare' && (body.consent !== true || body.approval !== (action === 'disconnect' ? 'REVOKE_BUSINESS_ACCESS' : action === 'revoke-stories' ? 'REVOKE_STORIES_ACCESS' : CONSENT_APPROVAL))) {
    return json(res,409,{error:'Подтверди подключение выбранных личных переписок.'});
  }
  if (!unifiedOnboardingEnabled()) return action === 'prepare'
    ? json(res,200,{enabled:false,state:'disabled'})
    : json(res,409,{error:'Автоматическое подключение ещё проходит проверку перед выпуском.'});
  const readiness=await businessWriteReadiness();
  if(readiness?.ready!==true) return action==='prepare'
    ? json(res,200,{enabled:false,state:'requires-server-readiness'})
    : json(res,503,{error:'Серверная защита подключения ещё не подготовлена. Разрешения Telegram не изменены.'});
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

    const verifySnapshot = state => verifyConsentSnapshot(body.snapshotToken,ownerId,state,token);
    if (action === 'prepare') {
      const info = await withBackupClient(decrypted.session,async client => {
        await verifyTelegramClientOwner(client,ownerId);
        const state = await readBusinessConsentState(client);
        const chats = state.status.state !== 'other_bot' ? await listBackupDialogs(client) : [];
        return { state,chats };
      });
      const [settings,delivery] = await Promise.all([
        getPrivacySettings(ownerId).catch(()=>null),verifyStoredBusinessConnection(token,ownerId),
      ]);
      return json(res,200,{
        enabled:true,...info.state.status,chats:info.chats.slice(0,100),
        snapshotToken:signConsentSnapshot(ownerId,info.state,token),
        allowConnect:info.state.status.state !== 'other_bot',noReplaceOtherBot:true,
        permissions:info.state.status.rights || {reply:false,readMessages:false,manageStories:false},
        requestedPermissions:{reply:false,readMessages:false,deleteMessages:false,manageStories:'separate-opt-in'},
        diagnostics:{telegramAccount:true,businessBot:info.state.status.state==='storylab',
          manageStories:info.state.status.rights?.manageStories===true,
          ghostView:'available-with-existing-session-live-test-not-verified',
          antiDelete:settings?.antiDelete===true,antiDeleteProof:'not-verified-in-this-onboarding',...delivery},
      });
    }
    // Existing owners may change only their recipients without granting a new
    // Story or archive capability. Never allow that shortcut on a new account.
    if (action === 'connect' && body.antiDeleteConsent !== true && body.storiesConsent !== true
      && body.scope === 'preserve')
      return json(res,409,{error:'Нет изменений: выбери нужную возможность или новый охват чатов.'});
    const result = await withBusinessWriteLock(ownerId,()=>withBackupClient(decrypted.session,async client => {
      await verifyTelegramClientOwner(client,ownerId);
      if (action === 'connect' && body.antiDeleteConsent !== true && body.storiesConsent !== true) {
        const current = await readBusinessConsentState(client);
        if (current.status.state !== 'storylab') {
          throw Object.assign(new Error('Первое подключение требует явного согласия на Anti-Delete или Stories.'),{status:409});
        }
      }
      if (action === 'disconnect') return disconnectBusiness(client,verifySnapshot);
      return connectBusiness(client,{
        scope:action === 'revoke-stories' ? 'preserve' : body.scope,
        scopeConsent:body.scopeConsent===true,chatIds:body.chatIds,excludeChatIds:body.excludeChatIds,
        storiesConsent:body.storiesConsent===true,revokeStories:action==='revoke-stories',verifySnapshot,
      });
    },{requestRetries:1,floodSleepThreshold:0}));
    let settingsUpdated = false;
    if (action === 'connect' && body.antiDeleteConsent === true) {
      try {
        await updatePrivacySettings(ownerId,{ antiDelete:true,editHistory:true,ghostInbox:true });
        settingsUpdated = true;
      } catch { /* Keep the Telegram result and report partial completion. */ }
    }
    // getConnectedBots has no Bot API connection ID. Never invent/reuse a stale
    // ID as proof of delivery: the signed webhook supplies new IDs, then this
    // read-only Bot API verification confirms owner + rights independently.
    const delivery = await verifyStoredBusinessConnection(token,ownerId);
    if (action === 'disconnect') delivery.serverState = 'pending-webhook';
    return json(res,200,{...result,settingsUpdated,
      archiveConsentRequested:action==='connect' && body.antiDeleteConsent===true,
      scope:body.scope || 'preserve',delivery,
      note:'Подключение и права проверены в Telegram. Доставка событий, публикация и удаление требуют отдельной проверки.'});
  } catch (error) {
    const safe = safeFailure(error);
    if (safe.status >= 500) console.warn('Business wizard unavailable',safe.status);
    return json(res,safe.status,{error:safe.error});
  }
}
}
export default createBusinessWizardHandler();
