-- Drafting edits are saved before a session starts. `chunks` remains the
-- execution stream; source chunks and unit ends preserve approved progress.
alter table public.drips
  add column chunk_deletions jsonb,
  add column action_kinds jsonb,
  add column source_chunks jsonb,
  add column source_unit_ends jsonb;

create function public.valid_drafting_execution(
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

alter table public.drips add constraint drips_drafting_execution_check check (
  public.valid_drafting_execution(chunks,chunk_deletions,action_kinds,source_chunks,source_unit_ends,total_chunks)
);

-- Compare and mutate under one row lock. PostgreSQL counts Unicode code
-- points, whereas Docs/JS indexes use UTF-16: remove complete code points until
-- the requested UTF-16 length is reached, refusing a split surrogate pair.
create function public.replace_test_document_tail_checked(
  doc_id uuid, owner_id uuid, delete_utf16 integer, replacement text, required_revision bigint
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare d public.test_documents; remaining integer := delete_utf16; removed integer := 0;
  ch text; width integer; revised bigint;
begin
  if delete_utf16 is null or delete_utf16<=0 or replacement is null or required_revision is null then
    raise exception 'tail_out_of_range';
  end if;
  select * into d from public.test_documents where id=doc_id and user_id=owner_id for update;
  if not found then raise exception 'document_not_found'; end if;
  if d.revision<>required_revision then raise exception 'revision_mismatch'; end if;
  while remaining>0 loop
    if removed>=char_length(d.content) then raise exception 'tail_out_of_range'; end if;
    ch := substr(d.content,char_length(d.content)-removed,1);
    if ch=chr(10) or ch=chr(13) then raise exception 'tail_out_of_range'; end if;
    width := case when ascii(ch)>65535 then 2 else 1 end;
    if remaining<width then raise exception 'tail_out_of_range'; end if;
    remaining := remaining-width; removed := removed+1;
  end loop;
  update public.test_documents set content=left(d.content,char_length(d.content)-removed)||replacement
    where id=d.id returning revision into revised;
  return revised;
end;
$$;
revoke all on function public.replace_test_document_tail_checked(uuid,uuid,integer,text,bigint)
  from public, anon, authenticated;
grant execute on function public.replace_test_document_tail_checked(uuid,uuid,integer,text,bigint) to service_role;
