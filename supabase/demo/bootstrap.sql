-- DEMO-ONLY bootstrap for the isolated MantiqatiX-DEMO Supabase project.
-- NEVER apply this file to production. No production data or real payment credentials are used.
-- The schema checkpoint is schema-only; this file adds synthetic lookup rows and server-only demo helpers.

insert into public.tenants(id,name,code,status,settings)
values ('MNTY-PLATFORM','MantiqatiX DEMO','MNTY-DEMO','ACTIVE',
        '{"environment":"DEMO","payments_enabled":false,"synthetic_data_only":true}'::jsonb)
on conflict (id) do update set
  name=excluded.name,code=excluded.code,status='ACTIVE',
  settings=coalesce(public.tenants.settings,'{}'::jsonb)||excluded.settings,
  updated_at=now();

insert into public.organizations(id,tenant_id,name,code,status,settings)
values ('MNTY-MAIN','MNTY-PLATFORM','MantiqatiX DEMO Organization','MNTY-DEMO-ORG','ACTIVE',
        '{"environment":"DEMO","payments_enabled":false}'::jsonb)
on conflict (id) do update set
  tenant_id=excluded.tenant_id,name=excluded.name,code=excluded.code,status='ACTIVE',
  settings=coalesce(public.organizations.settings,'{}'::jsonb)||excluded.settings,
  updated_at=now();

insert into public.business_sectors(id,code,name_ar,name_en,status) values
 ('SEC-FOOD','FOOD','مطاعم وكافيهات','Restaurants & Cafes','ACTIVE'),
 ('SEC-PHARMACY','PHARMACY','صيدليات','Pharmacies','ACTIVE'),
 ('SEC-HEALTH','HEALTH','أطباء وعيادات','Doctors & Clinics','ACTIVE'),
 ('SEC-GROCERY','GROCERY','متاجر','Stores','ACTIVE')
on conflict (id) do update set
 code=excluded.code,name_ar=excluded.name_ar,name_en=excluded.name_en,status='ACTIVE';

insert into public.business_categories(id,sector_id,code,name_ar,name_en,status) values
 ('DEMO-CAT-FOOD','SEC-FOOD','DEMO_RESTAURANT','مطعم تجريبي','Demo Restaurant','ACTIVE'),
 ('DEMO-CAT-PHARMACY','SEC-PHARMACY','DEMO_PHARMACY','صيدلية تجريبية','Demo Pharmacy','ACTIVE'),
 ('DEMO-CAT-HEALTH','SEC-HEALTH','DEMO_CLINIC','عيادة تجريبية','Demo Clinic','ACTIVE'),
 ('DEMO-CAT-GROCERY','SEC-GROCERY','DEMO_STORE','متجر تجريبي','Demo Store','ACTIVE')
on conflict (id) do update set
 sector_id=excluded.sector_id,code=excluded.code,name_ar=excluded.name_ar,name_en=excluded.name_en,status='ACTIVE';

