-- pg_cron fires on the minute, but a step sets next_run_at to "now + interval",
-- which lands a fraction of a second after the next tick and would otherwise be
-- skipped until the tick after (doubling the effective interval). Claim drips
-- that are due within half a tick (30s) instead.
create or replace function public.claim_due_drips(max_rows integer default 50, lease_seconds integer default 300)
returns setof public.drips
language sql
security definer
set search_path = ''
as $$
  update public.drips d
  set status = 'running',
      next_run_at = now() + make_interval(secs => lease_seconds)
  where d.id in (
    select id from public.drips
    where status in ('scheduled', 'running')
      and next_run_at <= now() + interval '30 seconds'
    order by next_run_at
    limit max_rows
    for update skip locked
  )
  returning d.*;
$$;
