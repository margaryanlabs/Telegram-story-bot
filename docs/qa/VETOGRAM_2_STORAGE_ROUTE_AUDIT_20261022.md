# VETOGRAM 2.0 — storage route audit (22 October 2026)

## Release status

**BLOCKED / DRAFT.** No production merge, deployment, environment change, data migration, session revoke, or database mutation was performed.

This is a read-only incident review of the existing storage stack, plus safe diagnostics code in PR #179.

## Verified Supabase project state

Connected Supabase project ref `xvtmgzzaomolnvkcgosk` reports **INACTIVE** from the project listing.

Its Edge Function `story-pilot-store` remains listed at deployed version **48**, with status ACTIVE in the *function metadata*. This does **not** prove the paused/inactive project's HTTP function gateway can answer live requests.

The live source retrieved via Supabase connector:
- Initializes `createClient(SUPABASE_URL, SERVICE_KEY)`.
- Supports `SUPABASE_DB_URL` direct PostgreSQL pool **only if** `STORY_PILOT_DIRECT_SQL_PREFERRED=true`.
- Has no explicitly named Neon route or Neon client.
- Implements the operations `get_session`, `upsert_session`, `capture_business_message`, `mark_business_messages_deleted` and other operations needed by Vetogram.
- Has **no verified durable delete/edit alert outbox** and **no verified owner-scoped cross-instance compare-and-swap** for Business writes.

The GitHub source `lib/viewer-sync-store.js` calls a fixed gateway:
`https://xvtmgzzaomolnvkcgosk.supabase.co/functions/v1/story-pilot-store`.

Supabase `list_tables` returned a database connection timeout. The current backend service is therefore not proven reachable. An HTTP health check authenticated with the existing signing key is still needed before release; never share signing keys or session values.

## Verified Neon existence (metadata/aggregate only)

Connected Neon project: `small-glitter-11116693`, name `veto-telegram-free`.

Primary branch: `br-super-king-b9vfmlr4`, name `main`, status `ready`.

Neon has the expected public schema tables, including:
- `story_pilot_viewer_sessions`
- `story_pilot_business_connections`
- `story_pilot_messages`
- `story_pilot_message_versions`
- `story_pilot_privacy_settings`
- `veto_storage_migrations`.

Read-only aggregate counts observed:
- `story_pilot_viewer_sessions`: **3**
- `story_pilot_business_connections`: **3**
- `story_pilot_messages`: **107**
- `story_pilot_message_versions`: **107**
- `story_pilot_privacy_settings`: **3**
- `story_pilot_stories`: **0**
- `veto_storage_migrations`: **4**

No phone numbers, messages, credentials, tokens, raw session contents or secret encryption keys were retrieved.

**Important:** These counts prove stored schema and some records exist on Neon. They do not establish synchronization or that live requests from production are reaching Neon. No data loss should be inferred from inaccessible Supabase alone.

## Safe code changes in PR #179

1. `api/viewer-sync.js`: `configState()` now distinguishes a **storage-gateway outage** from a **reachable storage service with unready session crypto**. `backgroundReady` is false when the gateway is down. `STORAGE_GATEWAY_UNAVAILABLE` replaces a misleading `PRIVATE_SESSION_CRYPTO` marker during an outage.
2. `api/viewer-sync.js`: degraded GET text no longer claims Story publishing necessarily works without storage. No session records are modified/deleted by this diagnostic.
3. `public/app.js`: the account screen identifies a server storage outage instead of directing the user to repeat Telegram login; the user is advised not to delete a previously connected session.
4. `tests/vetogram-storage-gateway-readiness.test.js`: four new unit tests for healthy v3, reachable/bad-crypto, unreachable gateway, and missing configuration.

This work does NOT restore an inactive storage project, enable the new Business flow, migrate data or modify Ghost View / existing Story publishing transports.

## Validation limits

The `configState()` function from the actual branch was evaluated with three mocked storage-health conditions in a local JavaScript sandbox: v3-ready, wrong crypto, and unreachable. All three matched the expected status, `backgroundReady`, and `newConnectionsReady` behavior. The changed frontend/backend files parsed as JavaScript. The four committed Node regression tests are not yet verified by a complete `npm run vercel-build` on the new head. Remote GitHub Actions and Vercel preview remained unverified at the previous checkpoint.

## Decision required before safely restoring production

1. Determine whether the original Supabase function can be restored and whether the current environment includes the signed gateway and existing crypto environment. Do not reactivate a potentially billable project automatically.
2. If Neon should be the permanent store, implement a **new, authenticated, feature-flagged store gateway** that routes all currently used operations to the existing Neon schema. Preserve v3 encryption key material and semantics, signed Ed25519 requests, auth challenges, archived media, sessions and all webhook operations. Review old gateway source and schema; do not invent credentials or blindly redirect the URL.
3. Test compatibility on a Preview/test owner using read-only health, signed crypto round-trip on a synthetic fixture, session owner validation, and mock notifications before any production traffic is switched.
4. Prove webhook ingestion + retention + alerts with two consenting test accounts, including a non-Premium Story publication regression and Ghost View test.
5. Only then, following an explicit owner release instruction, execute a staged rollout with rollback preserving original rows and both database backends.

The open PR remains release-gated; **no production deploy until explicit `ДЕПЛОЙ`**.
