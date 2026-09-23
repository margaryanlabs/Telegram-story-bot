import crypto from 'node:crypto';
import {
  captureBusinessMessage,
  markBusinessMessagesDeleted,
} from './viewer-sync-store.js';

function identityLabel(entity = {}) {
  const full = [entity.first_name, entity.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (entity.title) return String(entity.title);
  if (entity.username) return `@${entity.username}`;
  return '';
}

function mediaFromMessage(message = {}) {
  if (Array.isArray(message.photo) && message.photo.length) {
    const item = message.photo[message.photo.length - 1];
    return {
      media_type: 'photo',
      media_file_id: item.file_id || null,
      media_unique_id: item.file_unique_id || null,
      media_mime_type: 'image/jpeg',
      media_file_name: null,
      media_file_size: Number(item.file_size || 0) || null,
    };
  }

  const candidates = [
    ['video', message.video],
    ['voice', message.voice],
    ['audio', message.audio],
    ['document', message.document],
    ['animation', message.animation],
    ['sticker', message.sticker],
    ['video_note', message.video_note],
  ];

  for (const [type, item] of candidates) {
    if (!item?.file_id) continue;
    return {
      media_type: type,
      media_file_id: item.file_id || null,
      media_unique_id: item.file_unique_id || null,
      media_mime_type: item.mime_type || null,
      media_file_name: item.file_name || null,
      media_file_size: Number(item.file_size || 0) || null,
    };
  }

  return {
    media_type: null,
    media_file_id: null,
    media_unique_id: null,
    media_mime_type: null,
    media_file_name: null,
    media_file_size: null,
  };
}

function contentHash(row) {
  return crypto.createHash('sha256').update(JSON.stringify({
    text: row.text_content || '',
    caption: row.caption || '',
    mediaType: row.media_type || '',
    mediaUniqueId: row.media_unique_id || '',
    mediaFileId: row.media_file_id || '',
  })).digest('hex');
}

export function normalizeBusinessMessage(connection, message, eventType = 'new') {
  const ownerChatId = connection?.user_chat_id;
  const chatId = message?.chat?.id;
  const messageId = message?.message_id;
  const connectionId = message?.business_connection_id || connection?.id;

  if (!ownerChatId || !chatId || !messageId || !connectionId) {
    throw new Error('Business message is missing owner/chat/message identity');
  }

  const sender = message.from || {};
  const ownerUserId = connection?.user?.id;
  const direction = ownerUserId && String(sender.id) === String(ownerUserId)
    ? 'outgoing'
    : 'incoming';
  const media = mediaFromMessage(message);

  const row = {
    telegram_user_id: String(ownerChatId),
    business_connection_id: String(connectionId),
    chat_id: String(chatId),
    message_id: Number(messageId),
    direction,
    sender_user_id: sender.id ? String(sender.id) : null,
    sender_username: sender.username || null,
    sender_display_name: identityLabel(sender) || null,
    chat_title: identityLabel(message.chat || {}) || null,
    text_content: message.text || null,
    caption: message.caption || null,
    ...media,
    sent_at: message.date
      ? new Date(Number(message.date) * 1000).toISOString()
      : new Date().toISOString(),
    edited_at: eventType === 'edit'
      ? (message.edit_date
          ? new Date(Number(message.edit_date) * 1000).toISOString()
          : new Date().toISOString())
      : null,
  };

  row.content_hash = contentHash(row);
  return row;
}

export async function archiveBusinessMessage(connection, message, eventType = 'new') {
  const row = normalizeBusinessMessage(connection, message, eventType);
  return captureBusinessMessage(row, eventType);
}

export async function archiveDeletedBusinessMessages(connection, deleted) {
  const ownerChatId = connection?.user_chat_id;
  const chatId = deleted?.chat?.id;
  const messageIds = Array.isArray(deleted?.message_ids) ? deleted.message_ids : [];
  if (!ownerChatId || !chatId || !messageIds.length) {
    return { affected: 0, retained: false };
  }

  return markBusinessMessagesDeleted(
    String(ownerChatId),
    String(chatId),
    messageIds,
    new Date().toISOString(),
  );
}
