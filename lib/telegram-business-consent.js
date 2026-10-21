import { Api } from 'teleproto';

// MTProto "business" permissions are unrelated to the right to *receive*
// business_message updates: readMessages would permit marking chats as read.
// Request no power to reply, mark read, delete, modify profile, transfer gifts,
// manage Stories, or move funds. Incoming events depend on the selected recipients.
export const BUSINESS_BOT_USERNAME = 'Vetotg_bot';
export const CONSENT_APPROVAL = 'CONNECT_SELECTED_PRIVATE_CHATS';
export const MAX_SELECTED_CHATS = 12;
const ID = value => String(value?.toString?.() || value || '');

export function eligibleBusinessDialog(d) {
  return Boolean(d?.isUser && d?.entity?.id && !d.entity?.self
    && !d.entity?.bot && !d.entity?.deleted);
}

export function selectBusinessDialogs(dialogs = [], requestedIds = []) {
  if (!Array.isArray(requestedIds) || !requestedIds.length || requestedIds.length > MAX_SELECTED_CHATS) {
    throw Object.assign(new Error('Выбери от 1 до 12 личных чатов.'), { status:400 });
  }
  const ids = requestedIds.map(value => String(value));
  if (new Set(ids).size !== ids.length || ids.some(id => !/^\d{1,19}$/.test(id))) {
    throw Object.assign(new Error('Список чатов содержит ошибку или повторения.'), { status:400 });
  }
  const allowed = new Map(dialogs.filter(eligibleBusinessDialog).map(d => [ID(d.id), d]));
  const selected = ids.map(id => allowed.get(id));
  if (selected.some(d => !d)) {
    throw Object.assign(new Error('Можно подключать только личные чаты, доступные в твоём Telegram.'), { status:403 });
  }
  return selected;
}

function userId(value) { return ID(value?.id || value); }

export function connectionSummary(raw = {}, botId = '') {
  const connectedBots = Array.isArray(raw.connectedBots) ? raw.connectedBots : [];
  if (!connectedBots.length) return { state:'none', connectedBot:null, recipients:null };
  const first = connectedBots[0];
  const own = userId(first.botId) === String(botId);
  const current = Array.isArray(raw.users) ? raw.users.find(u => userId(u) === userId(first.botId)) : null;
  const r = first.recipients || {};
  return {
    state:own ? 'storylab' : 'other_bot',
    connectedBot: {
      username:String(current?.username || '').slice(0,80) || null,
      isStoryLab:own,
    },
    recipients:own ? {
      selectedCount:Array.isArray(r.users) ? r.users.length : null,
      broad:Boolean(r.existingChats || r.newChats || r.contacts || r.nonContacts || r.excludeSelected),
    } : null,
  };
}

export function assertBusinessConnectionAvailable(snapshot) {
  if (snapshot.state === 'other_bot') {
    throw Object.assign(new Error('У тебя уже подключён другой Business-бот. Vetogram не отключит и не заменит его без твоего решения в Telegram.'),{status:409});
  }
  if (snapshot.state === 'storylab') {
    throw Object.assign(new Error('Vetogram уже подключён через Business. Настройки разрешённых чатов можно изменить в Telegram → Для бизнеса → Чат-боты.'),{status:409});
  }
}

function toInputUser(user) {
  if (user?.className === 'InputUser' || user instanceof Api.InputUser) return user;
  const uid = user?.userId ?? user?.id;
  const hash = user?.accessHash;
  if (uid === undefined || hash === undefined || hash === null) {
    throw Object.assign(new Error('Telegram не предоставил данные выбранного контакта. Открой его чат в Telegram и попробуй снова.'),{status:409});
  }
  return new Api.InputUser({ userId:uid, accessHash:hash });
}

export async function readBusinessConsentState(client) {
  const bot = await client.getEntity(BUSINESS_BOT_USERNAME);
  if (!bot?.bot || bot?.botBusiness === false) {
    throw Object.assign(new Error('Бот пока не принимает Business-подключения. Проверь Business Mode в BotFather.'),{status:409});
  }
  const status = await client.invoke(new Api.account.GetConnectedBots({}));
  return { status:connectionSummary(status,ID(bot.id)), bot };
}

// Full-scope is separate from choosing 1–12 chats. The account owner must
// deliberately approve old AND future ordinary private dialogs. Neither
// Secret Chats nor groups/channels can be received through Business recipients.
export async function connectBusinessAllPrivateChats(client) {
  const {status,bot} = await readBusinessConsentState(client);
  assertBusinessConnectionAvailable(status);
  const botPeer = toInputUser(await client.getInputEntity(bot));
  const recipients = new Api.InputBusinessBotRecipients({
    existingChats:true,newChats:true,contacts:true,nonContacts:true,
    excludeSelected:false,users:[],excludeUsers:[],
  });
  const rights = new Api.BusinessBotRights({});
  await client.invoke(new Api.account.UpdateConnectedBot({bot:botPeer,recipients,rights}));
  const after = await readBusinessConsentState(client);
  if (after.status.state !== 'storylab' || !after.status.recipients?.broad) {
    throw Object.assign(new Error('Telegram не подтвердил широкий охват личных чатов. Проверь настройки Business.'),{status:503});
  }
  return {connected:true,scope:'all-current-and-future-private',needsMessageProof:true};
}

export async function connectBusinessSelectedChats(client, ids) {
  // Re-fetch the connected bots immediately before write: never replace
  // an unrelated Business bot, even on concurrent edits in another Telegram client.
  const { status,bot } = await readBusinessConsentState(client);
  assertBusinessConnectionAvailable(status);
  const dialogs = await client.getDialogs({ limit:100 });
  const selected = selectBusinessDialogs(dialogs, ids);
  // Limit the connection to explicit private chats only. No all-chats flags.
  const users = await Promise.all(selected.map(async d => {
    const peer = await client.getInputEntity(d.entity);
    return toInputUser(peer);
  }));
  const botPeer = toInputUser(await client.getInputEntity(bot));
  const recipients = new Api.InputBusinessBotRecipients({
    existingChats:false,newChats:false,contacts:false,nonContacts:false,
    excludeSelected:false,users,excludeUsers:[],
  });
  const rights = new Api.BusinessBotRights({});
  await client.invoke(new Api.account.UpdateConnectedBot({
    bot:botPeer,recipients,rights,
  }));
  // Don't claim that Telegram delivered a real message: this only proves that
  // the account accepted the scoped connection request.
  const after = await readBusinessConsentState(client);
  if (after.status.state !== 'storylab') {
    throw Object.assign(new Error('Telegram не подтвердил подключение. Проверь настройки Business-бота в Telegram.'),{status:503});
  }
  return { connected:true, selectedCount: selected.length, needsMessageProof:true };
}
