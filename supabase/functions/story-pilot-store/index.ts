import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import nacl from "npm:tweetnacl@1.0.3";
import postgres from "npm:postgres@3.4.5";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL") ?? "";
const VERCEL_PUBLIC_KEY = "FvnaVTxBDvxvK5wFkIxBw_Y_2XxotSphSsh9qh3xfGY";
const MAX_SKEW_MS = 120_000;
const PRIVACY_MEDIA_BUCKET = "story-pilot-ghost-media";
const MAX_PRIVACY_MEDIA_BYTES = 20 * 1024 * 1024;

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Direct Postgres bypasses PostgREST schema-cache failures while staying inside
// the same Supabase project / Supavisor pool.
const directSql = SUPABASE_DB_URL ? postgres(SUPABASE_DB_URL, {
  prepare: false,
  max: 1,
  idle_timeout: 3,
  connect_timeout: 5,
}) : null;

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
  notifyDeletes: true,
  notifyEdits: true,
  retentionDays: 30,
};

function privacyShape(row: any) {
  if (!row) return { ...DEFAULT_PRIVACY_SETTINGS };
  return {
    antiDelete: Boolean(row.anti_delete),
    editHistory: Boolean(row.edit_history),
    ghostInbox: Boolean(row.ghost_inbox),
    notifyDeletes: row.notify_deletes !== false,
    notifyEdits: row.notify_edits !== false,
    retentionDays: Math.max(1, Math.min(3650, Number(row.retention_days || 30))),
  };
}

async function opGetPrivacySettings(args: any) {
  const userId = String(args.userId);
  if (directSql) {
    const rows = await directSql`
      select anti_delete, edit_history, ghost_inbox, notify_deletes, notify_edits, retention_days
      from public.story_pilot_privacy_settings
      where telegram_user_id = ${userId}::bigint
      limit 1
    `;
    return privacyShape(rows[0] || null);
  }

  const r = await db.from("story_pilot_privacy_settings")
    .select("anti_delete,edit_history,ghost_inbox,notify_deletes,notify_edits,retention_days")
    .eq("telegram_user_id", userId)
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

  if (directSql) {
    const rows = await directSql`
      update public.story_pilot_messages
      set media_archive_status = ${patch.media_archive_status},
          media_archive_error = ${patch.media_archive_error},
          media_storage_path = case when ${archived} and ${path} is not null then ${path} else media_storage_path end,
          media_archived_at = case when ${archived} and ${path} is not null then now() else media_archived_at end,
          updated_at = now()
      where telegram_user_id = ${userId}::bigint
        and chat_id = ${chatId}::bigint
        and message_id = ${messageId}
      returning media_archive_status, media_storage_path, media_archived_at
    `;
    return rows[0] || null;
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
    notify_edits: patch.notifyEdits === undefined ? current.notifyEdits : Boolean(patch.notifyEdits),
    retention_days: Math.max(1, Math.min(3650, Number(patch.retentionDays ?? current.retentionDays ?? 30))),
    updated_at: new Date().toISOString(),
  };

  let saved;
  if (directSql) {
    const rows = await directSql`
      insert into public.story_pilot_privacy_settings
        (telegram_user_id, anti_delete, edit_history, ghost_inbox, notify_deletes, notify_edits, retention_days, updated_at)
      values
        (${userId}::bigint, ${next.anti_delete}, ${next.edit_history}, ${next.ghost_inbox},
         ${next.notify_deletes}, ${next.notify_edits}, ${next.retention_days}, ${next.updated_at}::timestamptz)
      on conflict (telegram_user_id) do update set
        anti_delete = excluded.anti_delete,
        edit_history = excluded.edit_history,
        ghost_inbox = excluded.ghost_inbox,
        notify_deletes = excluded.notify_deletes,
        notify_edits = excluded.notify_edits,
        retention_days = excluded.retention_days,
        updated_at = excluded.updated_at
      returning anti_delete, edit_history, ghost_inbox, notify_deletes, notify_edits, retention_days
    `;
    saved = privacyShape(rows[0] || null);
  } else {
    const r = await db.from("story_pilot_privacy_settings")
      .upsert(next, { onConflict: "telegram_user_id" })
      .select("anti_delete,edit_history,ghost_inbox,notify_deletes,notify_edits,retention_days")
      .single();
    saved = privacyShape(need(r as any));
  }

  await cleanupPrivacyUser(userId, saved.retentionDays);
  return saved;
}

function privacyEnabled(settings: any) {
  return Boolean(
    settings?.antiDelete
    || settings?.editHistory
    || settings?.ghostInbox
  );
}


