-- Isolated test database only; all synthetic records roll back.
begin;
do $$
declare owner_id uuid := gen_random_uuid(); result jsonb;
begin
  insert into auth.users(id) values(owner_id);
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  result := public.set_session_defaults('{"writing_blocks":{"block_seconds":7200,"break_seconds":28800},"minutes":240}');
  if result->'writing_blocks'->>'break_seconds'<>'28800' then raise exception 'Block defaults not saved'; end if;
  begin
    perform public.set_session_defaults('{"writing_blocks":{"block_seconds":3600,"break_seconds":28801}}');
    raise exception 'Too long a rest accepted';
  exception when raise_exception then if sqlerrm <> 'Writing blocks allow 5 minutes to 12 hours; breaks allow 15 minutes to 8 hours.' then raise; end if; end;
  begin
    perform public.set_session_defaults('{"writing_blocks":{"block_seconds":"3600","break_seconds":900}}');
    raise exception 'String duration accepted';
  exception when raise_exception then if sqlerrm <> 'Choose valid writing and break lengths.' then raise; end if; end;
  begin
    perform public.set_session_defaults('{"writing_blocks":{"block_seconds":3600,"break_seconds":900,"plan":"pro"}}');
    raise exception 'Unknown setting accepted';
  exception when raise_exception then if sqlerrm <> 'Unknown writing-block setting.' then raise; end if; end;
  if has_table_privilege('authenticated','public.worker_drip_rows','select') or has_table_privilege('anon','public.worker_drip_rows','select') then
    raise exception 'Worker projection exposed'; end if;
  perform * from public.claim_due_worker_drips(0);
  perform set_config('request.jwt.claim.sub','',true);
  begin perform public.set_session_defaults('{}'); raise exception 'Anonymous save accepted';
  exception when raise_exception then if sqlerrm <> 'Not signed in.' then raise; end if; end;
end $$;
rollback;
