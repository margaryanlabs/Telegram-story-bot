-- Durable Telegram Business connection state.
-- Menu-button URL remains a navigation surface, not the source of truth.

create table if not exists public.story_pilot_business_connections (
  telegram_user_id bigint primary key,
  business_connection_id text,
  is_enabled boolean not null default false,
  can_manage_stories boolean not null default false,
  can_read_messages boolean not null default false,
  source text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists story_pilot_business_connections_enabled_idx
  on public.story_pilot_business_connections (is_enabled, updated_at desc);

alter table public.story_pilot_business_connections enable row level security;
revoke all on public.story_pilot_business_connections from anon, authenticated;
