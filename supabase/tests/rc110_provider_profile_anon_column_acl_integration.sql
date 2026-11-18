-- Run only after rc110_provider_profile_anon_column_acl_fixture.sql in disposable PostgreSQL.
do $test$
begin
  if has_table_privilege('anon','public.marketing_provider_profiles','SELECT') then
    raise exception 'anon unexpectedly retains table-level SELECT';
  end if;
  if not has_column_privilege('anon','public.marketing_provider_profiles','name_ar','SELECT')
     or not has_column_privilege('anon','public.marketing_provider_profiles','business_id','SELECT') then
    raise exception 'anon is missing an approved public profile column';
  end if;
  if has_column_privilege('anon','public.marketing_provider_profiles','owner_user_id','SELECT')
     or has_column_privilege('anon','public.marketing_provider_profiles','settings','SELECT') then
    raise exception 'anon can still select private profile columns';
  end if;
end
$test$;
set role anon;
do $test$
declare
  v_count integer;
  v_denied boolean := false;
begin
  select count(*) into v_count
  from public.marketing_provider_profiles
  where status='ACTIVE';
  if v_count <> 1 then raise exception 'anon public projection did not return exactly one active row'; end if;

  begin
    perform owner_user_id from public.marketing_provider_profiles;
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then raise exception 'anon private owner UUID query was not denied'; end if;

  v_denied := false;
  begin
    perform * from public.marketing_provider_profiles;
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then raise exception 'anon wildcard query was not denied'; end if;
end
$test$;
reset role;

-- Authenticated owner/CRM migration is intentionally not part of this first ACL step.
-- Preserve current authenticated table-level access until those consumers are migrated.
set role authenticated;
do $test$
declare v_count integer;
begin
  if not has_column_privilege('authenticated','public.marketing_provider_profiles','owner_user_id','SELECT')
     or not has_column_privilege('authenticated','public.marketing_provider_profiles','settings','SELECT') then
    raise exception 'authenticated compatibility access changed unexpectedly';
  end if;
  select count(*) into v_count from public.marketing_provider_profiles where status='ACTIVE';
  if v_count <> 1 then raise exception 'authenticated active-profile RLS behavior changed unexpectedly'; end if;
end
$test$;
reset role;

-- Trusted server-side service role retains full access for curated Edge Functions.
set role service_role;
do $test$
declare v_count integer;
begin
  if not has_column_privilege('service_role','public.marketing_provider_profiles','owner_user_id','SELECT')
     or not has_column_privilege('service_role','public.marketing_provider_profiles','settings','SELECT') then
    raise exception 'service_role lost required private-column access';
  end if;
  select count(*) into v_count from public.marketing_provider_profiles;
  if v_count <> 2 then raise exception 'service_role expected to bypass RLS for server-side reads'; end if;
end
$test$;
reset role;

select 'provider profile anon column ACL contract: PASS' as result;
