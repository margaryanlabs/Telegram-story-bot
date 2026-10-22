# VETOGRAM 2.0 — Neon reintegration checkpoint (22 October 2026)

**Release status: DRAFT / NOT PRODUCTION-READY. No deployment, merge, production environment changes, database migrations, or Telegram session changes performed.**

## Root cause discovered

Earlier review looked only at the `main` and PR #179 trees. Original Neon migration implementation exists in *two divergent branches*:

- `feat/vetotg-neon-standby-20261020` — original PR #167 foundation.
- `fix/telegram-auth-on-neon-20261021` — extends Neon with Telegram code-delivery repairs.

The deployed production code in `main` still calls a hardcoded **inactive Supabase** `story-pilot-store` endpoint. It did not include the older Neon source because the branches diverged.

Connected Neon project `small-glitter-11116693`, database `veto_telegram` has:
- schema version 4;
- 3 active viewer sessions (all `v4` ciphertext, with one distinct key fingerprint);
- 3 Business connections, 107 stored messages, 107 versions and 3 privacy setting rows.

No private message content, session plaintext, login code, full encryption key, or Telegram token was read.

## Code restored to draft PR #179

Copied from `fix/telegram-auth-on-neon-20261021`:

- `lib/storage-provider.js`
- `lib/neon-store.js`
- `lib/neon-archive-store.js`
- `lib/neon-story-store.js`
- `lib/neon-worker-store.js`
- `lib/neon-media-store.js`
- `lib/neon-private-crypto.js`
- `lib/neon-scheduler-auth.js`
- `functions/vetoneoncron/index.mjs`
- `api/neon-maintenance.js`
- Neon v1–v4 SQL source migrations and three Neon tests.

Grafted into VETOGRAM 2.0 instead of blindly overwriting its newer changes:

- `lib/viewer-sync-store.js`: explicitly selected Neon provider, dynamic adapter loading; default remains Supabase; never automatic cross-database failover.
- `lib/viewer-sync-crypto.js`: Neon v4 AES-256-GCM session support and existing v1/v2/v3 decoding preserved.
- `api/viewer-sync.js`: provider-aware health, real v4 readiness, background gate.
- `lib/privacy-business.js`, `lib/telegram-history-media.js`: correct headers for Neon private S3 signed PUTs.
- `api/health.js`, `api/viewer-watch.js`, `api/automation-run.js`, `api/privacy-backup-worker.js`: provider-aware scheduling and auth.
- `api/router.js`: new protected maintenance endpoint added to existing **one** Vercel Node function (33 logical endpoints).
- `api/viewer-qr.js`: QR fallback no longer deletes a valid phone challenge; session-created event records the actual cipher version.
- `package.json`: pinned Neon HTTP driver and S3 SDK dependency versions.

Additional safeguards:

- `viewer_crypto_health` checks the **non-secret v4 key fingerprint** against existing session headers before declaring a Neon store crypto-ready. No session bodies are decrypted during preflight.
- `db/neon/005_business_connection_write_leases.sql`: **staged, not applied**, owner-scoped atomic lease; Telegram Business mutation now acquires lease through Neon when that provider is selected, limiting cross-instance write races. Expiring lease cleans up crashes; stale clients editing Telegram externally remain a limitation.
- `VETO_NEON_CRON_ENABLED=true` required alongside Neon provider and a long CRON_SECRET for workers. Feature remains OFF, and legacy Supabase signed triggers are not valid as Neon worker authorization.

## Verified in this work

1. GitHub Neon branch code and its 56 original Supabase operation names were compared. All 56 names occur in Neon handler sources. **Name parity is not behavioral parity.**
2. JavaScript source for the restored adapters and integration points parsed in an isolated JavaScript syntax check. **This is not `npm run vercel-build`.**
3. Neon was inspected using read-only SQL and confirms schema version **4**, three v4 sessions with one cipher key ID, and **absence** of the v5 lease table.
4. No migration was applied, no secrets or data modified, no new release enabled.
5. Ghost View and Business Stories publication mechanism files remain unchanged relative to PR #179 baseline.

