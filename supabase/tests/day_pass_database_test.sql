-- Isolated PostgreSQL only. All fixture changes roll back.
begin;
do $$
declare owner_id uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid(); expiry timestamptz; again timestamptz; picked text;
begin
  insert into auth.users(id) values(owner_id),(other_id);
  expiry:=public.grant_day_pass(owner_id,'fixture-checkout','fixture-intent');
  if expiry<>now()+interval '24 hours' then raise exception 'Wrong pass lifetime'; end if;
  again:=public.grant_day_pass(owner_id,'fixture-checkout','fixture-intent');
  if again<>expiry or (select count(*) from public.day_pass_purchases where user_id=owner_id)<>1 then raise exception 'Duplicate extended grant'; end if;
  begin
    perform public.grant_day_pass(other_id,'fixture-checkout','fixture-intent');
    raise exception 'Wrong owner accepted';
  exception when raise_exception then if sqlerrm<>'Payment ownership mismatch.' then raise; end if; end;
  if (select day_pass_expires_at from public.profiles where user_id=owner_id)<>expiry then raise exception 'Profile not activated'; end if;
  perform public.refund_day_pass('fixture-intent');
  if (select day_pass_expires_at from public.profiles where user_id=owner_id) is not null then raise exception 'Refund did not revoke'; end if;
  if public.grant_day_pass(owner_id,'fixture-checkout','fixture-intent') is not null then raise exception 'Replay restored refund'; end if;
  perform public.refund_day_pass('fixture-early-refund');
  if public.grant_day_pass(owner_id,'fixture-early-checkout','fixture-early-refund') is not null then raise exception 'Refund before payment restored access'; end if;
  perform public.grant_day_pass(owner_id,'fixture-next-checkout','fixture-next-intent');
  perform public.refund_day_pass('fixture-intent');
  if (select day_pass_expires_at from public.profiles where user_id=owner_id) is null then raise exception 'Old refund revoked new payment'; end if;
  if has_table_privilege('authenticated','public.day_pass_purchases','SELECT') or has_table_privilege('anon','public.day_pass_refunds','INSERT')
    or has_function_privilege('authenticated','public.grant_day_pass(uuid,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.refund_day_pass(text)','EXECUTE') then raise exception 'Client can forge pass access'; end if;
  insert into public.provider_connections(id,user_id,provider,account_email) values(gen_random_uuid(),owner_id,'test','fixture.invalid');
  insert into public.drips(user_id,connection_id,provider,document_id,text,chunks,word_count,total_chunks,interval_seconds,duration_seconds,status,access_expires_at)
    select owner_id,id,'test','fixture-document','test','["test"]',1,1,60,60,'paused',now()+interval '1 hour' from public.provider_connections where user_id=owner_id limit 1;
  update public.profiles set plan='pro' where user_id=owner_id;
  if exists(select 1 from public.drips where user_id=owner_id and access_expires_at is not null) then raise exception 'Upgrade left old session expiry'; end if;
  if has_column_privilege('authenticated','public.profiles','day_pass_expires_at','UPDATE') then raise exception 'Client can extend own pass'; end if;
  insert into public.provider_connections(id,user_id,provider,account_email) values(gen_random_uuid(),other_id,'test','other-fixture.invalid');
  insert into public.drips(user_id,connection_id,provider,document_id,text,chunks,word_count,total_chunks,interval_seconds,duration_seconds,status,next_run_at)
    select owner_id,id,'test','paid-priority','test','["test"]',1,1,60,60,'scheduled',now() from public.provider_connections where user_id=owner_id limit 1;
  insert into public.drips(user_id,connection_id,provider,document_id,text,chunks,word_count,total_chunks,interval_seconds,duration_seconds,status,next_run_at)
    select other_id,id,'test','older-free','test','["test"]',1,1,60,60,'scheduled',now()-interval '30 seconds' from public.provider_connections where user_id=other_id limit 1;
  select document_id into picked from public.claim_due_worker_drips(1,240,60);
  if picked<>'older-free' then raise exception 'Priority starved older free work'; end if;
  select document_id into picked from public.claim_due_worker_drips(1,240,60);
  if picked<>'paid-priority' then raise exception 'Priority claim failed'; end if;

  delete from auth.users where id=owner_id;
  if exists(select 1 from public.day_pass_purchases where user_id=owner_id) then raise exception 'Account deletion stranded purchase'; end if;
end;
$$;
rollback;
