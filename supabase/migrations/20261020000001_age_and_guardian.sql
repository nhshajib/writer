-- Age check at sign-up, for children's safety.
--
-- TypeWit is for people aged 13 and over, and at least the age of digital
-- consent in their country (GDPR Article 8: 13 to 16 across the EU and EEA;
-- 14 in South Korea and China). Under-18s need a parent or guardian's
-- agreement. Only the country and the month and year of birth are kept, never
-- the full date. The same rules live in web/lib/age.ts for the form.

alter table public.profiles
  add column if not exists country text check (country ~ '^[A-Z]{2}$'),
  add column if not exists birth_year smallint check (birth_year between 1900 and 2100),
  add column if not exists birth_month smallint check (birth_month between 1 and 12),
  add column if not exists age_confirmed_at timestamptz,
  add column if not exists guardian_confirmed_at timestamptz;

-- The youngest age at which someone in `country` may use TypeWit.
create or replace function public.minimum_age(country text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case upper(coalesce(country, ''))
    when 'DE' then 16 when 'HR' then 16 when 'HU' then 16 when 'IE' then 16 when 'LI' then 16
    when 'LU' then 16 when 'NL' then 16 when 'PL' then 16 when 'RO' then 16 when 'SK' then 16
    when 'CZ' then 15 when 'FR' then 15 when 'GR' then 15 when 'SI' then 15
    when 'AT' then 14 when 'BG' then 14 when 'CY' then 14 when 'ES' then 14 when 'IT' then 14
    when 'LT' then 14 when 'KR' then 14 when 'CN' then 14
    else 13
  end;
$$;

-- Whole years of age from a month and year of birth. A birthday in the current
-- month counts as not reached yet, so the check never errs younger-than-allowed.
create or replace function public.age_from(birth_year integer, birth_month integer)
returns integer
language sql
stable
set search_path = ''
as $$
  select extract(year from current_date)::integer - birth_year
    - case when extract(month from current_date)::integer <= birth_month then 1 else 0 end;
$$;

-- Records the signed-in person's country, month and year of birth, and (for
-- under-18s) that a parent or guardian agreed. Returns 'ok', or
-- 'guardian_needed'. Someone below the minimum age has their account deleted
-- straight away and gets 'too_young'.
create or replace function public.confirm_age(country text, birth_year integer, birth_month integer, guardian boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  code text := upper(coalesce(country, ''));
  age integer;
begin
  if me is null then
    raise exception 'Not signed in.';
  end if;
  if code !~ '^[A-Z]{2}$' or birth_month is null or birth_month not between 1 and 12
     or birth_year is null or birth_year < 1900 or birth_year > extract(year from current_date)::integer then
    raise exception 'Choose your country and the month and year you were born.';
  end if;
  age := public.age_from(birth_year, birth_month);
  if age < public.minimum_age(code) then
    delete from auth.users where id = me;
    return 'too_young';
  end if;
  if age < 18 and not coalesce(guardian, false) then
    return 'guardian_needed';
  end if;
  update public.profiles
     set country = code,
         birth_year = confirm_age.birth_year,
         birth_month = confirm_age.birth_month,
         age_confirmed_at = now(),
         guardian_confirmed_at = case when age < 18 then now() end
   where user_id = me;
  return 'ok';
end;
$$;

revoke all on function public.confirm_age(text, integer, integer, boolean) from public, anon;
grant execute on function public.confirm_age(text, integer, integer, boolean) to authenticated;

-- New users: keep the age answers the email sign-up form sent, when they pass.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  version text := nullif(meta ->> 'agreed_terms_version', '');
  code text := upper(coalesce(meta ->> 'country', ''));
  b_year integer;
  b_month integer;
  age integer;
  guardian boolean := false;
  confirmed boolean := false;
begin
  begin
    b_year := (meta ->> 'birth_year')::integer;
    b_month := (meta ->> 'birth_month')::integer;
    guardian := coalesce((meta ->> 'guardian_agreed')::boolean, false);
  exception when others then
    b_year := null;
    b_month := null;
  end;
  if code ~ '^[A-Z]{2}$' and b_year between 1900 and extract(year from current_date)::integer and b_month between 1 and 12 then
    age := public.age_from(b_year, b_month);
    confirmed := age >= public.minimum_age(code) and (age >= 18 or guardian);
  end if;

  insert into public.profiles (user_id, agreed_terms_version, agreed_terms_at, country, birth_year, birth_month, age_confirmed_at, guardian_confirmed_at)
  values (
    new.id, version, case when version is not null then now() end,
    case when confirmed then code end, case when confirmed then b_year end, case when confirmed then b_month end,
    case when confirmed then now() end, case when confirmed and age < 18 then now() end
  )
  on conflict do nothing;
  return new;
end;
$$;

-- Sign-up hook: refuse an email sign-up whose age answers are below the minimum.
-- (Google sign-ups answer the same questions in the app before going further.)
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_email text := lower(coalesce(event -> 'user' ->> 'email', ''));
  email_domain text := split_part(user_email, '@', 2);
  meta jsonb := coalesce(event -> 'user' -> 'user_metadata', '{}'::jsonb);
  b_year integer;
  b_month integer;
begin
  if user_email = '' or not exists (
    select 1 from public.allowed_email_domains d where d.domain = email_domain
  ) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Please sign up with a personal email address from a common provider such as Gmail, Outlook, Yahoo or iCloud.'
    ));
  end if;
  begin
    b_year := (meta ->> 'birth_year')::integer;
    b_month := (meta ->> 'birth_month')::integer;
  exception when others then
    b_year := null;
  end;
  if b_year is not null and b_month is not null
     and public.age_from(b_year, b_month) < public.minimum_age(meta ->> 'country') then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Sorry, you can''t create a TypeWit account.'
    ));
  end if;
  return '{}'::jsonb;
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