## Critical unfinished blockers

### A. Package lock / reproducible build

The Neon source branch had `package.json` dependencies but **did not contain a package-lock.json**. PR #179 already uses `npm ci` and has an old lock file. `package.json` now pins:
- `@neondatabase/serverless@1.0.2`
- `@aws-sdk/client-s3@3.821.0`
- `@aws-sdk/s3-request-presigner@3.821.0`

**The lockfile is still stale. An `npm ci` build will fail until it is regenerated and committed.** Do this in a network-enabled clean workspace:
```sh
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm ci --no-audit --no-fund
npm run vercel-build
```
Commit the resulting lockfile only after reviewing provenance and diffs, and re-run all tests.

### B. Neon v4 session key & second Vercel account

The original Neon staging secrets were configured on a different Vercel project `telegram-story-bot`. User release target is **second Vercel account** `labsmargaryan@gmail.com`, project `veto`.

**Updated read-only verification, 22 October 2026:** by accessing project metadata without a teamId selector, connected Vercel confirms:
- Project ID `prj_9JVRlYLCDU4fuZ18F3En06Ih0A69`, name `veto`.
- `VETO_STORAGE_PROVIDER=neon` already targets **production and preview**.
- `VETO_NEON_DATABASE_URL` and `VETO_NEON_SESSION_KEY` exist for **production only**.
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` exist for **production only**; the public S3 endpoint and region are scoped to production/preview.
- Telegram bot/API credentials exist for **production only**.
- `VETOGRAM_UNIFIED_ONBOARDING` is **not set**.
- Latest PR preview was **CANCELED**. Build events and protected deployment logs return 403 because the connector lacks team resource access.

Only environment **names, target scopes and the nonsecret Neon provider selector** were inspected; sensitive values were not decrypted or read. A present `VETO_NEON_SESSION_KEY` does NOT prove it matches the saved session fingerprint until authenticated preflight passes.

**Release consequence:** merging to production without verification would immediately route the new code to Neon because the provider selector is already `neon`. Do not merge until all release checks pass. Preview requires its own secure scoped credentials (or separately authorized test setup); never expose or automatically copy production session keys to preview.

**NEVER generate a new `VETO_NEON_SESSION_KEY`** if any of the three existing sessions are to remain decryptable. Reuse the original key using secure configuration transfers without printing it into chat, source code, logs or artifacts. Key-fingerprint test must pass.

### C. Neon v5 migration

Do NOT enable unified onboarding with Neon until the staged migration `db/neon/005_business_connection_write_leases.sql` is explicitly approved and applied. Verify schema version 5 and real two-instance contention under a test owner.

### D. Provider release switch

Default remains `VETO_STORAGE_PROVIDER=supabase`; to switch in a controlled, approved staging release use `VETO_STORAGE_PROVIDER=neon` only after verified v4 key, DB target, private S3 and compatibility test. Never silently fail back across databases. Old Supabase data, if any, stays untouched.

### E. Live tests, CI, Preview, notification outbox

The existing `305/305` tests were for an older PR #179 code commit, not this Neon integration. CI failures with null steps remain unexplained. Vercel statuses previously reported success while actual preview builds were CANCELED. Existing delete/edit notification loss after a failed Telegram send remains unresolved (durable outbox required before any delivery guarantee).

Must run two consenting test accounts, one non-Premium, through v4 QR/phone login, Ghost View, Business Stories publication, message capture/edit/delete, persistent delivery and Android/iOS UI before release.

## Do not do

- Do not merge `main`.
- Do not deploy or promote production.
- Do not update Vercel production env or activate scheduled triggers.
- Do not reset Neon or Supabase, delete sessions, overwrite encryption keys or mass-revoke Business bot rights.
- Do not claim `READY` from code inspection, static parity or old build checks.
