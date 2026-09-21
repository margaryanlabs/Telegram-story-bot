import { TelegramClient, Api } from 'teleproto';
import { StringSession } from 'teleproto/sessions/index.js';

function credentials() {
  const apiId = Number(process.env.TELEGRAM_API_ID || 0);
  const apiHash = String(process.env.TELEGRAM_API_HASH || '').trim();
  if (!apiId || !apiHash) throw new Error('TELEGRAM_API_ID / TELEGRAM_API_HASH are not configured');
  return { apiId, apiHash };
}

function newClient(session = '') {
  const { apiId, apiHash } = credentials();
  return new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 3,
  });
}

function idString(value) {
  if (value === null || value === undefined) return '';
  return value?.toString?.() || String(value);
}

function reactionValue(reaction) {
  if (!reaction) return null;
  if (reaction.emoticon) return { type: 'emoji', value: reaction.emoticon };
  if (reaction.documentId !== undefined) return { type: 'custom', value: idString(reaction.documentId) };
  return { type: reaction.className || reaction.constructor?.name || 'reaction' };
}

export async function beginUserAuth(phoneNumber) {
  const phone = String(phoneNumber || '').replace(/[^+\d]/g, '');
  if (!/^\+\d{7,15}$/.test(phone)) throw new Error('Введите номер в международном формате, например +374...');

  const { apiId, apiHash } = credentials();
  const client = newClient('');
  try {
    await client.connect();
    const sent = await client.sendCode({ apiId, apiHash }, phone, false);
    return {
      phone,
      phoneCodeHash: sent.phoneCodeHash,
      isCodeViaApp: Boolean(sent.isCodeViaApp),
      session: client.session.save(),
    };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

export async function verifyUserCode(authState, code) {
  const phoneCode = String(code || '').replace(/\s+/g, '');
  if (!/^\d{3,8}$/.test(phoneCode)) throw new Error('Некорректный код Telegram');

  const client = newClient(authState.session);
  try {
    await client.connect();
    try {
      const result = await client.invoke(new Api.auth.SignIn({
        phoneNumber: authState.phone,
        phoneCodeHash: authState.phoneCodeHash,
        phoneCode,
      }));
      if (!(result instanceof Api.auth.Authorization)) {
        throw new Error('Telegram требует дополнительный шаг авторизации');
      }
      const me = result.user;
      return {
        needsPassword: false,
        session: client.session.save(),
        user: normalizeUser(me),
      };
    } catch (error) {
      if (String(error?.errorMessage || error?.message || '').includes('SESSION_PASSWORD_NEEDED')) {
        return {
          needsPassword: true,
          session: client.session.save(),
        };
      }
      throw error;
    }
  } finally {
    await client.disconnect().catch(() => {});
  }
}

export async function verifyUserPassword(authState, password) {
  const value = String(password || '');
  if (!value) throw new Error('Введите пароль двухэтапной аутентификации');

  const { apiId, apiHash } = credentials();
  const client = newClient(authState.session);
  try {
    await client.connect();
    const user = await client.signInWithPassword(
      { apiId, apiHash },
      {
        password: async () => value,
        onError: async () => true,
      },
    );
    return {
      session: client.session.save(),
      user: normalizeUser(user),
    };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

export async function revokeUserSession(session) {
  const client = newClient(session);
  try {
    await client.connect();
    await client.logOut();
  } finally {
    await client.disconnect().catch(() => {});
  }
}

export async function createViewerClient(session) {
  const client = newClient(session);
  await client.connect();
  const authorized = await client.checkAuthorization();
  if (!authorized) {
    await client.disconnect().catch(() => {});
    throw new Error('Telegram user session is no longer authorized');
  }
  return client;
}

export function normalizeUser(user) {
  if (!user) return null;
  return {
    id: idString(user.id),
    username: user.username || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || idString(user.id),
    isContact: Boolean(user.contact),
  };
}

export async function fetchStoryViewState(client, storyId) {
  const peer = await client.getInputEntity('me');

  let aggregate = null;
  try {
    const aggregateResult = await client.api.stories.getStoriesViews({
      peer,
      id: [Number(storyId)],
    });
    aggregate = aggregateResult?.views?.[0] || null;
  } catch {}

  const users = new Map();
  const directViews = [];
  let forwardsCount = Number(aggregate?.forwardsCount || 0);
  let reactionsCount = Number(aggregate?.reactionsCount || 0);
  let totalViews = Number(aggregate?.viewsCount || 0);
  let offset = '';
  let pages = 0;

  do {
    const page = await client.getStoryViewsList('me', Number(storyId), {
      offset,
      limit: 100,
    });

    totalViews = Math.max(totalViews, Number(page?.viewsCount || 0));
    forwardsCount = Math.max(forwardsCount, Number(page?.forwardsCount || 0));
    reactionsCount = Math.max(reactionsCount, Number(page?.reactionsCount || 0));

    for (const user of page?.users || []) {
      const normalized = normalizeUser(user);
      if (normalized?.id) users.set(normalized.id, normalized);
    }

    for (const view of page?.views || []) {
      if (view?.userId === undefined || view?.userId === null) continue;
      const viewerUserId = idString(view.userId);
      const user = users.get(viewerUserId) || { id: viewerUserId, username: '', displayName: viewerUserId, isContact: false };
      directViews.push({
        viewerUserId,
        viewedAt: Number(view.date || 0),
        reaction: reactionValue(view.reaction),
        user,
      });
    }

    offset = String(page?.nextOffset || '');
    pages += 1;
  } while (offset && pages < 25);

  const unique = new Map();
  for (const item of directViews) {
    const current = unique.get(item.viewerUserId);
    if (!current || item.viewedAt > current.viewedAt) unique.set(item.viewerUserId, item);
  }

  return {
    totalViews,
    identifiedViews: unique.size,
    forwardsCount,
    reactionsCount,
    hasViewers: aggregate?.hasViewers !== false,
    viewers: [...unique.values()],
  };
}
