import crypto from 'node:crypto';
import sharp from 'sharp';
import {buildPortalStoryArea} from './story-portal-media-area.js';
import {confirmedBotStoryId} from './vetogram-story-publish-result.js';
import {verifyTelegramClientOwner} from './telegram-owner-runtime.js';

export const STORY_PERIOD_SECONDS = 86400;
const MAX_STORY_BYTES = 10 * 1024 * 1024;
const MAX_SAVED_USERS = 100;

function telegramUrl(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '');
}

function mtprotoConfigured() {
  return Boolean(process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH);
}

async function preparePhoto(buffer) {
  const rotated = await sharp(buffer).rotate().toBuffer();
  const background = await sharp(rotated)
    .resize(1080, 1920, { fit: 'cover', position: 'centre' })
    .blur(28)
    .modulate({ brightness: 0.72, saturation: 0.9 })
    .jpeg({ quality: 82 })
    .toBuffer();

  const foreground = await sharp(rotated)
    .resize(1080, 1920, { fit: 'inside', withoutEnlargement: false })
    .jpeg({ quality: 94, mozjpeg: true })
    .toBuffer();
  const meta = await sharp(foreground).metadata();
  const width = meta.width || 1080;
  const height = meta.height || 1920;

  const out = await sharp(background)
    .composite([{
      input: foreground,
      left: Math.max(0, Math.floor((1080 - width) / 2)),
      top: Math.max(0, Math.floor((1920 - height) / 2)),
    }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  if (out.length > MAX_STORY_BYTES) throw new Error('Готовое фото превышает лимит Telegram 10 MB');
  return out;
}

async function postPhotoStoryBotApi(token, businessConnectionId, imageBuffer, caption = '', protect = false, portalLink = null) {
  const prepared = await preparePhoto(imageBuffer);
  const form = new FormData();
  form.set('business_connection_id', businessConnectionId);
  form.set('content', JSON.stringify({ type: 'photo', photo: 'attach://story' }));
  form.set('active_period', String(STORY_PERIOD_SECONDS));
  if (caption) form.set('caption', caption.slice(0, 2048));
  if (protect) form.set('protect_content', 'true');
  if (portalLink) form.set('areas', JSON.stringify(buildPortalStoryArea(portalLink)));
  form.set('story', new Blob([prepared], { type: 'image/jpeg' }), 'story.jpg');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let response;
  try {
    response = await fetch(telegramUrl(token, 'postStory'), {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Telegram слишком долго отвечает. Попробуй ещё раз.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  let data;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || !data?.ok) {
    const err = new Error(data?.description || `postStory failed: ${response.status}`);
    err.telegram = data;
    throw err;
  }
  return { id: confirmedBotStoryId(data), transport: 'bot-api' };
}

async function resolveUsers(client, Api, usernames) {
  const users = [];
  const skipped = [];
  const unique = [...new Set((usernames || []).map(normalizeUsername).filter(Boolean))].slice(0, MAX_SAVED_USERS);
  const batchSize = 5;

  for (let offset = 0; offset < unique.length; offset += batchSize) {
    const batch = unique.slice(offset, offset + batchSize);
    const results = await Promise.all(batch.map(async (username) => {
      try {
        const resolved = await client.invoke(new Api.contacts.ResolveUsername({ username }));
        const user = resolved?.users?.find(item => item?.accessHash !== undefined) || resolved?.users?.[0];
        if (!user?.id) throw new Error(`Не удалось найти @${username}`);
        return {
          username,
          input: new Api.InputUser({ userId: user.id, accessHash: user.accessHash ?? BigInt(0) }),
        };
      } catch (error) {
        const description = error?.errorMessage || error?.message || String(error);
        if (/USERNAME_NOT_OCCUPIED|USERNAME_INVALID|Не удалось найти/i.test(description)) {
          return { username, skipped: true };
        }
        throw error;
      }
    }));

    for (const result of results) {
      if (result.skipped) skipped.push(result.username);
      else users.push(result.input);
    }
  }

  return { users, skipped };
}

export async function buildPrivacyRules(client, Api, audience, selected, excluded) {
  const rules = [];
  let skippedExcluded = [];
  let skippedSelected = [];

  if (audience === 'all') {
    rules.push(new Api.InputPrivacyValueAllowAll({}));
    if (excluded?.length) {
      const resolved = await resolveUsers(client, Api, excluded);
      skippedExcluded = resolved.skipped;
      if (resolved.users.length) {
        rules.push(new Api.InputPrivacyValueDisallowUsers({ users: resolved.users }));
      }
    }
  } else if (audience === 'contacts') {
    rules.push(new Api.InputPrivacyValueAllowContacts({}));
    if (excluded?.length) {
      const resolved = await resolveUsers(client, Api, excluded);
      skippedExcluded = resolved.skipped;
      if (resolved.users.length) {
        rules.push(new Api.InputPrivacyValueDisallowUsers({ users: resolved.users }));
      }
    }
  } else if (audience === 'close') {
    rules.push(new Api.InputPrivacyValueAllowCloseFriends({}));
  } else if (audience === 'selected') {
    if (!selected?.length) throw new Error('Список выбранных людей пуст');
    const resolved = await resolveUsers(client, Api, selected);
    skippedSelected = resolved.skipped;
    if (!resolved.users.length) {
      throw new Error('Список выбранных людей больше не актуален. Добавь людей заново.');
    }
    rules.push(new Api.InputPrivacyValueAllowUsers({ users: resolved.users }));
  } else {
    throw new Error(`Неизвестный режим аудитории: ${audience}`);
  }

  return { rules, skippedExcluded, skippedSelected };
}

function privacyClassNames(story) {
  return (story?.privacy || []).map(rule => String(rule?.className || rule?.constructor?.name || '')).filter(Boolean);
}

export function storyMatchesAudience(story, audience) {
  const privacy = privacyClassNames(story);
  if (audience === 'all') {
    return Boolean(story?.public) || privacy.some(name => /PrivacyValueAllowAll/i.test(name));
  }
  if (audience === 'contacts') {
    return Boolean(story?.contacts) || privacy.some(name => /PrivacyValueAllowContacts/i.test(name));
  }
  if (audience === 'close') {
    return Boolean(story?.closeFriends) || privacy.some(name => /PrivacyValueAllowCloseFriends/i.test(name));
  }
  if (audience === 'selected') {
    return Boolean(story?.selectedContacts) || privacy.some(name => /PrivacyValueAllowUsers/i.test(name));
  }
  return true;
}

async function verifyStoryPrivacy(client, peer, storyId, audience) {
  if (audience === 'standard') return { verified: true, audience };
  try {
    const result = await client.api.stories.getStoriesByID({
      peer,
      id: [Number(storyId)],
    });
    const story = result?.stories?.find(item => Number(item?.id) === Number(storyId)) || result?.stories?.[0] || null;
    if (!story) return { verified: false, audience, reason: 'story_not_returned' };
    return {
      verified: storyMatchesAudience(story, audience),
      audience,
      flags: {
        public: Boolean(story.public),
        contacts: Boolean(story.contacts),
        closeFriends: Boolean(story.closeFriends),
        selectedContacts: Boolean(story.selectedContacts),
      },
      privacy: privacyClassNames(story),
    };
  } catch (error) {
    return {
      verified: false,
      audience,
      reason: error?.errorMessage || error?.message || String(error),
    };
  }
}

function deterministicRandomId(connectionId, nonce) {
  const digest = crypto.createHash('sha256')
    .update(`${connectionId}:${nonce}`)
    .digest();
  return digest.readBigInt64BE(0);
}

async function postPhotoStoryMtproto(token, connectionId, imageBuffer, caption, audience, selected, excluded, nonce, protect = false) {
  if (!mtprotoConfigured()) throw new Error('Расширенная приватность не настроена');

  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = String(process.env.TELEGRAM_API_HASH || '');
  const [{ TelegramClient, Api }, { StringSession }, { CustomFile }] = await Promise.all([
    import('teleproto'),
    import('teleproto/sessions/index.js'),
    import('teleproto/client/uploads.js'),
  ]);

  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 3,
    useWSS: false,
  });

  try {
    await client.start({
      botAuthToken: token,
      onError: error => console.error('Story Pilot app publish MTProto auth error', error),
    });

    const updates = await client.invoke(new Api.account.GetBotBusinessConnection({ connectionId }));
    const update = updates?.updates?.find(item => item?.connection?.connectionId === connectionId);
    const userId = update?.connection?.userId;
    if (!userId) throw new Error('Не удалось определить подключённый аккаунт');

    const businessUser = updates?.users?.find(item => String(item?.id) === String(userId));
    const peer = new Api.InputPeerUser({
      userId,
      accessHash: businessUser?.accessHash ?? BigInt(0),
    });

    const privacy = await buildPrivacyRules(client, Api, audience, selected, excluded);
    const prepared = await preparePhoto(imageBuffer);
    const uploaded = await client.uploadFile({
      file: new CustomFile('story.jpg', prepared.length, '', prepared),
      workers: 1,
    });

    const randomId = deterministicRandomId(connectionId, nonce);

    const result = await client.invoke(new Api.stories.SendStory({
      peer,
      media: new Api.InputMediaUploadedPhoto({ file: uploaded }),
      caption: caption ? caption.slice(0, 2048) : undefined,
      privacyRules: privacy.rules,
      randomId,
      period: STORY_PERIOD_SECONDS,
      noforwards: Boolean(protect),
    }));

    const idUpdate = result?.updates?.find(item =>
      item?.className === 'UpdateStoryID'
      || item?.randomId?.toString?.() === randomId.toString()
    );
    const storyUpdate = result?.updates?.find(item => item?.story?.id);

    let storyId = idUpdate?.id ?? storyUpdate?.story?.id ?? null;

    // An absent storyId is NOT evidence that the owner's latest Story is ours.
    // Guessing the newest ID risks confirming or deleting an unrelated Story.
    if (!storyId) throw new Error('STORY_PUBLISH_RESULT_UNCERTAIN: Проверь свои Stories в Telegram. Не публикуй повторно, пока не убедишься в результате.');

    if (!Number.isInteger(Number(storyId)) || Number(storyId) <= 0) {
      throw new Error('Telegram опубликовал Story, но не вернул её ID. Повтори действие через несколько секунд.');
    }

    const privacyVerification = await verifyStoryPrivacy(client, peer, Number(storyId), audience);

    if (!privacyVerification.verified) {
      // Privacy-sensitive publishing fails closed: remove a Story whose audience
      // cannot be confirmed instead of risking a wider audience than requested.
      await client.api.stories.deleteStories({
        peer,
        id: [Number(storyId)],
      }).catch(() => {});
      const error = new Error(`STORY_PRIVACY_MISMATCH:${audience}`);
      error.privacyVerification = privacyVerification;
      throw error;
    }

    return {
      id: Number(storyId),
      transport: 'mtproto',
      skippedExcluded: privacy.skippedExcluded,
      skippedSelected: privacy.skippedSelected,
      privacyVerified: true,
      verifiedAudience: audience,
    };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

function isTransientMtprotoError(error) {
  const description = String(error?.errorMessage || error?.message || error || '');
  return /ETIMEDOUT|ECONNRESET|EAI_AGAIN|socket hang up|connection closed|timed out|network error/i.test(description)
    && !/FLOOD_WAIT|STORY_SEND_FLOOD/i.test(description);
}

async function postPhotoStoryMtprotoWithRetry(...args) {
  try {
    return await postPhotoStoryMtproto(...args);
  } catch (error) {
    if (!isTransientMtprotoError(error)) throw error;
    return postPhotoStoryMtproto(...args);
  }
}

export async function publishPhotoStory({
  token,
  businessConnectionId,
  imageBuffer,
  caption = '',
  audience = 'standard',
  selected = [],
  excluded = [],
  nonce,
  protect = false,
  portalLink = null,
}) {
  if (portalLink && audience !== 'standard') throw Error('STORY_PORTAL_REQUIRES_STANDARD_BUSINESS');
  if (audience === 'standard') {
    return postPhotoStoryBotApi(token, businessConnectionId, imageBuffer, caption, protect, portalLink);
  }

  return postPhotoStoryMtprotoWithRetry(
    token,
    businessConnectionId,
    imageBuffer,
    caption,
    audience,
    selected,
    excluded,
    nonce,
    protect,
  );
}


export async function publishPhotoStoryUserSession({
  session,
  ownerId,
  imageBuffer,
  caption = '',
  audience = 'contacts',
  selected = [],
  excluded = [],
  nonce,
  protect = false,
}) {
  if (!mtprotoConfigured()) throw new Error('Telegram account connection is not configured');
  if (!session) throw new Error('Telegram account is not connected');
  if (!/^\d{1,20}$/.test(String(ownerId||''))) throw new Error('TELEGRAM_OWNER_UNVERIFIED');

  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = String(process.env.TELEGRAM_API_HASH || '');
  const [{ TelegramClient, Api }, { StringSession }, { CustomFile }] = await Promise.all([
    import('teleproto'),
    import('teleproto/sessions/index.js'),
    import('teleproto/client/uploads.js'),
  ]);

  const client = new TelegramClient(new StringSession(String(session)), apiId, apiHash, {
    connectionRetries: 3,
    useWSS: false,
  });

  try {
    await client.connect();
    const authorized = await client.checkAuthorization();
    if (!authorized) throw new Error('Telegram account session is no longer authorized');
    // The encrypted-session row is not sufficient: verify the live account
    // identity against the Telegram Mini App owner before uploading media.
    await verifyTelegramClientOwner(client, String(ownerId));

    const peer = await client.getInputEntity('me');
    // "standard" depended on Business Bot API defaults. For a direct user session
    // we fail to the safer Contacts audience instead of widening visibility.
    const effectiveAudience = audience === 'standard' ? 'contacts' : audience;
    const privacy = await buildPrivacyRules(client, Api, effectiveAudience, selected, excluded);
    const prepared = await preparePhoto(imageBuffer);
    const uploaded = await client.uploadFile({
      file: new CustomFile('story.jpg', prepared.length, '', prepared),
      workers: 1,
    });

    const randomId = deterministicRandomId('veto-user-session', nonce || crypto.randomUUID());
    const result = await client.invoke(new Api.stories.SendStory({
      peer,
      media: new Api.InputMediaUploadedPhoto({ file: uploaded }),
      caption: caption ? caption.slice(0, 2048) : undefined,
      privacyRules: privacy.rules,
      randomId,
      period: STORY_PERIOD_SECONDS,
      noforwards: Boolean(protect),
    }));

    const idUpdate = result?.updates?.find(item =>
      item?.className === 'UpdateStoryID'
      || item?.randomId?.toString?.() === randomId.toString()
    );
    const storyUpdate = result?.updates?.find(item => item?.story?.id);
    let storyId = idUpdate?.id ?? storyUpdate?.story?.id ?? null;

    // An absent storyId is NOT evidence that the owner's latest Story is ours.
    // Guessing the newest ID risks confirming or deleting an unrelated Story.
    if (!storyId) throw new Error('STORY_PUBLISH_RESULT_UNCERTAIN: Проверь свои Stories в Telegram. Не публикуй повторно, пока не убедишься в результате.');

    if (!Number.isInteger(Number(storyId)) || Number(storyId) <= 0) {
      throw new Error('Telegram опубликовал Story, но не вернул её ID. Повтори действие через несколько секунд.');
    }

    const privacyVerification = await verifyStoryPrivacy(client, peer, Number(storyId), effectiveAudience);
    if (!privacyVerification.verified) {
      await client.api.stories.deleteStories({ peer, id: [Number(storyId)] }).catch(() => {});
      const error = new Error(`STORY_PRIVACY_MISMATCH:${effectiveAudience}`);
      error.privacyVerification = privacyVerification;
      throw error;
    }

    return {
      id: Number(storyId),
      transport: 'user-session',
      skippedExcluded: privacy.skippedExcluded,
      skippedSelected: privacy.skippedSelected,
      privacyVerified: true,
      verifiedAudience: effectiveAudience,
    };
  } finally {
    await client.disconnect().catch(() => {});
  }
}


export async function deleteStoryUserSession({ session, storyId }) {
  if (!mtprotoConfigured()) throw new Error('Telegram account connection is not configured');
  if (!session) throw new Error('Telegram account is not connected');
  const id = Number(storyId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid Story ID');

  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = String(process.env.TELEGRAM_API_HASH || '');
  const [{ TelegramClient }, { StringSession }] = await Promise.all([
    import('teleproto'),
    import('teleproto/sessions/index.js'),
  ]);
  const client = new TelegramClient(new StringSession(String(session)), apiId, apiHash, {
    connectionRetries: 3,
    useWSS: false,
  });

  try {
    await client.connect();
    const authorized = await client.checkAuthorization();
    if (!authorized) throw new Error('Telegram account session is no longer authorized');
    const peer = await client.getInputEntity('me');
    await client.api.stories.deleteStories({ peer, id: [id] });
    return { deleted: true, id, transport: 'user-session' };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

export function friendlyPublishError(description = '') {
  const d = String(description);
  if (/PREMIUM_ACCOUNT_REQUIRED/i.test(d)) return 'Telegram требует Premium для этой публикации на данном аккаунте.';
  if (/STORIES_TOO_MUCH/i.test(d)) return 'Достигнут лимит активных Stories. Удали одну Story или дождись, пока старая истечёт.';
  if (/STORY_SEND_FLOOD_WEEKLY/i.test(d)) return 'Достигнут недельный лимит Stories для этого аккаунта.';
  if (/STORY_SEND_FLOOD_MONTHLY/i.test(d)) return 'Достигнут месячный лимит Stories для этого аккаунта.';
  if (/STORY_SEND_FLOOD|FLOOD_WAIT/i.test(d)) return 'Telegram временно ограничил публикации. Нужно подождать.';
  if (/BUSINESS_CONNECTION_INVALID|Business connection is disabled/i.test(d)) return 'Business-подключение Telegram устарело или отключено.';
  if (/session is no longer authorized|AUTH_KEY_UNREGISTERED|SESSION_REVOKED/i.test(d)) return 'Подключение Telegram истекло. Подключи аккаунт заново через QR или номер.';
  if (/can_manage_stories|Нет права/i.test(d)) return 'Нет разрешения «Управление историями».';
  if (/PHOTO_INVALID_DIMENSIONS|IMAGE_PROCESS_FAILED|unsupported image format/i.test(d)) return 'Telegram не принял изображение. Попробуй JPG, PNG или WEBP.';
  if (/STORY_PRIVACY_MISMATCH:contacts/i.test(d)) return 'Telegram не подтвердил режим «Контакты», поэтому Story автоматически удалена и не была оставлена с неправильной аудиторией. Попробуй ещё раз.';
  if (/STORY_PRIVACY_MISMATCH/i.test(d)) return 'Telegram не подтвердил выбранную приватность Story, поэтому публикация автоматически удалена.';
  if (/STORY_PRIVACY_INVALID|PRIVACY/i.test(d)) return 'Telegram не принял выбранную аудиторию. Проверь список людей.';
  if (/BOT_ACCESS_FORBIDDEN/i.test(d)) return 'Telegram запретил эту операцию через текущее Business-подключение.';
  if (/STORY_PUBLISH_RESULT_UNCERTAIN|Story ID|не вернул её ID/i.test(d))
    return 'Telegram не подтвердил ID опубликованной Story. Проверь свои Stories перед повторной отправкой — публикация могла пройти.';
  if (/ETIMEDOUT|ECONNRESET|EAI_AGAIN|socket hang up|network|fetch failed|слишком долго/i.test(d)) {
    return 'Неизвестно, дошла ли публикация до Telegram. Сначала проверь свои Stories, чтобы не опубликовать дубль.';
  }
  if (!d || d.length > 180 || /at \w+|node:|\/var\/task|TypeError|ReferenceError/i.test(d)) {
    return 'Не удалось завершить публикацию. Попробуй ещё раз — настройки и подпись сохранены.';
  }
  return d;
}
