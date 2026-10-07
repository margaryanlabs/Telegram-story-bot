-- VETO Telegram Intelligence Suite: Story Radar + Business Agent preferences.

create table if not exists public.story_pilot_radar_targets (
  telegram_user_id bigint not null,
  peer_key text not null,
  display_name text,
  enabled boolean not null default true,
  notify_new_story boolean not null default true,
  last_story_id integer,
  last_story_at timestamptz,
  last_checked_at timestamptz,
  last_notified_story_id integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (telegram_user_id, peer_key)
);

create index if not exists story_pilot_radar_targets_enabled_idx
  on public.story_pilot_radar_targets (telegram_user_id, enabled, updated_at desc);

alter table public.story_pilot_radar_targets enable row level security;
revoke all on public.story_pilot_radar_targets from public, anon, authenticated;
grant all on public.story_pilot_radar_targets to service_role;

create table if not exists public.story_pilot_business_agent_settings (
  telegram_user_id bigint primary key,
  enabled boolean not null default false,
  lead_alerts boolean not null default true,
  mode text not null default 'draft'
    check (mode in ('off','draft','assist')),
  lead_keywords text[] not null default array[
    'price','pricing','cost','buy','order','book','available',
    'цена','стоимость','купить','заказать','забронировать','доступно'
  ]::text[],
  greeting text,
  updated_at timestamptz not null default now()
);

alter table public.story_pilot_business_agent_settings enable row level security;
revoke all on public.story_pilot_business_agent_settings from public, anon, authenticated;
grant all on public.story_pilot_business_agent_settings to service_role;

comment on table public.story_pilot_radar_targets is
  'User-selected Telegram peers monitored for newly visible active Stories.';
comment on table public.story_pilot_business_agent_settings is
  'Server-only preferences for VETO Business Agent lead detection and assist mode.';
