-- Run in an isolated PostgreSQL test database after migrations. Fixtures roll
-- back. This exercises the real SQL implementation; it needs no live documents.
begin;
do $$
declare owner_id uuid := gen_random_uuid(); document_id uuid := gen_random_uuid(); revision_id bigint;
begin
  insert into auth.users(id) values(owner_id);
  insert into public.test_documents(id,user_id,title,content) values(document_id,owner_id,'Drafting SQL test','Existing wrong');
  revision_id := public.replace_test_document_tail_checked(document_id,owner_id,5,'right',0);
  if revision_id<>1 or (select content from public.test_documents where id=document_id)<>'Existing right' then
    raise exception 'Guarded correction did not preserve the existing document';
  end if;
  begin
    perform public.replace_test_document_tail_checked(document_id,owner_id,5,'duplicate',0);
    raise exception 'A stale revision was accepted';
  exception when raise_exception then
    if sqlerrm<>'revision_mismatch' then raise; end if;
  end;
  if (select content from public.test_documents where id=document_id)<>'Existing right' then
    raise exception 'A stale retry edited the document';
  end if;
  begin
    perform public.replace_test_document_tail_checked(document_id,gen_random_uuid(),5,'not owner',revision_id);
    raise exception 'A different owner edited the document';
  exception when raise_exception then
    if sqlerrm<>'document_not_found' then raise; end if;
  end;
  update public.test_documents set content='Existing'||chr(10)||'wrong' where id=document_id returning revision into revision_id;
  begin
    perform public.replace_test_document_tail_checked(document_id,owner_id,6,'',revision_id);
    raise exception 'Deletion crossed a paragraph';
  exception when raise_exception then
    if sqlerrm<>'tail_out_of_range' then raise; end if;
  end;
  update public.test_documents set content='Existing 👋' where id=document_id returning revision into revision_id;
  begin
    perform public.replace_test_document_tail_checked(document_id,owner_id,1,'',revision_id);
    raise exception 'Deletion split a UTF16 surrogate pair';
  exception when raise_exception then
    if sqlerrm<>'tail_out_of_range' then raise; end if;
  end;
  revision_id := public.replace_test_document_tail_checked(document_id,owner_id,2,'text',revision_id);
  if (select content from public.test_documents where id=document_id)<>'Existing text' then
    raise exception 'UTF16 suffix replacement removed the wrong characters';
  end if;
  revision_id := public.replace_test_document_tail_checked(document_id,owner_id,4,'',revision_id);
  if (select content from public.test_documents where id=document_id)<>'Existing ' then
    raise exception 'Deletion-only backspace did not work';
  end if;

  if not public.valid_drafting_execution('["wrong","","right"]','[0,5,0]',
    '["false_start","backspace","correction"]','["right"]','[3]',3) then
    raise exception 'Valid execution metadata was rejected';
  end if;
  if not public.valid_drafting_execution('["legacy"]',null,null,null,null,1) then
    raise exception 'Legacy session metadata was rejected';
  end if;
  if public.valid_drafting_execution('["a"]','[-1]','["backspace"]','["a"]','[1]',1) or
    public.valid_drafting_execution('["a"]','[0]','["unknown"]','["a"]','[1]',1) or
    public.valid_drafting_execution('["a"]','[0]','["insert"]','["a"]','[0]',1) or
    public.valid_drafting_execution('["a"]','[0,0]','["insert"]','["a"]','[1]',1) or
    public.valid_drafting_execution('["a"]','[0]','["insert"]',null,null,1) then
    raise exception 'Malformed execution metadata was accepted';
  end if;
  if has_function_privilege('anon','public.replace_test_document_tail_checked(uuid,uuid,integer,text,bigint)','execute') or
    has_function_privilege('authenticated','public.replace_test_document_tail_checked(uuid,uuid,integer,text,bigint)','execute') or
    not has_function_privilege('service_role','public.replace_test_document_tail_checked(uuid,uuid,integer,text,bigint)','execute') then
    raise exception 'Tail-edit RPC permissions are not service-role-only';
  end if;
end;
$$;
rollback;
