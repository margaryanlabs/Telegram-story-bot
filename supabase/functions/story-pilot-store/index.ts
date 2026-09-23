import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import nacl from "npm:tweetnacl@1.0.3";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VERCEL_PUBLIC_KEY = "FvnaVTxBDvxvK5wFkIxBw_Y_2XxotSphSsh9qh3xfGY";
const MAX_SKEW_MS = 120_000;
const PRIVACY_MEDIA_BUCKET = "story-pilot-ghost-media";
const MAX_PRIVACY_MEDIA_BYTES = 20 * 1024 * 1024;

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}

function b64url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function verifySignedRequest(request: Request, rawBody: string) {
  const timestamp = request.headers.get("x-story-timestamp") ?? "";
  const signature = request.headers.get("x-story-signature") ?? "";
  const ts = Number(timestamp);

  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
    throw new Error("stale_story_signature");
  }

  const publicKey = b64url(VERCEL_PUBLIC_KEY);
  const signatureBytes = b64url(signature);
  if (publicKey.length !== 32 || signatureBytes.length !== 64) {
    throw new Error("invalid_story_signature");
  }

  const message = new TextEncoder().encode(`${timestamp}.${rawBody}`);
  if (!nacl.sign.detached.verify(message, signatureBytes, publicKey)) {
    throw new Error("invalid_story_signature");
  }
}

function need<T>(result: { data: T | null; error: { message?: string } | null }) {
  if (result.error) throw new Error(result.error.message || "database_error");
  return result.data;
}


const DEFAULT_PRIVACY_SETTINGS = {
  antiDelete: false,
  editHistory: false,
  ghostInbox: false,
  notifyDeletes: false,
  retentionDays: 30,
};

function privacyShape(row: any) {
  if (!row) return { ...DEFAULT_PRIVACY_SETTINGS };
  return {
    antiDelete: Boolean(row.anti_delete),
    editHistory: Boolean(row.edit_history),
    ghostInbox: Boolean(row.ghost_inbox),
    notifyDeletes: Boolean(row.notify_deletes),
    retentionDays: Math.max(1, Math.min(3650, Number(row.retention_days || 30))),
  };
}

async function opGetPrivacySettings(args: any) {
  const r = await db.from("story_pilot_privacy_settings")
    .select("anti_delete,edit_history,ghost_inbox,notify_deletes,retention_days")
    .eq("telegram_user_id", String(args.userId))
    .maybeSingle();
  return privacyShape(need(r as any));
}


function storageErrorMessage(error: any) {
  return String(error?.message || error?.error || error || "");
}

async function ensurePrivacyMediaBucket() {
  const existing = await db.storage.getBucket(PRIVACY_MEDIA_BUCKET);
  if (!existing.error && existing.data) return true;

  const message = storageErrorMessage(existing.error);
  if (existing.error && !/not found|404/i.test(message)) {
    throw new Error(message || "privacy_media_bucket_lookup_failed");
  }

  const created = await db.storage.createBucket(PRIVACY_MEDIA_BUCKET, {
    public: false,
    fileSizeLimit: MAX_PRIVACY_MEDIA_BYTES,
  });

  if (created.error && !/already exists|duplicate/i.test(storageErrorMessage(created.error))) {
    throw new Error(storageErrorMessage(created.error) || "privacy_media_bucket_create_failed");
  }
  return true;
}

function mediaExtension(fileName: string | null, mimeType: string | null) {
  const name = String(fileName || "");
  const dot = name.lastIndexOf(".");
  if (dot >= 0 && dot < name.length - 1) {
    return "." + name.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toLowerCase();
  }
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "application/pdf": ".pdf",
  };
  return map[String(mimeType || "").toLowerCase()] || "";
}

async function removePrivacyMediaPaths(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 1000) {
    const batch = unique.slice(i, i + 1000);
    if (!batch.length) continue;
    const removed = await db.storage.from(PRIVACY_MEDIA_BUCKET).remove(batch);
    if (removed.error && !/not found|bucket not found|404/i.test(storageErrorMessage(removed.error))) {
      throw new Error(storageErrorMessage(removed.error) || "privacy_media_remove_failed");
    }
  }
}

async function cleanupPrivacyUser(userId: string, retentionDays: number) {
  const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();

  while (true) {
    const rowsResult = await db.from("story_pilot_messages")
      .select("message_id,media_storage_path")
      .eq("telegram_user_id", userId)
      .lt("sent_at", cutoff)
      .limit(1000);
    const rows = need(rowsResult as any) || [];
    if (!rows.length) break;

    await removePrivacyMediaPaths(rows.map((row: any) => row.media_storage_path).filter(Boolean));

    const ids = rows.map((row: any) => Number(row.message_id)).filter((id: number) => Number.isInteger(id));
    if (!ids.length) break;

    const deleted = await db.from("story_pilot_messages")
      .delete()
      .eq("telegram_user_id", userId)
      .in("message_id", ids);
    need(deleted as any);

    if (rows.length < 1000) break;
  }
}

