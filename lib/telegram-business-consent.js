import { selectedStorageProvider } from './storage-provider.js';
import { Api } from 'teleproto';
import crypto from 'node:crypto';

export const BUSINESS_BOT_USERNAME = 'Vetotg_bot';
export const CONSENT_APPROVAL = 'CONNECT_SELECTED_PRIVATE_CHATS';
export const MAX_SELECTED_CHATS = 12;
const ID = value => String(value?.toString?.() || value || '');
const FLAGS = ['existingChats','newChats','contacts','nonContacts','excludeSelected'];
const RIGHTS = ['reply','readMessages','deleteSentMessages','deleteReceivedMessages','editName','editBio',
  'editProfilePhoto','editUsername','viewGifts','sellGifts','changeGiftSettings','transferAndUpgradeGifts','transferStars','manageStories'];
const fail = (message,status=409) => Object.assign(new Error(message),{status});
const pendingOwners = new Set();
// Prevent overlapping requests in the same function instance. Telegram has no
// compare-and-swap RPC; cross-instance/client races remain a release limitation.
export async function withBusinessWriteLock(ownerId,operation) {
  const key=String(ownerId);
  if(pendingOwners.has(key)) throw fail('Изменение подключения уже выполняется. Дождись результата и проверь статус.');
  pendingOwners.add(key);
  let leaseToken=null;
  try {
    // The in-memory lock only covers one Vercel instance. Neon uses an atomic
    // owner-scoped database lease to serialize concurrent server instances.
    if(selectedStorageProvider()==='neon') {
      const {neonStoreOperation}=await import('./neon-store.js');
      leaseToken=crypto.randomUUID();
      const claimed=await neonStoreOperation('claim_business_write_lease',{
        userId:key,leaseToken,ttlSeconds:150
      });
      if(!claimed?.acquired) throw fail('Подключение изменяется в другом запросе. Проверь статус и повтори после завершения.');
    }
    return await operation();
  } finally {
    if(leaseToken) {
      try {
        const {neonStoreOperation}=await import('./neon-store.js');
        await neonStoreOperation('release_business_write_lease',{userId:key,leaseToken});
      } catch {
        // Expiring database lease will self-release if cleanup is unavailable.
        console.warn('Vetogram Business lease release deferred');
      }
    }
    pendingOwners.delete(key);
  }
}
// Never opt a real Telegram account into Business automation implicitly,
// including preview builds, development Vercel environments and local tests.
export const unifiedOnboardingEnabled = () => process.env.VETOGRAM_UNIFIED_ONBOARDING === '1';

