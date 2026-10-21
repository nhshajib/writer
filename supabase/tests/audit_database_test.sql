-- Isolated PostgreSQL only. All fixtures and test functions roll back.
begin;
do $$
declare owner_id uuid:=gen_random_uuid(); conn uuid:=gen_random_uuid(); drip uuid:=gen_random_uuid();
  second_drip uuid:=gen_random_uuid(); nonce_id uuid:=gen_random_uuid(); got boolean;
begin
  insert into auth.users(id) values(owner_id);
  insert into public.provider_connections(id,user_id,provider,account_email) values(conn,owner_id,'test','fixture.invalid');
  insert into public.drips(id,user_id,connection_id,provider,document_id,text,chunks,word_count,total_chunks,
    interval_seconds,duration_seconds,status) values(drip,owner_id,conn,'test','fixture','test','["test"]',1,1,60,60,'running');
  update public.drips set status='completed' where id=drip;
  begin
    update public.drips set status='running' where id=drip;
    raise exception 'Terminal session revived';
  exception when raise_exception then if sqlerrm<>'finished_session' then raise; end if; end;
  insert into public.drips(id,user_id,connection_id,provider,document_id,text,chunks,word_count,total_chunks,
    interval_seconds,duration_seconds,status) values(second_drip,owner_id,conn,'test','fixture2','test','["test"]',1,1,60,60,'running');
  -- A paused row is still counted once, and may return to scheduled.
  update public.drips set status='paused' where id=second_drip;
  update public.drips set status='scheduled' where id=second_drip;
  if not exists(select 1 from public.drips where id=second_drip and status='scheduled') then
    raise exception 'Legitimate resume blocked'; end if;
  begin
    update public.drips set chunk_deletions='[-1]',action_kinds='["insert"]',source_chunks='["test"]',source_unit_ends='[1]' where id=second_drip;
    raise exception 'Invalid metadata accepted';
  exception when check_violation then null; end;
  -- Only execution-column mutations invoke the expensive validation trigger.
  if exists(select 1 from pg_constraint where conrelid='public.drips'::regclass and conname='drips_drafting_execution_check') then
    raise exception 'Progress still rescans metadata'; end if;
  if (select tgattr::text='' from pg_trigger where tgrelid='public.drips'::regclass and tgname='drips_drafting_execution') then
    raise exception 'Drafting trigger is not column-specific'; end if;
  insert into public.drip_events(drip_id,user_id,kind,detail) values(second_drip,owner_id,'test',jsonb_build_object('message',repeat('x',10000)));
  if exists(select 1 from public.drip_events where drip_id=second_drip and octet_length(detail::text)>4096) then
    raise exception 'Oversized event persisted'; end if;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  update public.profiles set age_confirmed_at=now(),subscription_status='active' where user_id=owner_id;
  begin
    perform public.confirm_age('BD',extract(year from now())::integer,1,false);
    raise exception 'Existing age answer replaced';
  exception when raise_exception then if sqlerrm<>'Your age has already been confirmed.' then raise; end if; end;
  if not exists(select 1 from auth.users where id=owner_id) then raise exception 'Paying user deleted'; end if;
  begin perform public.agree_to_terms('outdated'); raise exception 'Old terms accepted';
  exception when raise_exception then if sqlerrm<>'Please accept the current agreement.' then raise; end if; end;
  perform public.agree_to_terms('2026-10-21');
  insert into public.google_oauth_nonces(nonce,user_id,browser_hash,expires_at,returned_at)
    values(nonce_id,owner_id,'fixture-hash',now()+interval '1 minute',now());
  if public.consume_google_oauth_nonce(owner_id,nonce_id,'wrong') then raise exception 'Wrong verifier accepted'; end if;
  if not public.consume_google_oauth_nonce(owner_id,nonce_id,'fixture-hash') then raise exception 'Correct verifier refused'; end if;
  if public.consume_google_oauth_nonce(owner_id,nonce_id,'fixture-hash') then raise exception 'Nonce reused'; end if;
  insert into public.google_oauth_nonces(nonce,user_id,browser_hash,expires_at,returned_at)
    values(gen_random_uuid(),owner_id,'expired',now()-interval '1 minute',now()) returning nonce into nonce_id;
  if public.consume_google_oauth_nonce(owner_id,nonce_id,'expired') then raise exception 'Expired nonce accepted'; end if;
  if public.consume_google_oauth_nonce(gen_random_uuid(),nonce_id,'expired') then raise exception 'Other user nonce accepted'; end if;
  begin perform public.reserve_words(owner_id,-1,150); raise exception 'Negative quota accepted';
  exception when raise_exception then if sqlerrm<>'Words must be positive.' then raise; end if; end;
  begin perform public.hit_rate_limit(owner_id,'test',1,0); raise exception 'Zero window accepted';
  exception when raise_exception then if sqlerrm<>'Invalid rate-limit window.' then raise; end if; end;
  -- Progress does not validate the execution JSON again (existing rows remain
  -- runnable; execution mutations still use the strict validator).
  alter table public.drips disable trigger drips_drafting_execution;
  update public.drips set chunk_deletions='[-1]' where id=second_drip;
  alter table public.drips enable trigger drips_drafting_execution;
  update public.drips set chunks_written=1 where id=second_drip;
  if not found then raise exception 'Progress update failed'; end if;
