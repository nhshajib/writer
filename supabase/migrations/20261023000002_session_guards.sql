-- Applied history ends in the future-dated 20261023000001. Never rename it.
-- These guards are additive and safe to re-run.
alter table public.drips add column if not exists conflict_runs integer not null default 0;
alter table public.drips add column if not exists last_attention_email_at timestamptz;

create or replace function public.enforce_active_drip_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tier public.plan_tier; max_active integer; active integer;
begin
  if tg_op='UPDATE' then
    if old.status in ('completed','canceled','failed') and new.status<>old.status then
      raise exception 'finished_session' using errcode='P0001';
    end if;
    if not (new.status in ('scheduled','running') and old.status not in ('scheduled','running')) then
      return new;
    end if;
  elsif new.status not in ('scheduled','running','paused') then return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('drips-active:'||new.user_id::text,0));
  select plan into tier from public.profiles where user_id=new.user_id;
  max_active := case when tier='pro' then 3 else 1 end;
  select count(*) into active from public.drips where user_id=new.user_id
    and id<>new.id and status in ('scheduled','running','paused');
  if active>=max_active then raise exception 'active_drip_limit:%',max_active using errcode='P0001'; end if;
  return new;
end;
$$;
drop trigger if exists drips_active_limit on public.drips;
create trigger drips_active_limit before insert or update of status on public.drips
  for each row execute function public.enforce_active_drip_limit();
revoke all on function public.enforce_active_drip_limit() from public,anon,authenticated;
grant execute on function public.enforce_active_drip_limit() to service_role;