async function opCreatePrivacyMediaUpload(args: any) {
  const userId = String(args.userId || "");
  const chatId = String(args.chatId || "");
  const messageId = Number(args.messageId || 0);
  if (!userId || !chatId || !Number.isInteger(messageId) || messageId <= 0) {
    throw new Error("invalid_privacy_media_identity");
  }

  const settings = await opGetPrivacySettings({ userId });
  if (!settings.antiDelete) return { allowed: false, reason: "anti_delete_disabled" };

  const rowResult = await db.from("story_pilot_messages")
    .select("content_hash,media_file_id,media_mime_type,media_file_name,media_file_size,media_storage_path,media_archive_status")
    .eq("telegram_user_id", userId)
    .eq("chat_id", chatId)
    .eq("message_id", messageId)
    .maybeSingle();
  const row = need(rowResult as any);
  if (!row?.media_file_id) return { allowed: false, reason: "no_media" };

  const fileSize = Number(row.media_file_size || 0) || null;
  if (fileSize && fileSize > MAX_PRIVACY_MEDIA_BYTES) {
    const tooLarge = await db.from("story_pilot_messages")
      .update({
        media_archive_status: "too_large",
        media_archive_error: "telegram_bot_download_limit",
        updated_at: new Date().toISOString(),
      })
      .eq("telegram_user_id", userId)
      .eq("chat_id", chatId)
      .eq("message_id", messageId);
    need(tooLarge as any);
    return { allowed: false, reason: "too_large" };
  }

  if (row.media_storage_path && row.media_archive_status === "archived") {
    return { allowed: false, reason: "already_archived", path: row.media_storage_path };
  }

  await ensurePrivacyMediaBucket();

  const hash = String(row.content_hash || "media").replace(/[^a-zA-Z0-9]/g, "").slice(0, 24) || "media";
  const ext = mediaExtension(row.media_file_name || null, row.media_mime_type || null);
  const path = [userId, chatId, String(messageId), hash + ext].join("/");

  const pending = await db.from("story_pilot_messages")
    .update({
      media_archive_status: "pending",
      media_archive_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("telegram_user_id", userId)
    .eq("chat_id", chatId)
    .eq("message_id", messageId);
  need(pending as any);

  const signed = await db.storage
    .from(PRIVACY_MEDIA_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(storageErrorMessage(signed.error) || "privacy_media_signed_upload_failed");
  }

  return {
    allowed: true,
    path,
    signedUrl: signed.data.signedUrl,
    mimeType: row.media_mime_type || null,
    fileName: row.media_file_name || null,
    fileSize,
  };
}

async function opFinalizePrivacyMediaArchive(args: any) {
  const userId = String(args.userId || "");
  const chatId = String(args.chatId || "");
  const messageId = Number(args.messageId || 0);
  const archived = Boolean(args.archived);
  const path = args.path ? String(args.path) : null;

  const patch: Record<string, any> = {
    media_archive_status: archived ? "archived" : "failed",
    media_archive_error: archived ? null : String(args.error || "archive_failed").slice(0, 300),
    updated_at: new Date().toISOString(),
  };
  if (archived && path) {
    patch.media_storage_path = path;
    patch.media_archived_at = new Date().toISOString();
  }

  const r = await db.from("story_pilot_messages")
    .update(patch)
    .eq("telegram_user_id", userId)
    .eq("chat_id", chatId)
    .eq("message_id", messageId)
    .select("media_archive_status,media_storage_path,media_archived_at")
    .maybeSingle();
  return need(r as any);
}

async function opCleanupPrivacyRetentionGlobal() {
  await ensurePrivacyMediaBucket();
  const settingsResult = await db.from("story_pilot_privacy_settings")
    .select("telegram_user_id,retention_days")
    .limit(5000);
  const rows = need(settingsResult as any) || [];
  let users = 0;

  for (const row of rows as any[]) {
    await cleanupPrivacyUser(
      String(row.telegram_user_id),
      Math.max(1, Math.min(3650, Number(row.retention_days || 30))),
    );
    users += 1;
  }
  return { users };
}

async function maintenanceSecretAllowed(secret: string) {
  if (!secret) return false;
  const result = await db.rpc("story_pilot_maintenance_secret_ok", { p_secret: secret });
  return Boolean(need(result as any));
}

async function opUpdatePrivacySettings(args: any) {
  const userId = String(args.userId);
  const current = await opGetPrivacySettings({ userId });
  const patch = args.patch || {};
  const next = {
    telegram_user_id: userId,
    anti_delete: patch.antiDelete === undefined ? current.antiDelete : Boolean(patch.antiDelete),
    edit_history: patch.editHistory === undefined ? current.editHistory : Boolean(patch.editHistory),
    ghost_inbox: patch.ghostInbox === undefined ? current.ghostInbox : Boolean(patch.ghostInbox),
    notify_deletes: patch.notifyDeletes === undefined ? current.notifyDeletes : Boolean(patch.notifyDeletes),
    retention_days: Math.max(1, Math.min(3650, Number(patch.retentionDays ?? current.retentionDays ?? 30))),
    updated_at: new Date().toISOString(),
  };

  const r = await db.from("story_pilot_privacy_settings")
    .upsert(next, { onConflict: "telegram_user_id" })
    .select("anti_delete,edit_history,ghost_inbox,notify_deletes,retention_days")
    .single();
  const saved = privacyShape(need(r as any));

  await cleanupPrivacyUser(userId, saved.retentionDays);
  return saved;
}

function privacyEnabled(settings: any) {
  return Boolean(
    settings?.antiDelete
    || settings?.editHistory
    || settings?.ghostInbox
    || settings?.notifyDeletes
  );
}

async function opCaptureBusinessMessage(args: any) {
  const row = args.row || {};
  const userId = String(row.telegram_user_id || args.userId || "");
  if (!userId || !row.chat_id || !row.message_id || !row.business_connection_id) {
    throw new Error("invalid_business_message");
  }

  const settings = await opGetPrivacySettings({ userId });
  if (!privacyEnabled(settings)) return { captured: false, reason: "privacy_disabled" };

  const now = new Date().toISOString();
  const normalized = {
    telegram_user_id: userId,
    business_connection_id: String(row.business_connection_id),
    chat_id: String(row.chat_id),
    message_id: Number(row.message_id),
    direction: row.direction === "outgoing" ? "outgoing" : "incoming",
    sender_user_id: row.sender_user_id ? String(row.sender_user_id) : null,
    sender_username: row.sender_username || null,
    sender_display_name: row.sender_display_name || null,
    chat_title: row.chat_title || null,
    text_content: row.text_content || null,
    caption: row.caption || null,
    media_type: row.media_type || null,
    media_file_id: row.media_file_id || null,
    media_unique_id: row.media_unique_id || null,
    media_mime_type: row.media_mime_type || null,
    media_file_name: row.media_file_name || null,
    media_file_size: Number.isFinite(Number(row.media_file_size)) ? Number(row.media_file_size) : null,
    sent_at: row.sent_at || now,
    edited_at: row.edited_at || null,
    deleted_at: null,
    content_hash: String(row.content_hash || ""),
    updated_at: now,
  };

  if (!normalized.content_hash) throw new Error("missing_message_hash");

  const upsert = await db.from("story_pilot_messages")
    .upsert(normalized, { onConflict: "telegram_user_id,chat_id,message_id" })
    .select("telegram_user_id,chat_id,message_id")
    .single();
  need(upsert as any);

  if (settings.editHistory) {
    const version = {
      telegram_user_id: userId,
      chat_id: String(row.chat_id),
      message_id: Number(row.message_id),
      content_hash: normalized.content_hash,
      event_type: args.eventType === "edit" ? "edit" : "new",
      text_content: normalized.text_content,
      caption: normalized.caption,
      media_type: normalized.media_type,
      media_file_id: normalized.media_file_id,
      media_unique_id: normalized.media_unique_id,
      observed_at: now,
    };
    const vr = await db.from("story_pilot_message_versions")
      .upsert(version, { onConflict: "telegram_user_id,chat_id,message_id,content_hash", ignoreDuplicates: true });
    need(vr as any);
  }

  return { captured: true, settings };
}

async function opMarkBusinessMessagesDeleted(args: any) {
  const userId = String(args.userId || "");
  const chatId = String(args.chatId || "");
  const messageIds = Array.isArray(args.messageIds)
    ? args.messageIds.map((value: any) => Number(value)).filter((value: number) => Number.isInteger(value) && value > 0).slice(0, 100)
    : [];
  if (!userId || !chatId || !messageIds.length) return { affected: 0 };

  const settings = await opGetPrivacySettings({ userId });

  const beforeResult = await db.from("story_pilot_messages")
    .select("message_id,sender_display_name,sender_username,chat_title,text_content,caption,media_type,direction,media_storage_path")
    .eq("telegram_user_id", userId)
    .eq("chat_id", chatId)
    .in("message_id", messageIds);
  const beforeRows = need(beforeResult as any) || [];
  const events = beforeRows.map((row: any) => ({
    messageId: Number(row.message_id),
    sender: row.sender_display_name || (row.sender_username ? "@" + row.sender_username : null),
    chatTitle: row.chat_title || null,
    direction: row.direction || "incoming",
    preview: messagePreview(row),
  }));

  if (!settings.antiDelete) {
    await removePrivacyMediaPaths(
      beforeRows.map((row: any) => row.media_storage_path).filter(Boolean),
    );

    const r = await db.from("story_pilot_messages")
      .delete()
      .eq("telegram_user_id", userId)
      .eq("chat_id", chatId)
      .in("message_id", messageIds)
      .select("message_id");
    return {
      affected: (need(r as any) || []).length,
      retained: false,
      settings,
      events,
    };
  }

  const deletedAt = args.deletedAt || new Date().toISOString();
  const r = await db.from("story_pilot_messages")
    .update({ deleted_at: deletedAt, updated_at: deletedAt })
    .eq("telegram_user_id", userId)
    .eq("chat_id", chatId)
    .in("message_id", messageIds)
    .select("message_id");
  return {
    affected: (need(r as any) || []).length,
    retained: true,
    settings,
    events,
  };
}

function messagePreview(row: any) {
  const text = String(row.text_content || row.caption || "").trim();
  if (text) return text.slice(0, 140);
  if (row.media_type) return "[" + String(row.media_type) + "]";
  return "Сообщение";
}

async function opListPrivacyThreads(args: any) {
  const userId = String(args.userId);
  const settings = await opGetPrivacySettings({ userId });
  if (!privacyEnabled(settings)) return { settings, threads: [] };

  const cutoff = new Date(Date.now() - settings.retentionDays * 86400000).toISOString();
  const r = await db.from("story_pilot_messages")
    .select("chat_id,chat_title,direction,text_content,caption,media_type,media_archive_status,sent_at,edited_at,deleted_at,sender_display_name,sender_username")
    .eq("telegram_user_id", userId)
    .gte("sent_at", cutoff)
    .order("sent_at", { ascending: false })
    .limit(600);
  const rows = need(r as any) || [];

  const byChat = new Map<string, any>();
  for (const row of rows as any[]) {
    const key = String(row.chat_id);
    let thread = byChat.get(key);
    if (!thread) {
      thread = {
        chatId: key,
        title: row.chat_title || row.sender_display_name || (row.sender_username ? "@" + row.sender_username : "Telegram chat"),
        lastAt: row.sent_at,
        preview: messagePreview(row),
        direction: row.direction,
        deletedCount: 0,
        editedCount: 0,
        mediaCount: 0,
        vaultCount: 0,
        messageCount: 0,
      };
      byChat.set(key, thread);
    }
    thread.messageCount += 1;
    if (row.deleted_at) thread.deletedCount += 1;
    if (row.edited_at) thread.editedCount += 1;
    if (row.media_type) thread.mediaCount += 1;
    if (row.media_archive_status === "archived") thread.vaultCount += 1;
  }

  return { settings, threads: [...byChat.values()].slice(0, 60) };
}

async function opListPrivacyMessages(args: any) {
  const userId = String(args.userId);
  const chatId = String(args.chatId);
  const limit = Math.max(1, Math.min(150, Number(args.limit || 80)));
  const settings = await opGetPrivacySettings({ userId });
  if (!privacyEnabled(settings)) return { settings, messages: [] };

  const cutoff = new Date(Date.now() - settings.retentionDays * 86400000).toISOString();
  const r = await db.from("story_pilot_messages")
    .select("chat_id,message_id,direction,sender_user_id,sender_username,sender_display_name,chat_title,text_content,caption,media_type,media_mime_type,media_file_name,media_file_size,media_archive_status,media_archived_at,sent_at,edited_at,deleted_at")
    .eq("telegram_user_id", userId)
    .eq("chat_id", chatId)
    .gte("sent_at", cutoff)
    .order("sent_at", { ascending: false })
    .limit(limit);
  const messages = need(r as any) || [];
  return { settings, messages: [...messages].reverse() };
}

async function opGetPrivacyMediaRef(args: any) {
  const userId = String(args.userId);
  const chatId = String(args.chatId);
  const messageId = Number(args.messageId);
  const settings = await opGetPrivacySettings({ userId });
  if (!privacyEnabled(settings)) return null;

  const r = await db.from("story_pilot_messages")
    .select("media_type,media_file_id,media_mime_type,media_file_name,media_file_size,media_storage_path,media_archive_status,deleted_at")
    .eq("telegram_user_id", userId)
    .eq("chat_id", chatId)
    .eq("message_id", messageId)
    .maybeSingle();
  const row = need(r as any);
  if (!row?.media_file_id && !row?.media_storage_path) return null;

  let vaultUrl: string | null = null;
  if (row.media_storage_path && row.media_archive_status === "archived") {
    await ensurePrivacyMediaBucket();
    const signed = await db.storage
      .from(PRIVACY_MEDIA_BUCKET)
      .createSignedUrl(row.media_storage_path, 90);
    if (!signed.error && signed.data?.signedUrl) {
      vaultUrl = signed.data.signedUrl;
    }
  }

  return {
    mediaType: row.media_type || null,
    fileId: row.media_file_id || null,
    mimeType: row.media_mime_type || null,
    fileName: row.media_file_name || null,
    fileSize: Number(row.media_file_size || 0) || null,
    deletedAt: row.deleted_at || null,
    archiveStatus: row.media_archive_status || "none",
    vaultUrl,
  };
}

async function opGetMessageVersions(args: any) {
  const userId = String(args.userId);
  const chatId = String(args.chatId);
  const messageId = Number(args.messageId);
  const settings = await opGetPrivacySettings({ userId });
  if (!settings.editHistory) return { settings, versions: [] };

  const r = await db.from("story_pilot_message_versions")
    .select("event_type,text_content,caption,media_type,observed_at")
    .eq("telegram_user_id", userId)
    .eq("chat_id", chatId)
    .eq("message_id", messageId)
    .order("observed_at", { ascending: true })
    .limit(50);
  return { settings, versions: need(r as any) || [] };
}

async function opClearPrivacyArchive(args: any) {
  const userId = String(args.userId);
  let deletedCount = 0;

  while (true) {
    const rowsResult = await db.from("story_pilot_messages")
      .select("message_id,media_storage_path")
      .eq("telegram_user_id", userId)
      .limit(1000);
    const rows = need(rowsResult as any) || [];
    if (!rows.length) break;

    await removePrivacyMediaPaths(rows.map((row: any) => row.media_storage_path).filter(Boolean));
    const ids = rows.map((row: any) => Number(row.message_id)).filter((id: number) => Number.isInteger(id));
    if (!ids.length) break;

    const r = await db.from("story_pilot_messages")
      .delete()
      .eq("telegram_user_id", userId)
      .in("message_id", ids)
      .select("message_id");
    deletedCount += (need(r as any) || []).length;
    if (rows.length < 1000) break;
  }

  return { deleted: deletedCount };
}


async function opGetSession(args: any) {
  const r = await db.from("story_pilot_viewer_sessions")
    .select("*")
    .eq("telegram_user_id", String(args.userId))
    .maybeSingle();
  return need(r as any);
}

async function opUpsertSession(args: any) {
  const r = await db.from("story_pilot_viewer_sessions")
    .upsert(args.row, { onConflict: "telegram_user_id" })
    .select("*")
    .single();
  return need(r as any);
}

async function opUpdateSession(args: any) {
  const r = await db.from("story_pilot_viewer_sessions")
    .update(args.patch)
    .eq("telegram_user_id", String(args.userId))
    .select("*")
    .maybeSingle();
  return need(r as any);
}

async function opDeleteSession(args: any) {
  const r = await db.from("story_pilot_viewer_sessions")
    .delete()
    .eq("telegram_user_id", String(args.userId));
  need(r as any);
  return true;
}

async function opGetChallenge(args: any) {
  const r = await db.from("story_pilot_viewer_auth_challenges")
    .select("*")
    .eq("telegram_user_id", String(args.userId))
    .maybeSingle();
  return need(r as any);
}

async function opSaveChallenge(args: any) {
  const r = await db.from("story_pilot_viewer_auth_challenges")
    .upsert(args.row, { onConflict: "telegram_user_id" })
    .select("*")
    .single();
  return need(r as any);
}

async function opDeleteChallenge(args: any) {
  const r = await db.from("story_pilot_viewer_auth_challenges")
    .delete()
    .eq("telegram_user_id", String(args.userId));
  need(r as any);
  return true;
}

async function opTrackStory(args: any) {
  const r = await db.from("story_pilot_stories")
    .upsert(args.row, { onConflict: "telegram_user_id,story_id" })
    .select("*")
    .single();
  return need(r as any);
}

async function opMarkStoryDeleted(args: any) {
  const r = await db.from("story_pilot_stories")
    .update({ active: false, deleted_at: new Date().toISOString() })
    .eq("telegram_user_id", String(args.userId))
    .eq("story_id", Number(args.storyId));
  need(r as any);
  return true;
}

async function opListActiveSessions(args: any) {
  const limit = Math.max(1, Math.min(50, Number(args.limit || 10)));
  const r = await db.from("story_pilot_viewer_sessions")
    .select("*")
    .eq("status", "active")
    .order("last_poll_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  return need(r as any) || [];
}

async function opListStoryArchive(args: any) {
  const limit = Math.max(1, Math.min(100, Number(args.limit || 50)));
  const r = await db.from("story_pilot_stories")
    .select("story_id,posted_at,audience,protected,active,deleted_at,last_views_count,last_identified_count,last_reactions_count,last_forwards_count,last_sync_at,last_error")
    .eq("telegram_user_id", String(args.userId))
    .order("posted_at", { ascending: false })
    .limit(limit);
  return need(r as any) || [];
}

async function opListStories(args: any) {
  const limit = Math.max(1, Math.min(20, Number(args.limit || 8)));
  const r = await db.from("story_pilot_stories")
    .select("*")
    .eq("telegram_user_id", String(args.userId))
    .eq("active", true)
    .gt("watch_until", new Date().toISOString())
    .order("posted_at", { ascending: false })
    .limit(limit);
  return need(r as any) || [];
}

async function opUpdateStoryStats(args: any) {
  const r = await db.from("story_pilot_stories")
    .update(args.patch)
    .eq("telegram_user_id", String(args.userId))
    .eq("story_id", Number(args.storyId))
    .select("*")
    .maybeSingle();
  return need(r as any);
}

async function opListViewerRows(args: any) {
  const r = await db.from("story_pilot_viewers")
    .select("*")
    .eq("telegram_user_id", String(args.userId))
    .eq("story_id", Number(args.storyId))
    .order("first_seen_at", { ascending: true });
  return need(r as any) || [];
}

async function opUpsertViewer(args: any) {
  const r = await db.from("story_pilot_viewers")
    .upsert(args.row, { onConflict: "telegram_user_id,story_id,viewer_user_id" })
    .select("*")
    .single();
  return need(r as any);
}

async function opDeleteViewer(args: any) {
  const r = await db.from("story_pilot_viewers")
    .delete()
    .eq("telegram_user_id", String(args.userId))
    .eq("story_id", Number(args.storyId))
    .eq("viewer_user_id", String(args.viewerUserId));
  need(r as any);
  return true;
}

async function opInsertSnapshot(args: any) {
  const r = await db.from("story_pilot_viewer_snapshots").insert(args.row);
  need(r as any);
  return true;
}

async function opGetStoryData(args: any) {
  const storyResult = await db.from("story_pilot_stories")
    .select("*")
    .eq("telegram_user_id", String(args.userId))
    .eq("story_id", Number(args.storyId))
    .maybeSingle();
  const story = need(storyResult as any);

  const viewersResult = await db.from("story_pilot_viewers")
    .select("viewer_user_id,username,display_name,viewed_at,reaction_json,is_contact")
    .eq("telegram_user_id", String(args.userId))
    .eq("story_id", Number(args.storyId))
    .eq("status", "confirmed")
    .order("viewed_at", { ascending: false })
    .limit(500);
  const viewers = need(viewersResult as any) || [];

  return { story, viewers };
}


async function opGetAnalytics(args: any) {
  const userId = String(args.userId);

  // Keep analytics requests sequential. This project can share a small DB pool with
  // other workloads; parallel PostgREST queries amplify pool saturation during recovery.
  const storiesResult = await db.from("story_pilot_stories")
    .select("story_id,posted_at,last_views_count,last_identified_count,last_reactions_count,last_forwards_count,last_sync_at,active")
    .eq("telegram_user_id", userId)
    .order("posted_at", { ascending: false })
    .limit(100);

  const viewersResult = await db.from("story_pilot_viewers")
    .select("story_id,viewer_user_id,username,display_name,viewed_at,reaction_json,is_contact")
    .eq("telegram_user_id", userId)
    .eq("status", "confirmed")
    .order("viewed_at", { ascending: false })
    .limit(3000);

  const snapshotsResult = await db.from("story_pilot_viewer_snapshots")
    .select("story_id,observed_at,total_views,identified_views,reactions_count,forwards_count")
    .eq("telegram_user_id", userId)
    .order("observed_at", { ascending: false })
    .limit(1000);

  const stories = need(storiesResult as any) || [];
  const viewers = need(viewersResult as any) || [];
  const snapshots = need(snapshotsResult as any) || [];

  const storyMap = new Map(stories.map((story: any) => [String(story.story_id), story]));
  const people = new Map<string, any>();

  for (const row of viewers as any[]) {
    const viewerId = String(row.viewer_user_id);
    const story = storyMap.get(String(row.story_id));
    const postedAt = story?.posted_at ? new Date(story.posted_at).getTime() : NaN;
    const viewedAt = row.viewed_at ? new Date(row.viewed_at).getTime() : NaN;
    const delaySec = Number.isFinite(postedAt) && Number.isFinite(viewedAt)
      ? Math.max(0, Math.round((viewedAt - postedAt) / 1000))
      : null;

    const current = people.get(viewerId) || {
      viewerUserId: viewerId,
      username: row.username || "",
      displayName: row.display_name || "",
      isContact: Boolean(row.is_contact),
      storyIds: new Set<string>(),
      firstSeenAt: row.viewed_at || null,
      lastSeenAt: row.viewed_at || null,
      delayTotal: 0,
      delayCount: 0,
      fast15Count: 0,
      reactions: 0,
    };

    current.storyIds.add(String(row.story_id));
    if (row.username) current.username = row.username;
    if (row.display_name) current.displayName = row.display_name;
    current.isContact = current.isContact || Boolean(row.is_contact);

    if (row.viewed_at) {
      if (!current.firstSeenAt || new Date(row.viewed_at).getTime() < new Date(current.firstSeenAt).getTime()) {
        current.firstSeenAt = row.viewed_at;
      }
      if (!current.lastSeenAt || new Date(row.viewed_at).getTime() > new Date(current.lastSeenAt).getTime()) {
        current.lastSeenAt = row.viewed_at;
      }
    }

    if (delaySec !== null) {
      current.delayTotal += delaySec;
      current.delayCount += 1;
      if (delaySec <= 15 * 60) current.fast15Count += 1;
    }
    if (row.reaction_json) current.reactions += 1;

    people.set(viewerId, current);
  }

  const scoreStoryDenominator = Math.max(1, Math.min(stories.length, 20));
  const nowMs = Date.now();

  const personRows = [...people.values()].map((person: any) => {
    const viewedStories = person.storyIds.size;
    const avgDelaySec = person.delayCount ? Math.round(person.delayTotal / person.delayCount) : null;
    const fast15Rate = person.delayCount ? Math.round((person.fast15Count / person.delayCount) * 100) : null;

    const frequency = Math.min(1, viewedStories / scoreStoryDenominator);
    const latency = fast15Rate === null ? 0 : Math.min(1, Math.max(0, fast15Rate / 100));
    const reactionRate = Math.min(1, person.reactions / Math.max(1, viewedStories));
    const lastSeenMs = person.lastSeenAt ? new Date(person.lastSeenAt).getTime() : 0;
    const ageDays = lastSeenMs > 0 ? Math.max(0, (nowMs - lastSeenMs) / 86400000) : Infinity;
    const recency = ageDays <= 1 ? 1
      : ageDays <= 3 ? 0.8
      : ageDays <= 7 ? 0.6
      : ageDays <= 14 ? 0.4
      : ageDays <= 30 ? 0.2
      : 0;
    const confidence = Math.min(1, viewedStories / 5);
    const rawScore = (frequency * 40) + (latency * 25) + (reactionRate * 15) + (recency * 20);
    const activityScore = Math.round(rawScore * (0.55 + 0.45 * confidence));
    const activityBand = activityScore >= 80 ? "very_high"
      : activityScore >= 60 ? "high"
      : activityScore >= 35 ? "medium"
      : "low";

    return {
      viewerUserId: person.viewerUserId,
      username: person.username,
      displayName: person.displayName,
      isContact: person.isContact,
      viewedStories,
      firstSeenAt: person.firstSeenAt,
      lastSeenAt: person.lastSeenAt,
      avgDelaySec,
      fast15Rate,
      reactions: person.reactions,
      activityScore,
      activityBand,
      scoreConfidence: Math.round(confidence * 100),
      scoreFactors: {
        frequency: Math.round(frequency * 100),
        latency: Math.round(latency * 100),
        reactions: Math.round(reactionRate * 100),
        recency: Math.round(recency * 100),
      },
    };
  }).sort((a: any, b: any) =>
    (b.activityScore - a.activityScore)
    || (b.viewedStories - a.viewedStories)
    || (new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime())
  );

  const uniqueViewers = personRows.length;
  const repeatViewers = personRows.filter((person: any) => person.viewedStories >= 2).length;
  const contacts = personRows.filter((person: any) => person.isContact).length;
  const nonContacts = Math.max(0, uniqueViewers - contacts);

  const delays = personRows
    .map((person: any) => person.avgDelaySec)
    .filter((value: any) => Number.isFinite(value));
  const avgDelaySec = delays.length
    ? Math.round(delays.reduce((sum: number, value: number) => sum + value, 0) / delays.length)
    : null;

  const totalViews = (stories as any[]).reduce((sum, story) => sum + Number(story.last_views_count || 0), 0);
  const identifiedViews = (stories as any[]).reduce((sum, story) => sum + Number(story.last_identified_count || 0), 0);
  const unattributedViews = Math.max(0, totalViews - identifiedViews);
  const reactions = (stories as any[]).reduce((sum, story) => sum + Number(story.last_reactions_count || 0), 0);
  const forwards = (stories as any[]).reduce((sum, story) => sum + Number(story.last_forwards_count || 0), 0);

  const performance = (stories as any[]).map((story) => {
    const storyId = String(story.story_id);
    const postedMs = new Date(story.posted_at).getTime();
    const series = (snapshots as any[])
      .filter((point) => String(point.story_id) === storyId)
      .sort((a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime());

    const milestone = (seconds: number) => {
      if (!Number.isFinite(postedMs) || !series.length) return null;
      const target = postedMs + seconds * 1000;
      const point = series.find((item) => new Date(item.observed_at).getTime() >= target);
      return point ? Number(point.total_views || 0) : null;
    };

    return {
      storyId,
      postedAt: story.posted_at,
      views: Number(story.last_views_count || 0),
      identified: Number(story.last_identified_count || 0),
      reactions: Number(story.last_reactions_count || 0),
      forwards: Number(story.last_forwards_count || 0),
      views5m: milestone(5 * 60),
      views15m: milestone(15 * 60),
      views60m: milestone(60 * 60),
      lastSyncAt: story.last_sync_at || null,
    };
  }).slice(0, 20);

  const latestStory = (stories as any[])[0] || null;
  const latestPostedMs = latestStory?.posted_at ? new Date(latestStory.posted_at).getTime() : NaN;
  const latestTimeline = latestStory
    ? (snapshots as any[])
        .filter((point) => String(point.story_id) === String(latestStory.story_id))
        .sort((a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime())
        .slice(-120)
        .map((point) => {
          const observedMs = new Date(point.observed_at).getTime();
          return {
            observedAt: point.observed_at,
            minutes: Number.isFinite(latestPostedMs) && Number.isFinite(observedMs)
              ? Math.max(0, Math.round((observedMs - latestPostedMs) / 60000))
              : null,
            totalViews: Number(point.total_views || 0),
            identifiedViews: Number(point.identified_views || 0),
            unattributedViews: Math.max(0, Number(point.total_views || 0) - Number(point.identified_views || 0)),
            reactions: Number(point.reactions_count || 0),
            forwards: Number(point.forwards_count || 0),
          };
        })
    : [];

  return {
    storiesTracked: stories.length,
    totalViews,
    identifiedViews,
    unattributedViews,
    uniqueViewers,
    repeatViewers,
    contacts,
    nonContacts,
    reactions,
    forwards,
    avgDelaySec,
    topPeople: personRows.slice(0, 30),
    storyPerformance: performance,
    latestTimelineStoryId: latestStory ? String(latestStory.story_id) : null,
    latestTimeline,
  };
}


async function opGetExport(args: any) {
  const userId = String(args.userId);

  // Export is intentionally sequential for the same reason as analytics: avoid
  // competing with ourselves for PostgREST/Supavisor connections.
  const storiesResult = await db.from("story_pilot_stories")
    .select("story_id,posted_at,expires_at,active,deleted_at,audience,protected,last_views_count,last_identified_count,last_reactions_count,last_forwards_count,last_sync_at")
    .eq("telegram_user_id", userId)
    .order("posted_at", { ascending: false })
    .limit(250);

  const viewersResult = await db.from("story_pilot_viewers")
    .select("story_id,viewer_user_id,username,display_name,viewed_at,first_seen_at,last_seen_at,confirmed_at,is_contact,reaction_json")
    .eq("telegram_user_id", userId)
    .eq("status", "confirmed")
    .order("viewed_at", { ascending: false })
    .limit(3000);

  const stories = need(storiesResult as any) || [];
  const viewers = need(viewersResult as any) || [];

  return { stories, viewers, generatedAt: new Date().toISOString() };
}

async function opAcquireLease(args: any) {
  const seconds = Math.max(10, Math.min(300, Number(args.seconds || 55)));
  const r = await db.rpc("story_pilot_acquire_watch_lease", { p_seconds: seconds });
  return Boolean(need(r as any));
}

function transientStoreError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /schema cache|connection terminated|connection timeout|fetch failed|network|temporar|retrying|PGRST/i.test(message);
}

function databaseOverloadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /PGRST002|schema cache|connection timeout|connection not available|queue timeout|statement timeout/i.test(message);
}

async function dispatchWithRetry(op: string, args: any) {
  const heavyOp = op === "get_analytics" || op === "get_export";
  const waits = heavyOp ? [0] : [0, 350];
  let lastError: unknown = null;

  for (let attempt = 0; attempt < waits.length; attempt += 1) {
    if (waits[attempt] > 0) {
      await new Promise(resolve => setTimeout(resolve, waits[attempt]));
    }

    try {
      return await dispatch(op, args);
    } catch (error) {
      lastError = error;
      // When PostgREST/Supavisor is saturated, immediate retries create a thundering
      // herd and make recovery slower. Fail fast so the app can show degraded state.
      if (databaseOverloadError(error)) throw error;
      if (!transientStoreError(error) || attempt === waits.length - 1) throw error;
      console.warn("story-pilot-store retry", {
        op,
        attempt: attempt + 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw lastError;
}

async function dispatch(op: string, args: any) {
  switch (op) {
    case "health": return { storage: "ok", auth: "ed25519", privacy: "ghost-inbox-v6", mediaProxy: true, mediaVault: true, deleteAlerts: true, vaultVisibility: true, durableArchive: true, vaultOrphanCleanup: true, parallelAnalytics: false, overloadBackoff: true };
    case "get_privacy_settings": return opGetPrivacySettings(args);
    case "update_privacy_settings": return opUpdatePrivacySettings(args);
    case "capture_business_message": return opCaptureBusinessMessage(args);
    case "mark_business_messages_deleted": return opMarkBusinessMessagesDeleted(args);
    case "list_privacy_threads": return opListPrivacyThreads(args);
    case "list_privacy_messages": return opListPrivacyMessages(args);
    case "get_privacy_media_ref": return opGetPrivacyMediaRef(args);
    case "create_privacy_media_upload": return opCreatePrivacyMediaUpload(args);
    case "finalize_privacy_media_archive": return opFinalizePrivacyMediaArchive(args);
    case "cleanup_privacy_retention_global": return opCleanupPrivacyRetentionGlobal();
    case "get_message_versions": return opGetMessageVersions(args);
    case "clear_privacy_archive": return opClearPrivacyArchive(args);
    case "get_session": return opGetSession(args);
    case "upsert_session": return opUpsertSession(args);
    case "update_session": return opUpdateSession(args);
    case "delete_session": return opDeleteSession(args);
    case "get_challenge": return opGetChallenge(args);
    case "save_challenge": return opSaveChallenge(args);
    case "delete_challenge": return opDeleteChallenge(args);
    case "track_story": return opTrackStory(args);
    case "mark_story_deleted": return opMarkStoryDeleted(args);
    case "list_active_sessions": return opListActiveSessions(args);
    case "list_story_archive": return opListStoryArchive(args);
    case "list_stories": return opListStories(args);
    case "update_story_stats": return opUpdateStoryStats(args);
    case "list_viewer_rows": return opListViewerRows(args);
    case "upsert_viewer": return opUpsertViewer(args);
    case "delete_viewer": return opDeleteViewer(args);
    case "insert_snapshot": return opInsertSnapshot(args);
    case "get_story_data": return opGetStoryData(args);
    case "get_analytics": return opGetAnalytics(args);
    case "get_export": return opGetExport(args);
    case "acquire_watch_lease": return opAcquireLease(args);
    default: throw new Error("unknown_operation");
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ ok: false, error: "storage_not_configured" }, 503);

  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody || "{}");
    const op = String(body?.op ?? "");
    const maintenanceSecret = request.headers.get("x-maintenance-secret") ?? "";
    const maintenanceAllowed = maintenanceSecret
      ? await maintenanceSecretAllowed(maintenanceSecret)
      : false;

    if (maintenanceAllowed) {
      if (op !== "cleanup_privacy_retention_global") {
        throw new Error("maintenance_operation_not_allowed");
      }
    } else {
      verifySignedRequest(request, rawBody);
    }

    const data = await dispatchWithRetry(op, body?.args ?? {});
    return json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /signature/.test(message) ? 401 : 500;
    console.error("story-pilot-store", message);
    return json({ ok: false, error: message }, status);
  }
});
