-- Neon media additions; storage bucket is managed by Neon Object Storage
ALTER TABLE public.story_pilot_messages ADD COLUMN IF NOT EXISTS media_archive_error text;

CREATE INDEX IF NOT EXISTS veto_media_recovery ON public.story_pilot_messages (telegram_user_id,updated_at) WHERE media_file_id IS NOT NULL AND media_storage_path IS NULL;

INSERT INTO public.veto_storage_migrations(version,note) VALUES(3,'Neon private media archiving and owner-scoped recovery') ON CONFLICT(version) DO NOTHING;
