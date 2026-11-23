begin;
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); answer text;
begin
  insert into auth.users values(a, 'trialfixture+one@gmail.com'), (b, 'trialfixture+two@gmail.com');
  answer := public.reserve_trial_checkout('trialfixture+one@gmail.com', a);
  if answer <> 'available' then raise exception 'First checkout must reserve trial'; end if;
  if public.reserve_trial_checkout('trialfixture+one@gmail.com', a) <> 'available' then
    raise exception 'Original owner must be able to retry';
  end if;
  if public.reserve_trial_checkout('trialfixture+two@gmail.com', b) <> 'busy' then
    raise exception 'Alias must not reserve the same trial';
  end if;
  update public.trial_checkout_reservations set expires_at=now()-interval '1 second';
  if public.reserve_trial_checkout('trialfixture+two@gmail.com', b) <> 'available' then
    raise exception 'Abandoned checkout must expire';
  end if;
  insert into public.trial_claims values('trialfixture@gmail.com');
  if public.reserve_trial_checkout('trialfixture+two@gmail.com', b) <> 'claimed' then
    raise exception 'An existing trial claim must remain authoritative';
  end if;
  if has_function_privilege('authenticated','public.reserve_trial_checkout(text,uuid)','execute')
    or has_function_privilege('anon','public.reserve_trial_checkout(text,uuid)','execute') then
    raise exception 'Reservation must be service-only';
  end if;
  if has_table_privilege('authenticated','public.trial_checkout_reservations','select') then
    raise exception 'Reservations must not expose email identities';
  end if;
end;
$$;
rollback;
