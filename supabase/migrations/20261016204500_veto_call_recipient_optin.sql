-- Explicit Telegram call invitation notifications. OFF by default.
-- Never expose addresses to browser/PostgREST. Only signed Edge access.
create table if not exists public.story_pilot_call_optins (
  telegram_user_id bigint primary key check (telegram_user_id > 0),
  notifications_enabled boolean not null default false,
  last_alert_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.story_pilot_call_optins enable row level security;
revoke all on public.story_pilot_call_optins from public, anon, authenticated;

alter table public.story_pilot_call_rooms
  add column if not exists recipient_id bigint
  check (recipient_id is null or (recipient_id > 0 and recipient_id <> caller_id));
create index if not exists story_pilot_call_rooms_recipient_idx
  on public.story_pilot_call_rooms(recipient_id, expires_at desc)
  where recipient_id is not null;
