-- Story Pilot Ghost delete alerts
-- User-controlled and disabled by default to avoid unwanted notifications.

alter table public.story_pilot_privacy_settings
  add column if not exists notify_deletes boolean not null default false;
