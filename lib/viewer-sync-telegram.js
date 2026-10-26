import { normalizeTelegramPhone } from './telegram-auth-feedback.js';
import { TelegramClient, Api } from 'teleproto';
import { StringSession } from 'teleproto/sessions/index.js';

const VIEWER_MAX_PAGES = Math.max(3, Math.min(20, Number(process.env.VIEWER_MAX_PAGES || 10)));

const VIEWER_CONNECT_TIMEOUT_MS = Math.max(3000, Math.min(12000, Number(process.env.VIEWER_CONNECT_TIMEOUT_MS || 7000)));
const VIEWER_RPC_TIMEOUT_MS = Math.max(2000, Math.min(10000, Number(process.env.VIEWER_RPC_TIMEOUT_MS || 5000)));
const VIEWER_STORY_DEADLINE_MS = Math.max(6000, Math.min(20000, Number(process.env.VIEWER_STORY_DEADLINE_MS || 12000)));

function timeoutError(label) {
  const error = new Error(`${label} timed out`);
  error.code = 'VIEWER_TIMEOUT';
  return error;
}

async function withTimeout(promise, timeoutMs, label) {
  const ms = Math.max(250, Number(timeoutMs || 0));
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(timeoutError(label)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function boundedTimeout(deadlineAt, capMs = VIEWER_RPC_TIMEOUT_MS) {
  const remaining = Number(deadlineAt || 0) - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 500) throw timeoutError('Viewer Story deadline');
  return Math.max(250, Math.min(capMs, remaining - 250));
}

function credentials() {
  const apiId = Number(process.env.TELEGRAM_API_ID || 0);
  const apiHash = String(process.env.TELEGRAM_API_HASH || '').trim();
  if (!apiId || !apiHash) throw new Error('TELEGRAM_API_ID / TELEGRAM_API_HASH are not configured');
  return { apiId, apiHash };
}

function newClient(session = '', options = {}) {
  const { apiId, apiHash } = credentials();
  return new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 3,
    ...([1,2].includes(options.requestRetries) ? { requestRetries:options.requestRetries, floodSleepThreshold:0 } : {}),
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

// Keep the actual constructor, next medium and server timeout. The SDK's
// convenience sendCode() drops these fields and cannot drive a truthful retry UI.
const SENT_CODE_DELIVERY = Object.freeze({
  SentCodeTypeApp: 'telegram_app', SentCodeTypeSms: 'sms',
  SentCodeTypeCall: 'call', SentCodeTypeFlashCall: 'flash_call',
  SentCodeTypeMissedCall: 'missed_call', SentCodeTypeEmailCode: 'email_code',
  SentCodeTypeSetUpEmailRequired: 'email_setup', SentCodeTypeFragmentSms: 'fragment_sms',
  SentCodeTypeFirebaseSms: 'firebase_sms', SentCodeTypeSmsWord: 'sms',
  SentCodeTypeSmsPhrase: 'sms',
});
const NEXT_CODE_DELIVERY = Object.freeze({
  CodeTypeSms: 'sms', CodeTypeCall: 'call', CodeTypeFlashCall: 'flash_call',
  CodeTypeMissedCall: 'missed_call', CodeTypeFragmentSms: 'fragment_sms',
});
const AUTH_RPC_MS = 12_000;

function constructorName(value) {
  return String(value?.className || value?.constructor?.name || '').replace(/^auth\./, '');
}

export function telegramCodeMetadata(sent, now = Date.now()) {
  if (!(sent instanceof Api.auth.SentCode) || !String(sent.phoneCodeHash || '')) {
    throw new Error('TELEGRAM_AUTH_RESPONSE_INVALID');
  }
  const name = constructorName(sent.type);
  const nextName = constructorName(sent.nextType);
  const delivery = SENT_CODE_DELIVERY[name] || 'unknown';
  const nextDelivery = NEXT_CODE_DELIVERY[nextName] || null;
  const rawTimeout = sent.timeout;
  // A missing timeout is not permission to immediately ask for another code.
  const timeout = rawTimeout !== undefined && rawTimeout !== null
    && Number.isFinite(Number(rawTimeout)) && Number(rawTimeout) >= 0
    ? Math.ceil(Number(rawTimeout)) : null;
  return {
    phoneCodeHash: sent.phoneCodeHash,
    isCodeViaApp: delivery === 'telegram_app',
    delivery,
    sentCodeType: SENT_CODE_DELIVERY[name] ? `auth.${name}` : 'unknown',
    codeFormat: name === 'SentCodeTypeSmsWord' ? 'word' : name === 'SentCodeTypeSmsPhrase' ? 'phrase' : 'digits',
    codeLength: Number.isInteger(sent.type?.length) && sent.type.length >= 1 && sent.type.length <= 10
      ? sent.type.length : null,
    nextDelivery,
    resendAvailableAt: nextDelivery && timeout !== null
      ? new Date(now + timeout * 1000).toISOString() : null,
    canResend: Boolean(nextDelivery && timeout !== null),
  };
}

async function disconnectAuth(client) {
  let timer;
  try {
  await Promise.race([
    Promise.resolve().then(() => client.disconnect()).catch(() => {}),
    new Promise(resolve => { timer=setTimeout(resolve, 1200); }),
  ]);
  } finally { clearTimeout(timer); }
}

function authResult(client, sent, phone) {
  if (sent instanceof Api.auth.SentCodeSuccess) {
    if (!(sent.authorization instanceof Api.auth.Authorization)) throw new Error('TELEGRAM_AUTH_RESPONSE_INVALID');
    return { connected: true, session: client.session.save(), user: normalizeUser(sent.authorization.user) };
  }
  return { phone, ...telegramCodeMetadata(sent), session: client.session.save() };
}

async function invokeAuthCode(client, request, phone, label) {
  try {
    return authResult(client, await withTimeout(client.invoke(request), AUTH_RPC_MS, label), phone);
  } catch (error) {
    if (String(error?.errorMessage || error?.message || '') === 'SESSION_PASSWORD_NEEDED') {
      return {phone,needsPassword:true,session:client.session.save()};
    }
    throw error;
  }
}

export async function beginUserQrAuth({ onQr, abortSignal, clientFactory=newClient } = {}) {
  if (typeof onQr !== 'function') throw new Error('QR callback is required');

  const { apiId, apiHash } = credentials();
  const client = clientFactory('', { requestRetries: 2 });
  let passwordHint = '';

  try {
    // A stalled Telegram DC handshake must not hold the QR HTTP stream open
    // until Vercel forcibly terminates the request.
    await withTimeout(client.connect(), 8000, 'Telegram QR connect');
    try {
      const user = await client.signInUserWithQrCode(
        { apiId, apiHash },
        {
          qrCode: async ({ token, expires }) => {
            await onQr({
              token: Buffer.from(token).toString('base64url'),
              expires: Number(expires || 0),
            });
          },
          password: async hint => {
            passwordHint = String(hint || '');
            const error = new Error('QR_PASSWORD_REQUIRED');
            error.code = 'QR_PASSWORD_REQUIRED';
            error.hint = passwordHint;
            throw error;
          },
          onError: async error => {
            if (error?.code === 'QR_PASSWORD_REQUIRED' || error?.message === 'QR_PASSWORD_REQUIRED') {
              const required = new Error('QR_PASSWORD_REQUIRED');
              required.code = 'QR_PASSWORD_REQUIRED';
              required.hint = passwordHint;
              throw required;
            }
            return true;
          },
          abortSignal,
        },
      );

      return {
        connected: true,
        needsPassword: false,
        session: client.session.save(),
        user: normalizeUser(user),
      };
    } catch (error) {
      if (error?.code === 'QR_PASSWORD_REQUIRED' || error?.message === 'QR_PASSWORD_REQUIRED') {
        return {
          connected: false,
          needsPassword: true,
          passwordHint: String(error?.hint || passwordHint || ''),
          session: client.session.save(),
        };
      }
      throw error;
    }
  } finally {
    await disconnectAuth(client);
  }
}

export async function beginUserAuth(phoneNumber, {clientFactory=newClient}={}) {
  const phone = normalizeTelegramPhone(phoneNumber);

  const { apiId, apiHash } = credentials();
  // Two bounded SDK attempts retain its PHONE/NETWORK_MIGRATE handling. No
  // automatic FLOOD_WAIT sleeping or recursive sendCode AUTH_RESTART loop.
  const client = clientFactory('', { requestRetries: 2 });
  try {
    await withTimeout(client.connect(), 8000, 'Telegram auth connect');
    return await invokeAuthCode(client, new Api.auth.SendCode({
      phoneNumber: phone, apiId, apiHash, settings: new Api.CodeSettings({}),
    }), phone, 'Telegram auth.sendCode');
  } finally {
    await disconnectAuth(client);
  }
}

export async function resendUserAuthCode(authState, {clientFactory=newClient, now=Date.now()}={}) {
  const availableAt = Date.parse(authState?.resendAvailableAt || '');
  if (!authState?.canResend || !authState?.nextDelivery || !Number.isFinite(availableAt)) {
    throw Object.assign(new Error('TELEGRAM_RESEND_UNAVAILABLE'), { status: 409 });
  }
  if (availableAt > now) {
    throw Object.assign(new Error('TELEGRAM_RESEND_TOO_EARLY'), {
      status: 429, retryAfterSeconds: Math.ceil((availableAt - now) / 1000),
    });
  }
  if (!authState?.phoneCodeHash || !authState?.session) throw new Error('PHONE_CODE_HASH_INVALID');
  const phone = normalizeTelegramPhone(authState.phone);
  const client = clientFactory(authState.session, { requestRetries: 2 });
  try {
    await withTimeout(client.connect(), 8000, 'Telegram auth connect');
    return await invokeAuthCode(client, new Api.auth.ResendCode({
      phoneNumber: phone, phoneCodeHash: authState.phoneCodeHash,
    }), phone, 'Telegram auth.resendCode');
  } finally {
    await disconnectAuth(client);
  }
}

export async function verifyUserCode(authState, code, {clientFactory=newClient}={}) {
  const textCode = ['word','phrase'].includes(authState?.codeFormat);
  const phoneCode = textCode ? String(code || '').trim() : String(code || '').replace(/\s+/g, '');
  if (textCode ? !phoneCode || phoneCode.length > 128 || /[\u0000-\u001f\u007f]/.test(phoneCode)
    : !/^\d{3,10}$/.test(phoneCode)) throw new Error('Некорректный код Telegram');

  const client = clientFactory(authState.session, { requestRetries: 2 });
  try {
    await withTimeout(client.connect(), 8000, 'Telegram auth connect');
    try {
      if (authState.delivery === 'email_setup_code') {
        const verified=await withTimeout(client.invoke(new Api.account.VerifyEmail({
          purpose:new Api.EmailVerifyPurposeLoginSetup({phoneNumber:authState.phone,phoneCodeHash:authState.phoneCodeHash}),
          verification:new Api.EmailVerificationCode({code:phoneCode}),
        })), AUTH_RPC_MS, 'Telegram email verification');
        if (verified?.sentCode instanceof Api.auth.SentCodeSuccess) {
          const authorization=verified.sentCode.authorization;
          if (!(authorization instanceof Api.auth.Authorization)) throw new Error('Telegram требует дополнительную авторизацию');
          return {needsPassword:false,session:client.session.save(),user:normalizeUser(authorization.user)};
        }
        if (!(verified?.sentCode instanceof Api.auth.SentCode)) throw new Error('Telegram требует повторную проверку email');
        const sent=verified.sentCode;
        return {nextCode:true,authState:{...authState,...telegramCodeMetadata(sent),session:client.session.save()}};
      }
      if (authState.delivery === 'email_setup') throw new Error('Сначала укажи email для Telegram');
      const result = await withTimeout(client.invoke(new Api.auth.SignIn({
        phoneNumber: authState.phone,
        phoneCodeHash: authState.phoneCodeHash,
        ...(authState.delivery === 'email_code' ? {emailVerification:new Api.EmailVerificationCode({code:phoneCode})} : {phoneCode}),
      })), AUTH_RPC_MS, 'Telegram auth.signIn');
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
    await disconnectAuth(client);
  }
}

export async function sendUserLoginEmail(authState,email,{clientFactory=newClient}={}) {
  if(authState.delivery !== 'email_setup') throw new Error('Telegram не запрашивал настройку email');
  const value=String(email || '').trim();
  if(value.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Проверь email');
  const client=clientFactory(authState.session, { requestRetries:2 });
  try {
    await withTimeout(client.connect(),8000,'Telegram auth connect');
    await withTimeout(client.invoke(new Api.account.SendVerifyEmailCode({email:value,
      purpose:new Api.EmailVerifyPurposeLoginSetup({phoneNumber:authState.phone,phoneCodeHash:authState.phoneCodeHash})})),AUTH_RPC_MS,'Telegram login email');
    // Do not persist the address or verification code; the encrypted challenge
    // contains only Telegram's auth state and the next step.
    return {...authState,session:client.session.save(),delivery:'email_setup_code',
      canResend:false,nextDelivery:null,resendAvailableAt:null};
  } finally {await disconnectAuth(client);}
}

export async function verifyUserPassword(authState, password, {clientFactory=newClient}={}) {
  const value = String(password || '');
  if (!value) throw new Error('Введите пароль двухэтапной аутентификации');

  const { apiId, apiHash } = credentials();
  const client = clientFactory(authState.session, { requestRetries: 2 });
  try {
    await withTimeout(client.connect(), 8000, 'Telegram auth connect');
    const user = await withTimeout(client.signInWithPassword(
      { apiId, apiHash },
      {
        password: async () => value,
        // Preserve PASSWORD_HASH_INVALID/FLOOD_WAIT instead of the SDK's
        // generic AUTH_USER_CANCEL wrapper, and never loop password attempts.
        onError: async error => { throw error; },
      },
    ), AUTH_RPC_MS, 'Telegram 2FA');
    return {
      session: client.session.save(),
      user: normalizeUser(user),
    };
  } finally {
    await disconnectAuth(client);
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

export async function createViewerClient(session, options = {}) {
  const client = newClient(session, options);
  const timeoutMs = Math.max(1000, Math.min(15000, Number(options.timeoutMs || VIEWER_CONNECT_TIMEOUT_MS)));
  try {
    await withTimeout(client.connect(), timeoutMs, 'Telegram connect');
    const authorized = await withTimeout(
      client.checkAuthorization(),
      Math.min(VIEWER_RPC_TIMEOUT_MS, timeoutMs),
      'Telegram authorization check',
    );
    if (!authorized) throw new Error('Telegram user session is no longer authorized');
    return client;
  } catch (error) {
    await Promise.race([
      client.disconnect().catch(() => {}),
      new Promise(resolve => setTimeout(resolve, 750)),
    ]).catch(() => {});
    throw error;
  }
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

export async function fetchStoryViewState(client, storyId, options = {}) {
  const deadlineAt = Number(options.deadlineAt || (Date.now() + VIEWER_STORY_DEADLINE_MS));
  const perCallTimeoutMs = Math.max(1000, Math.min(
    VIEWER_RPC_TIMEOUT_MS,
    Number(options.perCallTimeoutMs || VIEWER_RPC_TIMEOUT_MS),
  ));

  const peer = await withTimeout(
    client.getInputEntity('me'),
    boundedTimeout(deadlineAt, perCallTimeoutMs),
    'Telegram peer lookup',
  );

  let aggregate = null;
  try {
    const aggregateResult = await withTimeout(
      client.api.stories.getStoriesViews({
        peer,
        id: [Number(storyId)],
      }),
      boundedTimeout(deadlineAt, perCallTimeoutMs),
      'Telegram aggregate Story views',
    );
    aggregate = aggregateResult?.views?.[0] || null;
  } catch (error) {
    if (error?.code === 'VIEWER_TIMEOUT') throw error;
  }

  const users = new Map();
  const directViews = [];
  let forwardsCount = Number(aggregate?.forwardsCount || 0);
  let reactionsCount = Number(aggregate?.reactionsCount || 0);
  let totalViews = Number(aggregate?.viewsCount || 0);
  let offset = '';
  let pages = 0;

  do {
    const page = await withTimeout(
      client.getStoryViewsList('me', Number(storyId), {
        offset,
        limit: 100,
      }),
      boundedTimeout(deadlineAt, perCallTimeoutMs),
      `Telegram Story viewers page ${pages + 1}`,
    );

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
  } while (offset && pages < VIEWER_MAX_PAGES);

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
