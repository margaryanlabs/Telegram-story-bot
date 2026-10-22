# VetoTG / StoryLab — Supabase-free staging audit (2026-10-20)

**Scope: ONLY the Telegram project in this repository. Do not migrate Promptence, VETO trading, RAIOS or other unrelated projects.**

## Actual state

- Legacy Supabase: `xvtmgzzaomolnvkcgosk`, INACTIVE; restoration rejected due to old billing. No data was copied.
- Neon Free: project `small-glitter-11116693`, branch `br-super-king-b9vfmlr4`, database `veto_telegram`. Schema migrations `db/neon/001..004` applied.
- Neon DB check: schema version 4; 0 saved Telegram linked sessions, 0 messages, 0 Stories, 0 automation jobs. This only describes the **new** database.
- Neon Object Storage: private bucket `veto-private-media` created. Scoped S3 credential stored only as Vercel preview secret; no media files copied.
- Neon Function `vetoneoncron` deployed. Four schedule definitions exist (watch, automation, backup every 5 min; cleanup daily), **ALL DISABLED**. Relay itself also refuses work without `VETO_NEON_CRON_ENABLED=true`.
- Vercel project `telegram-story-bot`, branch `feat/vetotg-neon-standby-20261020`: preview-scoped `VETO_STORAGE_PROVIDER=neon`, `VETO_NEON_DATABASE_URL`, `VETO_NEON_SESSION_KEY`, and `AWS_*` secrets configured. No production variable switched.
- GitHub PR #167 is a draft; it MUST remain unmerged until production release gates are verified.

## Code port

All **56 named operations** of the original Supabase `story-pilot-store` dispatch are represented by the new server-side Neon adapters. Files:

- `lib/neon-store.js` — owner-scoped session, auth challenge, security event, provider dispatch
- `lib/neon-private-crypto.js` — AES-256-GCM v4 sessions
- `lib/neon-archive-store.js` — Business capture, edit versions, deleted tombstones, message lists, imported history
- `lib/neon-story-store.js` — story/viewer writes, snapshots, full analytics contract and bounded export
- `lib/neon-worker-store.js` — backup/automation jobs, lease
- `lib/neon-media-store.js` — private S3 upload/download presign, upload verification, media retention, archive clear
- `functions/vetoneoncron/index.mjs` — disabled, fail-closed Neon scheduler
- `lib/neon-scheduler-auth.js` — server-only bearer check for relay

**Ported operation name != end-to-end correctness.** All modules were syntax-parsed in isolation. The pre-expansion Vercel preview previously passed 277 tests and was READY, but **the expanded code has not been deployed or validated**: Vercel currently has an Ignored Build Step `exit 0`, so attempts to build newer commits are intentionally canceled. This is an explicit blocker, not success.

## Required release gates

1. Enable a build for preview **without silently changing Vercel production settings**, or use an independent CI runner. Install dependencies, run `npm run check && npm test`. Confirm Neon runtime smoke tests and all legacy regression tests.
2. Fix any SQL parameter/casting, S3 presigned upload, and mismatch found in actual runtime tests. Check schema/op parity in `tests/neon-operation-parity.test.js`.
3. Test two distinct Telegram accounts, verified Mini App signed `initData`, QR/phone + code/2FA, reconnect/revoke. Ensure account A cannot read B.
4. Enable consented Chat Automation / Telegram Business and verify real new, edited and deleted events, per-chat scope, idempotency, replay, anti-delete before and after archive toggle.
5. Test image/video/voice uploads with S3 presigned URLs, verify content and checksums, signed 90-second download, retention cleanup, user deletion.
6. Test story publish/track/viewer, analytics and export, historical backups, notification jobs, worker leases. Stop any scheduled work if limits or payment thresholds become risky.
7. Set a long random `CRON_SECRET` only in the approved preview/production runtime. Configure Neon Function's relay secret and permitted deployment URL. Test endpoint auth, then enable ONE schedule at a time.
8. Verify public access and BotFather webhook for the chosen VetoTG bot, rollback snapshot, on-call monitoring, quotas.
9. Explicitly authorize production switch; only then merge PR, configure production secrets and activate Neon provider. Do not delete Supabase data, do not silently change other products.
10. Future switch back to Supabase: restore original DB; reconcile both old and Neon-created data, media objects, tombstones and IDs; rewrap v4 sessions using kept key or require fresh authorization; compare counts/hashes; switch via maintenance/dual-write window.

## Cost control

Neon Free has a 1 GB PostgreSQL limit, 5 GB private object storage and limited invocation/compute quota. The Telegram web frontend currently also uses a Vercel project: **Neon Free by itself does not make commercial Vercel hosting free**. Keep alerts and assess hosting separately.
