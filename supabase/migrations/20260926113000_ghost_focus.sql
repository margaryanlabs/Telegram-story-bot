-- Ghost Focus: open delete/edit alerts directly in the affected chat/message.
alter table public.story_pilot_privacy_settings
  add column if not exists ghost_focus boolean not null default true;
