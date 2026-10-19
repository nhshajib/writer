-- Variable-paced sessions: per-insertion state for exactly-once recovery,
-- document binding checks, attention pauses, and word / character units.
--
-- `schedule` (added in 20261019000001) holds one offset in milliseconds from
-- `session_started_at` per unit; `schedule_shift_seconds` moves the remaining
-- schedule later after pauses or delays.

alter table public.drips
  -- Write-ahead record: set just before a unit is sent to the document and
  -- cleared once it is confirmed, so an interrupted write is checked, not repeated.
  add column pending_index integer check (pending_index >= 0),
  add column pending_revision text,
  -- Document length (UTF-16 units) when it was checked, to tell "landed" from
  -- "didn't" when the text alone can't.
  add column pending_doc_length integer,
  -- After a failure: don't try again before this.
  add column retry_at timestamptz,
  -- Document revision after TypeWit's last confirmed insertion.
  add column last_revision_id text,
  add column last_written_at timestamptz,
  -- Set by claim_due_drips; a worker only writes while it holds the lease.
  add column lease_id uuid,
  -- When the user chooses to continue after their own edits at the end of the
  -- document, the check uses this anchor instead of the text written so far.
  add column resync_index integer not null default 0 check (resync_index >= 0),
  add column resync_tail text not null default '',
  -- Why TypeWit paused the session itself (null when the user paused it).
  add column attention text check (attention in (
    'document_changed', 'confirm_last_part', 'reconnect', 'document_unavailable', 'unreachable', 'insert_rejected'
  )),
  add column schedule_seed bigint;

alter table public.drips drop constraint drips_insertion_unit_check;
alter table public.drips add constraint drips_insertion_unit_check
  check (insertion_unit in ('chunk', 'sentence', 'paragraph', 'word', 'character'));

-- Sessions created before schedules existed: give any still-active one an even
-- schedule from now on, so the new worker has a plan to follow.
update public.drips d
set session_started_at = now(),
    schedule_shift_seconds = 0,
    schedule = (
      select coalesce(jsonb_agg(((i - d.chunks_written + 1) * greatest(d.interval_seconds, 4) * 1000)::bigint order by i), '[]'::jsonb)
      from generate_series(0, d.total_chunks - 1) as i
    )
where d.status in ('scheduled', 'running', 'paused') and d.schedule = '[]'::jsonb;

-- Claim drips due within the next minute (the worker waits for each
-- insertion's exact time) and hand each one a fresh lease.
drop function public.claim_due_drips(integer, integer);

create function public.claim_due_drips(
  max_rows integer default 50,
  lease_seconds integer default 240,
  lookahead_seconds integer default 60
)
returns setof public.drips
language sql
security definer
set search_path = ''
as $$
  update public.drips d
  set status = 'running',
      next_run_at = now() + make_interval(secs => lease_seconds),
      lease_id = gen_random_uuid()
  where d.id in (
    select id from public.drips
    where status in ('scheduled', 'running')
      and next_run_at <= now() + make_interval(secs => lookahead_seconds)
    order by next_run_at
    limit max_rows
    for update skip locked
  )
  returning d.*;
$$;

revoke execute on function public.claim_due_drips(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_due_drips(integer, integer, integer) to service_role;

-- The test provider gets a revision counter so it behaves like Google Docs:
-- an insertion with a required revision is refused if anything changed.
alter table public.test_documents add column revision bigint not null default 0;

create or replace function public.bump_test_document_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.content is distinct from old.content then
    new.revision = old.revision + 1;
  end if;
  return new;
end;
$$;

create trigger test_documents_revision before update on public.test_documents
  for each row execute function public.bump_test_document_revision();

create or replace function public.append_test_document_checked(doc_id uuid, chunk text, required_revision bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_revision bigint;
begin
  update public.test_documents
    set content = content || chunk
    where id = doc_id and (required_revision is null or revision = required_revision)
    returning revision into new_revision;
  if new_revision is null then
    raise exception 'revision_mismatch';
  end if;
  return new_revision;
end;
$$;

revoke execute on function public.append_test_document_checked(uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.append_test_document_checked(uuid, text, bigint) to service_role;
revoke execute on function public.bump_test_document_revision() from public, anon, authenticated;

-- "Needs attention" notifications, alongside completed and failed.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('drip_completed', 'drip_failed', 'drip_attention'));
