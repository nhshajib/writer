-- Isolated PostgreSQL fixtures only; never run against customer accounts.
begin;
do $$
declare owner_id uuid:=gen_random_uuid(); first_lease uuid:=gen_random_uuid(); next_lease uuid:=gen_random_uuid();
begin
  insert into auth.users(id) values(owner_id);
  if not public.acquire_billing_checkout(owner_id,first_lease) then raise exception 'Initial checkout lease refused'; end if;
  if public.acquire_billing_checkout(owner_id,next_lease) then raise exception 'Concurrent checkout lease accepted'; end if;
  update public.billing_checkout_locks set expires_at=now()-interval '1 second' where user_id=owner_id;
  if not public.acquire_billing_checkout(owner_id,next_lease) then raise exception 'Expired checkout lease not recovered'; end if;
  delete from public.billing_checkout_locks where user_id=owner_id and lease_id=first_lease;
  if not exists(select 1 from public.billing_checkout_locks where user_id=owner_id and lease_id=next_lease) then
    raise exception 'Stale release removed new lease'; end if;
  if public.acquire_billing_checkout(null,null) then raise exception 'Null owner accepted'; end if;
  if has_function_privilege('authenticated','public.acquire_billing_checkout(uuid,uuid)','EXECUTE')
    or has_table_privilege('authenticated','public.billing_checkout_locks','SELECT') then
    raise exception 'Client can inspect or acquire service-only checkout leases'; end if;
  delete from auth.users where id=owner_id;
  if exists(select 1 from public.billing_checkout_locks where user_id=owner_id) then raise exception 'Account cleanup stranded checkout lease'; end if;
end;
$$;
rollback;
