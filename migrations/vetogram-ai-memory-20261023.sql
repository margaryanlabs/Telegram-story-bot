-- Additive migration; deliberately NOT applied to Neon by committing this file.
-- Encryption is done in the server before insertion with a distinct secret.
-- No Telegram messages, personal session strings, or plaintext notes in this table.
CREATE TABLE IF NOT EXISTS public.vetogram_ai_memory_store (
  owner_id bigint PRIMARY KEY CHECK(owner_id>0),
  encrypted_snapshot text NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE public.vetogram_ai_memory_store FROM PUBLIC;
CREATE INDEX IF NOT EXISTS vetogram_ai_memory_updated_idx
  ON public.vetogram_ai_memory_store(updated_at);
-- IMPORTANT: don't enable the AI Memory API before migration and encryption
-- secrets are configured. Use dedicated server-side database credentials.
