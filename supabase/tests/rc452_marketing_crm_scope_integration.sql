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

  -- A manager cannot spoof another business as the requester of a lead.
  perform set_config('request.jwt.claim.sub',manager_a::text,false);
  begin
    insert into public.marketing_leads(id,requester_user_id,requester_business_id,title)
    values ('50000000-0000-4000-8000-000000000007',manager_a,'30000000-0000-4000-8000-000000000003','Spoofed lead');
    raise exception 'manager inserted a lead for another tenant';
  exception when insufficient_privilege then
    null;
  end;
  insert into public.marketing_leads(id,requester_user_id,requester_business_id,title)
  values ('50000000-0000-4000-8000-000000000008',manager_a,'30000000-0000-4000-8000-000000000001','Legitimate own-business lead');
  if not exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000008') then raise exception 'valid own-business lead submission failed'; end if;

  -- Provider profile owners cannot attach a profile to a business they do not belong to.
  perform set_config('request.jwt.claim.sub',provider_a::text,false);
  begin
    insert into public.marketing_provider_profiles(id,business_id,owner_user_id,name_ar,status)
    values ('40000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000003',provider_a,'Spoofed Provider','PENDING');
    raise exception 'provider attached profile to another tenant business';
  exception when insufficient_privilege then
    null;
  end;
  insert into public.marketing_provider_profiles(id,business_id,owner_user_id,name_ar,status)
  values ('40000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000001',provider_a,'Legitimate Provider A','PENDING');
  if not exists(select 1 from public.marketing_provider_profiles where id='40000000-0000-4000-8000-000000000006') then raise exception 'valid own-business provider profile failed'; end if;

  perform set_config('request.jwt.claim.sub',lead_owner::text,false);
  if not exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000005') then raise exception 'lead requester lost own-lead access'; end if;
  if exists(select 1 from public.marketing_leads where id='50000000-0000-4000-8000-000000000001') then raise exception 'lead requester can read another business lead'; end if;
end;
$test$;
reset role;
select 'RC452 marketing CRM tenant/business scope integration: PASS' as result;
