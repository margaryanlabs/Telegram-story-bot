import crypto from 'node:crypto';
import {
  captureBusinessMessage,
  createPrivacyMediaUpload,
  finalizePrivacyMediaArchive,
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
  const result = await captureBusinessMessage(row, eventType);
  return { ...result, row };
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


const MAX_GHOST_MEDIA_BYTES = 20 * 1024 * 1024;

async function fetchJsonWithTimeout(url, options, timeoutMs = 6500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => null);
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBufferWithTimeout(url, timeoutMs = 8500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Telegram media HTTP ${response.status}`);
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') || null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function archiveBusinessMediaVault(token, row) {
  if (!row?.media_file_id || !row?.telegram_user_id || !row?.chat_id || !row?.message_id) {
    return { archived: false, reason: 'no_media' };
  }

  const userId = String(row.telegram_user_id);
  const chatId = String(row.chat_id);
  const messageId = Number(row.message_id);

  let spec = null;
  try {
    spec = await createPrivacyMediaUpload(userId, chatId, messageId);
    if (!spec?.allowed) {
      return { archived: false, reason: spec?.reason || 'not_allowed' };
    }

    const fileInfo = await fetchJsonWithTimeout(
      `https://api.telegram.org/bot${token}/getFile`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file_id: row.media_file_id }),
      },
    );

    if (!fileInfo.response.ok || !fileInfo.data?.ok || !fileInfo.data?.result?.file_path) {
      throw new Error(fileInfo.data?.description || `getFile HTTP ${fileInfo.response.status}`);
    }

    const actualSize = Number(fileInfo.data.result.file_size || row.media_file_size || 0);
    if (actualSize > MAX_GHOST_MEDIA_BYTES) {
      throw new Error('telegram_media_too_large');
    }

    const downloaded = await fetchBufferWithTimeout(
      `https://api.telegram.org/file/bot${token}/${fileInfo.data.result.file_path}`,
    );

    if (downloaded.buffer.length > MAX_GHOST_MEDIA_BYTES) {
      throw new Error('telegram_media_too_large');
    }

    const uploadResponse = await fetch(spec.signedUrl, {
      method: 'PUT',
      headers: {
        'content-type': spec.mimeType || downloaded.contentType || row.media_mime_type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: downloaded.buffer,
    });

    if (!uploadResponse.ok) {
      const body = await uploadResponse.text().catch(() => '');
      throw new Error(`privacy_media_upload_http_${uploadResponse.status}${body ? ':' + body.slice(0, 120) : ''}`);
    }

    await finalizePrivacyMediaArchive(userId, chatId, messageId, {
      archived: true,
      path: spec.path,
    });

    return { archived: true, path: spec.path, bytes: downloaded.buffer.length };
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'privacy_media_timeout'
      : String(error?.message || error || 'privacy_media_archive_failed').slice(0, 300);
    try {
      await finalizePrivacyMediaArchive(userId, chatId, messageId, {
        archived: false,
        path: spec?.path || null,
        error: message,
      });
    } catch {}
    console.warn('Story Pilot Ghost media vault skipped', {
      user_id: userId,
      chat_id: chatId,
      message_id: messageId,
      error: message,
    });
    return { archived: false, reason: message };
  }
}
