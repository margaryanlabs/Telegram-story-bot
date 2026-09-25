-- Normalized Telegram Control event vault.
-- Existing source tables remain authoritative; this is an additive activity layer.

create table if not exists public.story_pilot_events (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null,
  event_type text not null,
  source text not null,
  occurred_at timestamptz not null default now(),
  chat_id bigint,
  message_id bigint,
  story_id bigint,
  actor_user_id bigint,
  actor_username text,
  actor_display_name text,
  direction text,
  correlation_key text,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  retention_until timestamptz,
  created_at timestamptz not null default now(),
  unique (telegram_user_id, dedupe_key)
);

create index if not exists story_pilot_events_owner_time_idx
  on public.story_pilot_events (telegram_user_id, occurred_at desc);

create index if not exists story_pilot_events_owner_type_time_idx
  on public.story_pilot_events (telegram_user_id, event_type, occurred_at desc);

create index if not exists story_pilot_events_retention_idx
  on public.story_pilot_events (retention_until)
  where retention_until is not null;

alter table public.story_pilot_events enable row level security;

revoke all on table public.story_pilot_events from anon, authenticated;
