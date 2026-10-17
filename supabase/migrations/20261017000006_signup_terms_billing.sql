-- Sign-up email policy, Responsible Use Agreement, one trial per person, Stripe billing.

-- ---------------------------------------------------------------------------
-- Allowed sign-up email providers (personal mail only; no disposable or
-- business domains). Readable by anyone so the sign-up form can check early.
-- ---------------------------------------------------------------------------

create table public.allowed_email_domains (
  domain text primary key check (domain = lower(domain))
);

alter table public.allowed_email_domains enable row level security;

create policy "allowed_email_domains: anyone can read"
  on public.allowed_email_domains for select
  to anon, authenticated
  using (true);

insert into public.allowed_email_domains (domain) values
  ('gmail.com'), ('googlemail.com'),
  ('outlook.com'), ('hotmail.com'), ('hotmail.co.uk'), ('live.com'), ('msn.com'),
  ('yahoo.com'), ('yahoo.co.uk'), ('ymail.com'), ('rocketmail.com'),
  ('icloud.com'), ('me.com'), ('mac.com'),
  ('aol.com'),
  ('proton.me'), ('protonmail.com'),
  ('gmx.com'), ('gmx.net'),
  ('mail.com'),
  ('yandex.com');

-- Canonical form of an address, so aliases of one mailbox count as one person:
-- lower case, "+tag" removed, and for Gmail dots removed and googlemail -> gmail.
create or replace function public.normalize_email(email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(lower(email), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(email), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else split_part(split_part(lower(email), '@', 1), '+', 1) || '@' || split_part(lower(email), '@', 2)
  end;
$$;

-- Supabase Auth "Before User Created" hook. Enable it in the dashboard:
-- Authentication -> Hooks -> Before User Created -> Postgres function
-- public.hook_before_user_created.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_email text := lower(coalesce(event -> 'user' ->> 'email', ''));
  email_domain text := split_part(user_email, '@', 2);
begin
  if user_email = '' or not exists (
    select 1 from public.allowed_email_domains d where d.domain = email_domain
  ) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Please sign up with a personal email address from a common provider such as Gmail, Outlook, Yahoo or iCloud.'
    ));
  end if;
  return '{}'::jsonb;
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Responsible Use Agreement and billing state on profiles. None of these
-- columns are client-writable (profiles only grants update on
-- email_notifications); the agreement is recorded through agree_to_terms().
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column agreed_terms_version text,
  add column agreed_terms_at timestamptz,
  add column stripe_customer_id text unique,
  add column subscription_status text;

-- New users: record the agreement the sign-up form sent in user metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  version text := nullif(new.raw_user_meta_data ->> 'agreed_terms_version', '');
begin
  insert into public.profiles (user_id, agreed_terms_version, agreed_terms_at)
  values (new.id, version, case when version is not null then now() end)
  on conflict do nothing;
  return new;
end;
$$;

-- Existing users (or a new agreement version): the signed-in user agrees.
create or replace function public.agree_to_terms(version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;
  if version is null or length(version) = 0 or length(version) > 32 then
    raise exception 'Invalid agreement version.';
  end if;
  update public.profiles
    set agreed_terms_version = version, agreed_terms_at = now()
    where user_id = auth.uid();
end;
$$;

revoke execute on function public.agree_to_terms(text) from public, anon;
grant execute on function public.agree_to_terms(text) to authenticated;

-- ---------------------------------------------------------------------------
-- One free trial per person. Keyed by normalized email and kept when the
-- account is deleted, so deleting and re-registering doesn't grant a new trial.
-- ---------------------------------------------------------------------------

create table public.trial_claims (
  normalized_email text primary key,
  user_id uuid references auth.users (id) on delete set null,
  stripe_subscription_id text,
  claimed_at timestamptz not null default now()
);

create index trial_claims_user_idx on public.trial_claims (user_id);

alter table public.trial_claims enable row level security;
-- No policies: service role only.

create or replace function public.trial_available(email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.trial_claims where normalized_email = public.normalize_email(email)
  );
$$;

create or replace function public.claim_trial(email text, claimant uuid, subscription_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.trial_claims (normalized_email, user_id, stripe_subscription_id)
  values (public.normalize_email(email), claimant, subscription_id)
  on conflict (normalized_email) do nothing;
$$;

revoke execute on function public.trial_available(text) from public, anon, authenticated;
revoke execute on function public.claim_trial(text, uuid, text) from public, anon, authenticated;
grant execute on function public.trial_available(text) to service_role;
grant execute on function public.claim_trial(text, uuid, text) to service_role;

-- Stripe webhook idempotency: each event is processed once.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
-- No policies: service role only.