create or replace function public.demo_register_customer_atomic(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email text;
  v_email_confirmed boolean;
  v_google_identity boolean;
  v_is_primary_platform_owner boolean := false;
  v_customer_membership_id varchar;
  v_platform_membership_id varchar;
  v_created_customer boolean := false;
begin
  select
    pg_catalog.lower(coalesce(u.email, '')),
    u.email_confirmed_at is not null,
    (
      coalesce(u.raw_app_meta_data->>'provider', '') = 'google'
      or coalesce(u.raw_app_meta_data->'providers', '[]'::jsonb) @> '["google"]'::jsonb
    )
  into v_email, v_email_confirmed, v_google_identity
  from auth.users u
  where u.id = p_user_id;

  if p_user_id is null or v_email is null then
    raise exception 'demo_auth_user_required';
  end if;

  if not exists (
    select 1 from public.tenants t
    where t.id = 'mnty-platform' and t.status = 'active'
  ) then
    raise exception 'demo_tenant_not_ready';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 90126)
  );

  select m.id into v_customer_membership_id
  from public.user_memberships m
  where m.user_id = p_user_id
    and m.tenant_id = 'mnty-platform'
    and m.business_id is null
    and m.branch_id is null
    and pg_catalog.upper(m.role) = 'customer'
    and m.status = 'active'
  limit 1;

  if v_customer_membership_id is null then
    v_customer_membership_id := pg_catalog.gen_random_uuid()::text;
    insert into public.user_memberships
      (id, user_id, tenant_id, organization_id, business_id, branch_id, role, permissions, status)
    values
      (v_customer_membership_id, p_user_id, 'mnty-platform', 'mnty-main',
       null, null, 'customer', '{"scope":"tenant","demo":true}'::jsonb, 'active');
    v_created_customer := true;
  end if;

  -- only the explicitly configured, google-authenticated, confirmed primary account
  -- becomes platform owner in this isolated demo project. email text alone is not
  -- sufficient; the identity must exist in this project's own auth.users.
  v_is_primary_platform_owner :=
    v_email = 'islam.nagy2022@gmail.com'
    and v_email_confirmed
    and v_google_identity;

  if v_is_primary_platform_owner then
    insert into private.platform_admins(user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select m.id into v_platform_membership_id
    from public.user_memberships m
    where m.user_id = p_user_id
      and m.tenant_id = 'mnty-platform'
      and m.business_id is null
      and m.branch_id is null
      and pg_catalog.upper(m.role) = 'super_admin'
      and m.status = 'active'
      and m.permissions->>'scope' = 'platform'
      and m.permissions->>'full_control' = 'true'
    limit 1;

    if v_platform_membership_id is null then
      v_platform_membership_id := pg_catalog.gen_random_uuid()::text;
      insert into public.user_memberships
        (id, user_id, tenant_id, organization_id, business_id, branch_id, role, permissions, status)
      values
        (v_platform_membership_id, p_user_id, 'mnty-platform', 'mnty-main',
         null, null, 'super_admin',
         '{"scope":"platform","full_control":true,"demo":true}'::jsonb, 'active');
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'created', v_created_customer,
    'membership_id', v_customer_membership_id,
    'role', 'customer',
    'tenant_id', 'mnty-platform',
    'is_platform_owner', v_is_primary_platform_owner
  );
end;
$function$;

