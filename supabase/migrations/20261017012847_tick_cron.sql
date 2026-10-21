-- Runs the drip worker every minute.
--
-- Requires two Vault secrets (see README → "Setup"):
--   project_url  e.g. https://<project-ref>.supabase.co
--   tick_secret  random string; drip-tick rejects calls without it

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.schedule(
  'writer-drip-tick',
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
