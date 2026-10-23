-- RC102 behavioral integration test. Run only in disposable PostgreSQL.
-- The fixture and actual RC99 policy migration must be applied before this test.
set role authenticated;
do $test$
declare
  owner_a uuid := '20000000-0000-4000-8000-000000000001';
  owner_b uuid := '20000000-0000-4000-8000-000000000002';
  provider_a uuid := '10000000-0000-4000-8000-000000000001';
  provider_b uuid := '10000000-0000-4000-8000-000000000002';
  service_a uuid := '30000000-0000-4000-8000-000000000001';
  service_b uuid := '30000000-0000-4000-8000-000000000002';
  rejected boolean;
begin
  if not has_table_privilege('authenticated','public.marketing_provider_services','INSERT')
     or not has_table_privilege('authenticated','public.marketing_provider_services','UPDATE')
     or not has_table_privilege('authenticated','public.marketing_provider_services','DELETE') then
    raise exception 'authenticated role is missing required provider-service write grants';
  end if;
  if has_table_privilege('anon','public.marketing_provider_services','INSERT')
     or has_table_privilege('anon','public.marketing_provider_services','UPDATE')
     or has_table_privilege('anon','public.marketing_provider_services','DELETE') then
    raise exception 'anonymous role unexpectedly has provider-service write grants';
  end if;

  perform set_config('request.jwt.claim.sub',owner_a::text,false);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_a::text,'is_anonymous',false)::text,false);

  insert into public.marketing_provider_services(provider_id,service_id,service_description)
  values(provider_a,service_a,'Owner A service');
  if (select count(*) from public.marketing_provider_services where provider_id=provider_a and service_id=service_a) <> 1 then
    raise exception 'owner A cannot read own inserted service';
  end if;
  if exists(select 1 from public.marketing_provider_services where provider_id=provider_b) then
    raise exception 'owner A can read owner B service';
  end if;

  rejected := false;
  begin
    insert into public.marketing_provider_services(provider_id,service_id,service_description)
    values(provider_b,service_b,'Cross-owner insert');
  exception when insufficient_privilege then
    rejected := true;
  end;
  if not rejected then raise exception 'cross-owner insert was accepted'; end if;

  rejected := false;
  begin
    update public.marketing_provider_services
      set provider_id=provider_b
      where provider_id=provider_a and service_id=service_a;
  exception when insufficient_privilege then
    rejected := true;
  end;
  if not rejected then raise exception 'owner A transferred a service to owner B profile'; end if;
  if not exists(select 1 from public.marketing_provider_services where provider_id=provider_a and service_id=service_a) then
    raise exception 'failed cross-owner update damaged the owner A row';
  end if;

  -- RLS must silently scope DELETE to rows visible to the actor.
  delete from public.marketing_provider_services where provider_id=provider_b and service_id=service_b;
  if not exists(select 1 from public.marketing_provider_services where provider_id=provider_a and service_id=service_a) then
    raise exception 'owner A deleted or lost owner A service unexpectedly';
  end if;

  update public.marketing_provider_services
    set service_description='Owner A updated service'
    where provider_id=provider_a and service_id=service_a;
  if (select service_description from public.marketing_provider_services where provider_id=provider_a and service_id=service_a) <> 'Owner A updated service' then
    raise exception 'owner A could not update own service';
  end if;
  delete from public.marketing_provider_services where provider_id=provider_a and service_id=service_a;
  if exists(select 1 from public.marketing_provider_services where provider_id=provider_a and service_id=service_a) then
    raise exception 'owner A could not delete own service';
  end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_a::text,'is_anonymous',true)::text,false);
  rejected := false;
  begin
    insert into public.marketing_provider_services(provider_id,service_id)
    values(provider_a,service_b);
  exception when insufficient_privilege then
    rejected := true;
  end;
  if not rejected then raise exception 'anonymous Auth session wrote a provider service'; end if;
end;
$test$;
reset role;
select 'RC102 provider services owner isolation: PASS' as result;
