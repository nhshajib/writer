-- Rename the worker cron job for the TypeWit brand (same schedule and command).

select cron.unschedule('writer-drip-tick')
where exists (select 1 from cron.job where jobname = 'writer-drip-tick');

select cron.schedule(
  'typewit-drip-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/drip-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-tick-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'tick_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