create or replace function public.valid_drafting_execution(
  chunks jsonb, deletions jsonb, kinds jsonb, source jsonb, ends jsonb, total integer
) returns boolean language plpgsql immutable set search_path='' as $$
begin
  if deletions is null and kinds is null and source is null and ends is null then return true; end if;
  if deletions is null or kinds is null or source is null or ends is null then return false; end if;
  if jsonb_typeof(chunks)<>'array' or jsonb_typeof(deletions)<>'array' or jsonb_typeof(kinds)<>'array'
    or jsonb_typeof(source)<>'array' or jsonb_typeof(ends)<>'array' then return false; end if;
  if jsonb_array_length(chunks)<>total or jsonb_array_length(deletions)<>total or jsonb_array_length(kinds)<>total
    or jsonb_array_length(source)<>jsonb_array_length(ends) or jsonb_array_length(ends)=0 then return false; end if;
  return not exists (
    select 1 from jsonb_array_elements(chunks) with ordinality c(value,n)
    join jsonb_array_elements(deletions) with ordinality d(value,n) using(n)
    join jsonb_array_elements(kinds) with ordinality k(value,n) using(n)
    where jsonb_typeof(c.value)<>'string' or jsonb_typeof(d.value)<>'number'
      or not case when d.value #>> '{}' ~ '^[0-9]{1,6}$' then (d.value #>> '{}')::integer<=200000 else false end
      or coalesce(k.value #>> '{}','') not in ('insert','typo','false_start','backspace','correction')
  ) and not exists (
    select 1 from (
      select e.value,e.n,lag(e.value #>> '{}',1,'0') over(order by e.n) as previous,s.value as source_value
      from jsonb_array_elements(ends) with ordinality e(value,n)
      join jsonb_array_elements(source) with ordinality s(value,n) using(n)
    ) ordered
    where jsonb_typeof(source_value)<>'string' or jsonb_typeof(value)<>'number'
      or not case when value #>> '{}' ~ '^[0-9]{1,6}$' and previous ~ '^[0-9]{1,6}$'
        then (value #>> '{}')::integer>previous::integer and (value #>> '{}')::integer<=total else false end
  ) and (ends->>(jsonb_array_length(ends)-1))=total::text;
end;
$$;
-- The expensive validator must NOT run for progress/lease updates.
alter table public.drips drop constraint if exists drips_drafting_execution_check;
create or replace function public.enforce_drafting_execution()
returns trigger language plpgsql set search_path='' as $$
begin
  if not public.valid_drafting_execution(new.chunks,new.chunk_deletions,new.action_kinds,
    new.source_chunks,new.source_unit_ends,new.total_chunks) then
    raise exception 'Invalid drafting execution.' using errcode='23514';
  end if;
  return new;
end;
$$;
drop trigger if exists drips_drafting_execution on public.drips;
create trigger drips_drafting_execution before insert or update of
  chunks,chunk_deletions,action_kinds,source_chunks,source_unit_ends,total_chunks on public.drips
  for each row execute function public.enforce_drafting_execution();
revoke all on function public.enforce_drafting_execution() from public,anon,authenticated;
grant execute on function public.enforce_drafting_execution() to service_role;
revoke all on function public.valid_drafting_execution(jsonb,jsonb,jsonb,jsonb,jsonb,integer) from public,anon,authenticated;
grant execute on function public.valid_drafting_execution(jsonb,jsonb,jsonb,jsonb,jsonb,integer) to service_role;

create index if not exists drips_server_due_idx on public.drips(next_run_at)
  where status in ('scheduled','running') and provider<>'microsoft';
create or replace view public.worker_drip_rows with (security_invoker=true) as select id,user_id,document_id,chunks,chunk_deletions,action_kinds,source_chunks,source_unit_ends,total_chunks,chunks_written,schedule,session_started_at,schedule_shift_seconds,attempts,conflict_runs,pending_index,pending_revision,pending_doc_length,retry_at,last_revision_id,last_written_at,resync_index,resync_tail,document_baseline_length,preflight_at,chunk_formats,connection_id,lease_id,document_title,document_url,word_count,insert_target from public.drips;
revoke all on public.worker_drip_rows from public,anon,authenticated;
grant select on public.worker_drip_rows to service_role;
create or replace function public.claim_due_worker_drips(
  max_rows integer default 10, lease_seconds integer default 240, lookahead_seconds integer default 60
) returns setof public.worker_drip_rows language sql security definer set search_path='' as $$
  update public.drips d set status='running',next_run_at=now()+make_interval(secs=>lease_seconds),lease_id=gen_random_uuid()
  where d.id in (select id from public.drips where status in ('scheduled','running') and provider<>'microsoft'
    and next_run_at<=now()+make_interval(secs=>lookahead_seconds) order by next_run_at
    limit least(greatest(max_rows,0),50) for update skip locked)
  returning d.id,d.user_id,d.document_id,d.chunks,d.chunk_deletions,d.action_kinds,d.source_chunks,d.source_unit_ends,d.total_chunks,d.chunks_written,d.schedule,d.session_started_at,d.schedule_shift_seconds,d.attempts,d.conflict_runs,d.pending_index,d.pending_revision,d.pending_doc_length,d.retry_at,d.last_revision_id,d.last_written_at,d.resync_index,d.resync_tail,d.document_baseline_length,d.preflight_at,d.chunk_formats,d.connection_id,d.lease_id,d.document_title,d.document_url,d.word_count,d.insert_target;
$$;
revoke all on function public.claim_due_worker_drips(integer,integer,integer) from public,anon,authenticated;
grant execute on function public.claim_due_worker_drips(integer,integer,integer) to service_role;

-- Cross-worker admission control, below the 600 writes/minute project quota.
create table if not exists public.google_write_windows (
  window_start timestamptz primary key, hits integer not null default 0
);
alter table public.google_write_windows enable row level security;
revoke all on public.google_write_windows from public,anon,authenticated;
grant all on public.google_write_windows to service_role;
create or replace function public.admit_google_write() returns boolean
language plpgsql security definer set search_path='' as $$
declare hits_now integer;
begin
  insert into public.google_write_windows as w(window_start,hits) values(date_trunc('minute',now()),1)
    on conflict(window_start) do update set hits=w.hits+1 returning hits into hits_now;
  return hits_now<=480;
end;
$$;
revoke all on function public.admit_google_write() from public,anon,authenticated;
grant execute on function public.admit_google_write() to service_role;

-- Cap new event payloads without scanning/re-writing existing history.
create or replace function public.bound_drip_event_detail() returns trigger
language plpgsql set search_path='' as $$
begin
  if octet_length(new.detail::text)>4096 then
    new.detail := jsonb_build_object('truncated',true,'summary',left(new.detail::text,700));
  end if;
  return new;
end;
$$;
drop trigger if exists drip_events_detail_bound on public.drip_events;
create trigger drip_events_detail_bound before insert or update of detail on public.drip_events
  for each row execute function public.bound_drip_event_detail();
revoke all on function public.bound_drip_event_detail() from public,anon,authenticated;
grant execute on function public.bound_drip_event_detail() to service_role;
