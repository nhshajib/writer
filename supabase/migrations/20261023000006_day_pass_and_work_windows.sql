-- Additive: subscription plan enum and every existing session remain intact.
alter table public.profiles add column if not exists day_pass_expires_at timestamptz;
alter table public.drips add column if not exists work_window jsonb;
alter table public.drips add column if not exists access_expires_at timestamptz;
alter table public.drips drop constraint if exists drips_attention_check;
alter table public.drips add constraint drips_attention_check check (attention in (
  'document_changed','confirm_last_part','reconnect','document_unavailable','unreachable','insert_rejected','not_editable','heading_missing','access_expired'
));

create table if not exists public.day_pass_purchases (
  checkout_session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_intent text not null unique,
  activated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  refunded_at timestamptz
);
create index if not exists day_pass_purchases_owner_idx on public.day_pass_purchases(user_id,expires_at);
create table if not exists public.day_pass_refunds (
  payment_intent text primary key,
  refunded_at timestamptz not null default now()
);
alter table public.day_pass_purchases enable row level security;
alter table public.day_pass_refunds enable row level security;
revoke all on public.day_pass_purchases,public.day_pass_refunds from public,anon,authenticated;
grant all on public.day_pass_purchases,public.day_pass_refunds to service_role;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='day_pass_purchases' and policyname='service only') then
    create policy "service only" on public.day_pass_purchases to service_role using(true) with check(true);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='day_pass_refunds' and policyname='service only') then
    create policy "service only" on public.day_pass_refunds to service_role using(true) with check(true);
  end if;
end; $$;

create or replace function public.grant_day_pass(owner uuid,checkout text,intent text)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare expiry timestamptz;
begin
  if owner is null or coalesce(checkout,'')='' or coalesce(intent,'')='' then raise exception 'Invalid payment confirmation.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pass:'||intent,0));
  if exists(select 1 from public.day_pass_refunds where payment_intent=intent) then return null; end if;
  perform 1 from public.profiles where user_id=owner for update;
  if not found then return null; end if;
  insert into public.day_pass_purchases(checkout_session_id,user_id,payment_intent,expires_at)
    values(checkout,owner,intent,now()+interval '24 hours') on conflict(checkout_session_id) do nothing;
  select expires_at into expiry from public.day_pass_purchases
    where checkout_session_id=checkout and user_id=owner and payment_intent=intent and refunded_at is null;
  if expiry is null then raise exception 'Payment ownership mismatch.'; end if;
  update public.profiles set day_pass_expires_at=greatest(day_pass_expires_at,expiry) where user_id=owner;
  update public.drips set access_expires_at=greatest(access_expires_at,expiry)
    where user_id=owner and access_expires_at is not null and status in ('scheduled','running','paused');
  return expiry;
end;
$$;
create or replace function public.refund_day_pass(intent text)
returns void language plpgsql security definer set search_path='' as $$
declare owner uuid; expiry timestamptz;
begin
  if coalesce(intent,'')='' then raise exception 'Invalid refund.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pass:'||intent,0));
  insert into public.day_pass_refunds(payment_intent) values(intent) on conflict do nothing;
  select user_id into owner from public.day_pass_purchases where payment_intent=intent;
  if owner is null then return; end if;
  perform 1 from public.profiles where user_id=owner for update;
  update public.day_pass_purchases set refunded_at=coalesce(refunded_at,now()) where payment_intent=intent;
  select max(expires_at) into expiry from public.day_pass_purchases where user_id=owner and refunded_at is null;
  update public.profiles set day_pass_expires_at=expiry where user_id=owner;
  update public.drips set access_expires_at=least(access_expires_at,coalesce(expiry,now()))
    where user_id=owner and access_expires_at is not null and status in ('scheduled','running','paused');
end;
$$;
revoke all on function public.grant_day_pass(uuid,text,text),public.refund_day_pass(text) from public,anon,authenticated;
grant execute on function public.grant_day_pass(uuid,text,text),public.refund_day_pass(text) to service_role;

-- Upgrading removes a pass session's expiry; downgrading does not retroactively
-- impose a new expiry on sessions legitimately created with a subscription.
create or replace function public.keep_upgraded_sessions_accessible() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.plan='pro' then update public.drips set access_expires_at=null where user_id=new.user_id and access_expires_at is not null; end if;
  return new;
end;
$$;
drop trigger if exists profiles_upgrade_sessions on public.profiles;
create trigger profiles_upgrade_sessions after update of plan on public.profiles
  for each row when (new.plan='pro') execute function public.keep_upgraded_sessions_accessible();
revoke all on function public.keep_upgraded_sessions_accessible() from public,anon,authenticated;
grant execute on function public.keep_upgraded_sessions_accessible() to service_role;

-- The existing active limit remains 1 for Free/Day Pass, 3 for Pro.
-- Work-window values are validated by the service, not writable through RLS.
create or replace view public.worker_drip_rows with (security_invoker=true) as
select id,user_id,document_id,chunks,chunk_deletions,action_kinds,source_chunks,source_unit_ends,total_chunks,chunks_written,schedule,session_started_at,schedule_shift_seconds,attempts,conflict_runs,pending_index,pending_revision,pending_doc_length,retry_at,last_revision_id,last_written_at,resync_index,resync_tail,document_baseline_length,preflight_at,chunk_formats,connection_id,lease_id,document_title,document_url,word_count,insert_target,work_window,access_expires_at from public.drips;
revoke all on public.worker_drip_rows from public,anon,authenticated;
grant select on public.worker_drip_rows to service_role;
create or replace function public.claim_due_worker_drips(max_rows integer default 10,lease_seconds integer default 240,lookahead_seconds integer default 60)
returns setof public.worker_drip_rows language sql security definer set search_path='' as $$
  update public.drips d set status='running',next_run_at=now()+make_interval(secs=>lease_seconds),lease_id=gen_random_uuid()
  where d.id in (
    select candidate.id from public.drips candidate join public.profiles p on p.user_id=candidate.user_id
    where candidate.status in ('scheduled','running') and candidate.provider<>'microsoft'
      and candidate.next_run_at<=now()+make_interval(secs=>lookahead_seconds)
    -- A bounded preference, not starvation: an older Free session overtakes
    -- newer paid work after 20 seconds. Actual edits never happen early.
    order by candidate.next_run_at - case when p.plan='pro' or p.day_pass_expires_at>now() then interval '20 seconds' else interval '0 seconds' end
    limit least(greatest(max_rows,0),50) for update of candidate skip locked
  ) returning d.id,d.user_id,d.document_id,d.chunks,d.chunk_deletions,d.action_kinds,d.source_chunks,d.source_unit_ends,d.total_chunks,d.chunks_written,d.schedule,d.session_started_at,d.schedule_shift_seconds,d.attempts,d.conflict_runs,d.pending_index,d.pending_revision,d.pending_doc_length,d.retry_at,d.last_revision_id,d.last_written_at,d.resync_index,d.resync_tail,d.document_baseline_length,d.preflight_at,d.chunk_formats,d.connection_id,d.lease_id,d.document_title,d.document_url,d.word_count,d.insert_target,d.work_window,d.access_expires_at;
$$;
revoke all on function public.claim_due_worker_drips(integer,integer,integer) from public,anon,authenticated;
grant execute on function public.claim_due_worker_drips(integer,integer,integer) to service_role;
