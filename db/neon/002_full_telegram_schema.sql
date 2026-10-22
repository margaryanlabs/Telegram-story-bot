-- Additive, repeatable VetoTG Neon schema extension
ALTER TABLE public.story_pilot_message_versions ADD COLUMN IF NOT EXISTS media_file_id text;

ALTER TABLE public.story_pilot_message_versions ADD COLUMN IF NOT EXISTS media_unique_id text;

CREATE UNIQUE INDEX IF NOT EXISTS veto_version_dedupe ON public.story_pilot_message_versions (telegram_user_id,chat_id,message_id,content_hash);

ALTER TABLE public.story_pilot_viewer_snapshots ADD COLUMN IF NOT EXISTS forwards_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.story_pilot_viewer_snapshots ADD COLUMN IF NOT EXISTS reactions_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.story_pilot_backup_jobs (
telegram_user_id bigint NOT NULL,chat_id bigint NOT NULL,chat_title text NOT NULL DEFAULT '',
enabled boolean NOT NULL DEFAULT true,media_enabled boolean NOT NULL DEFAULT false,
notify_completion boolean NOT NULL DEFAULT true,state text NOT NULL DEFAULT 'active',
offset_id bigint NOT NULL DEFAULT 0,total_read integer NOT NULL DEFAULT 0,
total_saved integer NOT NULL DEFAULT 0,total_media integer NOT NULL DEFAULT 0,
last_error text, completed_at timestamptz,next_run_at timestamptz NOT NULL DEFAULT now(),
lease_until timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(telegram_user_id,chat_id));

CREATE TABLE IF NOT EXISTS public.story_pilot_automation_rules (
 telegram_user_id bigint NOT NULL,rule_key text NOT NULL, enabled boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(telegram_user_id,rule_key));

CREATE TABLE IF NOT EXISTS public.story_pilot_automation_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), telegram_user_id bigint NOT NULL,
 event_id bigint NOT NULL REFERENCES public.story_pilot_events(id),
 rule_key text NOT NULL, status text NOT NULL DEFAULT 'queued',
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 locked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,last_error text,
 UNIQUE(telegram_user_id,event_id,rule_key));

CREATE TABLE IF NOT EXISTS public.story_pilot_worker_leases (
 name text PRIMARY KEY,locked_until timestamptz NOT NULL DEFAULT '-infinity'::timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS veto_backup_ready ON public.story_pilot_backup_jobs (next_run_at,lease_until) WHERE enabled AND state='active';

CREATE INDEX IF NOT EXISTS veto_automation_queue ON public.story_pilot_automation_jobs (status,available_at,created_at);

CREATE INDEX IF NOT EXISTS veto_stories_lookup ON public.story_pilot_stories(telegram_user_id,posted_at DESC);

CREATE INDEX IF NOT EXISTS veto_viewers_story ON public.story_pilot_viewers(telegram_user_id,story_id,viewed_at DESC);

INSERT INTO public.veto_storage_migrations(version,note) VALUES(2,'Jobs, automation, story statistics and version deduplication') ON CONFLICT(version) DO NOTHING;
