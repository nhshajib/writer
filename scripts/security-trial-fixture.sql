-- Isolated PostgreSQL only. Never run this fixture setup against production.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create table auth.users(id uuid primary key, email text);
create table public.trial_claims(normalized_email text primary key);
create function public.normalize_email(email text) returns text language sql immutable set search_path='' as $$
  select replace(split_part(split_part(lower(email), '@', 1), '+', 1), '.', '') || '@gmail.com';
$$;
