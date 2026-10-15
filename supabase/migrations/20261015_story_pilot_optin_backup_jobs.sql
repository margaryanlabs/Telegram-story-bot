-- Explicit opt-in, chat-scoped Telegram history backup.
-- Only service-role gateway may access jobs. No user data is public.
create table if not exists public.story_pilot_backup_jobs (
  telegram_user_id bigint not null,
  chat_id bigint not null,
  chat_title text not null default '',
  enabled boolean not null default false,
  media_enabled boolean not null default false,
  notify_completion boolean not null default true,
  offset_id bigint not null default 0 check (offset_id >= 0),
  total_read integer not null default 0 check (total_read >= 0),
  total_saved integer not null default 0 check (total_saved >= 0),
  total_media integer not null default 0 check (total_media >= 0),
  state text not null default 'paused'
    check (state in ('active','paused','done','error')),
  next_run_at timestamptz not null default now(),
  lease_until timestamptz not null default now(),
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (telegram_user_id,chat_id)
);
create index if not exists story_pilot_backup_jobs_ready_idx
  on public.story_pilot_backup_jobs (next_run_at,lease_until)
  where enabled and state='active';

alter table public.story_pilot_backup_jobs enable row level security;
revoke all on public.story_pilot_backup_jobs from public, anon, authenticated;
grant select,insert,update,delete on public.story_pilot_backup_jobs to service_role;

-- Only server-side signed gateway controls these rows.
-- Telegram session tokens remain in separate encrypted viewer session store.
