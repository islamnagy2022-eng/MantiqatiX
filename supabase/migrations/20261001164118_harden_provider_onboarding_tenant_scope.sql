
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
language plpgsql
security definer
set search_path to ''
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
  if found and v_existing.status='PENDING' then raise exception 'onboarding_already_exists';
  elsif found and v_existing.status in ('APPROVED','REJECTED') then raise exception 'onboarding_already_processed'; end if;
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
  set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('source','provider_onboarding','onboarding_request_id',v_id),
      updated_at=now()
  where id=p_registration_request_id;
  return jsonb_build_object('ok',true,'onboarding_request_id',v_id,'status','PENDING');
end;
$$;
revoke all on function private.submit_provider_onboarding(uuid,uuid,varchar,varchar,varchar,varchar,varchar,text,jsonb,jsonb,jsonb,text) from public,anon,authenticated;
