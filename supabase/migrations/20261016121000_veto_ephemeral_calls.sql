-- VETO Telegram Calls: ephemeral, owner-bound WebRTC signaling only.
-- SDP can contain network addresses. Treat it as sensitive and delete it quickly.
-- No browser Data API grants, no direct client policies, no transcripts/audio/media here.
create table if not exists public.story_pilot_call_rooms (
  room_id text primary key check (room_id ~ '^[a-f0-9]{32}$'),
  invite_hash text not null check (invite_hash ~ '^[a-f0-9]{64}$'),
  caller_id bigint not null check (caller_id > 0),
  callee_id bigint check (callee_id > 0 and callee_id <> caller_id),
  offer_sdp text not null check (length(offer_sdp) between 50 and 30000),
  answer_sdp text check (answer_sdp is null or length(answer_sdp) between 50 and 30000),
  status text not null default 'offered'
    check (status in ('offered', 'answered')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at and expires_at <= created_at + interval '10 minutes'),
  check (status <> 'answered' or (callee_id is not null and answer_sdp is not null))
);

create index if not exists story_pilot_call_rooms_owner_active_idx
  on public.story_pilot_call_rooms(caller_id, created_at desc);
create index if not exists story_pilot_call_rooms_expiry_idx
  on public.story_pilot_call_rooms(expires_at);
alter table public.story_pilot_call_rooms enable row level security;
revoke all on public.story_pilot_call_rooms from public, anon, authenticated;

-- Hard-delete expired SDP material, even when a caller closes their browser.
-- cron is already used by the existing VETO Telegram storage project.
do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    if exists(select 1 from cron.job where jobname='veto-call-room-ttl') then
      perform cron.unschedule('veto-call-room-ttl');
    end if;
    perform cron.schedule('veto-call-room-ttl','*/5 * * * *',
      'delete from public.story_pilot_call_rooms where expires_at < now()');
  end if;
end $$;
