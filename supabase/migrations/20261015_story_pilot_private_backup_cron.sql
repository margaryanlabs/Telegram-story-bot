-- Trigger only consented jobs, via a Vault-authenticated Supabase Edge Function.
-- At most two approved chat histories are processed per tick, no unapproved
-- sessions are scanned. Worker uses signed Ed25519 request to Vercel.
select cron.schedule(
  'story-pilot-private-history-backup',
  '*/5 * * * *',
  $backup_schedule$
    select net.http_post(
      url := 'https://xvtmgzzaomolnvkcgosk.supabase.co/functions/v1/story-pilot-backup-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-maintenance-secret', (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'story_pilot_maintenance_secret' limit 1
        )
      ),
      body := '{"scheduled":true}'::jsonb,
      timeout_milliseconds := 15000
    );
  $backup_schedule$
);
