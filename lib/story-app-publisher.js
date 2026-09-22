import crypto from 'node:crypto';
import sharp from 'sharp';

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

async function postPhotoStoryBotApi(token, businessConnectionId, imageBuffer, caption = '', protect = false) {
  const prepared = await preparePhoto(imageBuffer);
  const form = new FormData();
  form.set('business_connection_id', businessConnectionId);
  form.set('content', JSON.stringify({ type: 'photo', photo: 'attach://story' }));
  form.set('active_period', String(STORY_PERIOD_SECONDS));
  if (caption) form.set('caption', caption.slice(0, 2048));
  if (protect) form.set('protect_content', 'true');
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
  return { id: data.result.id, transport: 'bot-api' };
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

async function buildPrivacyRules(client, Api, audience, selected, excluded) {
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

    if (!storyId) {
      try {
        const peerStories = await client.api.stories.getPeerStories({ peer });
        const activeStories = peerStories?.stories?.stories || [];
        const newest = [...activeStories]
          .filter(item => Number.isInteger(Number(item?.id)))
          .sort((a, b) => Number(b.id) - Number(a.id))[0];
        storyId = newest?.id ?? null;
      } catch {}
    }

    if (!Number.isInteger(Number(storyId)) || Number(storyId) <= 0) {
      throw new Error('Telegram опубликовал Story, но не вернул её ID. Повтори действие через несколько секунд.');
    }

    return {
      id: Number(storyId),
      transport: 'mtproto',
      skippedExcluded: privacy.skippedExcluded,
      skippedSelected: privacy.skippedSelected,
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
}) {
  if (audience === 'standard') {
    return postPhotoStoryBotApi(token, businessConnectionId, imageBuffer, caption, protect);
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

export function friendlyPublishError(description = '') {
  const d = String(description);
  if (/PREMIUM_ACCOUNT_REQUIRED/i.test(d)) return 'Telegram требует Premium для этой публикации на данном аккаунте.';
  if (/STORIES_TOO_MUCH/i.test(d)) return 'Достигнут лимит активных Stories. Удали одну Story или дождись, пока старая истечёт.';
  if (/STORY_SEND_FLOOD_WEEKLY/i.test(d)) return 'Достигнут недельный лимит Stories для этого аккаунта.';
  if (/STORY_SEND_FLOOD_MONTHLY/i.test(d)) return 'Достигнут месячный лимит Stories для этого аккаунта.';
  if (/STORY_SEND_FLOOD|FLOOD_WAIT/i.test(d)) return 'Telegram временно ограничил публикации. Нужно подождать.';
  if (/BUSINESS_CONNECTION_INVALID|Business connection is disabled/i.test(d)) return 'Подключение Story Pilot устарело или отключено.';
  if (/can_manage_stories|Нет права/i.test(d)) return 'Нет разрешения «Управление историями».';
  if (/PHOTO_INVALID_DIMENSIONS|IMAGE_PROCESS_FAILED|unsupported image format/i.test(d)) return 'Telegram не принял изображение. Попробуй JPG, PNG или WEBP.';
  if (/STORY_PRIVACY_INVALID|PRIVACY/i.test(d)) return 'Telegram не принял выбранную аудиторию. Проверь список людей.';
  if (/BOT_ACCESS_FORBIDDEN/i.test(d)) return 'Telegram запретил эту операцию через текущее Business-подключение.';
  if (/ETIMEDOUT|ECONNRESET|EAI_AGAIN|socket hang up|network|fetch failed|слишком долго/i.test(d)) {
    return 'Связь с Telegram нестабильна. Попробуй публикацию ещё раз.';
  }
  if (/Story ID|не вернул её ID/i.test(d)) return 'Story опубликована, но Telegram не сразу вернул ID. Подожди несколько секунд и обнови приложение.';
  if (!d || d.length > 180 || /at \w+|node:|\/var\/task|TypeError|ReferenceError/i.test(d)) {
    return 'Не удалось завершить публикацию. Попробуй ещё раз — настройки и подпись сохранены.';
  }
  return d;
}
