import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose@5.9.6";

const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL") ?? "";
const EXPECTED_OWNER_ID = "team_yqBWofpR4TIix8zHOalN5lOq";
const EXPECTED_OWNER = "margaryanlabs";
const EXPECTED_PROJECT_ID = "prj_YZWYGa35qRTxSjWgjfe3VohPi57L";
const EXPECTED_PROJECT = "telegram-story-bot";
const PURPOSE = "viewer_sync_session";
const ALLOWED_ISSUERS = new Set([
  "https://oidc.vercel.com",
  "https://oidc.vercel.com/margaryanlabs",
]);
const EXPECTED_AUDIENCE = "https://vercel.com/margaryanlabs";

const sql = SUPABASE_DB_URL ? postgres(SUPABASE_DB_URL, {
  prepare: false,
  max: 2,
  idle_timeout: 10,
}) : null;

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}

function bearer(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function jwksFor(issuer: string) {
  let jwks = jwksByIssuer.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));
    jwksByIssuer.set(issuer, jwks);
  }
  return jwks;
}

async function verifyVercelIdentity(token: string) {
  if (!token) throw new Error("missing_vercel_oidc_token");

  const unverified = decodeJwt(token);
  const issuer = String(unverified.iss || "");
  if (!ALLOWED_ISSUERS.has(issuer)) throw new Error("invalid_oidc_issuer");

  const { payload } = await jwtVerify(token, jwksFor(issuer), {
    issuer,
    audience: EXPECTED_AUDIENCE,
  });

  if (payload.owner_id !== EXPECTED_OWNER_ID) throw new Error("invalid_oidc_owner_id");
  if (payload.owner !== EXPECTED_OWNER) throw new Error("invalid_oidc_owner");
  if (payload.project_id !== EXPECTED_PROJECT_ID) throw new Error("invalid_oidc_project_id");
  if (payload.project !== EXPECTED_PROJECT) throw new Error("invalid_oidc_project");

  const environment = String(payload.environment || "");
  if (!["production", "preview"].includes(environment)) {
    throw new Error("unsupported_runtime_environment");
  }

  return { environment };
}

async function ensureActiveKey(environment: string) {
  if (!sql) throw new Error("key_broker_database_not_configured");

  const existing = await sql`
    select key_id
    from story_pilot_private.crypto_keys
    where purpose = ${PURPOSE}
      and environment = ${environment}
      and status = 'active'
    limit 1
  `;
  if (existing[0]?.key_id) return;

  const keyId = `viewer-sync-${environment}-2026-09-24-01`;
  await sql`
    insert into story_pilot_private.crypto_keys
      (key_id, purpose, environment, secret_value, status)
    values (
      ${keyId},
      ${PURPOSE},
      ${environment},
      encode(gen_random_bytes(32), 'base64'),
      'active'
    )
    on conflict (key_id) do nothing
  `;
}

async function loadKeyring(environment: string) {
  if (!sql) throw new Error("key_broker_database_not_configured");
  await ensureActiveKey(environment);

  const rows = await sql`
    select key_id, secret_value, status, created_at
    from story_pilot_private.crypto_keys
    where purpose = ${PURPOSE}
      and environment = ${environment}
      and status in ('active', 'retired')
    order by (status = 'active') desc, created_at desc
    limit 4
  `;

  const active = rows.find((row) => row.status === "active");
  if (!active?.key_id || !active?.secret_value) throw new Error("active_viewer_sync_key_missing");

  return {
    current: { id: String(active.key_id), key: String(active.secret_value) },
    previous: rows
      .filter((row) => row.status === "retired" && row.key_id && row.secret_value)
      .slice(0, 3)
      .map((row) => ({ id: String(row.key_id), key: String(row.secret_value) })),
  };
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  try {
    const identity = await verifyVercelIdentity(bearer(request));
    const keyring = await loadKeyring(identity.environment);
    return json({ ok: true, keyring });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const authFailure = /oidc|runtime_environment|missing_vercel/i.test(message);
    console.warn("Story Pilot key broker denied", { reason: message });
    return json({ ok: false, error: authFailure ? "unauthorized" : "key_broker_unavailable" }, authFailure ? 401 : 503);
  }
});
