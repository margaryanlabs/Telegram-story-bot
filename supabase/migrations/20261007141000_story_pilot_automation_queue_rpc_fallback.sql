-- Reliable PostgREST fallback for Automation Engine queue operations.
-- Keeps queue claiming atomic when direct Postgres from the Edge runtime is temporarily unavailable.

create or replace function public.story_pilot_claim_automation_jobs(
  p_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(25, coalesce(p_limit, 10)));
  v_result jsonb;
begin
  with picked as (
    select id
    from public.story_pilot_automation_jobs
    where attempts < 5
      and (
        (status in ('queued','failed') and available_at <= now())
        or (status = 'sending' and locked_at < now() - interval '5 minutes')
      )
    order by created_at asc
    for update skip locked
    limit v_limit
  ),
  updated as (
    update public.story_pilot_automation_jobs j
    set
      status = 'sending',
      attempts = j.attempts + 1,
      locked_at = now(),
      updated_at = now()
    from picked
    where j.id = picked.id
    returning j.*
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', u.id::text,
        'userId', u.telegram_user_id::text,
        'eventId', u.event_id::text,
        'ruleKey', u.rule_key,
        'attempts', u.attempts,
        'event', jsonb_build_object(
          'type', e.event_type,
          'occurredAt', e.occurred_at,
          'storyId', e.story_id,
          'chatId', case when e.chat_id is null then null else e.chat_id::text end,
          'actorUsername', e.actor_username,
          'actorDisplayName', e.actor_display_name,
          'payload', coalesce(e.payload, '{}'::jsonb)
        )
      )
      order by u.created_at asc
    ),
    '[]'::jsonb
  )
  into v_result
  from updated u
  join public.story_pilot_events e on e.id = u.event_id;

  return v_result;
end;
$$;

revoke all on function public.story_pilot_claim_automation_jobs(integer)
  from public, anon, authenticated;
grant execute on function public.story_pilot_claim_automation_jobs(integer)
  to service_role;

create or replace function public.story_pilot_complete_automation_job(
  p_job_id uuid,
  p_success boolean,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_success then
    update public.story_pilot_automation_jobs
    set
      status = 'sent',
      sent_at = now(),
      last_error = null,
      locked_at = null,
      updated_at = now()
    where id = p_job_id
    returning jsonb_build_object(
      'id', id::text,
      'status', status,
      'attempts', attempts,
      'sent_at', sent_at
    )
    into v_result;
  else
    update public.story_pilot_automation_jobs
    set
      status = 'failed',
      last_error = left(coalesce(p_error, 'automation_failed'), 500),
      available_at = now() + (
        least(30, greatest(1, attempts * attempts))::text || ' minutes'
      )::interval,
      locked_at = null,
      updated_at = now()
    where id = p_job_id
    returning jsonb_build_object(
      'id', id::text,
      'status', status,
      'attempts', attempts,
      'available_at', available_at
    )
    into v_result;
  end if;

  return v_result;
end;
$$;

revoke all on function public.story_pilot_complete_automation_job(uuid,boolean,text)
  from public, anon, authenticated;
grant execute on function public.story_pilot_complete_automation_job(uuid,boolean,text)
  to service_role;
