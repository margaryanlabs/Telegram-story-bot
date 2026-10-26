# VETOGRAM — Markarian Cloud self-hosting staging contract (2026-10-26)

This is an **optional non-Vercel runtime path**, not a production migration or a claim of Telegram integration readiness. Keep the existing Vercel release path and the V4.11 / VETOGRAM REBORN PR chain unchanged. No live bot, sessions, Neon data, DNS or payments are touched here.

## Stage 0: source QA before VPS

From the exact reviewed VETOGRAM branch, with Node.js 22:

```sh
npm ci --no-audit --no-fund
npm run lock:check
npm run check
node --test tests/self-hosted.test.js tests/vetogram-public-origin.test.js
npm test
```

This is **not** a verified full run unless each command actually passes. Do not flip `VETOGRAM_UNIFIED_ONBOARDING` or claim Anti-Delete is live based only on these tests.

## Portable server and Docker

- `npm run start:selfhost` runs a native HTTP server under Node 22. `PORT` defaults to 3000, `HOST` defaults to 127.0.0.1 for local testing; set `HOST=0.0.0.0` inside a private container.
- Custom Coolify Dockerfile path: `Dockerfile.selfhost`, port 3000 behind the Coolify HTTPS reverse proxy. The container runs without root privileges and has a stateless liveness health check for `/`.
- Public pages are streamed only from the checked-in `public/` folder; non-whitelisted extensions and symlink escapes are refused. Existing API handlers run through the current `api/router.js` route table.
- JSON and form-urlencoded request bodies are bounded at 8 MiB; unsupported content types receive HTTP 415. **Multipart and streaming uploads are not yet verified** and need route-by-route acceptance before a production cutover.
- The container has no persistent app filesystem. User sessions, private archives and media must remain in independently backed-up persistent external storage.
- `STORY_PILOT_BASE_URL` must be the exact canonical HTTPS public origin (example `https://app.your-domain.example`). Archive notifications do not guess a Vercel domain when this is absent.

## NEON is the current VETOGRAM data source

The current REBORN branch describes Neon provider mode and schema version 6, including OTP write leases. **Do not pretend moving a Postgres schema alone is enough**:

1. Verify the exact active storage provider and Neon connection source from the deployed environment; keep existing production untouched.
2. Before any migration, obtain an encrypted consistent logical backup plus separate storage-object backup and preserve all encryption key material securely. Never paste DB URLs or keys into GitHub or chat.
3. Restore into an empty disposable private PostgreSQL/Neon-compatible staging database; compare migration ledger, Auth/session capabilities, owner-bound access, archive rows, media references and storage objects. Verify extensions and table/role grants.
4. Run `npm run neon:preflight` against the **staging** database only, confirming schema >=6, lease tables, and no public access. The existing `VETOGRAM_UNIFIED_ONBOARDING` flag stays disabled until consented Telegram tests pass.
5. Use a separate test bot and test Telegram account for staging. A bot can have only one active webhook; **never repoint the production bot token** during a staging deployment. Validate secret token, update retries, idempotency, connection and story rights separately.
6. Review the signed triggers: `api/neon-maintenance.js`, `api/viewer-watch.js`, `api/privacy-backup-worker.js`, `api/vetogram-reminder-worker.js`. Recreate schedules with private credentials and lease/admission control, not anonymous public Cron endpoints.
7. Test two accounts, Telegram code/QR delivery, session key recovery, deletions/edits actually retained after webhooks, Media Vault, AI budgets and billing (where enabled) on real devices.
8. Confirm rollback includes database schema compatibility and prior key material. Only after independent verified restore, full build, actual Telegram E2E and mobile QA should DNS and webhook cutover be scheduled.

## What this commit has NOT verified

- Real production Docker image build, `sharp` system dependency behavior, complete Node tests, Telegram MTProto login, provider API, traffic/load limits, database migration, backup restoration, worker schedules, WebSocket compatibility or multi-server runtime.
- No live VPS and no production DNS or webhook changes. A successful static HTTP test is not proof of working Anti-Delete or live Chat/Stories.
- The native adapter is intentionally optional, preserving existing Vercel behavior. It can serve as the basis for Coolify staging only.

## Per-instance source identity (staging only)

The optional portable `server/self-hosted.js` now answers `GET /api/markarian-release` only when `MARKARIAN_RELEASE_ENABLED=staging-only`, `MARKARIAN_ENVIRONMENT=staging` and `MARKARIAN_SOURCE_SHA` is an exact lowercase 40-character Git commit. Otherwise the route returns HTTP 404 and exposes no source metadata. The dedicated `Dockerfile.selfhost` refuses to build when the mandatory Docker build argument `MARKARIAN_SOURCE_SHA` is absent or malformed, then carries this **declared** SHA into the staging runtime. The original Vercel deployment path remains unchanged.

Run `node --test tests/markarian-release.test.js tests/self-hosted.test.js` in a complete trusted checkout. On a staging server, verify that `/api/health` reaches a real **test** Telegram bot and isolated data, and that `/api/markarian-release` matches the exact reviewed release SHA. Neither one proves registry image digest, encryption-key recovery, Business rights, mobile chat or Anti-Delete; test those separately. NEVER point staging to production Telegram sessions or webhook credentials merely to satisfy health.
