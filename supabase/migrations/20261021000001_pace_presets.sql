-- Saved pace presets, a Pro feature: named pacing settings applied in one click on New session.
-- Stored on the profile; readable by the owner through the existing select policy, and only
-- writable through set_pace_presets, which checks the plan. Sessions still validate their own
-- pacing when they start, so a preset can never get past the server's checks.

alter table public.profiles
  add column if not exists pace_presets jsonb not null default '[]'::jsonb;

create or replace function public.set_pace_presets(presets jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  item_name text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;
  if not exists (select 1 from public.profiles where user_id = auth.uid() and plan = 'pro') then
    raise exception 'Saved presets are part of Pro.';
  end if;
  if presets is null or jsonb_typeof(presets) <> 'array' then
    raise exception 'Presets must be a list.';
  end if;
  if jsonb_array_length(presets) > 10 then
    raise exception 'You can keep up to 10 presets.';
  end if;
  if pg_column_size(presets) > 16000 then
    raise exception 'Presets are too large.';
  end if;
  for item in select * from jsonb_array_elements(presets) loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'pace') <> 'object' then
      raise exception 'Each preset needs a name and pace settings.';
    end if;
    item_name := item ->> 'name';
    if item_name is null or length(btrim(item_name)) = 0 or length(item_name) > 40 then
      raise exception 'Preset names must be 1 to 40 characters.';
    end if;
    if coalesce(item ->> 'timing', '') not in ('duration', 'speed') then
      raise exception 'A preset''s timing must be duration or speed.';
    end if;
  end loop;

  update public.profiles set pace_presets = presets where user_id = auth.uid();
  return presets;
end;
$$;

revoke execute on function public.set_pace_presets(jsonb) from public, anon;
grant execute on function public.set_pace_presets(jsonb) to authenticated;
