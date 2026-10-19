-- RC531: create a business and its pending approval request in one transaction.
-- Service-role only; the Edge Function must authenticate the user before calling this RPC.
create or replace function public.register_business_with_approval_atomic(
  p_actor_user_id uuid,
  p_tenant_id varchar,
  p_organization_id varchar,
  p_name varchar,
  p_code varchar,
  p_sector varchar,
  p_address text,
  p_phone varchar,
  p_city varchar,
  p_district varchar
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_membership record;
  v_super_admin boolean := false;
  v_resolved_organization_id varchar;
  v_existing public.approval_requests%rowtype;
  v_business public.businesses%rowtype;
  v_request_id varchar;
  v_settings jsonb;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'TRUSTED_BUSINESS_REGISTRATION_REQUIRED';
  end if;

  if p_actor_user_id is null
     or nullif(pg_catalog.btrim(p_tenant_id), '') is null
     or nullif(pg_catalog.btrim(p_name), '') is null
     or nullif(pg_catalog.btrim(p_code), '') is null then
    raise exception 'BUSINESS_REGISTRATION_INPUT_REQUIRED';
  end if;

  -- Serialize requests by actor and tenant so concurrent calls cannot pass
  -- the pending-request check at the same time.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id || ':' || p_actor_user_id::text || ':BUSINESS_REGISTER', 0)
  );

  if not exists (
    select 1 from public.tenants t
    where t.id = p_tenant_id and t.status = 'ACTIVE'
  ) then
    return pg_catalog.jsonb_build_object('success', false, 'error', 'ACTIVE_TENANT_REQUIRED');
  end if;

  select m.role, m.organization_id, m.business_id, m.permissions
    into v_membership
  from public.user_memberships m
  where m.user_id = p_actor_user_id
    and m.status = 'ACTIVE'
    and (
      (
        m.tenant_id = p_tenant_id
        and pg_catalog.upper(coalesce(m.role, '')) in ('SERVICE_PROVIDER','BUSINESS_OWNER','OWNER','ADMIN')
      )
      or (
        m.tenant_id in (p_tenant_id, 'MNTY-PLATFORM')
        and pg_catalog.upper(coalesce(m.role, '')) = 'SUPER_ADMIN'
        and m.business_id is null
        and m.permissions ->> 'scope' = 'PLATFORM'
        and m.permissions ->> 'full_control' = 'true'
      )
    )
    and (
      p_organization_id is null
      or m.organization_id = p_organization_id
      or (
        m.tenant_id in (p_tenant_id, 'MNTY-PLATFORM')
        and pg_catalog.upper(coalesce(m.role, '')) = 'SUPER_ADMIN'
        and m.business_id is null
        and m.permissions ->> 'scope' = 'PLATFORM'
        and m.permissions ->> 'full_control' = 'true'
      )
    )
  order by
    case when pg_catalog.upper(coalesce(m.role, '')) = 'SUPER_ADMIN'
      and m.business_id is null
      and m.permissions ->> 'scope' = 'PLATFORM'
      and m.permissions ->> 'full_control' = 'true' then 0
      when m.tenant_id = p_tenant_id and m.organization_id = p_organization_id then 1
      when m.tenant_id = p_tenant_id then 2 else 3 end
  limit 1;

  if not found then
    return pg_catalog.jsonb_build_object('success', false, 'error', 'BUSINESS_CREATE_ROLE_REQUIRED');
  end if;

  v_super_admin :=
    pg_catalog.upper(coalesce(v_membership.role, '')) = 'SUPER_ADMIN'
    and v_membership.business_id is null
    and v_membership.permissions ->> 'scope' = 'PLATFORM'
    and v_membership.permissions ->> 'full_control' = 'true';

  if p_organization_id is not null then
    if v_super_admin then
      if not exists (
        select 1 from public.organizations o
        where o.id = p_organization_id and o.tenant_id = p_tenant_id
      ) then
        return pg_catalog.jsonb_build_object('success', false, 'error', 'ORGANIZATION_SCOPE_FORBIDDEN');
      end if;
    elsif v_membership.organization_id is distinct from p_organization_id then
      return pg_catalog.jsonb_build_object('success', false, 'error', 'ORGANIZATION_SCOPE_FORBIDDEN');
    end if;
  end if;

  v_resolved_organization_id :=
    case when p_organization_id is not null and v_super_admin
      then p_organization_id
      else v_membership.organization_id
    end;

  select ar.* into v_existing
  from public.approval_requests ar
  where ar.tenant_id = p_tenant_id
    and ar.requested_by = p_actor_user_id
    and ar.entity_type = 'BUSINESS'
    and ar.request_type = 'CREATE'
    and ar.status = 'PENDING'
  order by ar.created_at desc
  limit 1
  for update;

  if found then
    return pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'PENDING_BUSINESS_REQUEST_EXISTS',
      'businessId', v_existing.business_id
    );
  end if;

  v_settings := pg_catalog.jsonb_build_object(
    'sector', coalesce(p_sector, 'GENERAL'),
    'address', coalesce(p_address, ''),
    'phone', coalesce(p_phone, ''),
    'city', coalesce(p_city, ''),
    'district', coalesce(p_district, ''),
    'registration_source', 'web',
    'approval_status', 'PENDING'
  );

  insert into public.businesses(
    tenant_id, organization_id, name, code, status, settings
  ) values (
    p_tenant_id, v_resolved_organization_id, pg_catalog.btrim(p_name),
    pg_catalog.btrim(p_code), 'INACTIVE', v_settings
  )
  returning * into v_business;

  v_request_id := 'APR-' || pg_catalog.gen_random_uuid()::text;

  insert into public.approval_requests(
    id, tenant_id, organization_id, business_id, request_type, entity_type,
    entity_id, requested_by, status, priority, reason, metadata
  ) values (
    v_request_id, p_tenant_id, v_resolved_organization_id, v_business.id,
    'CREATE', 'BUSINESS', v_business.id::text, p_actor_user_id, 'PENDING',
    'NORMAL', 'طلب تسجيل نشاط جديد من الويب',
    pg_catalog.jsonb_build_object(
      'sector', coalesce(p_sector, 'GENERAL'),
      'address', coalesce(p_address, ''),
      'phone', coalesce(p_phone, ''),
      'city', coalesce(p_city, ''),
      'district', coalesce(p_district, ''),
      'created_by_super_admin', v_super_admin
    )
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'business', pg_catalog.jsonb_build_object(
      'id', v_business.id,
      'name', v_business.name,
      'code', v_business.code,
      'status', v_business.status,
      'tenant_id', v_business.tenant_id,
      'organization_id', v_business.organization_id
    ),
    'approvalRequestId', v_request_id,
    'pendingApproval', true
  );
end;
$function$;

revoke all on function public.register_business_with_approval_atomic(uuid, varchar, varchar, varchar, varchar, varchar, text, varchar, varchar, varchar) from public, anon, authenticated;
grant execute on function public.register_business_with_approval_atomic(uuid, varchar, varchar, varchar, varchar, varchar, text, varchar, varchar, varchar) to service_role;

comment on function public.register_business_with_approval_atomic(uuid, varchar, varchar, varchar, varchar, varchar, text, varchar, varchar, varchar)
is 'RC531: atomically creates an inactive business and its pending approval request; callable only by the trusted service-role backend.';
