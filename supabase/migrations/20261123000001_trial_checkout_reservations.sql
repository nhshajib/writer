-- Serialize trial eligibility across accounts sharing one normalized mailbox.
-- Existing paid subscriptions and issued checkout links remain unchanged.
create table if not exists public.trial_checkout_reservations (
  normalized_email text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
alter table public.trial_checkout_reservations enable row level security;
drop policy if exists "service only" on public.trial_checkout_reservations;
create policy "service only" on public.trial_checkout_reservations
  for all to service_role using (true) with check (true);
revoke all on public.trial_checkout_reservations from public, anon, authenticated;
grant all on public.trial_checkout_reservations to service_role;
create index if not exists trial_checkout_reservations_user_idx
  on public.trial_checkout_reservations(user_id);
create index if not exists trial_checkout_reservations_expiry_idx
  on public.trial_checkout_reservations(expires_at);

-- "claimed" keeps the existing paid-checkout behavior. "busy" never silently
-- replaces a promised free trial with a paid checkout on an alias account.
create or replace function public.reserve_trial_checkout(email text, owner uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare canonical text := public.normalize_email(email); reserved boolean;
begin
  if owner is null or canonical is null or length(canonical) > 320 or canonical not like '%@%' then
    raise exception 'Invalid trial account.';
  end if;
  if not exists (select 1 from auth.users u where u.id = owner and public.normalize_email(u.email) = canonical) then
    raise exception 'Invalid trial account.';
  end if;
  if exists (select 1 from public.trial_claims c where c.normalized_email = canonical) then
    return 'claimed';
  end if;
  insert into public.trial_checkout_reservations as r(normalized_email, user_id, expires_at)
    values(canonical, owner, now() + interval '25 hours')
    on conflict(normalized_email) do update
      set user_id = excluded.user_id, expires_at = excluded.expires_at
      where r.user_id = owner or r.expires_at <= now()
    returning true into reserved;
  if not coalesce(reserved, false) then return 'busy'; end if;
  -- A webhook may have recorded a claim while the reservation row was locked.
  if exists (select 1 from public.trial_claims c where c.normalized_email = canonical) then
    return 'claimed';
  end if;
  return 'available';
end;
$$;
revoke all on function public.reserve_trial_checkout(text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_trial_checkout(text, uuid) to service_role;
