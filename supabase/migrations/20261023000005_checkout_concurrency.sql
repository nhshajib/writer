-- Serialize checkout preparation across edge isolates. No customer data is
-- rewritten; expired locks recover automatically after an interrupted request.
create table if not exists public.billing_checkout_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lease_id uuid not null,
  expires_at timestamptz not null
);
alter table public.billing_checkout_locks enable row level security;
revoke all on public.billing_checkout_locks from public,anon,authenticated;
grant all on public.billing_checkout_locks to service_role;
do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='billing_checkout_locks' and policyname='service only') then
    create policy "service only" on public.billing_checkout_locks to service_role using(true) with check(true);
  end if;
end;
$$;
create or replace function public.acquire_billing_checkout(owner uuid, lease uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if owner is null or lease is null then return false; end if;
  insert into public.billing_checkout_locks as locks(user_id,lease_id,expires_at)
    values(owner,lease,now()+interval '3 minutes')
    on conflict(user_id) do update set lease_id=excluded.lease_id,expires_at=excluded.expires_at
      where locks.expires_at<=now();
  return found;
end;
$$;
revoke all on function public.acquire_billing_checkout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.acquire_billing_checkout(uuid,uuid) to service_role;
