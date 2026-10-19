-- Launch hardening: an atomic active-session limit, per-user request rate
-- limits, and ordering for Stripe subscription events.

-- Active-session limit, checked inside the insert's transaction. Two Starts
-- sent at the same moment used to both pass the count in the API. The numbers
-- mirror PLAN_LIMITS.maxActiveDrips in supabase/functions/_shared/limits.ts.
create or replace function public.enforce_active_drip_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tier public.plan_tier;
  max_active int;
  active int;
begin
  -- One Start at a time per user; the lock ends with the transaction.
  perform pg_advisory_xact_lock(hashtextextended('drips-active:' || new.user_id::text, 0));
  select plan into tier from public.profiles where user_id = new.user_id;
  max_active := case when tier = 'pro' then 3 else 1 end;
  select count(*) into active
    from public.drips
   where user_id = new.user_id and status in ('scheduled', 'running', 'paused');
  if active >= max_active then
    raise exception 'active_drip_limit:%', max_active using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace trigger drips_active_limit
  before insert on public.drips
  for each row
  when (new.status in ('scheduled', 'running', 'paused'))
  execute function public.enforce_active_drip_limit();

-- Fixed-window request counters. Only the service role touches them.
create table if not exists public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (user_id, bucket, window_start)
);
alter table public.rate_limits enable row level security;

-- Counts one request; returns false when the user is over max_hits in the
-- current window.
create or replace function public.hit_rate_limit(
  owner uuid,
  bucket_name text,
  max_hits int,
  window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  start timestamptz := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);
  count_now int;
begin
  insert into public.rate_limits as r (user_id, bucket, window_start, hits)
  values (owner, bucket_name, start, 1)
  on conflict (user_id, bucket, window_start) do update set hits = r.hits + 1
  returning hits into count_now;
  return count_now <= max_hits;
end;
$$;

revoke all on function public.hit_rate_limit(uuid, text, int, int) from public, anon, authenticated;
revoke all on function public.enforce_active_drip_limit() from public, anon, authenticated;
grant execute on function public.hit_rate_limit(uuid, text, int, int) to service_role;

-- The creation time of the newest Stripe subscription event applied, so a
-- late delivery of an older event can't overwrite a newer state.
alter table public.profiles add column if not exists stripe_event_at timestamptz;

-- Gives back words reserved for a Start that then failed (for example at the
-- active-session limit), so a refused Start doesn't use up the day's words.
create or replace function public.release_words(target_user uuid, words integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set words_used_today = greatest(0, words_used_today - words)
   where user_id = target_user
     and usage_date = (now() at time zone 'utc')::date;
$$;

revoke all on function public.release_words(uuid, integer) from public, anon, authenticated;
grant execute on function public.release_words(uuid, integer) to service_role;
