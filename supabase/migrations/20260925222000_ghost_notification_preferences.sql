-- Independent Ghost notification preferences.
-- Preserve current product behavior for users who already enabled protection.

alter table public.story_pilot_privacy_settings
  add column if not exists notify_edits boolean not null default true;

alter table public.story_pilot_privacy_settings
  alter column notify_deletes set default true;

update public.story_pilot_privacy_settings
set notify_deletes = true
where anti_delete = true
  and notify_deletes = false;
