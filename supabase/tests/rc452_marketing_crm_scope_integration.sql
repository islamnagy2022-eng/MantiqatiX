-- RC452 tenant/business isolation tests. Run only in disposable PostgreSQL.
set role authenticated;
do $test$
declare
  manager_a uuid := '30000000-0000-4000-8000-000000000011';
  tenant_admin_a uuid := '30000000-0000-4000-8000-000000000012';
  manager_b uuid := '30000000-0000-4000-8000-000000000013';
  tenant_super_c uuid := '30000000-0000-4000-8000-000000000014';
  platform_admin uuid := '30000000-0000-4000-8000-000000000015';
  provider_a uuid := '30000000-0000-4000-8000-000000000016';
  lead_owner uuid := '30000000-0000-4000-8000-000000000017';
begin
  perform set_config('request.jwt.claim.sub',manager_a::text,false);
  if not exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000001') then raise exception 'manager A cannot read own-business lead'; end if;
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000002') then raise exception 'manager A crossed into another business in same tenant'; end if;
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000003') then raise exception 'manager A crossed tenant boundary'; end if;
  if not exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000002') then raise exception 'manager A cannot read pending provider in own business'; end if;
  if exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000003') then raise exception 'manager A read pending provider from another tenant'; end if;

  perform set_config('request.jwt.claim.sub',tenant_admin_a::text,false);
  if not exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000001')
     or not exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000002') then
    raise exception 'tenant admin should read leads for businesses in own tenant';
  end if;
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000003') then raise exception 'tenant admin crossed tenant boundary'; end if;

  perform set_config('request.jwt.claim.sub',manager_b::text,false);
  if not exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000003') then raise exception 'manager B cannot read own-business lead'; end if;
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000001') then raise exception 'manager B crossed tenant boundary'; end if;
  if not exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000003') then raise exception 'manager B cannot read pending provider in own business'; end if;

  perform set_config('request.jwt.claim.sub',provider_a::text,false);
  if not exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000006') then raise exception 'assigned provider cannot read assigned lead'; end if;
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000003') then raise exception 'provider can read unassigned lead'; end if;

  perform set_config('request.jwt.claim.sub',tenant_super_c::text,false);
  if not exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000004') then raise exception 'tenant-scoped SUPER_ADMIN cannot read own tenant lead'; end if;
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000001') then raise exception 'tenant-scoped SUPER_ADMIN gained platform-wide access'; end if;

  perform set_config('request.jwt.claim.sub',platform_admin::text,false);
  if (select count(*) from public.marketing_leads) <> 6 then raise exception 'explicit platform SUPER_ADMIN should see all six fixture leads'; end if;
  if (select count(*) from public.marketing_provider_profiles where status='PENDING') <> 2 then raise exception 'explicit platform SUPER_ADMIN should see pending providers across tenants'; end if;

  perform set_config('request.jwt.claim.sub',lead_owner::text,false);
  if not exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000005') then raise exception 'lead requester lost own-lead access'; end if;
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000001') then raise exception 'lead requester can read another business lead'; end if;
end;
$test$;
reset role;
select 'RC452 marketing CRM tenant/business scope integration: PASS' as result;
