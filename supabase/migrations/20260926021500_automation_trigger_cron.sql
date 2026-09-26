-- Run Automation Engine worker once per minute through the signed Supabase trigger.

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'story-pilot-automation-trigger'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'story-pilot-automation-trigger',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://xvtmgzzaomolnvkcgosk.supabase.co/functions/v1/story-pilot-automation-trigger',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"scheduled":true}'::jsonb,
      timeout_milliseconds := 20000
    );
  $$
);
