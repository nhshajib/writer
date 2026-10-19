-- Microsoft Word sessions run inside the TypeWit add-in in Word (Word's
-- JavaScript API edits the open document), not in the server worker, which
-- can't reach a Word document. The add-in claims a session the same way the
-- worker does: an atomic lease, only for its own document.

-- The worker leaves Word sessions to the add-in.
create or replace function public.claim_due_drips(max_rows integer default 50, lease_seconds integer default 240, lookahead_seconds integer default 60)
 returns setof public.drips
 language sql
 security definer
 set search_path to ''
as $function$
  update public.drips d
  set status = 'running',
      next_run_at = now() + make_interval(secs => lease_seconds),
      lease_id = gen_random_uuid()
  where d.id in (
    select id from public.drips
    where status in ('scheduled', 'running')
      and provider <> 'microsoft'
      and next_run_at <= now() + make_interval(secs => lookahead_seconds)
    order by next_run_at
    limit max_rows
    for update skip locked
  )
  returning d.*;
$function$;

-- The add-in running in `document_id` claims its session when an insertion is
-- due within the lookahead. A lease still held by another add-in window is
-- respected until it runs out.
create or replace function public.claim_client_drip(
  drip uuid,
  owner uuid,
  document text,
  lease_seconds integer default 240,
  lookahead_seconds integer default 60
)
 returns setof public.drips
 language sql
 security definer
 set search_path to ''
as $function$
  update public.drips d
  set status = 'running',
      next_run_at = now() + make_interval(secs => lease_seconds),
      lease_id = gen_random_uuid()
  where d.id = drip
    and d.user_id = owner
    and d.provider = 'microsoft'
    and d.document_id = document
    and d.status in ('scheduled', 'running')
    and d.next_run_at <= now() + make_interval(secs => lookahead_seconds)
  returning d.*;
$function$;

revoke all on function public.claim_client_drip(uuid, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_client_drip(uuid, uuid, text, integer, integer) to service_role;
