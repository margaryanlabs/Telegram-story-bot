-- VETO Telegram: temporary Neon / PostgreSQL schema v1
-- Creates new objects only. The legacy Supabase database is deliberately untouched.
-- Credentials and encrypted session plaintext MUST remain server-side.

CREATE TABLE IF NOT EXISTS public.veto_storage_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now(), note text NOT NULL DEFAULT '');

CREATE TABLE IF NOT EXISTS public.story_pilot_viewer_sessions (
 telegram_user_id bigint PRIMARY KEY, session_ciphertext text NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','reauth_required','disabled')),
 telegram_account_user_id bigint, telegram_account_username text, telegram_account_first_name text,
 last_poll_at timestamptz, last_error text, notify_enabled boolean NOT NULL DEFAULT true,
 notify_anonymous_gap boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS public.story_pilot_viewer_auth_challenges (
 telegram_user_id bigint PRIMARY KEY, challenge_ciphertext text NOT NULL,
 stage text NOT NULL CHECK(stage IN ('code','password','qr_password')),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL);

CREATE TABLE IF NOT EXISTS public.story_pilot_privacy_settings (
 telegram_user_id bigint PRIMARY KEY, anti_delete boolean NOT NULL DEFAULT false,
 edit_history boolean NOT NULL DEFAULT false, ghost_inbox boolean NOT NULL DEFAULT false,
 ghost_focus boolean NOT NULL DEFAULT false, notify_deletes boolean NOT NULL DEFAULT false,
 notify_edits boolean NOT NULL DEFAULT false, retention_days integer NOT NULL DEFAULT 30 CHECK (retention_days BETWEEN 1 AND 3650),
 updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS public.story_pilot_business_connections (
 telegram_user_id bigint PRIMARY KEY, business_connection_id text, is_enabled boolean NOT NULL DEFAULT false,
 can_manage_stories boolean NOT NULL DEFAULT false, can_read_messages boolean NOT NULL DEFAULT false,
 source text, last_verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS public.story_pilot_messages (
 telegram_user_id bigint NOT NULL, chat_id bigint NOT NULL, message_id bigint NOT NULL,
 business_connection_id text, direction text NOT NULL DEFAULT 'incoming',
 sender_user_id bigint, sender_username text, sender_display_name text, chat_title text,
 text_content text, caption text, media_type text, media_file_id text, media_unique_id text,
 media_mime_type text, media_file_name text, media_file_size bigint,
 media_archive_status text NOT NULL DEFAULT 'none', media_storage_path text,
 media_archived_at timestamptz, sent_at timestamptz NOT NULL DEFAULT now(),
 edited_at timestamptz, deleted_at timestamptz, content_hash text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(telegram_user_id, chat_id, message_id));

CREATE TABLE IF NOT EXISTS public.story_pilot_message_versions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, telegram_user_id bigint NOT NULL, chat_id bigint NOT NULL,
 message_id bigint NOT NULL, event_type text NOT NULL, content_hash text, text_content text,
 caption text, media_type text, observed_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS public.story_pilot_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 telegram_user_id bigint NOT NULL, event_type text NOT NULL, source text NOT NULL DEFAULT 'security',
 occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
 correlation_key text, dedupe_key text, payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 retention_until timestamptz, chat_id bigint, message_id bigint, story_id bigint,
 actor_user_id bigint, actor_username text, actor_display_name text, direction text,
 UNIQUE(telegram_user_id, dedupe_key));

CREATE TABLE IF NOT EXISTS public.story_pilot_stories (
 telegram_user_id bigint NOT NULL, story_id integer NOT NULL,
 posted_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, watch_until timestamptz NOT NULL,
 audience text, protected boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true,
 deleted_at timestamptz, last_views_count integer NOT NULL DEFAULT 0,
 last_identified_count integer NOT NULL DEFAULT 0, last_forwards_count integer NOT NULL DEFAULT 0,
 last_reactions_count integer NOT NULL DEFAULT 0, last_sync_at timestamptz, last_error text,
 PRIMARY KEY(telegram_user_id, story_id));

CREATE TABLE IF NOT EXISTS public.story_pilot_viewers (
 telegram_user_id bigint NOT NULL, story_id integer NOT NULL, viewer_user_id bigint NOT NULL,
 status text NOT NULL DEFAULT 'provisional', first_seen_at timestamptz NOT NULL, last_seen_at timestamptz NOT NULL,
 viewed_at timestamptz NOT NULL, confirmed_at timestamptz, username text, display_name text,
 is_contact boolean NOT NULL DEFAULT false, reaction_json jsonb, notification_message_id bigint,
 PRIMARY KEY(telegram_user_id, story_id, viewer_user_id));

CREATE TABLE IF NOT EXISTS public.story_pilot_viewer_snapshots (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, telegram_user_id bigint NOT NULL, story_id integer NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(), total_views integer NOT NULL DEFAULT 0,
 identified_views integer NOT NULL DEFAULT 0);

CREATE INDEX IF NOT EXISTS veto_messages_recent_idx ON public.story_pilot_messages(telegram_user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS veto_messages_deleted_idx ON public.story_pilot_messages(telegram_user_id, deleted_at DESC) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS veto_versions_history_idx ON public.story_pilot_message_versions(telegram_user_id,chat_id,message_id,observed_at);

CREATE INDEX IF NOT EXISTS veto_events_recent_idx ON public.story_pilot_events(telegram_user_id,occurred_at DESC);

INSERT INTO public.veto_storage_migrations (version,note) VALUES (1,'VETO Neon reversible standby schema; no Supabase data was copied') ON CONFLICT(version) DO NOTHING;
