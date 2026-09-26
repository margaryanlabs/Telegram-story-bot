-- Telegram Control Automation Engine v1.
-- Durable rules + queue; actions are limited to the owner's own Control/bot notifications.

create table if not exists public.story_pilot_automation_rules (
  telegram_user_id bigint not null,
  rule_key text not null check (rule_key in ('security_changes','smart_action','confirmed_viewer')),
  enabled boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (telegram_user_id, rule_key)
);

create table if not exists public.story_pilot_automation_jobs (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null,
  event_id uuid not null references public.story_pilot_events(id) on delete cascade,
  rule_key text not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','skipped')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, rule_key)
);

create index if not exists story_pilot_automation_jobs_ready_idx
  on public.story_pilot_automation_jobs (status, available_at, created_at)
  where status in ('queued','failed');

create index if not exists story_pilot_automation_jobs_owner_idx
  on public.story_pilot_automation_jobs (telegram_user_id, created_at desc);

alter table public.story_pilot_automation_rules enable row level security;
alter table public.story_pilot_automation_jobs enable row level security;

revoke all on public.story_pilot_automation_rules from anon, authenticated;
revoke all on public.story_pilot_automation_jobs from anon, authenticated;

create or replace function public.story_pilot_automation_enabled(
  p_user_id bigint,
  p_rule_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select enabled
      from public.story_pilot_automation_rules
      where telegram_user_id = p_user_id
        and rule_key = p_rule_key
      limit 1
    ),
    case when p_rule_key = 'security_changes' then true else false end
  );
$$;

revoke all on function public.story_pilot_automation_enabled(bigint,text) from public, anon, authenticated;

create or replace function public.story_pilot_enqueue_automation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule_key text;
  v_smart boolean;
begin
  v_rule_key := null;

  if new.event_type in ('session.created','session.revoked','security.event') then
    v_rule_key := 'security_changes';
  elsif new.event_type = 'story.view.confirmed' then
    v_rule_key := 'confirmed_viewer';
  elsif new.event_type = 'message.new' then
    v_smart := coalesce((new.payload->>'smartAction')::boolean, false);
    if v_smart then
      v_rule_key := 'smart_action';
    end if;
  end if;

  if v_rule_key is not null
     and public.story_pilot_automation_enabled(new.telegram_user_id, v_rule_key) then
    insert into public.story_pilot_automation_jobs (
      telegram_user_id,
      event_id,
      rule_key,
      status,
      available_at
    )
    values (
      new.telegram_user_id,
      new.id,
      v_rule_key,
      'queued',
      now()
    )
    on conflict (event_id, rule_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists story_pilot_events_automation_trigger on public.story_pilot_events;
create trigger story_pilot_events_automation_trigger
after insert on public.story_pilot_events
for each row execute function public.story_pilot_enqueue_automation();
