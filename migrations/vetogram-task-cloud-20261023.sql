-- Additive, deliberately UNAPPLIED migration for VETOGRAM NEXT combined release.
-- Only owner id, revision and opaque AES-GCM encrypted snapshot stored.
-- NULL ciphertext is a deletion tombstone: stale devices cannot recreate old
-- data at revision 0. No server reminders or Telegram chat content ingestion.
CREATE TABLE IF NOT EXISTS public.vetogram_task_cloud(
  owner_id bigint PRIMARY KEY CHECK(owner_id>0),
  encrypted_snapshot text,
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(encrypted_snapshot IS NULL OR length(encrypted_snapshot)<=60000)
);
REVOKE ALL ON TABLE public.vetogram_task_cloud FROM PUBLIC;
-- No trigger, cron job, reminder queue or service-role grant is configured.
-- Deleting ciphertext from this table doesn't instantly erase database backups.
