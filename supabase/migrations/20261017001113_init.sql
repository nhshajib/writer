-- Writer: core schema for scheduled ("drip") writing into a user's documents.
-- All writes happen through Edge Functions using the service role; clients only
-- read their own rows through RLS.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.plan_tier as enum ('free', 'pro');
create type public.doc_provider as enum ('google', 'microsoft', 'test');
create type public.drip_status as enum ('scheduled', 'running', 'paused', 'completed', 'failed', 'canceled');

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan public.plan_tier not null default 'free',
  words_used_today integer not null default 0 check (words_used_today >= 0),
  usage_date date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: owner can read"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Provider connections (OAuth grants to Google / Microsoft)
-- Tokens are AES-GCM ciphertext produced by the Edge Functions. No client access.
-- ---------------------------------------------------------------------------

create table public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.doc_provider not null,
  account_email text,
  refresh_token_enc text,
  access_token_enc text,
  access_token_expires_at timestamptz,
  scopes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, account_email)
);

create index provider_connections_user_idx on public.provider_connections (user_id);

alter table public.provider_connections enable row level security;

-- Owners may read their own connections, but only the token-free columns:
-- table-level privileges are revoked and re-granted per column.
revoke all on public.provider_connections from anon, authenticated;
grant select (id, user_id, provider, account_email, scopes, created_at, updated_at)
  on public.provider_connections to authenticated;

create policy "provider_connections: owner can read"
  on public.provider_connections for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Drips (one scheduled writing job)
-- ---------------------------------------------------------------------------

create table public.drips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.provider_connections (id) on delete cascade,
  provider public.doc_provider not null,
  document_id text not null,
  document_title text,
  document_url text,
  text text not null,
  chunks jsonb not null,
  word_count integer not null check (word_count > 0),
  total_chunks integer not null check (total_chunks > 0),
  chunks_written integer not null default 0 check (chunks_written >= 0),
  interval_seconds integer not null check (interval_seconds >= 0),
  duration_seconds integer not null check (duration_seconds > 0),
  status public.drip_status not null default 'scheduled',
  next_run_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (chunks_written <= total_chunks),
  check (jsonb_typeof(chunks) = 'array')
);

create index drips_user_idx on public.drips (user_id, created_at desc);
create index drips_connection_idx on public.drips (connection_id);
create index drips_due_idx on public.drips (next_run_at) where status in ('scheduled', 'running');

alter table public.drips enable row level security;

create policy "drips: owner can read"
  on public.drips for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Drip events (append-only log)
-- ---------------------------------------------------------------------------

create table public.drip_events (
  id bigint generated always as identity primary key,
  drip_id uuid not null references public.drips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index drip_events_drip_idx on public.drip_events (drip_id, created_at desc);
create index drip_events_user_idx on public.drip_events (user_id);

alter table public.drip_events enable row level security;

create policy "drip_events: owner can read"
  on public.drip_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Test documents (backs the "test" provider so the pipeline can be verified
-- end to end without Google credentials)
-- ---------------------------------------------------------------------------

create table public.test_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index test_documents_user_idx on public.test_documents (user_id);

alter table public.test_documents enable row level security;

create policy "test_documents: owner can read"
  on public.test_documents for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger provider_connections_touch before update on public.provider_connections
  for each row execute function public.touch_updated_at();
create trigger drips_touch before update on public.drips
  for each row execute function public.touch_updated_at();
create trigger test_documents_touch before update on public.test_documents
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Service-role RPCs
-- ---------------------------------------------------------------------------

-- Claims due drips for one tick. SKIP LOCKED keeps overlapping ticks from
-- picking the same row, and the lease pushes next_run_at forward so a tick that
-- dies mid-write is retried later instead of being lost.
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
      and next_run_at <= now()
    order by next_run_at
    limit max_rows
    for update skip locked
  )
  returning d.*;
$$;

-- Atomically appends to a test document.
create or replace function public.append_test_document(doc_id uuid, chunk text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.test_documents set content = content || chunk where id = doc_id;
$$;

-- Reserves daily word quota. Resets the counter when the UTC day changes.
-- Returns false (and reserves nothing) when the request would exceed the limit;
-- a null limit means unlimited.
create or replace function public.reserve_words(target_user uuid, words integer, daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
  used integer;
begin
  insert into public.profiles (user_id) values (target_user) on conflict do nothing;

  select case when usage_date = today then words_used_today else 0 end
    into used
    from public.profiles
    where user_id = target_user
    for update;

  if daily_limit is not null and used + words > daily_limit then
    return false;
  end if;

  update public.profiles
    set words_used_today = used + words,
        usage_date = today
    where user_id = target_user;

  return true;
end;
$$;

-- Reads an app secret from Vault (e.g. the tick secret or a fallback encryption key).
create or replace function public.get_app_secret(secret_name text)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1;
$$;

revoke execute on function public.claim_due_drips(integer, integer) from public, anon, authenticated;
revoke execute on function public.append_test_document(uuid, text) from public, anon, authenticated;
revoke execute on function public.reserve_words(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.get_app_secret(text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.claim_due_drips(integer, integer) to service_role;
grant execute on function public.append_test_document(uuid, text) to service_role;
grant execute on function public.reserve_words(uuid, integer, integer) to service_role;
grant execute on function public.get_app_secret(text) to service_role;
