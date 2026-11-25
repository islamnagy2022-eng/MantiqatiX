-- RC115 live-baseline tenant/business isolation regression tests.
-- Run only against the disposable PostgreSQL fixture.
set role authenticated;
do $test$
declare
  manager_a uuid := '30000000-0000-4000-8000-000000000011';
  inactive_manager_a uuid := '30000000-0000-4000-8000-000000000019';
  owner_a uuid := '30000000-0000-4000-8000-000000000018';
  tenant_admin_a uuid := '30000000-0000-4000-8000-000000000012';
  manager_b uuid := '30000000-0000-4000-8000-000000000013';
  tenant_super_c uuid := '30000000-0000-4000-8000-000000000014';
  platform_admin uuid := '30000000-0000-4000-8000-000000000015';
  provider_a uuid := '30000000-0000-4000-8000-000000000016';
  lead_owner uuid := '30000000-0000-4000-8000-000000000017';
begin
  perform set_config('request.jwt.claim.sub',manager_a::text,false);
  if not exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000001') then
    raise exception 'manager A cannot read own-business lead';
  end if;
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000002') then
    raise exception 'manager A crossed into another business in same tenant';
  end if;
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000003') then
    raise exception 'manager A crossed tenant boundary';
  end if;
  if not exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000001') then
    raise exception 'manager A cannot read active provider in own business';
  end if;
  -- Active profiles remain globally visible through the intentional public directory policy.
  if not exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000004') then
    raise exception 'public active provider directory read regressed';
  end if;
  if exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000002') then
    raise exception 'manager A must not read pending provider in own business';
  end if;
  if exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000005') then
    raise exception 'manager A must not read provider-owned pending profile';
  end if;
  if exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000006') then
    raise exception 'manager A crossed into another business pending provider in same tenant';
  end if;
  if exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000003') then
    raise exception 'manager A read pending provider from another tenant';
  end if;


  perform set_config('request.jwt.claim.sub',inactive_manager_a::text,false);
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000001') then
    raise exception 'inactive business membership can read CRM lead';
  end if;
  if exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000002') then
    raise exception 'inactive business membership can read pending provider';
  end if;

  perform set_config('request.jwt.claim.sub',tenant_admin_a::text,false);
  if not exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000001')
     or not exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000002') then
    raise exception 'tenant admin should read leads for businesses in own tenant';
  end if;
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000003') then
    raise exception 'tenant admin crossed tenant boundary';
  end if;
  if not exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000002') then
    raise exception 'tenant admin cannot review pending provider in own tenant';
  end if;
  if not exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000005') then
    raise exception 'tenant admin cannot review provider-owned pending profile in own tenant';
  end if;
  if not exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000006') then
    raise exception 'tenant admin cannot review pending provider in second own-tenant business';
  end if;
  if exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000003') then
    raise exception 'tenant admin crossed tenant boundary for pending providers';
  end if;

  perform set_config('request.jwt.claim.sub',manager_b::text,false);
  if not exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000003') then
    raise exception 'manager B cannot read own-business lead';
  end if;
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000001') then
    raise exception 'manager B crossed tenant boundary';
  end if;
  if not exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000004') then
    raise exception 'manager B cannot read active provider in own business';
  end if;
  if exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000003') then
    raise exception 'manager B must not read pending provider in own business';
  end if;

  perform set_config('request.jwt.claim.sub',owner_a::text,false);
  if not exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000002') then
    raise exception 'business OWNER cannot review pending provider in own business';
  end if;
  if exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000003') then
    raise exception 'business OWNER crossed tenant boundary for pending providers';
  end if;
  if exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000006') then
    raise exception 'business OWNER crossed business boundary for pending providers';
  end if;

  -- Provider owners retain access to their own onboarding/profile row.
  perform set_config('request.jwt.claim.sub',provider_a::text,false);
  if not exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000001') then
    raise exception 'provider owner lost access to own profile';
  end if;
  if not exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000005') then
    raise exception 'provider owner cannot read own pending profile';
  end if;
  if exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000002') then
    raise exception 'provider owner can read another owner pending profile';
  end if;

  perform set_config('request.jwt.claim.sub',tenant_super_c::text,false);
  if not exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000004') then
    raise exception 'tenant-scoped SUPER_ADMIN cannot read own tenant lead';
  end if;
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000001') then
    raise exception 'tenant-scoped SUPER_ADMIN gained platform-wide access';
  end if;

  perform set_config('request.jwt.claim.sub',platform_admin::text,false);
  if (select count(*) from public.marketing_leads) <> 6 then
    raise exception 'explicit platform SUPER_ADMIN should see all six fixture leads';
  end if;
  if (select count(*) from public.marketing_provider_profiles where status='PENDING') <> 4 then
    raise exception 'explicit platform SUPER_ADMIN should see pending providers across tenants';
  end if;

  perform set_config('request.jwt.claim.sub',lead_owner::text,false);
  if not exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000005') then
    raise exception 'lead requester lost own-lead access';
  end if;
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000001') then
    raise exception 'lead requester can read another business lead';
  end if;

  -- Anonymous Auth sessions use the authenticated Postgres role but cannot read private CRM rows.
  perform set_config('request.jwt.claim.sub',manager_a::text,false);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',manager_a::text,'is_anonymous',true)::text,false);
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000001') then
    raise exception 'anonymous session can read business CRM lead';
  end if;
  if exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000002') then
    raise exception 'anonymous session can read pending provider profile';
  end if;

  perform set_config('request.jwt.claim.sub',lead_owner::text,false);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',lead_owner::text,'is_anonymous',true)::text,false);
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000005') then
    raise exception 'anonymous session can read own marketing lead';
  end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',lead_owner::text,'is_anonymous',false)::text,false);
  if not exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000005') then
    raise exception 'confirmed user lost own marketing lead access';
  end if;
end;
$test$;
reset role;
select 'RC115 marketing CRM live-baseline tenant/business scope integration: PASS' as result;