end;
$$;
create function public.original_drafting_validator(
  chunks jsonb, deletions jsonb, kinds jsonb, source jsonb, ends jsonb, total integer
)
returns boolean language plpgsql immutable set search_path = '' as $$
declare i integer; previous integer := 0; current_end integer; kind text;
begin
  if deletions is null and kinds is null and source is null and ends is null then return true; end if;
  if deletions is null or kinds is null or source is null or ends is null then return false; end if;
  if jsonb_typeof(deletions)<>'array' or jsonb_typeof(kinds)<>'array' or
    jsonb_typeof(source)<>'array' or jsonb_typeof(ends)<>'array' then return false; end if;
  if jsonb_array_length(deletions)<>total or jsonb_array_length(kinds)<>total or
    jsonb_array_length(chunks)<>total or jsonb_array_length(source)<>jsonb_array_length(ends) or
    jsonb_array_length(ends)=0 then return false; end if;
  for i in 0..total-1 loop
    if jsonb_typeof(chunks->i)<>'string' or jsonb_typeof(deletions->i)<>'number' or
      (deletions->>i)!~'^[0-9]{1,6}$' or (deletions->>i)::integer>200000 then return false; end if;
    kind := kinds->>i;
    if kind is null or kind not in ('insert','typo','false_start','backspace','correction') then return false; end if;
  end loop;
  for i in 0..jsonb_array_length(ends)-1 loop
    if jsonb_typeof(source->i)<>'string' or jsonb_typeof(ends->i)<>'number' or
      (ends->>i)!~'^[0-9]{1,6}$' then return false; end if;
    current_end := (ends->>i)::integer;
    if current_end<=previous or current_end>total then return false; end if;
    previous := current_end;
  end loop;
  return previous=total;
end;
$$;

do $$
declare c jsonb; d jsonb; k jsonb; s jsonb; e jsonb; n integer; i integer;
  candidates jsonb[]:=array['null'::jsonb,'[]','[0]','[1]','[-1]','["a"]','["insert"]','["backspace"]','[200001]','[0,0]','[1,2]'];
begin
  for i in 1..10000 loop
    n:=1+(i%3);
    c:=case when i%7=0 then '[1]'::jsonb else '["a"]'::jsonb end;
    d:=candidates[1+(i%11)];k:=candidates[1+((i/11)%11)];
    s:=case when i%3=0 then null else '["a"]'::jsonb end;
    e:=candidates[1+((i/121)%11)];
    if public.valid_drafting_execution(c,d,k,s,e,n) is distinct from public.original_drafting_validator(c,d,k,s,e,n) then
      raise exception 'Validator changed acceptance: %, %, %, %, %, %',c,d,k,s,e,n;
    end if;
  end loop;
end;
$$;

do $$
declare owner_id uuid:=gen_random_uuid(); outcome text;
begin
  insert into auth.users(id) values(owner_id);
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  outcome:=public.confirm_age('BD',extract(year from current_date)::integer-1,1,false);
  if outcome<>'too_young' or not exists(select 1 from auth.users where id=owner_id)
    or not exists(select 1 from public.profiles where user_id=owner_id and eligibility_blocked_at is not null) then
    raise exception 'Underage cleanup bypassed account-deletion safeguards';
  end if;
end;
$$;
rollback;
