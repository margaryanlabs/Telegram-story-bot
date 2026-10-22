# VetoTG: reversible Neon standby (2026-10-20)

## Why
Legacy Supabase project `xvtmgzzaomolnvkcgosk` is INACTIVE, and restore was refused due to an outstanding organization invoice. Existing Supabase contents remain untouched. A separate free Neon project `small-glitter-11116693` / DB `veto_telegram` now has a **new empty** compatible subset of the schema (see `db/neon/001_standby_schema.sql`). This is NOT a completed data migration.

## Switch design
- `VETO_STORAGE_PROVIDER=supabase` (also the default): current signed Supabase Edge gateway unchanged.
- `VETO_STORAGE_PROVIDER=neon`: server-only Neon SQL adapter, no fallback to Supabase. Requires `VETO_NEON_DATABASE_URL` and 32-byte hex `VETO_NEON_SESSION_KEY` (both sensitive, server-only). Switching stores without a verified cutover checkpoint can lose access to new messages: **never switch blindly**.
- Supabase's existing encrypted session format is v3; Neon uses AES-256-GCM v4 (owner-bound additional authenticated data). A stored v3 ciphertext cannot simply be copied to Neon, and a v4 ciphertext cannot simply be copied to Supabase. Key management and explicit safe re-encryption are required before migration or rollback. NEVER dump decrypted session strings to files/logs.
- Build/preview may connect only to an explicitly authorized test account. No real accounts or private archives have been migrated here.

## Currently implemented Neon operations
Schema, health, secure crypto readiness, linked-user session CRUD, login challenges, security events, Privacy settings, Business connection state. SQL adapter is server-only, parameterized and fails closed for unmigrated operations. Public endpoints still verify Telegram signed initData and same-owner identity as before.

## NOT YET AVAILABLE IN NEON
Reliable live Business message ingestion/edit/delete/archive, Media Vault and file backup, historical imports, automations, Stories analytics and background workers. Those operations are intentionally **not** silently proxied to a blocked Supabase or treated as working. Do not enable Neon in production until porting, data-contract tests and live verification are done. `backgroundReady` is false in Neon.

## Future restore to Supabase
1. Re-enable legacy Supabase after billing resolution; leave current Neon service online.
2. Freeze writes or introduce durable, idempotent dual-write/outbox; record a cutover watermark.
3. Backfill Neon-created sessions, challenge state (prefer expiring them), messages, deletion tombstones, versions, Stories, event logs, and media files to Supabase in bounded batches; preserve original keys/timestamps and protect owner segregation.
4. Re-wrap encrypted sessions into target cipher after authenticated access to both key systems (or have owners reauthorize). Validate counts, hashes, tombstones, attachment downloads and 2 real users' consent.
5. After green verification, switch provider to Supabase. Keep Neon read-only as a rollback checkpoint for a retention window, then require approval for final deletion.

## Hard stop
Free quota is not unlimited and must have alerts. Vercel Hobby is not allowed for commercial usage. No billing workaround or new Supabase account is assumed.
