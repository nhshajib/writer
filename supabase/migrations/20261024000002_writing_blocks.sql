-- Optional writing blocks; old sessions and schemas keep their existing fields.
-- New migrations follow the already-applied future-dated migrations; never rename them.

create or replace view public.worker_drip_rows with (security_invoker=true) as
select id,user_id,document_id,chunks,chunk_deletions,action_kinds,source_chunks,source_unit_ends,total_chunks,chunks_written,schedule,session_started_at,schedule_shift_seconds,attempts,conflict_runs,pending_index,pending_revision,pending_doc_length,retry_at,last_revision_id,last_written_at,resync_index,resync_tail,document_baseline_length,preflight_at,chunk_formats,connection_id,lease_id,document_title,document_url,word_count,insert_target,work_window,access_expires_at,breaks from public.drips;
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
  ) returning d.id,d.user_id,d.document_id,d.chunks,d.chunk_deletions,d.action_kinds,d.source_chunks,d.source_unit_ends,d.total_chunks,d.chunks_written,d.schedule,d.session_started_at,d.schedule_shift_seconds,d.attempts,d.conflict_runs,d.pending_index,d.pending_revision,d.pending_doc_length,d.retry_at,d.last_revision_id,d.last_written_at,d.resync_index,d.resync_tail,d.document_baseline_length,d.preflight_at,d.chunk_formats,d.connection_id,d.lease_id,d.document_title,d.document_url,d.word_count,d.insert_target,d.work_window,d.access_expires_at,d.breaks;
$$;
revoke all on function public.claim_due_worker_drips(integer,integer,integer) from public,anon,authenticated;
grant execute on function public.claim_due_worker_drips(integer,integer,integer) to service_role;

create or replace function public.set_session_defaults(defaults jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  key text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;
  if defaults is null or jsonb_typeof(defaults) <> 'object' then
    raise exception 'Defaults must be an object.';
  end if;
  for key in select jsonb_object_keys(defaults) loop
    if key not in ('rhythm', 'minutes', 'word_grouping', 'unit', 'writing_blocks') then
      raise exception 'Unknown session default: %', key;
    end if;
  end loop;
  if defaults ? 'rhythm' and coalesce(defaults ->> 'rhythm', '') not in ('natural', 'steady', 'drafting') then
    raise exception 'Choose Natural, Steady or Drafting.';
  end if;
  if defaults ? 'minutes' and (
    jsonb_typeof(defaults -> 'minutes') <> 'number'
    or (defaults ->> 'minutes')::numeric <> floor((defaults ->> 'minutes')::numeric)
    or (defaults ->> 'minutes')::numeric not between 1 and 10080
  ) then
    raise exception 'The finish time must be between 1 minute and 1 week.';
  end if;
  if defaults ? 'word_grouping' and coalesce(defaults ->> 'word_grouping', '') not in ('random', 'single') then
    raise exception 'Choose single words or random word groups.';
  end if;
  if defaults ? 'unit' and coalesce(defaults ->> 'unit', '') not in ('word', 'sentence', 'paragraph', 'character', 'chunk') then
    raise exception 'Choose a supported step size.';
  end if;

  if defaults ? 'writing_blocks' then
    if jsonb_typeof(defaults->'writing_blocks') <> 'object' then
      raise exception 'Choose valid writing blocks.';
    end if;
    for key in select jsonb_object_keys(defaults->'writing_blocks') loop
      if key not in ('block_seconds','break_seconds') then raise exception 'Unknown writing-block setting.'; end if;
    end loop;
    if jsonb_typeof(defaults->'writing_blocks'->'block_seconds') is distinct from 'number'
      or jsonb_typeof(defaults->'writing_blocks'->'break_seconds') is distinct from 'number' then
      raise exception 'Choose valid writing and break lengths.';
    end if;
    if (defaults->'writing_blocks'->>'block_seconds')::numeric not between 300 and 43200
      or (defaults->'writing_blocks'->>'break_seconds')::numeric not between 900 and 28800
      or (defaults->'writing_blocks'->>'block_seconds')::numeric <> floor((defaults->'writing_blocks'->>'block_seconds')::numeric)
      or (defaults->'writing_blocks'->>'break_seconds')::numeric <> floor((defaults->'writing_blocks'->>'break_seconds')::numeric) then
      raise exception 'Writing blocks allow 5 minutes to 12 hours; breaks allow 15 minutes to 8 hours.';
    end if;
  end if;

  update public.profiles set session_defaults = defaults where user_id = auth.uid();
  return defaults;
end;
$$;

revoke execute on function public.set_session_defaults(jsonb) from public, anon;
grant execute on function public.set_session_defaults(jsonb) to authenticated;