export function eligibleBusinessDialog(d) {
  return Boolean(d?.isUser && d?.entity?.id && !d.entity.self && !d.entity.bot && !d.entity.deleted);
}
export function selectBusinessDialogs(dialogs = [], requestedIds = []) {
  if (!Array.isArray(requestedIds) || !requestedIds.length || requestedIds.length > MAX_SELECTED_CHATS)
    throw fail('Выбери от 1 до 12 личных чатов.',400);
  const ids = requestedIds.map(String);
  if (new Set(ids).size !== ids.length || ids.some(id => !/^\d{1,19}$/.test(id)))
    throw fail('Список чатов содержит ошибку или повторения.',400);
  const allowed = new Map(dialogs.filter(eligibleBusinessDialog).map(d => [ID(d.id),d]));
  const selected = ids.map(id => allowed.get(id));
  if (selected.some(d => !d)) throw fail('Можно подключать только личные чаты, доступные в твоём Telegram.',403);
  return selected;
}
const ids = values => (values || []).map(v => ID(v?.userId ?? v?.id ?? v)).sort();
export function recipientSnapshot(r={}) {
  return {...Object.fromEntries(FLAGS.map(key=>[key,Boolean(r[key])])),users:ids(r.users),excludeUsers:ids(r.excludeUsers)};
}
export function rightsSnapshot(r={}) { return Object.fromEntries(RIGHTS.map(key=>[key,Boolean(r[key])])); }
function fingerprint(raw={}) {
  return crypto.createHash('sha256').update(JSON.stringify((raw.connectedBots || []).map(b=>({
    id:ID(b.botId),recipients:recipientSnapshot(b.recipients),rights:rightsSnapshot(b.rights),
  })).sort((a,b)=>a.id.localeCompare(b.id)))).digest('hex');
}
export function connectionSummary(raw={},botId='') {
  const bots = raw.connectedBots || [];
  if (!bots.length) return {state:'none',connectedBot:null,recipients:null,rights:null};
  const first = bots.find(b=>ID(b.botId)===String(botId)) || bots[0];
  const own = ID(first.botId)===String(botId) && bots.length===1;
  const current = (raw.users || []).find(u=>ID(u.id)===ID(first.botId));
  const r = recipientSnapshot(first.recipients);
  return {
    state:own?'storylab':'other_bot',
    connectedBot:{username:String(current?.username || '').slice(0,80)||null,isStoryLab:own},
    recipients:own?{...r,selectedCount:r.users.length,broad:FLAGS.some(k=>r[k])}:null,
    rights:own?rightsSnapshot(first.rights):null,
  };
}
export function assertBusinessConnectionAvailable(snapshot) {
  if (snapshot.state === 'other_bot') throw fail('У тебя уже подключён другой Business-бот. Vetogram не отключит и не заменит его без твоего решения в Telegram.');
}
function toInputUser(user) {
  if (user instanceof Api.InputUser || user?.className==='InputUser') return user;
  const uid=user?.userId ?? user?.id, hash=user?.accessHash;
  if (uid===undefined || hash===undefined || hash===null) throw fail('Telegram не предоставил данные контакта. Открой его чат в Telegram и повтори проверку.');
  return new Api.InputUser({userId:uid,accessHash:hash});
}
export async function readBusinessConsentState(client) {
  const bot=await client.getEntity(BUSINESS_BOT_USERNAME);
  if (!bot?.bot || bot.botBusiness===false) throw fail('Бот пока не принимает Business-подключения. Проверь Business Mode в BotFather.');
  const raw=await client.invoke(new Api.account.GetConnectedBots({}));
  return {status:connectionSummary(raw,ID(bot.id)),bot,raw,fingerprint:fingerprint(raw)};
}
// Owner-bound, short-lived optimistic concurrency token. It contains no session,
// access hashes, peer identifiers or connection ID. A changed scope invalidates it.
export function signConsentSnapshot(ownerId,state,secret,now=Date.now()) {
  const payload=Buffer.from(JSON.stringify({owner:String(ownerId),hash:state.fingerprint,expires:now+300000})).toString('base64url');
  return payload+'.'+crypto.createHmac('sha256',secret).update(payload).digest('hex');
}
export function verifyConsentSnapshot(token,ownerId,state,secret,now=Date.now()) {
  const [payload,signature,...extra]=String(token||'').split('.');
  if (!payload || !/^[a-f0-9]{64}$/.test(signature||'') || extra.length) throw fail('Сначала выполни проверку подключения.');
  const expected=crypto.createHmac('sha256',secret).update(payload).digest();
  if (!crypto.timingSafeEqual(expected,Buffer.from(signature,'hex'))) throw fail('Согласие не подтверждено. Повтори проверку.');
  let data;try {data=JSON.parse(Buffer.from(payload,'base64url'));} catch {throw fail('Повтори проверку подключения.');}
  if(data.owner!==String(ownerId)||data.expires<now||data.hash!==state.fingerprint) throw fail('Настройки Telegram изменились или проверка устарела. Проверь состояние ещё раз.');
}
export function businessRights(current={},storiesConsent=false,revokeStories=false) {
  const values=rightsSnapshot(current);
  values.manageStories=revokeStories?false:values.manageStories||storiesConsent===true;
  const rights=new Api.BusinessBotRights(values);
  // Verify the *wire* flag, not an arbitrary JS property accepted by a constructor.
  if (values.manageStories && !(rights.getBytes().readUInt32LE(4) & (1<<13)))
    throw fail('Установленный Telegram-клиент не поддерживает управление Stories.',503);
  return rights;
}
async function preserveRecipients(client,r={}) {
  const values=recipientSnapshot(r);
  const resolve=async list=>Promise.all(list.map(async id=>toInputUser(await client.getInputEntity(BigInt(id)))));
  return new Api.InputBusinessBotRecipients({...values,users:await resolve(values.users),excludeUsers:await resolve(values.excludeUsers)});
}
export async function buildBusinessRecipients(client,options={},current) {
  if(options.scope==='preserve') {
    if(!current) throw fail('Нет существующего подключения для сохранения охвата.');
    return preserveRecipients(client,current);
  }
  const modes={
    'all-private':{existingChats:true,newChats:true,contacts:true,nonContacts:true},
    'existing-private':{existingChats:true},'future-private':{newChats:true},
    contacts:{contacts:true},'non-contacts':{nonContacts:true},'selected-private':{},
  };
  if(!Object.hasOwn(modes,options.scope)) throw fail('Выбери охват личных чатов.',400);
  if(options.scopeConsent!==true) throw fail('Подтверди изменение охвата личных чатов.');
  const excluded=options.excludeChatIds??[];
  if(!Array.isArray(excluded)||excluded.length>MAX_SELECTED_CHATS) throw fail('Можно исключить до 12 чатов.',400);
  const selected=options.scope==='selected-private'?options.chatIds:[];
  const dialogs=(selected?.length || excluded.length)?await client.getDialogs({limit:500}):[];
  const resolve=async list=>Promise.all(selectBusinessDialogs(dialogs,list).map(async d=>toInputUser(await client.getInputEntity(d.entity))));
  const users=options.scope==='selected-private'?await resolve(selected):[];
  const excludeUsers=excluded.length?await resolve(excluded):[];
  if(users.some(u=>excludeUsers.some(e=>ID(e.userId)===ID(u.userId)))) throw fail('Чат нельзя одновременно выбрать и исключить.',400);
  return new Api.InputBusinessBotRecipients({...Object.fromEntries(FLAGS.map(k=>[k,false])),...modes[options.scope],users,excludeUsers});
}
const equal = (a,b) => JSON.stringify(a)===JSON.stringify(b);
// One mutation only; even a timeout is followed by a read, never a write retry.
export async function connectBusiness(client,options={}) {
  const before=await readBusinessConsentState(client);
  assertBusinessConnectionAvailable(before.status);
  options.verifySnapshot?.(before);
  const current=before.raw.connectedBots?.find(b=>ID(b.botId)===ID(before.bot.id));
  const recipients=await buildBusinessRecipients(client,options,current?.recipients);
  const rights=businessRights(current?.rights,options.storiesConsent,options.revokeStories);
  const desired={recipients:recipientSnapshot(recipients),rights:rightsSnapshot(rights)};
  const matches=s=>s.status.state==='storylab' && equal(recipientSnapshot(s.raw.connectedBots[0].recipients),desired.recipients)
    && equal(rightsSnapshot(s.raw.connectedBots[0].rights),desired.rights);
  if(matches(before)) return {connected:true,unchanged:true,needsMessageProof:true,manageStories:desired.rights.manageStories};
  const bot=toInputUser(await client.getInputEntity(before.bot));
  const fresh=await readBusinessConsentState(client);
  if(fresh.fingerprint!==before.fingerprint) throw fail('Настройки изменились во время проверки. Подключение не изменено.');
  let writeError;
  try { await client.invoke(new Api.account.UpdateConnectedBot({bot,recipients,rights})); }
  catch(error){writeError=error;}
  let after;
  try {after=await readBusinessConsentState(client);} catch {
    throw fail('Результат подключения неизвестен. Сначала проверь состояние; повторная запись не выполнялась.',503);
  }
  if(!matches(after)) {
    if(writeError) throw writeError;
    throw fail('Telegram пока не подтвердил выбранные права и охват. Выполни повторную проверку.',503);
  }
  return {connected:true,recoveredAfterError:Boolean(writeError),needsMessageProof:true,manageStories:desired.rights.manageStories};
}
export async function disconnectBusiness(client,verifySnapshot) {
  const before=await readBusinessConsentState(client);
  assertBusinessConnectionAvailable(before.status);
  verifySnapshot?.(before);
  if(before.status.state==='none') return {disconnected:true,unchanged:true};
  const bot=toInputUser(await client.getInputEntity(before.bot));
  const recipients=new Api.InputBusinessBotRecipients({users:[],excludeUsers:[]});
  const fresh=await readBusinessConsentState(client);
  if(fresh.fingerprint!==before.fingerprint) throw fail('Настройки изменились. Повтори проверку.');
  let error;
  try {await client.invoke(new Api.account.UpdateConnectedBot({deleted:true,bot,recipients}));} catch(e){error=e;}
  const after=await readBusinessConsentState(client);
  if(after.status.state!=='none') throw error || fail('Telegram не подтвердил отзыв доступа.',503);
  return {disconnected:true};
}
// Legacy callers retain explicit consent and minimal rights semantics.
export const connectBusinessAllPrivateChats = client => connectBusiness(client,{scope:'all-private',scopeConsent:true});
export const connectBusinessSelectedChats = (client,chatIds) => connectBusiness(client,{scope:'selected-private',scopeConsent:true,chatIds});
