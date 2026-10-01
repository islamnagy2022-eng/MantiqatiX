create table if not exists public.provider_onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  registration_request_id uuid not null unique references public.account_registration_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id varchar not null references public.tenants(id),
  organization_id varchar references public.organizations(id),
  business_name varchar not null,
  provider_kind varchar not null,
  name_en varchar,
  description text,
  specialties jsonb not null default '[]'::jsonb,
  service_areas jsonb not null default '[]'::jsonb,
  portfolio jsonb not null default '[]'::jsonb,
  profile_image_path text,
  status varchar not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_onboarding_user_role_chk check (length(trim(business_name)) between 2 and 180),
  constraint provider_onboarding_kind_chk check (length(trim(provider_kind)) between 2 and 80)
);

create index if not exists idx_provider_onboarding_user_status
  on public.provider_onboarding_requests(user_id,status,created_at desc);
create index if not exists idx_provider_onboarding_status
  on public.provider_onboarding_requests(status,created_at desc);

alter table public.provider_onboarding_requests enable row level security;
alter table public.provider_onboarding_requests force row level security;

drop policy if exists provider_onboarding_self_insert on public.provider_onboarding_requests;
create policy provider_onboarding_self_insert on public.provider_onboarding_requests
for insert to authenticated
with check (
  auth.uid() = user_id
  and status = 'PENDING'
  and exists (
    select 1 from public.user_memberships um
    where um.user_id = auth.uid()
      and um.tenant_id = 'MNTY-PLATFORM'
      and um.status = 'ACTIVE'
      and upper(um.role) = 'CUSTOMER'
  )
  and exists (
    select 1 from public.account_registration_requests ar
    where ar.id = registration_request_id
      and ar.user_id = auth.uid()
      and ar.requested_role = 'SERVICE_PROVIDER'
      and ar.status = 'PENDING'
  )
);

drop policy if exists provider_onboarding_self_select on public.provider_onboarding_requests;
create policy provider_onboarding_self_select on public.provider_onboarding_requests
for select to authenticated
using (auth.uid() = user_id and coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true');

drop policy if exists provider_onboarding_admin_select on public.provider_onboarding_requests;
create policy provider_onboarding_admin_select on public.provider_onboarding_requests
for select to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true'
  and exists (
    select 1 from public.user_memberships um
    where um.user_id = auth.uid()
      and um.tenant_id = provider_onboarding_requests.tenant_id
      and um.status = 'ACTIVE'
      and upper(um.role) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER')
  )
);

create or replace function private.submit_provider_onboarding(
  p_user_id uuid,
  p_registration_request_id uuid,
  p_tenant_id varchar,
  p_organization_id varchar,
  p_business_name varchar,
  p_provider_kind varchar,
  p_name_en varchar default null,
  p_description text default null,
  p_specialties jsonb default '[]'::jsonb,
  p_service_areas jsonb default '[]'::jsonb,
  p_portfolio jsonb default '[]'::jsonb,
  p_profile_image_path text default null
) returns jsonb
language plpgsql security definer set search_path to ''
as $$
declare
  v_request public.account_registration_requests%rowtype;
  v_existing public.provider_onboarding_requests%rowtype;
  v_id uuid;
begin
  if p_user_id is null then raise exception 'user_required'; end if;
  if p_tenant_id <> 'MNTY-PLATFORM' then raise exception 'platform_tenant_required'; end if;
  if p_organization_id is distinct from 'MNTY-MAIN' then raise exception 'platform_organization_required'; end if;

  select * into v_request from public.account_registration_requests
  where id=p_registration_request_id and user_id=p_user_id and requested_role='SERVICE_PROVIDER'
  for update;
  if not found then raise exception 'registration_not_found'; end if;
  if v_request.status <> 'PENDING' then raise exception 'registration_not_pending'; end if;

  if not exists (
    select 1 from public.user_memberships um
    where um.user_id=p_user_id and um.tenant_id='MNTY-PLATFORM'
      and um.status='ACTIVE' and upper(um.role)='CUSTOMER'
  ) then raise exception 'customer_membership_required'; end if;

  select * into v_existing from public.provider_onboarding_requests
  where registration_request_id=p_registration_request_id for update;
  if found and v_existing.status='PENDING' then raise exception 'onboarding_already_exists'; end if;
  if found and v_existing.status in ('APPROVED','REJECTED') then raise exception 'onboarding_already_processed'; end if;

  if length(trim(coalesce(p_business_name,''))) < 2 then raise exception 'business_name_required'; end if;
  if length(trim(coalesce(p_provider_kind,''))) < 2 then raise exception 'provider_kind_required'; end if;

  insert into public.provider_onboarding_requests(
    registration_request_id,user_id,tenant_id,organization_id,business_name,provider_kind,
    name_en,description,specialties,service_areas,portfolio,profile_image_path
  ) values (
    p_registration_request_id,p_user_id,'MNTY-PLATFORM','MNTY-MAIN',trim(p_business_name),
    trim(p_provider_kind),nullif(trim(coalesce(p_name_en,'')),''),p_description,
    coalesce(p_specialties,'[]'::jsonb),coalesce(p_service_areas,'[]'::jsonb),
    coalesce(p_portfolio,'[]'::jsonb),nullif(trim(coalesce(p_profile_image_path,'')),'')
  ) returning id into v_id;

  update public.account_registration_requests
  set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
    'source','provider_onboarding','onboarding_request_id',v_id
  ), updated_at=now()
  where id=p_registration_request_id;

  return jsonb_build_object('ok',true,'onboarding_request_id',v_id,'status','PENDING');
