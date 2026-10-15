import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nacl from "npm:tweetnacl@1.0.3";
import postgres from "npm:postgres@3.4.5";

const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL") ?? "";
const WATCH_URL = "https://telegram-story-bot-murex.vercel.app/api/privacy-backup-worker";

const sql = SUPABASE_DB_URL ? postgres(SUPABASE_DB_URL, {
  prepare: false,
  max: 1,
  idle_timeout: 3,
  connect_timeout: 5,
}) : null;

function b64url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function encodeB64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function loadTriggerSeed() {
  if (!sql) throw new Error("trigger_direct_database_not_configured");
  const rows = await sql`
    select secret_value
    from story_pilot_private.runtime_secrets
    where name = 'viewer_watch_signing_seed'
    limit 1
  `;
  const value = String(rows[0]?.secret_value || "").trim();
  if (!value) throw new Error("viewer_watch_signing_seed_missing");
  return b64url(value);
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!sql) return json({ ok: false, error: "trigger_direct_database_not_configured" }, 503);

  try {
    // This endpoint can be reached without a JWT because pg_cron signs via
    // an existing secret held only in Supabase Vault. Reject outside callers
    // before touching the scheduling seed or any user-owned backup job.
    const key=String(request.headers.get("x-maintenance-secret") || "");
    if (!key) return json({ok:false,error:"unauthorized"},401);
    const rows=await sql`
      select decrypted_secret from vault.decrypted_secrets
      where name='story_pilot_maintenance_secret' limit 1
    `;
    if (!rows[0]?.decrypted_secret || key!==String(rows[0].decrypted_secret)) {
      return json({ok:false,error:"unauthorized"},401);
    }
    // Per-chat atomic leases live in story_pilot_backup_jobs.
    // Do not block the unrelated real-time viewer watcher.

    const body = JSON.stringify({ trigger: "privacy_backup" });
    const timestamp = String(Date.now());
    const seed = await loadTriggerSeed();
    const pair = nacl.sign.keyPair.fromSeed(seed);
    const message = new TextEncoder().encode(`${timestamp}.${body}`);
    const signature = encodeB64Url(nacl.sign.detached(message, pair.secretKey));

    const runWatcher = async () => {
      try {
        const response = await fetch(WATCH_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-story-trigger-timestamp": timestamp,
            "x-story-trigger-signature": signature,
          },
          body,
        });

        const result = await response.json().catch(() => ({}));
        console.log("story-pilot-backup-trigger completed", JSON.stringify({
          targetStatus: response.status,
          ok: response.ok && result?.ok === true,
          ownersProcessed: result?.ownersProcessed ?? null,
          claimed: result?.claimed ?? null,
          error: result?.error ?? null,
        }));
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : (error && typeof error === "object" ? JSON.stringify(error) : String(error));
        console.error("story-pilot-backup-trigger background", message);
      }
    };

    EdgeRuntime.waitUntil(runWatcher());
    return json({ ok: true, queued: true });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : (error && typeof error === "object"
          ? JSON.stringify(error)
          : String(error));
    console.error("story-pilot-backup-trigger", message);
    return json({ ok: false, error: message }, 500);
  }
});
