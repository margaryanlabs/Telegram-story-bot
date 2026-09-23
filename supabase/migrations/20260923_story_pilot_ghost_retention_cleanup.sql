-- Story Pilot Ghost retention cleanup
-- Physically removes expired Ghost messages according to each user's retention_days.
-- message_versions are removed automatically through ON DELETE CASCADE.

select cron.schedule(
  'story-pilot-ghost-retention',
  '17 3 * * *',
  $$
    delete from public.story_pilot_messages m
    using public.story_pilot_privacy_settings s
    where m.telegram_user_id = s.telegram_user_id
      and m.sent_at < now() - make_interval(days => s.retention_days);
  $$
);
