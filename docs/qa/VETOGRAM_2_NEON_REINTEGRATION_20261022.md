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
 
## Follow-up 22 Oct — auth and partial Business setup

**Status: release blocked, NO DEPLOYMENT.**

- QR login previously accepted only `cryptoHealth.version === 'v3'`. New code uses provider-sensitive `sessionCryptoReady()` and requires verified `v4` for Neon, `v3` for Supabase. The phone/2FA session-created audit now reports the actual sealed cipher version. `public/app.js` reports the configured cipher.
- Business permissions may be accepted by Telegram even if the subsequent Anti-Delete server-settings write fails. The response now reports `archiveConsentRequested` separately from `settingsUpdated`. The UI shows **incomplete Anti-Delete setup** and withholds the green “Готово” action until storage settings are confirmed. Story-only consent does not falsely trigger this warning. Two focused test files updated; full test execution remains unverified.
- Added `scripts/vetogram-verify-lock.mjs`, `npm run lock:check`, `npm run lock:refresh`. The check compares all root direct dependencies and is expected to fail until the committed npm lock is regenerated in a trusted network-enabled checkout. `npm run lock:refresh` uses `--package-lock-only --ignore-scripts --no-audit --no-fund`. No install or source scripts were executed in this run.
- Connected GitHub reports a current PR check job failed before executing **any steps**, with two reported check annotations that this connector cannot read. The cause could be runner startup/billing/policy; it is **not evidence of failing application tests**.
- Connected Vercel metadata shows latest Preview **CANCELED**. Team-scoped detailed build logs and authenticated production health are blocked by connector **403**. No claim of working Preview or production health.
- Connected Vercel env inspection (names/targets only): `VETO_STORAGE_PROVIDER=neon` for production and preview; original Neon DB, v4 key and private S3 credentials are scoped production-only, not preview. Sensitive values were not decrypted. `VETOGRAM_UNIFIED_ONBOARDING` is still absent.
- Existing Neon schema is v4; the additive v5 owner-leases migration remains **NOT APPLIED**. No row or session changes performed.

### Required release path

1. Regenerate the npm lock in an authorized network-enabled workspace: `npm run lock:refresh`. Review/commit the lockfile on this PR and run `npm run lock:check && npm ci && npm run vercel-build`.
2. Resolve GitHub runner startup issue by inspecting the two annotations in repository UI and checking Actions settings/billing only if indicated. Do not pay or increase budgets without owner approval.
3. Ensure controlled Preview secrets are configured safely and build can run, then execute `npm run neon:preflight` without exposing credentials.
4. Validate original `v4` key fingerprint, private S3 health, and schema v5 only after an approved additive migration.
5. Run real consensual two-account Ghost View, Business Stories without Premium, Anti-Delete/edit/delete, alerts, iOS/Android tests.
6. Obtain explicit **ДЕПЛОЙ** before merging or enabling production.


## Confirmed external CI blocker — GitHub personal-account billing lock

**Verified on 22 October 2026 from the user's GitHub Actions screenshot**, run #39773447540, workflow "Vetogram Verification", job "verify":

> The job was not started because your account is locked due to a billing issue.

A separate **notice**, not a failure cause, says the `ubuntu-latest` label will migrate to Ubuntu 26 starting October 19, 2026.

The first CI step never started. Therefore the run offers **no evidence at all** about Node syntax, `npm ci`, unit tests, or Vercel build quality. Changing the runner image, disabling the workflow, or editing application code cannot resolve this account lock.

The repository `margaryanlabs/Telegram-story-bot` is verified **public**; GitHub reports its owner `margaryanlabs` is a **User** (personal account), not an organization. Billing must be investigated under the owner's personal GitHub Settings → Billing & licensing. GitHub documents that a failed authorization hold can lock Actions even when the account appears to be on Free and displays no amount owing. If there are no active fees or payment issues, the user can request billing lock review from GitHub Support. Where available and appropriate, downgrading to GitHub Free may retain advanced access for public repositories. **Do not charge a card, increase a budget or change billing on the user's behalf without authorization.**

Independent remaining build obstacle: `package-lock.json` does not match Neon/AWS SDK additions in `package.json`. The current local build environment has Node 22 but cannot resolve `registry.npmjs.org`; attempts to refresh dependencies here would fail for lack of network access. Do not fabricate integrity hashes or bypass `npm ci`. A trusted, network-enabled environment can run:

```sh
npm run lock:refresh
npm run lock:check
npm ci --no-audit --no-fund
npm run vercel-build
```

The lockfile must be reviewed and committed only after successful registry-backed regeneration. Real Telegram verification is still pending. **Production must not deploy until explicitly authorized and all release gates pass.**


## Follow-up: GitHub billing blocker and safe Neon Preview smoke gating

- The user supplied a screenshot from GitHub Actions #39773447540 showing the actual error: **"The job was not started because your account is locked due to a billing issue."** This conclusively explains why no CI steps or test logs are present. A separate Ubuntu 26 migration notice is unrelated.
- GitHub's official guidance ([Unlocking a locked account](https://docs.github.com/en/billing/how-tos/troubleshooting/locked-account)) confirms failed payment authorization holds can block even free public-repository Actions. Account owner must inspect **Settings → Billing & licensing**, choose appropriate Free-plan downgrade or seek GitHub Support review if no actionable bill. Never process payments without the owner's consent.
- `tests/neon-runtime-smoke.test.js` is now gated by **both** `VETO_STORAGE_PROVIDER=neon` and `neonStorageConfigured()`, avoiding a false CI failure on a preview environment where the provider selector is present but the production-only private database/session secrets are intentionally unavailable.
- The smoke test skip **does not imply release readiness**; `npm run neon:preflight` with secure, correctly scoped credentials is still mandatory before launch, along with schema v5, media access, and live Telegram checks.
- The current tool-side Node 22 runtime cannot resolve either `registry.npmjs.org` or `github.com`, and npm cache is empty. Thus `npm run lock:refresh`, `npm ci`, `npm run vercel-build` could not be executed. The lockfile mismatch is still a hard build blocker; no fake package integrity entries were added.
- Branch remains a **draft PR**. No production deploy, team billing change, database migration, or credentials change took place.
