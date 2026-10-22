-- Run in an isolated PostgreSQL test database after migrations. Fixtures roll back.
-- Session defaults are saved only through set_session_defaults, which accepts the known keys and values.
begin;
do $$
declare owner_id uuid := gen_random_uuid();
begin
  insert into auth.users(id) values(owner_id);
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.set_session_defaults('{"rhythm":"steady","minutes":60,"word_grouping":"single","unit":"sentence"}');
  if (select session_defaults->>'rhythm' from public.profiles where user_id=owner_id)<>'steady' then
    raise exception 'Defaults were not saved'; end if;
  begin perform public.set_session_defaults('{"rhythm":"custom"}'); raise exception 'Custom rhythm accepted';
  exception when raise_exception then if sqlerrm<>'Choose Natural, Steady or Drafting.' then raise; end if; end;
  begin perform public.set_session_defaults('{"minutes":1.5}'); raise exception 'Fractional minutes accepted';
  exception when raise_exception then if sqlerrm<>'The finish time must be between 1 minute and 1 week.' then raise; end if; end;
  begin perform public.set_session_defaults('{"minutes":20000}'); raise exception 'Over a week accepted';
  exception when raise_exception then if sqlerrm<>'The finish time must be between 1 minute and 1 week.' then raise; end if; end;
  begin perform public.set_session_defaults('{"plan":"pro"}'); raise exception 'Unknown key accepted';
  exception when raise_exception then if sqlerrm not like 'Unknown session default:%' then raise; end if; end;
  perform public.set_session_defaults('{}');
  if (select session_defaults from public.profiles where user_id=owner_id)<>'{}'::jsonb then
    raise exception 'Defaults were not cleared'; end if;
end $$;
rollback;