async function recordEvent(input: any) {
  if (!directSql) return null;

  const userId = String(input?.userId || "");
  const eventType = String(input?.eventType || "").slice(0, 64);
  const source = String(input?.source || "system").slice(0, 32);
  const dedupeKey = String(input?.dedupeKey || "").slice(0, 240);
  if (!userId || !eventType || !dedupeKey) return null;

  const occurredAt = input?.occurredAt || new Date().toISOString();
  const payload = input?.payload && typeof input.payload === "object"
    ? JSON.stringify(input.payload)
    : "{}";
  const retentionUntil = input?.retentionUntil || null;

  try {
    const rows = await directSql`
      insert into public.story_pilot_events (
        telegram_user_id, event_type, source, occurred_at,
        chat_id, message_id, story_id,
        actor_user_id, actor_username, actor_display_name,
        direction, correlation_key, dedupe_key, payload, retention_until
      ) values (
        ${userId}::bigint, ${eventType}, ${source}, ${occurredAt}::timestamptz,
        ${input?.chatId ? String(input.chatId) : null}::bigint,
        ${input?.messageId ? Number(input.messageId) : null},
        ${input?.storyId ? Number(input.storyId) : null},
        ${input?.actorUserId ? String(input.actorUserId) : null}::bigint,
        ${input?.actorUsername || null},
        ${input?.actorDisplayName || null},
        ${input?.direction || null},
        ${input?.correlationKey || null},
        ${dedupeKey},
        ${payload}::jsonb,
        ${retentionUntil}::timestamptz
      )
      on conflict (telegram_user_id, dedupe_key) do update set
        occurred_at = greatest(public.story_pilot_events.occurred_at, excluded.occurred_at),
        actor_username = coalesce(excluded.actor_username, public.story_pilot_events.actor_username),
        actor_display_name = coalesce(excluded.actor_display_name, public.story_pilot_events.actor_display_name),
        payload = public.story_pilot_events.payload || excluded.payload,
        retention_until = coalesce(excluded.retention_until, public.story_pilot_events.retention_until)
      returning id
    `;
    return rows[0] || null;
  } catch (error) {
    console.warn("Story Pilot Event Vault write skipped", {
      event_type: eventType,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function eventRetention(days: unknown, occurredAt: string) {
  const normalized = Math.max(1, Math.min(365, Number(days || 90)));
  const base = new Date(occurredAt).getTime();
  return new Date((Number.isFinite(base) ? base : Date.now()) + normalized * 86400000).toISOString();
}

async function opListEvents(args: any) {
  const userId = String(args?.userId || "");
  const limit = Math.max(1, Math.min(50, Number(args?.limit || 20)));
  if (!userId || !directSql) return [];

  await directSql`
    delete from public.story_pilot_events
    where telegram_user_id = ${userId}::bigint
      and retention_until is not null
      and retention_until <= now()
  `;

  const rows = await directSql`
    select
      id, event_type, source, occurred_at, chat_id, message_id, story_id,
      actor_user_id, actor_username, actor_display_name, direction,
      correlation_key, payload
    from public.story_pilot_events
    where telegram_user_id = ${userId}::bigint
    order by occurred_at desc, created_at desc
    limit ${limit}
  `;

  return rows.map((row: any) => ({
    id: String(row.id),
    eventType: row.event_type,
    source: row.source,
    occurredAt: row.occurred_at,
    chatId: row.chat_id ? String(row.chat_id) : null,
    messageId: row.message_id == null ? null : Number(row.message_id),
    storyId: row.story_id == null ? null : Number(row.story_id),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    actorUsername: row.actor_username || null,
    actorDisplayName: row.actor_display_name || null,
    direction: row.direction || null,
    correlationKey: row.correlation_key || null,
    payload: row.payload && typeof row.payload === "object" ? row.payload : {},
  }));
}

async function opRecordClientEvent(args: any) {
  const allowedTypes = new Set([
    "session.created",
    "session.revoked",
    "connection.created",
    "connection.revoked",
    "security.event",
  ]);
  const eventType = String(args?.eventType || "");
  if (!allowedTypes.has(eventType)) throw new Error("event_type_not_allowed");

  const userId = String(args?.userId || "");
  if (!userId) throw new Error("event_user_required");

  const occurredAt = args?.occurredAt || new Date().toISOString();
  const correlationKey = String(args?.correlationKey || "security").slice(0, 120);
  const safePayload: Record<string, unknown> = {};
  const inputPayload = args?.payload && typeof args.payload === "object" ? args.payload : {};
  for (const key of ["method", "crypto", "connection", "reason", "status"]) {
    const value = inputPayload[key];
    if (typeof value === "string") safePayload[key] = value.slice(0, 80);
    else if (typeof value === "boolean" || typeof value === "number") safePayload[key] = value;
  }

  const dedupeKey = String(
    args?.dedupeKey
    || `${eventType}:${correlationKey}:${occurredAt}`,
  ).slice(0, 240);

  return recordEvent({
    userId,
    eventType,
    source: "security",
    occurredAt,
    correlationKey,
    dedupeKey,
    payload: safePayload,
    retentionUntil: eventRetention(180, occurredAt),
  });
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

  if (directSql) {
    await directSql`
      insert into public.story_pilot_messages (
        telegram_user_id, business_connection_id, chat_id, message_id, direction,
        sender_user_id, sender_username, sender_display_name, chat_title,
        text_content, caption, media_type, media_file_id, media_unique_id,
        media_mime_type, media_file_name, media_file_size, sent_at, edited_at,
        deleted_at, content_hash, updated_at
      ) values (
        ${userId}::bigint, ${normalized.business_connection_id}, ${normalized.chat_id}::bigint,
        ${normalized.message_id}, ${normalized.direction},
        ${normalized.sender_user_id}::bigint, ${normalized.sender_username},
        ${normalized.sender_display_name}, ${normalized.chat_title},
        ${normalized.text_content}, ${normalized.caption}, ${normalized.media_type},
        ${normalized.media_file_id}, ${normalized.media_unique_id},
        ${normalized.media_mime_type}, ${normalized.media_file_name},
        ${normalized.media_file_size}, ${normalized.sent_at}::timestamptz,
        ${normalized.edited_at}::timestamptz, null, ${normalized.content_hash},
        ${normalized.updated_at}::timestamptz
      )
      on conflict (telegram_user_id, chat_id, message_id) do update set
        business_connection_id = excluded.business_connection_id,
        direction = excluded.direction,
        sender_user_id = excluded.sender_user_id,
        sender_username = excluded.sender_username,
        sender_display_name = excluded.sender_display_name,
        chat_title = excluded.chat_title,
        text_content = excluded.text_content,
        caption = excluded.caption,
        media_type = excluded.media_type,
        media_file_id = excluded.media_file_id,
        media_unique_id = excluded.media_unique_id,
        media_mime_type = excluded.media_mime_type,
        media_file_name = excluded.media_file_name,
        media_file_size = excluded.media_file_size,
        sent_at = excluded.sent_at,
        edited_at = excluded.edited_at,
        content_hash = excluded.content_hash,
        updated_at = excluded.updated_at
    `;
  } else {
    const upsert = await db.from("story_pilot_messages")
      .upsert(normalized, { onConflict: "telegram_user_id,chat_id,message_id" })
      .select("telegram_user_id,chat_id,message_id")
      .single();
    need(upsert as any);
  }

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
    if (directSql) {
      await directSql`
        insert into public.story_pilot_message_versions (
          telegram_user_id, chat_id, message_id, content_hash, event_type,
          text_content, caption, media_type, media_file_id, media_unique_id, observed_at
        ) values (
          ${userId}::bigint, ${String(row.chat_id)}::bigint, ${Number(row.message_id)},
          ${normalized.content_hash}, ${version.event_type}, ${normalized.text_content},
          ${normalized.caption}, ${normalized.media_type}, ${normalized.media_file_id},
          ${normalized.media_unique_id}, ${now}::timestamptz
        )
        on conflict (telegram_user_id, chat_id, message_id, content_hash) do nothing
      `;
    } else {
      const vr = await db.from("story_pilot_message_versions")
        .upsert(version, { onConflict: "telegram_user_id,chat_id,message_id,content_hash", ignoreDuplicates: true });
      need(vr as any);
    }
  }

  const messageEventType = args.eventType === "edit" ? "message.edit" : "message.new";
  await recordEvent({
    userId,
    eventType: messageEventType,
    source: "business",
    occurredAt: normalized.edited_at || normalized.sent_at || now,
    chatId: normalized.chat_id,
    messageId: normalized.message_id,
    actorUserId: normalized.sender_user_id,
    actorUsername: normalized.sender_username,
    actorDisplayName: normalized.sender_display_name,
    direction: normalized.direction,
    correlationKey: `chat:${normalized.chat_id}`,
    dedupeKey: `message:${normalized.chat_id}:${normalized.message_id}:${messageEventType}:${normalized.content_hash}`,
    payload: {
      chatTitle: normalized.chat_title || null,
      mediaType: normalized.media_type || null,
      hasMedia: Boolean(normalized.media_type),
    },
    retentionUntil: eventRetention(settings.retentionDays, normalized.sent_at || now),
  });

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

  let beforeRows: any[] = [];
  if (directSql) {
    beforeRows = await directSql`
      select message_id, sender_display_name, sender_username, chat_title,
             text_content, caption, media_type, direction, media_storage_path
      from public.story_pilot_messages
      where telegram_user_id = ${userId}::bigint
        and chat_id = ${chatId}::bigint
        and message_id = any(${messageIds}::integer[])
    `;
  } else {
    const beforeResult = await db.from("story_pilot_messages")
      .select("message_id,sender_display_name,sender_username,chat_title,text_content,caption,media_type,direction,media_storage_path")
      .eq("telegram_user_id", userId)
      .eq("chat_id", chatId)
      .in("message_id", messageIds);
    beforeRows = need(beforeResult as any) || [];
  }
  const events = beforeRows.map((row: any) => ({
    messageId: Number(row.message_id),
    sender: row.sender_display_name || (row.sender_username ? "@" + row.sender_username : null),
    chatTitle: row.chat_title || null,
    direction: row.direction || "incoming",
    preview: messagePreview(row),
  }));

  const recordDeleteEvents = async (occurredAt: string) => {
    await Promise.all(beforeRows.map((row: any) => recordEvent({
      userId,
      eventType: "message.delete",
      source: "business",
      occurredAt,
      chatId,
      messageId: Number(row.message_id),
      actorUsername: row.sender_username || null,
      actorDisplayName: row.sender_display_name || null,
      direction: row.direction || "incoming",
      correlationKey: `chat:${chatId}`,
      dedupeKey: `message:${chatId}:${Number(row.message_id)}:delete`,
      payload: {
        chatTitle: row.chat_title || null,
        mediaType: row.media_type || null,
        hasMedia: Boolean(row.media_type),
      },
      retentionUntil: eventRetention(settings.retentionDays, occurredAt),
    })));
  };

  if (!settings.antiDelete) {
    await removePrivacyMediaPaths(
      beforeRows.map((row: any) => row.media_storage_path).filter(Boolean),
    );

    let affected = 0;
    if (directSql) {
      const rows = await directSql`
        delete from public.story_pilot_messages
        where telegram_user_id = ${userId}::bigint
          and chat_id = ${chatId}::bigint
          and message_id = any(${messageIds}::integer[])
        returning message_id
      `;
      affected = rows.length;
    } else {
      const r = await db.from("story_pilot_messages")
        .delete()
        .eq("telegram_user_id", userId)
        .eq("chat_id", chatId)
        .in("message_id", messageIds)
        .select("message_id");
      affected = (need(r as any) || []).length;
    }
    await recordDeleteEvents(new Date().toISOString());
    return {
      affected,
      retained: false,
      settings,
      events,
    };
  }

  const deletedAt = args.deletedAt || new Date().toISOString();
  let affected = 0;
  if (directSql) {
    const rows = await directSql`
      update public.story_pilot_messages
      set deleted_at = ${deletedAt}::timestamptz,
          updated_at = ${deletedAt}::timestamptz
      where telegram_user_id = ${userId}::bigint
        and chat_id = ${chatId}::bigint
        and message_id = any(${messageIds}::integer[])
      returning message_id
    `;
    affected = rows.length;
  } else {
    const r = await db.from("story_pilot_messages")
      .update({ deleted_at: deletedAt, updated_at: deletedAt })
      .eq("telegram_user_id", userId)
      .eq("chat_id", chatId)
      .in("message_id", messageIds)
      .select("message_id");
    affected = (need(r as any) || []).length;
  }
  await recordDeleteEvents(deletedAt);
  return {
    affected,
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

function smartThreadSignals(thread: any) {
  const lastAtMs = new Date(thread.lastAt || 0).getTime();
  const ageMinutes = Number.isFinite(lastAtMs)
    ? Math.max(0, Math.floor((Date.now() - lastAtMs) / 60000))
    : 999999;

  const lastIncomingMs = new Date(thread.lastIncomingAt || 0).getTime();
  const lastOutgoingMs = new Date(thread.lastOutgoingAt || 0).getTime();
  const awaitingReply = Number.isFinite(lastIncomingMs)
    && lastIncomingMs > 0
    && (!Number.isFinite(lastOutgoingMs) || lastOutgoingMs <= 0 || lastIncomingMs > lastOutgoingMs);

  const preview = String(thread.preview || "");
  const looksQuestion = thread.direction !== "outgoing" && (
    /[?？]$/.test(preview.trim())
    || /\b(can you|could you|would you|please|need|when|where|what|why|how|можешь|можете|пожалуйста|нужно|надо|когда|где|что|почему|как)\b/i.test(preview)
  );

  let score = 0;
  const reasons: string[] = [];

  if (awaitingReply) {
    score += 38;
    reasons.push("Последнее доступное сообщение входящее");
  }
  if (looksQuestion) {
    score += 16;
    reasons.push("Похоже на вопрос или запрос");
  }
  if (ageMinutes <= 120) {
    score += 18;
    reasons.push("Свежая активность");
  } else if (ageMinutes <= 1440) {
    score += 8;
  }
  if (Number(thread.deletedCount || 0) > 0) {
    score += Math.min(18, 8 + Number(thread.deletedCount || 0) * 2);
    reasons.push("Есть удалённые сообщения");
  }
  if (Number(thread.editedCount || 0) > 0) {
    score += Math.min(12, 5 + Number(thread.editedCount || 0));
    reasons.push("Есть изменённые сообщения");
  }
  if (Number(thread.mediaCount || 0) > 0) score += 3;

  if (thread.direction === "outgoing" && !awaitingReply) {
    score = Math.max(0, score - 18);
  }

  const smartState = score >= 52
    ? "action"
    : score >= 24
      ? "watch"
      : "archive";

  return {
    smartScore: Math.min(100, score),
    smartState,
    smartReasons: reasons.slice(0, 3),
    actionLikely: awaitingReply,
    looksQuestion,
    ageMinutes,
  };
}

async function opListPrivacyThreads(args: any) {
  const userId = String(args.userId);
  const settings = await opGetPrivacySettings({ userId });
  if (!privacyEnabled(settings)) return { settings, threads: [] };

  const cutoff = new Date(Date.now() - settings.retentionDays * 86400000).toISOString();
  let rows: any[] = [];

  if (directSql) {
    rows = await directSql`
      select chat_id, chat_title, direction, text_content, caption, media_type,
             media_archive_status, sent_at, edited_at, deleted_at,
             sender_display_name, sender_username
      from public.story_pilot_messages
      where telegram_user_id = ${userId}::bigint
        and sent_at >= ${cutoff}::timestamptz
      order by sent_at desc
      limit 600
    `;
  } else {
    const r = await db.from("story_pilot_messages")
      .select("chat_id,chat_title,direction,text_content,caption,media_type,media_archive_status,sent_at,edited_at,deleted_at,sender_display_name,sender_username")
      .eq("telegram_user_id", userId)
      .gte("sent_at", cutoff)
      .order("sent_at", { ascending: false })
      .limit(600);
    rows = need(r as any) || [];
  }

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
        incomingCount: 0,
        outgoingCount: 0,
        lastIncomingAt: null,
        lastOutgoingAt: null,
      };
      byChat.set(key, thread);
    }
    thread.messageCount += 1;
    if (row.direction === "outgoing") {
      thread.outgoingCount += 1;
      if (!thread.lastOutgoingAt) thread.lastOutgoingAt = row.sent_at;
    } else {
      thread.incomingCount += 1;
      if (!thread.lastIncomingAt) thread.lastIncomingAt = row.sent_at;
    }
    if (row.deleted_at) thread.deletedCount += 1;
    if (row.edited_at) thread.editedCount += 1;
    if (row.media_type) thread.mediaCount += 1;
    if (row.media_archive_status === "archived") thread.vaultCount += 1;
  }

  const threads = [...byChat.values()]
    .map((thread: any) => ({ ...thread, ...smartThreadSignals(thread) }))
    .slice(0, 60);

  const smartSummary = {
    action: threads.filter((thread: any) => thread.smartState === "action").length,
    watch: threads.filter((thread: any) => thread.smartState === "watch").length,
    archive: threads.filter((thread: any) => thread.smartState === "archive").length,
    likelyNeedsReply: threads.filter((thread: any) => thread.actionLikely).length,
  };

  return { settings, threads, smartSummary };
}

async function opListPrivacyMessages(args: any) {
  const userId = String(args.userId);
  const chatId = String(args.chatId);
  const limit = Math.max(1, Math.min(150, Number(args.limit || 80)));
  const settings = await opGetPrivacySettings({ userId });
  if (!privacyEnabled(settings)) return { settings, messages: [] };

  const cutoff = new Date(Date.now() - settings.retentionDays * 86400000).toISOString();
  let messages: any[] = [];

  if (directSql) {
    messages = await directSql`
      select chat_id, message_id, direction, sender_user_id, sender_username,
             sender_display_name, chat_title, text_content, caption, media_type,
             media_mime_type, media_file_name, media_file_size,
             media_archive_status, media_archived_at, sent_at, edited_at, deleted_at
      from public.story_pilot_messages
      where telegram_user_id = ${userId}::bigint
        and chat_id = ${chatId}::bigint
        and sent_at >= ${cutoff}::timestamptz
      order by sent_at desc
      limit ${limit}
    `;
  } else {
    const r = await db.from("story_pilot_messages")
      .select("chat_id,message_id,direction,sender_user_id,sender_username,sender_display_name,chat_title,text_content,caption,media_type,media_mime_type,media_file_name,media_file_size,media_archive_status,media_archived_at,sent_at,edited_at,deleted_at")
      .eq("telegram_user_id", userId)
      .eq("chat_id", chatId)
      .gte("sent_at", cutoff)
      .order("sent_at", { ascending: false })
      .limit(limit);
    messages = need(r as any) || [];
  }

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

  if (directSql) {
    const versions = await directSql`
      select event_type, text_content, caption, media_type, observed_at
      from public.story_pilot_message_versions
      where telegram_user_id = ${userId}::bigint
        and chat_id = ${chatId}::bigint
        and message_id = ${messageId}
      order by observed_at asc
      limit 50
    `;
    return { settings, versions };
  }

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


function cryptoEnvironment(value: unknown) {
  const environment = String(value || "").trim();
  if (environment === "production" || environment === "preview") return environment;
  throw new Error("invalid_crypto_environment");
}

function encodeB64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function ensureViewerCryptoKey(environment: string) {
  if (!directSql) throw new Error("viewer_crypto_direct_database_required");

  const current = await directSql`
    select key_id, secret_value, status
    from story_pilot_private.crypto_keys
    where purpose = 'viewer_sync_session'
      and environment = ${environment}
      and status = 'active'
    order by created_at desc
    limit 1
  `;
  if (current[0]?.key_id && current[0]?.secret_value) return current[0];

  const keyId = `viewer-sync-${environment}-${crypto.randomUUID()}`;
  try {
    await directSql`
      insert into story_pilot_private.crypto_keys
        (key_id, purpose, environment, secret_value, status)
      values (
        ${keyId},
        'viewer_sync_session',
        ${environment},
        encode(gen_random_bytes(32), 'base64'),
        'active'
      )
    `;
  } catch {
    // A concurrent request can win the unique active-key race.
  }

  const created = await directSql`
    select key_id, secret_value, status
    from story_pilot_private.crypto_keys
    where purpose = 'viewer_sync_session'
      and environment = ${environment}
      and status = 'active'
    order by created_at desc
    limit 1
  `;
  if (!created[0]?.key_id || !created[0]?.secret_value) {
    throw new Error("viewer_crypto_active_key_missing");
  }
  return created[0];
}

async function viewerCryptoKey(environment: string, keyId: string) {
  if (!directSql) throw new Error("viewer_crypto_direct_database_required");
  const rows = await directSql`
    select key_id, secret_value, status
    from story_pilot_private.crypto_keys
    where purpose = 'viewer_sync_session'
      and environment = ${environment}
      and key_id = ${keyId}
      and status in ('active', 'retired')
    limit 1
  `;
  if (!rows[0]?.secret_value) throw new Error("viewer_crypto_key_version_unavailable");
  return rows[0];
}

async function importViewerAesKey(secret: string, keyId: string) {
  const material = new TextEncoder().encode(
    `telegram-control-viewer-sync-v3:${keyId}:${secret}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

function viewerCryptoAad(context: unknown, keyId: string) {
  const normalized = String(context || "global").slice(0, 256);
  return new TextEncoder().encode(
    `story-pilot-viewer-sync:v3:${keyId}:${normalized}`,
  );
}

async function opViewerCryptoHealth(args: any) {
  const environment = cryptoEnvironment(args?.environment);
  const key = await ensureViewerCryptoKey(environment);
  return {
    ready: true,
    version: "v3",
    keyId: String(key.key_id),
    environment,
  };
}

async function opSealViewerPrivateJson(args: any) {
  const environment = cryptoEnvironment(args?.environment);
  const context = String(args?.context || "global").slice(0, 256);
  const plaintext = JSON.stringify(args?.value ?? null);
  if (plaintext.length > 100_000) throw new Error("viewer_crypto_payload_too_large");

  const keyRow = await ensureViewerCryptoKey(environment);
  const keyId = String(keyRow.key_id);
  const key = await importViewerAesKey(String(keyRow.secret_value), keyId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: viewerCryptoAad(context, keyId),
      tagLength: 128,
    },
    key,
    new TextEncoder().encode(plaintext),
  );

  return [
    "v3",
    keyId,
    encodeB64Url(iv),
    encodeB64Url(new Uint8Array(ciphertext)),
  ].join(".");
}

async function opOpenViewerPrivateJson(args: any) {
  const environment = cryptoEnvironment(args?.environment);
  const context = String(args?.context || "global").slice(0, 256);
  const parts = String(args?.ciphertext || "").split(".");
  const [version, keyId, ivB64, ciphertextB64] = parts;
  if (version !== "v3" || !keyId || !ivB64 || !ciphertextB64 || parts.length !== 4) {
    throw new Error("invalid_viewer_crypto_payload");
  }

  const keyRow = await viewerCryptoKey(environment, keyId);
  const key = await importViewerAesKey(String(keyRow.secret_value), keyId);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: b64url(ivB64),
      additionalData: viewerCryptoAad(context, keyId),
      tagLength: 128,
    },
    key,
    b64url(ciphertextB64),
  );

  const text = new TextDecoder().decode(plaintext);
  if (text.length > 100_000) throw new Error("viewer_crypto_plaintext_too_large");
  return JSON.parse(text);
}


async function opGetSession(args: any) {
  const userId = String(args.userId);
  if (directSql) {
    const rows = await directSql`
      select *
      from public.story_pilot_viewer_sessions
      where telegram_user_id = ${userId}::bigint
      limit 1
    `;
    return rows[0] || null;
  }

  const r = await db.from("story_pilot_viewer_sessions")
    .select("*")
    .eq("telegram_user_id", userId)
    .maybeSingle();
  return need(r as any);
}

async function opUpsertSession(args: any) {
  const row = args.row || {};
  const userId = String(row.telegram_user_id || "");
  if (directSql) {
    const rows = await directSql`
      insert into public.story_pilot_viewer_sessions (
        telegram_user_id, session_ciphertext, status, telegram_account_user_id,
        telegram_account_username, telegram_account_first_name, last_poll_at,
        last_error, created_at, updated_at, notify_enabled, notify_anonymous_gap
      ) values (
        ${userId}::bigint,
        ${String(row.session_ciphertext || "")},
        ${String(row.status || "active")},
        ${row.telegram_account_user_id ? String(row.telegram_account_user_id) : null}::bigint,
        ${row.telegram_account_username || null},
        ${row.telegram_account_first_name || null},
        ${row.last_poll_at || null}::timestamptz,
        ${row.last_error ?? null},
        coalesce(${row.created_at || null}::timestamptz, now()),
        coalesce(${row.updated_at || null}::timestamptz, now()),
        ${row.notify_enabled !== false},
        ${row.notify_anonymous_gap !== false}
      )
      on conflict (telegram_user_id) do update set
        session_ciphertext = excluded.session_ciphertext,
        status = excluded.status,
        telegram_account_user_id = excluded.telegram_account_user_id,
        telegram_account_username = excluded.telegram_account_username,
        telegram_account_first_name = excluded.telegram_account_first_name,
        last_poll_at = excluded.last_poll_at,
        last_error = excluded.last_error,
        updated_at = excluded.updated_at,
        notify_enabled = excluded.notify_enabled,
        notify_anonymous_gap = excluded.notify_anonymous_gap
      returning *
    `;
    return rows[0] || null;
  }

  const r = await db.from("story_pilot_viewer_sessions")
    .upsert(row, { onConflict: "telegram_user_id" })
    .select("*")
    .single();
  return need(r as any);
}

async function opUpdateSession(args: any) {
  const userId = String(args.userId);
  const patch = args.patch || {};
  if (directSql) {
    if (typeof patch.session_ciphertext === "string" && patch.session_ciphertext) {
      const rows = await directSql`
        update public.story_pilot_viewer_sessions
        set
          session_ciphertext = ${String(patch.session_ciphertext)},
          updated_at = coalesce(${patch.updated_at || null}::timestamptz, now())
        where telegram_user_id = ${userId}::bigint
        returning *
      `;
      return rows[0] || null;
    }
    const patchJson = JSON.stringify(patch);
    const rows = await directSql`
      with p as (select ${patchJson}::jsonb as j)
      update public.story_pilot_viewer_sessions s
      set
        session_ciphertext = case when p.j ? 'session_ciphertext' then p.j->>'session_ciphertext' else s.session_ciphertext end,
        status = case when p.j ? 'status' then p.j->>'status' else s.status end,
        telegram_account_user_id = case when p.j ? 'telegram_account_user_id' then nullif(p.j->>'telegram_account_user_id','')::bigint else s.telegram_account_user_id end,
        telegram_account_username = case when p.j ? 'telegram_account_username' then p.j->>'telegram_account_username' else s.telegram_account_username end,
        telegram_account_first_name = case when p.j ? 'telegram_account_first_name' then p.j->>'telegram_account_first_name' else s.telegram_account_first_name end,
        last_poll_at = case when p.j ? 'last_poll_at' then nullif(p.j->>'last_poll_at','')::timestamptz else s.last_poll_at end,
        last_error = case when p.j ? 'last_error' then p.j->>'last_error' else s.last_error end,
        updated_at = case when p.j ? 'updated_at' then coalesce(nullif(p.j->>'updated_at','')::timestamptz, now()) else now() end,
        notify_enabled = case when p.j ? 'notify_enabled' then (p.j->>'notify_enabled')::boolean else s.notify_enabled end,
        notify_anonymous_gap = case when p.j ? 'notify_anonymous_gap' then (p.j->>'notify_anonymous_gap')::boolean else s.notify_anonymous_gap end
      from p
      where s.telegram_user_id = ${userId}::bigint
      returning s.*
    `;
    return rows[0] || null;
  }

  const r = await db.from("story_pilot_viewer_sessions")
    .update(patch)
    .eq("telegram_user_id", userId)
    .select("*")
    .maybeSingle();
  return need(r as any);
}

async function opDeleteSession(args: any) {
  const userId = String(args.userId);
  if (directSql) {
    await directSql`
      delete from public.story_pilot_viewer_sessions
      where telegram_user_id = ${userId}::bigint
    `;
    return true;
  }
  const r = await db.from("story_pilot_viewer_sessions")
    .delete()
    .eq("telegram_user_id", userId);
  need(r as any);
  return true;
}

async function opGetChallenge(args: any) {
  const userId = String(args.userId);
  if (directSql) {
    const rows = await directSql`
      select *
      from public.story_pilot_viewer_auth_challenges
      where telegram_user_id = ${userId}::bigint
      limit 1
    `;
    return rows[0] || null;
  }

  const r = await db.from("story_pilot_viewer_auth_challenges")
    .select("*")
    .eq("telegram_user_id", userId)
    .maybeSingle();
  return need(r as any);
}

async function opSaveChallenge(args: any) {
  const row = args.row || {};
  const userId = String(row.telegram_user_id || "");
  if (directSql) {
    const rows = await directSql`
      insert into public.story_pilot_viewer_auth_challenges
        (telegram_user_id, challenge_ciphertext, stage, created_at, expires_at)
      values (
        ${userId}::bigint, ${String(row.challenge_ciphertext || "")},
        ${String(row.stage || "code")}, ${row.created_at}::timestamptz,
        ${row.expires_at}::timestamptz
      )
      on conflict (telegram_user_id) do update set
        challenge_ciphertext = excluded.challenge_ciphertext,
        stage = excluded.stage,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at
      returning *
    `;
    return rows[0] || null;
  }
  const r = await db.from("story_pilot_viewer_auth_challenges")
    .upsert(row, { onConflict: "telegram_user_id" })
    .select("*")
    .single();
  return need(r as any);
}

async function opDeleteChallenge(args: any) {
  const userId = String(args.userId);
  if (directSql) {
    await directSql`
      delete from public.story_pilot_viewer_auth_challenges
      where telegram_user_id = ${userId}::bigint
    `;
    return true;
  }
  const r = await db.from("story_pilot_viewer_auth_challenges")
    .delete()
    .eq("telegram_user_id", userId);
  need(r as any);
  return true;
}

async function opTrackStory(args: any) {
  const row = args.row || {};
  const userId = String(row.telegram_user_id || "");
  const storyId = Number(row.story_id || 0);
  if (directSql) {
    const rows = await directSql`
      insert into public.story_pilot_stories (
        telegram_user_id, story_id, posted_at, expires_at, watch_until, audience,
        protected, active, deleted_at, last_views_count, last_identified_count,
        last_forwards_count, last_reactions_count, last_sync_at, last_error
      ) values (
        ${userId}::bigint, ${storyId}, ${row.posted_at}::timestamptz,
        ${row.expires_at}::timestamptz, ${row.watch_until}::timestamptz,
        ${row.audience || null}, ${Boolean(row.protected)}, ${row.active !== false},
        ${row.deleted_at || null}::timestamptz, ${Number(row.last_views_count || 0)},
        ${Number(row.last_identified_count || 0)}, ${Number(row.last_forwards_count || 0)},
        ${Number(row.last_reactions_count || 0)}, ${row.last_sync_at || null}::timestamptz,
        ${row.last_error ?? null}
      )
      on conflict (telegram_user_id, story_id) do update set
        posted_at = excluded.posted_at,
        expires_at = excluded.expires_at,
        watch_until = excluded.watch_until,
        audience = excluded.audience,
        protected = excluded.protected,
        active = excluded.active,
        deleted_at = excluded.deleted_at,
        last_error = excluded.last_error
      returning *
    `;
    const saved = rows[0] || null;
    await recordEvent({
      userId,
      eventType: "story.publish",
      source: "stories",
      occurredAt: row.posted_at || new Date().toISOString(),
      storyId,
      correlationKey: `story:${storyId}`,
      dedupeKey: `story:${storyId}:publish`,
      payload: {
        audience: row.audience || null,
        protected: Boolean(row.protected),
      },
      retentionUntil: eventRetention(90, row.posted_at || new Date().toISOString()),
    });
    return saved;
  }
  const r = await db.from("story_pilot_stories")
    .upsert(row, { onConflict: "telegram_user_id,story_id" })
    .select("*")
    .single();
  const saved = need(r as any);
  await recordEvent({
    userId,
    eventType: "story.publish",
    source: "stories",
    occurredAt: row.posted_at || new Date().toISOString(),
    storyId,
    correlationKey: `story:${storyId}`,
    dedupeKey: `story:${storyId}:publish`,
    payload: {
      audience: row.audience || null,
      protected: Boolean(row.protected),
    },
    retentionUntil: eventRetention(90, row.posted_at || new Date().toISOString()),
  });
  return saved;
}

async function opMarkStoryDeleted(args: any) {
  const userId = String(args.userId);
  const storyId = Number(args.storyId);
  if (directSql) {
    await directSql`
      update public.story_pilot_stories
      set active = false, deleted_at = now()
      where telegram_user_id = ${userId}::bigint and story_id = ${storyId}
    `;
    await recordEvent({
      userId,
      eventType: "story.delete",
      source: "stories",
      occurredAt: new Date().toISOString(),
      storyId,
      correlationKey: `story:${storyId}`,
      dedupeKey: `story:${storyId}:delete`,
      retentionUntil: eventRetention(90, new Date().toISOString()),
    });
    return true;
  }
  const r = await db.from("story_pilot_stories")
    .update({ active: false, deleted_at: new Date().toISOString() })
    .eq("telegram_user_id", userId)
    .eq("story_id", storyId);
  need(r as any);
  await recordEvent({
    userId,
    eventType: "story.delete",
    source: "stories",
    occurredAt: new Date().toISOString(),
    storyId,
    correlationKey: `story:${storyId}`,
    dedupeKey: `story:${storyId}:delete`,
    retentionUntil: eventRetention(90, new Date().toISOString()),
  });
  return true;
}

async function opListActiveSessions(args: any) {
  const limit = Math.max(1, Math.min(50, Number(args.limit || 10)));
  if (directSql) {
    return await directSql`
      select *
      from public.story_pilot_viewer_sessions
      where status = 'active'
      order by last_poll_at asc nulls first
      limit ${limit}
    `;
  }

  const r = await db.from("story_pilot_viewer_sessions")
    .select("*")
    .eq("status", "active")
    .order("last_poll_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  return need(r as any) || [];
}

async function opListStoryArchive(args: any) {
  const userId = String(args.userId);
  const limit = Math.max(1, Math.min(100, Number(args.limit || 50)));
  if (directSql) {
    return await directSql`
      select story_id, posted_at, audience, protected, active, deleted_at,
             last_views_count, last_identified_count, last_reactions_count,
             last_forwards_count, last_sync_at, last_error
      from public.story_pilot_stories
      where telegram_user_id = ${userId}::bigint
      order by posted_at desc
      limit ${limit}
    `;
  }

  const r = await db.from("story_pilot_stories")
    .select("story_id,posted_at,audience,protected,active,deleted_at,last_views_count,last_identified_count,last_reactions_count,last_forwards_count,last_sync_at,last_error")
    .eq("telegram_user_id", userId)
    .order("posted_at", { ascending: false })
    .limit(limit);
  return need(r as any) || [];
}

async function opListStories(args: any) {
  const userId = String(args.userId);
  const limit = Math.max(1, Math.min(20, Number(args.limit || 8)));
  if (directSql) {
    return await directSql`
      select *
      from public.story_pilot_stories
      where telegram_user_id = ${userId}::bigint
        and active = true
        and watch_until > now()
      order by posted_at desc
      limit ${limit}
    `;
  }

  const r = await db.from("story_pilot_stories")
    .select("*")
    .eq("telegram_user_id", userId)
    .eq("active", true)
    .gt("watch_until", new Date().toISOString())
    .order("posted_at", { ascending: false })
    .limit(limit);
  return need(r as any) || [];
}

async function opUpdateStoryStats(args: any) {
  const userId = String(args.userId);
  const storyId = Number(args.storyId);
  const patch = args.patch || {};
  if (directSql) {
    const patchJson = JSON.stringify(patch);
    const rows = await directSql`
      with p as (select ${patchJson}::jsonb as j)
      update public.story_pilot_stories s
      set
        last_views_count = case when p.j ? 'last_views_count' then (p.j->>'last_views_count')::integer else s.last_views_count end,
        last_identified_count = case when p.j ? 'last_identified_count' then (p.j->>'last_identified_count')::integer else s.last_identified_count end,
        last_forwards_count = case when p.j ? 'last_forwards_count' then (p.j->>'last_forwards_count')::integer else s.last_forwards_count end,
        last_reactions_count = case when p.j ? 'last_reactions_count' then (p.j->>'last_reactions_count')::integer else s.last_reactions_count end,
        last_sync_at = case when p.j ? 'last_sync_at' then nullif(p.j->>'last_sync_at','')::timestamptz else s.last_sync_at end,
        last_error = case when p.j ? 'last_error' then p.j->>'last_error' else s.last_error end,
        active = case when p.j ? 'active' then (p.j->>'active')::boolean else s.active end
      from p
      where s.telegram_user_id = ${userId}::bigint and s.story_id = ${storyId}
      returning s.*
    `;
    return rows[0] || null;
  }
  const r = await db.from("story_pilot_stories")
    .update(patch)
    .eq("telegram_user_id", userId)
    .eq("story_id", storyId)
    .select("*")
    .maybeSingle();
  return need(r as any);
}

async function opListViewerRows(args: any) {
  const userId = String(args.userId);
  const storyId = Number(args.storyId);
  if (directSql) {
    return await directSql`
      select *
      from public.story_pilot_viewers
      where telegram_user_id = ${userId}::bigint
        and story_id = ${storyId}
      order by first_seen_at asc
    `;
  }

  const r = await db.from("story_pilot_viewers")
    .select("*")
    .eq("telegram_user_id", userId)
    .eq("story_id", storyId)
    .order("first_seen_at", { ascending: true });
  return need(r as any) || [];
}

async function opUpsertViewer(args: any) {
  const row = args.row || {};
  const userId = String(row.telegram_user_id || "");
  const storyId = Number(row.story_id || 0);
  const viewerId = String(row.viewer_user_id || "");
  if (directSql) {
    const reactionJson = row.reaction_json == null ? null : JSON.stringify(row.reaction_json);
    const rows = await directSql`
      insert into public.story_pilot_viewers (
        telegram_user_id, story_id, viewer_user_id, status, first_seen_at,
        last_seen_at, viewed_at, confirmed_at, username, display_name,
        is_contact, reaction_json, notification_message_id
      ) values (
        ${userId}::bigint, ${storyId}, ${viewerId}::bigint,
        ${String(row.status || "provisional")}, ${row.first_seen_at}::timestamptz,
        ${row.last_seen_at}::timestamptz, ${row.viewed_at}::timestamptz,
        ${row.confirmed_at || null}::timestamptz, ${row.username || null},
        ${row.display_name || null}, ${Boolean(row.is_contact)},
        ${reactionJson}::jsonb, ${row.notification_message_id ? String(row.notification_message_id) : null}::bigint
      )
      on conflict (telegram_user_id, story_id, viewer_user_id) do update set
        status = excluded.status,
        first_seen_at = excluded.first_seen_at,
        last_seen_at = excluded.last_seen_at,
        viewed_at = excluded.viewed_at,
        confirmed_at = excluded.confirmed_at,
        username = excluded.username,
        display_name = excluded.display_name,
        is_contact = excluded.is_contact,
        reaction_json = excluded.reaction_json,
        notification_message_id = excluded.notification_message_id
      returning *
    `;
    const saved = rows[0] || null;
    await recordEvent({
      userId,
      eventType: `story.view.${String(row.status || "provisional")}`,
      source: "intelligence",
      occurredAt: row.confirmed_at || row.viewed_at || row.last_seen_at || new Date().toISOString(),
      storyId,
      actorUserId: viewerId,
      actorUsername: row.username || null,
      actorDisplayName: row.display_name || null,
      correlationKey: `story:${storyId}`,
      dedupeKey: `story:${storyId}:viewer:${viewerId}:${String(row.status || "provisional")}`,
      payload: {
        status: String(row.status || "provisional"),
        isContact: Boolean(row.is_contact),
        hasReaction: Boolean(row.reaction_json),
      },
      retentionUntil: eventRetention(90, row.viewed_at || new Date().toISOString()),
    });
    return saved;
  }
  const r = await db.from("story_pilot_viewers")
    .upsert(row, { onConflict: "telegram_user_id,story_id,viewer_user_id" })
    .select("*")
    .single();
  const saved = need(r as any);
  await recordEvent({
    userId,
    eventType: `story.view.${String(row.status || "provisional")}`,
    source: "intelligence",
    occurredAt: row.confirmed_at || row.viewed_at || row.last_seen_at || new Date().toISOString(),
    storyId,
    actorUserId: viewerId,
    actorUsername: row.username || null,
    actorDisplayName: row.display_name || null,
    correlationKey: `story:${storyId}`,
    dedupeKey: `story:${storyId}:viewer:${viewerId}:${String(row.status || "provisional")}`,
    payload: {
      status: String(row.status || "provisional"),
      isContact: Boolean(row.is_contact),
      hasReaction: Boolean(row.reaction_json),
    },
    retentionUntil: eventRetention(90, row.viewed_at || new Date().toISOString()),
  });
  return saved;
}

async function opDeleteViewer(args: any) {
  const userId = String(args.userId);
  const storyId = Number(args.storyId);
  const viewerUserId = String(args.viewerUserId);
  if (directSql) {
    await directSql`
      delete from public.story_pilot_viewers
      where telegram_user_id = ${userId}::bigint
        and story_id = ${storyId}
        and viewer_user_id = ${viewerUserId}::bigint
    `;
    return true;
  }
  const r = await db.from("story_pilot_viewers")
    .delete()
    .eq("telegram_user_id", userId)
    .eq("story_id", storyId)
    .eq("viewer_user_id", viewerUserId);
  need(r as any);
  return true;
}

async function opInsertSnapshot(args: any) {
  const row = args.row || {};
  if (directSql) {
    await directSql`
      insert into public.story_pilot_viewer_snapshots (
        telegram_user_id, story_id, observed_at, total_views,
        identified_views, forwards_count, reactions_count
      ) values (
        ${String(row.telegram_user_id)}::bigint, ${Number(row.story_id)},
        ${row.observed_at}::timestamptz, ${Number(row.total_views || 0)},
        ${Number(row.identified_views || 0)}, ${Number(row.forwards_count || 0)},
        ${Number(row.reactions_count || 0)}
      )
    `;
    return true;
  }
  const r = await db.from("story_pilot_viewer_snapshots").insert(row);
  need(r as any);
  return true;
}

async function opGetStoryData(args: any) {
  const userId = String(args.userId);
  const storyId = Number(args.storyId);

  if (directSql) {
    const stories = await directSql`
      select *
      from public.story_pilot_stories
      where telegram_user_id = ${userId}::bigint
        and story_id = ${storyId}
      limit 1
    `;
    const viewers = await directSql`
      select viewer_user_id, username, display_name, viewed_at, reaction_json, is_contact
      from public.story_pilot_viewers
      where telegram_user_id = ${userId}::bigint
        and story_id = ${storyId}
        and status = 'confirmed'
      order by viewed_at desc
      limit 500
    `;
    return { story: stories[0] || null, viewers };
  }

  const storyResult = await db.from("story_pilot_stories")
    .select("*")
    .eq("telegram_user_id", userId)
    .eq("story_id", storyId)
    .maybeSingle();
  const story = need(storyResult as any);

  const viewersResult = await db.from("story_pilot_viewers")
    .select("viewer_user_id,username,display_name,viewed_at,reaction_json,is_contact")
    .eq("telegram_user_id", userId)
    .eq("story_id", storyId)
    .eq("status", "confirmed")
    .order("viewed_at", { ascending: false })
    .limit(500);
  const viewers = need(viewersResult as any) || [];

  return { story, viewers };
}

async function opGetAnalytics(args: any) {
  const userId = String(args.userId);
  if (!directSql) throw new Error("direct_database_unavailable");

  const stories = await directSql`
    select story_id, posted_at, last_views_count, last_identified_count,
           last_reactions_count, last_forwards_count, last_sync_at, active
    from public.story_pilot_stories
    where telegram_user_id = ${userId}::bigint
    order by posted_at desc
    limit 100
  `;

  const viewers = await directSql`
    select story_id, viewer_user_id, username, display_name, viewed_at,
           reaction_json, is_contact
    from public.story_pilot_viewers
    where telegram_user_id = ${userId}::bigint
      and status = 'confirmed'
    order by viewed_at desc
    limit 3000
  `;

  const snapshots = await directSql`
    select story_id, observed_at, total_views, identified_views,
           reactions_count, forwards_count
    from public.story_pilot_viewer_snapshots
    where telegram_user_id = ${userId}::bigint
    order by observed_at desc
    limit 1000
  `;

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
  if (!directSql) throw new Error("direct_database_unavailable");

  const stories = await directSql`
    select story_id, posted_at, expires_at, active, deleted_at, audience,
           protected, last_views_count, last_identified_count,
           last_reactions_count, last_forwards_count, last_sync_at
    from public.story_pilot_stories
    where telegram_user_id = ${userId}::bigint
    order by posted_at desc
    limit 250
  `;

  const viewers = await directSql`
    select story_id, viewer_user_id, username, display_name, viewed_at,
           first_seen_at, last_seen_at, confirmed_at, is_contact, reaction_json
    from public.story_pilot_viewers
    where telegram_user_id = ${userId}::bigint
      and status = 'confirmed'
    order by viewed_at desc
    limit 3000
  `;

  return { stories, viewers, generatedAt: new Date().toISOString() };
}

async function opAcquireLease(args: any) {
  const seconds = Math.max(10, Math.min(300, Number(args.seconds || 55)));
  if (directSql) {
    const rows = await directSql`
      select public.story_pilot_acquire_watch_lease(${seconds}) as acquired
    `;
    return Boolean(rows[0]?.acquired);
  }
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
    case "health": return { storage: "ok", auth: "ed25519", privacy: "ghost-inbox-v10", mediaProxy: true, mediaVault: true, deleteAlerts: true, vaultVisibility: true, durableArchive: true, vaultOrphanCleanup: true, parallelAnalytics: false, overloadBackoff: true, privateCrypto: Boolean(directSql), directDbUrlAvailable: Boolean(SUPABASE_DB_URL), directAnalytics: Boolean(directSql), directExport: Boolean(directSql), directCoreReads: Boolean(directSql), directGhostWrites: Boolean(directSql), directViewerWrites: Boolean(directSql) };
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
    case "viewer_crypto_health": return opViewerCryptoHealth(args);
    case "seal_viewer_private_json": return opSealViewerPrivateJson(args);
    case "open_viewer_private_json": return opOpenViewerPrivateJson(args);
    case "list_events": return opListEvents(args);
    case "record_event": return opRecordClientEvent(args);
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
