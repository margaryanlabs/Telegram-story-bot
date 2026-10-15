import crypto from 'node:crypto';
import { createViewerClient } from './viewer-sync-telegram.js';

const MAX_DIALOGS = 55;
const MAX_PAGE = 45;
const MAX_BODY = 12000;
export const HISTORY_MEDIA_LIMIT_BYTES = 5 * 1024 * 1024;
export const HISTORY_MEDIA_PER_PAGE = 2;

function mediaDetails(message) {
  const doc = message?.document || message?.media?.document || null;
  const size = Number(doc?.size || 0);
  const attrs = Array.isArray(doc?.attributes) ? doc.attributes : [];
  const filename = attrs.find(a => /Filename/i.test(a.className || ''))?.fileName || '';
  return {
    mimeType: String(doc?.mimeType || (message?.photo ? 'image/jpeg' : 'application/octet-stream')).slice(0,100),
    fileName: String(filename).replace(/[\\/]/g,'_').slice(0,110) || null,
    size: Number.isSafeInteger(size) && size >= 0 ? size : null,
  };
}

const id = value => String(value?.toString?.() || value || '');
const safeText = value => String(value || '').slice(0, MAX_BODY);

function eligibleDialog(dialog) {
  // Only one-to-one non-bot conversations in v1. Groups, channels, secret chats
  // and Saved Messages are deliberately excluded.
  return Boolean(dialog?.isUser
    && dialog?.entity?.id
    && !dialog.entity.bot
    && !dialog.entity.self
    && !dialog.entity.deleted);
}

function peerDisplay(dialog) {
  return String(dialog.title || [dialog.entity?.firstName, dialog.entity?.lastName].filter(Boolean).join(' ')
    || dialog.entity?.username || 'Telegram контакт').slice(0, 120);
}

export async function withBackupClient(session, handler) {
  const client = await createViewerClient(session, { timeoutMs: 7000 });
  try { return await handler(client); }
  finally { await client.disconnect().catch(() => {}); }
}

async function availablePrivateDialogs(client) {
  const dialogs = await client.getDialogs({ limit: MAX_DIALOGS });
  return dialogs.filter(eligibleDialog);
}

export async function listBackupDialogs(client) {
  const dialogs = await availablePrivateDialogs(client);
  return dialogs.map(dialog => ({
    chatId: id(dialog.id),
    title: peerDisplay(dialog),
    username: String(dialog.entity?.username || '').slice(0, 80),
    type: 'private',
  }));
}

function mediaKind(message) {
  if (message.photo) return 'photo';
  if (!message.media) return null;
  const tag = String(message.media?.className || '');
  if (/Photo/i.test(tag)) return 'photo';
  if (/Document/i.test(tag)) return 'document';
  if (/Geo/i.test(tag)) return 'location';
  return 'attachment';
}

export function normalizeBackupMessage(ownerId, dialog, message, minSentAtMs) {
  const chatId = id(dialog.id);
  const messageId = Number(message.id);
  const sentMs = Number(message.date || 0) * 1000;
  if (!chatId || !Number.isSafeInteger(messageId) || messageId <= 0
      || !Number.isFinite(sentMs) || sentMs < minSentAtMs || sentMs > Date.now() + 120000) {
    return null;
  }
  if (message.className && message.className !== 'Message') return null;
  const text = safeText(message.message || message.text);
  const media = mediaKind(message);
  const details = media ? mediaDetails(message) : null;
  if (!text && !media) return null;
  const outgoing = Boolean(message.out);
  const senderId = outgoing ? ownerId : id(dialog.entity?.id);
  const senderName = outgoing ? 'Вы' : peerDisplay(dialog);
  const contentHash = crypto.createHash('sha256').update(JSON.stringify({
    text, caption:'', mediaType:media || '', messageId,
  })).digest('hex');

  return {
    telegram_user_id: String(ownerId),
    business_connection_id: 'user_session_backup',
    chat_id: chatId,
    message_id: messageId,
    direction: outgoing ? 'outgoing' : 'incoming',
    sender_user_id: senderId || null,
    sender_username: outgoing ? null : String(dialog.entity?.username || '').slice(0, 80) || null,
    sender_display_name: senderName,
    chat_title: peerDisplay(dialog),
    text_content: text || null,
    caption: null,
    media_type: media,
    media_file_id: null, // MTProto IDs are not usable with the Bot API Media Vault.
    media_mime_type: details?.mimeType || null,
    media_file_name: details?.fileName || null,
    media_file_size: details?.size || null,
    sent_at: new Date(sentMs).toISOString(),
    edited_at: message.editDate ? new Date(Number(message.editDate) * 1000).toISOString() : null,
    deleted_at: null,
    content_hash: contentHash,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchBackupPage(client, { ownerId, chatId, offsetId = 0, retentionDays, mediaEnabled = false }) {
  const requested = String(chatId || '');
  if (!/^-?\d{1,22}$/.test(requested)) throw new Error('Неверный идентификатор чата');
  const dialogs = await availablePrivateDialogs(client);
  const selected = dialogs.find(dialog => id(dialog.id) === requested);
  if (!selected) throw new Error('Чат не найден среди доступных личных диалогов этого аккаунта');
  const cursor = Number(offsetId || 0);
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error('Неверная страница архива');

  const allReceived = await client.getMessages(selected.entity, { limit: MAX_PAGE, offsetId: cursor });
  // When media was requested, never silently skip an unprocessed attachment.
  // A page ends just before the third eligible media. Its next cursor will
  // revisit that message on the following call, including for dense photo chats.
  const mediaPositions = [];
  if (mediaEnabled) {
    allReceived.forEach((msg,index) => {
      if (!msg?.photo && !msg?.media) return;
      mediaPositions.push(index);
    });
  }
  const truncatedForMedia = mediaPositions.length > HISTORY_MEDIA_PER_PAGE;
  const received = truncatedForMedia
    ? allReceived.slice(0,mediaPositions[HISTORY_MEDIA_PER_PAGE])
    : allReceived;
  const minSentAtMs = Date.now() - Math.max(1, Math.min(3650, Number(retentionDays || 30))) * 86400000;
  const rows = received.map(item => normalizeBackupMessage(ownerId, selected, item, minSentAtMs)).filter(Boolean);
  const oldest = received.length ? Number(received[received.length - 1].id) : 0;
  const beforeCutoff = received.some(item => Number(item.date || 0) * 1000 < minSentAtMs);
  return {
    mediaCandidates: received.filter(m => Boolean(m?.photo || m?.media))
      .filter(m => rows.some(r => Number(r.message_id) === Number(m.id)))
      .filter(m => {
        const details = mediaDetails(m);
        return details.size === null || details.size <= HISTORY_MEDIA_LIMIT_BYTES;
      }).slice(0, HISTORY_MEDIA_PER_PAGE),
    chatId: requested,
    chatTitle: peerDisplay(selected),
    fetched: received.length,
    eligible: rows.length,
    rows,
    nextOffsetId: oldest > 0 && oldest < (cursor || Number.MAX_SAFE_INTEGER) ? oldest : null,
    hasMore: (truncatedForMedia || allReceived.length >= MAX_PAGE) && !beforeCutoff && oldest > 1
      && (cursor === 0 || oldest < cursor),
    olderThanRetention: beforeCutoff,
  };
}
