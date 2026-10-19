-- Per-event email preferences and a worker heartbeat for health checks and the
-- daily clean-up (which drip-tick runs; see cleanupOldData in drip-tick).

-- Which emails a person wants. email_notifications stays the master switch.
alter table public.profiles add column if not exists email_on_completed boolean not null default true;
alter table public.profiles add column if not exists email_on_attention boolean not null default true;
grant update (email_notifications, email_on_completed, email_on_attention) on public.profiles to authenticated;

-- The worker's last run (so GET /drips/health can tell when pg_cron or
-- drip-tick has stopped) and its last clean-up. Service role only.
create table if not exists public.worker_heartbeat (
  id int primary key default 1 check (id = 1),
  last_tick_at timestamptz not null default now(),
  last_claimed int not null default 0,
  last_cleanup_at timestamptz
);
alter table public.worker_heartbeat enable row level security;
insert into public.worker_heartbeat (id) values (1) on conflict do nothing;
