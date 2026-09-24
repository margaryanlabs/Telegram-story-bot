import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nacl from "npm:tweetnacl@1.0.3";
import postgres from "npm:postgres@3.4.5";

const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL") ?? "";
const WATCH_URL = "https://telegram-story-bot-murex.vercel.app/api/viewer-watch";
const TRIGGER_PRIVATE_SEED = "DUFcymFQ6A1XLKZkI5DkPyie4OYXWJCFsXumUxFhV_8";

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
    const leaseRows = await sql`
      select public.story_pilot_acquire_watch_lease(55) as acquired
    `;
    if (!Boolean(leaseRows[0]?.acquired)) {
      return json({ ok: true, skipped: true, reason: "lease_busy" });
    }

    const body = JSON.stringify({ trigger: "viewer_watch" });
    const timestamp = String(Date.now());
    const seed = b64url(TRIGGER_PRIVATE_SEED);
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
        console.log("story-pilot-watch-trigger completed", JSON.stringify({
          targetStatus: response.status,
          ok: response.ok && result?.ok === true,
          ownersProcessed: result?.ownersProcessed ?? null,
          fastPollRounds: result?.fastPollRounds ?? null,
          activeStoriesSeen: result?.activeStoriesSeen ?? null,
          error: result?.error ?? null,
        }));
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : (error && typeof error === "object" ? JSON.stringify(error) : String(error));
        console.error("story-pilot-watch-trigger background", message);
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
    console.error("story-pilot-watch-trigger", message);
    return json({ ok: false, error: message }, 500);
  }
});
