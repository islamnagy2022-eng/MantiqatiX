-- MantiqatiX: activity onboarding contact phone, audit-safe approval, and WhatsApp workflow.
-- Additive forward migration. Do not apply to production until the release gate and restore rehearsal pass.
begin;

alter table public.provider_onboarding_requests
  add column if not exists contact_phone varchar(40);

comment on column public.provider_onboarding_requests.contact_phone is
  'Contact telephone submitted by the activity owner; visible to authorized platform reviewers and used for owner contact/WhatsApp.';

create index if not exists idx_provider_onboarding_status_created
  on public.provider_onboarding_requests(status, created_at desc);

create or replace function private.review_provider_onboarding_atomic(
  p_actor_user_id uuid,
  p_onboarding_request_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_req public.provider_onboarding_requests%rowtype;
  v_ar public.account_registration_requests%rowtype;
  v_business_id uuid;
  v_profile_id uuid;
  v_membership_id varchar;
  v_code varchar;
  v_slug varchar;
  v_contact_phone text;
begin
  if not exists (select 1 from private.platform_admins where user_id=p_actor_user_id) then
    raise exception 'platform_admin_required';
  end if;
  if p_decision not in ('APPROVED','REJECTED') then
    raise exception 'invalid_decision';
  end if;

  select * into v_req
  from public.provider_onboarding_requests
  where id=p_onboarding_request_id
  for update;
  if not found then raise exception 'onboarding_not_found'; end if;
  if v_req.status <> 'PENDING' then raise exception 'onboarding_not_pending'; end if;

  select * into v_ar
  from public.account_registration_requests
  where id=v_req.registration_request_id
  for update;
  if not found or v_ar.status <> 'PENDING' then raise exception 'registration_not_pending'; end if;

  v_contact_phone := nullif(trim(coalesce(v_req.contact_phone,'')),'');

  if p_decision='REJECTED' then
    update public.provider_onboarding_requests
      set status='REJECTED', reviewed_by=p_actor_user_id, reviewed_at=now(),
          rejection_reason=nullif(trim(coalesce(p_rejection_reason,'')),''), updated_at=now()
      where id=v_req.id;
    update public.account_registration_requests
      set status='REJECTED', reviewed_by=p_actor_user_id, reviewed_at=now(), updated_at=now()
      where id=v_req.registration_request_id;
    insert into public.audit_logs(
      id,tenant_id,organization_id,actor_user_id,action,entity_type,entity_id,
      old_values,new_values,result
    ) values (
      gen_random_uuid()::text,v_req.tenant_id,v_req.organization_id,p_actor_user_id,
      'PROVIDER_ONBOARDING_REJECTED','provider_onboarding_request',v_req.id::text,
      jsonb_build_object('status','PENDING'),
      jsonb_build_object('status','REJECTED','reason',nullif(trim(coalesce(p_rejection_reason,'')),''),'contact_phone',v_contact_phone),
      'SUCCESS'
    );
    return jsonb_build_object('status','REJECTED','onboarding_request_id',v_req.id,'contact_phone',v_contact_phone);
  end if;

  -- Each activity request can create its own business membership. This is distinct
  -- from account authentication, which receives its CUSTOMER membership automatically.
  v_business_id := gen_random_uuid();
  v_code := 'BIZ-' || upper(replace(substr(v_business_id::text,1,8),'-',''));
  v_slug := lower(regexp_replace(trim(v_req.business_name),'[^a-zA-Z0-9]+','-','g'));
  if v_slug='' then v_slug='business-'||substr(v_business_id::text,1,8); end if;
  v_slug := left(v_slug,90) || '-' || substr(v_business_id::text,1,8);

  insert into public.businesses(id,tenant_id,organization_id,name,code,status,settings)
  values (
    v_business_id,v_req.tenant_id,v_req.organization_id,v_req.business_name,v_code,'ACTIVE',
    jsonb_build_object(
      'source','provider_onboarding',
      'onboarding_request_id',v_req.id,
      'contact_phone',v_contact_phone,
      'provider_kind',v_req.provider_kind,
      'specialties',v_req.specialties,
      'service_areas',v_req.service_areas
    )
  );

  v_profile_id := gen_random_uuid();
  insert into public.marketing_provider_profiles(
    id,provider_kind,business_id,owner_user_id,name_ar,name_en,slug,description,
    specialties,service_areas,portfolio,status,is_verified,is_featured,ranking_weight,settings,profile_image_path
  ) values (
    v_profile_id,v_req.provider_kind,v_business_id,v_req.user_id,v_req.business_name,
    v_req.name_en,v_slug,v_req.description,v_req.specialties,v_req.service_areas,
    v_req.portfolio,'ACTIVE',true,false,0,
    jsonb_build_object(
      'source','provider_onboarding',
      'onboarding_request_id',v_req.id,
      'contact_phone',v_contact_phone
    ),
    v_req.profile_image_path
  );

  v_membership_id := gen_random_uuid()::text;
  insert into public.user_memberships(
    id,user_id,tenant_id,organization_id,business_id,role,permissions,status
  ) values (
    v_membership_id,v_req.user_id,v_req.tenant_id,v_req.organization_id,v_business_id,
    'SERVICE_PROVIDER','[]'::jsonb,'ACTIVE'
  );

  update public.provider_onboarding_requests
    set status='APPROVED',reviewed_by=p_actor_user_id,reviewed_at=now(),updated_at=now()
    where id=v_req.id;
  update public.account_registration_requests
    set status='APPROVED',reviewed_by=p_actor_user_id,reviewed_at=now(),updated_at=now()
    where id=v_req.registration_request_id;

  insert into public.audit_logs(
    id,tenant_id,organization_id,actor_user_id,action,entity_type,entity_id,
    old_values,new_values,result
  ) values (
    gen_random_uuid()::text,v_req.tenant_id,v_req.organization_id,p_actor_user_id,
    'PROVIDER_ONBOARDING_APPROVED','provider_onboarding_request',v_req.id::text,
    jsonb_build_object('status','PENDING'),
    jsonb_build_object(
      'status','APPROVED','business_id',v_business_id,
      'provider_profile_id',v_profile_id,'membership_id',v_membership_id,
      'contact_phone',v_contact_phone
    ),
    'SUCCESS'
  );

  return jsonb_build_object(
    'status','APPROVED','onboarding_request_id',v_req.id,
    'business_id',v_business_id,'provider_profile_id',v_profile_id,
    'membership_id',v_membership_id,'contact_phone',v_contact_phone
  );
end;
$function$;

commit;
