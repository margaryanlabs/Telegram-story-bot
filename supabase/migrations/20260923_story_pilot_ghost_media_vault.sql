-- Story Pilot Ghost cross-platform media vault
-- Adds independent private media archival and replaces row-only retention
-- with maintenance that removes Storage objects before database rows.

alter table public.story_pilot_messages
  add column if not exists media_storage_path text,
  add column if not exists media_archived_at timestamptz,
  add column if not exists media_archive_status text not null default 'none',
  add column if not exists media_archive_error text;

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'story_pilot_maintenance_secret'
  ) then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'story_pilot_maintenance_secret',
      'Authorizes the internal Story Pilot privacy retention maintenance request.'
    );
  end if;
end
$$;

create or replace function public.story_pilot_maintenance_secret_ok(p_secret text)
returns boolean
language sql
security definer
set search_path = public, vault
as $$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'story_pilot_maintenance_secret'
      and decrypted_secret = p_secret
  );
$$;

revoke all on function public.story_pilot_maintenance_secret_ok(text) from public, anon, authenticated;
grant execute on function public.story_pilot_maintenance_secret_ok(text) to service_role;

do $$
declare
  r record;
begin
  for r in select jobid from cron.job where jobname in (
    'story-pilot-ghost-retention',
    'story-pilot-ghost-vault-retention'
  )
  loop
    perform cron.unschedule(r.jobid);
  end loop;
end
$$;

select cron.schedule(
  'story-pilot-ghost-vault-retention',
  '17 3 * * *',
  $$
    select net.http_post(
      url := 'https://xvtmgzzaomolnvkcgosk.supabase.co/functions/v1/story-pilot-store',
      body := '{"op":"cleanup_privacy_retention_global","args":{}}'::jsonb,
      params := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-maintenance-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'story_pilot_maintenance_secret'
          limit 1
        )
      ),
      timeout_milliseconds := 15000
    );
  $$
);
