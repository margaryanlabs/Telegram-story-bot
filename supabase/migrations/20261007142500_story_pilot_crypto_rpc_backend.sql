-- Move Viewer Sync crypto key access behind service-role-only RPCs.
-- This removes the one-minute watcher from direct Postgres/Supavisor dependency
-- while keeping key material outside exposed schemas.

create or replace function public.story_pilot_get_or_create_viewer_crypto_key(
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path = public, story_pilot_private
as $$
declare
  v_environment text := lower(coalesce(p_environment, ''));
  v_row story_pilot_private.crypto_keys%rowtype;
  v_key_id text;
begin
  if v_environment not in ('production', 'preview') then
    raise exception 'invalid_viewer_crypto_environment';
  end if;

  select *
  into v_row
  from story_pilot_private.crypto_keys
  where purpose = 'viewer_sync_session'
    and environment = v_environment
    and status = 'active'
  order by created_at desc
  limit 1;

  if v_row.key_id is null then
    v_key_id := 'viewer-sync-' || v_environment || '-' || gen_random_uuid()::text;

    begin
      insert into story_pilot_private.crypto_keys (
        key_id, purpose, environment, secret_value, status
      )
      values (
        v_key_id,
        'viewer_sync_session',
        v_environment,
        encode(gen_random_bytes(32), 'base64'),
        'active'
      );
    exception
      when unique_violation then
        null;
    end;

    select *
    into v_row
    from story_pilot_private.crypto_keys
    where purpose = 'viewer_sync_session'
      and environment = v_environment
      and status = 'active'
    order by created_at desc
    limit 1;
  end if;

  if v_row.key_id is null or v_row.secret_value is null then
    raise exception 'viewer_crypto_active_key_missing';
  end if;

  return jsonb_build_object(
    'key_id', v_row.key_id,
    'secret_value', v_row.secret_value,
    'status', v_row.status
  );
end;
$$;

revoke all on function public.story_pilot_get_or_create_viewer_crypto_key(text)
  from public, anon, authenticated;
grant execute on function public.story_pilot_get_or_create_viewer_crypto_key(text)
  to service_role;

create or replace function public.story_pilot_get_viewer_crypto_key(
  p_environment text,
  p_key_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, story_pilot_private
as $$
declare
  v_environment text := lower(coalesce(p_environment, ''));
  v_row story_pilot_private.crypto_keys%rowtype;
begin
  if v_environment not in ('production', 'preview') then
    raise exception 'invalid_viewer_crypto_environment';
  end if;
  if coalesce(p_key_id, '') = '' then
    raise exception 'viewer_crypto_key_required';
  end if;

  select *
  into v_row
  from story_pilot_private.crypto_keys
  where purpose = 'viewer_sync_session'
    and environment = v_environment
    and key_id = p_key_id
    and status in ('active', 'retired')
  limit 1;

  if v_row.secret_value is null then
    raise exception 'viewer_crypto_key_version_unavailable';
  end if;

  return jsonb_build_object(
    'key_id', v_row.key_id,
    'secret_value', v_row.secret_value,
    'status', v_row.status
  );
end;
$$;

revoke all on function public.story_pilot_get_viewer_crypto_key(text,text)
  from public, anon, authenticated;
grant execute on function public.story_pilot_get_viewer_crypto_key(text,text)
  to service_role;
