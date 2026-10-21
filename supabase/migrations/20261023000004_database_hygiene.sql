-- Privilege and housekeeping hardening; applied migrations are unchanged.
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
  if words is null or words<=0 then raise exception 'Words must be positive.'; end if;
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
create or replace function public.release_words(target_user uuid, words integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  if words is null or words<=0 then raise exception 'Words must be positive.'; end if;
  update public.profiles set words_used_today=greatest(0,words_used_today-words)
    where user_id=target_user and usage_date=(now() at time zone 'utc')::date;
end;
$$;
create or replace function public.hit_rate_limit(owner uuid,bucket_name text,max_hits integer,window_seconds integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare start timestamptz; count_now integer;
begin
  if window_seconds is null or window_seconds<=0 or max_hits is null or max_hits<=0 then
    raise exception 'Invalid rate-limit window.';
  end if;
  start:=to_timestamp(floor(extract(epoch from now())/window_seconds)*window_seconds);
  insert into public.rate_limits as r(user_id,bucket,window_start,hits) values(owner,bucket_name,start,1)
    on conflict(user_id,bucket,window_start) do update set hits=r.hits+1 returning hits into count_now;
  return count_now<=max_hits;
end;
$$;
create or replace function public.get_app_secret(secret_name text)
returns text language sql security definer set search_path='' as $$
  select decrypted_secret from vault.decrypted_secrets where name=secret_name
    and secret_name in ('tick_secret','token_encryption_key') limit 1;
$$;

-- Keep the old signature, but it may only edit an authenticated owner's doc.
-- The service-only provider now supplies owner_id explicitly in the overload.
create or replace function public.append_test_document_checked(doc_id uuid,chunk text,required_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare revised bigint;
begin
  update public.test_documents set content=content||chunk where id=doc_id and user_id=auth.uid()
    and (required_revision is null or revision=required_revision) returning revision into revised;
  if revised is null then raise exception 'revision_mismatch'; end if;
  return revised;
end;
$$;
create or replace function public.append_test_document_checked(doc_id uuid,chunk text,required_revision bigint,owner_id uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare revised bigint;
begin
  update public.test_documents set content=content||chunk where id=doc_id and user_id=owner_id
    and (required_revision is null or revision=required_revision) returning revision into revised;
  if revised is null then raise exception 'revision_mismatch'; end if;
  return revised;
end;
$$;
-- No runtime source calls either legacy helper (verified by repository search).
drop function if exists public.append_test_document(uuid,text);
drop function if exists public.claim_due_drips_superseded(integer,integer);

-- An account can connect the same Google identity more than once; the
-- unfinished-document rule belongs to the TypeWit user, provider and document.
create unique index if not exists drips_one_active_per_user_document on public.drips(user_id,provider,document_id)
  where status in ('scheduled','running','paused');
drop index if exists public.drips_one_active_per_document;

create index if not exists start_requests_retention_idx on public.start_requests(created_at);
create index if not exists rate_limits_retention_idx on public.rate_limits(window_start);
create index if not exists stripe_events_retention_idx on public.stripe_events(received_at);
create index if not exists notifications_read_retention_idx on public.notifications(read_at) where read_at is not null;

select cron.schedule('typewit-cron-history-retention','17 3 * * *',
  $job$delete from cron.job_run_details where end_time<now()-interval '7 days'$job$);

revoke all on function public.reserve_words(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_words(uuid,integer,integer) to service_role;

revoke all on function public.release_words(uuid,integer) from public,anon,authenticated;
grant execute on function public.release_words(uuid,integer) to service_role;

revoke all on function public.hit_rate_limit(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.hit_rate_limit(uuid,text,integer,integer) to service_role;

revoke all on function public.get_app_secret(text) from public,anon,authenticated;
grant execute on function public.get_app_secret(text) to service_role;

revoke all on function public.append_test_document_checked(uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.append_test_document_checked(uuid,text,bigint) to service_role;

revoke all on function public.append_test_document_checked(uuid,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.append_test_document_checked(uuid,text,bigint,uuid) to service_role;

revoke all on function public.normalize_email(text) from public,anon,authenticated;
grant execute on function public.normalize_email(text) to service_role;

revoke all on function public.minimum_age(text) from public,anon,authenticated;
grant execute on function public.minimum_age(text) to service_role;

revoke all on function public.age_from(integer,integer) from public,anon,authenticated;
grant execute on function public.age_from(integer,integer) to service_role;

revoke all on public.trial_claims,public.stripe_events,public.start_requests,public.rate_limits,public.worker_heartbeat from anon,authenticated;
