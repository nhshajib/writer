-- Session defaults: the rhythm, finish time, word style and step size New session starts from,
-- saved on the account so they follow the person to any device. Stored on the profile; readable
-- by the owner through the existing select policy, and only writable through set_session_defaults.
-- They're starting values only: every session is still checked against the plan when it starts,
-- so a default like Drafting on an account that's no longer Pro just falls back to Natural.

alter table public.profiles
  add column if not exists session_defaults jsonb not null default '{}'::jsonb;

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
    if key not in ('rhythm', 'minutes', 'word_grouping', 'unit') then
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

  update public.profiles set session_defaults = defaults where user_id = auth.uid();
  return defaults;
end;
$$;

revoke execute on function public.set_session_defaults(jsonb) from public, anon;
grant execute on function public.set_session_defaults(jsonb) to authenticated;