end;
$$;

revoke all on function private.submit_provider_onboarding(uuid,uuid,varchar,varchar,varchar,varchar,varchar,text,jsonb,jsonb,jsonb,text)
from public,anon,authenticated;

create or replace function private.review_provider_onboarding_atomic(
  p_actor_user_id uuid,
  p_onboarding_request_id uuid,
  p_decision text,
  p_rejection_reason text default null
) returns jsonb
language plpgsql security definer set search_path to ''
as $$
declare
  v_req public.provider_onboarding_requests%rowtype;
  v_ar public.account_registration_requests%rowtype;
  v_business_id uuid;
  v_profile_id uuid;
  v_membership_id varchar;
  v_code varchar;
  v_slug varchar;
begin
  if not exists (select 1 from private.platform_admins where user_id=p_actor_user_id)
    then raise exception 'platform_admin_required'; end if;
  if p_decision not in ('APPROVED','REJECTED') then raise exception 'invalid_decision'; end if;

  select * into v_req from public.provider_onboarding_requests where id=p_onboarding_request_id for update;
  if not found then raise exception 'onboarding_not_found'; end if;
  if v_req.status <> 'PENDING' then raise exception 'onboarding_not_pending'; end if;

  select * into v_ar from public.account_registration_requests where id=v_req.registration_request_id for update;
  if not found or v_ar.status <> 'PENDING' then raise exception 'registration_not_pending'; end if;

  if p_decision='REJECTED' then
    update public.provider_onboarding_requests
      set status='REJECTED', reviewed_by=p_actor_user_id, reviewed_at=now(),
          rejection_reason=nullif(trim(coalesce(p_rejection_reason,'')),''),
          updated_at=now()
      where id=v_req.id;
    update public.account_registration_requests
      set status='REJECTED', reviewed_by=p_actor_user_id, reviewed_at=now(), updated_at=now()
      where id=v_req.registration_request_id;
    return jsonb_build_object('status','REJECTED','onboarding_request_id',v_req.id);
  end if;

  if exists (
    select 1 from public.user_memberships um
    where um.user_id=v_req.user_id and um.tenant_id=v_req.tenant_id
      and um.status='ACTIVE' and upper(um.role)='SERVICE_PROVIDER'
  ) then raise exception 'provider_membership_already_exists'; end if;

  v_business_id := gen_random_uuid();
  v_code := 'BIZ-' || upper(replace(substr(v_business_id::text,1,8),'-',''));
  v_slug := lower(regexp_replace(trim(v_req.business_name),'[^a-zA-Z0-9]+','-','g'));
  if v_slug='' then v_slug='business-'||substr(v_business_id::text,1,8); end if;
  v_slug := left(v_slug,90) || '-' || substr(v_business_id::text,1,8);

  insert into public.businesses(id,tenant_id,organization_id,name,code,status,settings)
  values (v_business_id,v_req.tenant_id,v_req.organization_id,v_req.business_name,v_code,'ACTIVE',
    jsonb_build_object('source','provider_onboarding','onboarding_request_id',v_req.id));

  v_profile_id := gen_random_uuid();
  insert into public.marketing_provider_profiles(
    id,provider_kind,business_id,owner_user_id,name_ar,name_en,slug,description,
    specialties,service_areas,portfolio,status,is_verified,is_featured,ranking_weight,settings,profile_image_path
  ) values (
    v_profile_id,v_req.provider_kind,v_business_id,v_req.user_id,v_req.business_name,
    v_req.name_en,v_slug,v_req.description,v_req.specialties,v_req.service_areas,
    v_req.portfolio,'ACTIVE',true,false,0,
    jsonb_build_object('source','provider_onboarding','onboarding_request_id',v_req.id),
    v_req.profile_image_path);

  v_membership_id := gen_random_uuid()::text;
  insert into public.user_memberships(id,user_id,tenant_id,organization_id,business_id,role,permissions,status)
  values (v_membership_id,v_req.user_id,v_req.tenant_id,v_req.organization_id,v_business_id,
    'SERVICE_PROVIDER','[]'::jsonb,'ACTIVE');

  update public.provider_onboarding_requests
    set status='APPROVED',reviewed_by=p_actor_user_id,reviewed_at=now(),updated_at=now()
    where id=v_req.id;
  update public.account_registration_requests
    set status='APPROVED',reviewed_by=p_actor_user_id,reviewed_at=now(),updated_at=now()
    where id=v_req.registration_request_id;

  insert into public.audit_logs(
    id,tenant_id,organization_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values (
    gen_random_uuid()::text,v_req.tenant_id,v_req.organization_id,p_actor_user_id,
    'PROVIDER_ONBOARDING_APPROVED','provider_onboarding_request',v_req.id::text,
    jsonb_build_object('status','PENDING'),
    jsonb_build_object('status','APPROVED','business_id',v_business_id,'provider_profile_id',v_profile_id,'membership_id',v_membership_id),
    'SUCCESS');

  return jsonb_build_object('status','APPROVED','onboarding_request_id',v_req.id,
    'business_id',v_business_id,'provider_profile_id',v_profile_id,'membership_id',v_membership_id);
end;
$$;

revoke all on function private.review_provider_onboarding_atomic(uuid,uuid,text,text)
from public,anon,authenticated;
