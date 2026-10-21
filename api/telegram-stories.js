import { Api } from 'teleproto';
import { streamStoryMedia } from '../lib/story-media-stream.js';
import { openJson } from '../lib/viewer-sync-crypto.js';
import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { getViewerSession } from '../lib/viewer-sync-store.js';
import { withBackupClient } from '../lib/telegram-history-backup.js';
import { sameTelegramAccount } from '../lib/telegram-session-owner.js';
import { verifyTelegramClientOwner, telegramOwnerError } from '../lib/telegram-owner-runtime.js';
import {
  telegramId, validTelegramId, validStoryId, normalizeContactStories,
  STORY_MEDIA_LIMIT_BYTES, STORY_MAX_PAGES,
} from '../lib/telegram-contact-stories.js';

const BOT = String(process.env.TELEGRAM_BOT_TOKEN || '');
const respond = (res, status, data) => res.status(status).json({ok:status < 400, ...data});
const nowSeconds = () => Math.floor(Date.now() / 1000);

function telegramFailure(error) {
  const owner = telegramOwnerError(error);
  if (owner) return owner;
  const raw = String(error?.errorMessage || error?.message || '');
  if (/FLOOD_WAIT/i.test(raw))
    return {status:429,error:'Telegram временно ограничил загрузку историй. Попробуй позже.'};
  if (/AUTH_KEY|SESSION_REVOKED|not authorized/i.test(raw))
    return {status:409,error:'Telegram-сессия истекла. Подключи аккаунт заново.'};
  if (/STORY_MEDIA_TOO_LARGE/i.test(raw))
    return {status:413,error:'История превышает технический лимит 32 МБ. Открыть её внутри VETO пока нельзя.'};
  return {status:503,error:'Не удалось безопасно загрузить истории Telegram.'};
}

// Strict allowlist: unlike ordinary Telegram clients, Ghost View deliberately
// does not call stories.readStories or stories.incrementStoryViews. Only
// read-only fetch calls are accepted here; media bytes use downloadMedia.
const READ_ONLY_STORY_REQUESTS = new Set([
  Api.stories.GetAllStories, Api.stories.GetStoriesByID,
]);
async function invokeStoryFetch(client, request) {
  if (!READ_ONLY_STORY_REQUESTS.has(request?.constructor))
    throw new Error('STORY_RPC_NOT_ALLOWLISTED');
  return client.invoke(request);
}

async function loadVisibleContactStories(client) {
  let cursor = '';
  const peerStories = [];
  const users = new Map();
  let hasMore = false;
  for (let page = 0; page < STORY_MAX_PAGES; page++) {
    // Initial page is read without a state; pagination requires BOTH state and next.
    const reply = await invokeStoryFetch(client,new Api.stories.GetAllStories(
      page === 0 ? {} : {next:true,state:cursor}
    ));
    for (const u of reply?.users || []) users.set(telegramId(u.id), u);
    peerStories.push(...(reply?.peerStories || []));
    hasMore = Boolean(reply?.hasMore);
    cursor = String(reply?.state || '');
    if (!hasMore || !cursor) break;
  }
  return {peerStories, users:[...users.values()], partial:hasMore};
}

async function ownerSession(ownerId) {
  const stored = await getViewerSession(ownerId);
  if (!stored || stored.status !== 'active' || !stored.session_ciphertext)
    return null;
  if (!sameTelegramAccount(ownerId,stored.telegram_account_user_id)) {
    const error = new Error('TELEGRAM_OWNER_MISMATCH');
    error.code = 'TELEGRAM_OWNER_MISMATCH';
    throw error;
  }
  const creds = await openJson(stored.session_ciphertext,'session:'+ownerId);
  return creds?.session || null;
}

async function downloadContactStory(client, story, user) {
  const entity = await client.getInputEntity(user);
  const fetched = await invokeStoryFetch(client,new Api.stories.GetStoriesByID({
    peer:entity,id:[Number(story.id)],
  }));
  const fresh = (fetched?.stories || []).find(s =>
    Number(s?.id) === Number(story.id) && s?.media &&
    Number(s?.expireDate || 0) > nowSeconds());
  if (!fresh) return null;
  const media = fresh.media;
  const mime = media?.document
    ? String(media.document.mimeType || 'video/mp4').toLowerCase()
    : media?.photo ? 'image/jpeg' : '';
  if (!['image/jpeg','video/mp4','video/webm'].includes(mime)) return null;
  if (Number(media?.document?.size || 0) > STORY_MEDIA_LIMIT_BYTES)
    throw new Error('STORY_MEDIA_TOO_LARGE');
  const raw = await client.downloadMedia(media, {
    progressCallback:(loaded,total) => {
      if (Number(loaded) > STORY_MEDIA_LIMIT_BYTES || Number(total) > STORY_MEDIA_LIMIT_BYTES)
        throw new Error('STORY_MEDIA_TOO_LARGE');
    },
  });
  const buffer = Buffer.isBuffer(raw) ? raw :
    raw instanceof Uint8Array ? Buffer.from(raw) : null;
  if (!buffer?.length || buffer.length > STORY_MEDIA_LIMIT_BYTES)
    throw new Error('STORY_MEDIA_TOO_LARGE');
  return {buffer,mime};
}

export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if (req.method !== 'POST') return respond(res,405,{error:'Method not allowed'});
  if (!BOT) return respond(res,503,{error:'Telegram не настроен'});
  const owner = validateTelegramMiniApp(String(req.headers['x-telegram-init-data'] || ''),BOT);
  if (!owner?.id) return respond(res,401,{error:'Открой VETO внутри Telegram'});
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
  catch { return respond(res,400,{error:'Некорректный запрос'}); }
  const action = String(body.action || 'list');
  if (!['list','media'].includes(action))
    return respond(res,400,{error:'Неизвестная операция'});
  if (action === 'media' && (!validTelegramId(body.userId) || !validStoryId(body.storyId)))
    return respond(res,400,{error:'Неверная история'});
  const ownerId = String(owner.id);
  try {
    const session = await ownerSession(ownerId);
    if (!session) return respond(res,409,{error:'Сначала подключи свой Telegram в VETO.'});
    return await withBackupClient(session,async client => {
      await verifyTelegramClientOwner(client,ownerId);
      const snapshot = await loadVisibleContactStories(client);
      const contacts = normalizeContactStories(snapshot);
      if (action === 'list') {
        return respond(res,200,{
          contacts,partial:snapshot.partial,
          viewMode:'ghost-no-receipt',
          updatedAt:new Date().toISOString(),
        });
      }
      // Client supplies ONLY a contact ID + Story ID. Telegram returns the
      // authoritative visible contact/story set on EACH media request.
      const contact = contacts.find(p => p.userId === String(body.userId));
      const story = contact?.stories.find(s => s.id === Number(body.storyId));
      const user = snapshot.users.find(u => telegramId(u.id) === String(body.userId));
      if (!contact || !story || !user)
        return respond(res,404,{error:'История больше недоступна этому аккаунту.'});
      // AyuGram-style Ghost View: fetching media is separate from marking
      // stories read or incrementing views. Never emit either write RPC here.
      // Reactions/replies are not implemented: those can reveal the viewer.
      const file = await downloadContactStory(client,story,user);
      if (!file) return respond(res,404,{error:'История удалена или недоступна.'});
      // UI requires an explicit no-receipt mode header before rendering media.
      // This is our RPC policy, not a guarantee about other Telegram clients.
      return await streamStoryMedia(res,file.buffer,file.mime);
    });
  } catch(error) {
    const fault = telegramFailure(error);
    return respond(res,fault.status,fault);
  }
}
