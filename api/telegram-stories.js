import { Api } from 'teleproto';
import { openJson } from '../lib/viewer-sync-crypto.js';
import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { getViewerSession } from '../lib/viewer-sync-store.js';
import { withBackupClient } from '../lib/telegram-history-backup.js';
import { sameTelegramAccount } from '../lib/telegram-session-owner.js';
import { verifyTelegramClientOwner, telegramOwnerError } from '../lib/telegram-owner-runtime.js';
import {
  telegramId, validTelegramId, validStoryId, stealthStatus, requireStealth,
  normalizeContactStories, STORY_MEDIA_LIMIT_BYTES, STORY_MAX_PAGES,
} from '../lib/telegram-contact-stories.js';

const BOT = String(process.env.TELEGRAM_BOT_TOKEN || '');
const respond = (res, status, data) => res.status(status).json({ok:status < 400, ...data});
const nowSeconds = () => Math.floor(Date.now() / 1000);

function telegramFailure(error) {
  const owner = telegramOwnerError(error);
  if (owner) return owner;
  const raw = String(error?.errorMessage || error?.message || '');
  if (/PREMIUM_ACCOUNT_REQUIRED/i.test(raw))
    return {status:403,error:'Анонимный просмотр доступен только с Telegram Premium.',reason:'premium'};
  if (/STEALTH_NOT_CONFIRMED/i.test(raw))
    return {status:423,error:'Telegram не подтвердил режим инкогнито. Просмотр заблокирован.',reason:'stealth',
      cooldownUntil:error.cooldownUntil || null};
  if (/FLOOD_WAIT/i.test(raw))
    return {status:429,error:'Telegram пока не разрешает повторно включить инкогнито. Просмотр заблокирован.',reason:'cooldown'};
  if (/AUTH_KEY|SESSION_REVOKED|not authorized/i.test(raw))
    return {status:409,error:'Telegram-сессия истекла. Подключи аккаунт заново.'};
  if (/STORY_MEDIA_TOO_LARGE/i.test(raw))
    return {status:413,error:'История слишком большая для безопасного просмотра внутри Mini App.'};
  return {status:503,error:'Не удалось подтвердить доступ к Stories в Telegram. Просмотр заблокирован.'};
}

async function loadVisibleContactStories(client) {
  let cursor = '';
  const peerStories = [];
  const users = new Map();
  let stealthMode = null;
  let hasMore = false;
  for (let page = 0; page < STORY_MAX_PAGES; page++) {
    // Initial page is read without a state; pagination requires BOTH state and next.
    const reply = await client.invoke(new Api.stories.GetAllStories(
      page === 0 ? {} : {next:true,state:cursor}
    ));
    stealthMode = reply?.stealthMode || stealthMode;
    for (const u of reply?.users || []) users.set(telegramId(u.id), u);
    peerStories.push(...(reply?.peerStories || []));
    hasMore = Boolean(reply?.hasMore);
    cursor = String(reply?.state || '');
    if (!hasMore || !cursor) break;
  }
  return {peerStories, users:[...users.values()], stealthMode, partial:hasMore};
}

async function ensureStealth(client, raw) {
  let mode = raw;
  const now = nowSeconds();
  if (stealthStatus(mode,now).active) return requireStealth(mode,now);
  const state = stealthStatus(mode,now);
  if (!state.canActivate) {
    const error = new Error('STEALTH_NOT_CONFIRMED');
    error.code = 'STEALTH_NOT_CONFIRMED';
    error.cooldownUntil = state.cooldownUntil;
    throw error;
  }
  // Activating a user's official Premium Stealth Mode is the only automatic
  // privacy change. Never infer privacy from media downloads or a timer.
  const updates = await client.invoke(new Api.stories.ActivateStealthMode({past:true,future:true}));
  mode = (updates?.updates || []).find(x => x?.stealthMode)?.stealthMode || null;
  if (!mode) {
    const reply = await client.invoke(new Api.stories.GetAllStories({}));
    mode = reply?.stealthMode;
  }
  return requireStealth(mode,nowSeconds());
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
  const fetched = await client.invoke(new Api.stories.GetStoriesByID({
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
      const status = stealthStatus(snapshot.stealthMode);
      if (action === 'list') {
        const me = await client.getMe();
        return respond(res,200,{
          contacts,partial:snapshot.partial,
          stealth:{...status,premium:me?.premium===true},
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
      // No media or ReadStories/IncrementStoryViews requests until official
      // Premium stealth state has been confirmed on Telegram's own servers.
      const granted = await ensureStealth(client,snapshot.stealthMode);
      const file = await downloadContactStory(client,story,user);
      if (!file) return respond(res,404,{error:'История удалена или недоступна.'});
      // The user can only remain in this viewer while official Stealth Mode
      // is active. Never return a media response when activation failed.
      res.setHeader('X-Veto-Stealth-Until',String(granted.activeUntil));
      res.setHeader('Content-Type',file.mime);
      res.setHeader('Content-Disposition','inline');
      res.setHeader('Content-Length',String(file.buffer.length));
      return res.status(200).end(file.buffer);
    });
  } catch(error) {
    const fault = telegramFailure(error);
    return respond(res,fault.status,fault);
  }
}