revoke all on function public.demo_register_customer_atomic(uuid) from public, anon, authenticated;
grant execute on function public.demo_register_customer_atomic(uuid) to service_role;
create or replace function public.demo_create_business_atomic(
  p_user_id uuid,
  p_name text,
  p_sector_code text,
  p_description text default null,
  p_phone text default null,
  p_city text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_business_id uuid;
  v_branch_id text;
  v_tenant_id varchar := 'MNTY-PLATFORM';
  v_org_id varchar := 'MNTY-MAIN';
  v_front_sector text := upper(pg_catalog.trim(coalesce(p_sector_code,'')));
  v_backend_sector text;
  v_code varchar;
  v_branch_code varchar;
  v_provider_id uuid;
  v_slug varchar;
  v_name text := pg_catalog.trim(coalesce(p_name,''));
  v_city text := nullif(pg_catalog.trim(coalesce(p_city,'')),'');
begin
  if p_user_id is null or not exists(select 1 from auth.users u where u.id=p_user_id) then
    raise exception 'DEMO_AUTH_USER_REQUIRED';
  end if;
  if pg_catalog.length(v_name)<2 or pg_catalog.length(v_name)>100 then
    raise exception 'DEMO_INVALID_BUSINESS_NAME';
  end if;
  if v_front_sector not in ('FOOD','PHARMACY','DOCTOR','STORE') then
    raise exception 'DEMO_SECTOR_NOT_ALLOWED';
  end if;
  v_backend_sector := case v_front_sector
    when 'DOCTOR' then 'HEALTH'
    when 'STORE' then 'GROCERY'
    else v_front_sector
  end;
  if not exists(select 1 from public.business_sectors s where s.code=v_backend_sector and s.status='ACTIVE') then
    raise exception 'DEMO_SECTOR_NOT_SEEDED';
  end if;
  if not exists(select 1 from public.tenants t where t.id=v_tenant_id and t.status='ACTIVE')
     or not exists(select 1 from public.organizations o where o.id=v_org_id and o.tenant_id=v_tenant_id and o.status='ACTIVE') then
    raise exception 'DEMO_BASE_TENANT_NOT_READY';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 90226));

  v_business_id := pg_catalog.gen_random_uuid();
  v_branch_id := pg_catalog.gen_random_uuid()::text;
  v_code := 'DEMO-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),1,14));
  v_branch_code := 'DMB-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),1,12));
  v_slug := 'demo-' || pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),1,22);

  insert into public.businesses(id,tenant_id,organization_id,name,code,status,settings)
  values(v_business_id,v_tenant_id,v_org_id,v_name,v_code,'ACTIVE',
    pg_catalog.jsonb_build_object(
      'environment','DEMO','demo',true,'sector_code',v_front_sector,
      'backend_sector_code',v_backend_sector,'description',pg_catalog.left(coalesce(p_description,''),400),
      'phone',pg_catalog.left(coalesce(p_phone,''),30),'city',coalesce(v_city,''),
      'payments_enabled',false,'external_notifications_enabled',false
    ));

  insert into public.branches(id,tenant_id,organization_id,business_id,name,code,status,phone,address,settings)
  values(v_branch_id,v_tenant_id,v_org_id,v_business_id,v_name || ' - الفرع الرئيسي',v_branch_code,'ACTIVE',
         nullif(pg_catalog.left(pg_catalog.trim(coalesce(p_phone,'')),30),''),
         v_city,pg_catalog.jsonb_build_object('environment','DEMO','demo',true,'payments_enabled',false));

  insert into public.user_memberships(id,user_id,tenant_id,organization_id,business_id,branch_id,role,permissions,status)
  values(pg_catalog.gen_random_uuid()::text,p_user_id,v_tenant_id,v_org_id,v_business_id,v_branch_id,'OWNER',
         '{"scope":"BUSINESS","demo":true}'::jsonb,'ACTIVE');

  insert into public.marketing_provider_profiles(
    provider_kind,business_id,owner_user_id,name_ar,name_en,slug,description,
    specialties,service_areas,portfolio,status,is_verified,is_featured,ranking_weight,settings
  ) values(
    'PARTNER_COMPANY',v_business_id,p_user_id,v_name,v_name,v_slug,
    nullif(pg_catalog.left(pg_catalog.trim(coalesce(p_description,'')),400),''),
    pg_catalog.jsonb_build_array(v_front_sector),
    case when v_city is null then '[]'::jsonb else pg_catalog.jsonb_build_array(v_city) end,
    '[]'::jsonb,'ACTIVE',false,false,0,
    pg_catalog.jsonb_build_object('environment','DEMO','demo',true,'sector_code',v_front_sector,'payments_enabled',false)
  ) returning id into v_provider_id;

  update public.businesses
    set settings = coalesce(settings,'{}'::jsonb)
      || pg_catalog.jsonb_build_object('demo_provider_id',v_provider_id,'payments_enabled',false)
  where id=v_business_id and tenant_id=v_tenant_id;

  insert into public.catalog_business_settings(business_id,tenant_id,currency,delivery_fee,tax_inclusive,allow_discounts)
  values(v_business_id,v_tenant_id,'EGP',0,false,false);

  return pg_catalog.jsonb_build_object(
    'ok',true,'business_id',v_business_id,'branch_id',v_branch_id,'tenant_id',v_tenant_id,
    'organization_id',v_org_id,'provider_id',v_provider_id,'sector_code',v_front_sector,
    'backend_sector_code',v_backend_sector,'payments_enabled',false
  );
end;
$function$;

revoke all on function public.demo_create_business_atomic(uuid,text,text,text,text,text) from public;
revoke all on function public.demo_create_business_atomic(uuid,text,text,text,text,text) from anon, authenticated;
grant execute on function public.demo_create_business_atomic(uuid,text,text,text,text,text) to service_role;
