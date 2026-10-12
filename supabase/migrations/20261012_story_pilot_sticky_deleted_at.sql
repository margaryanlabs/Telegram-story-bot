-- Keep archived delete tombstones sticky when Telegram retries the original
-- message update after a later delete event. Both direct SQL and PostgREST
-- upsert paths must preserve evidence of an already-processed deletion.
create or replace function public.story_pilot_keep_deleted_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.deleted_at is not null and new.deleted_at is null then
    new.deleted_at := old.deleted_at;
  end if;
  return new;
end;
$$;

revoke all on function public.story_pilot_keep_deleted_at() from public;
drop trigger if exists story_pilot_keep_deleted_at on public.story_pilot_messages;
create trigger story_pilot_keep_deleted_at
before update on public.story_pilot_messages
for each row
when (old.deleted_at is not null and new.deleted_at is null)
execute function public.story_pilot_keep_deleted_at();
