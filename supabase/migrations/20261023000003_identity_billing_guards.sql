-- One-time, browser-bound Google connect challenges. Only a hash of the
-- browser's verifier is stored, and authorization codes are never stored.
create table if not exists public.google_oauth_nonces (
  nonce uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  browser_hash text not null,
  expires_at timestamptz not null,
  returned_at timestamptz,
  used_at timestamptz
);
alter table public.google_oauth_nonces enable row level security;
revoke all on public.google_oauth_nonces from public,anon,authenticated;
grant all on public.google_oauth_nonces to service_role;
create index if not exists google_oauth_nonces_expiry_idx on public.google_oauth_nonces(expires_at);
create index if not exists google_oauth_nonces_user_idx on public.google_oauth_nonces(user_id);
create or replace function public.consume_google_oauth_nonce(owner uuid, flow uuid, verifier_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.google_oauth_nonces set used_at=now() where nonce=flow and user_id=owner
    and browser_hash=verifier_hash and expires_at>now() and returned_at is not null and used_at is null;
  return found;
end;
$$;
revoke all on function public.consume_google_oauth_nonce(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.consume_google_oauth_nonce(uuid,uuid,text) to service_role;

alter table public.profiles add column if not exists eligibility_blocked_at timestamptz;
create or replace function public.confirm_age(country text,birth_year integer,birth_month integer,guardian boolean)
returns text language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); code text:=upper(coalesce(country,'')); age integer; profile public.profiles;
begin
  if me is null then raise exception 'Not signed in.'; end if;
  select * into profile from public.profiles where user_id=me for update;
  if not found or profile.age_confirmed_at is not null then
    raise exception 'Your age has already been confirmed.';
  end if;
  if code !~ '^[A-Z]{2}$' or birth_month is null or birth_month not between 1 and 12
    or birth_year is null or birth_year<1900 or birth_year>extract(year from current_date)::integer then
    raise exception 'Choose your country and the month and year you were born.';
  end if;
  age:=public.age_from(birth_year,birth_month);
  if age<public.minimum_age(code) then
    -- No direct auth.users deletion: billing and Google cleanup must go
    -- through the account-deletion path. Keep the existing UI result.
    update public.profiles set eligibility_blocked_at=now(),age_confirmed_at=now(),
      country=code,birth_year=confirm_age.birth_year,birth_month=confirm_age.birth_month where user_id=me;
    update public.drips set status='canceled',next_run_at=null,lease_id=null
      where user_id=me and status in ('scheduled','running','paused');
    return 'too_young';
  end if;
  if age<18 and not coalesce(guardian,false) then return 'guardian_needed'; end if;
  update public.profiles set country=code,birth_year=confirm_age.birth_year,birth_month=confirm_age.birth_month,
    age_confirmed_at=now(),guardian_confirmed_at=case when age<18 then now() end where user_id=me;
  return 'ok';
end;
$$;
revoke all on function public.confirm_age(text,integer,integer,boolean) from public,anon;
grant execute on function public.confirm_age(text,integer,integer,boolean) to authenticated;

create or replace function public.agree_to_terms(version text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;
  if version is distinct from '2026-10-21' then raise exception 'Please accept the current agreement.'; end if;
  update public.profiles set agreed_terms_version=version,agreed_terms_at=now() where user_id=auth.uid();
end;
$$;
revoke all on function public.agree_to_terms(text) from public,anon;
grant execute on function public.agree_to_terms(text) to authenticated;

-- A crash before completion leaves processed_at null, so Stripe retries work.
alter table public.stripe_events add column if not exists processed_at timestamptz;
-- Existing receipt rows were processed by the old handler; replaying them is
-- harmless but not required. Do not change any existing profile or customer.
alter table public.profiles add column if not exists stripe_sync_generation bigint not null default 0;
create or replace function public.begin_stripe_sync(owner uuid) returns bigint
language sql security definer set search_path='' as $$
  update public.profiles set stripe_sync_generation=stripe_sync_generation+1
    where user_id=owner returning stripe_sync_generation;
$$;
revoke all on function public.begin_stripe_sync(uuid) from public,anon,authenticated;
grant execute on function public.begin_stripe_sync(uuid) to service_role;

-- Explicit policies for new service-only tables (no client grants).
do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='google_oauth_nonces' and policyname='service only') then
    create policy "service only" on public.google_oauth_nonces to service_role using(true) with check(true);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='google_write_windows' and policyname='service only') then
    create policy "service only" on public.google_write_windows to service_role using(true) with check(true);
  end if;
end;
$$;
