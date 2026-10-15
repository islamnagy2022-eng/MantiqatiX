


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "private"."accept_indrive_bid_impl"("p_request_id" "uuid", "p_bid_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_owner_user_id uuid;
  v_request_status text;
  v_bid_request_id uuid;
  v_bid_status text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select owner_user_id,status
    into v_owner_user_id,v_request_status
  from public.indrive_requests
  where id=p_request_id
  for update;

  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_owner_user_id <> auth.uid() and not public.is_platform_admin()
    then raise exception 'REQUEST_OWNER_REQUIRED'; end if;
  if v_request_status='BID_ACCEPTED'
    then raise exception 'REQUEST_ALREADY_ACCEPTED'; end if;

  select request_id,status
    into v_bid_request_id,v_bid_status
  from public.indrive_bids
  where id=p_bid_id
  for update;

  if not found or v_bid_request_id<>p_request_id
    then raise exception 'BID_NOT_FOUND'; end if;
  if v_bid_status<>'OFFERED'
    then raise exception 'BID_NOT_OFFERED'; end if;

  update public.indrive_bids
    set status='ACCEPTED'
    where id=p_bid_id;

  update public.indrive_bids
    set status='REJECTED'
    where request_id=p_request_id
      and id<>p_bid_id
      and status='OFFERED';

  update public.indrive_requests
    set status='BID_ACCEPTED',accepted_bid_id=p_bid_id
    where id=p_request_id;
end;
$$;


ALTER FUNCTION "private"."accept_indrive_bid_impl"("p_request_id" "uuid", "p_bid_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."activate_customer_registration_atomic"("p_user_id" "uuid", "p_tenant_id" character varying DEFAULT 'MNTY-PLATFORM'::character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_tenant public.tenants%rowtype;
  v_membership_id varchar;
  v_existing_id varchar;
begin
  if p_user_id is null then
    raise exception 'user_required';
  end if;

  if p_tenant_id is null then
    raise exception 'tenant_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select * into v_tenant
  from public.tenants
  where id = p_tenant_id and status = 'ACTIVE';

  if not found then
    raise exception 'active_tenant_required';
  end if;

  select id into v_existing_id
  from public.user_memberships
  where user_id = p_user_id
    and tenant_id = p_tenant_id
    and upper(role) = 'CUSTOMER'
    and status = 'ACTIVE'
  limit 1;

  if v_existing_id is not null then
    update public.account_registration_requests
      set status = 'CANCELLED',
          updated_at = now()
      where user_id = p_user_id
        and requested_role = 'CUSTOMER'
        and status = 'PENDING';

    return jsonb_build_object(
      'status', 'ACTIVE',
      'membership_id', v_existing_id,
      'role', 'CUSTOMER',
      'tenant_id', p_tenant_id,
      'created', false
    );
  end if;

  v_membership_id := gen_random_uuid()::text;

  insert into public.user_memberships(
    id, user_id, tenant_id, organization_id, role, permissions, status
  ) values (
    v_membership_id, p_user_id, p_tenant_id, null, 'CUSTOMER', '{}'::jsonb, 'ACTIVE'
  );

  update public.account_registration_requests
    set status = 'CANCELLED',
        updated_at = now()
    where user_id = p_user_id
      and requested_role = 'CUSTOMER'
      and status = 'PENDING';

  insert into public.audit_logs(
    id, tenant_id, organization_id, actor_user_id, action,
    entity_type, entity_id, old_values, new_values, result
  ) values (
    gen_random_uuid()::text,
    p_tenant_id,
    null,
    p_user_id,
    'CUSTOMER_REGISTRATION_ACTIVATED',
    'user_membership',
    v_membership_id,
    jsonb_build_object('membership', null),
    jsonb_build_object('status','ACTIVE','role','CUSTOMER','membership_id',v_membership_id),
    'SUCCESS'
  );

  return jsonb_build_object(
    'status', 'ACTIVE',
    'membership_id', v_membership_id,
    'role', 'CUSTOMER',
    'tenant_id', p_tenant_id,
    'created', true
  );
end;
$$;


ALTER FUNCTION "private"."activate_customer_registration_atomic"("p_user_id" "uuid", "p_tenant_id" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."bootstrap_platform_admin"("p_user_id" "uuid", "p_tenant_id" character varying DEFAULT 'MNTY_PLATFORM'::character varying, "p_tenant_name" character varying DEFAULT 'MNTY Platform'::character varying, "p_tenant_code" character varying DEFAULT 'MNTY-PLATFORM'::character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_membership_id varchar;
begin
  if p_user_id is null then raise exception 'user_id_required'; end if;
  if exists (select 1 from private.platform_admins) then
    raise exception 'platform_bootstrap_already_completed';
  end if;
  if not exists (select 1 from auth.users where id=p_user_id) then
    raise exception 'auth_user_not_found';
  end if;

  insert into public.tenants(id,name,code,status,settings)
  values(p_tenant_id,p_tenant_name,p_tenant_code,'ACTIVE','{}'::jsonb);

  v_membership_id := gen_random_uuid()::text;

  insert into public.user_memberships(
    id,user_id,tenant_id,role,permissions,status
  ) values (
    v_membership_id,p_user_id,p_tenant_id,'SUPER_ADMIN','[]'::jsonb,'ACTIVE'
  );

  insert into private.platform_admins(user_id)
  values(p_user_id);

  insert into public.audit_logs(
    id,tenant_id,actor_user_id,action,entity_type,entity_id,
    old_values,new_values,result
  ) values (
    gen_random_uuid()::text,p_tenant_id,p_user_id,
    'PLATFORM_BOOTSTRAP','platform_admin',p_user_id::text,
    '{}'::jsonb,
    jsonb_build_object('tenant_id',p_tenant_id,'membership_id',v_membership_id,'role','SUPER_ADMIN'),
    'SUCCESS'
  );

  return jsonb_build_object(
    'ok',true,
    'tenant_id',p_tenant_id,
    'membership_id',v_membership_id,
    'platform_admin_user_id',p_user_id
  );
end;
$$;


ALTER FUNCTION "private"."bootstrap_platform_admin"("p_user_id" "uuid", "p_tenant_id" character varying, "p_tenant_name" character varying, "p_tenant_code" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_read_indrive_bid"("p_request_id" "uuid", "p_provider_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    p_provider_user_id = (select auth.uid())
    or exists (
      select 1
      from public.indrive_requests r
      where r.id = p_request_id
        and r.owner_user_id = (select auth.uid())
    )
    or public.is_platform_admin();
$$;


ALTER FUNCTION "private"."can_read_indrive_bid"("p_request_id" "uuid", "p_provider_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_read_indrive_request"("p_request_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.indrive_requests r
    where r.id = p_request_id
      and (
        r.owner_user_id = (select auth.uid())
        or exists (
          select 1
          from public.indrive_bids b
          where b.request_id = r.id
            and b.provider_user_id = (select auth.uid())
            and b.status in ('OFFERED','ACCEPTED')
        )
        or public.is_platform_admin()
      )
  );
$$;


ALTER FUNCTION "private"."can_read_indrive_request"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_submit_indrive_bid"("p_request_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.indrive_requests r
    where r.id = p_request_id
      and r.status = 'OPEN_FOR_BIDS'
      and r.owner_user_id <> (select auth.uid())
  );
$$;


ALTER FUNCTION "private"."can_submit_indrive_bid"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."disable_mnty_push_subscription"("p_endpoint" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.push_subscriptions set enabled=false,updated_at=now()
   where endpoint=trim(p_endpoint) and user_id=auth.uid();
end;
$$;


ALTER FUNCTION "private"."disable_mnty_push_subscription"("p_endpoint" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."ensure_customer_membership_for_user"("p_user_id" "uuid", "p_tenant_id" character varying DEFAULT 'MNTY-PLATFORM'::character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_existing_id varchar;
  v_membership_id varchar;
begin
  if p_user_id is null then raise exception 'user_required'; end if;
  if p_tenant_id is null then raise exception 'tenant_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':CUSTOMER:' || p_tenant_id, 0));
  if not exists (select 1 from public.tenants where id = p_tenant_id and status = 'ACTIVE') then
    raise exception 'active_tenant_required';
  end if;
  select id into v_existing_id
  from public.user_memberships
  where user_id = p_user_id and tenant_id = p_tenant_id
    and upper(role) = 'CUSTOMER' and status = 'ACTIVE'
  order by created_at asc nulls first, id asc limit 1;
  if v_existing_id is not null then
    return jsonb_build_object('status','ACTIVE','role','CUSTOMER','tenant_id',p_tenant_id,'membership_id',v_existing_id,'created',false);
  end if;
  v_membership_id := gen_random_uuid()::text;
  insert into public.user_memberships(
    id,user_id,tenant_id,organization_id,business_id,branch_id,role,permissions,status
  ) values (
    v_membership_id,p_user_id,p_tenant_id,null,null,null,'CUSTOMER','{}'::jsonb,'ACTIVE'
  );
  begin
    insert into public.audit_logs(
      id,tenant_id,organization_id,actor_user_id,action,
      entity_type,entity_id,old_values,new_values,result
    ) values (
      gen_random_uuid()::text,p_tenant_id,null,p_user_id,
      'CUSTOMER_MEMBERSHIP_AUTO_ACTIVATED','user_membership',v_membership_id,
      jsonb_build_object('membership',null),
      jsonb_build_object('status','ACTIVE','role','CUSTOMER','membership_id',v_membership_id),
      'SUCCESS'
    );
  exception when others then null;
  end;
  return jsonb_build_object('status','ACTIVE','role','CUSTOMER','tenant_id',p_tenant_id,'membership_id',v_membership_id,'created',true);
end;
$$;


ALTER FUNCTION "private"."ensure_customer_membership_for_user"("p_user_id" "uuid", "p_tenant_id" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."handle_auth_user_customer_membership"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if coalesce(new.is_anonymous, false) then return new; end if;
  perform private.ensure_customer_membership_for_user(new.id, 'MNTY-PLATFORM');
  return new;
end;
$$;


ALTER FUNCTION "private"."handle_auth_user_customer_membership"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."legal_is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 SELECT EXISTS(
   SELECT 1 FROM public.user_memberships m
   WHERE m.user_id=(SELECT auth.uid()) AND coalesce(m.status,'ACTIVE')='ACTIVE'
     AND upper(m.role) IN('SUPER_ADMIN','ADMIN','LEGAL_ADMIN')
 );
$$;


ALTER FUNCTION "private"."legal_is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."legal_is_admin"("p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_memberships m WHERE m.user_id=coalesce(p_user_id,(SELECT auth.uid())) AND coalesce(m.status,'ACTIVE')='ACTIVE' AND upper(m.role) IN('SUPER_ADMIN','ADMIN','LEGAL_ADMIN'));
$$;


ALTER FUNCTION "private"."legal_is_admin"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."mnty_notify_order_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
  select
    'NTF-' || gen_random_uuid()::text,
    new.tenant_id,
    m.user_id,
    'ORDER',
    'طلب جديد',
    'وصل طلب جديد إلى نشاطك. رقم الطلب: ' || new.id,
    'ORDER',
    new.id
  from public.user_memberships m
  where m.business_id = new.business_id
    and m.status = 'ACTIVE'
    and upper(coalesce(m.role,'')) in ('SERVICE_PROVIDER','BUSINESS_OWNER','OWNER','ADMIN','MANAGER')
    and m.user_id is not null;

  return new;
end;
$$;


ALTER FUNCTION "private"."mnty_notify_order_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."mnty_notify_order_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    values('NTF-'||gen_random_uuid()::text,new.tenant_id,new.customer_id,'ORDER_STATUS','تحديث حالة الطلب','تم تحديث حالة طلبك إلى: '||new.status||' — رقم الطلب: '||new.id,'ORDER',new.id);
    if upper(new.status)='CANCELLED' then
      insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
      select 'NTF-'||gen_random_uuid()::text,new.tenant_id,m.user_id,'ORDER_STATUS','إلغاء طلب','تم إلغاء الطلب رقم: '||new.id,'ORDER',new.id
      from public.user_memberships m
      where m.business_id=new.business_id and m.status='ACTIVE'
        and upper(coalesce(m.role,'')) in ('SERVICE_PROVIDER','BUSINESS_OWNER','OWNER','ADMIN','MANAGER')
        and m.user_id is not null;
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "private"."mnty_notify_order_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."mnty_notify_order_status_changed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.old_status is null or new.old_status = new.new_status then
    return new;
  end if;

  if new.order_id is not null then
    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    select
      'NTF-' || gen_random_uuid()::text,
      o.tenant_id,
      o.customer_id,
      'ORDER_STATUS',
      'تحديث حالة الطلب',
      'تم تحديث حالة طلبك إلى: ' || new.new_status,
      'ORDER',
      o.id::text
    from public.orders o
    where o.id = new.order_id
      and o.customer_id is not null;

    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    select
      'NTF-' || gen_random_uuid()::text,
      o.tenant_id,
      m.user_id,
      'ORDER_STATUS',
      'تحديث حالة طلب',
      'تم تحديث حالة الطلب رقم ' || o.id::text || ' إلى: ' || new.new_status,
      'ORDER',
      o.id::text
    from public.orders o
    join public.user_memberships m on m.business_id = o.business_id
    where o.id = new.order_id
      and m.status = 'ACTIVE'
      and upper(coalesce(m.role,'')) in ('SERVICE_PROVIDER','BUSINESS_OWNER','OWNER','ADMIN','MANAGER')
      and m.user_id is not null
      and m.user_id <> o.customer_id;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "private"."mnty_notify_order_status_changed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."reject_indrive_bid_impl"("p_request_id" "uuid", "p_bid_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_owner_user_id uuid;
  v_bid_request_id uuid;
  v_bid_status text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select owner_user_id
    into v_owner_user_id
  from public.indrive_requests
  where id=p_request_id
  for update;

  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_owner_user_id <> auth.uid() and not public.is_platform_admin()
    then raise exception 'REQUEST_OWNER_REQUIRED'; end if;

  select request_id,status
    into v_bid_request_id,v_bid_status
  from public.indrive_bids
  where id=p_bid_id
  for update;

  if not found or v_bid_request_id<>p_request_id
    then raise exception 'BID_NOT_FOUND'; end if;
  if v_bid_status<>'OFFERED'
    then raise exception 'BID_NOT_OFFERED'; end if;

  update public.indrive_bids
    set status='REJECTED'
    where id=p_bid_id;
end;
$$;


ALTER FUNCTION "private"."reject_indrive_bid_impl"("p_request_id" "uuid", "p_bid_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."review_business_approval_atomic"("p_actor_user_id" "uuid", "p_approval_request_id" character varying, "p_action" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  r approval_requests%rowtype;
  v_action text := upper(trim(p_action));
  v_now timestamptz := now();
begin
  if p_actor_user_id is null or p_approval_request_id is null then
    raise exception 'required';
  end if;
  if v_action not in ('APPROVE','REJECT') then
    raise exception 'invalid_action';
  end if;

  select * into r
  from approval_requests
  where id = p_approval_request_id
  for update;

  if not found then raise exception 'approval_not_found'; end if;
  if upper(r.status) <> 'PENDING' then raise exception 'approval_already_resolved'; end if;
  if upper(r.entity_type) <> 'BUSINESS' or upper(r.request_type) <> 'CREATE' or r.business_id is null
    then raise exception 'unsupported_approval'; end if;

  if not exists (
    select 1 from user_memberships m
    where m.user_id = p_actor_user_id
      and m.tenant_id = r.tenant_id
      and m.status = 'ACTIVE'
      and upper(m.role) in ('OWNER','ADMIN','SUPER_ADMIN')
  ) then
    raise exception 'forbidden';
  end if;

  if v_action = 'APPROVE' then
    if not exists (
      select 1 from businesses b
      where b.id = r.business_id
        and b.tenant_id = r.tenant_id
    ) then raise exception 'business_not_found'; end if;

    if not exists (
      select 1 from user_memberships m
      where m.user_id = r.requested_by
        and m.tenant_id = r.tenant_id
        and m.business_id = r.business_id
        and m.status = 'ACTIVE'
    ) then
      insert into user_memberships(
        id,user_id,tenant_id,organization_id,business_id,branch_id,role,permissions,status
      ) values (
        'MEM-' || gen_random_uuid()::text,
        r.requested_by,r.tenant_id,r.organization_id,r.business_id,r.branch_id,
        'BUSINESS_OWNER','{}'::jsonb,'ACTIVE'
      );
    end if;

    update businesses
    set status='ACTIVE', updated_at=v_now
    where id=r.business_id and tenant_id=r.tenant_id;

    update approval_requests
    set status='APPROVED',
        updated_at=v_now,
        metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
          'resolved_by',p_actor_user_id,'resolved_at',v_now,'decision','APPROVE'
        )
    where id=r.id and status='PENDING';
  else
    update approval_requests
    set status='REJECTED',
        updated_at=v_now,
        metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
          'resolved_by',p_actor_user_id,'resolved_at',v_now,'decision','REJECT'
        )
    where id=r.id and status='PENDING';
  end if;

  return jsonb_build_object(
    'success',true,
    'approvalRequestId',r.id,
    'status',case when v_action='APPROVE' then 'APPROVED' else 'REJECTED' end,
    'businessId',r.business_id,
    'activated',v_action='APPROVE'
  );
end;
$$;


ALTER FUNCTION "private"."review_business_approval_atomic"("p_actor_user_id" "uuid", "p_approval_request_id" character varying, "p_action" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."review_provider_onboarding_atomic"("p_actor_user_id" "uuid", "p_onboarding_request_id" "uuid", "p_decision" "text", "p_rejection_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

  select * into v_req from public.provider_onboarding_requests
  where id=p_onboarding_request_id for update;
  if not found then raise exception 'onboarding_not_found'; end if;
  if v_req.status <> 'PENDING' then raise exception 'onboarding_not_pending'; end if;

  select * into v_ar from public.account_registration_requests
  where id=v_req.registration_request_id for update;
  if not found or v_ar.status <> 'PENDING' then raise exception 'registration_not_pending'; end if;

  if p_decision='REJECTED' then
    update public.provider_onboarding_requests
      set status='REJECTED', reviewed_by=p_actor_user_id, reviewed_at=now(),
          rejection_reason=nullif(trim(coalesce(p_rejection_reason,'')),''), updated_at=now()
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
  values (
    v_business_id,v_req.tenant_id,v_req.organization_id,v_req.business_name,v_code,'ACTIVE',
    jsonb_build_object('source','provider_onboarding','onboarding_request_id',v_req.id)
  );

  v_profile_id := gen_random_uuid();
  insert into public.marketing_provider_profiles(
    id,provider_kind,business_id,owner_user_id,name_ar,name_en,slug,description,
    specialties,service_areas,portfolio,status,is_verified,is_featured,ranking_weight,settings,profile_image_path
  ) values (
    v_profile_id,v_req.provider_kind,v_business_id,v_req.user_id,v_req.business_name,
    v_req.name_en,v_slug,v_req.description,v_req.specialties,v_req.service_areas,
    v_req.portfolio,'ACTIVE',true,false,0,
    jsonb_build_object('source','provider_onboarding','onboarding_request_id',v_req.id),
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
    jsonb_build_object('status','APPROVED','business_id',v_business_id,
      'provider_profile_id',v_profile_id,'membership_id',v_membership_id),
    'SUCCESS'
  );

  return jsonb_build_object(
    'status','APPROVED','onboarding_request_id',v_req.id,
    'business_id',v_business_id,'provider_profile_id',v_profile_id,
    'membership_id',v_membership_id
  );
end;
$$;


ALTER FUNCTION "private"."review_provider_onboarding_atomic"("p_actor_user_id" "uuid", "p_onboarding_request_id" "uuid", "p_decision" "text", "p_rejection_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."review_registration_request_atomic"("p_actor_user_id" "uuid", "p_request_id" "uuid", "p_decision" "text", "p_tenant_id" character varying DEFAULT NULL::character varying, "p_organization_id" character varying DEFAULT NULL::character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_request public.account_registration_requests%rowtype;
  v_tenant public.tenants%rowtype;
  v_membership_id varchar;
  v_notification_tenant varchar;
begin
  if p_actor_user_id is null then raise exception 'actor_required'; end if;

  if not exists (
    select 1 from private.platform_admins pa
    where pa.user_id = p_actor_user_id
  ) then raise exception 'platform_admin_required'; end if;

  if p_decision not in ('APPROVED','REJECTED') then
    raise exception 'invalid_decision';
  end if;

  select * into v_request
  from public.account_registration_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'registration_not_found'; end if;
  if v_request.status <> 'PENDING' then raise exception 'registration_not_pending'; end if;

  if p_decision = 'APPROVED' and v_request.requested_role = 'SERVICE_PROVIDER' then
    raise exception 'provider_onboarding_required';
  end if;

  if p_decision = 'REJECTED' then
    update public.account_registration_requests
      set status='REJECTED', reviewed_by=p_actor_user_id,
          reviewed_at=now(), updated_at=now()
      where id=p_request_id;

    v_notification_tenant := 'MNTY-PLATFORM';

    insert into public.notifications(
      id,tenant_id,user_id,type,title,body,entity_type,entity_id,created_at
    ) values (
      pg_catalog.gen_random_uuid()::text,
      v_notification_tenant,
      v_request.user_id,
      'REGISTRATION_REJECTED',
      'Registration request rejected',
      'Your account registration request was rejected.',
      'account_registration_request',
      p_request_id::text,
      now()
    );

    insert into public.audit_logs(
      id,tenant_id,organization_id,actor_user_id,action,
      entity_type,entity_id,old_values,new_values,result
    ) values (
      pg_catalog.gen_random_uuid()::text,
      v_notification_tenant,
      p_organization_id,
      p_actor_user_id,
      'REGISTRATION_REJECTED',
      'account_registration_request',
      p_request_id::text,
      jsonb_build_object('status','PENDING'),
      jsonb_build_object('status','REJECTED','requested_role',v_request.requested_role),
      'SUCCESS'
    );

    return jsonb_build_object('status','REJECTED');
  end if;

  if p_tenant_id is null then raise exception 'tenant_id_required_for_approval'; end if;

  select * into v_tenant
  from public.tenants
  where id=p_tenant_id and status='ACTIVE';

  if not found then raise exception 'active_tenant_required'; end if;

  if exists (
    select 1 from public.user_memberships um
    where um.user_id=v_request.user_id
      and um.tenant_id=p_tenant_id
      and um.status='ACTIVE'
      and upper(um.role)=upper(v_request.requested_role)
  ) then
    raise exception 'membership_already_exists';
  end if;

  v_membership_id := pg_catalog.gen_random_uuid()::text;

  insert into public.user_memberships(
    id,user_id,tenant_id,organization_id,role,permissions,status
  ) values (
    v_membership_id,v_request.user_id,p_tenant_id,p_organization_id,
    v_request.requested_role,'[]'::jsonb,'ACTIVE'
  );

  update public.account_registration_requests
    set status='APPROVED', reviewed_by=p_actor_user_id,
        reviewed_at=now(), updated_at=now()
    where id=p_request_id;

  insert into public.audit_logs(
    id,tenant_id,organization_id,actor_user_id,action,
    entity_type,entity_id,old_values,new_values,result
  ) values (
    pg_catalog.gen_random_uuid()::text,p_tenant_id,p_organization_id,p_actor_user_id,
    'REGISTRATION_APPROVED','account_registration_request',
    p_request_id::text,
    jsonb_build_object('status','PENDING'),
    jsonb_build_object('status','APPROVED','membership_id',v_membership_id,'role',v_request.requested_role),
    'SUCCESS'
  );

  insert into public.notifications(
    id,tenant_id,user_id,type,title,body,entity_type,entity_id,created_at
  ) values (
    pg_catalog.gen_random_uuid()::text,
    p_tenant_id,
    v_request.user_id,
    'REGISTRATION_APPROVED',
    'Registration request approved',
    'Your account registration request was approved.',
    'account_registration_request',
    p_request_id::text,
    now()
  );

  return jsonb_build_object(
    'status','APPROVED',
    'membership_id',v_membership_id,
    'role',v_request.requested_role,
    'tenant_id',p_tenant_id
  );
end;
$$;


ALTER FUNCTION "private"."review_registration_request_atomic"("p_actor_user_id" "uuid", "p_request_id" "uuid", "p_decision" "text", "p_tenant_id" character varying, "p_organization_id" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "private"."review_registration_request_atomic"("p_actor_user_id" "uuid", "p_request_id" "uuid", "p_decision" "text", "p_tenant_id" character varying, "p_organization_id" character varying) IS 'RC264 atomic registration review with audit records and user notifications.';



CREATE OR REPLACE FUNCTION "private"."submit_provider_onboarding"("p_user_id" "uuid", "p_registration_request_id" "uuid", "p_tenant_id" character varying, "p_organization_id" character varying, "p_business_name" character varying, "p_provider_kind" character varying, "p_name_en" character varying DEFAULT NULL::character varying, "p_description" "text" DEFAULT NULL::"text", "p_specialties" "jsonb" DEFAULT '[]'::"jsonb", "p_service_areas" "jsonb" DEFAULT '[]'::"jsonb", "p_portfolio" "jsonb" DEFAULT '[]'::"jsonb", "p_profile_image_path" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."submit_provider_onboarding"("p_user_id" "uuid", "p_registration_request_id" "uuid", "p_tenant_id" character varying, "p_organization_id" character varying, "p_business_name" character varying, "p_provider_kind" character varying, "p_name_en" character varying, "p_description" "text", "p_specialties" "jsonb", "p_service_areas" "jsonb", "p_portfolio" "jsonb", "p_profile_image_path" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "platform" "text",
    "enabled" boolean DEFAULT true NOT NULL,
    "last_success_at" timestamp with time zone,
    "last_error_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."upsert_mnty_push_subscription"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text" DEFAULT NULL::"text", "p_platform" "text" DEFAULT NULL::"text") RETURNS "public"."push_subscriptions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_row public.push_subscriptions;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(length(trim(p_endpoint)),0) < 20 then raise exception 'INVALID_ENDPOINT'; end if;
  if coalesce(length(trim(p_p256dh)),0) < 20 or coalesce(length(trim(p_auth)),0) < 10 then raise exception 'INVALID_SUBSCRIPTION_KEYS'; end if;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,user_agent,platform,enabled,updated_at)
  values(auth.uid(),trim(p_endpoint),trim(p_p256dh),trim(p_auth),left(p_user_agent,500),left(p_platform,100),true,now())
  on conflict (endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,
    user_agent=excluded.user_agent,platform=excluded.platform,enabled=true,updated_at=now()
  returning * into v_row;
  return v_row;
end;
$$;


ALTER FUNCTION "private"."upsert_mnty_push_subscription"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text", "p_platform" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_indrive_bid"("p_request_id" "uuid", "p_bid_id" "uuid") RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select private.accept_indrive_bid_impl(p_request_id,p_bid_id);
$$;


ALTER FUNCTION "public"."accept_indrive_bid"("p_request_id" "uuid", "p_bid_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_mantigo_bid_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_bid_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_status text; v_customer uuid; v_captain uuid; v_price numeric; v_fin jsonb;
begin
 if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 select r.status,r.customer_id,b.captain_id,b.offered_price into v_status,v_customer,v_captain,v_price
 from public.mantigo_rides r join public.mantigo_bids b on b.ride_id=r.id and b.id=p_bid_id
 where r.id=p_ride_id for update of r;
 if v_status is null then raise exception 'RIDE_OR_BID_NOT_FOUND'; end if;
 if v_customer<>p_user_id then raise exception 'CUSTOMER_REQUIRED'; end if;
 if v_status not in ('OPEN','OPEN_FOR_BIDS','MATCHING') then raise exception 'RIDE_NOT_OPEN'; end if;

 update public.mantigo_bids set status='REJECTED' where ride_id=p_ride_id and status='OFFERED' and id<>p_bid_id;
 update public.mantigo_bids set status='ACCEPTED' where id=p_bid_id and ride_id=p_ride_id;
 update public.mantigo_rides set accepted_bid_id=p_bid_id,status='ACCEPTED',updated_at=now() where id=p_ride_id;

 v_fin:=public.lock_mantigo_fare_backend(p_user_id,p_ride_id);

 insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
 values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_BID_ACCEPTED','MANTIGO_RIDE',p_ride_id,
   jsonb_build_object('status',v_status),jsonb_build_object('status','ACCEPTED','accepted_bid_id',p_bid_id,'captain_id',v_captain,'fare',v_fin),'SUCCESS');

 begin
   insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
   values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_captain,'MANTIGO_ACCEPTED',
     'تم قبول عرضك في MantiGO','تم قبول عرضك للرحلة بقيمة '||to_char(v_price,'FM999999990D00')||' ج.م','MANTIGO_RIDE',p_ride_id);
 exception when others then
   insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
   values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,
     jsonb_build_object('notification_type','MANTIGO_ACCEPTED','error',sqlerrm),'PARTIAL');
 end;
 return jsonb_build_object('id',p_ride_id,'accepted_bid_id',p_bid_id,'status','ACCEPTED','financial',v_fin);
end
$$;


ALTER FUNCTION "public"."accept_mantigo_bid_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_bid_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_create_global_ad"("p_title" character varying, "p_creative_url" "text", "p_target_url" "text" DEFAULT NULL::"text", "p_start_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_end_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_id uuid;
begin
  if not public.mnty_can_platform_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if coalesce(trim(p_title),'')='' or coalesce(trim(p_creative_url),'')='' then
    raise exception 'TITLE_AND_CREATIVE_REQUIRED';
  end if;
  insert into public.platform_global_advertisements(title,creative_url,target_url,status,approval_status,start_at,end_at,created_by)
  values(trim(p_title),trim(p_creative_url),nullif(trim(p_target_url),''),'ACTIVE','APPROVED',p_start_at,p_end_at,auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;


ALTER FUNCTION "public"."admin_create_global_ad"("p_title" character varying, "p_creative_url" "text", "p_target_url" "text", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "organization_id" character varying(64),
    "business_id" "uuid",
    "branch_id" character varying(64),
    "actor_user_id" "uuid" NOT NULL,
    "action" character varying(128) NOT NULL,
    "entity_type" character varying(64) NOT NULL,
    "entity_id" character varying(64) NOT NULL,
    "old_values" "jsonb" DEFAULT '{}'::"jsonb",
    "new_values" "jsonb" DEFAULT '{}'::"jsonb",
    "result" character varying(32) DEFAULT 'SUCCESS'::character varying NOT NULL,
    "ip_address" character varying(64),
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."audit_logs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."append_audit_log_backend"("p_id" character varying, "p_tenant_id" character varying, "p_organization_id" character varying DEFAULT NULL::character varying, "p_business_id" "uuid" DEFAULT NULL::"uuid", "p_branch_id" character varying DEFAULT NULL::character varying, "p_action" character varying DEFAULT 'UNKNOWN'::character varying, "p_entity_type" character varying DEFAULT 'UNKNOWN'::character varying, "p_entity_id" character varying DEFAULT ''::character varying, "p_old_values" "jsonb" DEFAULT NULL::"jsonb", "p_new_values" "jsonb" DEFAULT NULL::"jsonb", "p_result" character varying DEFAULT 'SUCCESS'::character varying) RETURNS "public"."audit_logs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_row public.audit_logs;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists (
   select 1 from public.user_memberships m
   where m.user_id=auth.uid() and m.tenant_id=p_tenant_id and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
 ) then raise exception 'TENANT_ACCESS_DENIED'; end if;
 if upper(coalesce(p_result,'SUCCESS')) not in ('SUCCESS','FAILURE','DENIED','ERROR') then
   raise exception 'INVALID_AUDIT_RESULT';
 end if;
 insert into public.audit_logs(
   id,tenant_id,organization_id,business_id,branch_id,actor_user_id,
   action,entity_type,entity_id,old_values,new_values,result,created_at
 ) values (
   p_id,p_tenant_id,p_organization_id,p_business_id,p_branch_id,auth.uid(),
   p_action,p_entity_type,p_entity_id,p_old_values,p_new_values,p_result,now()
 )
 returning * into v_row;
 return v_row;
end;
$$;


ALTER FUNCTION "public"."append_audit_log_backend"("p_id" character varying, "p_tenant_id" character varying, "p_organization_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_action" character varying, "p_entity_type" character varying, "p_entity_id" character varying, "p_old_values" "jsonb", "p_new_values" "jsonb", "p_result" character varying) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_messages" (
    "id" character varying NOT NULL,
    "ticket_id" character varying NOT NULL,
    "sender_user_id" "uuid" NOT NULL,
    "sender_role" character varying DEFAULT 'CUSTOMER'::character varying NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."ticket_messages" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_messages" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."append_ticket_message_backend"("p_id" character varying, "p_ticket_id" character varying, "p_content" "text", "p_sender_role" character varying) RETURNS "public"."ticket_messages"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare t public.support_tickets; r public.ticket_messages;
begin
 select * into t from public.support_tickets where id=p_ticket_id; if not found then raise exception 'TICKET_NOT_FOUND'; end if;
 if not(t.requester_id=auth.uid() or t.assigned_user_id=auth.uid() or exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=t.tenant_id and m.status='ACTIVE' and upper(m.role) in ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','SUPPORT','SUPPORT_MANAGER'))) then raise exception 'TICKET_ACCESS_DENIED'; end if;
 insert into public.ticket_messages(id,ticket_id,sender_user_id,sender_role,content) values(p_id,p_ticket_id,auth.uid(),p_sender_role,p_content) returning * into r;
 update public.support_tickets set updated_at=now() where id=p_ticket_id; return r;
end; $$;


ALTER FUNCTION "public"."append_ticket_message_backend"("p_id" character varying, "p_ticket_id" character varying, "p_content" "text", "p_sender_role" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_financial_membership"("p_tenant_id" character varying) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_role varchar;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT role INTO v_role FROM public.user_memberships
  WHERE user_id = auth.uid() AND tenant_id = p_tenant_id AND status = 'ACTIVE'
  ORDER BY created_at ASC LIMIT 1;
  IF v_role IS NULL THEN RAISE EXCEPTION 'TENANT_ACCESS_DENIED'; END IF;
  IF upper(v_role) NOT IN ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','ACCOUNTANT','FINANCE_MANAGER','FINANCE') THEN RAISE EXCEPTION 'FINANCE_ROLE_REQUIRED'; END IF;
END; $$;


ALTER FUNCTION "public"."assert_financial_membership"("p_tenant_id" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_digital_page_payment_intent_backend"("p_order_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text", "p_claim_token" "text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "amount" numeric, "currency" "text", "payment_status" "text", "fulfillment_status" "text", "pricing_hash" "text", "provider_intent_id" "text", "title" "text", "page_type" "text", "claim_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_order public.digital_page_orders%rowtype;
  v_claim jsonb;
  v_claimed_at timestamptz;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_order
  from public.digital_page_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.user_id <> p_user_id then
    raise exception 'FORBIDDEN';
  end if;

  if v_order.idempotency_key <> p_idempotency_key then
    raise exception 'IDEMPOTENCY_KEY_MISMATCH';
  end if;

  if v_order.payment_status = 'PAID' then
    raise exception 'ALREADY_PAID';
  end if;

  if v_order.provider_intent_id is not null then
    return query
      select v_order.id,v_order.user_id,v_order.amount,v_order.currency,v_order.payment_status,
             v_order.fulfillment_status,v_order.pricing_hash,v_order.provider_intent_id,
             v_order.title,v_order.page_type,'EXISTING'::text;
    return;
  end if;

  v_claim := coalesce(v_order.metadata->'payment_intent_claim','null'::jsonb);
  v_claimed_at := nullif(v_claim->>'claimed_at','')::timestamptz;

  if v_claim ? 'token'
     and v_claimed_at is not null
     and v_claimed_at > now() - interval '5 minutes'
     and (v_claim->>'token') <> p_claim_token then
    return query
      select v_order.id,v_order.user_id,v_order.amount,v_order.currency,v_order.payment_status,
             v_order.fulfillment_status,v_order.pricing_hash,v_order.provider_intent_id,
             v_order.title,v_order.page_type,'IN_PROGRESS'::text;
    return;
  end if;

  update public.digital_page_orders
  set metadata = jsonb_set(
      coalesce(metadata,'{}'::jsonb),
      '{payment_intent_claim}',
      jsonb_build_object('token',p_claim_token,'claimed_at',now()::text),
      true
    ),
    updated_at = now()
  where id = v_order.id;

  return query
    select v_order.id,v_order.user_id,v_order.amount,v_order.currency,v_order.payment_status,
           v_order.fulfillment_status,v_order.pricing_hash,v_order.provider_intent_id,
           v_order.title,v_order.page_type,'CLAIMED'::text;
end;
$$;


ALTER FUNCTION "public"."claim_digital_page_payment_intent_backend"("p_order_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text", "p_claim_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_referral"("p_code" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_ref public.referral_codes%rowtype;
  v_existing uuid;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous'),'false') = 'true' then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_ref from public.referral_codes
  where code = upper(trim(p_code)) and status = 'ACTIVE'
  limit 1;

  if v_ref.id is null then
    raise exception 'INVALID_REFERRAL_CODE';
  end if;

  if v_ref.user_id = v_uid then
    raise exception 'SELF_REFERRAL_NOT_ALLOWED';
  end if;

  select id into v_existing from public.referral_events where referred_user_id = v_uid limit 1;
  if v_existing is not null then
    return jsonb_build_object('accepted', false, 'reason', 'ALREADY_CLAIMED');
  end if;

  insert into public.referral_events(
    referral_code_id, referral_code, referrer_user_id, referred_user_id
  ) values (
    v_ref.id, v_ref.code, v_ref.user_id, v_uid
  )
  on conflict (referred_user_id) do nothing;

  return jsonb_build_object('accepted', true, 'code', v_ref.code);
end;
$$;


ALTER FUNCTION "public"."claim_referral"("p_code" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_cash_payment"("p_payment_intent_id" character varying, "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_payment_intent_id uuid; v_intent record; v_order record; v_membership record; v_rule record;
v_commission_amount numeric:=0; v_user_role text; v_is_authorized boolean:=false; v_event_id text; v_obligation_id text;
BEGIN
 v_payment_intent_id:=p_payment_intent_id::uuid;
 IF auth.uid() IS NOT NULL AND auth.uid()<>p_user_id THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO v_intent FROM public.payment_intents WHERE id=v_payment_intent_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_INTENT_NOT_FOUND'; END IF;
 SELECT * INTO v_order FROM public.orders WHERE id=v_intent.order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 IF v_intent.status='SUCCEEDED' THEN
   RETURN jsonb_build_object('status','success','message','Already confirmed','payment_intent',to_jsonb(v_intent),'order',to_jsonb(v_order));
 END IF;
 IF v_intent.status NOT IN ('CREATED','PENDING') THEN RAISE EXCEPTION 'INVALID_PAYMENT_STATE'; END IF;
 IF v_order.status='CANCELLED' THEN RAISE EXCEPTION 'ORDER_CANCELLED'; END IF;
 IF v_intent.payment_method<>'CASH_ON_DELIVERY' THEN RAISE EXCEPTION 'INVALID_METHOD'; END IF;
 IF v_intent.tenant_id::text<>v_order.tenant_id::text THEN RAISE EXCEPTION 'TENANT_MISMATCH'; END IF;
 IF v_intent.pricing_hash IS NULL OR v_order.pricing_hash IS NULL OR v_intent.pricing_hash<>v_order.pricing_hash
    OR v_intent.pricing_version IS DISTINCT FROM v_order.pricing_version THEN RAISE EXCEPTION 'PRICING_BINDING_MISMATCH'; END IF;
 IF v_intent.amount<>v_order.total OR v_intent.currency<>v_order.currency THEN RAISE EXCEPTION 'FINANCIAL_MISMATCH'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.tenant_payment_methods tpm WHERE tpm.tenant_id=v_intent.tenant_id::text AND tpm.payment_method='CASH_ON_DELIVERY' AND tpm.provider=v_intent.provider AND tpm.is_enabled=true)
 THEN RAISE EXCEPTION 'INVALID_PROVIDER'; END IF;
 SELECT role,permissions,status INTO v_membership FROM public.user_memberships WHERE user_id=p_user_id AND tenant_id=v_intent.tenant_id;
 IF NOT FOUND OR (v_membership.status IS NOT NULL AND v_membership.status<>'ACTIVE') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 v_user_role:=coalesce(v_membership.role,'CUSTOMER');
 v_is_authorized:=(upper(v_user_role) in ('ADMIN','MANAGER','CASHIER','STAFF','OWNER') OR (coalesce(v_membership.permissions,'{}'::jsonb)?'PAYMENT_CONFIRM_CASH')) AND upper(v_user_role)<>'CUSTOMER';
 IF NOT v_is_authorized THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT cr.id,cr.rule_type,cr.percentage,cr.fixed_amount,cr.per_item_amount INTO v_rule
 FROM public.commission_rules cr WHERE cr.tenant_id=v_intent.tenant_id AND cr.active=true
 AND (cr.business_id=v_order.business_id OR cr.business_id IS NULL)
 ORDER BY CASE WHEN cr.business_id=v_order.business_id THEN 0 ELSE 1 END,cr.updated_at DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMISSION_RULE_NOT_CONFIGURED'; END IF;
 IF upper(coalesce(v_rule.rule_type,'PERCENTAGE'))='PERCENTAGE' THEN
   IF coalesce(v_rule.percentage,0)<0 OR coalesce(v_rule.percentage,0)>100 THEN RAISE EXCEPTION 'COMMISSION_RULE_INVALID'; END IF;
   v_commission_amount:=round(v_intent.amount*coalesce(v_rule.percentage,0)/100,2);
 ELSIF upper(v_rule.rule_type)='FIXED' THEN v_commission_amount:=greatest(0,coalesce(v_rule.fixed_amount,0));
 ELSE RAISE EXCEPTION 'COMMISSION_RULE_TYPE_UNSUPPORTED_FOR_CASH'; END IF;
 IF v_commission_amount>v_intent.amount THEN RAISE EXCEPTION 'COMMISSION_EXCEEDS_ORDER'; END IF;
 UPDATE public.payment_intents SET status='SUCCEEDED',updated_at=now() WHERE id=v_payment_intent_id;
 v_event_id:='cash_confirmed:'||v_payment_intent_id::text;
 INSERT INTO public.payment_events(id,tenant_id,event_id,payment_id,amount,payment_method,status,raw_payload,created_at)
 VALUES(gen_random_uuid(),v_intent.tenant_id,v_event_id,p_payment_intent_id,v_intent.amount,'CASH_ON_DELIVERY','PROCESSED',
 jsonb_build_object('action','CASH_CONFIRMED','confirmed_by',p_user_id,'previous_status',v_intent.status,'new_status','SUCCEEDED','commission_amount',v_commission_amount,'commission_rule_id',v_rule.id,'timestamp',now()),now())
 ON CONFLICT(event_id) DO NOTHING;
 v_obligation_id:='cash_commission:'||v_payment_intent_id::text;
 INSERT INTO public.financial_obligations(id,tenant_id,business_id,order_id,payment_intent_id,beneficiary_type,beneficiary_id,obligation_type,gross_amount,amount,currency,status,payment_method,metadata)
 VALUES(v_obligation_id,v_intent.tenant_id,v_order.business_id,v_order.id,v_intent.id::text,'PLATFORM','PLATFORM','PLATFORM_COMMISSION',v_intent.amount,v_commission_amount,v_intent.currency,'DUE','CASH',
 jsonb_build_object('reason','CUSTOMER_PAID_PROVIDER_DIRECTLY','commission_rule_id',v_rule.id,'commission_rate',coalesce(v_rule.percentage,0),'confirmed_by',p_user_id))
 ON CONFLICT(id) DO NOTHING;
 SELECT * INTO v_intent FROM public.payment_intents WHERE id=v_payment_intent_id;
 RETURN jsonb_build_object('status','success','payment_intent',to_jsonb(v_intent),'order',to_jsonb(v_order),
 'commission_obligation',jsonb_build_object('id',v_obligation_id,'amount',v_commission_amount,'status','DUE'));
END; $$;


ALTER FUNCTION "public"."confirm_cash_payment"("p_payment_intent_id" character varying, "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_mantigo_cash_payment_backend"("p_user_id" "uuid", "p_ride_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_f public.mantigo_financial_ledger%rowtype; v_rate numeric; v_commission numeric; v_net numeric;
begin
  if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  select * into v_f from public.mantigo_financial_ledger where ride_id=p_ride_id for update;
  if not found then raise exception 'FINANCIAL_RECORD_NOT_FOUND'; end if;
  if v_f.customer_id<>p_user_id then raise exception 'CUSTOMER_REQUIRED'; end if;
  if v_f.payment_status in ('PAID','CASH_CONFIRMED') then
    return jsonb_build_object('ride_id',p_ride_id,'payment_status',v_f.payment_status,'commission_rate',v_f.commission_rate,'commission_amount',v_f.commission_amount,'captain_net_amount',v_f.captain_net_amount,'idempotent',true);
  end if;
  if v_f.payment_status<>'REQUIRED' then raise exception 'INVALID_PAYMENT_STATE'; end if;
  select commission_rate into v_rate from public.mantigo_financial_config where id=true;
  if v_rate is null then raise exception 'MANTIGO_COMMISSION_NOT_CONFIGURED'; end if;
  v_commission:=round(v_f.gross_amount*v_rate/100,2); v_net:=round(v_f.gross_amount-v_commission,2);
  update public.mantigo_financial_ledger set payment_method='CASH',payment_status='CASH_CONFIRMED',commission_rate=v_rate,commission_amount=v_commission,captain_net_amount=v_net,settlement_status='READY',payment_reference='CASH-'||p_ride_id,payment_confirmed_at=now(),updated_at=now() where ride_id=p_ride_id;
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_CASH_PAYMENT_CONFIRMED','MANTIGO_FINANCIAL',v_f.id,jsonb_build_object('payment_status','REQUIRED'),jsonb_build_object('payment_status','CASH_CONFIRMED','commission_rate',v_rate,'commission_amount',v_commission,'captain_net_amount',v_net,'settlement_status','READY'),'SUCCESS');
  begin
    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_f.captain_id,'MANTIGO_PAYMENT','تم تأكيد الدفع','تم تأكيد الدفع النقدي للرحلة ويمكن متابعة التنفيذ.','MANTIGO_RIDE',p_ride_id);
  exception when others then
    insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
    values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,jsonb_build_object('notification_type','MANTIGO_PAYMENT','error',sqlerrm),'PARTIAL');
  end;
  return jsonb_build_object('ride_id',p_ride_id,'payment_status','CASH_CONFIRMED','commission_rate',v_rate,'commission_amount',v_commission,'captain_net_amount',v_net,'settlement_status','READY','idempotent',false);
end $$;


ALTER FUNCTION "public"."confirm_mantigo_cash_payment_backend"("p_user_id" "uuid", "p_ride_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_obligation_settlement"("p_obligation_id" character varying, "p_external_reference" character varying, "p_confirmed_amount" numeric, "p_currency" character varying, "p_provider" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  o public.financial_obligations%rowtype;
  attempt_id varchar;
begin
  if coalesce(trim(p_external_reference),'') = '' then
    raise exception 'external_reference_required';
  end if;
  if coalesce(p_confirmed_amount,0) <= 0 then
    raise exception 'confirmed_amount_must_be_positive';
  end if;

  select * into o
  from public.financial_obligations
  where id = p_obligation_id
  for update;

  if not found then raise exception 'obligation_not_found'; end if;
  if upper(coalesce(p_currency,'')) <> upper(o.currency) then
    raise exception 'currency_mismatch';
  end if;
  if p_confirmed_amount <> o.amount then
    raise exception 'settlement_amount_mismatch';
  end if;
  if o.status = 'SETTLED' then
    return jsonb_build_object('idempotent', true, 'obligation_id', o.id, 'status', o.status);
  end if;
  if o.status in ('CANCELLED','FAILED') then
    raise exception 'obligation_not_settleable';
  end if;

  attempt_id := 'settle:' || o.id || ':' || p_external_reference;

  insert into public.settlement_attempts(
    id, tenant_id, obligation_id, provider, amount, currency,
    status, external_reference, completed_at, created_at, updated_at
  )
  values (
    attempt_id, o.tenant_id, o.id, p_provider, o.amount, o.currency,
    'SUCCEEDED', p_external_reference, now(), now(), now()
  )
  on conflict (id) do update
    set status='SUCCEEDED', completed_at=now(), updated_at=now();

  update public.financial_obligations
  set status='SETTLED', settlement_id=attempt_id, settled_at=now(), updated_at=now()
  where id=o.id;

  return jsonb_build_object(
    'idempotent', false,
    'obligation_id', o.id,
    'status', 'SETTLED',
    'settlement_id', attempt_id,
    'amount', o.amount,
    'currency', o.currency
  );
end;
$$;


ALTER FUNCTION "public"."confirm_obligation_settlement"("p_obligation_id" character varying, "p_external_reference" character varying, "p_confirmed_amount" numeric, "p_currency" character varying, "p_provider" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."counter_offer_indrive_bid"("p_request_id" "uuid", "p_bid_id" "uuid", "p_new_counter_price" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ declare uid uuid:=auth.uid(); begin if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication_required'; end if; if p_new_counter_price is null or p_new_counter_price < 0 then raise exception 'invalid_price'; end if; update public.indrive_bids b set offered_price=p_new_counter_price,note='مزايدة مضادة من العميل بـ '||round(p_new_counter_price)::text||' ج.م 🔄' where b.id=p_bid_id and b.request_id=p_request_id and exists(select 1 from public.indrive_requests r where r.id=b.request_id and r.owner_user_id=uid and r.status not in ('COMPLETED','CANCELLED')); if not found then raise exception 'bid_not_owned_or_request_not_editable'; end if; end $$;


ALTER FUNCTION "public"."counter_offer_indrive_bid"("p_request_id" "uuid", "p_bid_id" "uuid", "p_new_counter_price" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_commission_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_rule_id" character varying, "p_order_amount" numeric, "p_commission_rate" numeric, "p_commission_amount" numeric, "p_platform_net" numeric, "p_merchant_net" numeric, "p_journal_entry" "jsonb", "p_journal_lines" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_existing public.commission_transactions%rowtype;
  v_rule public.commission_rules%rowtype;
begin
  perform public.assert_financial_membership(p_tenant_id);

  select * into v_rule from public.commission_rules
  where id=p_rule_id and tenant_id=p_tenant_id and active=true for share;
  if not found then raise exception 'COMMISSION_RULE_NOT_FOUND_OR_INACTIVE'; end if;
  if upper(coalesce(v_rule.rule_type,'PERCENTAGE')) <> 'PERCENTAGE' then raise exception 'COMMISSION_RULE_TYPE_INVALID'; end if;
  if abs(coalesce(v_rule.percentage,0) - coalesce(p_commission_rate,0)) > 0.0001 then
    raise exception 'COMMISSION_RATE_MISMATCH';
  end if;

  if p_order_amount < 0 or p_commission_amount < 0 or p_commission_rate < 0 or p_commission_rate > 100 then
    raise exception 'COMMISSION_AMOUNT_INVALID';
  end if;
  if abs(p_commission_amount - round(p_order_amount * p_commission_rate / 100,2)) > 0.01 then
    raise exception 'COMMISSION_CALCULATION_MISMATCH';
  end if;
  if p_commission_amount > p_order_amount then raise exception 'COMMISSION_EXCEEDS_ORDER'; end if;

  select * into v_existing from public.commission_transactions
  where tenant_id=p_tenant_id and order_id=p_order_id limit 1;
  if found then
    return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'commission_amount',v_existing.commission_amount,'idempotent',true);
  end if;

  perform public.post_financial_journal(p_journal_entry,p_journal_lines);

  insert into public.commission_transactions(
    id,tenant_id,business_id,order_id,rule_id,gross_amount,commission_amount,status
  ) values (
    p_id,p_tenant_id,p_business_id,p_order_id,p_rule_id,p_order_amount,p_commission_amount,'POSTED'
  );

  return jsonb_build_object('id',p_id,'status','POSTED','commission_amount',p_commission_amount,'idempotent',false);
end;
$$;


ALTER FUNCTION "public"."create_commission_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_rule_id" character varying, "p_order_amount" numeric, "p_commission_rate" numeric, "p_commission_amount" numeric, "p_platform_net" numeric, "p_merchant_net" numeric, "p_journal_entry" "jsonb", "p_journal_lines" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."education_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_user_id" "uuid" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "student_name" "text" NOT NULL,
    "subject_or_grade" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."education_requests" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."education_requests" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_education_request_backend"("p_target_id" "uuid", "p_target_type" "text", "p_student_name" "text", "p_subject_or_grade" "text") RETURNS "public"."education_requests"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_row public.education_requests;
  v_target_type text := upper(trim(coalesce(p_target_type,'')));
  v_student text := trim(coalesce(p_student_name,''));
  v_subject text := trim(coalesce(p_subject_or_grade,''));
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous'),'false')='true' then raise exception 'UNAUTHENTICATED'; end if;
  if p_target_id is null or v_target_type not in ('SCHOOL','TEACHER') then raise exception 'INVALID_EDUCATION_TARGET'; end if;
  if length(v_student)<2 or length(v_student)>200 then raise exception 'INVALID_STUDENT_NAME'; end if;
  if length(v_subject)>500 then raise exception 'INVALID_SUBJECT_OR_GRADE'; end if;
  if v_target_type='SCHOOL' and not exists(select 1 from public.school_profiles s where s.id=p_target_id and coalesce(s.is_available,true)=true) then raise exception 'EDUCATION_TARGET_NOT_AVAILABLE'; end if;
  if v_target_type='TEACHER' and not exists(select 1 from public.teacher_profiles t where t.id=p_target_id and coalesce(t.is_available,true)=true) then raise exception 'EDUCATION_TARGET_NOT_AVAILABLE'; end if;
  insert into public.education_requests(id,requester_user_id,target_id,target_type,student_name,subject_or_grade,status)
  values(gen_random_uuid(),v_uid,p_target_id,v_target_type,v_student,v_subject,'PENDING')
  returning * into v_row;
  return v_row;
end;
$$;


ALTER FUNCTION "public"."create_education_request_backend"("p_target_id" "uuid", "p_target_type" "text", "p_student_name" "text", "p_subject_or_grade" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."indrive_bids" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "provider_user_id" "uuid" NOT NULL,
    "provider_name" "text" NOT NULL,
    "provider_type" "text" NOT NULL,
    "provider_rating" numeric(3,2) DEFAULT 0 NOT NULL,
    "completed_orders_count" integer DEFAULT 0 NOT NULL,
    "offered_price" numeric(14,2) NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "estimated_delivery_time" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'OFFERED'::"text" NOT NULL,
    CONSTRAINT "indrive_bids_status_check" CHECK (("status" = ANY (ARRAY['OFFERED'::"text", 'ACCEPTED'::"text", 'REJECTED'::"text"])))
);

ALTER TABLE ONLY "public"."indrive_bids" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."indrive_bids" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_indrive_bid_backend"("p_user_id" "uuid", "p_request_id" "uuid", "p_provider_name" "text", "p_provider_type" "text", "p_offered_price" numeric, "p_note" "text", "p_estimated_delivery_time" "text") RETURNS "public"."indrive_bids"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_user uuid:=auth.uid();
  v_req public.indrive_requests;
  v_row public.indrive_bids;
begin
  if v_user is null or v_user<>p_user_id or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'authentication_required';
  end if;
  if p_offered_price is null or p_offered_price < 0 then raise exception 'invalid_price'; end if;
  select * into v_req from public.indrive_requests where id=p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if v_req.owner_user_id=v_user then raise exception 'request_owner_cannot_bid'; end if;
  if v_req.status not in ('OPEN','OPEN_FOR_BIDS','MATCHING') then raise exception 'request_not_open'; end if;

  insert into public.indrive_bids(
    id,request_id,provider_user_id,provider_name,provider_type,
    provider_rating,completed_orders_count,offered_price,note,
    estimated_delivery_time,status
  ) values (
    gen_random_uuid(),p_request_id,v_user,nullif(trim(p_provider_name),''),
    nullif(trim(p_provider_type),''),null,0,p_offered_price,
    nullif(trim(p_note),''),nullif(trim(p_estimated_delivery_time),''),'PENDING'
  ) returning * into v_row;
  return v_row;
exception
  when unique_violation then
    raise exception 'BID_ALREADY_EXISTS';
end;
$$;


ALTER FUNCTION "public"."create_indrive_bid_backend"("p_user_id" "uuid", "p_request_id" "uuid", "p_provider_name" "text", "p_provider_type" "text", "p_offered_price" numeric, "p_note" "text", "p_estimated_delivery_time" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."indrive_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "domain_type" "text" NOT NULL,
    "category_name" "text" NOT NULL,
    "title" "text" NOT NULL,
    "details_description" "text" NOT NULL,
    "user_proposed_price" numeric(14,2) DEFAULT 0 NOT NULL,
    "target_provider_type" "text" NOT NULL,
    "selected_ad_platform" "text",
    "req_location_district" "text",
    "status" "text" DEFAULT 'OPEN_FOR_BIDS'::"text" NOT NULL,
    "accepted_bid_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attachment_path" "text",
    "idempotency_key" "text"
);

ALTER TABLE ONLY "public"."indrive_requests" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."indrive_requests" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_indrive_request_backend"("p_user_id" "uuid", "p_domain_type" "text", "p_category_name" "text", "p_title" "text", "p_details_description" "text", "p_user_proposed_price" numeric, "p_target_provider_type" "text", "p_req_location_district" "text", "p_idempotency_key" "text") RETURNS "public"."indrive_requests"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_user uuid:=auth.uid();
  v_existing public.indrive_requests;
  v_row public.indrive_requests;
begin
  if v_user is null or v_user<>p_user_id or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'authentication_required';
  end if;
  if nullif(trim(p_title),'') is null or nullif(trim(p_details_description),'') is null then
    raise exception 'request_details_required';
  end if;
  if nullif(trim(p_idempotency_key),'') is null then
    raise exception 'idempotency_key_required';
  end if;
  select * into v_existing from public.indrive_requests
    where owner_user_id=v_user and idempotency_key=p_idempotency_key
    limit 1;
  if found then return v_existing; end if;

  insert into public.indrive_requests(
    id,owner_user_id,domain_type,category_name,title,details_description,
    user_proposed_price,target_provider_type,selected_ad_platform,
    req_location_district,status,idempotency_key
  ) values (
    gen_random_uuid(),v_user,upper(trim(p_domain_type)),nullif(trim(p_category_name),''),
    trim(p_title),trim(p_details_description),greatest(coalesce(p_user_proposed_price,0),0),
    nullif(trim(p_target_provider_type),''),'MNTY',nullif(trim(p_req_location_district),''),
    'OPEN_FOR_BIDS',p_idempotency_key
  ) returning * into v_row;
  return v_row;
end;
$$;


ALTER FUNCTION "public"."create_indrive_request_backend"("p_user_id" "uuid", "p_domain_type" "text", "p_category_name" "text", "p_title" "text", "p_details_description" "text", "p_user_proposed_price" numeric, "p_target_provider_type" "text", "p_req_location_district" "text", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_job_backend"("p_user_id" "uuid", "p_job_id" "text", "p_tenant_id" character varying, "p_business_id" "uuid", "p_title" "text", "p_company_name" "text", "p_category" "text", "p_location" "text", "p_job_type" "text", "p_salary_range" "text", "p_description" "text", "p_requirements" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$ declare v_role text; begin if p_user_id is null or p_user_id <> auth.uid() then raise exception 'AUTH_MISMATCH'; end if; if p_job_id is null or length(trim(p_job_id))<1 then raise exception 'JOB_ID_REQUIRED'; end if; select upper(role) into v_role from user_memberships where user_id=auth.uid() and tenant_id::text=p_tenant_id::text and business_id=p_business_id and status='ACTIVE' limit 1; if v_role is null or v_role not in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','SERVICE_PROVIDER','STAFF') then raise exception 'ACTIVE_BUSINESS_MEMBERSHIP_REQUIRED'; end if; if coalesce(trim(p_title),'')='' or coalesce(trim(p_company_name),'')='' then raise exception 'JOB_FIELDS_REQUIRED'; end if; insert into jobs(id,owner_user_id,tenant_id,business_id,title,company_name,category,location,job_type,salary_range,description,requirements,is_active) values(p_job_id,auth.uid(),p_tenant_id,p_business_id,trim(p_title),trim(p_company_name),nullif(trim(p_category),''),nullif(trim(p_location),''),nullif(trim(p_job_type),''),nullif(trim(p_salary_range),''),nullif(trim(p_description),''),nullif(trim(p_requirements),''),true); return jsonb_build_object('ok',true,'job_id',p_job_id); end; $$;


ALTER FUNCTION "public"."create_job_backend"("p_user_id" "uuid", "p_job_id" "text", "p_tenant_id" character varying, "p_business_id" "uuid", "p_title" "text", "p_company_name" "text", "p_category" "text", "p_location" "text", "p_job_type" "text", "p_salary_range" "text", "p_description" "text", "p_requirements" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_mantigo_bid_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_captain_name" "text", "p_captain_phone" "text", "p_captain_rating" numeric, "p_vehicle_category" "text", "p_vehicle_model" "text", "p_vehicle_plate" "text", "p_offered_price" numeric, "p_eta_minutes" integer, "p_captain_message" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id text:='BID-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  v_customer uuid; v_profile public.mantigo_captain_profiles%rowtype;
begin
  if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if p_offered_price is null or p_offered_price<=0 then raise exception 'PRICE_REQUIRED'; end if;
  if coalesce(p_eta_minutes,0)<0 then raise exception 'INVALID_ETA'; end if;

  select * into v_profile
  from public.mantigo_captain_profiles
  where captain_id=p_user_id
  for update;

  if not found then raise exception 'CAPTAIN_PROFILE_NOT_FOUND'; end if;
  if v_profile.status <> 'ACTIVE' then raise exception 'CAPTAIN_NOT_ACTIVE'; end if;
  if v_profile.verification_status <> 'VERIFIED' then raise exception 'CAPTAIN_NOT_VERIFIED'; end if;
  if v_profile.availability_status <> 'AVAILABLE' then raise exception 'CAPTAIN_NOT_AVAILABLE'; end if;
  if v_profile.vehicle_category is null or trim(v_profile.vehicle_category)='' then raise exception 'CAPTAIN_VEHICLE_NOT_CONFIGURED'; end if;

  select customer_id into v_customer
  from public.mantigo_rides
  where id=p_ride_id and status in ('OPEN','OPEN_FOR_BIDS')
    and vehicle_category = v_profile.vehicle_category
  for update;
  if v_customer is null then raise exception 'RIDE_NOT_OPEN_OR_VEHICLE_MISMATCH'; end if;
  if v_customer=p_user_id then raise exception 'CAPTAIN_CANNOT_BID_OWN_RIDE'; end if;

  insert into public.mantigo_bids(
    id,ride_id,captain_id,captain_name,captain_phone,captain_rating,
    vehicle_category,vehicle_model,vehicle_plate,offered_price,eta_minutes,captain_message,status
  ) values(
    v_id,p_ride_id,p_user_id,
    coalesce(nullif(trim(p_captain_name),''),'كابتن MantiGO'),
    coalesce(trim(p_captain_phone),''),
    greatest(0,coalesce(v_profile.rating,0)),
    v_profile.vehicle_category,
    coalesce(v_profile.vehicle_model,''),
    coalesce(v_profile.vehicle_plate,''),
    p_offered_price,greatest(0,coalesce(p_eta_minutes,0)),
    coalesce(trim(p_captain_message),''),'OFFERED'
  )
  on conflict (ride_id,captain_id) do update set
    captain_name=excluded.captain_name,captain_phone=excluded.captain_phone,
    captain_rating=excluded.captain_rating,vehicle_category=excluded.vehicle_category,
    vehicle_model=excluded.vehicle_model,vehicle_plate=excluded.vehicle_plate,
    offered_price=excluded.offered_price,eta_minutes=excluded.eta_minutes,
    captain_message=excluded.captain_message,status='OFFERED',created_at=now()
  returning id into v_id;

  update public.mantigo_rides set status=case when status='OPEN' then 'OPEN_FOR_BIDS' else status end,updated_at=now()
  where id=p_ride_id;

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_BID_CREATED','MANTIGO_BID',v_id,'{}'::jsonb,
    jsonb_build_object('ride_id',p_ride_id,'status','OFFERED','offered_price',p_offered_price,'vehicle_category',v_profile.vehicle_category),'SUCCESS');

  begin
    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_customer,'MANTIGO_BID','عرض جديد على رحلتك MantiGO',
      'تم استلام عرض جديد بقيمة '||to_char(p_offered_price,'FM999999990D00')||' ج.م','MANTIGO_RIDE',p_ride_id);
  exception when others then
    insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
    values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,
      jsonb_build_object('notification_type','MANTIGO_BID','error',sqlerrm),'PARTIAL');
  end;
  return jsonb_build_object('id',v_id,'status','OFFERED');
end
$$;


ALTER FUNCTION "public"."create_mantigo_bid_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_captain_name" "text", "p_captain_phone" "text", "p_captain_rating" numeric, "p_vehicle_category" "text", "p_vehicle_model" "text", "p_vehicle_plate" "text", "p_offered_price" numeric, "p_eta_minutes" integer, "p_captain_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_mantigo_ride_backend"("p_user_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_vehicle_category" "text", "p_ride_type" "text", "p_pickup_location" "text", "p_destination_location" "text", "p_proposed_price" numeric, "p_note" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_id text:='RIDE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
begin
 if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 if coalesce(trim(p_pickup_location),'')='' or coalesce(trim(p_destination_location),'')='' then raise exception 'ROUTE_REQUIRED'; end if;
 if p_proposed_price is null or p_proposed_price<=0 then raise exception 'PRICE_REQUIRED'; end if;
 insert into public.mantigo_rides(id,customer_id,customer_name,customer_phone,vehicle_category,ride_type,pickup_location,destination_location,proposed_price,note,status)
 values(v_id,p_user_id,coalesce(nullif(trim(p_customer_name),''),'عميل MantiGO'),coalesce(trim(p_customer_phone),''),trim(p_vehicle_category),trim(p_ride_type),trim(p_pickup_location),trim(p_destination_location),p_proposed_price,coalesce(p_note,''),'OPEN');
 insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
 values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_RIDE_CREATED','MANTIGO_RIDE',v_id,'{}'::jsonb,jsonb_build_object('status','OPEN','proposed_price',p_proposed_price),'SUCCESS');
 begin
   insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
   values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_CREATED','تم إنشاء طلب الرحلة','تم إنشاء طلب رحلتك بنجاح.','MANTIGO_RIDE',v_id);
 exception when others then
   insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
   values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',v_id,'{}'::jsonb,jsonb_build_object('notification_type','MANTIGO_CREATED','error',sqlerrm),'PARTIAL');
 end;
 return jsonb_build_object('id',v_id,'status','OPEN');
end $$;


ALTER FUNCTION "public"."create_mantigo_ride_backend"("p_user_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_vehicle_category" "text", "p_ride_type" "text", "p_pickup_location" "text", "p_destination_location" "text", "p_proposed_price" numeric, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_mantigo_ride_backend_v2"("p_user_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_vehicle_category" "text", "p_ride_type" "text", "p_pickup_location" "text", "p_destination_location" "text", "p_proposed_price" numeric, "p_note" "text", "p_idempotency_key" "text", "p_pickup_lat" double precision DEFAULT NULL::double precision, "p_pickup_lon" double precision DEFAULT NULL::double precision, "p_destination_lat" double precision DEFAULT NULL::double precision, "p_destination_lon" double precision DEFAULT NULL::double precision) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_existing public.mantigo_rides%rowtype;
  v_id text:='RIDE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
begin
  if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if coalesce(trim(p_idempotency_key),'')='' then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if coalesce(trim(p_pickup_location),'')='' or coalesce(trim(p_destination_location),'')='' then raise exception 'ROUTE_REQUIRED'; end if;
  if p_proposed_price is null or p_proposed_price<=0 then raise exception 'PRICE_REQUIRED'; end if;
  if (p_pickup_lat is not null and (p_pickup_lat < -90 or p_pickup_lat > 90))
     or (p_pickup_lon is not null and (p_pickup_lon < -180 or p_pickup_lon > 180))
     or (p_destination_lat is not null and (p_destination_lat < -90 or p_destination_lat > 90))
     or (p_destination_lon is not null and (p_destination_lon < -180 or p_destination_lon > 180))
  then raise exception 'INVALID_COORDINATES'; end if;

  select * into v_existing
  from public.mantigo_rides
  where customer_id=p_user_id and idempotency_key=trim(p_idempotency_key)
  limit 1;

  if found then
    return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'idempotent_replay',true);
  end if;

  insert into public.mantigo_rides(
    id,customer_id,customer_name,customer_phone,vehicle_category,ride_type,
    pickup_location,destination_location,proposed_price,note,status,
    idempotency_key,pickup_lat,pickup_lon,destination_lat,destination_lon
  ) values (
    v_id,p_user_id,coalesce(nullif(trim(p_customer_name),''),'عميل MantiGO'),
    coalesce(trim(p_customer_phone),''),trim(p_vehicle_category),trim(p_ride_type),
    trim(p_pickup_location),trim(p_destination_location),p_proposed_price,coalesce(p_note,''),
    'OPEN',trim(p_idempotency_key),p_pickup_lat,p_pickup_lon,p_destination_lat,p_destination_lon
  )
  on conflict (customer_id,idempotency_key) where idempotency_key is not null do nothing;

  select * into v_existing from public.mantigo_rides
  where customer_id=p_user_id and idempotency_key=trim(p_idempotency_key)
  limit 1;

  if v_existing.id<>v_id then
    return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'idempotent_replay',true);
  end if;

  insert into public.audit_logs(
    id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result
  ) values(
    'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,
    'MANTIGO_RIDE_CREATED','MANTIGO_RIDE',v_id,'{}'::jsonb,
    jsonb_build_object('status','OPEN','proposed_price',p_proposed_price,'idempotency_key',trim(p_idempotency_key)),
    'SUCCESS'
  );

  return jsonb_build_object('id',v_id,'status','OPEN','idempotent_replay',false);
end $$;


ALTER FUNCTION "public"."create_mantigo_ride_backend_v2"("p_user_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_vehicle_category" "text", "p_ride_type" "text", "p_pickup_location" "text", "p_destination_location" "text", "p_proposed_price" numeric, "p_note" "text", "p_idempotency_key" "text", "p_pickup_lat" double precision, "p_pickup_lon" double precision, "p_destination_lat" double precision, "p_destination_lon" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_medical_appointment_backend"("p_user_id" "uuid", "p_appointment_id" "text", "p_business_id" "uuid", "p_doctor_id" "text", "p_date_time" bigint, "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_tenant varchar;
  v_status text;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'AUTH_USER_MISMATCH';
  end if;
  if p_appointment_id is null or length(trim(p_appointment_id)) < 8 then
    raise exception 'INVALID_APPOINTMENT_ID';
  end if;
  if p_business_id is null or p_doctor_id is null or p_date_time is null then
    raise exception 'INVALID_APPOINTMENT';
  end if;
  select b.tenant_id into v_tenant
  from public.businesses b
  join public.marketing_provider_profiles mp on mp.business_id=b.id
  where b.id=p_business_id and mp.id::text=p_doctor_id and mp.status='ACTIVE'
  limit 1;
  if v_tenant is null then raise exception 'ACTIVE_MEDICAL_PROVIDER_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.user_memberships um
    where um.user_id=p_user_id and um.tenant_id=v_tenant and um.status='ACTIVE'
  ) then raise exception 'ACTIVE_TENANT_MEMBERSHIP_REQUIRED'; end if;
  if exists (select 1 from public.medical_appointments where id=p_appointment_id) then
    raise exception 'APPOINTMENT_ID_ALREADY_EXISTS';
  end if;
  if exists (
    select 1 from public.medical_appointments
    where doctor_id=p_doctor_id and date_time=p_date_time and status not in ('CANCELLED','COMPLETED')
  ) then
    raise exception 'DOCTOR_SLOT_UNAVAILABLE';
  end if;
  insert into public.medical_appointments(id,tenant_id,business_id,patient_id,doctor_id,date_time,status,reason)
  values(p_appointment_id,v_tenant,p_business_id,p_user_id,p_doctor_id,p_date_time,'BOOKED',nullif(trim(p_reason),''));
  return jsonb_build_object('id',p_appointment_id,'status','BOOKED');
end;
$$;


ALTER FUNCTION "public"."create_medical_appointment_backend"("p_user_id" "uuid", "p_appointment_id" "text", "p_business_id" "uuid", "p_doctor_id" "text", "p_date_time" bigint, "p_reason" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" character varying NOT NULL,
    "tenant_id" character varying NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" character varying DEFAULT 'GENERAL'::character varying NOT NULL,
    "title" character varying NOT NULL,
    "body" "text" NOT NULL,
    "entity_type" character varying,
    "entity_id" character varying,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."notifications" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification_backend"("p_id" character varying, "p_tenant_id" character varying, "p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_body" "text", "p_entity_type" character varying DEFAULT NULL::character varying, "p_entity_id" character varying DEFAULT NULL::character varying) RETURNS "public"."notifications"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_row public.notifications;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists (
   select 1 from public.user_memberships m
   where m.user_id=auth.uid() and m.tenant_id=p_tenant_id and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
 ) and not public.is_platform_admin() then
   raise exception 'TENANT_ACCESS_DENIED';
 end if;
 if not exists (
   select 1 from public.user_memberships m
   where m.user_id=p_user_id and m.tenant_id=p_tenant_id and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
 ) then
   raise exception 'RECIPIENT_NOT_IN_TENANT';
 end if;
 insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id,created_at)
 values(p_id,p_tenant_id,p_user_id,p_type,p_title,p_body,p_entity_type,p_entity_id,now())
 returning * into v_row;
 return v_row;
end;
$$;


ALTER FUNCTION "public"."create_notification_backend"("p_id" character varying, "p_tenant_id" character varying, "p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_body" "text", "p_entity_type" character varying, "p_entity_id" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_order_backend"("p_order_id" "uuid", "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_customer_id" "uuid", "p_client_idempotency_key" character varying, "p_subtotal" numeric, "p_discount" numeric, "p_tax" numeric, "p_delivery_fee" numeric, "p_total_amount" numeric, "p_currency" character varying, "p_customer_name" "text", "p_customer_phone" "text", "p_delivery_address" "text", "p_items_json" "jsonb", "p_notes" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ declare v_existing orders; v_settings catalog_business_settings; v_currency varchar; v_subtotal numeric:=0; v_tax numeric:=0; v_total numeric:=0; v_delivery numeric:=0; v_discount numeric:=0; v_snapshot jsonb:='[]'; v_item jsonb; v_ci catalog_items; v_price catalog_item_prices; v_opt_total numeric; v_opt_count int; v_requested_opts int; v_qty numeric; v_line numeric; v_line_tax numeric; v_token text; v_hash text; v_pricing_version bigint:=0; v_customer_member boolean:=false; begin if p_customer_id is null or auth.uid() is null or auth.uid()<>p_customer_id then raise exception 'CUSTOMER_REQUIRED'; end if; if p_tenant_id is null or p_tenant_id='' or p_business_id is null or p_client_idempotency_key is null or length(trim(p_client_idempotency_key))<8 then raise exception 'INVALID_ORDER_REQUEST'; end if; if p_items_json is null or jsonb_typeof(p_items_json)<>'array' or jsonb_array_length(p_items_json)=0 then raise exception 'INVALID_ITEMS'; end if; select exists(select 1 from user_memberships m where m.user_id=p_customer_id and m.tenant_id=p_tenant_id and coalesce(m.status,'ACTIVE')='ACTIVE') into v_customer_member; if not v_customer_member and not exists(select 1 from user_memberships m where m.user_id=p_customer_id and coalesce(m.status,'ACTIVE')='ACTIVE' and upper(m.role)='CUSTOMER') then raise exception 'CUSTOMER_MEMBERSHIP_REQUIRED'; end if; if not exists(select 1 from businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id and coalesce(b.status,'ACTIVE')='ACTIVE') then raise exception 'BUSINESS_TENANT_MISMATCH'; end if; if not exists(select 1 from marketing_provider_profiles pp where pp.business_id=p_business_id and pp.status='ACTIVE') then raise exception 'PROVIDER_NOT_AVAILABLE'; end if; if p_branch_id is not null and not exists(select 1 from branches br where br.id=p_branch_id and br.business_id=p_business_id and br.tenant_id=p_tenant_id and coalesce(br.status,'ACTIVE')='ACTIVE') then raise exception 'BRANCH_BUSINESS_MISMATCH'; end if; select * into v_existing from orders where tenant_id=p_tenant_id and client_idempotency_key=trim(p_client_idempotency_key) for update; if found then return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'total_amount',v_existing.total_amount,'currency',v_existing.currency,'pricing_version',v_existing.pricing_version,'pricing_hash',v_existing.pricing_hash,'pricing_snapshot',v_existing.pricing_snapshot,'idempotent',true); end if; select * into v_settings from catalog_business_settings where business_id=p_business_id; if not found then insert into catalog_business_settings(business_id,tenant_id) values(p_business_id,p_tenant_id) on conflict (business_id) do nothing; select * into v_settings from catalog_business_settings where business_id=p_business_id; end if; v_currency:=upper(coalesce(v_settings.currency,p_currency,'EGP')); v_delivery:=v_settings.delivery_fee; for v_item in select value from jsonb_array_elements(p_items_json) loop v_token:=coalesce(nullif(v_item->>'catalogItemId',''),nullif(v_item->>'productId','')); if v_token is null then raise exception 'CATALOG_ITEM_REQUIRED'; end if; select * into v_ci from catalog_items ci where ci.tenant_id=p_tenant_id and ci.business_id=p_business_id and ci.status='ACTIVE' and (ci.id::text=v_token or ci.legacy_ref=v_token) and (ci.branch_id is null or ci.branch_id=p_branch_id) order by (ci.branch_id is not null) desc limit 1; if not found then raise exception 'CATALOG_ITEM_NOT_FOUND:%',v_token; end if; v_qty:=coalesce(nullif(v_item->>'quantity','')::numeric,0); if v_qty<=0 or v_qty>10000 then raise exception 'INVALID_QUANTITY'; end if; select * into v_price from catalog_item_prices cp where cp.catalog_item_id=v_ci.id and cp.tenant_id=p_tenant_id and cp.status='ACTIVE' and cp.effective_from<=now() and (cp.effective_to is null or cp.effective_to>now()) and (cp.branch_id is null or cp.branch_id=p_branch_id) order by (cp.branch_id is not null) desc,cp.effective_from desc,cp.version desc limit 1; if not found then raise exception 'CATALOG_PRICE_NOT_FOUND:%',v_ci.id; end if; select coalesce(sum(o.price_delta),0),count(o.id) into v_opt_total,v_opt_count from catalog_item_options o where o.catalog_item_id=v_ci.id and o.status='ACTIVE' and o.id::text in (select jsonb_array_elements_text(coalesce(v_item->'selectedOptionIds','[]'::jsonb))); v_requested_opts:=jsonb_array_length(coalesce(v_item->'selectedOptionIds','[]'::jsonb)); if v_opt_count<>v_requested_opts then raise exception 'INVALID_ITEM_OPTIONS'; end if; v_line:=round((v_price.unit_price+v_opt_total)*v_qty,2); v_line_tax:=case when v_settings.tax_inclusive then 0 else round(v_line*v_ci.tax_rate/100,2) end; v_subtotal:=v_subtotal+v_line; v_tax:=v_tax+v_line_tax; v_pricing_version:=greatest(v_pricing_version,v_price.version); v_snapshot:=v_snapshot||jsonb_build_array(jsonb_build_object('catalog_item_id',v_ci.id,'legacy_ref',v_ci.legacy_ref,'name_ar',v_ci.name_ar,'quantity',v_qty,'unit_price',v_price.unit_price,'option_total',v_opt_total,'tax_rate',v_ci.tax_rate,'line_subtotal',v_line,'line_tax',v_line_tax,'price_version',v_price.version,'price_effective_from',v_price.effective_from,'branch_id',v_price.branch_id)); end loop; v_total:=round(v_subtotal-v_discount+v_tax+v_delivery,2); v_hash:=encode(digest(v_snapshot::text||'|'||v_currency||'|'||v_total::text||'|'||v_delivery::text||'|'||v_tax::text||'|'||v_discount::text,'sha256'),'hex'); insert into orders(id,tenant_id,business_id,branch_id,customer_id,status,subtotal,discount,tax,delivery_fee,total_amount,currency,customer_name,customer_phone,delivery_address,items_json,notes,metadata,client_idempotency_key,pricing_version,pricing_snapshot,pricing_hash,pricing_authority) values(p_order_id,p_tenant_id,p_business_id,p_branch_id,p_customer_id,'PENDING',v_subtotal,v_discount,v_tax,v_delivery,v_total,v_currency,p_customer_name,p_customer_phone,p_delivery_address,v_snapshot,p_notes,coalesce(p_metadata,'{}')||jsonb_build_object('pricing_server_authoritative',true),trim(p_client_idempotency_key),v_pricing_version,v_snapshot,v_hash,'catalog_v1'); return jsonb_build_object('id',p_order_id,'status','PENDING','subtotal',v_subtotal,'discount',v_discount,'tax',v_tax,'delivery_fee',v_delivery,'total_amount',v_total,'currency',v_currency,'pricing_version',v_pricing_version,'pricing_hash',v_hash,'pricing_snapshot',v_snapshot,'idempotent',false); end $$;


ALTER FUNCTION "public"."create_order_backend"("p_order_id" "uuid", "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_customer_id" "uuid", "p_client_idempotency_key" character varying, "p_subtotal" numeric, "p_discount" numeric, "p_tax" numeric, "p_delivery_fee" numeric, "p_total_amount" numeric, "p_currency" character varying, "p_customer_name" "text", "p_customer_phone" "text", "p_delivery_address" "text", "p_items_json" "jsonb", "p_notes" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_payment_intent_backend"("p_tenant_id" character varying, "p_order_id" "uuid", "p_amount" numeric, "p_currency" character varying, "p_provider" character varying, "p_payment_method" character varying, "p_idempotency_key" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_id varchar;
  v_order orders%rowtype;
  v_uid uuid := auth.uid();
  v_existing payment_intents%rowtype;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous'),'false')='true' then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_order from orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.tenant_id<>p_tenant_id then raise exception 'TENANT_MISMATCH'; end if;

  if upper(coalesce(v_order.status,'')) not in ('PENDING','CREATED') then
    raise exception 'ORDER_NOT_PAYABLE';
  end if;

  -- Marketplace customers may pay their own order across provider tenants.
  -- Non-customer actors must have active membership in the order tenant/business.
  if v_order.customer_id is distinct from v_uid
     and not exists(
       select 1 from user_memberships m
       where m.user_id=v_uid
         and m.tenant_id=p_tenant_id
         and m.status='ACTIVE'
         and (m.business_id=v_order.business_id or m.business_id is null)
     )
  then
    raise exception 'TENANT_ACCESS_DENIED';
  end if;

  if v_order.customer_id is not null and v_order.customer_id<>v_uid and not exists(
    select 1 from user_memberships m
    where m.user_id=v_uid and m.tenant_id=p_tenant_id and m.status='ACTIVE'
      and m.role in ('OWNER','ADMIN','MANAGER','FINANCE','ACCOUNTANT','FINANCE_MANAGER')
  ) then
    raise exception 'ORDER_ACCESS_DENIED';
  end if;

  if v_order.pricing_hash is null or v_order.pricing_version is null or v_order.pricing_authority is null then
    raise exception 'PRICING_SNAPSHOT_REQUIRED';
  end if;
  if p_amount<=0 or abs(p_amount-v_order.total_amount)>0.01 or abs(p_amount-v_order.total)>0.01 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if upper(coalesce(p_currency,''))<>upper(v_order.currency) then raise exception 'INVALID_CURRENCY'; end if;
  if p_provider is null or length(trim(p_provider))=0 then raise exception 'INVALID_PROVIDER'; end if;
  if p_payment_method is null or length(trim(p_payment_method))=0 then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key))=0 or length(p_idempotency_key)>200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  select * into v_existing
  from payment_intents
  where tenant_id=p_tenant_id and idempotency_key=trim(p_idempotency_key)
  for update;

  if found then
    if v_existing.order_id<>p_order_id
       or abs(v_existing.amount-v_order.total_amount)>0.01
       or upper(v_existing.currency)<>upper(v_order.currency)
       or v_existing.pricing_hash<>v_order.pricing_hash
    then raise exception 'IDEMPOTENCY_CONFLICT'; end if;

    return jsonb_build_object(
      'id',v_existing.id,'status',v_existing.status,'amount',v_existing.amount,
      'currency',v_existing.currency,'pricing_version',v_existing.pricing_version,
      'pricing_hash',v_existing.pricing_hash,'idempotent',true
    );
  end if;

  insert into payment_intents(
    id,tenant_id,order_id,amount,currency,status,provider,payment_method,
    idempotency_key,pricing_version,pricing_hash
  )
  values(
    gen_random_uuid()::text,p_tenant_id,p_order_id,v_order.total_amount,v_order.currency,
    'CREATED',p_provider,p_payment_method,trim(p_idempotency_key),
    v_order.pricing_version,v_order.pricing_hash
  )
  returning id into v_id;

  return jsonb_build_object(
    'id',v_id,'status','CREATED','amount',v_order.total_amount,'currency',v_order.currency,
    'pricing_version',v_order.pricing_version,'pricing_hash',v_order.pricing_hash,'idempotent',false
  );
end
$$;


ALTER FUNCTION "public"."create_payment_intent_backend"("p_tenant_id" character varying, "p_order_id" "uuid", "p_amount" numeric, "p_currency" character varying, "p_provider" character varying, "p_payment_method" character varying, "p_idempotency_key" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_payment_obligations"("p_id_prefix" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_payment_intent_id" character varying, "p_gross_amount" numeric, "p_commission_amount" numeric, "p_provider_id" character varying, "p_currency" character varying, "p_payment_method" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_commission_id varchar := p_id_prefix || '_PLATFORM';
  v_payout_id varchar := p_id_prefix || '_PROVIDER';
begin
  perform public.assert_financial_membership(p_tenant_id);
  if p_gross_amount < 0 or p_commission_amount < 0 or p_commission_amount > p_gross_amount then
    raise exception 'INVALID_PAYMENT_OBLIGATION_AMOUNTS';
  end if;
  if coalesce(length(trim(p_provider_id)),0)=0 then raise exception 'PROVIDER_ID_REQUIRED'; end if;

  insert into public.financial_obligations(
    id,tenant_id,business_id,order_id,payment_intent_id,beneficiary_type,beneficiary_id,
    obligation_type,gross_amount,amount,currency,status,payment_method,metadata
  ) values (
    v_commission_id,p_tenant_id,p_business_id,p_order_id,p_payment_intent_id,
    'PLATFORM','PLATFORM','PLATFORM_COMMISSION',p_gross_amount,p_commission_amount,
    coalesce(p_currency,'EGP'),'DUE',p_payment_method,'{"settlement_mode":"SPLIT_OR_PROVIDER_CONFIRMATION"}'::jsonb
  ) on conflict(id) do nothing;

  insert into public.financial_obligations(
    id,tenant_id,business_id,order_id,payment_intent_id,beneficiary_type,beneficiary_id,
    obligation_type,gross_amount,amount,currency,status,payment_method,metadata
  ) values (
    v_payout_id,p_tenant_id,p_business_id,p_order_id,p_payment_intent_id,
    'PROVIDER',p_provider_id,'PROVIDER_PAYOUT',p_gross_amount,p_gross_amount-p_commission_amount,
    coalesce(p_currency,'EGP'),'DUE',p_payment_method,'{"settlement_mode":"SPLIT_OR_PROVIDER_CONFIRMATION"}'::jsonb
  ) on conflict(id) do nothing;

  return jsonb_build_object(
    'commission_obligation',v_commission_id,
    'provider_payout_obligation',v_payout_id,
    'commission_amount',p_commission_amount,
    'provider_net',p_gross_amount-p_commission_amount
  );
end;
$$;


ALTER FUNCTION "public"."create_payment_obligations"("p_id_prefix" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_payment_intent_id" character varying, "p_gross_amount" numeric, "p_commission_amount" numeric, "p_provider_id" character varying, "p_currency" character varying, "p_payment_method" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_purchase_order_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_order_number" character varying, "p_supplier_id" character varying, "p_total_amount" numeric, "p_tax_amount" numeric, "p_discount_amount" numeric, "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE u uuid:=auth.uid(); r text; rowj jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF coalesce(length(trim(p_id)),0)<8 OR coalesce(length(trim(p_order_number)),0)<1 OR p_total_amount<0 OR p_tax_amount<0 OR p_discount_amount<0 THEN RAISE EXCEPTION 'INVALID_PURCHASE_ORDER'; END IF;
 SELECT role INTO r FROM user_memberships WHERE user_id=u AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE' LIMIT 1;
 IF r IS NULL OR upper(r) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF') THEN RAISE EXCEPTION 'PURCHASE_ORDER_ROLE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM businesses WHERE id=p_business_id AND tenant_id=p_tenant_id AND status='ACTIVE') THEN RAISE EXCEPTION 'BUSINESS_INVALID'; END IF;
 IF p_branch_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM branches WHERE id=p_branch_id AND business_id=p_business_id) THEN RAISE EXCEPTION 'BRANCH_INVALID'; END IF;
 INSERT INTO erp_purchase_orders(id,tenant_id,business_id,branch_id,order_number,supplier_id,total_amount,tax_amount,discount_amount,status,reason,created_by)
 VALUES(p_id,p_tenant_id,p_business_id,p_branch_id,p_order_number,p_supplier_id,p_total_amount,p_tax_amount,p_discount_amount,'DRAFT',p_reason,u)
 ON CONFLICT(id) DO NOTHING;
 SELECT to_jsonb(x) INTO rowj FROM erp_purchase_orders x WHERE x.id=p_id;
 RETURN jsonb_build_object('success',true,'order',rowj);
END; $$;


ALTER FUNCTION "public"."create_purchase_order_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_order_number" character varying, "p_supplier_id" character varying, "p_total_amount" numeric, "p_tax_amount" numeric, "p_discount_amount" numeric, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_settlement_and_post_journal"("p_id" character varying, "p_tenant_id" character varying, "p_beneficiary_type" character varying, "p_beneficiary_id" character varying, "p_gross" numeric, "p_platform_fee" numeric, "p_net" numeric, "p_voucher" numeric, "p_channel" character varying, "p_reference_id" character varying, "p_business_id" "uuid" DEFAULT NULL::"uuid", "p_description" "text" DEFAULT NULL::"text", "p_actor_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_existing public.settlement_transactions%rowtype;
  v_je_id varchar := 'je_' || p_id;
  v_account_2010 varchar;
  v_account_1020 varchar;
  v_account_2050 varchar;
  v_account_5030 varchar;
  v_total numeric;
  v_line_count integer := 0;
  v_role varchar;
begin
  if p_actor_user_id is null then raise exception 'ACTOR_REQUIRED'; end if;

  select role into v_role
  from public.user_memberships
  where user_id=p_actor_user_id
    and tenant_id=p_tenant_id
    and status='ACTIVE'
  order by created_at asc
  limit 1;

  if v_role is null then raise exception 'TENANT_ACCESS_DENIED'; end if;
  if upper(v_role) not in ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','ACCOUNTANT','FINANCE_MANAGER','FINANCE') then
    raise exception 'FINANCE_ROLE_REQUIRED';
  end if;

  if p_id is null or p_id='' or p_tenant_id is null or p_tenant_id='' then raise exception 'SETTLEMENT_ID_AND_TENANT_REQUIRED'; end if;
  if p_beneficiary_type not in ('PARTNER','MERCHANT') then raise exception 'INVALID_BENEFICIARY_TYPE'; end if;
  if p_beneficiary_id is null or p_beneficiary_id='' then raise exception 'BENEFICIARY_REQUIRED'; end if;
  if p_gross < 0 or p_platform_fee < 0 or p_net < 0 or p_voucher < 0 then raise exception 'INVALID_SETTLEMENT_AMOUNT'; end if;
  if round(p_gross,2) <> round(p_platform_fee+p_net+p_voucher,2) then raise exception 'SETTLEMENT_BREAKDOWN_MISMATCH'; end if;
  if p_beneficiary_type='PARTNER' and round(p_net+p_voucher,2)<>round(p_gross,2) then raise exception 'PARTNER_SETTLEMENT_MUST_EQUAL_GROSS'; end if;
  if p_beneficiary_type='MERCHANT' and p_voucher<>0 then raise exception 'MERCHANT_VOUCHER_MUST_BE_ZERO'; end if;

  select * into v_existing from public.settlement_transactions where id=p_id for update;
  if found and v_existing.status='SETTLED' and v_existing.journal_entry_id is not null then
    return jsonb_build_object('id',p_id,'status',v_existing.status,'journalEntryId',v_existing.journal_entry_id,'idempotent',true);
  end if;

  select id into v_account_2010 from public.chart_of_accounts where tenant_id=p_tenant_id and account_code='2010' and is_active=true limit 1;
  select id into v_account_1020 from public.chart_of_accounts where tenant_id=p_tenant_id and account_code='1020' and is_active=true limit 1;
  select id into v_account_2050 from public.chart_of_accounts where tenant_id=p_tenant_id and account_code='2050' and is_active=true limit 1;
  select id into v_account_5030 from public.chart_of_accounts where tenant_id=p_tenant_id and account_code='5030' and is_active=true limit 1;
  if v_account_1020 is null then raise exception 'COA_1020_MISSING'; end if;
  if p_beneficiary_type='MERCHANT' and v_account_2010 is null then raise exception 'COA_2010_MISSING'; end if;
  if p_beneficiary_type='PARTNER' and (v_account_2050 is null or v_account_5030 is null) then raise exception 'COA_PARTNER_ACCOUNTS_MISSING'; end if;

  v_total := case when p_beneficiary_type='PARTNER' then p_gross else p_net end;
  if v_total<=0 then raise exception 'SETTLEMENT_TOTAL_MUST_BE_POSITIVE'; end if;

  insert into public.journal_entries(
    id,tenant_id,organization_id,business_id,branch_id,entry_number,reference_type,reference_id,
    description,status,total_debit,total_credit,entry_date,posted_at,created_by
  )
  values(
    v_je_id,p_tenant_id,null,p_business_id,null,'JE-'||p_id,
    case when p_beneficiary_type='PARTNER' then 'PARTNER_COMMISSION_SETTLEMENT' else 'ORDER_SETTLEMENT' end,
    coalesce(p_reference_id,p_id),coalesce(p_description,'Atomic settlement '||p_id),'DRAFT',
    0,0,current_date,null,p_actor_user_id
  )
  on conflict(id) do nothing;

  if p_beneficiary_type='PARTNER' then
    insert into public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description) values
      ('jel_'||p_id||'_5030',v_je_id,v_account_5030,1,p_gross,0,'Partner commission expense'),
      ('jel_'||p_id||'_1020',v_je_id,v_account_1020,2,0,p_net,'Partner cash payout'),
      ('jel_'||p_id||'_2050',v_je_id,v_account_2050,3,0,p_voucher,'Partner voucher reserve')
    on conflict(id) do nothing;
    v_line_count:=3;
  else
    insert into public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description) values
      ('jel_'||p_id||'_2010',v_je_id,v_account_2010,1,p_net,0,'Close merchant payable'),
      ('jel_'||p_id||'_1020',v_je_id,v_account_1020,2,0,p_net,'Merchant cash payout')
    on conflict(id) do nothing;
    v_line_count:=2;
  end if;

  update public.journal_entries
  set status='POSTED', total_debit=v_total, total_credit=v_total, posted_at=now()
  where id=v_je_id;

  if not exists (
    select 1 from public.general_ledger gl
    where gl.journal_entry_id=v_je_id
  ) then
    raise exception 'GENERAL_LEDGER_POSTING_FAILED';
  end if;

  if v_existing.id is null then
    insert into public.settlement_transactions(
      id,tenant_id,beneficiary_type,beneficiary_id,gross_amount,platform_fee,net_payout,voucher_reserve,
      payout_channel,journal_entry_id,status,reference_id
    )
    values(
      p_id,p_tenant_id,p_beneficiary_type,p_beneficiary_id,p_gross,p_platform_fee,p_net,p_voucher,
      coalesce(p_channel,'BANK_TRANSFER'),v_je_id,'SETTLED',p_reference_id
    );
  else
    update public.settlement_transactions
    set gross_amount=p_gross,platform_fee=p_platform_fee,net_payout=p_net,voucher_reserve=p_voucher,
        payout_channel=coalesce(p_channel,payout_channel),journal_entry_id=v_je_id,status='SETTLED',reference_id=p_reference_id
    where id=p_id;
  end if;

  return jsonb_build_object('id',p_id,'status','SETTLED','journalEntryId',v_je_id,'lineCount',v_line_count,'idempotent',false);
end;
$$;


ALTER FUNCTION "public"."create_settlement_and_post_journal"("p_id" character varying, "p_tenant_id" character varying, "p_beneficiary_type" character varying, "p_beneficiary_id" character varying, "p_gross" numeric, "p_platform_fee" numeric, "p_net" numeric, "p_voucher" numeric, "p_channel" character varying, "p_reference_id" character varying, "p_business_id" "uuid", "p_description" "text", "p_actor_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_settlement_backend"("p_id" character varying, "p_tenant_id" character varying, "p_beneficiary_type" character varying, "p_beneficiary_id" character varying, "p_gross" numeric, "p_platform_fee" numeric, "p_net" numeric, "p_voucher" numeric, "p_channel" character varying, "p_reference_id" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_existing public.settlement_transactions%ROWTYPE;
BEGIN
 PERFORM public.assert_financial_membership(p_tenant_id);
 IF p_id IS NULL OR p_id='' OR p_tenant_id IS NULL OR p_tenant_id='' THEN RAISE EXCEPTION 'SETTLEMENT_ID_AND_TENANT_REQUIRED'; END IF;
 IF p_beneficiary_type IS NULL OR p_beneficiary_type='' OR p_beneficiary_id IS NULL OR p_beneficiary_id='' THEN RAISE EXCEPTION 'BENEFICIARY_REQUIRED'; END IF;
 IF p_gross < 0 OR p_platform_fee < 0 OR p_net < 0 OR p_voucher < 0 THEN RAISE EXCEPTION 'INVALID_SETTLEMENT_AMOUNT'; END IF;
 IF round(p_gross,2) <> round(p_platform_fee + p_net + p_voucher,2) THEN RAISE EXCEPTION 'SETTLEMENT_BREAKDOWN_MISMATCH'; END IF;
 SELECT * INTO v_existing FROM public.settlement_transactions WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
   IF v_existing.tenant_id<>p_tenant_id OR v_existing.beneficiary_id<>p_beneficiary_id
      OR v_existing.gross_amount<>p_gross OR v_existing.platform_fee<>p_platform_fee
      OR v_existing.net_payout<>p_net OR v_existing.voucher_reserve<>p_voucher THEN
      RAISE EXCEPTION 'SETTLEMENT_ID_REPLAY_MISMATCH';
   END IF;
   RETURN jsonb_build_object('id',p_id,'status',v_existing.status,'idempotent',true);
 END IF;
 INSERT INTO public.settlement_transactions(id,tenant_id,beneficiary_type,beneficiary_id,gross_amount,platform_fee,net_payout,voucher_reserve,payout_channel,status,reference_id)
 VALUES(p_id,p_tenant_id,p_beneficiary_type,p_beneficiary_id,p_gross,p_platform_fee,p_net,p_voucher,COALESCE(p_channel,'BANK_TRANSFER'),'PENDING',p_reference_id);
 RETURN jsonb_build_object('id',p_id,'status','PENDING','idempotent',false);
END; $$;


ALTER FUNCTION "public"."create_settlement_backend"("p_id" character varying, "p_tenant_id" character varying, "p_beneficiary_type" character varying, "p_beneficiary_id" character varying, "p_gross" numeric, "p_platform_fee" numeric, "p_net" numeric, "p_voucher" numeric, "p_channel" character varying, "p_reference_id" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_stock_transfer_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_transfer_number" character varying, "p_from_warehouse_id" character varying, "p_to_warehouse_id" character varying, "p_product_id" "uuid", "p_quantity" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_user uuid:=auth.uid(); v_role text; v_row jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF p_quantity IS NULL OR p_quantity<=0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
 IF coalesce(length(trim(p_id)),0)<8 OR coalesce(length(trim(p_transfer_number)),0)<1 THEN RAISE EXCEPTION 'INVALID_TRANSFER_ID'; END IF;
 SELECT role INTO v_role FROM user_memberships WHERE user_id=v_user AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE' LIMIT 1;
 IF v_role IS NULL OR upper(v_role) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF') THEN RAISE EXCEPTION 'ERP_INVENTORY_ROLE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM warehouses WHERE id=p_from_warehouse_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE') THEN RAISE EXCEPTION 'SOURCE_WAREHOUSE_INVALID'; END IF;
 IF NOT EXISTS(SELECT 1 FROM warehouses WHERE id=p_to_warehouse_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE') THEN RAISE EXCEPTION 'TARGET_WAREHOUSE_INVALID'; END IF;
 IF p_from_warehouse_id=p_to_warehouse_id THEN RAISE EXCEPTION 'SAME_WAREHOUSE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM catalog_items WHERE id=p_product_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE') THEN RAISE EXCEPTION 'PRODUCT_INVALID'; END IF;
 INSERT INTO erp_stock_transfers(id,tenant_id,business_id,transfer_number,from_warehouse_id,to_warehouse_id,product_id,quantity,status,created_by)
 VALUES(p_id,p_tenant_id,p_business_id,p_transfer_number,p_from_warehouse_id,p_to_warehouse_id,p_product_id,p_quantity,'REQUESTED',v_user)
 ON CONFLICT (id) DO NOTHING;
 SELECT to_jsonb(t) INTO v_row FROM erp_stock_transfers t WHERE t.id=p_id;
 RETURN jsonb_build_object('success',true,'transfer',v_row);
END; $$;


ALTER FUNCTION "public"."create_stock_transfer_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_transfer_number" character varying, "p_from_warehouse_id" character varying, "p_to_warehouse_id" character varying, "p_product_id" "uuid", "p_quantity" numeric) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_payment_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "tier_code" "text" NOT NULL,
    "billing_cycle" "text" NOT NULL,
    "sector" "text",
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'EGP'::"text" NOT NULL,
    "status" "text" DEFAULT 'CREATED'::"text" NOT NULL,
    "provider" "text" DEFAULT 'PAYMOB'::"text" NOT NULL,
    "provider_intent_id" "text",
    "provider_order_id" "text",
    "provider_transaction_id" "text",
    "idempotency_key" "text" NOT NULL,
    "pricing_hash" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '01:00:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "subscription_payment_intents_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "subscription_payment_intents_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['MONTHLY'::"text", 'ANNUAL'::"text"]))),
    CONSTRAINT "subscription_payment_intents_currency_check" CHECK (("currency" = 'EGP'::"text")),
    CONSTRAINT "subscription_payment_intents_status_check" CHECK (("status" = ANY (ARRAY['CREATED'::"text", 'PENDING'::"text", 'SUCCEEDED'::"text", 'FAILED'::"text", 'CANCELLED'::"text", 'PAID_PENDING_LEGAL'::"text", 'EXPIRED'::"text"])))
);

ALTER TABLE ONLY "public"."subscription_payment_intents" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_payment_intents" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_subscription_payment_intent_backend"("p_business_id" "uuid", "p_tier_code" "text", "p_billing_cycle" "text", "p_sector" "text", "p_idempotency_key" "text", "p_actor_user_id" "uuid") RETURNS "public"."subscription_payment_intents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v public.subscription_payment_intents; v_price numeric(12,2); v_currency text; v_hash text;
begin
 if p_actor_user_id is null then raise exception 'SUBSCRIPTION_AUTH_REQUIRED'; end if;
 if p_business_id is null or nullif(trim(p_tier_code),'') is null or nullif(trim(p_idempotency_key),'') is null then raise exception 'SUBSCRIPTION_INVALID_REQUEST'; end if;
 if upper(p_tier_code)='FREE_COMMISSION' then raise exception 'FREE_TIER_REQUIRES_NO_PAYMENT'; end if;
 if upper(p_billing_cycle) not in ('MONTHLY','ANNUAL') then raise exception 'SUBSCRIPTION_INVALID_BILLING_CYCLE'; end if;
 if not exists(select 1 from public.user_memberships m where m.user_id=p_actor_user_id and m.business_id=p_business_id and m.status='ACTIVE' and upper(m.role) in ('OWNER','BUSINESS_OWNER')) then raise exception 'SUBSCRIPTION_FORBIDDEN'; end if;
 perform public.legal_assert_action(p_actor_user_id,'SUBSCRIPTION_ACTIVATION',p_business_id);
 select * into v from public.subscription_payment_intents where idempotency_key=p_idempotency_key limit 1;
 if v.id is not null then if v.business_id<>p_business_id or v.tier_code<>upper(p_tier_code) or v.billing_cycle<>upper(p_billing_cycle) then raise exception 'SUBSCRIPTION_IDEMPOTENCY_MISMATCH'; end if; return v; end if;
 select case when upper(p_billing_cycle)='ANNUAL' then annual_price else monthly_price end,currency into v_price,v_currency from public.subscription_tier_prices where tier_code=upper(p_tier_code) and active=true;
 if v_price is null or v_price<=0 then raise exception 'SUBSCRIPTION_TIER_UNAVAILABLE'; end if;
 v_hash:=encode(digest(upper(p_tier_code)||':'||upper(p_billing_cycle)||':'||v_price::text||':'||v_currency,'sha256'),'hex');
 insert into public.subscription_payment_intents(business_id,tier_code,billing_cycle,sector,amount,currency,status,provider,idempotency_key,pricing_hash,created_by)
 values(p_business_id,upper(p_tier_code),upper(p_billing_cycle),nullif(trim(p_sector),''),v_price,v_currency,'CREATED','PAYMOB',p_idempotency_key,v_hash,p_actor_user_id) returning * into v;
 return v;
end; $$;


ALTER FUNCTION "public"."create_subscription_payment_intent_backend"("p_business_id" "uuid", "p_tier_code" "text", "p_billing_cycle" "text", "p_sector" "text", "p_idempotency_key" "text", "p_actor_user_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" character varying NOT NULL,
    "tenant_id" character varying NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "business_id" "uuid",
    "subject" character varying NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "category" character varying DEFAULT 'GENERAL_INQUIRY'::character varying NOT NULL,
    "priority" character varying DEFAULT 'MEDIUM'::character varying NOT NULL,
    "status" character varying DEFAULT 'OPEN'::character varying NOT NULL,
    "assigned_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    CONSTRAINT "support_tickets_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['OPEN'::character varying, 'IN_PROGRESS'::character varying, 'RESOLVED'::character varying, 'CLOSED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."support_tickets" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_tickets" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_support_ticket_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_subject" character varying, "p_description" "text", "p_category" character varying, "p_priority" character varying) RETURNS "public"."support_tickets"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r public.support_tickets;
begin
 if not exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=p_tenant_id and m.status='ACTIVE') then raise exception 'TENANT_MEMBERSHIP_REQUIRED'; end if;
 insert into public.support_tickets(id,tenant_id,requester_id,business_id,subject,description,category,priority) values(p_id,p_tenant_id,auth.uid(),p_business_id,p_subject,p_description,p_category,p_priority)
 on conflict(id) do update set subject=excluded.subject returning * into r; return r;
end; $$;


ALTER FUNCTION "public"."create_support_ticket_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_subject" character varying, "p_description" "text", "p_category" character varying, "p_priority" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_wallet_transaction_backend"("p_id" character varying, "p_tenant_id" character varying, "p_wallet_id" character varying, "p_transaction_type" character varying, "p_amount" numeric, "p_idempotency_key" character varying, "p_reference_type" character varying, "p_reference_id" character varying, "p_description" "text", "p_journal_entry" "jsonb", "p_journal_lines" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_wallet public.wallet_accounts%rowtype;
  v_existing public.wallet_transactions%rowtype;
  v_balance numeric := 0;
  v_is_debit boolean;
  v_after numeric;
  v_line_count integer;
  v_journal_id varchar;
begin
  perform public.assert_financial_membership(p_tenant_id);

  if p_amount <= 0 then raise exception 'WALLET_AMOUNT_MUST_BE_POSITIVE'; end if;
  if coalesce(length(trim(p_idempotency_key)),0) = 0 then raise exception 'WALLET_IDEMPOTENCY_REQUIRED'; end if;

  select * into v_wallet
  from public.wallet_accounts
  where id = p_wallet_id and tenant_id = p_tenant_id
  for update;

  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  if v_wallet.status <> 'ACTIVE' then raise exception 'WALLET_NOT_ACTIVE'; end if;

  select * into v_existing
  from public.wallet_transactions
  where idempotency_key = p_idempotency_key
  limit 1;

  if found then
    if v_existing.wallet_id <> p_wallet_id or v_existing.amount <> p_amount then
      raise exception 'WALLET_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object('id',v_existing.id,'wallet_id',v_existing.wallet_id,'status',v_existing.status,'balance_after',v_existing.balance_after,'journal_entry_id',v_existing.journal_entry_id,'idempotent',true);
  end if;

  select coalesce(sum(
    case when transaction_type in ('CREDIT','REFUND') then amount
         when transaction_type in ('DEBIT','COMMISSION_SETTLEMENT') then -amount
         else 0 end),0)
  into v_balance
  from public.wallet_transactions
  where wallet_id = p_wallet_id and status = 'CONFIRMED';

  v_is_debit := p_transaction_type in ('DEBIT','COMMISSION_SETTLEMENT');
  v_after := case when v_is_debit then v_balance - p_amount else v_balance + p_amount end;

  if v_is_debit and v_after < 0 and not v_wallet.allow_negative then
    raise exception 'WALLET_INSUFFICIENT_BALANCE';
  end if;

  v_journal_id := (p_journal_entry->>'id');
  if v_journal_id is null or length(v_journal_id)=0 then raise exception 'JOURNAL_ID_REQUIRED'; end if;

  -- Validate and post the journal before mutating wallet state.
  perform public.post_financial_journal(p_journal_entry, p_journal_lines);

  insert into public.wallet_transactions(
    id,tenant_id,wallet_id,transaction_type,amount,balance_after,idempotency_key,status,
    reference_type,reference_id,description,journal_entry_id
  ) values (
    p_id,p_tenant_id,p_wallet_id,p_transaction_type,p_amount,v_after,p_idempotency_key,'CONFIRMED',
    p_reference_type,p_reference_id,p_description,v_journal_id
  );

  return jsonb_build_object('id',p_id,'wallet_id',p_wallet_id,'status','CONFIRMED','balance_after',v_after,'journal_entry_id',v_journal_id,'idempotent',false);
end;
$$;


ALTER FUNCTION "public"."create_wallet_transaction_backend"("p_id" character varying, "p_tenant_id" character varying, "p_wallet_id" character varying, "p_transaction_type" character varying, "p_amount" numeric, "p_idempotency_key" character varying, "p_reference_type" character varying, "p_reference_id" character varying, "p_description" "text", "p_journal_entry" "jsonb", "p_journal_lines" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_warehouse_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_name" character varying, "p_code" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_user uuid:=auth.uid(); v_role text; v_row jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF coalesce(length(trim(p_id)),0)<8 OR coalesce(length(trim(p_name)),0)<1 OR coalesce(length(trim(p_code)),0)<1 THEN RAISE EXCEPTION 'INVALID_WAREHOUSE_INPUT'; END IF;
 SELECT role INTO v_role FROM user_memberships
 WHERE user_id=v_user AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE' LIMIT 1;
 IF v_role IS NULL OR upper(v_role) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER') THEN RAISE EXCEPTION 'WAREHOUSE_ADMIN_ROLE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM businesses WHERE id=p_business_id AND tenant_id=p_tenant_id AND status='ACTIVE') THEN RAISE EXCEPTION 'BUSINESS_INVALID'; END IF;
 INSERT INTO warehouses(id,tenant_id,business_id,name,code,status)
 VALUES(p_id,p_tenant_id,p_business_id,p_name,p_code,'ACTIVE')
 ON CONFLICT(id) DO NOTHING;
 SELECT to_jsonb(w) INTO v_row FROM warehouses w WHERE w.id=p_id;
 RETURN jsonb_build_object('success',true,'warehouse',v_row);
END; $$;


ALTER FUNCTION "public"."create_warehouse_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_name" character varying, "p_code" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_business_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select um.business_id
  from public.user_memberships um
  where um.user_id = (select auth.uid())
    and um.status = 'ACTIVE'
    and um.business_id is not null
  order by um.created_at asc
  limit 1;
$$;


ALTER FUNCTION "public"."current_business_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_tenant_id"() RETURNS character varying
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select um.tenant_id
  from public.user_memberships um
  where um.user_id = (select auth.uid())
    and um.status = 'ACTIVE'
  order by um.created_at asc
  limit 1;
$$;


ALTER FUNCTION "public"."current_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select auth.uid();
$$;


ALTER FUNCTION "public"."current_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deactivate_business"("p_business_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  b public.businesses%rowtype;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR COALESCE((auth.jwt() ->> 'is_anonymous'), 'false') = 'true' THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO b
  FROM public.businesses
  WHERE id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'business_not_found';
  END IF;

  IF NOT public.is_platform_admin() AND NOT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = uid
      AND m.tenant_id = b.tenant_id
      AND m.status = 'ACTIVE'
      AND (m.business_id = b.id OR m.business_id IS NULL)
      AND m.role IN ('OWNER','ADMIN','MANAGER')
  ) THEN
    RAISE EXCEPTION 'business_deactivation_forbidden';
  END IF;

  UPDATE public.businesses
  SET status = 'SUSPENDED',
      settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{lifecycle}',
        jsonb_build_object(
          'status', 'SUSPENDED',
          'reason', NULLIF(trim(COALESCE(p_reason,'')), ''),
          'changed_by', uid,
          'changed_at', now()
        ),
        true
      ),
      updated_at = now()
  WHERE id = b.id;

  RETURN jsonb_build_object(
    'business_id', b.id,
    'status', 'SUSPENDED',
    'changed_at', now()
  );
END
$$;


ALTER FUNCTION "public"."deactivate_business"("p_business_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."disable_mnty_push_subscription"("p_endpoint" "text") RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'private'
    AS $_$ select private.disable_mnty_push_subscription($1); $_$;


ALTER FUNCTION "public"."disable_mnty_push_subscription"("p_endpoint" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_stale_mantigo_rides_backend"("p_admin_user_id" "uuid", "p_age_minutes" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_count integer:=0; v_ride record;
begin
 if p_admin_user_id is null or p_admin_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 if not exists(select 1 from public.user_memberships where user_id=p_admin_user_id and status='ACTIVE' and upper(role) in ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','MANAGER','OPERATIONS','OPERATIONS_MANAGER')) then raise exception 'OPERATIONS_ROLE_REQUIRED'; end if;
 if p_age_minutes is null or p_age_minutes<1 or p_age_minutes>10080 then raise exception 'INVALID_EXPIRATION_WINDOW'; end if;
 for v_ride in
   select id,customer_id,status,updated_at from public.mantigo_rides
   where status in ('OPEN','OPEN_FOR_BIDS') and updated_at < now() - make_interval(mins=>p_age_minutes)
   for update skip locked
 loop
   update public.mantigo_rides set status='EXPIRED',updated_at=now() where id=v_ride.id and status=v_ride.status;
   if found then
     v_count:=v_count+1;
     insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
     values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,'MANTIGO_RIDE_EXPIRED','MANTIGO_RIDE',v_ride.id,jsonb_build_object('status',v_ride.status,'updated_at',v_ride.updated_at),jsonb_build_object('status','EXPIRED','reason','STALE_REQUEST'), 'SUCCESS');
     begin
       insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
       values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_ride.customer_id,'MANTIGO_EXPIRED','انتهى طلب الرحلة','انتهت مدة طلب الرحلة لعدم اكتمال المطابقة. يمكنك إنشاء طلب جديد.','MANTIGO_RIDE',v_ride.id);
     exception when others then
       insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
       values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',v_ride.id,'{}'::jsonb,jsonb_build_object('notification_type','MANTIGO_EXPIRED','error',sqlerrm),'PARTIAL');
     end;
   end if;
 end loop;
 return jsonb_build_object('expired_count',v_count,'age_minutes',p_age_minutes);
end $$;


ALTER FUNCTION "public"."expire_stale_mantigo_rides_backend"("p_admin_user_id" "uuid", "p_age_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fashion_erp_mutate"("p_action" "text", "p_payload" "jsonb", "p_idempotency_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ declare v_uid uuid:=auth.uid(); v_result jsonb; v_existing jsonb; s record; begin if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'unauthorized'; end if; if not public.is_platform_admin() and not exists(select 1 from public.user_memberships m where m.user_id=v_uid and m.status='ACTIVE' and upper(m.role) in ('BUSINESS_OWNER','OWNER','MANAGER','EMPLOYEE','STAFF','CASHIER')) then raise exception 'forbidden_business_role'; end if; if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>200 then raise exception 'invalid idempotency key'; end if; select response into v_existing from public.legacy_module_idempotency where module_code='FASHION_ERP' and actor_user_id=v_uid and idempotency_key=p_idempotency_key; if found then return coalesce(v_existing,'{"status":"ok"}'::jsonb); end if; select * into s from public.resolve_legacy_scope(nullif(p_payload->>'branch_id','')); if p_action='create_product' then insert into public.fashion_products(id,owner_user_id,tenant_id,business_id,branch_id,name,category_id,category_name,store_name,price,original_price,rating,review_count,image_url,description,available_sizes,available_colors,stock_count,is_best_seller,is_new_arrival,created_at,updated_at) values(p_payload->>'id',v_uid,s.tenant_id,s.business_id,s.branch_id,p_payload->>'name',p_payload->>'category_id',p_payload->>'category_name',p_payload->>'store_name',(p_payload->>'price')::numeric,nullif(p_payload->>'original_price','')::numeric,coalesce((p_payload->>'rating')::numeric,0),coalesce((p_payload->>'review_count')::integer,0),coalesce(p_payload->>'image_url',''),coalesce(p_payload->>'description',''),coalesce(p_payload->'available_sizes','[]'::jsonb),coalesce(p_payload->'available_colors','[]'::jsonb),coalesce((p_payload->>'stock_count')::integer,0),coalesce((p_payload->>'is_best_seller')::boolean,false),coalesce((p_payload->>'is_new_arrival')::boolean,false),now(),now()) returning to_jsonb(fashion_products.*) into v_result; elsif p_action='delete_product' then delete from public.fashion_products where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning jsonb_build_object('id',id,'deleted',true) into v_result; elsif p_action='create_order' then insert into public.fashion_orders(order_id,owner_user_id,tenant_id,business_id,branch_id,product_name,size,color,quantity,total_price,customer_name,phone,address,status,date_formatted,created_at,updated_at) values(p_payload->>'order_id',v_uid,s.tenant_id,s.business_id,s.branch_id,p_payload->>'product_name',coalesce(p_payload->>'size',''),coalesce(p_payload->>'color',''),(p_payload->>'quantity')::integer,(p_payload->>'total_price')::numeric,p_payload->>'customer_name',p_payload->>'phone',p_payload->>'address',coalesce(p_payload->>'status','جاري التجهيز 🚚'),coalesce(p_payload->>'date_formatted','الآن'),now(),now()) returning to_jsonb(fashion_orders.*) into v_result; elsif p_action='update_order_status' then update public.fashion_orders set status=p_payload->>'status',updated_at=now() where order_id=p_payload->>'order_id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning jsonb_build_object('order_id',order_id,'status',status) into v_result; else raise exception 'unsupported fashion action'; end if; if v_result is null then raise exception 'target not found or mutation failed'; end if; insert into public.legacy_module_idempotency(module_code,actor_user_id,idempotency_key,request_hash,response) values('FASHION_ERP',v_uid,md5(coalesce(p_action,'')||':'||coalesce(p_payload::text,'')||':'||s.branch_id),v_result); return v_result; end $$;


ALTER FUNCTION "public"."fashion_erp_mutate"("p_action" "text", "p_payload" "jsonb", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_digital_page_payment_intent_backend"("p_order_id" "uuid", "p_user_id" "uuid", "p_claim_token" "text", "p_provider_intent_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_claim jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'FORBIDDEN';
  end if;

  update public.digital_page_orders
  set provider='PAYMOB',
      provider_intent_id=p_provider_intent_id,
      payment_status='PENDING',
      metadata=metadata - 'payment_intent_claim',
      updated_at=now()
  where id=p_order_id
    and user_id=p_user_id
    and provider_intent_id is null
    and payment_status='PENDING'
    and metadata->'payment_intent_claim'->>'token'=p_claim_token;

  if found then
    return true;
  end if;

  select metadata->'payment_intent_claim' into v_claim
  from public.digital_page_orders
  where id=p_order_id
    and user_id=p_user_id;

  return false;
end;
$$;


ALTER FUNCTION "public"."finalize_digital_page_payment_intent_backend"("p_order_id" "uuid", "p_user_id" "uuid", "p_claim_token" "text", "p_provider_intent_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_mnty_nearby_provider_businesses"("p_lat" double precision, "p_lon" double precision, "p_radius_km" double precision DEFAULT 3) RETURNS TABLE("business_id" "uuid", "distance_km" double precision)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with points as (
    select p_lat lat, p_lon lon, greatest(0, least(coalesce(p_radius_km,3),10)) radius_km
  ),
  distances as (
    select b.business_id,
      6371.0 * 2.0 * asin(least(1.0, sqrt(
        power(sin(radians((b.latitude::double precision - p.lat)/2.0)),2)
        + cos(radians(p.lat))*cos(radians(b.latitude::double precision))
        * power(sin(radians((b.longitude::double precision - p.lon)/2.0)),2)
      ))) as distance_km
    from public.branches b
    join public.marketing_provider_profiles mp
      on mp.business_id = b.business_id and mp.status = 'ACTIVE'
    cross join points p
    where b.latitude is not null and b.longitude is not null and b.business_id is not null
  ),
  nearest as (
    select business_id, min(distance_km) distance_km from distances group by business_id
  )
  select n.business_id, round(n.distance_km::numeric,3)::double precision
  from nearest n cross join points p
  where p.radius_km >= 10 or n.distance_km <= p.radius_km
  order by n.distance_km asc
  limit 200;
$$;


ALTER FUNCTION "public"."find_mnty_nearby_provider_businesses"("p_lat" double precision, "p_lon" double precision, "p_radius_km" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_mnty_nearest_provider_businesses"("p_lat" double precision, "p_lon" double precision, "p_limit" integer DEFAULT 12) RETURNS TABLE("business_id" "uuid", "distance_km" double precision)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
with points as (
  select p_lat lat, p_lon lon
),
distances as (
  select b.business_id,
    6371.0088 * 2.0 * asin(least(1.0, sqrt(
      power(sin(radians((b.latitude::double precision - p.lat)/2.0)),2)
      + cos(radians(p.lat))*cos(radians(b.latitude::double precision))
      * power(sin(radians((b.longitude::double precision - p.lon)/2.0)),2)
    ))) as distance_km
  from public.branches b
  join public.marketing_provider_profiles mp
    on mp.business_id=b.business_id and mp.status='ACTIVE'
  cross join points p
  where b.latitude is not null
    and b.longitude is not null
    and b.business_id is not null
),
nearest as (
  select business_id,min(distance_km) distance_km
  from distances
  group by business_id
)
select n.business_id,
       round(n.distance_km::numeric,3)::double precision
from nearest n
order by n.distance_km asc,n.business_id
limit greatest(1,least(coalesce(p_limit,12),50));
$$;


ALTER FUNCTION "public"."find_mnty_nearest_provider_businesses"("p_lat" double precision, "p_lon" double precision, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fulfill_digital_page_publish"("p_actor_user_id" "uuid", "p_order_id" "uuid", "p_page_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_order public.digital_page_orders%rowtype; v_page public.digital_pages%rowtype;
begin
  if p_actor_user_id is null or p_actor_user_id <> auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if not public.mnty_can_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  select * into v_order from public.digital_page_orders where id=p_order_id for update;
  if not found then raise exception 'DIGITAL_PAGE_ORDER_NOT_FOUND'; end if;
  if v_order.payment_status <> 'PAID' then raise exception 'PAYMENT_REQUIRED'; end if;
  if v_order.fulfillment_status not in ('REQUESTED','IN_REVIEW','IN_PROGRESS') and v_order.fulfillment_status <> 'PUBLISHED' then raise exception 'INVALID_FULFILLMENT_STATE'; end if;
  select * into v_page from public.digital_pages where id=p_page_id for update;
  if not found then raise exception 'DIGITAL_PAGE_NOT_FOUND'; end if;
  if v_page.created_by <> v_order.user_id then raise exception 'PAGE_OWNER_MISMATCH'; end if;
  if v_page.page_type <> v_order.page_type then raise exception 'PAGE_TYPE_MISMATCH'; end if;
  if v_order.target_business_id is not null and v_page.business_id is distinct from v_order.target_business_id then raise exception 'BUSINESS_SCOPE_MISMATCH'; end if;
  if v_order.page_type = 'MENU' and (v_order.target_business_id is null or v_page.business_id is distinct from v_order.target_business_id) then raise exception 'MENU_BUSINESS_SCOPE_REQUIRED'; end if;
  if v_page.digital_page_order_id is not null and v_page.digital_page_order_id <> v_order.id then raise exception 'PAGE_ALREADY_LINKED_TO_DIFFERENT_ORDER'; end if;
  if v_page.status = 'PUBLISHED' then
    if v_page.digital_page_order_id = v_order.id and v_order.fulfillment_status = 'PUBLISHED' then
      return jsonb_build_object('page_id',v_page.id,'order_id',v_order.id,'status','PUBLISHED','replayed',true);
    end if;
    raise exception 'PUBLISHED_PAGE_NOT_LINKED_TO_ORDER';
  end if;
  update public.digital_pages set digital_page_order_id=v_order.id,status='PUBLISHED',published_at=coalesce(published_at,now()),version=version+1,updated_by=p_actor_user_id,updated_at=now() where id=v_page.id;
  update public.digital_page_orders set fulfillment_status='PUBLISHED',updated_at=now() where id=v_order.id;
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,new_values,result,created_at)
  values(gen_random_uuid()::text,'MNTY-PLATFORM',p_actor_user_id,'DIGITAL_PAGE_PUBLISHED','digital_page_order',v_order.id::text,jsonb_build_object('page_id',v_page.id,'page_type',v_page.page_type),'SUCCESS',now());
  return jsonb_build_object('page_id',v_page.id,'order_id',v_order.id,'status','PUBLISHED','replayed',false);
end;
$$;


ALTER FUNCTION "public"."fulfill_digital_page_publish"("p_actor_user_id" "uuid", "p_order_id" "uuid", "p_page_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_credit_status"("p_tenant_id" character varying, "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  a public.credit_accounts%rowtype;
  p public.credit_periods%rowtype;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR COALESCE((auth.jwt() ->> 'is_anonymous'), 'false') = 'true' THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_platform_admin() AND NOT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = v_uid
      AND m.tenant_id = p_tenant_id
      AND m.status = 'ACTIVE'
      AND (
        m.business_id = p_business_id
        OR m.business_id IS NULL
      )
      AND m.role IN (
        'OWNER',
        'ADMIN',
        'MANAGER',
        'FINANCE',
        'ACCOUNTANT',
        'FINANCE_MANAGER'
      )
  ) THEN
    RAISE EXCEPTION 'credit_status_forbidden';
  END IF;

  SELECT *
  INTO a
  FROM public.credit_accounts
  WHERE tenant_id = p_tenant_id
    AND business_id = p_business_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'credit_account_not_found';
  END IF;

  SELECT *
  INTO p
  FROM public.credit_periods
  WHERE credit_account_id = a.id
  ORDER BY due_date DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'account_id', a.id,
    'approved_limit', a.approved_limit,
    'outstanding_amount', a.outstanding_amount,
    'available_amount', a.available_amount,
    'status', a.status,
    'next_due_date', a.next_due_date,
    'current_period',
      CASE
        WHEN p.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'period_start', p.period_start,
          'period_end', p.period_end,
          'due_date', p.due_date,
          'billed_amount', p.billed_amount,
          'paid_amount', p.paid_amount,
          'outstanding_amount', p.outstanding_amount,
          'status', p.status,
          'days_overdue', p.days_overdue
        )
      END
  );
END
$$;


ALTER FUNCTION "public"."get_credit_status"("p_tenant_id" character varying, "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_mantigo_admin_dashboard_backend"("p_admin_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_user uuid:=auth.uid(); v_result jsonb;
begin
 if v_user is null or p_admin_user_id is null or v_user<>p_admin_user_id then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 if not exists(select 1 from public.user_memberships where user_id=v_user and status='ACTIVE' and upper(role) in ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','MANAGER','OPERATIONS','OPERATIONS_MANAGER')) then raise exception 'OPERATIONS_ROLE_REQUIRED'; end if;
 select jsonb_build_object(
  'rides_total',count(*),
  'open_requests',count(*) filter(where status in('OPEN','OPEN_FOR_BIDS','MATCHING')),
  'accepted',count(*) filter(where status='ACCEPTED'),
  'arrived',count(*) filter(where status='ARRIVED'),
  'started',count(*) filter(where status='STARTED'),
  'in_progress',count(*) filter(where status='IN_PROGRESS'),
  'completed',count(*) filter(where status='COMPLETED'),
  'cancelled',count(*) filter(where status='CANCELLED'),
  'failed',count(*) filter(where status='FAILED'),
  'show_no',count(*) filter(where status='SHOW_NO'),
  'expired',count(*) filter(where status='EXPIRED'),
  'revenue',coalesce((select sum(gross_amount) from public.mantigo_financial_ledger),0),
  'commission',coalesce((select sum(commission_amount) from public.mantigo_financial_ledger),0),
  'captain_earnings',coalesce((select sum(captain_net_amount) from public.mantigo_financial_ledger),0),
  'paid',coalesce((select sum(gross_amount) from public.mantigo_financial_ledger where payment_status in('PAID','CASH_CONFIRMED')),0),
  'unsettled',coalesce((select sum(captain_net_amount) from public.mantigo_financial_ledger where settlement_status in('READY','HELD')),0)
 ) into v_result from public.mantigo_rides;
 return v_result;
end $$;


ALTER FUNCTION "public"."get_mantigo_admin_dashboard_backend"("p_admin_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_mantigo_admin_financial_report_backend"("p_admin_user_id" "uuid", "p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_auth uuid:=auth.uid();
  v_from timestamptz:=coalesce(p_from,'epoch'::timestamptz);
  v_to timestamptz:=coalesce(p_to,'infinity'::timestamptz);
  v_role text;
  v_ledger jsonb;
begin
  if v_auth is null or v_auth<>p_admin_user_id then raise exception 'AUTH_REQUIRED'; end if;
  select upper(role) into v_role from public.user_memberships
   where user_id=v_auth and status='ACTIVE'
   order by case when upper(role) in ('SUPER_ADMIN','OWNER','BUSINESS_OWNER','ADMIN','OPERATIONS','OPERATIONS_MANAGER') then 0 else 1 end, id
   limit 1;
  if v_role is null or v_role not in ('SUPER_ADMIN','OWNER','BUSINESS_OWNER','ADMIN','OPERATIONS','OPERATIONS_MANAGER') then
    raise exception 'ADMIN_ROLE_REQUIRED';
  end if;

  select jsonb_build_object(
    'ledger_count',count(*),
    'gross',coalesce(sum(l.amount),0),
    'commission',coalesce(sum(l.commission_amount),0),
    'captain_amount',coalesce(sum(l.captain_amount),0),
    'paid_count',count(*) filter(where l.payment_status in ('PAID','CASH_CONFIRMED')),
    'paid_amount',coalesce(sum(l.amount) filter(where l.payment_status in ('PAID','CASH_CONFIRMED')),0),
    'settled_count',count(*) filter(where l.settlement_status='SETTLED'),
    'settled_amount',coalesce(sum(l.captain_amount) filter(where l.settlement_status='SETTLED'),0),
    'unsettled_count',count(*) filter(where l.settlement_status is distinct from 'SETTLED'),
    'unsettled_amount',coalesce(sum(l.captain_amount) filter(where l.settlement_status is distinct from 'SETTLED'),0),
    'from',v_from,'to',v_to
  ) into v_ledger
  from public.mantigo_financial_ledger l
  where l.created_at>=v_from and l.created_at<v_to;

  return v_ledger;
end;
$$;


ALTER FUNCTION "public"."get_mantigo_admin_financial_report_backend"("p_admin_user_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_mantigo_captain_earnings_backend"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_auth uuid := auth.uid();
  v_total bigint;
  v_completed bigint;
  v_cancelled bigint;
  v_failed bigint;
  v_gross numeric := 0;
  v_commission numeric := 0;
  v_net numeric := 0;
  v_settled numeric := 0;
  v_unsettled numeric := 0;
  v_paid bigint := 0;
begin
  if v_auth is null or v_auth <> p_user_id then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists (
    select 1 from public.mantigo_captain_profiles
    where captain_id=p_user_id
  ) then
    raise exception 'CAPTAIN_PROFILE_REQUIRED';
  end if;

  select count(*) into v_total
  from public.mantigo_rides r
  where exists (
    select 1 from public.mantigo_bids b
    where b.ride_id=r.id and b.captain_id=p_user_id and b.status='ACCEPTED'
  );

  select count(*) into v_completed
  from public.mantigo_rides r
  where r.status='COMPLETED' and exists (
    select 1 from public.mantigo_bids b
    where b.ride_id=r.id and b.captain_id=p_user_id and b.status='ACCEPTED'
  );

  select count(*) into v_cancelled
  from public.mantigo_rides r
  where r.status='CANCELLED' and exists (
    select 1 from public.mantigo_bids b
    where b.ride_id=r.id and b.captain_id=p_user_id and b.status='ACCEPTED'
  );

  select count(*) into v_failed
  from public.mantigo_rides r
  where r.status in ('FAILED','SHOW_NO') and exists (
    select 1 from public.mantigo_bids b
    where b.ride_id=r.id and b.captain_id=p_user_id and b.status='ACCEPTED'
  );

  select coalesce(sum(l.amount),0),
         coalesce(sum(l.commission_amount),0),
         coalesce(sum(l.captain_amount),0),
         coalesce(sum(case when l.settlement_status='SETTLED' then l.captain_amount else 0 end),0),
         coalesce(sum(case when l.settlement_status is distinct from 'SETTLED' then l.captain_amount else 0 end),0),
         count(*) filter (where l.payment_status in ('PAID','CASH_CONFIRMED'))
  into v_gross,v_commission,v_net,v_settled,v_unsettled,v_paid
  from public.mantigo_financial_ledger l
  where l.captain_id=p_user_id;

  return jsonb_build_object(
    'rides_total',v_total,'completed',v_completed,'cancelled',v_cancelled,'failed',v_failed,
    'gross',v_gross,'commission',v_commission,'net',v_net,'settled',v_settled,
    'unsettled',v_unsettled,'paid_rides',v_paid
  );
end;
$$;


ALTER FUNCTION "public"."get_mantigo_captain_earnings_backend"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_mnty_push_secrets"() RETURNS TABLE("vapid_private_key" "text", "webhook_secret" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'mnty_vapid_private_key' limit 1),
    (select decrypted_secret from vault.decrypted_secrets where name = 'mnty_push_webhook_secret' limit 1);
$$;


ALTER FUNCTION "public"."get_mnty_push_secrets"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_mnty_targeted_advertisements"("p_country_code" character varying DEFAULT 'EG'::character varying, "p_governorate_code" character varying DEFAULT NULL::character varying, "p_center_code" character varying DEFAULT NULL::character varying, "p_lat" double precision DEFAULT NULL::double precision, "p_lon" double precision DEFAULT NULL::double precision, "p_ad_space_id" character varying DEFAULT NULL::character varying, "p_limit" integer DEFAULT 3) RETURNS TABLE("advertisement_id" character varying, "title" character varying, "creative_url" "text", "target_url" "text", "ad_space_id" character varying, "match_level" character varying, "distance_km" double precision)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
with active_ads as (
  select a.id,a.title,a.creative_url,a.target_url,a.ad_space_id,a.created_at
  from public.advertisements a
  where a.status='ACTIVE' and a.approval_status='APPROVED'
    and (a.start_at is null or a.start_at<=now())
    and (a.end_at is null or a.end_at>=now())
    and (p_ad_space_id is null or a.ad_space_id=p_ad_space_id)
),
raw as (
  select a.id,a.title,a.creative_url,a.target_url,a.ad_space_id,
         g.level,g.code,g.latitude,g.longitude,a.created_at,
         case
           when g.level='CENTER' and p_center_code is not null and g.code=p_center_code then 1
           when g.level='GOVERNORATE' and p_governorate_code is not null and g.code=p_governorate_code then 2
           when g.level='COUNTRY' and g.code=coalesce(p_country_code,'EG') then 3
           when p_lat is not null and p_lon is not null and g.latitude is not null and g.longitude is not null then 4
           else 5
         end match_rank,
         case when p_lat is null or p_lon is null or g.latitude is null or g.longitude is null then null
           else 6371.0088*2*asin(sqrt(
             power(sin(radians(g.latitude-p_lat)/2),2)
             + cos(radians(p_lat))*cos(radians(g.latitude))
             * power(sin(radians(g.longitude-p_lon)/2),2)
           )) end km
  from active_ads a
  join public.advertisement_target_locations t on t.advertisement_id=a.id
  join public.platform_geo_areas g on g.id=t.geo_area_id
  where g.status='ACTIVE' and g.country_code=coalesce(p_country_code,'EG')
),
global_ads as (
  select ('GLOBAL-'||g.id::text)::varchar id,g.title,g.creative_url,g.target_url,g.ad_space_id,
         'COUNTRY'::varchar level,null::varchar code,null::double precision latitude,
         null::double precision longitude,g.created_at,6::integer match_rank,
         null::double precision km
  from public.platform_global_advertisements g
  where g.status='ACTIVE' and g.approval_status='APPROVED'
    and (g.start_at is null or g.start_at<=now())
    and (g.end_at is null or g.end_at>=now())
    and (p_ad_space_id is null or g.ad_space_id=p_ad_space_id)
),
combined as (
  select id,title,creative_url,target_url,ad_space_id,level,code,latitude,longitude,created_at,match_rank,km from raw
  union all
  select id,title,creative_url,target_url,ad_space_id,level,code,latitude,longitude,created_at,match_rank,km from global_ads
),
best_per_ad as (
  select *,row_number() over(partition by id order by match_rank,km nulls last,created_at desc nulls last) rn
  from combined
)
select b.id,b.title,b.creative_url,b.target_url,b.ad_space_id,
  case b.match_rank when 1 then 'CENTER' when 2 then 'GOVERNORATE'
       when 3 then 'COUNTRY' when 4 then 'NEAREST' else 'GLOBAL' end,
  b.km
from best_per_ad b
where b.rn=1
order by b.match_rank,b.km nulls last,b.created_at desc nulls last,b.id
limit greatest(1,least(coalesce(p_limit,3),50));
$$;


ALTER FUNCTION "public"."get_mnty_targeted_advertisements"("p_country_code" character varying, "p_governorate_code" character varying, "p_center_code" character varying, "p_lat" double precision, "p_lon" double precision, "p_ad_space_id" character varying, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_business_referral_profile"("p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_tenant varchar;
  v_code varchar(32);
  v_scans bigint;
  v_leads bigint;
  v_orders bigint;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous'),'false')='true' then raise exception 'AUTH_REQUIRED'; end if;

  select b.tenant_id into v_tenant
  from public.businesses b
  join public.user_memberships m on m.tenant_id=b.tenant_id and m.business_id=b.id
  where b.id=p_business_id and m.user_id=v_uid and m.status='ACTIVE'
    and upper(m.role) in ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER','SUPER_ADMIN')
  limit 1;

  if v_tenant is null then raise exception 'BUSINESS_ACCESS_DENIED'; end if;

  select code into v_code from public.business_referral_codes
  where business_id=p_business_id and status='ACTIVE' limit 1;

  if v_code is null then
    v_code := upper(substr(md5(gen_random_uuid()::text || p_business_id::text),1,10));
    insert into public.business_referral_codes(business_id,code) values(p_business_id,v_code)
    on conflict (business_id) do update set updated_at=now()
    returning code into v_code;
  end if;

  select count(*) into v_scans from public.business_referral_events where business_id=p_business_id and event_type='SCAN';
  select count(*) into v_leads from public.business_referral_events where business_id=p_business_id and event_type='LEAD';
  select count(*) into v_orders from public.business_referral_events where business_id=p_business_id and event_type='ORDER';

  return jsonb_build_object(
    'businessId',p_business_id,
    'code',v_code,
    'profileUrl','https://mantiqatix.com/business/'||p_business_id::text,
    'inviteUrl','https://mantiqatix.com/join-business/'||v_code,
    'scans',coalesce(v_scans,0),
    'leads',coalesce(v_leads,0),
    'orders',coalesce(v_orders,0)
  );
end;
$$;


ALTER FUNCTION "public"."get_or_create_business_referral_profile"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_my_referral_profile"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_code varchar(32);
  v_count bigint;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous'),'false') = 'true' then
    raise exception 'AUTH_REQUIRED';
  end if;

  select code into v_code from public.referral_codes where user_id = v_uid and status = 'ACTIVE' limit 1;

  if v_code is null then
    v_code := upper(substr(md5(gen_random_uuid()::text || v_uid::text), 1, 10));
    insert into public.referral_codes(user_id, code) values (v_uid, v_code)
    on conflict (user_id) do update set updated_at = now()
    returning code into v_code;
  end if;

  select count(*) into v_count from public.referral_events where referrer_user_id = v_uid and status <> 'REJECTED';

  return jsonb_build_object(
    'code', v_code,
    'inviteUrl', 'https://mantiqatix.com/join/' || v_code,
    'referralsCount', coalesce(v_count,0)
  );
end;
$$;


ALTER FUNCTION "public"."get_or_create_my_referral_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_indrive_server_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if current_user in ('postgres','service_role') then
    return new;
  end if;

  if tg_table_name = 'indrive_bids' then
    if new.id is distinct from old.id
       or new.request_id is distinct from old.request_id
       or new.provider_user_id is distinct from old.provider_user_id
       or new.status is distinct from old.status then
      raise exception 'BID_SERVER_FIELDS_ONLY';
    end if;
  elsif tg_table_name = 'indrive_requests' then
    if new.id is distinct from old.id
       or new.owner_user_id is distinct from old.owner_user_id
       or new.status is distinct from old.status
       or new.accepted_bid_id is distinct from old.accepted_bid_id then
      raise exception 'REQUEST_SERVER_FIELDS_ONLY';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."guard_indrive_server_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_opening_stock_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_warehouse_id" character varying, "p_product_id" "uuid", "p_quantity" numeric, "p_unit_cost" numeric, "p_reference_id" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_user uuid:=auth.uid(); v_role text; v_branch character varying; v_balance stock_balances%ROWTYPE; v_existing jsonb; v_tx_id character varying;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF p_quantity IS NULL OR p_quantity<=0 OR coalesce(p_unit_cost,0)<0 THEN RAISE EXCEPTION 'INVALID_OPENING_STOCK'; END IF;
 IF coalesce(length(trim(p_id)),0)<8 OR coalesce(length(trim(p_reference_id)),0)<1 THEN RAISE EXCEPTION 'INVALID_OPENING_STOCK_REFERENCE'; END IF;
 SELECT role INTO v_role FROM user_memberships
 WHERE user_id=v_user AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE' LIMIT 1;
 IF v_role IS NULL OR upper(v_role) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','ACCOUNTANT','FINANCE_MANAGER','FINANCE') THEN RAISE EXCEPTION 'OPENING_STOCK_ROLE_REQUIRED'; END IF;
 SELECT branch_id INTO v_branch FROM warehouses WHERE id=p_warehouse_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE';
 IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_INVALID'; END IF;
 IF NOT EXISTS(SELECT 1 FROM catalog_items WHERE id=p_product_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE') THEN RAISE EXCEPTION 'PRODUCT_INVALID'; END IF;
 SELECT to_jsonb(i) INTO v_existing FROM inventory_transactions i
 WHERE i.tenant_id=p_tenant_id AND i.business_id=p_business_id AND i.warehouse_id=p_warehouse_id AND i.product_id=p_product_id
   AND i.transaction_type='OPENING' AND i.reference_id=p_reference_id LIMIT 1;
 IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('success',true,'idempotent',true,'transaction',v_existing); END IF;
 SELECT * INTO v_balance FROM stock_balances
 WHERE tenant_id=p_tenant_id AND business_id=p_business_id AND warehouse_id=p_warehouse_id AND product_id=p_product_id FOR UPDATE;
 IF NOT FOUND THEN
   INSERT INTO stock_balances(id,tenant_id,business_id,branch_id,warehouse_id,product_id,quantity_on_hand,quantity_reserved)
   VALUES(p_id||'-balance',p_tenant_id,p_business_id,v_branch,p_warehouse_id,p_product_id,p_quantity,0)
   RETURNING * INTO v_balance;
 ELSE
   UPDATE stock_balances SET quantity_on_hand=quantity_on_hand+p_quantity,updated_at=now() WHERE id=v_balance.id RETURNING * INTO v_balance;
 END IF;
 v_tx_id := p_id||'-tx';
 INSERT INTO inventory_transactions(id,tenant_id,business_id,branch_id,warehouse_id,product_id,transaction_type,quantity,unit_cost,reference_id,created_by)
 VALUES(v_tx_id,p_tenant_id,p_business_id,v_branch,p_warehouse_id,p_product_id,'OPENING',p_quantity,p_unit_cost,p_reference_id,v_user);
 RETURN jsonb_build_object('success',true,'idempotent',false,'transaction',to_jsonb((SELECT i FROM inventory_transactions i WHERE i.id=v_tx_id)),'balance',to_jsonb(v_balance));
END; $$;


ALTER FUNCTION "public"."initialize_opening_stock_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_warehouse_id" character varying, "p_product_id" "uuid", "p_quantity" numeric, "p_unit_cost" numeric, "p_reference_id" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
 select exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.status='ACTIVE' and upper(m.role) in ('ADMIN','SUPER_ADMIN'));
$$;


ALTER FUNCTION "public"."is_platform_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."legal_assert_action"("p_user_id" "uuid", "p_action_key" "text", "p_business_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE v_audience text;v_req record;v_doc record;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'LEGAL_AUTH_REQUIRED'; END IF;
 IF (SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) IS DISTINCT FROM p_user_id AND NOT private.legal_is_admin(p_user_id) THEN RAISE EXCEPTION 'LEGAL_AUTH_MISMATCH'; END IF;
 SELECT upper(m.role) INTO v_audience FROM public.user_memberships m WHERE m.user_id=p_user_id AND coalesce(m.status,'ACTIVE')='ACTIVE'
 AND(p_business_id IS NULL OR m.business_id=p_business_id OR m.business_id IS NULL) ORDER BY CASE WHEN m.business_id=p_business_id THEN 0 ELSE 1 END LIMIT 1;
 v_audience:=coalesce(v_audience,'CUSTOMER');
 FOR v_req IN SELECT * FROM public.legal_requirements WHERE action_key=p_action_key AND enabled AND required LOOP
   SELECT * INTO v_doc FROM public.legal_effective_version(v_req.document_type,v_req.target_audience,p_business_id);
   IF NOT FOUND THEN RAISE EXCEPTION 'LEGAL_DOCUMENT_NOT_PUBLISHED:%',v_req.document_type; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.user_consents c WHERE c.user_id=p_user_id AND c.document_id=v_doc.document_id AND c.document_version_id=v_doc.version_id AND c.consent_status='ACCEPTED' AND c.content_hash=v_doc.content_hash)
   THEN RAISE EXCEPTION 'LEGAL_CONSENT_REQUIRED:%:%',v_req.document_type,v_doc.version_id; END IF;
 END LOOP;
 RETURN jsonb_build_object('allowed',true,'action_key',p_action_key,'audience',v_audience);
END;$$;


ALTER FUNCTION "public"."legal_assert_action"("p_user_id" "uuid", "p_action_key" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."legal_audit_bridge"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_uid uuid:=auth.uid(); v_tenant varchar;
BEGIN
 SELECT tenant_id INTO v_tenant FROM public.user_memberships WHERE user_id=v_uid AND coalesce(status,'ACTIVE')='ACTIVE' ORDER BY created_at LIMIT 1;
 IF v_uid IS NOT NULL THEN
  INSERT INTO public.consent_audit_log(actor_user_id,event_type,document_id,document_version_id,event_at,metadata)
  VALUES(v_uid,'LEGAL_CMS_'||TG_OP,CASE WHEN TG_TABLE_NAME='legal_documents' THEN NEW.id ELSE NEW.document_id END,CASE WHEN TG_TABLE_NAME='legal_document_versions' THEN NEW.id ELSE NULL END,now(),jsonb_build_object('table',TG_TABLE_NAME,'operation',TG_OP));
  IF v_tenant IS NOT NULL THEN
   INSERT INTO public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,result,created_at)
   VALUES('LEGAL-'||gen_random_uuid()::text,v_tenant,v_uid,'LEGAL_CMS_'||TG_OP,TG_TABLE_NAME,(CASE WHEN TG_TABLE_NAME='legal_documents' THEN NEW.id ELSE NEW.id END)::text,'SUCCESS',now());
  END IF;
 END IF;
 RETURN NEW;
END;$$;


ALTER FUNCTION "public"."legal_audit_bridge"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."legal_check_action"("p_action_key" "text", "p_business_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN PERFORM public.legal_assert_action(auth.uid(),p_action_key,p_business_id);RETURN jsonb_build_object('allowed',true,'action_key',p_action_key);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('allowed',false,'action_key',p_action_key,'reason',SQLERRM);END;$$;


ALTER FUNCTION "public"."legal_check_action"("p_action_key" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."legal_effective_version"("p_document_type" "text", "p_audience" "text" DEFAULT 'ALL'::"text", "p_business_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("document_id" "uuid", "version_id" "uuid", "document_type" "text", "title" "text", "version_number" integer, "content" "text", "content_hash" "text", "requires_reconsent" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
 SELECT d.id,v.id,d.document_type::text,d.title::text,v.version_number,v.content,v.content_hash,d.requires_reconsent
 FROM public.legal_documents d JOIN public.legal_document_versions v ON v.document_id=d.id
 WHERE d.document_type=p_document_type AND d.status='PUBLISHED' AND v.status='PUBLISHED' AND coalesce(v.effective_at,v.published_at,now())<=now()
 AND (p_audience='ALL' OR d.target_audience @> ARRAY['ALL']::text[] OR d.target_audience @> ARRAY[p_audience]::text[])
 AND (cardinality(d.sector_codes)=0 OR p_business_id IS NULL OR EXISTS(SELECT 1 FROM public.businesses b WHERE b.id=p_business_id AND upper(coalesce(b.settings->>'sector',''))=ANY(SELECT upper(x) FROM unnest(d.sector_codes) x)))
 ORDER BY v.version_number DESC LIMIT 1;
$$;


ALTER FUNCTION "public"."legal_effective_version"("p_document_type" "text", "p_audience" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."legal_gate_business_activation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_owner uuid;
BEGIN
 IF NEW.status='ACTIVE' AND (TG_OP='INSERT' OR coalesce(OLD.status,'')<>'ACTIVE') THEN
  SELECT m.user_id INTO v_owner FROM public.user_memberships m WHERE m.business_id=NEW.id AND coalesce(m.status,'ACTIVE')='ACTIVE' AND upper(m.role) IN('OWNER','BUSINESS_OWNER') ORDER BY m.created_at LIMIT 1;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'LEGAL_BUSINESS_OWNER_REQUIRED'; END IF;
  PERFORM public.legal_assert_action(v_owner,'BUSINESS_ACTIVATION',NEW.id);
 END IF;
 RETURN NEW;
END;$$;


ALTER FUNCTION "public"."legal_gate_business_activation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."legal_gate_commission_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_owner uuid;
BEGIN
 SELECT m.user_id INTO v_owner FROM public.user_memberships m WHERE m.business_id=NEW.business_id AND coalesce(m.status,'ACTIVE')='ACTIVE' AND upper(m.role) IN('OWNER','BUSINESS_OWNER') ORDER BY m.created_at LIMIT 1;
 IF v_owner IS NOT NULL THEN PERFORM public.legal_assert_action(v_owner,'COMMISSION_PROGRAM',NEW.business_id); END IF;
 RETURN NEW;
END;$$;


ALTER FUNCTION "public"."legal_gate_commission_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."legal_gate_employee_activation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
 IF NEW.status='ACTIVE' AND coalesce(OLD.status,'')<>'ACTIVE' AND upper(NEW.role) IN('EMPLOYEE','STAFF') THEN
   PERFORM public.legal_assert_action(NEW.user_id,'EMPLOYEE_ACTIVATION',NEW.business_id);
 END IF;
 RETURN NEW;
END;$$;


ALTER FUNCTION "public"."legal_gate_employee_activation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."legal_gate_order_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_owner uuid;
BEGIN
 IF NEW.customer_id IS NOT NULL THEN PERFORM public.legal_assert_action(NEW.customer_id,'BUSINESS_TRANSACTION',NEW.business_id); END IF;
 SELECT m.user_id INTO v_owner FROM public.user_memberships m WHERE m.business_id=NEW.business_id AND coalesce(m.status,'ACTIVE')='ACTIVE'
   AND upper(m.role) IN('OWNER','BUSINESS_OWNER') ORDER BY m.created_at LIMIT 1;
 IF v_owner IS NOT NULL THEN PERFORM public.legal_assert_action(v_owner,'BUSINESS_TRANSACTION',NEW.business_id); END IF;
 RETURN NEW;
END;$$;


ALTER FUNCTION "public"."legal_gate_order_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."legal_gate_referral_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
 IF NEW.referrer_user_id IS NOT NULL THEN PERFORM public.legal_assert_action(NEW.referrer_user_id,'REFERRAL_PROGRAM',NULL); END IF;
 RETURN NEW;
END;$$;


ALTER FUNCTION "public"."legal_gate_referral_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."legal_is_admin"("p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_memberships m WHERE m.user_id=p_user_id AND coalesce(m.status,'ACTIVE')='ACTIVE' AND upper(m.role) IN('SUPER_ADMIN','ADMIN','LEGAL_ADMIN'));
$$;


ALTER FUNCTION "public"."legal_is_admin"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."legal_publish_version"("p_actor_user_id" "uuid", "p_document_id" "uuid", "p_version_number" integer, "p_effective_at" timestamp with time zone DEFAULT "now"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE v_id uuid;v_hash text;v_content text;v_type text;
BEGIN
 IF NOT private.legal_is_admin(p_actor_user_id) THEN RAISE EXCEPTION 'LEGAL_ADMIN_REQUIRED'; END IF;
 SELECT v.id,v.content,v.content_hash,d.document_type INTO v_id,v_content,v_hash,v_type FROM public.legal_document_versions v JOIN public.legal_documents d ON d.id=v.document_id WHERE v.document_id=p_document_id AND v.version_number=p_version_number AND v.status='DRAFT' FOR UPDATE;
 IF v_id IS NULL OR length(trim(v_content))<1 OR upper(trim(v_content))='LEGAL_CONTENT_PENDING_APPROVAL' THEN RAISE EXCEPTION 'LEGAL_CONTENT_REQUIRED'; END IF;
 IF v_hash IS NULL OR length(v_hash)<32 THEN RAISE EXCEPTION 'LEGAL_CONTENT_HASH_REQUIRED'; END IF;
 UPDATE public.legal_document_versions SET status='PUBLISHED',published_at=coalesce(p_effective_at,now()),effective_at=coalesce(p_effective_at,now()) WHERE id=v_id;
 UPDATE public.legal_documents SET status='PUBLISHED',published_at=coalesce(p_effective_at,now()),effective_at=coalesce(p_effective_at,now()),updated_by=p_actor_user_id,updated_at=now() WHERE id=p_document_id;
 UPDATE public.legal_requirements SET enabled=true,updated_at=now() WHERE document_type=v_type AND required=true;
 INSERT INTO public.consent_audit_log(actor_user_id,event_type,document_id,document_version_id,event_at,metadata) VALUES(p_actor_user_id,'LEGAL_VERSION_PUBLISHED',p_document_id,v_id,now(),jsonb_build_object('version_number',p_version_number,'enforcement_enabled',true));
 RETURN jsonb_build_object('document_id',p_document_id,'version_id',v_id,'status','PUBLISHED');
END;$$;


ALTER FUNCTION "public"."legal_publish_version"("p_actor_user_id" "uuid", "p_document_id" "uuid", "p_version_number" integer, "p_effective_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."legal_suspend_document"("p_actor_user_id" "uuid", "p_document_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE v_doc public.legal_documents; v_previous_status text;
BEGIN
  IF NOT private.legal_is_admin(p_actor_user_id) THEN RAISE EXCEPTION 'LEGAL_ADMIN_REQUIRED'; END IF;
  SELECT * INTO v_doc FROM public.legal_documents WHERE id=p_document_id FOR UPDATE;
  IF NOT FOUND OR v_doc.status NOT IN('PUBLISHED','DRAFT') THEN RAISE EXCEPTION 'LEGAL_DOCUMENT_NOT_FOUND_OR_ALREADY_RETIRED'; END IF;
  v_previous_status:=v_doc.status;
  UPDATE public.legal_documents SET status='SUSPENDED',updated_by=p_actor_user_id,updated_at=now() WHERE id=p_document_id;
  INSERT INTO public.consent_audit_log(actor_user_id,event_type,document_id,event_at,metadata)
  VALUES(p_actor_user_id,'LEGAL_DOCUMENT_SUSPENDED',p_document_id,now(),jsonb_build_object('previous_status',v_previous_status));
  RETURN jsonb_build_object('id',p_document_id,'status','SUSPENDED');
END;
$$;


ALTER FUNCTION "public"."legal_suspend_document"("p_actor_user_id" "uuid", "p_document_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."legal_update_document"("p_actor_user_id" "uuid", "p_document_id" "uuid", "p_title" "text", "p_target_audience" "text"[], "p_required_consent" boolean, "p_requires_reconsent" boolean, "p_sector_codes" "text"[] DEFAULT ARRAY[]::"text"[], "p_locale" "text" DEFAULT 'ar-EG'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE v_doc public.legal_documents;
BEGIN
  IF NOT private.legal_is_admin(p_actor_user_id) THEN RAISE EXCEPTION 'LEGAL_ADMIN_REQUIRED'; END IF;
  SELECT * INTO v_doc FROM public.legal_documents WHERE id=p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEGAL_DOCUMENT_NOT_FOUND'; END IF;
  IF v_doc.status='RETIRED' THEN RAISE EXCEPTION 'LEGAL_DOCUMENT_RETIRED'; END IF;
  IF nullif(trim(coalesce(p_title,'')),'') IS NULL THEN RAISE EXCEPTION 'LEGAL_TITLE_REQUIRED'; END IF;
  UPDATE public.legal_documents
     SET title=trim(p_title),
         target_audience=coalesce(p_target_audience,ARRAY['ALL']::text[]),
         required_consent=coalesce(p_required_consent,false),
         requires_reconsent=coalesce(p_requires_reconsent,false),
         sector_codes=coalesce(p_sector_codes,ARRAY[]::text[]),
         locale=coalesce(nullif(trim(p_locale),''),'ar-EG'),
         updated_by=p_actor_user_id,
         updated_at=now()
   WHERE id=p_document_id;
  INSERT INTO public.consent_audit_log(actor_user_id,event_type,document_id,event_at,metadata)
  VALUES(p_actor_user_id,'LEGAL_DOCUMENT_UPDATED',p_document_id,now(),jsonb_build_object('title',trim(p_title)));
  SELECT * INTO v_doc FROM public.legal_documents WHERE id=p_document_id;
  RETURN jsonb_build_object('id',v_doc.id,'status',v_doc.status,'updated_at',v_doc.updated_at);
END;
$$;


ALTER FUNCTION "public"."legal_update_document"("p_actor_user_id" "uuid", "p_document_id" "uuid", "p_title" "text", "p_target_audience" "text"[], "p_required_consent" boolean, "p_requires_reconsent" boolean, "p_sector_codes" "text"[], "p_locale" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."legal_update_draft_version"("p_actor_user_id" "uuid", "p_version_id" "uuid", "p_content" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE v_version public.legal_document_versions; v_hash text;
BEGIN
  IF NOT private.legal_is_admin(p_actor_user_id) THEN RAISE EXCEPTION 'LEGAL_ADMIN_REQUIRED'; END IF;
  IF nullif(trim(coalesce(p_content,'')),'') IS NULL THEN RAISE EXCEPTION 'LEGAL_CONTENT_REQUIRED'; END IF;
  SELECT * INTO v_version FROM public.legal_document_versions WHERE id=p_version_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEGAL_VERSION_NOT_FOUND'; END IF;
  IF v_version.status<>'DRAFT' THEN RAISE EXCEPTION 'LEGAL_VERSION_NOT_DRAFT'; END IF;
  v_hash:=encode(digest(p_content,'sha256'),'hex');
  UPDATE public.legal_document_versions SET content=p_content, content_hash=v_hash WHERE id=p_version_id;
  INSERT INTO public.consent_audit_log(actor_user_id,event_type,document_id,document_version_id,event_at,metadata)
  VALUES(p_actor_user_id,'LEGAL_DRAFT_VERSION_UPDATED',v_version.document_id,p_version_id,now(),jsonb_build_object('version_number',v_version.version_number,'content_hash',v_hash));
  RETURN jsonb_build_object('id',p_version_id,'content_hash',v_hash,'status','DRAFT');
END;
$$;


ALTER FUNCTION "public"."legal_update_draft_version"("p_actor_user_id" "uuid", "p_version_id" "uuid", "p_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_mantigo_captain_rides_backend"("p_user_id" "uuid") RETURNS TABLE("id" "text", "customer_name" "text", "vehicle_category" "text", "ride_type" "text", "pickup_location" "text", "destination_location" "text", "proposed_price" numeric, "accepted_bid_id" "text", "status" "text", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
 if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 return query
 select r.id,r.customer_name,r.vehicle_category,r.ride_type,
        r.pickup_location,r.destination_location,r.proposed_price,r.accepted_bid_id,r.status,r.updated_at
 from public.mantigo_rides r
 join public.mantigo_bids b on b.ride_id=r.id and b.captain_id=p_user_id and b.status='ACCEPTED'
 order by r.updated_at desc
 limit 100;
end $$;


ALTER FUNCTION "public"."list_mantigo_captain_rides_backend"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_mantigo_customer_rides_backend"("p_user_id" "uuid", "p_ride_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null or p_user_id is null or v_user <> p_user_id then
    raise exception 'UNAUTHORIZED';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'ride', to_jsonb(r),
      'bids', coalesce((
        select jsonb_agg(to_jsonb(b) order by b.created_at asc)
        from public.mantigo_bids b
        where b.ride_id = r.id
      ), '[]'::jsonb),
      'financial', (
        select to_jsonb(f)
        from public.mantigo_financial_ledger f
        where f.ride_id = r.id
      ),
      'rating', (
        select to_jsonb(rt)
        from public.mantigo_ride_ratings rt
        where rt.ride_id = r.id and rt.customer_id = v_user
        limit 1
      )
    )
    order by r.created_at desc
  ), '[]'::jsonb)
  into v_result
  from public.mantigo_rides r
  where r.customer_id = v_user
    and (p_ride_id is null or r.id = p_ride_id);

  return v_result;
end;
$$;


ALTER FUNCTION "public"."list_mantigo_customer_rides_backend"("p_user_id" "uuid", "p_ride_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_open_mantigo_rides_backend"("p_user_id" "uuid") RETURNS TABLE("id" "text", "customer_name" "text", "vehicle_category" "text", "ride_type" "text", "pickup_location" "text", "destination_location" "text", "proposed_price" numeric, "note" "text", "status" "text", "created_at" timestamp with time zone, "bid_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
 if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 return query
 select r.id,r.customer_name,r.vehicle_category,r.ride_type,
        r.pickup_location,r.destination_location,r.proposed_price,r.note,r.status,r.created_at,
        count(b.id)::bigint
 from public.mantigo_rides r
 left join public.mantigo_bids b on b.ride_id=r.id and b.status='OFFERED'
 where r.status in ('OPEN','OPEN_FOR_BIDS') and r.customer_id<>p_user_id
 group by r.id
 order by r.created_at desc
 limit 100;
end $$;


ALTER FUNCTION "public"."list_open_mantigo_rides_backend"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lock_mantigo_fare_backend"("p_user_id" "uuid", "p_ride_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_customer uuid; v_captain uuid; v_amount numeric; v_status text; v_bid text;
  v_id text; v_key text;
  v_existing public.mantigo_financial_ledger%rowtype;
begin
  if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;

  select r.customer_id,r.status,r.accepted_bid_id,b.captain_id,b.offered_price
    into v_customer,v_status,v_bid,v_captain,v_amount
  from public.mantigo_rides r
  join public.mantigo_bids b on b.id=r.accepted_bid_id
  where r.id=p_ride_id
  for update of r;

  if v_customer is null then raise exception 'RIDE_OR_ACCEPTED_BID_NOT_FOUND'; end if;
  if p_user_id<>v_customer then raise exception 'CUSTOMER_REQUIRED'; end if;
  if v_status<>'ACCEPTED' then raise exception 'RIDE_MUST_BE_ACCEPTED'; end if;
  if v_amount is null or v_amount<=0 then raise exception 'INVALID_FARE'; end if;

  select * into v_existing from public.mantigo_financial_ledger where ride_id=p_ride_id for update;
  if found then
    return jsonb_build_object('id',v_existing.id,'ride_id',p_ride_id,'gross_amount',v_existing.gross_amount,
      'payment_status',v_existing.payment_status,'settlement_status',v_existing.settlement_status,'idempotent',true);
  end if;

  v_id:='MGO-FIN-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
  v_key:='MGO-FARE-'||p_ride_id;

  insert into public.mantigo_financial_ledger(
    id,ride_id,customer_id,captain_id,gross_amount,commission_amount,captain_net_amount,
    payment_status,settlement_status,idempotency_key,metadata
  ) values (
    v_id,p_ride_id,v_customer,v_captain,v_amount,0,v_amount,
    'REQUIRED','NOT_READY',v_key,
    jsonb_build_object('fare_locked',true,'accepted_bid_id',v_bid,'source','MANTIGO_ACCEPT')
  );

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,
    'MANTIGO_FARE_LOCKED','MANTIGO_FINANCIAL',v_id,'{}'::jsonb,
    jsonb_build_object('ride_id',p_ride_id,'gross_amount',v_amount,'payment_status','REQUIRED'),'SUCCESS');

  return jsonb_build_object('id',v_id,'ride_id',p_ride_id,'gross_amount',v_amount,
    'payment_status','REQUIRED','settlement_status','NOT_READY','idempotent',false);
end
$$;


ALTER FUNCTION "public"."lock_mantigo_fare_backend"("p_user_id" "uuid", "p_ride_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mantigo_accept_bid"("p_ride_id" "text", "p_bid_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from public.mantigo_rides r where r.id = p_ride_id and r.customer_id = (select auth.uid()) and r.status = 'SEARCHING_BIDS') then raise exception 'FORBIDDEN_OR_INVALID_RIDE_STATE'; end if;
  if not exists (select 1 from public.mantigo_bids b where b.id = p_bid_id and b.ride_id = p_ride_id) then raise exception 'BID_NOT_FOUND'; end if;
  update public.mantigo_rides set status = 'ACCEPTED', accepted_bid_id = p_bid_id, updated_at = now()
   where id = p_ride_id and customer_id = (select auth.uid()) and status = 'SEARCHING_BIDS';
  if not found then raise exception 'RIDE_STATE_CHANGED'; end if;
end; $$;


ALTER FUNCTION "public"."mantigo_accept_bid"("p_ride_id" "text", "p_bid_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mantigo_cancel_ride"("p_ride_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED'; end if;
  update public.mantigo_rides set status = 'CANCELLED', updated_at = now()
   where id = p_ride_id and customer_id = (select auth.uid()) and status not in ('COMPLETED','CANCELLED');
  if not found then raise exception 'FORBIDDEN_OR_INVALID_RIDE_STATE'; end if;
end; $$;


ALTER FUNCTION "public"."mantigo_cancel_ride"("p_ride_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mantigo_create_ride"("p_vehicle_category" "text", "p_ride_type" "text", "p_pickup_location" "text", "p_destination_location" "text", "p_proposed_price" numeric, "p_note" "text" DEFAULT ''::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_uid uuid := (select auth.uid()); v_id text;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_pickup_location is null or btrim(p_pickup_location) = '' or p_destination_location is null or btrim(p_destination_location) = '' then raise exception 'INVALID_ROUTE'; end if;
  if p_proposed_price is null or p_proposed_price <= 0 then raise exception 'INVALID_PRICE'; end if;
  v_id := 'ride_' || gen_random_uuid()::text;
  insert into public.mantigo_rides(id,customer_id,customer_name,customer_phone,vehicle_category,ride_type,pickup_location,destination_location,proposed_price,note,status)
  select v_id,v_uid,coalesce(u.raw_user_meta_data->>'full_name',''),coalesce(u.raw_user_meta_data->>'phone',''),p_vehicle_category,p_ride_type,btrim(p_pickup_location),btrim(p_destination_location),round(p_proposed_price,2),coalesce(p_note,''),'SEARCHING_BIDS'
  from auth.users u where u.id=v_uid;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  return v_id;
end; $$;


ALTER FUNCTION "public"."mantigo_create_ride"("p_vehicle_category" "text", "p_ride_type" "text", "p_pickup_location" "text", "p_destination_location" "text", "p_proposed_price" numeric, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mantigo_guard_bid_rate_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin perform public.mantigo_rate_limit_check('CREATE_BID',new.captain_id); return new; end; $$;


ALTER FUNCTION "public"."mantigo_guard_bid_rate_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mantigo_guard_ride_rate_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if new.customer_id is not null and new.idempotency_key is not null
     and exists (
       select 1 from public.mantigo_rides
       where customer_id = new.customer_id
         and idempotency_key = new.idempotency_key
     ) then
    return new;
  end if;
  perform public.mantigo_rate_limit_check('CREATE_RIDE', new.customer_id);
  return new;
end;
$$;


ALTER FUNCTION "public"."mantigo_guard_ride_rate_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mantigo_mutate"("p_action" "text", "p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  ride_id text;
  bid_id text;
  v_ride public.mantigo_rides%rowtype;
  v_bid public.mantigo_bids%rowtype;
  v_captain_id uuid;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'anonymous_session_not_allowed'; end if;
  case p_action
    when 'create_ride' then
      ride_id := nullif(p_payload->>'id','');
      if ride_id is null then raise exception 'ride_id_required'; end if;
      insert into public.mantigo_rides(id,customer_id,customer_name,customer_phone,vehicle_category,ride_type,pickup_location,destination_location,proposed_price,note,status)
      values(ride_id,uid,coalesce(p_payload->>'customer_name',''),coalesce(p_payload->>'customer_phone',''),coalesce(p_payload->>'vehicle_category','MALAKI'),coalesce(p_payload->>'ride_type','PASSENGER_RIDE'),coalesce(p_payload->>'pickup_location',''),coalesce(p_payload->>'destination_location',''),(p_payload->>'proposed_price')::numeric,coalesce(p_payload->>'note',''),'SEARCHING_BIDS');
      return jsonb_build_object('ok',true,'action',p_action,'id',ride_id);
    when 'update_price' then
      ride_id := nullif(p_payload->>'ride_id','');
      update public.mantigo_rides set proposed_price=(p_payload->>'new_price')::numeric,updated_at=now() where id=ride_id and customer_id=uid and status='SEARCHING_BIDS';
      if not found then raise exception 'ride_not_owned_or_not_editable'; end if;
      return jsonb_build_object('ok',true,'action',p_action,'id',ride_id);
    when 'submit_bid' then
      ride_id := nullif(p_payload->>'ride_id','');
      if not exists(select 1 from public.mantigo_rides r where r.id=ride_id and r.status='SEARCHING_BIDS') then raise exception 'ride_not_open_for_bids'; end if;
      bid_id := nullif(p_payload->>'id','');
      if bid_id is null then raise exception 'bid_id_required'; end if;
      insert into public.mantigo_bids(id,ride_id,captain_id,captain_name,captain_phone,captain_rating,vehicle_category,vehicle_model,vehicle_plate,offered_price,eta_minutes,captain_message)
      values(bid_id,ride_id,uid,coalesce(p_payload->>'captain_name',''),coalesce(p_payload->>'captain_phone',''),coalesce((p_payload->>'captain_rating')::numeric,0),coalesce(p_payload->>'vehicle_category','MALAKI'),coalesce(p_payload->>'vehicle_model',''),coalesce(p_payload->>'vehicle_plate',''),(p_payload->>'offered_price')::numeric,coalesce((p_payload->>'eta_minutes')::integer,0),coalesce(p_payload->>'captain_message',''));
      return jsonb_build_object('ok',true,'action',p_action,'id',bid_id);
    when 'accept_bid' then
      ride_id := nullif(p_payload->>'ride_id','');
      bid_id := nullif(p_payload->>'bid_id','');
      select b.* into v_bid from public.mantigo_bids b where b.id=bid_id and b.ride_id=ride_id;
      if not found then raise exception 'bid_not_found'; end if;
      update public.mantigo_rides set status='ACCEPTED',accepted_bid_id=bid_id,updated_at=now() where id=ride_id and customer_id=uid and status='SEARCHING_BIDS';
      if not found then raise exception 'ride_not_owned_or_not_searching'; end if;
      return jsonb_build_object('ok',true,'action',p_action,'ride_id',ride_id,'bid_id',bid_id);
    when 'cancel_ride' then
      ride_id := nullif(p_payload->>'ride_id','');
      update public.mantigo_rides set status='CANCELLED',updated_at=now() where id=ride_id and customer_id=uid and status not in ('COMPLETED','CANCELLED');
      if not found then raise exception 'ride_not_owned_or_not_cancellable'; end if;
      return jsonb_build_object('ok',true,'action',p_action,'id',ride_id);
    when 'rate_ride' then
      ride_id := nullif(p_payload->>'ride_id','');
      select r.* into v_ride from public.mantigo_rides r where r.id=ride_id and r.customer_id=uid and r.status='COMPLETED';
      if not found then raise exception 'ride_not_completed_or_not_owned'; end if;
      select b.captain_id into v_captain_id from public.mantigo_bids b where b.id=v_ride.accepted_bid_id and b.ride_id=ride_id;
      if v_captain_id is null then raise exception 'accepted_captain_not_found'; end if;
      insert into public.mantigo_ride_ratings(ride_id,customer_id,captain_id,rating,comment) values(ride_id,uid,v_captain_id,(p_payload->>'rating')::integer,coalesce(p_payload->>'comment',''));
      return jsonb_build_object('ok',true,'action',p_action,'ride_id',ride_id);
    else raise exception 'unsupported_action';
  end case;
end;
$$;


ALTER FUNCTION "public"."mantigo_mutate"("p_action" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mantigo_rate_limit_check"("p_action" "text", "p_actor" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_max integer; v_window integer; v_count bigint;
begin
 if p_actor is null then raise exception using errcode='28000',message='AUTH_REQUIRED'; end if;
 select max_events,window_minutes into v_max,v_window from public.mantigo_rate_limit_config where action=p_action;
 if v_max is null then raise exception using errcode='22023',message='RATE_LIMIT_CONFIG_MISSING'; end if;
 perform pg_advisory_xact_lock(hashtextextended('MANTIGO_RATE:'||p_action||':'||p_actor::text,0));
 if p_action='CREATE_RIDE' then
   select count(*) into v_count from public.mantigo_rides where customer_id=p_actor and created_at>=now()-make_interval(mins=>v_window);
 elsif p_action='CREATE_BID' then
   select count(*) into v_count from public.mantigo_bids where captain_id=p_actor and created_at>=now()-make_interval(mins=>v_window);
 else raise exception using errcode='22023',message='RATE_LIMIT_ACTION_UNSUPPORTED';
 end if;
 if v_count>=v_max then
   raise exception using errcode='P0001',message='RATE_LIMITED',detail=json_build_object('action',p_action,'max_events',v_max,'window_minutes',v_window)::text;
 end if;
end; $$;


ALTER FUNCTION "public"."mantigo_rate_limit_check"("p_action" "text", "p_actor" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mantigo_rate_ride"("p_ride_id" "text", "p_rating" integer, "p_comment" "text" DEFAULT ''::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_uid uuid:=auth.uid(); v_captain uuid; v_rating_id uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
  select b.captain_id into v_captain from public.mantigo_rides r join public.mantigo_bids b on b.id=r.accepted_bid_id where r.id=p_ride_id and r.customer_id=v_uid and r.status='COMPLETED';
  if v_captain is null then raise exception 'RIDE_NOT_COMPLETED_OR_NOT_OWNER'; end if;
  insert into public.mantigo_ride_ratings(ride_id,customer_id,captain_id,rating,comment)
  values(p_ride_id,v_uid,v_captain,p_rating,coalesce(p_comment,''))
  on conflict (ride_id,customer_id) do update set rating=excluded.rating,comment=excluded.comment
  returning id into v_rating_id;
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_uid,'MANTIGO_RIDE_RATED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,jsonb_build_object('rating',p_rating,'comment',coalesce(p_comment,'')),'SUCCESS');
  begin
    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_captain,'MANTIGO_RATING','تقييم جديد','تم استلام تقييم جديد لرحلتك على MantiGO.','MANTIGO_RIDE',p_ride_id);
  exception when others then
    insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
    values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_uid,'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,jsonb_build_object('notification_type','MANTIGO_RATING','error',sqlerrm),'PARTIAL');
  end;
  return v_rating_id;
end $$;


ALTER FUNCTION "public"."mantigo_rate_ride"("p_ride_id" "text", "p_rating" integer, "p_comment" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mantigo_submit_bid"("p_ride_id" "text", "p_offered_price" numeric, "p_captain_name" "text" DEFAULT ''::"text", "p_vehicle_category" "text" DEFAULT 'MALAKI'::"text", "p_vehicle_model" "text" DEFAULT ''::"text", "p_captain_message" "text" DEFAULT ''::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_uid uuid := (select auth.uid()); v_id text; v_customer uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_offered_price is null or p_offered_price <= 0 then raise exception 'INVALID_PRICE'; end if;
  select customer_id into v_customer from public.mantigo_rides where id=p_ride_id and status='SEARCHING_BIDS';
  if v_customer is null then raise exception 'RIDE_NOT_FOUND_OR_CLOSED'; end if;
  if v_customer = v_uid then raise exception 'SELF_BID_NOT_ALLOWED'; end if;
  v_id := 'bid_' || gen_random_uuid()::text;
  insert into public.mantigo_bids(id,ride_id,captain_id,captain_name,captain_phone,vehicle_category,vehicle_model,offered_price,captain_message)
  select v_id,p_ride_id,v_uid,coalesce(nullif(btrim(p_captain_name),''),coalesce(u.raw_user_meta_data->>'full_name','')),coalesce(u.raw_user_meta_data->>'phone',''),p_vehicle_category,coalesce(p_vehicle_model,''),round(p_offered_price,2),coalesce(p_captain_message,'')
  from auth.users u where u.id=v_uid;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  return v_id;
end; $$;


ALTER FUNCTION "public"."mantigo_submit_bid"("p_ride_id" "text", "p_offered_price" numeric, "p_captain_name" "text", "p_vehicle_category" "text", "p_vehicle_model" "text", "p_captain_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mantigo_update_proposed_price"("p_ride_id" "text", "p_new_price" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_new_price is null or p_new_price <= 0 then raise exception 'INVALID_PRICE'; end if;
  update public.mantigo_rides set proposed_price = round(p_new_price, 2), updated_at = now()
   where id = p_ride_id and customer_id = (select auth.uid()) and status = 'SEARCHING_BIDS';
  if not found then raise exception 'FORBIDDEN_OR_INVALID_RIDE_STATE'; end if;
end; $$;


ALTER FUNCTION "public"."mantigo_update_proposed_price"("p_ride_id" "text", "p_new_price" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notifications_read_backend"("p_notification_id" character varying DEFAULT NULL::character varying) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare n integer;
begin
 update public.notifications set read_at=coalesce(read_at,now()) where user_id=auth.uid() and (p_notification_id is null or id=p_notification_id);
 get diagnostics n=row_count; return n;
end; $$;


ALTER FUNCTION "public"."mark_notifications_read_backend"("p_notification_id" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_mantigo_ride_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_limit" integer DEFAULT 10) RETURNS TABLE("captain_id" "uuid", "vehicle_category" "text", "vehicle_model" "text", "rating" numeric, "completed_rides" integer, "distance_km" numeric, "match_score" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_customer uuid;
  v_category text;
  v_lat double precision;
  v_lon double precision;
  v_status text;
begin
  if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if p_limit is null or p_limit<1 or p_limit>50 then raise exception 'INVALID_LIMIT'; end if;

  select r.customer_id,r.vehicle_category,r.pickup_lat,r.pickup_lon,r.status
    into v_customer,v_category,v_lat,v_lon,v_status
  from public.mantigo_rides r
  where r.id=p_ride_id
  for update;

  if v_customer is null then raise exception 'RIDE_NOT_FOUND'; end if;
  if v_customer<>p_user_id then raise exception 'RIDE_OWNER_REQUIRED'; end if;
  if v_status not in ('OPEN','OPEN_FOR_BIDS','MATCHING') then raise exception 'RIDE_NOT_MATCHABLE'; end if;

  return query
  with candidates as (
    select
      c.captain_id,c.vehicle_category,c.vehicle_model,c.rating,c.completed_rides,
      case when v_lat is not null and v_lon is not null and c.current_lat is not null and c.current_lon is not null
        then 6371.0 * 2 * asin(sqrt(
          power(sin(radians(c.current_lat-v_lat)/2),2) +
          cos(radians(v_lat))*cos(radians(c.current_lat))*power(sin(radians(c.current_lon-v_lon)/2),2)
        ))
        else null end as distance_km,
      c.acceptance_rate,c.cancellation_rate,c.last_seen_at
    from public.mantigo_captain_profiles c
    where c.status='ACTIVE'
      and c.verification_status='VERIFIED'
      and c.availability_status='AVAILABLE'
      and c.vehicle_category=v_category
      and c.captain_id<>v_customer
  )
  select
    captain_id,vehicle_category,vehicle_model,rating,completed_rides,
    round(distance_km::numeric,2),
    round((
      least(rating/5.0,1)*35
      + least(completed_rides/100.0,1)*20
      + least(acceptance_rate/100.0,1)*15
      + greatest(0,1-least(cancellation_rate/100.0,1))*15
      + case
          when distance_km is null then 5
          when distance_km<=2 then 15
          when distance_km<=5 then 10
          when distance_km<=10 then 5
          else 0
        end
    )::numeric,2) as match_score
  from candidates
  where distance_km is null or distance_km<=50
  order by match_score desc, distance_km nulls last, last_seen_at desc nulls last
  limit p_limit;
end $$;


ALTER FUNCTION "public"."match_mantigo_ride_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mnty_active_membership"("p_tenant_id" character varying DEFAULT NULL::character varying, "p_business_id" "uuid" DEFAULT NULL::"uuid", "p_branch_id" character varying DEFAULT NULL::character varying) RETURNS TABLE("membership_id" character varying, "tenant_id" character varying, "organization_id" character varying, "business_id" "uuid", "branch_id" character varying, "role" character varying, "permissions" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select m.id,m.tenant_id,m.organization_id,m.business_id,m.branch_id,m.role,coalesce(m.permissions,'{}'::jsonb)
  from public.user_memberships m
  where m.user_id = auth.uid()
    and m.status = 'ACTIVE'
    and (p_tenant_id is null or m.tenant_id = p_tenant_id)
    and (p_business_id is null or m.business_id = p_business_id or m.business_id is null)
    and (p_branch_id is null or m.branch_id = p_branch_id or m.branch_id is null)
  order by
    case upper(m.role)
      when 'SUPER_ADMIN' then 0
      when 'OWNER' then 1
      when 'ADMIN' then 2
      when 'BUSINESS_OWNER' then 3
      when 'MANAGER' then 4
      when 'FINANCE_MANAGER' then 5
      when 'SERVICE_PROVIDER' then 6
      when 'STAFF' then 7
      else 99
    end,
    m.created_at asc
$$;


ALTER FUNCTION "public"."mnty_active_membership"("p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mnty_active_membership"("p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying) IS 'RC258 server-side RBAC scope resolver. Returns only active memberships for auth.uid and requested tenant/business/branch scope.';



CREATE OR REPLACE FUNCTION "public"."mnty_can"("p_permission" "text", "p_tenant_id" character varying DEFAULT NULL::character varying, "p_business_id" "uuid" DEFAULT NULL::"uuid", "p_branch_id" character varying DEFAULT NULL::character varying) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists(
    select 1
    from public.mnty_active_membership(p_tenant_id,p_business_id,p_branch_id) m
    where
      upper(m.role) = 'SUPER_ADMIN'
      and coalesce((m.permissions->>'scope') = 'PLATFORM',false)
      and coalesce((m.permissions->>'full_control')::boolean,false)
      or
      coalesce((m.permissions ->> p_permission)::boolean,false)
      or
      case upper(m.role)
        when 'OWNER' then p_permission in (
          'admin','owner','platform','all_modules','manage_users','manage_business',
          'manage_branches','manage_catalog','manage_orders','manage_crm',
          'manage_marketing','manage_finance','manage_content','manage_reports'
        )
        when 'BUSINESS_OWNER' then p_permission in (
          'owner','manage_business','manage_branches','manage_catalog',
          'manage_orders','manage_crm','manage_marketing','manage_content','manage_reports'
        )
        when 'ADMIN' then p_permission in (
          'admin','manage_users','manage_business','manage_branches','manage_catalog',
          'manage_orders','manage_crm','manage_marketing','manage_content','manage_reports'
        )
        when 'MANAGER' then p_permission in (
          'manage_branches','manage_catalog','manage_orders','manage_crm',
          'manage_marketing','manage_content','manage_reports'
        )
        when 'FINANCE_MANAGER' then p_permission in ('manage_finance','manage_reports')
        when 'SERVICE_PROVIDER' then p_permission in (
          'provider','provider_orders','provider_profile','provider_schedule','provider_finance'
        )
        when 'STAFF' then p_permission in ('staff','manage_orders','provider_orders')
        when 'SUPPORT_MANAGER' then p_permission in ('support','manage_crm','manage_reports')
        when 'SUPPORT' then p_permission in ('support')
        when 'EMPLOYEE' then p_permission in ('employee')
        when 'CUSTOMER' then p_permission in ('customer')
        else false
      end
  )
$$;


ALTER FUNCTION "public"."mnty_can"("p_permission" "text", "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mnty_can"("p_permission" "text", "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying) IS 'RC258 server-side RBAC permission contract. Enforces active membership, platform Super Admin authority, explicit permission overrides, and role defaults.';



CREATE OR REPLACE FUNCTION "public"."mnty_can_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select public.mnty_can('admin',null,null,null)
$$;


ALTER FUNCTION "public"."mnty_can_platform_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mnty_can_platform_admin"() IS 'RC258 convenience guard for authenticated platform administrators.';



CREATE OR REPLACE FUNCTION "public"."mnty_push_notification_hook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  hook_secret text;
begin
  select decrypted_secret into hook_secret
  from vault.decrypted_secrets
  where name = 'mnty_push_webhook_secret'
  limit 1;

  if hook_secret is null then
    return new;
  end if;

  perform extensions.http_post(
    url := 'https://moyhiluyhjsujhwlyeuu.supabase.co/functions/v1/mnty-push-dispatch',
    body := to_jsonb(new),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-mnty-push-secret', hook_secret
    ),
    timeout_milliseconds := 2000
  );

  return new;
exception when others then
  raise warning 'MantiqatiX push dispatch enqueue failed: %', SQLERRM;
  return new;
end;
$$;


ALTER FUNCTION "public"."mnty_push_notification_hook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."payment_financial_reconciliation_check"("p_tenant_id" character varying DEFAULT NULL::character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_succeeded bigint; v_reconciled bigint; v_missing bigint; v_exception bigint;
BEGIN
  IF p_tenant_id IS NULL AND auth.role() <> 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED'; END IF;
  SELECT count(*) INTO v_succeeded FROM public.payment_intents pi WHERE pi.status='SUCCEEDED' AND (p_tenant_id IS NULL OR pi.tenant_id=p_tenant_id);
  SELECT count(*) INTO v_reconciled FROM public.payment_financial_reconciliations r WHERE r.reconciliation_status='RECONCILED' AND (p_tenant_id IS NULL OR r.tenant_id=p_tenant_id);
  SELECT count(*) INTO v_missing FROM public.payment_intents pi LEFT JOIN public.payment_financial_reconciliations r ON r.tenant_id=pi.tenant_id AND r.payment_intent_id=pi.id WHERE pi.status='SUCCEEDED' AND r.id IS NULL AND (p_tenant_id IS NULL OR pi.tenant_id=p_tenant_id);
  SELECT count(*) INTO v_exception FROM public.payment_financial_reconciliations r WHERE r.reconciliation_status='EXCEPTION' AND (p_tenant_id IS NULL OR r.tenant_id=p_tenant_id);
  RETURN jsonb_build_object('status',CASE WHEN v_missing=0 AND v_exception=0 THEN 'PASS' ELSE 'EXCEPTION' END,'succeeded_payments',v_succeeded,'reconciled_payments',v_reconciled,'missing_reconciliation',v_missing,'reconciliation_exceptions',v_exception);
END;
$$;


ALTER FUNCTION "public"."payment_financial_reconciliation_check"("p_tenant_id" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_financial_journal"("p_entry" "jsonb", "p_lines" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
 v_id varchar:=COALESCE(p_entry->>'id',gen_random_uuid()::text); v_tenant varchar:=p_entry->>'tenant_id';
 v_total_debit numeric:=COALESCE((p_entry->>'total_debit')::numeric,0); v_total_credit numeric:=COALESCE((p_entry->>'total_credit')::numeric,0);
 v_line jsonb; v_line_count int:=0; v_line_debit numeric:=0; v_line_credit numeric:=0; v_account varchar;
BEGIN
 PERFORM public.assert_financial_membership(v_tenant);
 IF v_tenant IS NULL OR v_tenant='' THEN RAISE EXCEPTION 'TENANT_REQUIRED'; END IF;
 IF v_total_debit<=0 OR v_total_debit<>v_total_credit THEN RAISE EXCEPTION 'UNBALANCED_JOURNAL'; END IF;
 IF jsonb_typeof(p_lines)<>'array' OR jsonb_array_length(p_lines)=0 THEN RAISE EXCEPTION 'JOURNAL_LINES_REQUIRED'; END IF;
 FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
   v_account:=v_line->>'account_id';
   IF v_account IS NULL OR v_account='' THEN RAISE EXCEPTION 'ACCOUNT_REQUIRED'; END IF;
   IF COALESCE((v_line->>'debit')::numeric,0)<0 OR COALESCE((v_line->>'credit')::numeric,0)<0 THEN RAISE EXCEPTION 'NEGATIVE_LINE_AMOUNT'; END IF;
   IF COALESCE((v_line->>'debit')::numeric,0)>0 AND COALESCE((v_line->>'credit')::numeric,0)>0 THEN RAISE EXCEPTION 'LINE_CANNOT_HAVE_BOTH_DEBIT_AND_CREDIT'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.chart_of_accounts c WHERE c.id=v_account AND c.tenant_id=v_tenant AND c.is_active=true) THEN RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE_FOR_TENANT'; END IF;
   v_line_debit:=v_line_debit+COALESCE((v_line->>'debit')::numeric,0); v_line_credit:=v_line_credit+COALESCE((v_line->>'credit')::numeric,0); v_line_count:=v_line_count+1;
 END LOOP;
 IF v_line_count=0 OR v_line_debit<=0 OR v_line_debit<>v_total_debit OR v_line_credit<>v_total_credit OR v_line_debit<>v_line_credit THEN RAISE EXCEPTION 'JOURNAL_LINE_TOTAL_MISMATCH'; END IF;
 INSERT INTO public.journal_entries(id,tenant_id,organization_id,business_id,branch_id,entry_number,reference_type,reference_id,description,status,total_debit,total_credit,entry_date,posted_at,created_by)
 VALUES(v_id,v_tenant,NULLIF(p_entry->>'organization_id',''),NULLIF(p_entry->>'business_id','')::uuid,NULLIF(p_entry->>'branch_id',''),COALESCE(p_entry->>'entry_number',v_id),p_entry->>'reference_type',p_entry->>'reference_id',COALESCE(p_entry->>'description',''),'POSTED',v_total_debit,v_total_credit,COALESCE((p_entry->>'entry_date')::date,CURRENT_DATE),now(),auth.uid())
 ON CONFLICT(id) DO NOTHING;
 FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
   INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
   VALUES(COALESCE(v_line->>'id',gen_random_uuid()::text),v_id,v_line->>'account_id',COALESCE((v_line->>'line_number')::int,v_line_count+1),COALESCE((v_line->>'debit')::numeric,0),COALESCE((v_line->>'credit')::numeric,0),v_line->>'description') ON CONFLICT(id) DO NOTHING;
 END LOOP;
 INSERT INTO public.general_ledger(id,tenant_id,business_id,journal_entry_id,journal_line_id,account_id,debit,credit,running_balance,entry_date,posted_at)
 SELECT gen_random_uuid()::text,v_tenant,je.business_id,je.id,jel.id,jel.account_id,jel.debit,jel.credit,jel.debit-jel.credit,je.entry_date,now()
 FROM public.journal_entries je JOIN public.journal_entry_lines jel ON jel.journal_entry_id=je.id
 WHERE je.id=v_id AND NOT EXISTS(SELECT 1 FROM public.general_ledger gl WHERE gl.journal_line_id=jel.id);
 RETURN jsonb_build_object('id',v_id,'status','POSTED','line_count',v_line_count);
END; $$;


ALTER FUNCTION "public"."post_financial_journal"("p_entry" "jsonb", "p_lines" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_financial_journal_backend"("p_user_id" "uuid", "p_entry" "jsonb", "p_lines" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id varchar := coalesce(p_entry->>'id', gen_random_uuid()::text);
  v_tenant varchar := p_entry->>'tenant_id';
  v_total_debit numeric := coalesce((p_entry->>'total_debit')::numeric,0);
  v_total_credit numeric := coalesce((p_entry->>'total_credit')::numeric,0);
  v_line jsonb;
  v_line_count int := 0;
  v_line_debit numeric := 0;
  v_line_credit numeric := 0;
  v_account varchar;
  v_role text;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'USER_CONTEXT_MISMATCH';
  end if;
  if v_tenant is null or v_tenant='' then raise exception 'TENANT_REQUIRED'; end if;

  select upper(um.role) into v_role
  from public.user_memberships um
  where um.user_id=p_user_id
    and um.tenant_id::text=v_tenant
    and um.status='ACTIVE'
    and upper(um.role)=any(array['OWNER','BUSINESS_OWNER','ADMIN','MANAGER','ACCOUNTANT','FINANCE','FINANCE_MANAGER'])
  limit 1;

  if v_role is null then raise exception 'FINANCIAL_MEMBERSHIP_REQUIRED'; end if;
  if v_total_debit<=0 or v_total_debit<>v_total_credit then raise exception 'UNBALANCED_JOURNAL'; end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'JOURNAL_LINES_REQUIRED'; end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_account:=v_line->>'account_id';
    if v_account is null or v_account='' then raise exception 'ACCOUNT_REQUIRED'; end if;
    if coalesce((v_line->>'debit')::numeric,0)<0 or coalesce((v_line->>'credit')::numeric,0)<0 then raise exception 'NEGATIVE_LINE_AMOUNT'; end if;
    if coalesce((v_line->>'debit')::numeric,0)>0 and coalesce((v_line->>'credit')::numeric,0)>0 then raise exception 'LINE_CANNOT_HAVE_BOTH_DEBIT_AND_CREDIT'; end if;
    if not exists(select 1 from public.chart_of_accounts c where c.id=v_account and c.tenant_id=v_tenant and c.is_active=true) then raise exception 'ACCOUNT_NOT_ACTIVE_FOR_TENANT'; end if;
    v_line_debit:=v_line_debit+coalesce((v_line->>'debit')::numeric,0);
    v_line_credit:=v_line_credit+coalesce((v_line->>'credit')::numeric,0);
    v_line_count:=v_line_count+1;
  end loop;

  if v_line_count=0 or v_line_debit<=0 or v_line_debit<>v_total_debit or v_line_credit<>v_total_credit or v_line_debit<>v_line_credit then
    raise exception 'JOURNAL_LINE_TOTAL_MISMATCH';
  end if;

  insert into public.journal_entries(
    id,tenant_id,organization_id,business_id,branch_id,entry_number,reference_type,reference_id,
    description,status,total_debit,total_credit,entry_date,posted_at,created_by
  )
  values(
    v_id,v_tenant,nullif(p_entry->>'organization_id',''),nullif(p_entry->>'business_id','')::uuid,
    nullif(p_entry->>'branch_id',''),coalesce(p_entry->>'entry_number',v_id),p_entry->>'reference_type',
    p_entry->>'reference_id',coalesce(p_entry->>'description',''),'POSTED',v_total_debit,v_total_credit,
    coalesce((p_entry->>'entry_date')::date,current_date),now(),p_user_id
  )
  on conflict(id) do nothing;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into public.journal_entry_lines(
      id,journal_entry_id,account_id,line_number,debit,credit,description
    )
    values(
      coalesce(v_line->>'id',gen_random_uuid()::text),v_id,v_line->>'account_id',
      coalesce((v_line->>'line_number')::int,v_line_count+1),
      coalesce((v_line->>'debit')::numeric,0),coalesce((v_line->>'credit')::numeric,0),
      v_line->>'description'
    )
    on conflict(id) do nothing;
  end loop;

  insert into public.general_ledger(
    id,tenant_id,business_id,journal_entry_id,journal_line_id,account_id,debit,credit,running_balance,entry_date,posted_at
  )
  select gen_random_uuid()::text,v_tenant,je.business_id,je.id,jel.id,jel.account_id,jel.debit,jel.credit,
         jel.debit-jel.credit,je.entry_date,now()
  from public.journal_entries je
  join public.journal_entry_lines jel on jel.journal_entry_id=je.id
  where je.id=v_id
    and not exists(select 1 from public.general_ledger gl where gl.journal_line_id=jel.id);

  return jsonb_build_object('id',v_id,'status','POSTED','line_count',v_line_count);
end;
$$;


ALTER FUNCTION "public"."post_financial_journal_backend"("p_user_id" "uuid", "p_entry" "jsonb", "p_lines" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_legal_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$BEGIN RAISE EXCEPTION 'LEGAL_RECORD_IMMUTABLE';END;$$;


ALTER FUNCTION "public"."prevent_legal_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_order_financial_mutation_after_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payment_intents pi
    WHERE pi.order_id = OLD.id
      AND pi.status NOT IN ('CANCELLED','FAILED')
  ) THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.business_id IS DISTINCT FROM OLD.business_id
       OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
       OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.discount IS DISTINCT FROM OLD.discount
       OR NEW.tax IS DISTINCT FROM OLD.tax
       OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
       OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.items_json IS DISTINCT FROM OLD.items_json
       OR NEW.pricing_version IS DISTINCT FROM OLD.pricing_version
       OR NEW.pricing_snapshot IS DISTINCT FROM OLD.pricing_snapshot
       OR NEW.pricing_hash IS DISTINCT FROM OLD.pricing_hash
       OR NEW.pricing_authority IS DISTINCT FROM OLD.pricing_authority
    THEN
      RAISE EXCEPTION 'ORDER_FINANCIAL_FIELDS_LOCKED: authoritative order pricing/customer fields cannot change after payment intent creation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_order_financial_mutation_after_payment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_published_legal_version_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$BEGIN IF OLD.status='PUBLISHED' THEN RAISE EXCEPTION 'LEGAL_PUBLISHED_VERSION_IMMUTABLE';END IF;RETURN NEW;END;$$;


ALTER FUNCTION "public"."prevent_published_legal_version_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_support_ticket_security_field_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.requester_id IS DISTINCT FROM OLD.requester_id
  THEN
    RAISE EXCEPTION 'Protected support ticket fields cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_support_ticket_security_field_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preview_commission_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_module_id" character varying, "p_gross_amount" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r public.commission_rules%rowtype; v_commission numeric; v_net numeric;
begin
 perform public.assert_financial_membership(p_tenant_id);
 if p_gross_amount is null or p_gross_amount<0 then raise exception 'INVALID_GROSS_AMOUNT'; end if;
 select * into r from public.commission_rules
 where tenant_id=p_tenant_id and active=true
 and (business_id=p_business_id or business_id is null)
 and (module_id=p_module_id or module_id is null)
 order by case when business_id=p_business_id then 0 else 1 end,
          case when module_id=p_module_id then 0 else 1 end,
          updated_at desc limit 1;
 if not found then raise exception 'COMMISSION_RULE_NOT_CONFIGURED'; end if;
 if upper(coalesce(r.rule_type,'PERCENTAGE'))<>'PERCENTAGE' then raise exception 'COMMISSION_RULE_TYPE_UNSUPPORTED_FOR_ORDER_FLOW'; end if;
 if coalesce(r.percentage,0)<0 or coalesce(r.percentage,0)>100 then raise exception 'COMMISSION_RULE_INVALID'; end if;
 v_commission=round(p_gross_amount*coalesce(r.percentage,0)/100,2); v_net=round(p_gross_amount-v_commission,2);
 return jsonb_build_object('rule_id',r.id,'module_id',r.module_id,'rate_percent',r.percentage,'gross_amount',p_gross_amount,'commission_amount',v_commission,'provider_net_amount',v_net);
end $$;


ALTER FUNCTION "public"."preview_commission_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_module_id" character varying, "p_gross_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_verified_digital_page_payment_backend"("p_order_id" "uuid", "p_external_event_id" "text", "p_event_type" "text", "p_status" "text", "p_signature_verified" boolean, "p_amount" numeric, "p_currency" "text", "p_provider_transaction_id" "text", "p_provider_order_id" "text", "p_raw_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_order public.digital_page_orders%rowtype;
  v_event public.digital_page_payment_events%rowtype;
  v_next_payment_status text;
  v_next_fulfillment_status text;
begin
  if coalesce(p_signature_verified, false) is not true then
    raise exception 'DIGITAL_PAGE_SIGNATURE_REQUIRED';
  end if;
  if p_external_event_id is null or length(trim(p_external_event_id)) = 0 then
    raise exception 'DIGITAL_PAGE_EVENT_ID_REQUIRED';
  end if;
  if p_status not in ('SUCCEEDED', 'FAILED') then
    raise exception 'DIGITAL_PAGE_EVENT_STATUS_INVALID';
  end if;
  if p_amount is null or p_amount <= 0 or p_currency is null or length(trim(p_currency)) = 0 then
    raise exception 'DIGITAL_PAGE_AMOUNT_CURRENCY_INVALID';
  end if;

  select * into v_order
  from public.digital_page_orders
  where id = p_order_id and provider = 'PAYMOB'
  for update;
  if not found then
    raise exception 'DIGITAL_PAGE_ORDER_NOT_FOUND';
  end if;
  if abs(v_order.amount - p_amount) > 0.01
     or upper(v_order.currency) <> upper(p_currency) then
    raise exception 'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH';
  end if;

  select * into v_event
  from public.digital_page_payment_events
  where external_event_id = p_external_event_id;
  if found then
    if v_event.digital_page_order_id <> v_order.id then
      raise exception 'DIGITAL_PAGE_EVENT_ORDER_MISMATCH';
    end if;
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'payment_status', v_order.payment_status,
      'fulfillment_status', v_order.fulfillment_status
    );
  end if;

  insert into public.digital_page_payment_events(
    digital_page_order_id, provider, external_event_id, event_type,
    status, signature_verified, raw_payload
  ) values (
    v_order.id, 'PAYMOB', p_external_event_id, p_event_type,
    p_status, true, coalesce(p_raw_payload, '{}'::jsonb)
  );

  -- Never let a later or duplicate provider event downgrade an already paid order.
  if v_order.payment_status <> 'PENDING' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', false,
      'already_final', true,
      'payment_status', v_order.payment_status,
      'fulfillment_status', v_order.fulfillment_status
    );
  end if;

  v_next_payment_status := case when p_status = 'SUCCEEDED' then 'PAID' else 'FAILED' end;
  v_next_fulfillment_status := case when p_status = 'SUCCEEDED' then 'IN_REVIEW' else v_order.fulfillment_status end;

  update public.digital_page_orders
  set payment_status = v_next_payment_status,
      fulfillment_status = v_next_fulfillment_status,
      provider_transaction_id = p_provider_transaction_id,
      provider_order_id = coalesce(nullif(p_provider_order_id, ''), provider_order_id),
      updated_at = now()
  where id = v_order.id and payment_status = 'PENDING';

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'already_final', false,
    'payment_status', v_next_payment_status,
    'fulfillment_status', v_next_fulfillment_status
  );
end;
$$;


ALTER FUNCTION "public"."process_verified_digital_page_payment_backend"("p_order_id" "uuid", "p_external_event_id" "text", "p_event_type" "text", "p_status" "text", "p_signature_verified" boolean, "p_amount" numeric, "p_currency" "text", "p_provider_transaction_id" "text", "p_provider_order_id" "text", "p_raw_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_verified_provider_payment"("p_event_id" character varying, "p_tenant_id" character varying, "p_provider" character varying, "p_external_event_id" character varying, "p_payment_intent_id" character varying, "p_event_type" character varying, "p_signature_verified" boolean, "p_provider_confirmed_amount" numeric, "p_provider_confirmed_currency" character varying, "p_platform_received_amount" numeric DEFAULT NULL::numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_intent record; v_order record; v_commission numeric := 0; v_rule record;
  v_platform_received numeric := greatest(0, coalesce(p_platform_received_amount,0));
  v_existing_event public.payment_provider_events%rowtype;
  v_commission_tx_id varchar := 'electronic_commission:' || p_payment_intent_id;
  v_reconciliation_id varchar := 'payment_reconciliation:' || p_payment_intent_id;
BEGIN
  IF NOT p_signature_verified THEN RAISE EXCEPTION 'WEBHOOK_SIGNATURE_NOT_VERIFIED'; END IF;
  IF p_provider_confirmed_amount IS NULL OR p_provider_confirmed_amount <= 0 THEN RAISE EXCEPTION 'INVALID_PROVIDER_AMOUNT'; END IF;
  SELECT * INTO v_intent FROM public.payment_intents WHERE id=p_payment_intent_id::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_INTENT_NOT_FOUND'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=v_intent.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_intent.tenant_id::text <> p_tenant_id::text OR v_order.tenant_id::text <> p_tenant_id::text OR v_intent.provider <> p_provider THEN RAISE EXCEPTION 'TENANT_OR_PROVIDER_MISMATCH'; END IF;
  IF v_order.status = 'CANCELLED' THEN RAISE EXCEPTION 'ORDER_CANCELLED'; END IF;
  IF v_intent.pricing_hash IS NULL OR v_order.pricing_hash IS NULL OR v_intent.pricing_hash <> v_order.pricing_hash OR v_intent.pricing_version IS DISTINCT FROM v_order.pricing_version OR v_order.pricing_authority IS NULL THEN RAISE EXCEPTION 'PRICING_BINDING_MISMATCH'; END IF;
  IF v_intent.amount <> v_order.total OR v_intent.currency <> v_order.currency OR p_provider_confirmed_amount <> v_order.total OR p_provider_confirmed_currency <> v_order.currency THEN RAISE EXCEPTION 'PROVIDER_FINANCIAL_MISMATCH'; END IF;
  SELECT * INTO v_existing_event FROM public.payment_provider_events WHERE provider=p_provider AND external_event_id=p_external_event_id LIMIT 1;
  IF FOUND THEN
    IF v_existing_event.payment_intent_id::text <> p_payment_intent_id::text THEN RAISE EXCEPTION 'EXTERNAL_EVENT_REPLAY_MISMATCH'; END IF;
    RETURN jsonb_build_object('status','success','idempotent',true,'payment_intent_id',p_payment_intent_id,'reconciliation_id',v_reconciliation_id);
  END IF;
  IF v_intent.status = 'SUCCEEDED' THEN
    INSERT INTO public.payment_provider_events(id,tenant_id,provider,event_type,payment_intent_id,external_event_id,status,signature_verified,raw_payload,processed_at)
    VALUES (p_event_id,p_tenant_id,p_provider,p_event_type,p_payment_intent_id,p_external_event_id,'PROCESSED',true,'{}'::jsonb,now()) ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('status','success','idempotent',true,'payment_intent_id',p_payment_intent_id,'reconciliation_id',v_reconciliation_id);
  END IF;
  IF v_intent.status NOT IN ('CREATED','PENDING') THEN RAISE EXCEPTION 'INVALID_PAYMENT_STATE: %', v_intent.status; END IF;
  INSERT INTO public.payment_provider_events(id,tenant_id,provider,event_type,payment_intent_id,external_event_id,status,signature_verified,raw_payload,processed_at)
  VALUES (p_event_id,p_tenant_id,p_provider,p_event_type,p_payment_intent_id,p_external_event_id,'PROCESSED',true,'{}'::jsonb,now());
  SELECT cr.id,cr.rule_type,cr.percentage,cr.fixed_amount INTO v_rule
  FROM public.commission_rules cr
  WHERE cr.tenant_id=p_tenant_id AND cr.active=true AND (cr.business_id=v_order.business_id OR cr.business_id IS NULL)
  ORDER BY CASE WHEN cr.business_id=v_order.business_id THEN 0 ELSE 1 END, cr.updated_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMISSION_RULE_NOT_CONFIGURED'; END IF;
  IF upper(coalesce(v_rule.rule_type,'PERCENTAGE'))='PERCENTAGE' THEN
    v_commission := round(v_intent.amount*coalesce(v_rule.percentage,0)/100,2);
  ELSIF upper(v_rule.rule_type) IN ('FIXED','FIXED_PER_ORDER') THEN
    v_commission := greatest(0,coalesce(v_rule.fixed_amount,0));
  ELSE RAISE EXCEPTION 'COMMISSION_RULE_TYPE_UNSUPPORTED'; END IF;
  IF v_commission > v_intent.amount THEN RAISE EXCEPTION 'COMMISSION_EXCEEDS_ORDER'; END IF;
  UPDATE public.payment_intents SET status='SUCCEEDED',updated_at=now() WHERE id=v_intent.id;
  v_platform_received := greatest(0,least(v_platform_received,v_commission));
  INSERT INTO public.financial_obligations(id,tenant_id,business_id,order_id,payment_intent_id,beneficiary_type,beneficiary_id,obligation_type,gross_amount,amount,currency,status,payment_method,settled_at,metadata)
  VALUES ('electronic_commission:'||v_intent.id::text,p_tenant_id,v_order.business_id,v_order.id,v_intent.id::text,'PLATFORM','PLATFORM','PLATFORM_COMMISSION',v_intent.amount,v_commission,v_intent.currency,CASE WHEN v_platform_received>=v_commission THEN 'SETTLED' ELSE 'DUE' END,v_intent.payment_method,CASE WHEN v_platform_received>=v_commission THEN now() ELSE NULL END,jsonb_build_object('settlement_mode','PROVIDER_CONFIRMED','provider',p_provider,'provider_event_id',p_external_event_id,'platform_received_amount',v_platform_received,'commission_rule_id',v_rule.id))
  ON CONFLICT(id) DO UPDATE SET status=excluded.status,settled_at=excluded.settled_at,metadata=excluded.metadata;
  INSERT INTO public.financial_obligations(id,tenant_id,business_id,order_id,payment_intent_id,beneficiary_type,beneficiary_id,obligation_type,gross_amount,amount,currency,status,payment_method,metadata)
  VALUES ('electronic_provider:'||v_intent.id::text,p_tenant_id,v_order.business_id,v_order.id,v_intent.id::text,'PROVIDER',coalesce(v_order.assigned_partner_id::text,v_order.business_id::text),'PROVIDER_PAYOUT',v_intent.amount,v_intent.amount-v_commission,v_intent.currency,'DUE',v_intent.payment_method,jsonb_build_object('settlement_mode','PROVIDER_CONFIRMED','provider',p_provider,'provider_event_id',p_external_event_id))
  ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.commission_transactions(id,tenant_id,business_id,order_id,rule_id,gross_amount,commission_amount,status)
  VALUES (v_commission_tx_id,p_tenant_id,v_order.business_id,v_order.id,v_rule.id,v_intent.amount,v_commission,'POSTED')
  ON CONFLICT(id) DO UPDATE SET gross_amount=excluded.gross_amount,commission_amount=excluded.commission_amount,rule_id=excluded.rule_id,status='POSTED';
  INSERT INTO public.payment_financial_reconciliations(id,tenant_id,payment_intent_id,provider_event_id,order_id,currency,gross_amount,commission_amount,provider_received_amount,provider_payout_amount,commission_obligation_id,provider_obligation_id,commission_transaction_id,reconciliation_status,ledger_status,metadata,updated_at)
  VALUES (v_reconciliation_id,p_tenant_id,p_payment_intent_id,p_external_event_id,v_order.id,v_intent.currency,v_intent.amount,v_commission,v_platform_received,v_intent.amount-v_commission,'electronic_commission:'||v_intent.id::text,'electronic_provider:'||v_intent.id::text,v_commission_tx_id,'RECONCILED','NOT_POSTED',jsonb_build_object('provider',p_provider,'provider_event_id',p_external_event_id,'ledger_note','Operational reconciliation complete; GL posting remains explicitly unposted until account mapping is configured'),now())
  ON CONFLICT(tenant_id,payment_intent_id) DO UPDATE SET provider_event_id=excluded.provider_event_id,gross_amount=excluded.gross_amount,commission_amount=excluded.commission_amount,provider_received_amount=excluded.provider_received_amount,provider_payout_amount=excluded.provider_payout_amount,commission_obligation_id=excluded.commission_obligation_id,provider_obligation_id=excluded.provider_obligation_id,commission_transaction_id=excluded.commission_transaction_id,reconciliation_status='RECONCILED',exception_code=null,updated_at=now();
  RETURN jsonb_build_object('status','success','idempotent',false,'payment_intent_id',v_intent.id,'gross_amount',v_intent.amount,'commission_amount',v_commission,'platform_received_amount',v_platform_received,'platform_commission_status',CASE WHEN v_platform_received>=v_commission THEN 'SETTLED' ELSE 'DUE' END,'provider_payout_status','DUE','reconciliation_status','RECONCILED','ledger_status','NOT_POSTED');
END;
$$;


ALTER FUNCTION "public"."process_verified_provider_payment"("p_event_id" character varying, "p_tenant_id" character varying, "p_provider" character varying, "p_external_event_id" character varying, "p_payment_intent_id" character varying, "p_event_type" character varying, "p_signature_verified" boolean, "p_provider_confirmed_amount" numeric, "p_provider_confirmed_currency" character varying, "p_platform_received_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_verified_subscription_payment"("p_event_id" "text", "p_external_event_id" "text", "p_subscription_payment_intent_id" "uuid", "p_provider_transaction_id" "text", "p_provider_confirmed_amount" numeric, "p_provider_confirmed_currency" "text", "p_signature_verified" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v public.subscription_payment_intents; v_owner uuid; v_sub public.business_subscriptions; v_existing public.payment_provider_events;
begin
 if not p_signature_verified then raise exception 'SUBSCRIPTION_PROVIDER_SIGNATURE_REQUIRED'; end if;
 select * into v from public.subscription_payment_intents where id=p_subscription_payment_intent_id for update;
 if not found then raise exception 'SUBSCRIPTION_PAYMENT_INTENT_NOT_FOUND'; end if;
 if abs(v.amount-round(p_provider_confirmed_amount::numeric,2))>0.01 or upper(v.currency)<>upper(p_provider_confirmed_currency) then raise exception 'SUBSCRIPTION_PAYMENT_AMOUNT_MISMATCH'; end if;
 select * into v_existing from public.payment_provider_events where provider='PAYMOB' and external_event_id=p_external_event_id limit 1;
 if v_existing.id is not null then return jsonb_build_object('ok',true,'idempotent',true,'status',v.status); end if;
 insert into public.payment_provider_events(id,tenant_id,provider,event_type,payment_intent_id,external_event_id,status,signature_verified,payload_hash,raw_payload,processed_at)
 values(coalesce(p_event_id,crypto.randomUUID()::text),(select tenant_id from public.businesses where id=v.business_id),'PAYMOB','SUBSCRIPTION',null,p_external_event_id,'PROCESSED',true,null,'{}'::jsonb,now());
 update public.subscription_payment_intents set status='SUCCEEDED',provider_transaction_id=p_provider_transaction_id,updated_at=now() where id=v.id;
 select m.user_id into v_owner from public.user_memberships m where m.business_id=v.business_id and m.status='ACTIVE' and upper(m.role) in ('OWNER','BUSINESS_OWNER') order by m.created_at limit 1;
 if v_owner is null then update public.subscription_payment_intents set status='PAID_PENDING_LEGAL',updated_at=now() where id=v.id; return jsonb_build_object('ok',false,'status','PAID_PENDING_LEGAL','reason','OWNER_NOT_FOUND'); end if;
 begin perform public.legal_assert_action(v_owner,'SUBSCRIPTION_ACTIVATION',v.business_id);
 exception when others then update public.subscription_payment_intents set status='PAID_PENDING_LEGAL',updated_at=now() where id=v.id; return jsonb_build_object('ok',false,'status','PAID_PENDING_LEGAL','reason',SQLERRM); end;
 update public.business_subscriptions set status='EXPIRED',ends_at=coalesce(ends_at,now()),updated_at=now() where business_id=v.business_id and status in ('TRIALING','ACTIVE','PENDING_PAYMENT');
 insert into public.business_subscriptions(business_id,tier_code,billing_cycle,status,sector,starts_at,ends_at,provider,provider_reference,source_payment_intent_id,idempotency_key,created_by)
 values(v.business_id,v.tier_code,v.billing_cycle,'ACTIVE',v.sector,now(),case when v.billing_cycle='ANNUAL' then now()+interval '1 year' else now()+interval '1 month' end,'PAYMOB',v.provider_transaction_id,v.id,'paid:'||v.id::text,v.created_by) returning * into v_sub;
 return jsonb_build_object('ok',true,'status','ACTIVE','subscription_id',v_sub.id,'payment_intent_id',v.id);
end; $$;


ALTER FUNCTION "public"."process_verified_subscription_payment"("p_event_id" "text", "p_external_event_id" "text", "p_subscription_payment_intent_id" "uuid", "p_provider_transaction_id" "text", "p_provider_confirmed_amount" numeric, "p_provider_confirmed_currency" "text", "p_signature_verified" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."receive_purchase_stock_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_purchase_order_id" character varying, "p_receipt_number" character varying, "p_warehouse_id" character varying, "p_product_id" "uuid", "p_received_quantity" numeric, "p_unit_cost" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
 v_user uuid := auth.uid();
 v_role text;
 v_branch character varying;
 v_existing jsonb;
 v_balance stock_balances%ROWTYPE;
 v_receipt erp_purchase_receipts%ROWTYPE;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF p_received_quantity IS NULL OR p_received_quantity <= 0 OR coalesce(p_unit_cost,0) < 0 THEN RAISE EXCEPTION 'INVALID_RECEIPT_AMOUNT'; END IF;
 IF coalesce(length(trim(p_id)),0) < 8 OR coalesce(length(trim(p_receipt_number)),0) < 1 THEN RAISE EXCEPTION 'INVALID_RECEIPT_REFERENCE'; END IF;
 SELECT role INTO v_role
 FROM user_memberships
 WHERE user_id=v_user AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE'
 LIMIT 1;
 IF v_role IS NULL OR upper(v_role) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF','ACCOUNTANT','FINANCE_MANAGER','FINANCE') THEN
   RAISE EXCEPTION 'PURCHASE_RECEIVING_ROLE_REQUIRED';
 END IF;
 SELECT branch_id INTO v_branch
 FROM warehouses
 WHERE id=p_warehouse_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE';
 IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_INVALID'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM catalog_items
   WHERE id=p_product_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE'
 ) THEN RAISE EXCEPTION 'PRODUCT_INVALID'; END IF;
 SELECT to_jsonb(r) INTO v_existing
 FROM erp_purchase_receipts r
 WHERE r.business_id=p_business_id AND r.receipt_number=p_receipt_number;
 IF v_existing IS NOT NULL THEN
   RETURN jsonb_build_object('success',true,'idempotent',true,'receipt',v_existing);
 END IF;
 SELECT * INTO v_balance
 FROM stock_balances
 WHERE tenant_id=p_tenant_id AND business_id=p_business_id AND warehouse_id=p_warehouse_id AND product_id=p_product_id
 FOR UPDATE;
 IF NOT FOUND THEN
   INSERT INTO stock_balances(id,tenant_id,business_id,branch_id,warehouse_id,product_id,quantity_on_hand,quantity_reserved)
   VALUES('sb-'||gen_random_uuid()::text,p_tenant_id,p_business_id,v_branch,p_warehouse_id,p_product_id,p_received_quantity,0)
   RETURNING * INTO v_balance;
 ELSE
   UPDATE stock_balances
   SET quantity_on_hand=quantity_on_hand+p_received_quantity,updated_at=now()
   WHERE id=v_balance.id
   RETURNING * INTO v_balance;
 END IF;
 INSERT INTO erp_purchase_receipts(id,tenant_id,business_id,purchase_order_id,receipt_number,warehouse_id,product_id,received_quantity,unit_cost,status,created_by)
 VALUES(p_id,p_tenant_id,p_business_id,p_purchase_order_id,p_receipt_number,p_warehouse_id,p_product_id,p_received_quantity,p_unit_cost,'RECEIVED',v_user)
 RETURNING * INTO v_receipt;
 INSERT INTO inventory_transactions(id,tenant_id,business_id,branch_id,warehouse_id,product_id,transaction_type,quantity,unit_cost,reference_id,created_by)
 VALUES('it-'||gen_random_uuid()::text,p_tenant_id,p_business_id,v_branch,p_warehouse_id,p_product_id,'PURCHASE_RECEIPT',p_received_quantity,p_unit_cost,v_receipt.id,v_user);
 RETURN jsonb_build_object('success',true,'idempotent',false,'receipt',to_jsonb(v_receipt),'balance',to_jsonb(v_balance));
END;
$$;


ALTER FUNCTION "public"."receive_purchase_stock_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_purchase_order_id" character varying, "p_receipt_number" character varying, "p_warehouse_id" character varying, "p_product_id" "uuid", "p_received_quantity" numeric, "p_unit_cost" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."receive_stock_transfer_backend"("p_transfer_id" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_user uuid:=auth.uid(); v_role text; t erp_stock_transfers%ROWTYPE; s stock_balances%ROWTYPE; d stock_balances%ROWTYPE; v_row jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 SELECT * INTO t FROM erp_stock_transfers WHERE id=p_transfer_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_NOT_FOUND'; END IF;
 SELECT role INTO v_role FROM user_memberships WHERE user_id=v_user AND tenant_id=t.tenant_id AND business_id=t.business_id AND status='ACTIVE' LIMIT 1;
 IF v_role IS NULL OR upper(v_role) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF') THEN RAISE EXCEPTION 'ERP_INVENTORY_ROLE_REQUIRED'; END IF;
 IF t.status='COMPLETED' THEN SELECT to_jsonb(t) INTO v_row; RETURN jsonb_build_object('success',true,'transfer',v_row,'idempotent',true); END IF;
 IF t.status<>'IN_TRANSIT' THEN RAISE EXCEPTION 'TRANSFER_NOT_IN_TRANSIT'; END IF;
 SELECT * INTO s FROM stock_balances WHERE tenant_id=t.tenant_id AND business_id=t.business_id AND warehouse_id=t.from_warehouse_id AND product_id=t.product_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_STOCK_NOT_INITIALIZED'; END IF;
 IF s.quantity_on_hand-s.quantity_reserved<t.quantity THEN RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_STOCK'; END IF;
 SELECT * INTO d FROM stock_balances WHERE tenant_id=t.tenant_id AND business_id=t.business_id AND warehouse_id=t.to_warehouse_id AND product_id=t.product_id FOR UPDATE;
 IF NOT FOUND THEN
   INSERT INTO stock_balances(id,tenant_id,business_id,branch_id,warehouse_id,product_id,quantity_on_hand,quantity_reserved)
   SELECT 'sb-'||gen_random_uuid()::text,t.tenant_id,t.business_id,w.branch_id,t.to_warehouse_id,t.product_id,0,0 FROM warehouses w WHERE w.id=t.to_warehouse_id
   RETURNING * INTO d;
 END IF;
 UPDATE stock_balances SET quantity_on_hand=quantity_on_hand-t.quantity,updated_at=now() WHERE id=s.id;
 UPDATE stock_balances SET quantity_on_hand=quantity_on_hand+t.quantity,updated_at=now() WHERE id=d.id;
 INSERT INTO inventory_transactions(id,tenant_id,business_id,branch_id,warehouse_id,product_id,transaction_type,quantity,unit_cost,reference_id,created_by)
 SELECT 'it-'||gen_random_uuid()::text,t.tenant_id,t.business_id,w.branch_id,t.from_warehouse_id,t.product_id,'TRANSFER_OUT',-t.quantity,0,t.id,v_user FROM warehouses w WHERE w.id=t.from_warehouse_id;
 INSERT INTO inventory_transactions(id,tenant_id,business_id,branch_id,warehouse_id,product_id,transaction_type,quantity,unit_cost,reference_id,created_by)
 SELECT 'it-'||gen_random_uuid()::text,t.tenant_id,t.business_id,w.branch_id,t.to_warehouse_id,t.product_id,'TRANSFER_IN',t.quantity,0,t.id,v_user FROM warehouses w WHERE w.id=t.to_warehouse_id;
 UPDATE erp_stock_transfers SET status='COMPLETED',updated_at=now() WHERE id=t.id RETURNING * INTO t;
 SELECT to_jsonb(t) INTO v_row;
 RETURN jsonb_build_object('success',true,'transfer',v_row);
END; $$;


ALTER FUNCTION "public"."receive_stock_transfer_backend"("p_transfer_id" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_cash_commission_due"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_provider_id" character varying, "p_gross_amount" numeric, "p_commission_amount" numeric, "p_currency" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.assert_financial_membership(p_tenant_id);
  if p_gross_amount < 0 or p_commission_amount < 0 or p_commission_amount > p_gross_amount then
    raise exception 'INVALID_CASH_COMMISSION';
  end if;
  insert into public.financial_obligations(
    id,tenant_id,business_id,order_id,beneficiary_type,beneficiary_id,
    obligation_type,gross_amount,amount,currency,status,payment_method,metadata
  ) values (
    p_id,p_tenant_id,p_business_id,p_order_id,'PLATFORM','PLATFORM',
    'PLATFORM_COMMISSION',p_gross_amount,p_commission_amount,coalesce(p_currency,'EGP'),
    'DUE','CASH','{"reason":"CUSTOMER_PAID_PROVIDER_DIRECTLY"}'::jsonb
  ) on conflict(id) do nothing;
  return jsonb_build_object('id',p_id,'status','DUE','amount',p_commission_amount);
end;
$$;


ALTER FUNCTION "public"."record_cash_commission_due"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_provider_id" character varying, "p_gross_amount" numeric, "p_commission_amount" numeric, "p_currency" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_legal_consent"("p_document_id" "uuid", "p_document_version_id" "uuid", "p_account_type" "text", "p_agreement_id" "uuid" DEFAULT NULL::"uuid", "p_ip_address" "text" DEFAULT NULL::"text", "p_user_agent" "text" DEFAULT NULL::"text", "p_device_info" "jsonb" DEFAULT '{}'::"jsonb", "p_session_id" "text" DEFAULT NULL::"text", "p_source" "text" DEFAULT 'APP'::"text", "p_consent_status" "text" DEFAULT 'ACCEPTED'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_uid uuid:=auth.uid();v_doc public.legal_documents;v_ver public.legal_document_versions;v_consent uuid;v_integrity text;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'LEGAL_AUTH_REQUIRED';END IF;
 IF upper(p_consent_status)<>'ACCEPTED' THEN RAISE EXCEPTION 'LEGAL_CONSENT_ONLY_ACCEPTED';END IF;
 SELECT * INTO v_doc FROM public.legal_documents WHERE id=p_document_id AND status='PUBLISHED';IF NOT FOUND THEN RAISE EXCEPTION 'LEGAL_DOCUMENT_NOT_PUBLISHED';END IF;
 SELECT * INTO v_ver FROM public.legal_document_versions WHERE id=p_document_version_id AND document_id=p_document_id AND status='PUBLISHED';IF NOT FOUND THEN RAISE EXCEPTION 'LEGAL_VERSION_NOT_PUBLISHED';END IF;
 IF coalesce(v_ver.effective_at,v_ver.published_at,now())>now() THEN RAISE EXCEPTION 'LEGAL_VERSION_NOT_EFFECTIVE';END IF;
 IF NOT(v_doc.target_audience @> ARRAY['ALL']::text[] OR v_doc.target_audience @> ARRAY[upper(p_account_type)]::text[]) THEN RAISE EXCEPTION 'LEGAL_AUDIENCE_NOT_ALLOWED';END IF;
 INSERT INTO public.user_consents(user_id,account_type,document_id,document_version_id,agreement_id,consent_status,ip_address,user_agent,device_info,session_id,content_hash,source)
 VALUES(v_uid,upper(p_account_type),p_document_id,p_document_version_id,p_agreement_id,'ACCEPTED',p_ip_address,p_user_agent,coalesce(p_device_info,'{}'::jsonb),p_session_id,v_ver.content_hash,upper(p_source)) RETURNING id INTO v_consent;
 v_integrity:=encode(digest(v_uid::text||':'||v_consent::text||':'||p_document_version_id::text||':'||v_ver.content_hash||':'||clock_timestamp()::text,'sha256'),'hex');
 INSERT INTO public.consent_audit_log(user_id,account_type,document_id,document_version_id,agreement_id,consent_id,event_type,consent_status,content_hash,ip_address,user_agent,device_info,session_id,actor_user_id,integrity_hash)
 VALUES(v_uid,upper(p_account_type),p_document_id,p_document_version_id,p_agreement_id,v_consent,'CONSENT_RECORDED','ACCEPTED',v_ver.content_hash,p_ip_address,p_user_agent,coalesce(p_device_info,'{}'::jsonb),p_session_id,v_uid,v_integrity);
 RETURN jsonb_build_object('consent_id',v_consent,'document_id',p_document_id,'document_version_id',p_document_version_id,'content_hash',v_ver.content_hash,'consented_at',now());
END;$$;


ALTER FUNCTION "public"."record_legal_consent"("p_document_id" "uuid", "p_document_version_id" "uuid", "p_account_type" "text", "p_agreement_id" "uuid", "p_ip_address" "text", "p_user_agent" "text", "p_device_info" "jsonb", "p_session_id" "text", "p_source" "text", "p_consent_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_legal_consent_backend"("p_user_id" "uuid", "p_document_id" "uuid", "p_document_version_id" "uuid", "p_account_type" "text", "p_agreement_id" "uuid" DEFAULT NULL::"uuid", "p_ip_address" "text" DEFAULT NULL::"text", "p_user_agent" "text" DEFAULT NULL::"text", "p_device_info" "jsonb" DEFAULT '{}'::"jsonb", "p_session_id" "text" DEFAULT NULL::"text", "p_source" "text" DEFAULT 'APP_EDGE'::"text", "p_consent_status" "text" DEFAULT 'ACCEPTED'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_doc public.legal_documents;v_ver public.legal_document_versions;v_consent uuid;v_integrity text;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'LEGAL_AUTH_REQUIRED'; END IF;
 IF upper(p_consent_status)<>'ACCEPTED' THEN RAISE EXCEPTION 'LEGAL_CONSENT_ONLY_ACCEPTED'; END IF;
 SELECT * INTO v_doc FROM public.legal_documents WHERE id=p_document_id AND status='PUBLISHED';IF NOT FOUND THEN RAISE EXCEPTION 'LEGAL_DOCUMENT_NOT_PUBLISHED';END IF;
 SELECT * INTO v_ver FROM public.legal_document_versions WHERE id=p_document_version_id AND document_id=p_document_id AND status='PUBLISHED';IF NOT FOUND THEN RAISE EXCEPTION 'LEGAL_VERSION_NOT_PUBLISHED';END IF;
 IF coalesce(v_ver.effective_at,v_ver.published_at,now())>now() THEN RAISE EXCEPTION 'LEGAL_VERSION_NOT_EFFECTIVE';END IF;
 IF NOT(v_doc.target_audience @> ARRAY['ALL']::text[] OR v_doc.target_audience @> ARRAY[upper(p_account_type)]::text[]) THEN RAISE EXCEPTION 'LEGAL_AUDIENCE_NOT_ALLOWED';END IF;
 INSERT INTO public.user_consents(user_id,account_type,document_id,document_version_id,agreement_id,consent_status,ip_address,user_agent,device_info,session_id,content_hash,source)
 VALUES(p_user_id,upper(p_account_type),p_document_id,p_document_version_id,p_agreement_id,'ACCEPTED',p_ip_address,p_user_agent,coalesce(p_device_info,'{}'::jsonb),p_session_id,v_ver.content_hash,upper(p_source)) RETURNING id INTO v_consent;
 v_integrity:=encode(digest(p_user_id::text||':'||v_consent::text||':'||p_document_version_id::text||':'||v_ver.content_hash||':'||clock_timestamp()::text,'sha256'),'hex');
 INSERT INTO public.consent_audit_log(user_id,account_type,document_id,document_version_id,agreement_id,consent_id,event_type,consent_status,content_hash,ip_address,user_agent,device_info,session_id,actor_user_id,integrity_hash)
 VALUES(p_user_id,upper(p_account_type),p_document_id,p_document_version_id,p_agreement_id,v_consent,'CONSENT_RECORDED','ACCEPTED',v_ver.content_hash,p_ip_address,p_user_agent,coalesce(p_device_info,'{}'::jsonb),p_session_id,p_user_id,v_integrity);
 RETURN jsonb_build_object('consent_id',v_consent,'document_id',p_document_id,'document_version_id',p_document_version_id,'content_hash',v_ver.content_hash,'consented_at',now());
END;$$;


ALTER FUNCTION "public"."record_legal_consent_backend"("p_user_id" "uuid", "p_document_id" "uuid", "p_document_version_id" "uuid", "p_account_type" "text", "p_agreement_id" "uuid", "p_ip_address" "text", "p_user_agent" "text", "p_device_info" "jsonb", "p_session_id" "text", "p_source" "text", "p_consent_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_refund_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_payment_intent_id" character varying, "p_customer_wallet_id" character varying, "p_original_amount" numeric, "p_refund_amount" numeric, "p_reason" "text", "p_idempotency_key" character varying, "p_journal_entry" "jsonb", "p_journal_lines" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_existing public.refund_transactions%rowtype;
  v_intent public.payment_intents%rowtype;
  v_order public.orders%rowtype;
  v_refunded numeric:=0;
  v_commission numeric:=0;
  v_comm public.commission_transactions%rowtype;
  v_journal_id varchar;
  v_wallet public.wallet_accounts%rowtype;
  v_wallet_balance numeric:=0;
  v_wallet_after numeric;
  v_wallet_tx_id varchar;
BEGIN
  perform public.assert_financial_membership(p_tenant_id);
  IF p_original_amount<=0 OR p_refund_amount<=0 OR p_refund_amount>p_original_amount THEN
    RAISE EXCEPTION 'REFUND_AMOUNT_INVALID';
  END IF;

  IF p_payment_intent_id IS NULL THEN RAISE EXCEPTION 'PAYMENT_INTENT_REQUIRED'; END IF;
  SELECT * INTO v_intent FROM public.payment_intents WHERE id=p_payment_intent_id FOR UPDATE;
  IF NOT FOUND OR v_intent.tenant_id<>p_tenant_id THEN RAISE EXCEPTION 'PAYMENT_INTENT_NOT_FOUND'; END IF;
  IF v_intent.status NOT IN ('SUCCEEDED','PARTIALLY_REFUNDED') THEN
    RAISE EXCEPTION 'REFUND_REQUIRES_SUCCEEDED_PAYMENT';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.tenant_id<>p_tenant_id OR v_intent.order_id<>p_order_id THEN
    RAISE EXCEPTION 'ORDER_PAYMENT_MISMATCH';
  END IF;
  IF v_intent.pricing_hash IS NULL OR v_order.pricing_hash IS NULL
     OR v_intent.pricing_hash<>v_order.pricing_hash
     OR v_intent.pricing_version IS DISTINCT FROM v_order.pricing_version THEN
    RAISE EXCEPTION 'PRICING_BINDING_MISMATCH';
  END IF;

  IF v_intent.amount<>p_original_amount OR p_refund_amount>v_intent.amount THEN
    RAISE EXCEPTION 'REFUND_AMOUNT_MISMATCH';
  END IF;

  SELECT * INTO v_existing FROM public.refund_transactions WHERE idempotency_key=p_idempotency_key LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('id',v_existing.id,'status',v_existing.status,'refund_amount',v_existing.refund_amount,
      'commission_reversed',v_existing.commission_reversed,'journal_entry_id',v_existing.journal_entry_id,'idempotent',true);
  END IF;

  SELECT coalesce(sum(refund_amount),0) INTO v_refunded
  FROM public.refund_transactions
  WHERE tenant_id=p_tenant_id AND order_id=p_order_id AND status='CONFIRMED';
  IF p_refund_amount>(p_original_amount-v_refunded) THEN RAISE EXCEPTION 'REFUND_EXCEEDS_REMAINING'; END IF;

  SELECT * INTO v_comm FROM public.commission_transactions WHERE tenant_id=p_tenant_id AND order_id=p_order_id LIMIT 1;
  IF FOUND THEN v_commission:=round(case when v_comm.gross_amount>0 then p_refund_amount*v_comm.commission_amount/v_comm.gross_amount else 0 end,2); END IF;

  v_journal_id:=p_journal_entry->>'id';
  IF coalesce(v_journal_id,'')='' THEN RAISE EXCEPTION 'JOURNAL_ID_REQUIRED'; END IF;

  IF p_customer_wallet_id IS NOT NULL THEN
    SELECT * INTO v_wallet FROM public.wallet_accounts WHERE id=p_customer_wallet_id AND tenant_id=p_tenant_id FOR UPDATE;
    IF NOT FOUND OR v_wallet.status<>'ACTIVE' THEN RAISE EXCEPTION 'WALLET_NOT_ACTIVE'; END IF;
    SELECT coalesce(sum(case when transaction_type in ('CREDIT','REFUND') then amount when transaction_type in ('DEBIT','COMMISSION_SETTLEMENT') then -amount else 0 end),0)
    INTO v_wallet_balance FROM public.wallet_transactions WHERE wallet_id=p_customer_wallet_id AND status='CONFIRMED';
    v_wallet_after:=v_wallet_balance+p_refund_amount;
    v_wallet_tx_id:='wtx_'||substr(md5(p_idempotency_key||':wallet'),1,16);
  END IF;

  perform public.post_financial_journal(p_journal_entry,p_journal_lines);

  INSERT INTO public.refund_transactions(
    id,tenant_id,business_id,order_id,payment_intent_id,refund_amount,commission_reversed,reason,status,idempotency_key,journal_entry_id
  ) VALUES (
    p_id,p_tenant_id,p_business_id,p_order_id,p_payment_intent_id,p_refund_amount,v_commission,p_reason,'CONFIRMED',
    p_idempotency_key,v_journal_id
  );

  IF p_customer_wallet_id IS NOT NULL THEN
    INSERT INTO public.wallet_transactions(
      id,tenant_id,wallet_id,transaction_type,amount,balance_after,idempotency_key,status,reference_type,reference_id,description,journal_entry_id
    ) VALUES (
      v_wallet_tx_id,p_tenant_id,p_customer_wallet_id,'REFUND',p_refund_amount,v_wallet_after,p_idempotency_key||':wallet',
      'CONFIRMED','ORDER_REFUND',p_order_id,'استرجاع مبلغ الطلب '||p_order_id,v_journal_id
    );
  END IF;

  UPDATE public.payment_intents pi
  SET updated_at=now(),
      status=case when pi.amount<=coalesce((select sum(r.refund_amount) from public.refund_transactions r where r.payment_intent_id=p_payment_intent_id and r.status='CONFIRMED'),0)
             then 'REFUNDED' else 'PARTIALLY_REFUNDED' end
  WHERE pi.id=p_payment_intent_id;

  IF v_comm.id IS NOT NULL THEN
    UPDATE public.commission_transactions
    SET status=case when commission_amount<=coalesce((select sum(r.commission_reversed) from public.refund_transactions r where r.tenant_id=p_tenant_id and r.order_id=p_order_id and r.status='CONFIRMED'),0)
                    then 'REFUNDED' else status end
    WHERE id=v_comm.id;
  END IF;

  RETURN jsonb_build_object('id',p_id,'status','CONFIRMED','refund_amount',p_refund_amount,
    'commission_reversed',v_commission,'journal_entry_id',v_journal_id,'idempotent',false);
END;
$$;


ALTER FUNCTION "public"."record_refund_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_payment_intent_id" character varying, "p_customer_wallet_id" character varying, "p_original_amount" numeric, "p_refund_amount" numeric, "p_reason" "text", "p_idempotency_key" character varying, "p_journal_entry" "jsonb", "p_journal_lines" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_indrive_bid"("p_request_id" "uuid", "p_bid_id" "uuid") RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select private.reject_indrive_bid_impl(p_request_id,p_bid_id);
$$;


ALTER FUNCTION "public"."reject_indrive_bid"("p_request_id" "uuid", "p_bid_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_digital_page_payment_intent_claim_backend"("p_order_id" "uuid", "p_user_id" "uuid", "p_claim_token" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'FORBIDDEN';
  end if;

  update public.digital_page_orders
  set metadata=metadata - 'payment_intent_claim',
      updated_at=now()
  where id=p_order_id
    and user_id=p_user_id
    and provider_intent_id is null
    and metadata->'payment_intent_claim'->>'token'=p_claim_token;

  return found;
end;
$$;


ALTER FUNCTION "public"."release_digital_page_payment_intent_claim_backend"("p_order_id" "uuid", "p_user_id" "uuid", "p_claim_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_commission_rule_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_module_id" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r public.commission_rules%rowtype;
begin
  perform public.assert_financial_membership(p_tenant_id);

  select * into r from public.commission_rules
  where tenant_id=p_tenant_id and active=true
    and (business_id=p_business_id or business_id is null)
    and (module_id=p_module_id or module_id is null)
  order by
    case when business_id=p_business_id then 0 else 1 end,
    case when module_id=p_module_id then 0 else 1 end,
    updated_at desc
  limit 1;

  if not found then raise exception 'COMMISSION_RULE_NOT_CONFIGURED'; end if;
  if upper(coalesce(r.rule_type,'PERCENTAGE')) <> 'PERCENTAGE' then
    raise exception 'COMMISSION_RULE_TYPE_UNSUPPORTED_FOR_ORDER_FLOW';
  end if;
  if coalesce(r.percentage,0) < 0 or coalesce(r.percentage,0) > 100 then
    raise exception 'COMMISSION_RULE_INVALID';
  end if;

  return jsonb_build_object('rule_id',r.id,'rate_percent',r.percentage,'rule_type',r.rule_type);
end;
$$;


ALTER FUNCTION "public"."resolve_commission_rule_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_module_id" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_legacy_scope"("p_branch_id" "text" DEFAULT NULL::"text") RETURNS TABLE("tenant_id" character varying, "business_id" "uuid", "branch_id" character varying)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_uid uuid:=auth.uid(); v_branch text; v_count int;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'unauthorized'; end if;
 if p_branch_id is not null and length(trim(p_branch_id))>0 then
   select b.tenant_id,b.business_id,b.id into tenant_id,business_id,branch_id
   from public.branches b
   where b.id=trim(p_branch_id) and b.status='ACTIVE'
     and (public.is_platform_admin() or exists(
       select 1 from public.user_memberships m
       where m.user_id=v_uid and m.branch_id=b.id and m.tenant_id=b.tenant_id
         and m.business_id=b.business_id and m.status='ACTIVE'
     ));
   if branch_id is null then raise exception 'forbidden_branch'; end if;
   return next; return;
 end if;
 if public.is_platform_admin() then raise exception 'branch_context_required'; end if;
 select count(distinct m.branch_id) into v_count
 from public.user_memberships m
 where m.user_id=v_uid and m.status='ACTIVE' and m.branch_id is not null;
 if v_count <> 1 then raise exception 'branch_context_required'; end if;
 select b.tenant_id,b.business_id,b.id into tenant_id,business_id,branch_id
 from public.branches b
 join public.user_memberships m on m.branch_id=b.id
 where m.user_id=v_uid and m.status='ACTIVE' and b.status='ACTIVE'
 limit 1;
 if branch_id is null then raise exception 'forbidden_branch'; end if;
 return next;
end $$;


ALTER FUNCTION "public"."resolve_legacy_scope"("p_branch_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_platform_feature"("p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_module_code" character varying, "p_feature_code" character varying DEFAULT NULL::character varying, "p_sector_id" character varying DEFAULT NULL::character varying) RETURNS TABLE("enabled" boolean, "source_scope" character varying, "configuration" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r record;
begin
 select f.enabled,f.scope_type,f.configuration into r from public.platform_feature_flags f
 where f.module_code=p_module_code and (f.feature_code is not distinct from p_feature_code)
 and ((f.scope_type='WIDGET' and f.branch_id is not distinct from p_branch_id and f.business_id is not distinct from p_business_id and f.tenant_id=p_tenant_id)
 or (f.scope_type='BRANCH' and f.branch_id is not distinct from p_branch_id and f.tenant_id=p_tenant_id and f.feature_code is null)
 or (f.scope_type='BUSINESS' and f.business_id is not distinct from p_business_id and f.tenant_id=p_tenant_id and f.feature_code is null)
 or (f.scope_type='TENANT' and f.tenant_id=p_tenant_id and f.feature_code is null)
 or (f.scope_type='SECTOR' and f.sector_id is not distinct from p_sector_id and f.feature_code is null)
 or (f.scope_type='GLOBAL' and f.feature_code is null))
 order by case f.scope_type when 'WIDGET' then 1 when 'BRANCH' then 2 when 'BUSINESS' then 3 when 'TENANT' then 4 when 'SECTOR' then 5 when 'GLOBAL' then 6 else 99 end limit 1;
 if not found then return query select true,'DEFAULT','{}'::jsonb; else return query select r.enabled,r.scope_type,r.configuration; end if;
end; $$;


ALTER FUNCTION "public"."resolve_platform_feature"("p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_module_code" character varying, "p_feature_code" character varying, "p_sector_id" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restaurant_erp_mutate"("p_action" "text", "p_payload" "jsonb", "p_idempotency_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ declare v_uid uuid:=auth.uid(); v_result jsonb; v_existing jsonb; s record; begin if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'unauthorized'; end if; if not public.is_platform_admin() and not exists(select 1 from public.user_memberships m where m.user_id=v_uid and m.status='ACTIVE' and upper(m.role) in ('BUSINESS_OWNER','OWNER','MANAGER','EMPLOYEE','STAFF','CASHIER')) then raise exception 'forbidden_business_role'; end if; if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>200 then raise exception 'invalid idempotency key'; end if; select response into v_existing from public.legacy_module_idempotency where module_code='RESTAURANT_ERP' and actor_user_id=v_uid and idempotency_key=p_idempotency_key; if found then return coalesce(v_existing,'{"status":"ok"}'::jsonb); end if; select * into s from public.resolve_legacy_scope(nullif(p_payload->>'branch_id','')); if p_action='toggle_menu_availability' then update public.restaurant_menu_items set is_available=(p_payload->>'is_available')::boolean,updated_at=now() where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning to_jsonb(restaurant_menu_items.*) into v_result; elsif p_action='delete_menu_item' then delete from public.restaurant_menu_items where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning jsonb_build_object('id',id,'deleted',true) into v_result; elsif p_action='create_menu_item' then insert into public.restaurant_menu_items(id,owner_user_id,tenant_id,business_id,branch_id,name_ar,description_ar,base_price_egp,original_price_egp,category,is_available,is_popular,created_at,updated_at) values(p_payload->>'id',v_uid,s.tenant_id,s.business_id,s.branch_id,p_payload->>'name_ar',coalesce(p_payload->>'description_ar',''),(p_payload->>'base_price_egp')::numeric,nullif(p_payload->>'original_price_egp','')::numeric,p_payload->>'category',coalesce((p_payload->>'is_available')::boolean,true),coalesce((p_payload->>'is_popular')::boolean,false),now(),now()) returning to_jsonb(restaurant_menu_items.*) into v_result; elsif p_action='create_order' then insert into public.restaurant_orders(id,owner_user_id,tenant_id,business_id,branch_id,customer_name,customer_phone,fulfillment_type,table_number,items,subtotal_egp,tax_egp,delivery_fee_egp,discount_egp,total_egp,status,notes_from_customer,delivery_pin_code,created_at,updated_at) values(p_payload->>'id',v_uid,s.tenant_id,s.business_id,s.branch_id,p_payload->>'customer_name',p_payload->>'customer_phone',p_payload->>'fulfillment_type',nullif(p_payload->>'table_number','')::integer,coalesce(p_payload->'items','[]'::jsonb),(p_payload->>'subtotal_egp')::numeric,(p_payload->>'tax_egp')::numeric,(p_payload->>'delivery_fee_egp')::numeric,coalesce((p_payload->>'discount_egp')::numeric,0),(p_payload->>'total_egp')::numeric,coalesce(p_payload->>'status','NEW'),coalesce(p_payload->>'notes_from_customer',''),coalesce(p_payload->>'delivery_pin_code',''),now(),now()) returning to_jsonb(restaurant_orders.*) into v_result; elsif p_action='update_order_status' then update public.restaurant_orders set status=p_payload->>'status',driver_name=coalesce(p_payload->>'driver_name',driver_name),driver_phone=coalesce(p_payload->>'driver_phone',driver_phone),updated_at=now() where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning to_jsonb(restaurant_orders.*) into v_result; elsif p_action='restock_inventory' then update public.restaurant_inventory set current_stock_qty=current_stock_qty+(p_payload->>'added_qty')::numeric,updated_at=now() where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning jsonb_build_object('id',id,'current_stock_qty',current_stock_qty) into v_result; else raise exception 'unsupported restaurant action'; end if; if v_result is null then raise exception 'target not found or mutation failed'; end if; insert into public.legacy_module_idempotency(module_code,actor_user_id,idempotency_key,request_hash,response) values('RESTAURANT_ERP',v_uid,md5(coalesce(p_action,'')||':'||coalesce(p_payload::text,'')||':'||s.branch_id),v_result); return v_result; end $$;


ALTER FUNCTION "public"."restaurant_erp_mutate"("p_action" "text", "p_payload" "jsonb", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restaurant_table_mutate"("p_action" "text", "p_payload" "jsonb", "p_idempotency_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ declare v_uid uuid:=auth.uid(); v_result jsonb; v_existing jsonb; s record; begin if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'unauthorized'; end if; if not public.is_platform_admin() and not exists(select 1 from public.user_memberships m where m.user_id=v_uid and m.status='ACTIVE' and upper(m.role) in ('BUSINESS_OWNER','OWNER','MANAGER','EMPLOYEE','STAFF','CASHIER')) then raise exception 'forbidden_business_role'; end if; if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>200 then raise exception 'invalid idempotency key'; end if; select response into v_existing from public.legacy_module_idempotency where module_code='RESTAURANT_TABLES' and actor_user_id=v_uid and idempotency_key=p_idempotency_key; if found then return coalesce(v_existing,'{"status":"ok"}'::jsonb); end if; select * into s from public.resolve_legacy_scope(nullif(p_payload->>'branch_id','')); if p_action='upsert_table' then insert into public.restaurant_tables(id,owner_user_id,tenant_id,business_id,branch_id,table_number,capacity_persons,status,current_active_order_id,current_bill_egp,reserved_customer_name) values(p_payload->>'id',v_uid,s.tenant_id,s.business_id,s.branch_id,(p_payload->>'table_number')::integer,(p_payload->>'capacity_persons')::integer,coalesce(p_payload->>'status','AVAILABLE'),nullif(p_payload->>'current_active_order_id',''),coalesce((p_payload->>'current_bill_egp')::numeric,0),nullif(p_payload->>'reserved_customer_name','')) on conflict(id) do update set table_number=excluded.table_number,capacity_persons=excluded.capacity_persons,status=excluded.status,current_active_order_id=excluded.current_active_order_id,current_bill_egp=excluded.current_bill_egp,reserved_customer_name=excluded.reserved_customer_name where restaurant_tables.tenant_id=s.tenant_id and restaurant_tables.business_id=s.business_id and restaurant_tables.branch_id=s.branch_id returning to_jsonb(restaurant_tables.*) into v_result; elsif p_action='update_status' then update public.restaurant_tables set status=p_payload->>'status',current_active_order_id=nullif(p_payload->>'current_active_order_id',''),current_bill_egp=coalesce((p_payload->>'current_bill_egp')::numeric,current_bill_egp),reserved_customer_name=nullif(p_payload->>'reserved_customer_name','') where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning to_jsonb(restaurant_tables.*) into v_result; elsif p_action='delete_table' then delete from public.restaurant_tables where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning jsonb_build_object('id',id,'deleted',true) into v_result; else raise exception 'unsupported restaurant table action'; end if; if v_result is null then raise exception 'target not found or mutation failed'; end if; insert into public.legacy_module_idempotency(module_code,actor_user_id,idempotency_key,request_hash,response) values('RESTAURANT_TABLES',v_uid,md5(coalesce(p_action,'')||':'||coalesce(p_payload::text,'')||':'||s.branch_id),v_result); return v_result; end $$;


ALTER FUNCTION "public"."restaurant_table_mutate"("p_action" "text", "p_payload" "jsonb", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reverse_journal_entry"("p_original_entry_id" character varying, "p_reason" "text", "p_reversed_by" character varying) RETURNS character varying
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_original journal_entries%ROWTYPE;
    v_reversal_id VARCHAR;
    v_line journal_entry_lines%ROWTYPE;
    v_line_counter INT := 1;
BEGIN
    SELECT * INTO v_original FROM journal_entries WHERE id = p_original_entry_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ENTRY_NOT_FOUND: Journal entry % does not exist.', p_original_entry_id;
    END IF;

    IF v_original.status != 'POSTED' THEN
        RAISE EXCEPTION 'INVALID_STATUS: Only POSTED journal entries can be reversed. Current status: %', v_original.status;
    END IF;

    v_reversal_id := 'je_rev_' || SUBSTRING(REPLACE(uuid_generate_v4()::text, '-', ''), 1, 16);

    -- Insert Draft Reversal Entry
    INSERT INTO journal_entries (
        id, tenant_id, organization_id, business_id, branch_id,
        entry_number, reference_type, reference_id, description,
        status, total_debit, total_credit, entry_date, created_by
    ) VALUES (
        v_reversal_id, v_original.tenant_id, v_original.organization_id, v_original.business_id, v_original.branch_id,
        'REV-' || v_original.entry_number, 'REVERSAL', v_original.id,
        'قيد عكسي للقيد رقم ' || v_original.entry_number || ': ' || p_reason,
        'DRAFT', v_original.total_credit, v_original.total_debit, CURRENT_DATE, p_reversed_by
    );

    -- Invert Lines (Debit becomes Credit, Credit becomes Debit)
    FOR v_line IN (SELECT * FROM journal_entry_lines WHERE journal_entry_id = p_original_entry_id) LOOP
        INSERT INTO journal_entry_lines (
            id, journal_entry_id, account_id, line_number, debit, credit, description
        ) VALUES (
            'jel_rev_' || SUBSTRING(REPLACE(uuid_generate_v4()::text, '-', ''), 1, 16),
            v_reversal_id,
            v_line.account_id,
            v_line_counter,
            v_line.credit, -- swapped
            v_line.debit,  -- swapped
            'عكس بند: ' || COALESCE(v_line.description, '')
        );
        v_line_counter := v_line_counter + 1;
    END LOOP;

    -- Post the reversal entry
    UPDATE journal_entries 
    SET status = 'POSTED', posted_at = CURRENT_TIMESTAMP 
    WHERE id = v_reversal_id;

    -- Update original entry status to REVERSED pointing to reversal
    UPDATE journal_entries
    SET status = 'REVERSED', reversed_by_entry_id = v_reversal_id, updated_at = CURRENT_TIMESTAMP
    WHERE id = p_original_entry_id;

    RETURN v_reversal_id;
END;
$$;


ALTER FUNCTION "public"."reverse_journal_entry"("p_original_entry_id" character varying, "p_reason" "text", "p_reversed_by" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_mantigo_captain_application"("p_admin_user_id" "uuid", "p_captain_id" "uuid", "p_decision" "text", "p_vehicle_category" "text" DEFAULT NULL::"text", "p_vehicle_model" "text" DEFAULT NULL::"text", "p_vehicle_plate" "text" DEFAULT NULL::"text", "p_service_areas" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_status text; v_verification text;
begin
  if p_admin_user_id is null or p_admin_user_id <> auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if not public.mnty_can_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  if p_captain_id is null then raise exception 'CAPTAIN_REQUIRED'; end if;
  if upper(p_decision) not in ('APPROVE','REJECT','SUSPEND') then raise exception 'INVALID_REVIEW_DECISION'; end if;
  if p_service_areas is not null and jsonb_typeof(p_service_areas) <> 'array' then raise exception 'INVALID_SERVICE_AREAS'; end if;

  if upper(p_decision)='APPROVE' then
    v_status:='ACTIVE'; v_verification:='VERIFIED';
  elsif upper(p_decision)='SUSPEND' then
    v_status:='SUSPENDED'; v_verification:='VERIFIED';
  else
    v_status:='REJECTED'; v_verification:='REJECTED';
  end if;

  update public.mantigo_captain_profiles
     set status=v_status,
         verification_status=v_verification,
         availability_status='OFFLINE',
         vehicle_category=coalesce(nullif(trim(p_vehicle_category),''),vehicle_category),
         vehicle_model=coalesce(nullif(trim(p_vehicle_model),''),vehicle_model),
         vehicle_plate=coalesce(nullif(trim(p_vehicle_plate),''),vehicle_plate),
         service_areas=coalesce(p_service_areas,service_areas),
         updated_at=now()
   where captain_id=p_captain_id;

  if not found then raise exception 'CAPTAIN_PROFILE_NOT_FOUND'; end if;

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(
    'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,
    'MANTIGO_CAPTAIN_APPLICATION_REVIEWED','MANTIGO_CAPTAIN',p_captain_id::text,
    '{}'::jsonb,jsonb_build_object('decision',upper(p_decision),'status',v_status,'verification_status',v_verification),'SUCCESS'
  );

  return jsonb_build_object('captain_id',p_captain_id,'status',v_status,'verification_status',v_verification);
end
$$;


ALTER FUNCTION "public"."review_mantigo_captain_application"("p_admin_user_id" "uuid", "p_captain_id" "uuid", "p_decision" "text", "p_vehicle_category" "text", "p_vehicle_model" "text", "p_vehicle_plate" "text", "p_service_areas" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_mantigo_financial_config_backend"("p_admin_user_id" "uuid", "p_commission_rate" numeric, "p_currency" "text" DEFAULT 'EGP'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_admin_user_id is null or p_admin_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if not public.mnty_can_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  if p_commission_rate is null or p_commission_rate<0 or p_commission_rate>100 then raise exception 'INVALID_COMMISSION_RATE'; end if;
  insert into public.mantigo_financial_config(id,commission_rate,currency,updated_by,updated_at)
  values(true,p_commission_rate,upper(coalesce(nullif(trim(p_currency),''),'EGP')),p_admin_user_id,now())
  on conflict(id) do update set commission_rate=excluded.commission_rate,currency=excluded.currency,updated_by=excluded.updated_by,updated_at=now();
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,
    'MANTIGO_FINANCIAL_CONFIG_UPDATED','MANTIGO_FINANCIAL','GLOBAL','{}'::jsonb,
    jsonb_build_object('commission_rate',p_commission_rate,'currency',upper(coalesce(nullif(trim(p_currency),''),'EGP'))),'SUCCESS');
  return jsonb_build_object('commission_rate',p_commission_rate,'currency',upper(coalesce(nullif(trim(p_currency),''),'EGP')));
end
$$;


ALTER FUNCTION "public"."set_mantigo_financial_config_backend"("p_admin_user_id" "uuid", "p_commission_rate" numeric, "p_currency" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_feature_flags" (
    "id" character varying NOT NULL,
    "scope_type" character varying NOT NULL,
    "scope_id" character varying,
    "sector_id" character varying,
    "tenant_id" character varying,
    "business_id" "uuid",
    "branch_id" character varying,
    "module_code" character varying NOT NULL,
    "feature_code" character varying,
    "enabled" boolean DEFAULT true NOT NULL,
    "configuration" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_feature_flags_scope_ck" CHECK ((("scope_type")::"text" = ANY ((ARRAY['GLOBAL'::character varying, 'SECTOR'::character varying, 'TENANT'::character varying, 'BUSINESS'::character varying, 'BRANCH'::character varying, 'WIDGET'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."platform_feature_flags" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_feature_flags" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_platform_feature_flag_backend"("p_scope_type" character varying, "p_scope_id" character varying, "p_sector_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_module_code" character varying, "p_feature_code" character varying, "p_enabled" boolean, "p_configuration" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."platform_feature_flags"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r public.platform_feature_flags;
begin
 if not public.is_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
 insert into public.platform_feature_flags(scope_type,scope_id,sector_id,tenant_id,business_id,branch_id,module_code,feature_code,enabled,configuration,updated_by)
 values(p_scope_type,p_scope_id,p_sector_id,p_tenant_id,p_business_id,p_branch_id,p_module_code,p_feature_code,p_enabled,coalesce(p_configuration,'{}'::jsonb),auth.uid())
 on conflict (scope_type,coalesce(scope_id,''),coalesce(sector_id,''),coalesce(tenant_id,''),coalesce(business_id::text,''),coalesce(branch_id,''),module_code,feature_code)
 do update set enabled=excluded.enabled,configuration=excluded.configuration,updated_by=auth.uid(),updated_at=now()
 returning * into r;
 return r;
end $$;


ALTER FUNCTION "public"."set_platform_feature_flag_backend"("p_scope_type" character varying, "p_scope_id" character varying, "p_sector_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_module_code" character varying, "p_feature_code" character varying, "p_enabled" boolean, "p_configuration" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."settle_mantigo_captain_backend"("p_admin_user_id" "uuid", "p_ride_id" "text", "p_channel" "text" DEFAULT 'BANK_TRANSFER'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_f public.mantigo_financial_ledger%rowtype; v_ride_status text; v_result jsonb;
begin
  if p_admin_user_id is null or p_admin_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if not exists (select 1 from public.user_memberships where user_id=p_admin_user_id and status='ACTIVE' and upper(role) in ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','ACCOUNTANT','FINANCE_MANAGER','FINANCE')) then raise exception 'FINANCE_ROLE_REQUIRED'; end if;
  select status into v_ride_status from public.mantigo_rides where id=p_ride_id;
  if v_ride_status is null then raise exception 'RIDE_NOT_FOUND'; end if;
  if v_ride_status<>'COMPLETED' then raise exception 'RIDE_NOT_COMPLETED'; end if;
  select * into v_f from public.mantigo_financial_ledger where ride_id=p_ride_id for update;
  if not found then raise exception 'FINANCIAL_RECORD_NOT_FOUND'; end if;
  if v_f.payment_status not in ('PAID','CASH_CONFIRMED') then raise exception 'PAYMENT_NOT_CONFIRMED'; end if;
  if v_f.settlement_status='SETTLED' then return jsonb_build_object('ride_id',p_ride_id,'settlement_status','SETTLED','settlement_reference',v_f.settlement_reference,'idempotent',true); end if;
  if v_f.commission_rate is null then raise exception 'COMMISSION_NOT_LOCKED'; end if;
  v_result:=public.create_settlement_and_post_journal('MGO-SET-'||p_ride_id,'MNTY-PLATFORM','PARTNER',v_f.captain_id::text,v_f.gross_amount,v_f.commission_amount,v_f.captain_net_amount,0,coalesce(nullif(trim(p_channel),''),'BANK_TRANSFER'),p_ride_id,null,'MantiGO captain settlement for ride '||p_ride_id,p_admin_user_id);
  update public.mantigo_financial_ledger set settlement_status='SETTLED',settlement_reference='MGO-SET-'||p_ride_id,updated_at=now() where ride_id=p_ride_id;
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,'MANTIGO_CAPTAIN_SETTLED','MANTIGO_FINANCIAL',v_f.id,jsonb_build_object('settlement_status',v_f.settlement_status),jsonb_build_object('settlement_status','SETTLED','settlement_reference','MGO-SET-'||p_ride_id,'provider_result',v_result),'SUCCESS');
  begin
    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_f.captain_id,'MANTIGO_SETTLEMENT','تمت التسوية','تمت تسوية مستحقاتك عن رحلة MantiGO بنجاح.','MANTIGO_RIDE',p_ride_id);
  exception when others then
    insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
    values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,jsonb_build_object('notification_type','MANTIGO_SETTLEMENT','error',sqlerrm),'PARTIAL');
  end;
  return jsonb_build_object('ride_id',p_ride_id,'settlement_status','SETTLED','settlement_reference','MGO-SET-'||p_ride_id,'provider_result',v_result,'idempotent',false);
end $$;


ALTER FUNCTION "public"."settle_mantigo_captain_backend"("p_admin_user_id" "uuid", "p_ride_id" "text", "p_channel" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."smm_admin_credit_wallet"("p_actor" "uuid", "p_user" "uuid", "p_amount" numeric, "p_description" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
 if not exists(select 1 from public.user_memberships where user_id=p_actor and status='ACTIVE' and upper(role) in('OWNER','ADMIN','SUPER_ADMIN')) then raise exception 'NOT_AUTHORIZED'; end if;
 if p_amount<=0 then raise exception 'INVALID_AMOUNT'; end if;
 insert into public.smm_wallets(user_id,balance) values(p_user,p_amount)
 on conflict(user_id) do update set balance=smm_wallets.balance+p_amount,updated_at=now();
 insert into public.smm_wallet_transactions(user_id,amount,type,description) values(p_user,p_amount,'CREDIT',p_description);
 return true;
end;$$;


ALTER FUNCTION "public"."smm_admin_credit_wallet"("p_actor" "uuid", "p_user" "uuid", "p_amount" numeric, "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."smm_bootstrap_first_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
 if not exists(select 1 from public.smm_admins) then
   insert into public.smm_admins(user_id) values(new.id) on conflict do nothing;
 end if;
 return new;
end;$$;


ALTER FUNCTION "public"."smm_bootstrap_first_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."smm_debit_wallet"("p_user" "uuid", "p_amount" numeric, "p_reference" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare b numeric;
begin
 if p_amount<=0 then raise exception 'INVALID_AMOUNT'; end if;
 select balance into b from public.smm_wallets where user_id=p_user for update;
 if coalesce(b,0)<p_amount then return false; end if;
 update public.smm_wallets set balance=balance-p_amount,updated_at=now() where user_id=p_user;
 insert into public.smm_wallet_transactions(user_id,amount,type,reference_id,description) values(p_user,-p_amount,'DEBIT',p_reference,'SMM order');
 return true;
end;$$;


ALTER FUNCTION "public"."smm_debit_wallet"("p_user" "uuid", "p_amount" numeric, "p_reference" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."smm_get_provider_secret"("p_provider_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'vault'
    AS $$
declare v_secret text;
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role','') <> 'service_role'
     and current_user <> 'postgres' then
    raise exception 'ACCESS_DENIED';
  end if;
  select ds.decrypted_secret into v_secret
  from vault.decrypted_secrets ds
  join public.smm_provider_credentials c on c.provider_id = p_provider_id
  where ds.name = 'smm_provider_' || p_provider_id::text
    and c.configured = true
  limit 1;
  return v_secret;
end;
$$;


ALTER FUNCTION "public"."smm_get_provider_secret"("p_provider_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."smm_refund_wallet"("p_user" "uuid", "p_amount" numeric, "p_reference" "uuid", "p_description" "text" DEFAULT 'SMM refund'::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
 if p_amount<=0 then raise exception 'INVALID_AMOUNT'; end if;
 insert into public.smm_wallets(user_id,balance) values(p_user,p_amount)
 on conflict(user_id) do update set balance=smm_wallets.balance+p_amount,updated_at=now();
 insert into public.smm_wallet_transactions(user_id,amount,type,reference_id,description) values(p_user,p_amount,'REFUND',p_reference,p_description);
 return true;
end;$$;


ALTER FUNCTION "public"."smm_refund_wallet"("p_user" "uuid", "p_amount" numeric, "p_reference" "uuid", "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."smm_set_provider_secret"("p_provider_id" "uuid", "p_actor_user_id" "uuid", "p_secret" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'vault'
    AS $$
declare
  v_secret_id uuid;
begin
  if not exists (
    select 1 from public.user_memberships
    where user_id = p_actor_user_id
      and upper(role) in ('OWNER','ADMIN','SUPER_ADMIN')
      and status = 'ACTIVE'
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if p_secret is null or length(trim(p_secret)) < 8 then
    raise exception 'INVALID_SECRET';
  end if;
  select id into v_secret_id
  from vault.secrets
  where name = 'smm_provider_' || p_provider_id::text
  limit 1;
  if v_secret_id is null then
    v_secret_id := vault.create_secret(p_secret, 'smm_provider_' || p_provider_id::text, 'SMM provider API credential');
  else
    perform vault.update_secret(v_secret_id, p_secret, 'smm_provider_' || p_provider_id::text, 'SMM provider API credential');
  end if;
  insert into public.smm_provider_credentials(provider_id, configured, updated_at)
  values(p_provider_id,true,now())
  on conflict(provider_id) do update set configured=true, updated_at=now();
  update public.smm_providers set active=true, updated_at=now() where id=p_provider_id;
  return true;
end;
$$;


ALTER FUNCTION "public"."smm_set_provider_secret"("p_provider_id" "uuid", "p_actor_user_id" "uuid", "p_secret" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "tier_code" "text" NOT NULL,
    "billing_cycle" "text" NOT NULL,
    "status" "text" NOT NULL,
    "sector" "text",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone,
    "provider" "text",
    "provider_reference" "text",
    "source_payment_intent_id" "uuid",
    "idempotency_key" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_subscriptions_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['MONTHLY'::"text", 'ANNUAL'::"text", 'TRIAL'::"text"]))),
    CONSTRAINT "business_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['TRIALING'::"text", 'PENDING_PAYMENT'::"text", 'ACTIVE'::"text", 'PAST_DUE'::"text", 'CANCELLED'::"text", 'EXPIRED'::"text"])))
);

ALTER TABLE ONLY "public"."business_subscriptions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_subscriptions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_business_trial_backend"("p_business_id" "uuid", "p_tier_code" "text", "p_sector" "text", "p_trial_days" integer, "p_idempotency_key" "text", "p_actor_user_id" "uuid") RETURNS "public"."business_subscriptions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ declare v public.business_subscriptions; begin if p_actor_user_id is null then raise exception 'unauthorized'; end if; if not exists (select 1 from public.user_memberships m where m.user_id=p_actor_user_id and m.business_id=p_business_id and m.status='ACTIVE') then raise exception 'forbidden'; end if; if p_trial_days < 1 or p_trial_days > 90 then raise exception 'invalid_trial_days'; end if; select * into v from public.business_subscriptions where idempotency_key=p_idempotency_key limit 1; if v.id is not null then return v; end if; insert into public.business_subscriptions(business_id,tier_code,billing_cycle,status,sector,starts_at,ends_at,idempotency_key,created_by) values(p_business_id,p_tier_code,'TRIAL','TRIALING',p_sector,now(),now()+make_interval(days=>p_trial_days),p_idempotency_key,p_actor_user_id) returning * into v; return v; end; $$;


ALTER FUNCTION "public"."start_business_trial_backend"("p_business_id" "uuid", "p_tier_code" "text", "p_sector" "text", "p_trial_days" integer, "p_idempotency_key" "text", "p_actor_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_job_application_backend"("p_user_id" "uuid", "p_job_id" "uuid", "p_applicant_name" "text", "p_applicant_phone" "text", "p_qualifications" "text", "p_cv_summary_text" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_id uuid;
begin
 if p_user_id is null or p_user_id<>auth.uid() then raise exception 'AUTH_USER_MISMATCH'; end if;
 if p_job_id is null then raise exception 'INVALID_JOB'; end if;
 if nullif(trim(coalesce(p_applicant_name,'')),'') is null then raise exception 'APPLICANT_NAME_REQUIRED'; end if;
 if nullif(trim(coalesce(p_applicant_phone,'')),'') is null then raise exception 'APPLICANT_PHONE_REQUIRED'; end if;
 if nullif(trim(coalesce(p_qualifications,'')),'') is null then raise exception 'QUALIFICATIONS_REQUIRED'; end if;
 if nullif(trim(coalesce(p_cv_summary_text,'')),'') is null then raise exception 'CV_SUMMARY_REQUIRED'; end if;
 if not exists(select 1 from public.jobs where id=p_job_id) then raise exception 'JOB_NOT_FOUND'; end if;
 if exists(select 1 from public.job_applications where job_id=p_job_id and applicant_user_id=auth.uid()) then
  select id into v_id from public.job_applications where job_id=p_job_id and applicant_user_id=auth.uid() limit 1;
  return jsonb_build_object('id',v_id,'status','ALREADY_APPLIED');
 end if;
 insert into public.job_applications(job_id,applicant_user_id,applicant_name,applicant_phone,qualifications,cv_summary_text)
 values(p_job_id,auth.uid(),trim(p_applicant_name),trim(p_applicant_phone),trim(p_qualifications),trim(p_cv_summary_text))
 returning id into v_id;
 return jsonb_build_object('id',v_id,'status','SUBMITTED');
end $$;


ALTER FUNCTION "public"."submit_job_application_backend"("p_user_id" "uuid", "p_job_id" "uuid", "p_applicant_name" "text", "p_applicant_phone" "text", "p_qualifications" "text", "p_cv_summary_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_mantigo_captain_application"("p_user_id" "uuid", "p_vehicle_category" "text", "p_vehicle_model" "text", "p_vehicle_plate" "text", "p_service_areas" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_existing public.mantigo_captain_profiles%rowtype;
begin
  if p_user_id is null or p_user_id <> auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if coalesce(trim(p_vehicle_category),'')='' then raise exception 'VEHICLE_CATEGORY_REQUIRED'; end if;
  if coalesce(trim(p_vehicle_model),'')='' then raise exception 'VEHICLE_MODEL_REQUIRED'; end if;
  if coalesce(trim(p_vehicle_plate),'')='' then raise exception 'VEHICLE_PLATE_REQUIRED'; end if;
  if p_service_areas is null or jsonb_typeof(p_service_areas) <> 'array' then raise exception 'INVALID_SERVICE_AREAS'; end if;

  select * into v_existing from public.mantigo_captain_profiles where captain_id=p_user_id;
  if found then
    if v_existing.status='REJECTED' then
      raise exception 'CAPTAIN_APPLICATION_REQUIRES_ADMIN_REVIEW';
    end if;
    return jsonb_build_object(
      'captain_id',p_user_id,'status',v_existing.status,
      'verification_status',v_existing.verification_status,'idempotent',true
    );
  end if;

  insert into public.mantigo_captain_profiles(
    captain_id,status,verification_status,availability_status,
    vehicle_category,vehicle_model,vehicle_plate,service_areas,
    rating,completed_rides,acceptance_rate,cancellation_rate,last_seen_at
  ) values(
    p_user_id,'PENDING','PENDING','OFFLINE',
    trim(p_vehicle_category),trim(p_vehicle_model),trim(p_vehicle_plate),p_service_areas,
    0,0,0,0,null
  );

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(
    'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,
    'MANTIGO_CAPTAIN_APPLICATION_SUBMITTED','MANTIGO_CAPTAIN',p_user_id::text,
    '{}'::jsonb,jsonb_build_object('status','PENDING','verification_status','PENDING'),'SUCCESS'
  );

  return jsonb_build_object('captain_id',p_user_id,'status','PENDING','verification_status','PENDING','idempotent',false);
end
$$;


ALTER FUNCTION "public"."submit_mantigo_captain_application"("p_user_id" "uuid", "p_vehicle_category" "text", "p_vehicle_model" "text", "p_vehicle_plate" "text", "p_service_areas" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_digital_page_section"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at=now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_digital_page_section"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_digital_page_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at=now();
  if tg_op='UPDATE' then
    new.version=old.version+1;
  end if;
  if new.status='PUBLISHED' and old.status is distinct from 'PUBLISHED' then
    new.published_at=coalesce(new.published_at,now());
  elsif new.status<>'PUBLISHED' then
    new.published_at=null;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_digital_page_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_business_referral_event"("p_code" character varying, "p_event_type" character varying DEFAULT 'VISIT'::character varying, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_ref public.business_referral_codes%rowtype;
begin
  if p_event_type not in ('SCAN','VISIT','SIGNUP','LEAD','ORDER') then raise exception 'INVALID_EVENT_TYPE'; end if;

  select * into v_ref from public.business_referral_codes
  where code=upper(trim(p_code)) and status='ACTIVE' limit 1;

  if v_ref.id is null then raise exception 'INVALID_REFERRAL_CODE'; end if;

  insert into public.business_referral_events(referral_code_id,referral_code,business_id,visitor_user_id,event_type,metadata)
  values(v_ref.id,v_ref.code,v_ref.business_id,v_uid,p_event_type,coalesce(p_metadata,'{}'::jsonb));

  return jsonb_build_object('tracked',true,'businessId',v_ref.business_id,'eventType',p_event_type);
end;
$$;


ALTER FUNCTION "public"."track_business_referral_event"("p_code" character varying, "p_event_type" character varying, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enforce_journal_entry_immutability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- If already POSTED, block direct deletion
    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'POSTED' THEN
            RAISE EXCEPTION 'JOURNAL_ENTRY_IMMUTABLE: Posted journal entry % cannot be deleted. Use reversal or correction entry.', OLD.id;
        END IF;
        RETURN OLD;
    END IF;

    -- If already POSTED, check allowed updates
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'POSTED' THEN
            -- Only allow transitioning to REVERSED or CORRECTED with reversal pointer
            IF NEW.status IN ('REVERSED', 'CORRECTED') THEN
                IF NEW.total_debit != OLD.total_debit OR NEW.total_credit != OLD.total_credit THEN
                    RAISE EXCEPTION 'JOURNAL_ENTRY_IMMUTABLE: Total amounts of posted journal entry % cannot be altered.', OLD.id;
                END IF;
                IF NEW.reversed_by_entry_id IS NULL AND NEW.correction_for_entry_id IS NULL THEN
                    RAISE EXCEPTION 'JOURNAL_ENTRY_IMMUTABLE: Status reversal requires pointer to reversal or correction entry.';
                END IF;
                RETURN NEW;
            ELSE
                RAISE EXCEPTION 'JOURNAL_ENTRY_IMMUTABLE: Posted journal entry % cannot be modified directly. Use reversal or correction entry.', OLD.id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_enforce_journal_entry_immutability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enforce_journal_line_immutability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_entry_status VARCHAR(32);
    v_target_id VARCHAR(64);
BEGIN
    v_target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.journal_entry_id ELSE NEW.journal_entry_id END;
    
    SELECT status INTO v_entry_status
    FROM journal_entries
    WHERE id = v_target_id;

    IF v_entry_status = 'POSTED' THEN
        RAISE EXCEPTION 'JOURNAL_LINE_IMMUTABLE: Lines of posted journal entry % cannot be inserted, modified, or deleted.', v_target_id;
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;


ALTER FUNCTION "public"."trg_enforce_journal_line_immutability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enforce_wallet_balance_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_allow_negative BOOLEAN;
    v_current_balance NUMERIC(14,4);
    v_new_balance NUMERIC(14,4);
BEGIN
    SELECT allow_negative INTO v_allow_negative
    FROM wallet_accounts
    WHERE id = NEW.wallet_id;

    -- Calculate projected balance from all confirmed transactions
    SELECT COALESCE(SUM(CASE 
        WHEN transaction_type IN ('CREDIT', 'REFUND') THEN amount 
        WHEN transaction_type IN ('DEBIT', 'COMMISSION_SETTLEMENT') THEN -amount 
        ELSE 0 END), 0)
    INTO v_current_balance
    FROM wallet_transactions
    WHERE wallet_id = NEW.wallet_id AND status = 'CONFIRMED' AND id != NEW.id;

    IF NEW.transaction_type IN ('CREDIT', 'REFUND') THEN
        v_new_balance := v_current_balance + NEW.amount;
    ELSE
        v_new_balance := v_current_balance - NEW.amount;
    END IF;

    IF v_new_balance < 0 AND NOT COALESCE(v_allow_negative, false) THEN
        RAISE EXCEPTION 'NEGATIVE_BALANCE_FORBIDDEN: Wallet % balance would drop to %, negative balance not allowed.', NEW.wallet_id, v_new_balance;
    END IF;

    NEW.balance_after := v_new_balance;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_enforce_wallet_balance_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_post_journal_to_general_ledger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    r_line RECORD;
    v_running NUMERIC(14,4);
BEGIN
    IF NEW.status = 'POSTED' AND (OLD IS NULL OR OLD.status != 'POSTED') THEN
        FOR r_line IN (SELECT * FROM journal_entry_lines WHERE journal_entry_id = NEW.id ORDER BY line_number ASC) LOOP
            
            -- Calculate latest running balance for the account
            SELECT COALESCE(running_balance, 0) INTO v_running
            FROM general_ledger
            WHERE account_id = r_line.account_id
            ORDER BY posted_at DESC, id DESC
            LIMIT 1;

            v_running := COALESCE(v_running, 0) + (r_line.debit - r_line.credit);

            INSERT INTO general_ledger (
                id,
                tenant_id,
                business_id,
                journal_entry_id,
                journal_line_id,
                account_id,
                debit,
                credit,
                running_balance,
                entry_date,
                posted_at
            ) VALUES (
                'gl_' || SUBSTRING(REPLACE(uuid_generate_v4()::text, '-', ''), 1, 16),
                NEW.tenant_id,
                NEW.business_id,
                NEW.id,
                r_line.id,
                r_line.account_id,
                r_line.debit,
                r_line.credit,
                v_running,
                NEW.entry_date,
                NEW.posted_at
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_post_journal_to_general_ledger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_validate_journal_entry_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_sum_debit NUMERIC(14,4);
    v_sum_credit NUMERIC(14,4);
BEGIN
    IF NEW.status = 'POSTED' THEN
        SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
        INTO v_sum_debit, v_sum_credit
        FROM journal_entry_lines
        WHERE journal_entry_id = NEW.id;

        IF ABS(v_sum_debit - v_sum_credit) > 0.0001 THEN
            RAISE EXCEPTION 'DOUBLE_ENTRY_IMBALANCE: Journal Entry % is unbalanced. Total Debit (%) != Total Credit (%).', NEW.id, v_sum_debit, v_sum_credit;
        END IF;

        IF v_sum_debit <= 0 THEN
            RAISE EXCEPTION 'DOUBLE_ENTRY_INVALID: Journal Entry % must have positive debit/credit lines.', NEW.id;
        END IF;

        -- Ensure header matches lines
        NEW.total_debit := v_sum_debit;
        NEW.total_credit := v_sum_credit;
        NEW.posted_at := COALESCE(NEW.posted_at, CURRENT_TIMESTAMP);
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_validate_journal_entry_balance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_mantigo_captain_presence_backend"("p_user_id" "uuid", "p_availability_status" "text", "p_current_lat" double precision DEFAULT NULL::double precision, "p_current_lon" double precision DEFAULT NULL::double precision) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_category text; v_status text; v_verification text;
begin
  if p_user_id is null or p_user_id <> auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if p_availability_status not in ('OFFLINE','AVAILABLE','BUSY') then raise exception 'INVALID_AVAILABILITY_STATUS'; end if;
  if p_current_lat is not null and (p_current_lat < -90 or p_current_lat > 90) then raise exception 'INVALID_LATITUDE'; end if;
  if p_current_lon is not null and (p_current_lon < -180 or p_current_lon > 180) then raise exception 'INVALID_LONGITUDE'; end if;

  update public.mantigo_captain_profiles
     set availability_status=p_availability_status,
         current_lat=coalesce(p_current_lat,current_lat),
         current_lon=coalesce(p_current_lon,current_lon),
         last_seen_at=now(),
         updated_at=now()
   where captain_id=p_user_id
   returning vehicle_category,status,verification_status into v_category,v_status,v_verification;

  if not found then raise exception 'CAPTAIN_PROFILE_NOT_FOUND'; end if;

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(
    'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),
    'MNTY-PLATFORM',p_user_id,'MANTIGO_CAPTAIN_PRESENCE_UPDATED','MANTIGO_CAPTAIN',
    p_user_id::text,'{}'::jsonb,
    jsonb_build_object('availability_status',p_availability_status,'has_coordinates',p_current_lat is not null and p_current_lon is not null),
    'SUCCESS'
  );
  return jsonb_build_object('captain_id',p_user_id,'availability_status',p_availability_status,'vehicle_category',v_category,'status',v_status,'verification_status',v_verification);
end
$$;


ALTER FUNCTION "public"."update_mantigo_captain_presence_backend"("p_user_id" "uuid", "p_availability_status" "text", "p_current_lat" double precision, "p_current_lon" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_mantigo_trip_status_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_target_status" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
 v_status text; v_customer uuid; v_driver uuid; v_target text:=upper(trim(p_target_status));
 v_ok boolean:=false; v_payment_status text; v_financial_exists boolean:=false;
 v_other uuid; v_title text; v_body text;
begin
 if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 if v_target in ('FAILED','SHOW_NO','CANCELLED') and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'TRIP_REASON_REQUIRED'; end if;
 select r.status,r.customer_id,b.captain_id into v_status,v_customer,v_driver
 from public.mantigo_rides r left join public.mantigo_bids b on b.id=r.accepted_bid_id
 where r.id=p_ride_id for update;
 if v_status is null then raise exception 'RIDE_NOT_FOUND'; end if;
 select f.payment_status into v_payment_status from public.mantigo_financial_ledger f where f.ride_id=p_ride_id;
 v_financial_exists:=found;
 if p_user_id=v_customer then
   v_ok:=(v_status='OPEN' and v_target in ('OPEN_FOR_BIDS','CANCELLED','EXPIRED'))
      or (v_status='OPEN_FOR_BIDS' and v_target in ('MATCHING','CANCELLED','EXPIRED'))
      or (v_status='MATCHING' and v_target='ACCEPTED');
 elsif p_user_id=v_driver then
   v_ok:=(v_status='ACCEPTED' and v_target='ARRIVED')
      or (v_status='ARRIVED' and v_target='STARTED' and v_financial_exists and v_payment_status in ('PAID','CASH_CONFIRMED'))
      or (v_status='STARTED' and v_target='IN_PROGRESS')
      or (v_status='IN_PROGRESS' and v_target='COMPLETED' and v_financial_exists and v_payment_status in ('PAID','CASH_CONFIRMED'))
      or (v_status in ('ACCEPTED','ARRIVED','STARTED','IN_PROGRESS') and v_target in ('FAILED','SHOW_NO'))
      or (v_status in ('ACCEPTED','ARRIVED') and v_target='CANCELLED');
 else raise exception 'TRIP_ACTOR_FORBIDDEN'; end if;
 if not v_ok then
   if p_user_id=v_driver and v_target in ('STARTED','COMPLETED')
      and (not v_financial_exists or v_payment_status not in ('PAID','CASH_CONFIRMED')) then
     raise exception 'PAYMENT_REQUIRED_BEFORE_TRIP_PROGRESS';
   end if;
   raise exception 'INVALID_TRIP_TRANSITION';
 end if;
 update public.mantigo_rides set status=v_target,updated_at=now() where id=p_ride_id;
 insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
 values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_TRIP_STATUS_CHANGED','MANTIGO_RIDE',p_ride_id,
 jsonb_build_object('status',v_status,'payment_status',v_payment_status),
 jsonb_build_object('status',v_target,'reason',p_reason),'SUCCESS');
 v_other:=case when p_user_id=v_customer then v_driver else v_customer end;
 if v_other is not null then
   v_title:=case v_target
    when 'OPEN_FOR_BIDS' then 'طلب الرحلة يستقبل عروضًا' when 'MATCHING' then 'جارٍ مطابقة الرحلة'
    when 'ACCEPTED' then 'تم قبول الكابتن' when 'ARRIVED' then 'الكابتن وصل'
    when 'STARTED' then 'بدأت الرحلة' when 'IN_PROGRESS' then 'الرحلة جارية'
    when 'COMPLETED' then 'اكتملت الرحلة' when 'CANCELLED' then 'تم إلغاء الرحلة'
    when 'FAILED' then 'تعذر إكمال الرحلة' when 'SHOW_NO' then 'لم يتم الحضور'
    when 'EXPIRED' then 'انتهى طلب الرحلة' else 'تحديث رحلة MantiGO' end;
   v_body:=trim(coalesce(p_reason,'')); if v_body='' then v_body:='تم تحديث حالة رحلتك إلى '||v_target; end if;
   begin
    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_other,'MANTIGO_STATUS',v_title,v_body,'MANTIGO_RIDE',p_ride_id);
   exception when others then
    insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
    values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,
    jsonb_build_object('notification_type','MANTIGO_STATUS','target_status',v_target,'error',sqlerrm),'PARTIAL');
   end;
 end if;
 return jsonb_build_object('id',p_ride_id,'previous_status',v_status,'status',v_target,'payment_status',v_payment_status,'reason',p_reason);
end $$;


ALTER FUNCTION "public"."update_mantigo_trip_status_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_target_status" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_medical_appointment_status_backend"("p_user_id" "uuid", "p_appointment_id" "text", "p_target_status" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_role text;
  v_uid uuid := auth.uid();
  v_old text;
begin
  if p_user_id is null or p_user_id <> v_uid then
    raise exception 'AUTH_USER_MISMATCH';
  end if;

  select status into v_old
  from public.medical_appointments
  where id=p_appointment_id
  for update;

  if v_old is null then
    raise exception 'APPOINTMENT_NOT_FOUND';
  end if;

  select upper(um.role) into v_role
  from public.user_memberships um
  join public.medical_appointments a on a.id=p_appointment_id
  where um.user_id=v_uid
    and um.tenant_id=a.tenant_id
    and um.status='ACTIVE'
    and (um.business_id is null or um.business_id=a.business_id)
  order by case
    when upper(um.role) in ('SERVICE_PROVIDER','OWNER','BUSINESS_OWNER','ADMIN','MANAGER') then 0
    else 1
  end
  limit 1;

  if v_role is null then
    raise exception 'ACTIVE_MEMBERSHIP_REQUIRED';
  end if;

  if p_target_status not in ('CONFIRMED','CANCELLED','COMPLETED','NO_SHOW') then
    raise exception 'INVALID_MEDICAL_STATUS';
  end if;

  if p_target_status='CANCELLED' then
    if v_role not in ('SERVICE_PROVIDER','OWNER','BUSINESS_OWNER','ADMIN','MANAGER')
       and not exists(
         select 1 from public.medical_appointments
         where id=p_appointment_id and patient_id=v_uid
       )
    then
      raise exception 'NOT_ALLOWED';
    end if;
  elsif v_role not in ('SERVICE_PROVIDER','OWNER','BUSINESS_OWNER','ADMIN','MANAGER') then
    raise exception 'PROVIDER_STATUS_CHANGE_REQUIRED';
  end if;

  update public.medical_appointments
  set status=p_target_status, updated_at=now()
  where id=p_appointment_id;

  return jsonb_build_object(
    'id',p_appointment_id,
    'old_status',v_old,
    'status',p_target_status
  );
end;
$$;


ALTER FUNCTION "public"."update_medical_appointment_status_backend"("p_user_id" "uuid", "p_appointment_id" "text", "p_target_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_order_status_backend"("p_order_id" "uuid", "p_tenant_id" character varying, "p_user_id" "uuid", "p_new_status" character varying, "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_order public.orders; v_role varchar; v_membership_business uuid; v_is_staff boolean:=false; v_scope_ok boolean:=false; v_allowed boolean:=false; v_payment_status text;
begin
 if p_user_id is null or auth.uid() is null or p_user_id is distinct from auth.uid() then raise exception 'AUTH_MISMATCH'; end if;
 select * into v_order from public.orders where id=p_order_id and tenant_id=p_tenant_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if v_order.customer_id=p_user_id and upper(p_new_status)='CANCELLED' then v_allowed:=true; end if;
 if not v_allowed then
   select upper(m.role),m.business_id into v_role,v_membership_business
   from public.user_memberships m where m.user_id=p_user_id and m.tenant_id=p_tenant_id and coalesce(m.status,'ACTIVE')='ACTIVE'
   order by case when m.business_id=v_order.business_id then 0 else 1 end limit 1;
   v_is_staff:=v_role=any(array['OWNER','ADMIN','MANAGER','STAFF','CASHIER','DRIVER','BUSINESS_OWNER','SERVICE_PROVIDER']);
   v_scope_ok:=v_role=any(array['OWNER','ADMIN']) or (v_role in ('MANAGER','STAFF','CASHIER','DRIVER','BUSINESS_OWNER','SERVICE_PROVIDER') and v_membership_business=v_order.business_id);
   if v_is_staff and v_scope_ok then
     v_allowed:=case
       when v_order.status in ('PENDING','CREATED') and upper(p_new_status) in ('CONFIRMED','CANCELLED') then true
       when v_order.status='CONFIRMED' and upper(p_new_status) in ('PREPARING','CANCELLED') then true
       when v_order.status='PREPARING' and upper(p_new_status) in ('OUT_FOR_DELIVERY','CANCELLED') then true
       when v_order.status='OUT_FOR_DELIVERY' and upper(p_new_status)='DELIVERED' then true
       else false end;
   end if;
 end if;
 if not v_allowed then raise exception 'INVALID_ORDER_TRANSITION'; end if;
 if upper(p_new_status)='CANCELLED' then
   select pi.status into v_payment_status from public.payment_intents pi where pi.order_id=v_order.id and pi.status not in ('CANCELLED','FAILED') order by pi.created_at desc limit 1;
   if v_payment_status='SUCCEEDED' then raise exception 'ORDER_PAID_REQUIRES_REFUND_BEFORE_CANCELLATION'; end if;
 end if;
 update public.orders set status=upper(p_new_status),notes=coalesce(p_reason,notes),updated_at=now() where id=p_order_id;
 return jsonb_build_object('id',p_order_id,'status',upper(p_new_status));
end $$;


ALTER FUNCTION "public"."update_order_status_backend"("p_order_id" "uuid", "p_tenant_id" character varying, "p_user_id" "uuid", "p_new_status" character varying, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_purchase_order_status_backend"("p_order_id" character varying, "p_target_status" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE u uuid:=auth.uid(); r text; x erp_purchase_orders%ROWTYPE; rowj jsonb; next_status text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 SELECT * INTO x FROM erp_purchase_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PURCHASE_ORDER_NOT_FOUND'; END IF;
 SELECT role INTO r FROM user_memberships WHERE user_id=u AND tenant_id=x.tenant_id AND business_id=x.business_id AND status='ACTIVE' LIMIT 1;
 IF r IS NULL THEN RAISE EXCEPTION 'PURCHASE_ORDER_ROLE_REQUIRED'; END IF;
 IF p_target_status='SUBMITTED' AND x.status='DRAFT' THEN
   next_status:=CASE WHEN x.total_amount>5000 THEN 'PENDING_APPROVAL' ELSE 'SUBMITTED' END;
 ELSIF p_target_status='APPROVED' AND x.status='PENDING_APPROVAL' AND upper(r) IN ('OWNER','BUSINESS_OWNER','ADMIN') THEN
   next_status:='APPROVED';
 ELSE RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
 UPDATE erp_purchase_orders SET status=next_status,updated_at=now() WHERE id=x.id RETURNING * INTO x;
 SELECT to_jsonb(x) INTO rowj;
 RETURN jsonb_build_object('success',true,'order',rowj);
END; $$;


ALTER FUNCTION "public"."update_purchase_order_status_backend"("p_order_id" character varying, "p_target_status" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_stock_transfer_status_backend"("p_transfer_id" character varying, "p_target_status" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_user uuid:=auth.uid(); v_role text; v_current text; v_row jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 SELECT t.status INTO v_current FROM erp_stock_transfers t WHERE t.id=p_transfer_id FOR UPDATE;
 IF v_current IS NULL THEN RAISE EXCEPTION 'TRANSFER_NOT_FOUND'; END IF;
 SELECT role INTO v_role FROM user_memberships m JOIN erp_stock_transfers t ON t.tenant_id=m.tenant_id AND t.business_id=m.business_id
 WHERE m.user_id=v_user AND m.status='ACTIVE' AND t.id=p_transfer_id LIMIT 1;
 IF v_role IS NULL OR upper(v_role) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF') THEN RAISE EXCEPTION 'ERP_INVENTORY_ROLE_REQUIRED'; END IF;
 IF p_target_status='APPROVED' AND v_current<>'REQUESTED' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
 IF p_target_status='IN_TRANSIT' AND v_current<>'APPROVED' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
 UPDATE erp_stock_transfers SET status=p_target_status,updated_at=now() WHERE id=p_transfer_id;
 SELECT to_jsonb(t) INTO v_row FROM erp_stock_transfers t WHERE t.id=p_transfer_id;
 RETURN jsonb_build_object('success',true,'transfer',v_row);
END; $$;


ALTER FUNCTION "public"."update_stock_transfer_status_backend"("p_transfer_id" character varying, "p_target_status" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_support_ticket_status_backend"("p_ticket_id" character varying, "p_status" character varying, "p_assigned_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."support_tickets"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r public.support_tickets;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(
   select 1 from public.support_tickets t
   join public.user_memberships m on m.tenant_id=t.tenant_id
   where t.id=p_ticket_id and m.user_id=auth.uid() and m.status='ACTIVE'
   and m.role in ('ADMIN','SUPER_ADMIN','MANAGER','SUPPORT','SUPPORT_AGENT')
 ) then raise exception 'SUPPORT_ACCESS_DENIED'; end if;
 if p_status not in ('OPEN','IN_PROGRESS','WAITING_USER','RESOLVED','CLOSED') then raise exception 'INVALID_STATUS'; end if;
 update public.support_tickets
 set status=p_status, assigned_user_id=coalesce(p_assigned_user_id,assigned_user_id),
     updated_at=now(), closed_at=case when p_status='CLOSED' then now() else closed_at end
 where id=p_ticket_id returning * into r;
 return r;
end $$;


ALTER FUNCTION "public"."update_support_ticket_status_backend"("p_ticket_id" character varying, "p_status" character varying, "p_assigned_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_catalog_item_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_legacy_ref" character varying, "p_item_type" character varying, "p_name_ar" "text", "p_name_en" "text", "p_description" "text", "p_sku" character varying, "p_tax_rate" numeric, "p_metadata" "jsonb", "p_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from user_memberships m where m.user_id=auth.uid() and m.tenant_id=p_tenant_id and coalesce(m.status,'ACTIVE')='ACTIVE' and (upper(m.role) in ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER') or (upper(m.role)='SUPER_ADMIN' and coalesce(m.permissions->>'scope','')='PLATFORM' and coalesce((m.permissions->>'full_control')::boolean,false)=true))) then raise exception 'CATALOG_WRITE_FORBIDDEN'; end if;
 if not exists(select 1 from businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id) then raise exception 'BUSINESS_TENANT_MISMATCH'; end if;
 if p_tax_rate<0 or p_tax_rate>100 or nullif(trim(p_name_ar),'') is null then raise exception 'INVALID_CATALOG_ITEM'; end if;
 if p_id is null then insert into catalog_items(tenant_id,business_id,branch_id,legacy_ref,item_type,name_ar,name_en,description,sku,tax_rate,metadata) values(p_tenant_id,p_business_id,p_branch_id,nullif(trim(p_legacy_ref),''),upper(coalesce(p_item_type,'PRODUCT')),trim(p_name_ar),p_name_en,p_description,p_sku,p_tax_rate,coalesce(p_metadata,'{}')) returning id into v_id;
 else update catalog_items set branch_id=p_branch_id,legacy_ref=nullif(trim(p_legacy_ref),''),item_type=upper(coalesce(p_item_type,item_type)),name_ar=trim(p_name_ar),name_en=p_name_en,description=p_description,sku=p_sku,tax_rate=p_tax_rate,metadata=coalesce(p_metadata,metadata),updated_at=now() where id=p_id and tenant_id=p_tenant_id and business_id=p_business_id returning id into v_id; if v_id is null then raise exception 'CATALOG_ITEM_NOT_FOUND'; end if; end if;
 return jsonb_build_object('id',v_id);
end $$;


ALTER FUNCTION "public"."upsert_catalog_item_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_legacy_ref" character varying, "p_item_type" character varying, "p_name_ar" "text", "p_name_en" "text", "p_description" "text", "p_sku" character varying, "p_tax_rate" numeric, "p_metadata" "jsonb", "p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_catalog_price_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_catalog_item_id" "uuid", "p_branch_id" character varying, "p_currency" character varying, "p_unit_price" numeric, "p_effective_from" timestamp with time zone DEFAULT "now"(), "p_effective_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_id uuid; v_version bigint;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from user_memberships m where m.user_id=auth.uid() and m.tenant_id=p_tenant_id and coalesce(m.status,'ACTIVE')='ACTIVE' and (upper(m.role) in ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER') or (upper(m.role)='SUPER_ADMIN' and coalesce(m.permissions->>'scope','')='PLATFORM' and coalesce((m.permissions->>'full_control')::boolean,false)=true))) then raise exception 'CATALOG_WRITE_FORBIDDEN'; end if;
 if not exists(select 1 from catalog_items ci where ci.id=p_catalog_item_id and ci.tenant_id=p_tenant_id and ci.business_id=p_business_id) then raise exception 'CATALOG_ITEM_NOT_FOUND'; end if;
 if p_unit_price<0 then raise exception 'INVALID_PRICE'; end if;
 select coalesce(max(version),0)+1 into v_version from catalog_item_prices where catalog_item_id=p_catalog_item_id and coalesce(branch_id,'')=coalesce(p_branch_id,'');
 insert into catalog_item_prices(tenant_id,catalog_item_id,branch_id,currency,unit_price,version,effective_from,effective_to) values(p_tenant_id,p_catalog_item_id,p_branch_id,upper(trim(coalesce(p_currency,'EGP'))),p_unit_price,v_version,coalesce(p_effective_from,now()),p_effective_to) returning id into v_id;
 return jsonb_build_object('id',v_id,'version',v_version);
end $$;


ALTER FUNCTION "public"."upsert_catalog_price_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_catalog_item_id" "uuid", "p_branch_id" character varying, "p_currency" character varying, "p_unit_price" numeric, "p_effective_from" timestamp with time zone, "p_effective_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_catalog_settings_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_currency" character varying DEFAULT 'EGP'::character varying, "p_delivery_fee" numeric DEFAULT 0, "p_tax_inclusive" boolean DEFAULT false, "p_allow_discounts" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare v_uid uuid:=auth.uid(); v_role text; v_row public.catalog_business_settings%rowtype;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous'),'false')='true' then raise exception 'UNAUTHENTICATED'; end if;
 if p_currency is null or upper(trim(p_currency)) !~ '^[A-Z]{3}$' then raise exception 'INVALID_CURRENCY'; end if;
 if p_delivery_fee<0 then raise exception 'INVALID_DELIVERY_FEE'; end if;
 select upper(m.role::text) into v_role from public.user_memberships m where m.user_id=v_uid and m.tenant_id=p_tenant_id and m.status='ACTIVE' and (m.business_id=p_business_id or m.business_id is null) order by case upper(m.role::text) when 'SUPER_ADMIN' then 0 when 'OWNER' then 1 when 'ADMIN' then 2 when 'BUSINESS_OWNER' then 3 when 'MANAGER' then 4 else 99 end limit 1;
 if v_role is null or v_role not in ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER','SUPER_ADMIN') then raise exception 'CATALOG_WRITE_FORBIDDEN'; end if;
 if v_role='SUPER_ADMIN' and not exists(select 1 from user_memberships m where m.user_id=v_uid and m.tenant_id=p_tenant_id and m.status='ACTIVE' and upper(m.role)='SUPER_ADMIN' and coalesce(m.permissions->>'scope','')='PLATFORM' and coalesce((m.permissions->>'full_control')::boolean,false)=true) then raise exception 'CATALOG_WRITE_FORBIDDEN'; end if;
 insert into public.catalog_business_settings(business_id,tenant_id,currency,delivery_fee,tax_inclusive,allow_discounts,updated_at) values(p_business_id,p_tenant_id,upper(trim(p_currency)),p_delivery_fee,p_tax_inclusive,p_allow_discounts,now()) on conflict(business_id) do update set tenant_id=excluded.tenant_id,currency=excluded.currency,delivery_fee=excluded.delivery_fee,tax_inclusive=excluded.tax_inclusive,allow_discounts=excluded.allow_discounts,updated_at=now() returning * into v_row;
 return to_jsonb(v_row);
end $_$;


ALTER FUNCTION "public"."upsert_catalog_settings_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_currency" character varying, "p_delivery_fee" numeric, "p_tax_inclusive" boolean, "p_allow_discounts" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_mnty_push_subscription"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text" DEFAULT NULL::"text", "p_platform" "text" DEFAULT NULL::"text") RETURNS "public"."push_subscriptions"
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'private'
    AS $_$ select private.upsert_mnty_push_subscription($1,$2,$3,$4,$5); $_$;


ALTER FUNCTION "public"."upsert_mnty_push_subscription"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text", "p_platform" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_journal_entry_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_debit NUMERIC(14,4);
    v_credit NUMERIC(14,4);
BEGIN
    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
    INTO v_debit, v_credit
    FROM journal_entry_lines
    WHERE journal_entry_id = NEW.journal_entry_id;

    IF ABS(v_debit - v_credit) > 0.0001 THEN
        RAISE EXCEPTION 'Financial Ledger Error: Unbalanced Journal Entry. Total Debit (%) must equal Total Credit (%)', v_debit, v_credit;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_journal_entry_balance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_mantigo_ride_acceptance_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_bid_ride text; v_bid_status text;
begin
  if new.accepted_bid_id is null then
    if new.status='ACCEPTED' then raise exception 'ACCEPTED_RIDE_REQUIRES_ACCEPTED_BID'; end if;
    return new;
  end if;
  select ride_id,status into v_bid_ride,v_bid_status
  from public.mantigo_bids where id=new.accepted_bid_id;
  if v_bid_ride is null then raise exception 'ACCEPTED_BID_NOT_FOUND'; end if;
  if v_bid_ride<>new.id then raise exception 'ACCEPTED_BID_RIDE_MISMATCH'; end if;
  if v_bid_status<>'ACCEPTED' then raise exception 'ACCEPTED_BID_STATUS_INVALID'; end if;
  return new;
end $$;


ALTER FUNCTION "public"."validate_mantigo_ride_acceptance_integrity"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "private"."platform_admins" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "private"."platform_admins" OWNER TO "postgres";


COMMENT ON TABLE "private"."platform_admins" IS 'Authoritative MNTY platform-level administrators. Managed only through privileged server-side bootstrap/administration; never used as frontend authorization metadata.';



CREATE TABLE IF NOT EXISTS "public"."account_registration_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "requested_role" character varying(40) NOT NULL,
    "status" character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "account_registration_requests_requested_role_check" CHECK ((("requested_role")::"text" = ANY ((ARRAY['CUSTOMER'::character varying, 'SERVICE_PROVIDER'::character varying])::"text"[]))),
    CONSTRAINT "account_registration_requests_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'CANCELLED'::character varying])::"text"[])))
);


ALTER TABLE "public"."account_registration_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."account_registration_requests" IS 'Registration decisions are server-authoritative through the mnty-registration-review Edge Function and private.review_registration_request_atomic; clients may create/read within RLS scope but cannot directly mutate review state.';



CREATE TABLE IF NOT EXISTS "public"."ad_spaces" (
    "id" character varying(64) NOT NULL,
    "code" character varying(64) NOT NULL,
    "name" character varying(255) NOT NULL,
    "placement" character varying(64) NOT NULL,
    "status" character varying(32) DEFAULT 'ACTIVE'::character varying NOT NULL
);

ALTER TABLE ONLY "public"."ad_spaces" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ad_spaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."advertisement_target_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "advertisement_id" character varying NOT NULL,
    "geo_area_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."advertisement_target_locations" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."advertisement_target_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."advertisements" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "business_id" "uuid" NOT NULL,
    "ad_space_id" character varying(64) NOT NULL,
    "title" character varying(255) NOT NULL,
    "creative_url" "text" NOT NULL,
    "target_url" "text",
    "status" character varying(32) DEFAULT 'PENDING_APPROVAL'::character varying NOT NULL,
    "approval_status" character varying(32) DEFAULT 'PENDING'::character varying NOT NULL,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."advertisements" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."advertisements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agreement_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agreement_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_type" character varying(96) NOT NULL,
    "participant_role" character varying(96) NOT NULL,
    "status" character varying(32) DEFAULT 'PENDING'::character varying NOT NULL,
    "joined_at" timestamp with time zone,
    "left_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "agreement_participants_status_ck" CHECK ((("status")::"text" = ANY ((ARRAY['PENDING'::character varying, 'ACTIVE'::character varying, 'DECLINED'::character varying, 'SUSPENDED'::character varying, 'TERMINATED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."agreement_participants" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."agreement_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agreements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying,
    "agreement_type" character varying(96) NOT NULL,
    "document_id" "uuid" NOT NULL,
    "document_version_id" "uuid" NOT NULL,
    "business_id" "uuid",
    "status" character varying(32) DEFAULT 'PENDING'::character varying NOT NULL,
    "effective_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "agreements_status_ck" CHECK ((("status")::"text" = ANY ((ARRAY['PENDING'::character varying, 'ACTIVE'::character varying, 'SUSPENDED'::character varying, 'EXPIRED'::character varying, 'TERMINATED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."agreements" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."agreements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approval_actions" (
    "id" character varying(64) NOT NULL,
    "approval_request_id" character varying(64) NOT NULL,
    "action" character varying(32) NOT NULL,
    "acted_by" "uuid" NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."approval_actions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."approval_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approval_requests" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "organization_id" character varying(64),
    "business_id" "uuid",
    "branch_id" character varying(64),
    "request_type" character varying(64) NOT NULL,
    "entity_type" character varying(64) NOT NULL,
    "entity_id" character varying(64) NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "status" character varying(32) DEFAULT 'PENDING'::character varying NOT NULL,
    "priority" character varying(32) DEFAULT 'NORMAL'::character varying NOT NULL,
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."approval_requests" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."approval_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying NOT NULL,
    "provider" character varying(32) NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "public_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "provider_secrets" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "payment_method" character varying(32) NOT NULL
);

ALTER TABLE ONLY "public"."tenant_payment_methods" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_memberships" (
    "id" character varying(64) NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "organization_id" character varying(64),
    "business_id" "uuid",
    "branch_id" character varying(64),
    "role" character varying(64) NOT NULL,
    "permissions" "jsonb" DEFAULT '[]'::"jsonb",
    "status" character varying(32) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."user_memberships" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_memberships" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."available_payment_methods" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "payment_method",
    "provider",
    "public_config"
   FROM "public"."tenant_payment_methods"
  WHERE (("is_enabled" = true) AND (EXISTS ( SELECT 1
           FROM "public"."user_memberships" "um"
          WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("tenant_payment_methods"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text")))));


ALTER VIEW "public"."available_payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."bookings" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "organization_id" character varying(64),
    "business_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "code" character varying(64) NOT NULL,
    "status" character varying(32) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "phone" character varying(32),
    "address" "text",
    "latitude" double precision,
    "longitude" double precision,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."branches" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_categories" (
    "id" character varying(64) NOT NULL,
    "sector_id" character varying(64) NOT NULL,
    "code" character varying(64) NOT NULL,
    "name_ar" character varying(255) NOT NULL,
    "name_en" character varying(255) NOT NULL,
    "status" character varying(32) DEFAULT 'ACTIVE'::character varying NOT NULL
);

ALTER TABLE ONLY "public"."business_categories" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_modules" (
    "id" character varying(64) NOT NULL,
    "business_id" "uuid" NOT NULL,
    "module_id" character varying(64) NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "configuration" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."business_modules" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_referral_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "code" character varying(32) NOT NULL,
    "status" character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_referral_codes_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'SUSPENDED'::character varying, 'REVOKED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."business_referral_codes" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_referral_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_referral_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referral_code_id" "uuid" NOT NULL,
    "referral_code" character varying(32) NOT NULL,
    "business_id" "uuid" NOT NULL,
    "visitor_user_id" "uuid",
    "event_type" character varying(24) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "business_referral_events_event_type_check" CHECK ((("event_type")::"text" = ANY ((ARRAY['SCAN'::character varying, 'VISIT'::character varying, 'SIGNUP'::character varying, 'LEAD'::character varying, 'ORDER'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."business_referral_events" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_referral_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_sectors" (
    "id" character varying(64) NOT NULL,
    "code" character varying(64) NOT NULL,
    "name_ar" character varying(255) NOT NULL,
    "name_en" character varying(255) NOT NULL,
    "status" character varying(32) DEFAULT 'ACTIVE'::character varying NOT NULL
);

ALTER TABLE ONLY "public"."business_sectors" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_sectors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying NOT NULL,
    "organization_id" character varying,
    "name" character varying NOT NULL,
    "code" character varying NOT NULL,
    "status" character varying DEFAULT 'ACTIVE'::character varying NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "businesses_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'SUSPENDED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."businesses" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."businesses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_business_settings" (
    "business_id" "uuid" NOT NULL,
    "tenant_id" character varying NOT NULL,
    "currency" character varying(8) DEFAULT 'EGP'::character varying NOT NULL,
    "delivery_fee" numeric(14,2) DEFAULT 0 NOT NULL,
    "tax_inclusive" boolean DEFAULT false NOT NULL,
    "allow_discounts" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "catalog_business_settings_currency_chk" CHECK ((("currency")::"text" = "upper"(("currency")::"text"))),
    CONSTRAINT "catalog_business_settings_delivery_chk" CHECK (("delivery_fee" >= (0)::numeric))
);

ALTER TABLE ONLY "public"."catalog_business_settings" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalog_business_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_item_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying NOT NULL,
    "catalog_item_id" "uuid" NOT NULL,
    "name_ar" "text" NOT NULL,
    "name_en" "text",
    "price_delta" numeric(14,2) DEFAULT 0 NOT NULL,
    "status" character varying(24) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "catalog_item_options_price_chk" CHECK (("price_delta" >= (0)::numeric)),
    CONSTRAINT "catalog_item_options_status_chk" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'ARCHIVED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."catalog_item_options" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalog_item_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_item_prices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying NOT NULL,
    "catalog_item_id" "uuid" NOT NULL,
    "branch_id" character varying,
    "currency" character varying(8) DEFAULT 'EGP'::character varying NOT NULL,
    "unit_price" numeric(14,2) NOT NULL,
    "version" bigint DEFAULT 1 NOT NULL,
    "status" character varying(24) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "effective_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "effective_to" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "catalog_item_prices_amount_chk" CHECK (("unit_price" >= (0)::numeric)),
    CONSTRAINT "catalog_item_prices_currency_chk" CHECK ((("currency")::"text" = "upper"(("currency")::"text"))),
    CONSTRAINT "catalog_item_prices_effective_chk" CHECK ((("effective_to" IS NULL) OR ("effective_to" > "effective_from"))),
    CONSTRAINT "catalog_item_prices_status_chk" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'ARCHIVED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."catalog_item_prices" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalog_item_prices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying NOT NULL,
    "business_id" "uuid" NOT NULL,
    "branch_id" character varying,
    "legacy_ref" character varying(160),
    "item_type" character varying(32) DEFAULT 'PRODUCT'::character varying NOT NULL,
    "name_ar" "text" NOT NULL,
    "name_en" "text",
    "description" "text",
    "sku" character varying(120),
    "status" character varying(24) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "tax_rate" numeric(7,4) DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "catalog_items_status_chk" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'ARCHIVED'::character varying])::"text"[]))),
    CONSTRAINT "catalog_items_tax_chk" CHECK ((("tax_rate" >= (0)::numeric) AND ("tax_rate" <= (100)::numeric)))
);

ALTER TABLE ONLY "public"."catalog_items" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalog_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chart_of_accounts" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "account_code" character varying(32) NOT NULL,
    "account_name" character varying(255) NOT NULL,
    "account_type" character varying(32) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."chart_of_accounts" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."chart_of_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commission_rules" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "business_id" "uuid",
    "module_id" character varying(64),
    "rule_type" character varying(32) DEFAULT 'PERCENTAGE'::character varying NOT NULL,
    "percentage" numeric(6,4) DEFAULT 0.0,
    "fixed_amount" numeric(14,4) DEFAULT 0.0,
    "per_item_amount" numeric(14,4) DEFAULT 0.0,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "commission_rules_fixed_amount_check" CHECK (("fixed_amount" >= (0)::numeric)),
    CONSTRAINT "commission_rules_per_item_amount_check" CHECK (("per_item_amount" >= (0)::numeric)),
    CONSTRAINT "commission_rules_percentage_check" CHECK (("percentage" >= (0)::numeric))
);

ALTER TABLE ONLY "public"."commission_rules" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."commission_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commission_transactions" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "business_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "rule_id" character varying(64),
    "gross_amount" numeric(14,4) NOT NULL,
    "commission_amount" numeric(14,4) NOT NULL,
    "status" character varying(32) DEFAULT 'COMPLETED'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "commission_transactions_commission_amount_check" CHECK (("commission_amount" >= (0)::numeric)),
    CONSTRAINT "commission_transactions_gross_amount_check" CHECK (("gross_amount" >= (0)::numeric))
);

ALTER TABLE ONLY "public"."commission_transactions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."commission_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consent_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "account_type" character varying(96),
    "document_id" "uuid",
    "document_version_id" "uuid",
    "agreement_id" "uuid",
    "consent_id" "uuid",
    "event_type" character varying(64) NOT NULL,
    "consent_status" character varying(32),
    "content_hash" character varying(128),
    "ip_address" character varying(128),
    "user_agent" "text",
    "device_info" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "session_id" character varying(255),
    "event_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_user_id" "uuid",
    "integrity_hash" character varying(128),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);

ALTER TABLE ONLY "public"."consent_audit_log" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."consent_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_accounts" (
    "id" character varying NOT NULL,
    "tenant_id" character varying NOT NULL,
    "business_id" "uuid" NOT NULL,
    "credit_policy_id" character varying NOT NULL,
    "approved_limit" numeric(18,2) DEFAULT 0 NOT NULL,
    "outstanding_amount" numeric(18,2) DEFAULT 0 NOT NULL,
    "available_amount" numeric(18,2) GENERATED ALWAYS AS (GREATEST(("approved_limit" - "outstanding_amount"), (0)::numeric)) STORED,
    "status" character varying DEFAULT 'ACTIVE'::character varying NOT NULL,
    "next_due_date" "date",
    "last_payment_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "credit_accounts_approved_limit_check" CHECK (("approved_limit" >= (0)::numeric)),
    CONSTRAINT "credit_accounts_outstanding_amount_check" CHECK (("outstanding_amount" >= (0)::numeric)),
    CONSTRAINT "credit_accounts_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'WARNING'::character varying, 'OVERDUE'::character varying, 'SUSPENDED'::character varying, 'BLOCKED'::character varying, 'CLOSED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."credit_accounts" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_periods" (
    "id" character varying NOT NULL,
    "tenant_id" character varying NOT NULL,
    "credit_account_id" character varying NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "due_date" "date" NOT NULL,
    "billed_amount" numeric(18,2) DEFAULT 0 NOT NULL,
    "paid_amount" numeric(18,2) DEFAULT 0 NOT NULL,
    "outstanding_amount" numeric(18,2) GENERATED ALWAYS AS (GREATEST(("billed_amount" - "paid_amount"), (0)::numeric)) STORED,
    "status" character varying DEFAULT 'OPEN'::character varying NOT NULL,
    "paid_at" timestamp with time zone,
    "days_overdue" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "credit_periods_billed_amount_check" CHECK (("billed_amount" >= (0)::numeric)),
    CONSTRAINT "credit_periods_check" CHECK (("period_end" >= "period_start")),
    CONSTRAINT "credit_periods_days_overdue_check" CHECK (("days_overdue" >= 0)),
    CONSTRAINT "credit_periods_paid_amount_check" CHECK (("paid_amount" >= (0)::numeric)),
    CONSTRAINT "credit_periods_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['OPEN'::character varying, 'DUE'::character varying, 'PARTIALLY_PAID'::character varying, 'PAID'::character varying, 'OVERDUE'::character varying, 'DEFAULTED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."credit_periods" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_policies" (
    "id" character varying NOT NULL,
    "tenant_id" character varying NOT NULL,
    "business_id" "uuid" NOT NULL,
    "policy_name" character varying NOT NULL,
    "credit_limit" numeric(18,2) DEFAULT 0 NOT NULL,
    "billing_cycle" character varying DEFAULT 'MONTHLY'::character varying NOT NULL,
    "payment_due_days" integer DEFAULT 30 NOT NULL,
    "grace_days" integer DEFAULT 0 NOT NULL,
    "warning_days" integer DEFAULT 3 NOT NULL,
    "suspend_after_days" integer DEFAULT 15 NOT NULL,
    "block_new_credit" boolean DEFAULT true NOT NULL,
    "status" character varying DEFAULT 'ACTIVE'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "credit_policies_billing_cycle_check" CHECK ((("billing_cycle")::"text" = 'MONTHLY'::"text")),
    CONSTRAINT "credit_policies_credit_limit_check" CHECK (("credit_limit" >= (0)::numeric)),
    CONSTRAINT "credit_policies_grace_days_check" CHECK ((("grace_days" >= 0) AND ("grace_days" <= 30))),
    CONSTRAINT "credit_policies_payment_due_days_check" CHECK ((("payment_due_days" >= 0) AND ("payment_due_days" <= 90))),
    CONSTRAINT "credit_policies_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'SUSPENDED'::character varying, 'CLOSED'::character varying])::"text"[]))),
    CONSTRAINT "credit_policies_suspend_after_days_check" CHECK ((("suspend_after_days" >= 0) AND ("suspend_after_days" <= 120))),
    CONSTRAINT "credit_policies_warning_days_check" CHECK ((("warning_days" >= 0) AND ("warning_days" <= 30)))
);

ALTER TABLE ONLY "public"."credit_policies" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "organization_id" character varying(64),
    "business_id" "uuid" NOT NULL,
    "branch_id" character varying(64),
    "name" character varying(255) NOT NULL,
    "code" character varying(64) NOT NULL,
    "status" character varying(32) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."departments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."digital_page_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "target_business_id" "uuid",
    "product_id" "uuid" NOT NULL,
    "page_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text",
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'EGP'::"text" NOT NULL,
    "pricing_hash" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "payment_status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "fulfillment_status" "text" DEFAULT 'REQUESTED'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider" "text",
    "provider_intent_id" "text",
    "provider_order_id" "text",
    "provider_transaction_id" "text",
    CONSTRAINT "digital_page_orders_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "digital_page_orders_fulfillment_status_check" CHECK (("fulfillment_status" = ANY (ARRAY['REQUESTED'::"text", 'IN_REVIEW'::"text", 'IN_PROGRESS'::"text", 'PUBLISHED'::"text", 'REJECTED'::"text", 'CANCELLED'::"text"]))),
    CONSTRAINT "digital_page_orders_page_type_check" CHECK (("page_type" = ANY (ARRAY['PORTFOLIO'::"text", 'MENU'::"text"]))),
    CONSTRAINT "digital_page_orders_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['PENDING'::"text", 'PAID'::"text", 'FAILED'::"text", 'REFUNDED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."digital_page_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."digital_page_payment_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "digital_page_order_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "external_event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "signature_verified" boolean NOT NULL,
    "raw_payload" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."digital_page_payment_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."digital_page_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_type" "text" NOT NULL,
    "code" "text" NOT NULL,
    "name_ar" "text" NOT NULL,
    "description_ar" "text",
    "price" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'EGP'::"text" NOT NULL,
    "duration_days" integer,
    "features" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "digital_page_products_page_type_check" CHECK (("page_type" = ANY (ARRAY['PORTFOLIO'::"text", 'MENU'::"text"]))),
    CONSTRAINT "digital_page_products_price_check" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."digital_page_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."digital_page_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_id" "uuid" NOT NULL,
    "section_type" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "title" "text",
    "content" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "digital_page_sections_section_type_check" CHECK (("section_type" = ANY (ARRAY['HERO'::"text", 'ABOUT'::"text", 'SERVICES'::"text", 'MENU'::"text", 'PORTFOLIO'::"text", 'CONTACT'::"text", 'CTA'::"text", 'CUSTOM'::"text"])))
);


ALTER TABLE "public"."digital_page_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."digital_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_type" "text" NOT NULL,
    "business_id" "uuid",
    "provider_profile_id" "uuid",
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "description" "text",
    "seo_title" "text",
    "seo_description" "text",
    "theme" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "version" bigint DEFAULT 1 NOT NULL,
    "published_at" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "digital_page_order_id" "uuid",
    CONSTRAINT "digital_pages_check" CHECK ((("business_id" IS NOT NULL) OR ("provider_profile_id" IS NOT NULL))),
    CONSTRAINT "digital_pages_page_type_check" CHECK (("page_type" = ANY (ARRAY['PORTFOLIO'::"text", 'MENU'::"text"]))),
    CONSTRAINT "digital_pages_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'PUBLISHED'::"text", 'ARCHIVED'::"text"])))
);


ALTER TABLE "public"."digital_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."erp_purchase_orders" (
    "id" character varying NOT NULL,
    "tenant_id" character varying NOT NULL,
    "business_id" "uuid" NOT NULL,
    "branch_id" character varying,
    "order_number" character varying NOT NULL,
    "supplier_id" character varying NOT NULL,
    "total_amount" numeric DEFAULT 0 NOT NULL,
    "tax_amount" numeric DEFAULT 0 NOT NULL,
    "discount_amount" numeric DEFAULT 0 NOT NULL,
    "status" character varying DEFAULT 'DRAFT'::character varying NOT NULL,
    "reason" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "erp_purchase_orders_discount_amount_check" CHECK (("discount_amount" >= (0)::numeric)),
    CONSTRAINT "erp_purchase_orders_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'PENDING_APPROVAL'::character varying, 'APPROVED'::character varying, 'POSTED'::character varying, 'VOID'::character varying])::"text"[]))),
    CONSTRAINT "erp_purchase_orders_tax_amount_check" CHECK (("tax_amount" >= (0)::numeric)),
    CONSTRAINT "erp_purchase_orders_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


ALTER TABLE "public"."erp_purchase_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."erp_purchase_receipts" (
    "id" character varying NOT NULL,
    "tenant_id" character varying NOT NULL,
    "business_id" "uuid" NOT NULL,
    "purchase_order_id" character varying NOT NULL,
    "receipt_number" character varying NOT NULL,
    "warehouse_id" character varying NOT NULL,
    "product_id" "uuid" NOT NULL,
    "received_quantity" numeric NOT NULL,
    "unit_cost" numeric NOT NULL,
    "status" character varying DEFAULT 'RECEIVED'::character varying NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "erp_purchase_receipts_received_quantity_check" CHECK (("received_quantity" > (0)::numeric)),
    CONSTRAINT "erp_purchase_receipts_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['RECEIVED'::character varying, 'VOID'::character varying])::"text"[]))),
    CONSTRAINT "erp_purchase_receipts_unit_cost_check" CHECK (("unit_cost" >= (0)::numeric))
);


ALTER TABLE "public"."erp_purchase_receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."erp_stock_transfers" (
    "id" character varying NOT NULL,
    "tenant_id" character varying NOT NULL,
    "business_id" "uuid" NOT NULL,
    "transfer_number" character varying NOT NULL,
    "from_warehouse_id" character varying NOT NULL,
    "to_warehouse_id" character varying NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" numeric NOT NULL,
    "status" character varying DEFAULT 'REQUESTED'::character varying NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "erp_stock_transfers_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "erp_stock_transfers_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['REQUESTED'::character varying, 'APPROVED'::character varying, 'IN_TRANSIT'::character varying, 'COMPLETED'::character varying, 'REJECTED'::character varying])::"text"[])))
);


ALTER TABLE "public"."erp_stock_transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fashion_orders" (
    "order_id" "text" NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "product_name" "text" NOT NULL,
    "size" "text" DEFAULT ''::"text" NOT NULL,
    "color" "text" DEFAULT ''::"text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "total_price" numeric(14,2) NOT NULL,
    "customer_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "address" "text" NOT NULL,
    "status" "text" DEFAULT 'NEW'::"text" NOT NULL,
    "date_formatted" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" character varying NOT NULL,
    "business_id" "uuid" NOT NULL,
    "branch_id" character varying NOT NULL
);

ALTER TABLE ONLY "public"."fashion_orders" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."fashion_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fashion_products" (
    "id" "text" NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category_id" "text" NOT NULL,
    "category_name" "text" NOT NULL,
    "store_name" "text" NOT NULL,
    "price" numeric(14,2) NOT NULL,
    "original_price" numeric(14,2),
    "rating" numeric(3,2) DEFAULT 0 NOT NULL,
    "review_count" integer DEFAULT 0 NOT NULL,
    "image_url" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "available_sizes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "available_colors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "stock_count" integer DEFAULT 0 NOT NULL,
    "is_best_seller" boolean DEFAULT false NOT NULL,
    "is_new_arrival" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" character varying NOT NULL,
    "business_id" "uuid" NOT NULL,
    "branch_id" character varying NOT NULL
);

ALTER TABLE ONLY "public"."fashion_products" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."fashion_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fashion_tailor_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "tailor_name" "text" NOT NULL,
    "service_type" "text" NOT NULL,
    "price_estimate" numeric(14,2) DEFAULT 0 NOT NULL,
    "delivery_days" integer DEFAULT 1 NOT NULL,
    "rating" numeric(3,2) DEFAULT 0 NOT NULL,
    "address" "text" DEFAULT ''::"text" NOT NULL,
    "is_available" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."fashion_tailor_services" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."fashion_tailor_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_obligations" (
    "id" character varying NOT NULL,
    "tenant_id" character varying NOT NULL,
    "business_id" "uuid",
    "order_id" "uuid",
    "payment_intent_id" character varying,
    "beneficiary_type" character varying NOT NULL,
    "beneficiary_id" character varying NOT NULL,
    "obligation_type" character varying NOT NULL,
    "gross_amount" numeric(18,2) NOT NULL,
    "amount" numeric(18,2) NOT NULL,
    "currency" character varying DEFAULT 'EGP'::character varying NOT NULL,
    "status" character varying DEFAULT 'DUE'::character varying NOT NULL,
    "payment_method" character varying,
    "settlement_id" character varying,
    "due_at" timestamp with time zone,
    "settled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "financial_obligations_amount_chk" CHECK ((("gross_amount" >= (0)::numeric) AND ("amount" >= (0)::numeric))),
    CONSTRAINT "financial_obligations_status_chk" CHECK ((("status")::"text" = ANY ((ARRAY['DUE'::character varying, 'PROCESSING'::character varying, 'SETTLED'::character varying, 'FAILED'::character varying, 'CANCELLED'::character varying])::"text"[]))),
    CONSTRAINT "financial_obligations_type_chk" CHECK ((("obligation_type")::"text" = ANY ((ARRAY['PLATFORM_COMMISSION'::character varying, 'PROVIDER_PAYOUT'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."financial_obligations" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_obligations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."general_ledger" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "business_id" "uuid",
    "journal_entry_id" character varying(64) NOT NULL,
    "journal_line_id" character varying(64) NOT NULL,
    "account_id" character varying(64) NOT NULL,
    "debit" numeric(14,4) DEFAULT 0.0 NOT NULL,
    "credit" numeric(14,4) DEFAULT 0.0 NOT NULL,
    "running_balance" numeric(14,4) DEFAULT 0.0 NOT NULL,
    "entry_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "posted_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "general_ledger_credit_check" CHECK (("credit" >= (0)::numeric)),
    CONSTRAINT "general_ledger_debit_check" CHECK (("debit" >= (0)::numeric))
);

ALTER TABLE ONLY "public"."general_ledger" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."general_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_transactions" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "business_id" "uuid" NOT NULL,
    "branch_id" character varying(64),
    "warehouse_id" character varying(64),
    "product_id" "uuid" NOT NULL,
    "transaction_type" character varying(64) NOT NULL,
    "quantity" numeric(14,4) NOT NULL,
    "unit_cost" numeric(14,4) DEFAULT 0.0 NOT NULL,
    "reference_id" character varying(128),
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."inventory_transactions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "applicant_user_id" "uuid" NOT NULL,
    "applicant_name" character varying NOT NULL,
    "applicant_phone" character varying NOT NULL,
    "qualifications" "text" DEFAULT ''::"text" NOT NULL,
    "cv_summary_text" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."job_applications" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "tenant_id" character varying,
    "business_id" "uuid",
    "title" character varying NOT NULL,
    "company_name" character varying NOT NULL,
    "category" character varying NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "requirements" "text" DEFAULT ''::"text" NOT NULL,
    "salary_range" character varying DEFAULT ''::character varying NOT NULL,
    "location" character varying DEFAULT ''::character varying NOT NULL,
    "job_type" character varying DEFAULT 'دوام كامل'::character varying NOT NULL,
    "employer_name" character varying DEFAULT ''::character varying NOT NULL,
    "employer_phone" character varying DEFAULT ''::character varying NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."jobs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_entries" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "organization_id" character varying(64),
    "business_id" "uuid",
    "branch_id" character varying(64),
    "reference_type" character varying(64),
    "reference_id" character varying(64),
    "description" "text",
    "status" character varying(32) DEFAULT 'POSTED'::character varying NOT NULL,
    "entry_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."journal_entries" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_entry_lines" (
    "id" character varying(64) NOT NULL,
    "journal_entry_id" character varying(64) NOT NULL,
    "account_id" character varying(64) NOT NULL,
    "debit" numeric(14,4) DEFAULT 0.0 NOT NULL,
    "credit" numeric(14,4) DEFAULT 0.0 NOT NULL,
    "description" "text",
    CONSTRAINT "journal_entry_lines_credit_check" CHECK (("credit" >= (0)::numeric)),
    CONSTRAINT "journal_entry_lines_debit_check" CHECK (("debit" >= (0)::numeric))
);

ALTER TABLE ONLY "public"."journal_entry_lines" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_entry_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legacy_module_idempotency" (
    "module_code" "text" NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "request_hash" "text" NOT NULL,
    "response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."legacy_module_idempotency" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."legacy_module_idempotency" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legal_document_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "content" "text" NOT NULL,
    "content_hash" character varying(128) NOT NULL,
    "status" character varying(32) DEFAULT 'DRAFT'::character varying NOT NULL,
    "published_at" timestamp with time zone,
    "effective_at" timestamp with time zone,
    "retired_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "legal_document_versions_status_ck" CHECK ((("status")::"text" = ANY ((ARRAY['DRAFT'::character varying, 'PUBLISHED'::character varying, 'RETIRED'::character varying])::"text"[]))),
    CONSTRAINT "legal_document_versions_version_ck" CHECK (("version_number" > 0))
);

ALTER TABLE ONLY "public"."legal_document_versions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_document_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legal_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying,
    "document_type" character varying(96) NOT NULL,
    "title" character varying(255) NOT NULL,
    "status" character varying(32) DEFAULT 'DRAFT'::character varying NOT NULL,
    "published_at" timestamp with time zone,
    "effective_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    "target_audience" "text"[] DEFAULT ARRAY['ALL'::"text"] NOT NULL,
    "required_consent" boolean DEFAULT false NOT NULL,
    "requires_reconsent" boolean DEFAULT false NOT NULL,
    "sector_codes" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "jurisdiction_country" character varying(8),
    "jurisdiction_region" character varying(128),
    "locale" character varying(16) DEFAULT 'ar-EG'::character varying NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "legal_documents_status_ck" CHECK ((("status")::"text" = ANY ((ARRAY['DRAFT'::character varying, 'PUBLISHED'::character varying, 'SUSPENDED'::character varying, 'RETIRED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."legal_documents" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legal_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_key" character varying(128) NOT NULL,
    "document_type" character varying(96) NOT NULL,
    "target_audience" character varying(96) DEFAULT 'ALL'::character varying NOT NULL,
    "required" boolean DEFAULT true NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "business_scoped" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."legal_requirements" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mantigo_bids" (
    "id" "text" NOT NULL,
    "ride_id" "text" NOT NULL,
    "captain_id" "uuid" NOT NULL,
    "captain_name" "text" NOT NULL,
    "captain_phone" "text" DEFAULT ''::"text" NOT NULL,
    "captain_rating" numeric(3,2) DEFAULT 0 NOT NULL,
    "vehicle_category" "text" NOT NULL,
    "vehicle_model" "text" NOT NULL,
    "vehicle_plate" "text" DEFAULT ''::"text" NOT NULL,
    "offered_price" numeric(14,2) NOT NULL,
    "eta_minutes" integer DEFAULT 0 NOT NULL,
    "captain_message" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'OFFERED'::"text" NOT NULL,
    CONSTRAINT "mantigo_bids_status_check" CHECK (("status" = ANY (ARRAY['OFFERED'::"text", 'ACCEPTED'::"text", 'REJECTED'::"text", 'WITHDRAWN'::"text", 'EXPIRED'::"text"])))
);

ALTER TABLE ONLY "public"."mantigo_bids" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."mantigo_bids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mantigo_captain_profiles" (
    "captain_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "verification_status" "text" DEFAULT 'UNVERIFIED'::"text" NOT NULL,
    "availability_status" "text" DEFAULT 'OFFLINE'::"text" NOT NULL,
    "vehicle_category" "text" NOT NULL,
    "vehicle_model" "text" DEFAULT ''::"text" NOT NULL,
    "vehicle_plate" "text" DEFAULT ''::"text" NOT NULL,
    "service_areas" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "current_lat" double precision,
    "current_lon" double precision,
    "rating" numeric(3,2) DEFAULT 0 NOT NULL,
    "completed_rides" integer DEFAULT 0 NOT NULL,
    "acceptance_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "cancellation_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "last_seen_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mantigo_captain_profiles_acceptance_rate_check" CHECK ((("acceptance_rate" >= (0)::numeric) AND ("acceptance_rate" <= (100)::numeric))),
    CONSTRAINT "mantigo_captain_profiles_availability_status_check" CHECK (("availability_status" = ANY (ARRAY['OFFLINE'::"text", 'AVAILABLE'::"text", 'BUSY'::"text"]))),
    CONSTRAINT "mantigo_captain_profiles_cancellation_rate_check" CHECK ((("cancellation_rate" >= (0)::numeric) AND ("cancellation_rate" <= (100)::numeric))),
    CONSTRAINT "mantigo_captain_profiles_completed_rides_check" CHECK (("completed_rides" >= 0)),
    CONSTRAINT "mantigo_captain_profiles_rating_check" CHECK ((("rating" >= (0)::numeric) AND ("rating" <= (5)::numeric))),
    CONSTRAINT "mantigo_captain_profiles_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'ACTIVE'::"text", 'SUSPENDED'::"text", 'REJECTED'::"text"]))),
    CONSTRAINT "mantigo_captain_profiles_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['UNVERIFIED'::"text", 'PENDING'::"text", 'VERIFIED'::"text", 'REJECTED'::"text"])))
);


ALTER TABLE "public"."mantigo_captain_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mantigo_financial_config" (
    "id" boolean DEFAULT true NOT NULL,
    "commission_rate" numeric(6,3) NOT NULL,
    "currency" "text" DEFAULT 'EGP'::"text" NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mantigo_financial_config_commission_rate_check" CHECK ((("commission_rate" >= (0)::numeric) AND ("commission_rate" <= (100)::numeric))),
    CONSTRAINT "mantigo_financial_config_id_check" CHECK (("id" = true))
);


ALTER TABLE "public"."mantigo_financial_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."mantigo_financial_config" IS 'Internal MantiGO commission configuration. Accessed through SECURITY DEFINER backend RPCs only; direct client table access is intentionally denied.';



CREATE TABLE IF NOT EXISTS "public"."mantigo_financial_ledger" (
    "id" "text" NOT NULL,
    "ride_id" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "captain_id" "uuid" NOT NULL,
    "currency" "text" DEFAULT 'EGP'::"text" NOT NULL,
    "gross_amount" numeric(14,2) NOT NULL,
    "commission_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "captain_net_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "payment_method" "text",
    "payment_status" "text" DEFAULT 'REQUIRED'::"text" NOT NULL,
    "settlement_status" "text" DEFAULT 'NOT_READY'::"text" NOT NULL,
    "payment_reference" "text",
    "settlement_reference" "text",
    "idempotency_key" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "commission_rate" numeric(6,3),
    "payment_confirmed_at" timestamp with time zone,
    "provider" "text",
    "provider_intent_id" "text",
    "provider_transaction_id" "text",
    CONSTRAINT "mantigo_financial_ledger_captain_net_amount_check" CHECK (("captain_net_amount" >= (0)::numeric)),
    CONSTRAINT "mantigo_financial_ledger_commission_amount_check" CHECK (("commission_amount" >= (0)::numeric)),
    CONSTRAINT "mantigo_financial_ledger_gross_amount_check" CHECK (("gross_amount" > (0)::numeric)),
    CONSTRAINT "mantigo_financial_ledger_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['REQUIRED'::"text", 'PENDING'::"text", 'PAID'::"text", 'FAILED'::"text", 'REFUNDED'::"text", 'CASH_CONFIRMED'::"text"]))),
    CONSTRAINT "mantigo_financial_ledger_settlement_status_check" CHECK (("settlement_status" = ANY (ARRAY['NOT_READY'::"text", 'READY'::"text", 'SETTLED'::"text", 'HELD'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."mantigo_financial_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mantigo_rate_limit_config" (
    "action" "text" NOT NULL,
    "max_events" integer NOT NULL,
    "window_minutes" integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mantigo_rate_limit_config_max_events_check" CHECK (("max_events" > 0)),
    CONSTRAINT "mantigo_rate_limit_config_window_minutes_check" CHECK (("window_minutes" > 0))
);


ALTER TABLE "public"."mantigo_rate_limit_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."mantigo_rate_limit_config" IS 'Internal MantiGO abuse-control thresholds. Direct client access denied; backend trigger enforcement only.';



CREATE TABLE IF NOT EXISTS "public"."mantigo_ride_ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ride_id" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "captain_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mantigo_ride_ratings_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);

ALTER TABLE ONLY "public"."mantigo_ride_ratings" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."mantigo_ride_ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mantigo_rides" (
    "id" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "customer_name" "text" DEFAULT ''::"text" NOT NULL,
    "customer_phone" "text" DEFAULT ''::"text" NOT NULL,
    "vehicle_category" "text" NOT NULL,
    "ride_type" "text" NOT NULL,
    "pickup_location" "text" NOT NULL,
    "destination_location" "text" NOT NULL,
    "proposed_price" numeric(14,2) NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'SEARCHING_BIDS'::"text" NOT NULL,
    "accepted_bid_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "idempotency_key" "text",
    "pickup_lat" double precision,
    "pickup_lon" double precision,
    "destination_lat" double precision,
    "destination_lon" double precision,
    CONSTRAINT "mantigo_rides_status_check" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'OPEN_FOR_BIDS'::"text", 'MATCHING'::"text", 'ACCEPTED'::"text", 'ARRIVED'::"text", 'STARTED'::"text", 'IN_PROGRESS'::"text", 'COMPLETED'::"text", 'CANCELLED'::"text", 'FAILED'::"text", 'SHOW_NO'::"text", 'EXPIRED'::"text"])))
);

ALTER TABLE ONLY "public"."mantigo_rides" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."mantigo_rides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_commission_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_kind" character varying NOT NULL,
    "service_id" "uuid",
    "commission_type" character varying DEFAULT 'PERCENTAGE'::character varying NOT NULL,
    "commission_value" numeric DEFAULT 0 NOT NULL,
    "min_project_value" numeric,
    "max_project_value" numeric,
    "status" character varying DEFAULT 'ACTIVE'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_commission_rules_commission_type_check" CHECK ((("commission_type")::"text" = ANY ((ARRAY['PERCENTAGE'::character varying, 'FIXED'::character varying])::"text"[]))),
    CONSTRAINT "marketing_commission_rules_commission_value_check" CHECK (("commission_value" >= (0)::numeric)),
    CONSTRAINT "marketing_commission_rules_provider_kind_check" CHECK ((("provider_kind")::"text" = ANY ((ARRAY['OFFICIAL'::character varying, 'PARTNER_COMPANY'::character varying, 'FREELANCER'::character varying])::"text"[]))),
    CONSTRAINT "marketing_commission_rules_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."marketing_commission_rules" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_commission_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_user_id" "uuid",
    "requester_business_id" "uuid",
    "title" character varying NOT NULL,
    "description" "text",
    "budget_min" numeric,
    "budget_max" numeric,
    "currency" character varying DEFAULT 'EGP'::character varying NOT NULL,
    "required_services" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "service_area" character varying,
    "status" character varying DEFAULT 'OPEN'::character varying NOT NULL,
    "source" character varying DEFAULT 'PLATFORM'::character varying NOT NULL,
    "assigned_provider_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_leads_source_check" CHECK ((("source")::"text" = ANY ((ARRAY['PLATFORM'::character varying, 'OFFICIAL_MANTIQATIX'::character varying, 'PARTNER_REFERRAL'::character varying, 'OTHER'::character varying])::"text"[]))),
    CONSTRAINT "marketing_leads_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['OPEN'::character varying, 'MATCHED'::character varying, 'IN_PROGRESS'::character varying, 'CLOSED'::character varying, 'CANCELLED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."marketing_leads" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_kind" character varying NOT NULL,
    "code" character varying NOT NULL,
    "name_ar" character varying NOT NULL,
    "name_en" character varying,
    "description" "text",
    "price" numeric DEFAULT 0 NOT NULL,
    "currency" character varying DEFAULT 'EGP'::character varying NOT NULL,
    "billing_period" character varying DEFAULT 'MONTHLY'::character varying NOT NULL,
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" character varying DEFAULT 'ACTIVE'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_plans_billing_period_check" CHECK ((("billing_period")::"text" = ANY ((ARRAY['MONTHLY'::character varying, 'QUARTERLY'::character varying, 'YEARLY'::character varying, 'ONE_TIME'::character varying])::"text"[]))),
    CONSTRAINT "marketing_plans_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "marketing_plans_provider_kind_check" CHECK ((("provider_kind")::"text" = ANY ((ARRAY['OFFICIAL'::character varying, 'PARTNER_COMPANY'::character varying, 'FREELANCER'::character varying])::"text"[]))),
    CONSTRAINT "marketing_plans_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."marketing_plans" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_project_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "role" character varying NOT NULL,
    "allocation_percent" numeric,
    "agreed_value" numeric DEFAULT 0 NOT NULL,
    "status" character varying DEFAULT 'ACTIVE'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_project_participants_agreed_value_check" CHECK (("agreed_value" >= (0)::numeric)),
    CONSTRAINT "marketing_project_participants_allocation_percent_check" CHECK ((("allocation_percent" >= (0)::numeric) AND ("allocation_percent" <= (100)::numeric))),
    CONSTRAINT "marketing_project_participants_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['MANAGER'::character varying, 'EXECUTOR'::character varying, 'SPECIALIST'::character varying, 'REFERRER'::character varying])::"text"[]))),
    CONSTRAINT "marketing_project_participants_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'COMPLETED'::character varying, 'REMOVED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."marketing_project_participants" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_project_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "client_business_id" "uuid",
    "project_type" character varying DEFAULT 'MARKETING_SERVICE'::character varying NOT NULL,
    "management_mode" character varying DEFAULT 'OFFICIAL'::character varying NOT NULL,
    "status" character varying DEFAULT 'OPEN'::character varying NOT NULL,
    "gross_value" numeric DEFAULT 0 NOT NULL,
    "platform_commission" numeric DEFAULT 0 NOT NULL,
    "management_fee" numeric DEFAULT 0 NOT NULL,
    "partner_payout" numeric DEFAULT 0 NOT NULL,
    "currency" character varying DEFAULT 'EGP'::character varying NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_projects_gross_value_check" CHECK (("gross_value" >= (0)::numeric)),
    CONSTRAINT "marketing_projects_management_fee_check" CHECK (("management_fee" >= (0)::numeric)),
    CONSTRAINT "marketing_projects_management_mode_check" CHECK ((("management_mode")::"text" = ANY ((ARRAY['OFFICIAL'::character varying, 'PARTNER'::character varying, 'JOINT'::character varying])::"text"[]))),
    CONSTRAINT "marketing_projects_partner_payout_check" CHECK (("partner_payout" >= (0)::numeric)),
    CONSTRAINT "marketing_projects_platform_commission_check" CHECK (("platform_commission" >= (0)::numeric)),
    CONSTRAINT "marketing_projects_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['OPEN'::character varying, 'ACTIVE'::character varying, 'ON_HOLD'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."marketing_projects" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_provider_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_kind" character varying NOT NULL,
    "business_id" "uuid",
    "owner_user_id" "uuid",
    "name_ar" character varying NOT NULL,
    "name_en" character varying,
    "slug" character varying NOT NULL,
    "description" "text",
    "specialties" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "service_areas" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "portfolio" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" character varying DEFAULT 'PENDING'::character varying NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "ranking_weight" numeric DEFAULT 0 NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "profile_image_path" "text",
    CONSTRAINT "marketing_provider_profiles_provider_kind_check" CHECK ((("provider_kind")::"text" = ANY ((ARRAY['OFFICIAL'::character varying, 'PARTNER_COMPANY'::character varying, 'FREELANCER'::character varying])::"text"[]))),
    CONSTRAINT "marketing_provider_profiles_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['PENDING'::character varying, 'ACTIVE'::character varying, 'SUSPENDED'::character varying, 'INACTIVE'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."marketing_provider_profiles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_provider_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_provider_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "service_description" "text",
    "pricing_from" numeric,
    "pricing_to" numeric,
    "currency" character varying DEFAULT 'EGP'::character varying NOT NULL,
    "status" character varying DEFAULT 'ACTIVE'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_provider_services_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."marketing_provider_services" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_provider_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_provider_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" character varying DEFAULT 'ACTIVE'::character varying NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ends_at" timestamp with time zone,
    "feature_overrides" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_provider_subscriptions_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['TRIAL'::character varying, 'ACTIVE'::character varying, 'PAUSED'::character varying, 'EXPIRED'::character varying, 'CANCELLED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."marketing_provider_subscriptions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_provider_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying NOT NULL,
    "name_ar" character varying NOT NULL,
    "name_en" character varying,
    "category_code" character varying,
    "description" "text",
    "status" character varying DEFAULT 'ACTIVE'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_services_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."marketing_services" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matrimony_contact_unlocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "unlocked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."matrimony_contact_unlocks" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."matrimony_contact_unlocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matrimony_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "gender" "text" NOT NULL,
    "pseudonym" "text" NOT NULL,
    "age" integer NOT NULL,
    "city" "text" NOT NULL,
    "country" "text" DEFAULT 'مصر'::"text" NOT NULL,
    "nationality" "text" DEFAULT 'مصري'::"text" NOT NULL,
    "education" "text" DEFAULT ''::"text" NOT NULL,
    "occupation" "text" DEFAULT ''::"text" NOT NULL,
    "marital_status" "text" DEFAULT ''::"text" NOT NULL,
    "religiosity_level" "text" DEFAULT ''::"text" NOT NULL,
    "housing_status" "text" DEFAULT ''::"text" NOT NULL,
    "financial_status" "text" DEFAULT ''::"text" NOT NULL,
    "about_me" "text" DEFAULT ''::"text" NOT NULL,
    "partner_requirements" "text" DEFAULT ''::"text" NOT NULL,
    "wali_contact_name" "text" DEFAULT ''::"text" NOT NULL,
    "wali_contact_phone" "text" DEFAULT ''::"text" NOT NULL,
    "direct_contact_phone" "text" DEFAULT ''::"text" NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "compatibility_tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."matrimony_profiles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."matrimony_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matrimony_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_user_id" "uuid" NOT NULL,
    "to_profile_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "message_text" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."matrimony_requests" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."matrimony_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medical_appointments" (
    "id" "text" NOT NULL,
    "tenant_id" character varying NOT NULL,
    "business_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "doctor_id" "text" NOT NULL,
    "date_time" bigint NOT NULL,
    "status" character varying DEFAULT 'BOOKED'::character varying NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."medical_appointments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."medical_appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modules" (
    "id" character varying(64) NOT NULL,
    "code" character varying(64) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "status" character varying(32) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "version" character varying(32) DEFAULT '1.0.0'::character varying NOT NULL,
    "configuration" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."modules" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_status_history" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "business_id" "uuid" NOT NULL,
    "branch_id" character varying(64),
    "order_id" "uuid" NOT NULL,
    "old_status" character varying(64),
    "new_status" character varying(64) NOT NULL,
    "changed_by" "uuid",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."order_status_history" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" NOT NULL,
    "tenant_id" character varying NOT NULL,
    "organization_id" character varying,
    "business_id" "uuid" NOT NULL,
    "branch_id" character varying,
    "customer_id" "uuid",
    "assigned_partner_id" "uuid",
    "status" character varying(64) DEFAULT 'NEW'::character varying NOT NULL,
    "subtotal" numeric(14,4) DEFAULT 0 NOT NULL,
    "discount" numeric(14,4) DEFAULT 0 NOT NULL,
    "tax" numeric(14,4) DEFAULT 0 NOT NULL,
    "delivery_fee" numeric(14,4) DEFAULT 0 NOT NULL,
    "total_amount" numeric(14,4) DEFAULT 0 NOT NULL,
    "total" numeric(14,4) GENERATED ALWAYS AS ("total_amount") STORED,
    "currency" character varying(8) DEFAULT 'EGP'::character varying NOT NULL,
    "customer_name" "text" DEFAULT ''::"text" NOT NULL,
    "customer_phone" "text" DEFAULT ''::"text" NOT NULL,
    "delivery_address" "text" DEFAULT ''::"text" NOT NULL,
    "items_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "client_idempotency_key" character varying(128),
    "pricing_version" bigint,
    "pricing_snapshot" "jsonb",
    "pricing_hash" character varying(64),
    "pricing_authority" character varying(64),
    CONSTRAINT "orders_delivery_fee_check" CHECK (("delivery_fee" >= (0)::numeric)),
    CONSTRAINT "orders_discount_check" CHECK (("discount" >= (0)::numeric)),
    CONSTRAINT "orders_subtotal_check" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "orders_tax_check" CHECK (("tax" >= (0)::numeric)),
    CONSTRAINT "orders_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);

ALTER TABLE ONLY "public"."orders" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "name" character varying(255) NOT NULL,
    "code" character varying(64) NOT NULL,
    "status" character varying(32) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."organizations" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_events" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "event_id" character varying(128) NOT NULL,
    "payment_id" character varying(64) NOT NULL,
    "amount" numeric(14,4) NOT NULL,
    "payment_method" character varying(32) NOT NULL,
    "status" character varying(32) DEFAULT 'PROCESSED'::character varying NOT NULL,
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "payment_events_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "payment_events_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['PROCESSED'::character varying, 'FAILED'::character varying, 'REFUNDED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."payment_events" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_financial_reconciliations" (
    "id" character varying(128) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "payment_intent_id" character varying(128) NOT NULL,
    "provider_event_id" character varying(128),
    "order_id" "uuid" NOT NULL,
    "currency" character varying(16) NOT NULL,
    "gross_amount" numeric(14,4) NOT NULL,
    "commission_amount" numeric(14,4) NOT NULL,
    "provider_received_amount" numeric(14,4) NOT NULL,
    "provider_payout_amount" numeric(14,4) NOT NULL,
    "commission_obligation_id" character varying(128),
    "provider_obligation_id" character varying(128),
    "commission_transaction_id" character varying(128),
    "reconciliation_status" character varying(32) DEFAULT 'RECONCILED'::character varying NOT NULL,
    "ledger_status" character varying(32) DEFAULT 'NOT_POSTED'::character varying NOT NULL,
    "exception_code" character varying(128),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_financial_reconciliation_provider_received_amount_check" CHECK (("provider_received_amount" >= (0)::numeric)),
    CONSTRAINT "payment_financial_reconciliations_commission_amount_check" CHECK (("commission_amount" >= (0)::numeric)),
    CONSTRAINT "payment_financial_reconciliations_gross_amount_check" CHECK (("gross_amount" > (0)::numeric)),
    CONSTRAINT "payment_financial_reconciliations_ledger_status_check" CHECK ((("ledger_status")::"text" = ANY ((ARRAY['NOT_POSTED'::character varying, 'POSTED'::character varying, 'EXCEPTION'::character varying])::"text"[]))),
    CONSTRAINT "payment_financial_reconciliations_provider_payout_amount_check" CHECK (("provider_payout_amount" >= (0)::numeric)),
    CONSTRAINT "payment_financial_reconciliations_reconciliation_status_check" CHECK ((("reconciliation_status")::"text" = ANY ((ARRAY['RECONCILED'::character varying, 'EXCEPTION'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."payment_financial_reconciliations" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_financial_reconciliations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_intents" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "order_id" "uuid" NOT NULL,
    "amount" numeric(14,4) NOT NULL,
    "currency" character varying(8) NOT NULL,
    "status" character varying(32) DEFAULT 'CREATED'::character varying NOT NULL,
    "provider" character varying(32) NOT NULL,
    "provider_intent_id" character varying(128),
    "idempotency_key" character varying(128) NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "payment_method" character varying(32) NOT NULL,
    "pricing_version" bigint,
    "pricing_hash" character varying(64),
    "provider_order_id" "text",
    CONSTRAINT "chk_payment_status" CHECK ((("status")::"text" = ANY ((ARRAY['CREATED'::character varying, 'PENDING'::character varying, 'SUCCEEDED'::character varying, 'FAILED'::character varying, 'CANCELLED'::character varying, 'REFUNDED'::character varying])::"text"[]))),
    CONSTRAINT "payment_intents_amount_check" CHECK (("amount" >= (0)::numeric))
);

ALTER TABLE ONLY "public"."payment_intents" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_intents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_provider_events" (
    "id" character varying NOT NULL,
    "tenant_id" character varying NOT NULL,
    "provider" character varying NOT NULL,
    "event_type" character varying NOT NULL,
    "payment_intent_id" character varying,
    "external_event_id" character varying NOT NULL,
    "status" character varying DEFAULT 'RECEIVED'::character varying NOT NULL,
    "signature_verified" boolean DEFAULT false NOT NULL,
    "payload_hash" character varying,
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "processed_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."payment_provider_events" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_provider_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payout_destinations" (
    "id" character varying NOT NULL,
    "tenant_id" character varying NOT NULL,
    "owner_type" character varying NOT NULL,
    "owner_id" character varying NOT NULL,
    "payout_method" character varying NOT NULL,
    "provider" character varying,
    "external_account_ref" character varying NOT NULL,
    "status" character varying DEFAULT 'PENDING_VERIFICATION'::character varying NOT NULL,
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "payout_destinations_status_chk" CHECK ((("status")::"text" = ANY ((ARRAY['PENDING_VERIFICATION'::character varying, 'ACTIVE'::character varying, 'SUSPENDED'::character varying, 'REJECTED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."payout_destinations" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."payout_destinations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_brand_assets" (
    "asset_key" "text" NOT NULL,
    "asset_path" "text" NOT NULL,
    "original_asset_path" "text" NOT NULL,
    "mime_type" "text" DEFAULT 'image/svg+xml'::"text" NOT NULL,
    "version" bigint DEFAULT 1 NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_brand_assets_key_chk" CHECK (("asset_key" = ANY (ARRAY['PRIMARY_LOGO'::"text", 'PRIMARY_MARK'::"text"])))
);


ALTER TABLE "public"."platform_brand_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_brand_identity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_key" character varying(80) NOT NULL,
    "brand_name_en" character varying(120) NOT NULL,
    "brand_name_ar" character varying(120) NOT NULL,
    "tagline_ar" character varying(255) NOT NULL,
    "logo_asset_ref" character varying(255),
    "app_icon_asset_ref" character varying(255),
    "primary_colors" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "typography" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "logo_usage" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "icon_sizes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "version" character varying(30) DEFAULT '1.0.0'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customer_service_phone" character varying(30),
    "social_marketing" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "platform_brand_identity_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."platform_brand_identity" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_brand_identity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_geo_areas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_code" character varying(2) NOT NULL,
    "level" character varying(20) NOT NULL,
    "code" character varying(64) NOT NULL,
    "parent_id" "uuid",
    "name_ar" character varying(160) NOT NULL,
    "name_en" character varying(160),
    "latitude" double precision,
    "longitude" double precision,
    "status" character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_geo_areas_level_check" CHECK ((("level")::"text" = ANY ((ARRAY['COUNTRY'::character varying, 'GOVERNORATE'::character varying, 'CENTER'::character varying])::"text"[]))),
    CONSTRAINT "platform_geo_areas_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."platform_geo_areas" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_geo_areas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_global_advertisements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying(180) NOT NULL,
    "creative_url" "text" NOT NULL,
    "target_url" "text",
    "ad_space_id" character varying DEFAULT 'HOME_SPONSORED'::character varying NOT NULL,
    "status" character varying(30) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "approval_status" character varying(30) DEFAULT 'APPROVED'::character varying NOT NULL,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_global_advertisements_approval_status_check" CHECK ((("approval_status")::"text" = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::"text"[]))),
    CONSTRAINT "platform_global_advertisements_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."platform_global_advertisements" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_global_advertisements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_onboarding_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "registration_request_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" character varying NOT NULL,
    "organization_id" character varying,
    "business_name" character varying NOT NULL,
    "provider_kind" character varying NOT NULL,
    "name_en" character varying,
    "description" "text",
    "specialties" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "service_areas" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "portfolio" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "profile_image_path" "text",
    "status" character varying DEFAULT 'PENDING'::character varying NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_onboarding_kind_chk" CHECK ((("length"(TRIM(BOTH FROM "provider_kind")) >= 2) AND ("length"(TRIM(BOTH FROM "provider_kind")) <= 80))),
    CONSTRAINT "provider_onboarding_requests_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'CANCELLED'::character varying])::"text"[]))),
    CONSTRAINT "provider_onboarding_user_role_chk" CHECK ((("length"(TRIM(BOTH FROM "business_name")) >= 2) AND ("length"(TRIM(BOTH FROM "business_name")) <= 180)))
);

ALTER TABLE ONLY "public"."provider_onboarding_requests" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_onboarding_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referral_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code" character varying(32) NOT NULL,
    "status" character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "referral_codes_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'SUSPENDED'::character varying, 'REVOKED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."referral_codes" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."referral_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referral_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referral_code_id" "uuid" NOT NULL,
    "referral_code" character varying(32) NOT NULL,
    "referrer_user_id" "uuid" NOT NULL,
    "referred_user_id" "uuid" NOT NULL,
    "status" character varying(24) DEFAULT 'REGISTERED'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "qualified_at" timestamp with time zone,
    "rewarded_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "referral_events_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['REGISTERED'::character varying, 'QUALIFIED'::character varying, 'REWARDED'::character varying, 'REJECTED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."referral_events" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."referral_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refund_transactions" (
    "id" character varying NOT NULL,
    "tenant_id" character varying NOT NULL,
    "business_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "payment_intent_id" character varying,
    "refund_amount" numeric NOT NULL,
    "commission_reversed" numeric DEFAULT 0 NOT NULL,
    "reason" "text",
    "status" character varying DEFAULT 'CONFIRMED'::character varying NOT NULL,
    "idempotency_key" character varying NOT NULL,
    "journal_entry_id" character varying,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "refund_transactions_commission_reversed_check" CHECK (("commission_reversed" >= (0)::numeric)),
    CONSTRAINT "refund_transactions_refund_amount_check" CHECK (("refund_amount" > (0)::numeric))
);

ALTER TABLE ONLY "public"."refund_transactions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."refund_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_inventory" (
    "id" "text" NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "name_ar" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "current_stock_qty" numeric(14,3) DEFAULT 0 NOT NULL,
    "min_stock_alert_threshold" numeric(14,3) DEFAULT 0 NOT NULL,
    "unit_cost_egp" numeric(14,2) DEFAULT 0 NOT NULL,
    "supplier_name" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" character varying NOT NULL,
    "business_id" "uuid" NOT NULL,
    "branch_id" character varying NOT NULL
);

ALTER TABLE ONLY "public"."restaurant_inventory" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_menu_items" (
    "id" "text" NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "name_ar" "text" NOT NULL,
    "description_ar" "text" DEFAULT ''::"text" NOT NULL,
    "base_price_egp" numeric(14,2) NOT NULL,
    "original_price_egp" numeric(14,2),
    "category" "text" NOT NULL,
    "is_available" boolean DEFAULT true NOT NULL,
    "is_popular" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" character varying NOT NULL,
    "business_id" "uuid" NOT NULL,
    "branch_id" character varying NOT NULL
);

ALTER TABLE ONLY "public"."restaurant_menu_items" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_orders" (
    "id" "text" NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_phone" "text" NOT NULL,
    "fulfillment_type" "text" NOT NULL,
    "table_number" integer,
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "subtotal_egp" numeric(14,2) NOT NULL,
    "tax_egp" numeric(14,2) DEFAULT 0 NOT NULL,
    "delivery_fee_egp" numeric(14,2) DEFAULT 0 NOT NULL,
    "discount_egp" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_egp" numeric(14,2) NOT NULL,
    "status" "text" DEFAULT 'NEW'::"text" NOT NULL,
    "notes_from_customer" "text" DEFAULT ''::"text" NOT NULL,
    "driver_name" "text",
    "driver_phone" "text",
    "delivery_pin_code" "text" DEFAULT ''::"text" NOT NULL,
    "delivery_address" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" character varying NOT NULL,
    "business_id" "uuid" NOT NULL,
    "branch_id" character varying NOT NULL
);

ALTER TABLE ONLY "public"."restaurant_orders" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_tables" (
    "id" "text" NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "table_number" integer NOT NULL,
    "capacity_persons" integer DEFAULT 2 NOT NULL,
    "status" "text" DEFAULT 'EMPTY'::"text" NOT NULL,
    "current_active_order_id" "text",
    "current_bill_egp" numeric(14,2) DEFAULT 0 NOT NULL,
    "reserved_customer_name" "text",
    "tenant_id" character varying NOT NULL,
    "business_id" "uuid" NOT NULL,
    "branch_id" character varying NOT NULL
);

ALTER TABLE ONLY "public"."restaurant_tables" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_tables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."school_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "school_type" "text" NOT NULL,
    "location" "text" NOT NULL,
    "rating" numeric(3,2) DEFAULT 0 NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "available_grades" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "tuition_fee" numeric(14,2) DEFAULT 0 NOT NULL,
    "is_available" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."school_profiles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."school_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settlement_attempts" (
    "id" character varying NOT NULL,
    "tenant_id" character varying NOT NULL,
    "obligation_id" character varying NOT NULL,
    "provider" character varying NOT NULL,
    "destination_id" character varying,
    "amount" numeric(14,4) NOT NULL,
    "currency" character varying(8) NOT NULL,
    "status" character varying DEFAULT 'PENDING'::character varying NOT NULL,
    "external_reference" character varying,
    "failure_code" character varying,
    "failure_message" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "settlement_attempts_amount_check" CHECK (("amount" > (0)::numeric))
);

ALTER TABLE ONLY "public"."settlement_attempts" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."settlement_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settlement_transactions" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "beneficiary_type" character varying(32) NOT NULL,
    "beneficiary_id" character varying(64) NOT NULL,
    "gross_amount" numeric(14,4) NOT NULL,
    "platform_fee" numeric(14,4) DEFAULT 0.0 NOT NULL,
    "net_payout" numeric(14,4) NOT NULL,
    "voucher_reserve" numeric(14,4) DEFAULT 0.0 NOT NULL,
    "payout_channel" character varying(64) DEFAULT 'BANK_TRANSFER'::character varying NOT NULL,
    "journal_entry_id" character varying(64),
    "status" character varying(32) DEFAULT 'SETTLED'::character varying NOT NULL,
    "reference_id" character varying(64),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "settlement_transactions_beneficiary_type_check" CHECK ((("beneficiary_type")::"text" = ANY ((ARRAY['MERCHANT'::character varying, 'PARTNER'::character varying, 'CAPTAIN'::character varying])::"text"[]))),
    CONSTRAINT "settlement_transactions_gross_amount_check" CHECK (("gross_amount" >= (0)::numeric)),
    CONSTRAINT "settlement_transactions_net_payout_check" CHECK (("net_payout" >= (0)::numeric)),
    CONSTRAINT "settlement_transactions_platform_fee_check" CHECK (("platform_fee" >= (0)::numeric)),
    CONSTRAINT "settlement_transactions_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['PENDING'::character varying, 'SETTLED'::character varying, 'CANCELLED'::character varying])::"text"[]))),
    CONSTRAINT "settlement_transactions_voucher_reserve_check" CHECK (("voucher_reserve" >= (0)::numeric))
);

ALTER TABLE ONLY "public"."settlement_transactions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."settlement_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smm_admins" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."smm_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smm_order_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."smm_order_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smm_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "target_url" "text" NOT NULL,
    "quantity" bigint NOT NULL,
    "selling_price" numeric(18,8) NOT NULL,
    "provider_cost" numeric(18,8) DEFAULT 0 NOT NULL,
    "profit" numeric(18,8) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "provider_order_id" "text",
    "provider_status" "text",
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "smm_orders_provider_cost_check" CHECK (("provider_cost" >= (0)::numeric)),
    CONSTRAINT "smm_orders_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "smm_orders_selling_price_check" CHECK (("selling_price" >= (0)::numeric)),
    CONSTRAINT "smm_orders_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'SUBMITTING'::"text", 'PROCESSING'::"text", 'COMPLETED'::"text", 'PARTIAL'::"text", 'CANCELLED'::"text", 'REFUNDED'::"text", 'FAILED'::"text"])))
);


ALTER TABLE "public"."smm_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smm_provider_credentials" (
    "provider_id" "uuid" NOT NULL,
    "api_key_ciphertext" "text",
    "configured" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."smm_provider_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smm_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "api_url" "text" NOT NULL,
    "api_style" "text" DEFAULT 'generic'::"text" NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "priority" integer DEFAULT 100 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."smm_providers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smm_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "external_service_id" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "category" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "provider_cost" numeric(18,8) DEFAULT 0 NOT NULL,
    "selling_price" numeric(18,8) DEFAULT 0 NOT NULL,
    "min_quantity" bigint DEFAULT 1 NOT NULL,
    "max_quantity" bigint DEFAULT 1000000 NOT NULL,
    "refill" boolean DEFAULT false NOT NULL,
    "cancel" boolean DEFAULT false NOT NULL,
    "dripfeed" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "smm_services_check" CHECK (("max_quantity" >= "min_quantity")),
    CONSTRAINT "smm_services_min_quantity_check" CHECK (("min_quantity" > 0)),
    CONSTRAINT "smm_services_provider_cost_check" CHECK (("provider_cost" >= (0)::numeric)),
    CONSTRAINT "smm_services_selling_price_check" CHECK (("selling_price" >= (0)::numeric))
);


ALTER TABLE "public"."smm_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smm_wallet_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" numeric(18,8) NOT NULL,
    "type" "text" NOT NULL,
    "reference_id" "uuid",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "smm_wallet_transactions_type_check" CHECK (("type" = ANY (ARRAY['CREDIT'::"text", 'DEBIT'::"text", 'REFUND'::"text", 'ADJUSTMENT'::"text"])))
);


ALTER TABLE "public"."smm_wallet_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smm_wallets" (
    "user_id" "uuid" NOT NULL,
    "balance" numeric(18,8) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "smm_wallets_balance_check" CHECK (("balance" >= (0)::numeric))
);


ALTER TABLE "public"."smm_wallets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_balances" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "business_id" "uuid" NOT NULL,
    "branch_id" character varying(64),
    "warehouse_id" character varying(64) NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity_on_hand" numeric(14,4) DEFAULT 0.0 NOT NULL,
    "quantity_reserved" numeric(14,4) DEFAULT 0.0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."stock_balances" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_tier_prices" (
    "tier_code" "text" NOT NULL,
    "monthly_price" numeric(12,2) NOT NULL,
    "annual_price" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'EGP'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "subscription_tier_prices_annual_price_check" CHECK (("annual_price" >= (0)::numeric)),
    CONSTRAINT "subscription_tier_prices_currency_check" CHECK (("currency" = 'EGP'::"text")),
    CONSTRAINT "subscription_tier_prices_monthly_price_check" CHECK (("monthly_price" >= (0)::numeric))
);

ALTER TABLE ONLY "public"."subscription_tier_prices" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_tier_prices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sync_logs" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "business_id" "uuid",
    "user_id" character varying(64) NOT NULL,
    "entity_type" character varying(64) NOT NULL,
    "entity_id" character varying(64) NOT NULL,
    "operation" character varying(32) NOT NULL,
    "sync_status" character varying(32) DEFAULT 'COMPLETED'::character varying NOT NULL,
    "conflict_resolved" boolean DEFAULT false,
    "resolution_strategy" character varying(64),
    "client_timestamp" timestamp with time zone,
    "server_timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."sync_logs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."sync_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "rating" numeric(3,2) DEFAULT 0 NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "hourly_rate" numeric(14,2) DEFAULT 0 NOT NULL,
    "is_available" boolean DEFAULT true NOT NULL,
    "location" "text" DEFAULT ''::"text" NOT NULL,
    "experience_years" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."teacher_profiles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_modules" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "module_id" character varying(64) NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "configuration" "jsonb" DEFAULT '{}'::"jsonb",
    "enabled_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "disabled_at" timestamp with time zone,
    "updated_by" character varying(64),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."tenant_modules" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" character varying(64) NOT NULL,
    "name" character varying(255) NOT NULL,
    "code" character varying(64) NOT NULL,
    "status" character varying(32) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."tenants" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."used_item_ads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "tenant_id" character varying,
    "business_id" "uuid",
    "title" character varying NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "category" character varying NOT NULL,
    "price" numeric(14,2) NOT NULL,
    "seller_name" character varying NOT NULL,
    "seller_phone" character varying NOT NULL,
    "image_url" "text" DEFAULT ''::"text" NOT NULL,
    "fee_paid" numeric(14,2) DEFAULT 0 NOT NULL,
    "location" character varying DEFAULT ''::character varying NOT NULL,
    "is_sold" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "used_item_ads_fee_paid_check" CHECK (("fee_paid" >= (0)::numeric)),
    CONSTRAINT "used_item_ads_price_check" CHECK (("price" >= (0)::numeric))
);

ALTER TABLE ONLY "public"."used_item_ads" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."used_item_ads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."used_item_category_fees" (
    "category" character varying NOT NULL,
    "fee" numeric(14,2) NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "used_item_category_fees_fee_check" CHECK (("fee" >= (0)::numeric))
);

ALTER TABLE ONLY "public"."used_item_category_fees" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."used_item_category_fees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_type" character varying(96) NOT NULL,
    "document_id" "uuid" NOT NULL,
    "document_version_id" "uuid" NOT NULL,
    "agreement_id" "uuid",
    "consent_status" character varying(32) NOT NULL,
    "consented_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" character varying(128),
    "user_agent" "text",
    "device_info" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "session_id" character varying(255),
    "content_hash" character varying(128) NOT NULL,
    "source" character varying(64) DEFAULT 'APP'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "user_consents_status_ck" CHECK ((("consent_status")::"text" = ANY ((ARRAY['ACCEPTED'::character varying, 'DECLINED'::character varying, 'REVOKED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."user_consents" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profile_media" (
    "user_id" "uuid" NOT NULL,
    "avatar_url" "text" DEFAULT ''::"text" NOT NULL,
    "cover_url" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."user_profile_media" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profile_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_accounts" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "owner_type" character varying(32) NOT NULL,
    "owner_id" character varying(64) NOT NULL,
    "currency" character varying(16) DEFAULT 'EGP'::character varying NOT NULL,
    "status" character varying(32) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "allow_negative" boolean DEFAULT false NOT NULL,
    "gl_account_id" character varying(64),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "wallet_accounts_owner_type_check" CHECK ((("owner_type")::"text" = ANY ((ARRAY['CUSTOMER'::character varying, 'MERCHANT'::character varying, 'PARTNER'::character varying, 'SYSTEM'::character varying])::"text"[]))),
    CONSTRAINT "wallet_accounts_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'FROZEN'::character varying, 'CLOSED'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."wallet_accounts" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_transactions" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "wallet_id" character varying(64) NOT NULL,
    "transaction_type" character varying(32) NOT NULL,
    "amount" numeric(14,4) NOT NULL,
    "balance_after" numeric(14,4) NOT NULL,
    "idempotency_key" character varying(128) NOT NULL,
    "status" character varying(32) DEFAULT 'CONFIRMED'::character varying NOT NULL,
    "reference_type" character varying(64),
    "reference_id" character varying(64),
    "description" "text",
    "journal_entry_id" character varying(64),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "wallet_transactions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "wallet_transactions_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['PENDING'::character varying, 'CONFIRMED'::character varying, 'REVERSED'::character varying, 'FAILED'::character varying])::"text"[]))),
    CONSTRAINT "wallet_transactions_transaction_type_check" CHECK ((("transaction_type")::"text" = ANY ((ARRAY['CREDIT'::character varying, 'DEBIT'::character varying, 'REFUND'::character varying, 'ADJUSTMENT'::character varying, 'COMMISSION_SETTLEMENT'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."wallet_transactions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."warehouses" (
    "id" character varying(64) NOT NULL,
    "tenant_id" character varying(64) NOT NULL,
    "business_id" "uuid" NOT NULL,
    "branch_id" character varying(64),
    "name" character varying(255) NOT NULL,
    "code" character varying(64) NOT NULL,
    "status" character varying(32) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY "public"."warehouses" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."warehouses" OWNER TO "postgres";


ALTER TABLE ONLY "private"."platform_admins"
    ADD CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."account_registration_requests"
    ADD CONSTRAINT "account_registration_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ad_spaces"
    ADD CONSTRAINT "ad_spaces_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."ad_spaces"
    ADD CONSTRAINT "ad_spaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."advertisement_target_locations"
    ADD CONSTRAINT "advertisement_target_locations_advertisement_id_geo_area_id_key" UNIQUE ("advertisement_id", "geo_area_id");



ALTER TABLE ONLY "public"."advertisement_target_locations"
    ADD CONSTRAINT "advertisement_target_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."advertisements"
    ADD CONSTRAINT "advertisements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agreement_participants"
    ADD CONSTRAINT "agreement_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_actions"
    ADD CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_categories"
    ADD CONSTRAINT "business_categories_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."business_categories"
    ADD CONSTRAINT "business_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_modules"
    ADD CONSTRAINT "business_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_referral_codes"
    ADD CONSTRAINT "business_referral_codes_business_id_key" UNIQUE ("business_id");



ALTER TABLE ONLY "public"."business_referral_codes"
    ADD CONSTRAINT "business_referral_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."business_referral_codes"
    ADD CONSTRAINT "business_referral_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_referral_events"
    ADD CONSTRAINT "business_referral_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_sectors"
    ADD CONSTRAINT "business_sectors_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."business_sectors"
    ADD CONSTRAINT "business_sectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_subscriptions"
    ADD CONSTRAINT "business_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catalog_business_settings"
    ADD CONSTRAINT "catalog_business_settings_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."catalog_item_options"
    ADD CONSTRAINT "catalog_item_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catalog_item_prices"
    ADD CONSTRAINT "catalog_item_prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commission_rules"
    ADD CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commission_transactions"
    ADD CONSTRAINT "commission_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consent_audit_log"
    ADD CONSTRAINT "consent_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_accounts"
    ADD CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_accounts"
    ADD CONSTRAINT "credit_accounts_tenant_id_business_id_key" UNIQUE ("tenant_id", "business_id");



ALTER TABLE ONLY "public"."credit_periods"
    ADD CONSTRAINT "credit_periods_credit_account_id_period_start_period_end_key" UNIQUE ("credit_account_id", "period_start", "period_end");



ALTER TABLE ONLY "public"."credit_periods"
    ADD CONSTRAINT "credit_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_policies"
    ADD CONSTRAINT "credit_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_policies"
    ADD CONSTRAINT "credit_policies_tenant_id_business_id_key" UNIQUE ("tenant_id", "business_id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digital_page_orders"
    ADD CONSTRAINT "digital_page_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digital_page_orders"
    ADD CONSTRAINT "digital_page_orders_user_id_idempotency_key_key" UNIQUE ("user_id", "idempotency_key");



ALTER TABLE ONLY "public"."digital_page_payment_events"
    ADD CONSTRAINT "digital_page_payment_events_external_event_id_key" UNIQUE ("external_event_id");



ALTER TABLE ONLY "public"."digital_page_payment_events"
    ADD CONSTRAINT "digital_page_payment_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digital_page_products"
    ADD CONSTRAINT "digital_page_products_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."digital_page_products"
    ADD CONSTRAINT "digital_page_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digital_page_sections"
    ADD CONSTRAINT "digital_page_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digital_pages"
    ADD CONSTRAINT "digital_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digital_pages"
    ADD CONSTRAINT "digital_pages_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."education_requests"
    ADD CONSTRAINT "education_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."erp_purchase_orders"
    ADD CONSTRAINT "erp_purchase_orders_business_id_order_number_key" UNIQUE ("business_id", "order_number");



ALTER TABLE ONLY "public"."erp_purchase_orders"
    ADD CONSTRAINT "erp_purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."erp_purchase_receipts"
    ADD CONSTRAINT "erp_purchase_receipts_business_id_receipt_number_key" UNIQUE ("business_id", "receipt_number");



ALTER TABLE ONLY "public"."erp_purchase_receipts"
    ADD CONSTRAINT "erp_purchase_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."erp_stock_transfers"
    ADD CONSTRAINT "erp_stock_transfers_business_id_transfer_number_key" UNIQUE ("business_id", "transfer_number");



ALTER TABLE ONLY "public"."erp_stock_transfers"
    ADD CONSTRAINT "erp_stock_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fashion_orders"
    ADD CONSTRAINT "fashion_orders_pkey" PRIMARY KEY ("order_id");



ALTER TABLE ONLY "public"."fashion_products"
    ADD CONSTRAINT "fashion_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fashion_tailor_services"
    ADD CONSTRAINT "fashion_tailor_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_obligations"
    ADD CONSTRAINT "financial_obligations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."general_ledger"
    ADD CONSTRAINT "general_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."indrive_bids"
    ADD CONSTRAINT "indrive_bids_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."indrive_requests"
    ADD CONSTRAINT "indrive_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_job_id_applicant_user_id_key" UNIQUE ("job_id", "applicant_user_id");



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entry_lines"
    ADD CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legacy_module_idempotency"
    ADD CONSTRAINT "legacy_module_idempotency_pkey" PRIMARY KEY ("module_code", "actor_user_id", "idempotency_key");



ALTER TABLE ONLY "public"."legal_document_versions"
    ADD CONSTRAINT "legal_document_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_document_versions"
    ADD CONSTRAINT "legal_document_versions_unique" UNIQUE ("document_id", "version_number");



ALTER TABLE ONLY "public"."legal_documents"
    ADD CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_requirements"
    ADD CONSTRAINT "legal_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_requirements"
    ADD CONSTRAINT "legal_requirements_unique" UNIQUE ("action_key", "document_type", "target_audience");



ALTER TABLE ONLY "public"."mantigo_bids"
    ADD CONSTRAINT "mantigo_bids_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mantigo_captain_profiles"
    ADD CONSTRAINT "mantigo_captain_profiles_pkey" PRIMARY KEY ("captain_id");



ALTER TABLE ONLY "public"."mantigo_financial_config"
    ADD CONSTRAINT "mantigo_financial_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mantigo_financial_ledger"
    ADD CONSTRAINT "mantigo_financial_ledger_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."mantigo_financial_ledger"
    ADD CONSTRAINT "mantigo_financial_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mantigo_financial_ledger"
    ADD CONSTRAINT "mantigo_financial_ledger_ride_id_key" UNIQUE ("ride_id");



ALTER TABLE ONLY "public"."mantigo_rate_limit_config"
    ADD CONSTRAINT "mantigo_rate_limit_config_pkey" PRIMARY KEY ("action");



ALTER TABLE ONLY "public"."mantigo_ride_ratings"
    ADD CONSTRAINT "mantigo_ride_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mantigo_ride_ratings"
    ADD CONSTRAINT "mantigo_ride_ratings_ride_id_customer_id_key" UNIQUE ("ride_id", "customer_id");



ALTER TABLE ONLY "public"."mantigo_rides"
    ADD CONSTRAINT "mantigo_rides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_commission_rules"
    ADD CONSTRAINT "marketing_commission_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_leads"
    ADD CONSTRAINT "marketing_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_plans"
    ADD CONSTRAINT "marketing_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_plans"
    ADD CONSTRAINT "marketing_plans_provider_kind_code_key" UNIQUE ("provider_kind", "code");



ALTER TABLE ONLY "public"."marketing_project_participants"
    ADD CONSTRAINT "marketing_project_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_project_participants"
    ADD CONSTRAINT "marketing_project_participants_project_id_provider_id_role_key" UNIQUE ("project_id", "provider_id", "role");



ALTER TABLE ONLY "public"."marketing_projects"
    ADD CONSTRAINT "marketing_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_provider_profiles"
    ADD CONSTRAINT "marketing_provider_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_provider_profiles"
    ADD CONSTRAINT "marketing_provider_profiles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."marketing_provider_services"
    ADD CONSTRAINT "marketing_provider_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_provider_services"
    ADD CONSTRAINT "marketing_provider_services_provider_id_service_id_key" UNIQUE ("provider_id", "service_id");



ALTER TABLE ONLY "public"."marketing_provider_subscriptions"
    ADD CONSTRAINT "marketing_provider_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_services"
    ADD CONSTRAINT "marketing_services_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."marketing_services"
    ADD CONSTRAINT "marketing_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matrimony_contact_unlocks"
    ADD CONSTRAINT "matrimony_contact_unlocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matrimony_contact_unlocks"
    ADD CONSTRAINT "matrimony_contact_unlocks_request_id_key" UNIQUE ("request_id");



ALTER TABLE ONLY "public"."matrimony_profiles"
    ADD CONSTRAINT "matrimony_profiles_owner_user_id_key" UNIQUE ("owner_user_id");



ALTER TABLE ONLY "public"."matrimony_profiles"
    ADD CONSTRAINT "matrimony_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matrimony_requests"
    ADD CONSTRAINT "matrimony_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medical_appointments"
    ADD CONSTRAINT "medical_appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_financial_reconciliations"
    ADD CONSTRAINT "payment_financial_reconciliations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_provider_events"
    ADD CONSTRAINT "payment_provider_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_provider_events"
    ADD CONSTRAINT "payment_provider_events_provider_external_event_id_key" UNIQUE ("provider", "external_event_id");



ALTER TABLE ONLY "public"."payout_destinations"
    ADD CONSTRAINT "payout_destinations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_brand_assets"
    ADD CONSTRAINT "platform_brand_assets_pkey" PRIMARY KEY ("asset_key");



ALTER TABLE ONLY "public"."platform_brand_identity"
    ADD CONSTRAINT "platform_brand_identity_brand_key_key" UNIQUE ("brand_key");



ALTER TABLE ONLY "public"."platform_brand_identity"
    ADD CONSTRAINT "platform_brand_identity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_feature_flags"
    ADD CONSTRAINT "platform_feature_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_geo_areas"
    ADD CONSTRAINT "platform_geo_areas_country_code_level_code_key" UNIQUE ("country_code", "level", "code");



ALTER TABLE ONLY "public"."platform_geo_areas"
    ADD CONSTRAINT "platform_geo_areas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_global_advertisements"
    ADD CONSTRAINT "platform_global_advertisements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_onboarding_requests"
    ADD CONSTRAINT "provider_onboarding_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_onboarding_requests"
    ADD CONSTRAINT "provider_onboarding_requests_registration_request_id_key" UNIQUE ("registration_request_id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_codes"
    ADD CONSTRAINT "referral_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."referral_codes"
    ADD CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_codes"
    ADD CONSTRAINT "referral_codes_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."referral_events"
    ADD CONSTRAINT "referral_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_events"
    ADD CONSTRAINT "referral_events_referred_user_id_key" UNIQUE ("referred_user_id");



ALTER TABLE ONLY "public"."refund_transactions"
    ADD CONSTRAINT "refund_transactions_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."refund_transactions"
    ADD CONSTRAINT "refund_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_inventory"
    ADD CONSTRAINT "restaurant_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_menu_items"
    ADD CONSTRAINT "restaurant_menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_orders"
    ADD CONSTRAINT "restaurant_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_tables"
    ADD CONSTRAINT "restaurant_tables_owner_user_id_table_number_key" UNIQUE ("owner_user_id", "table_number");



ALTER TABLE ONLY "public"."restaurant_tables"
    ADD CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."school_profiles"
    ADD CONSTRAINT "school_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlement_attempts"
    ADD CONSTRAINT "settlement_attempts_obligation_id_external_reference_key" UNIQUE ("obligation_id", "external_reference");



ALTER TABLE ONLY "public"."settlement_attempts"
    ADD CONSTRAINT "settlement_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlement_transactions"
    ADD CONSTRAINT "settlement_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smm_admins"
    ADD CONSTRAINT "smm_admins_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."smm_order_events"
    ADD CONSTRAINT "smm_order_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smm_orders"
    ADD CONSTRAINT "smm_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smm_provider_credentials"
    ADD CONSTRAINT "smm_provider_credentials_pkey" PRIMARY KEY ("provider_id");



ALTER TABLE ONLY "public"."smm_providers"
    ADD CONSTRAINT "smm_providers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."smm_providers"
    ADD CONSTRAINT "smm_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smm_services"
    ADD CONSTRAINT "smm_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smm_services"
    ADD CONSTRAINT "smm_services_provider_id_external_service_id_key" UNIQUE ("provider_id", "external_service_id");



ALTER TABLE ONLY "public"."smm_wallet_transactions"
    ADD CONSTRAINT "smm_wallet_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smm_wallets"
    ADD CONSTRAINT "smm_wallets_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."stock_balances"
    ADD CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_payment_intents"
    ADD CONSTRAINT "subscription_payment_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_tier_prices"
    ADD CONSTRAINT "subscription_tier_prices_pkey" PRIMARY KEY ("tier_code");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sync_logs"
    ADD CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_profiles"
    ADD CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_modules"
    ADD CONSTRAINT "tenant_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_payment_methods"
    ADD CONSTRAINT "tenant_payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_messages"
    ADD CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "uk_branch_biz_code" UNIQUE ("business_id", "code");



ALTER TABLE ONLY "public"."business_modules"
    ADD CONSTRAINT "uk_business_module" UNIQUE ("business_id", "module_id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "uk_org_tenant_code" UNIQUE ("tenant_id", "code");



ALTER TABLE ONLY "public"."payment_financial_reconciliations"
    ADD CONSTRAINT "uk_payment_financial_reconciliation" UNIQUE ("tenant_id", "payment_intent_id");



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "uk_tenant_account_code" UNIQUE ("tenant_id", "account_code");



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "uk_tenant_idempotency" UNIQUE ("tenant_id", "idempotency_key");



ALTER TABLE ONLY "public"."tenant_payment_methods"
    ADD CONSTRAINT "uk_tenant_method_provider" UNIQUE ("tenant_id", "payment_method", "provider");



ALTER TABLE ONLY "public"."tenant_modules"
    ADD CONSTRAINT "uk_tenant_module" UNIQUE ("tenant_id", "module_id");



ALTER TABLE ONLY "public"."user_memberships"
    ADD CONSTRAINT "uk_user_biz_branch" UNIQUE ("user_id", "business_id", "branch_id");



ALTER TABLE ONLY "public"."wallet_accounts"
    ADD CONSTRAINT "uk_wallet_owner" UNIQUE ("tenant_id", "owner_type", "owner_id");



ALTER TABLE ONLY "public"."stock_balances"
    ADD CONSTRAINT "uk_wh_product" UNIQUE ("warehouse_id", "product_id");



ALTER TABLE ONLY "public"."used_item_ads"
    ADD CONSTRAINT "used_item_ads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."used_item_category_fees"
    ADD CONSTRAINT "used_item_category_fees_pkey" PRIMARY KEY ("category");



ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_memberships"
    ADD CONSTRAINT "user_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profile_media"
    ADD CONSTRAINT "user_profile_media_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."wallet_accounts"
    ADD CONSTRAINT "wallet_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "account_registration_requests_pending_role_uidx" ON "public"."account_registration_requests" USING "btree" ("user_id", "requested_role") WHERE (("status")::"text" = 'PENDING'::"text");



CREATE INDEX "branches_business_id_idx" ON "public"."branches" USING "btree" ("business_id");



CREATE INDEX "businesses_organization_id_idx" ON "public"."businesses" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "businesses_tenant_code_uidx" ON "public"."businesses" USING "btree" ("tenant_id", "code");



CREATE INDEX "businesses_tenant_id_idx" ON "public"."businesses" USING "btree" ("tenant_id");



CREATE INDEX "businesses_visual_identity_gin_idx" ON "public"."businesses" USING "gin" ("settings");



CREATE INDEX "departments_business_id_idx" ON "public"."departments" USING "btree" ("business_id");



CREATE INDEX "digital_page_orders_business_idx" ON "public"."digital_page_orders" USING "btree" ("target_business_id", "created_at" DESC);



CREATE UNIQUE INDEX "digital_page_orders_provider_intent_uidx" ON "public"."digital_page_orders" USING "btree" ("provider", "provider_intent_id") WHERE ("provider_intent_id" IS NOT NULL);



CREATE UNIQUE INDEX "digital_page_orders_provider_order_uidx" ON "public"."digital_page_orders" USING "btree" ("provider", "provider_order_id") WHERE ("provider_order_id" IS NOT NULL);



CREATE INDEX "digital_page_orders_user_idx" ON "public"."digital_page_orders" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "digital_page_products_active_idx" ON "public"."digital_page_products" USING "btree" ("page_type", "active");



CREATE INDEX "digital_page_sections_order_idx" ON "public"."digital_page_sections" USING "btree" ("page_id", "sort_order", "id");



CREATE INDEX "digital_pages_business_idx" ON "public"."digital_pages" USING "btree" ("business_id");



CREATE UNIQUE INDEX "digital_pages_order_uidx" ON "public"."digital_pages" USING "btree" ("digital_page_order_id") WHERE ("digital_page_order_id" IS NOT NULL);



CREATE INDEX "digital_pages_provider_idx" ON "public"."digital_pages" USING "btree" ("provider_profile_id");



CREATE INDEX "digital_pages_public_idx" ON "public"."digital_pages" USING "btree" ("status", "page_type");



CREATE INDEX "fashion_orders_scope_idx" ON "public"."fashion_orders" USING "btree" ("tenant_id", "business_id", "branch_id");



CREATE INDEX "fashion_products_scope_idx" ON "public"."fashion_products" USING "btree" ("tenant_id", "business_id", "branch_id");



CREATE INDEX "idx_account_registration_requests_reviewed_by" ON "public"."account_registration_requests" USING "btree" ("reviewed_by");



CREATE INDEX "idx_account_registration_requests_user_status" ON "public"."account_registration_requests" USING "btree" ("user_id", "status");



CREATE INDEX "idx_ad_target_ad" ON "public"."advertisement_target_locations" USING "btree" ("advertisement_id");



CREATE INDEX "idx_ad_target_geo" ON "public"."advertisement_target_locations" USING "btree" ("geo_area_id");



CREATE INDEX "idx_advertisements_ad_space_id" ON "public"."advertisements" USING "btree" ("ad_space_id");



CREATE INDEX "idx_advertisements_tenant_id" ON "public"."advertisements" USING "btree" ("tenant_id");



CREATE INDEX "idx_approval_actions_request_id" ON "public"."approval_actions" USING "btree" ("approval_request_id");



CREATE INDEX "idx_approval_requests_branch_id" ON "public"."approval_requests" USING "btree" ("branch_id");



CREATE INDEX "idx_approval_requests_tenant_id" ON "public"."approval_requests" USING "btree" ("tenant_id");



CREATE INDEX "idx_audit_logs_actor" ON "public"."audit_logs" USING "btree" ("actor_user_id");



CREATE INDEX "idx_audit_logs_branch_id" ON "public"."audit_logs" USING "btree" ("branch_id");



CREATE INDEX "idx_audit_logs_organization_id" ON "public"."audit_logs" USING "btree" ("organization_id");



CREATE INDEX "idx_audit_logs_tenant" ON "public"."audit_logs" USING "btree" ("tenant_id");



CREATE INDEX "idx_branches_organization_id" ON "public"."branches" USING "btree" ("organization_id");



CREATE INDEX "idx_branches_tenant_id" ON "public"."branches" USING "btree" ("tenant_id");



CREATE INDEX "idx_business_categories_sector_id" ON "public"."business_categories" USING "btree" ("sector_id");



CREATE INDEX "idx_business_modules_business_id" ON "public"."business_modules" USING "btree" ("business_id");



CREATE INDEX "idx_business_referral_events_business" ON "public"."business_referral_events" USING "btree" ("business_id", "created_at" DESC);



CREATE INDEX "idx_business_referral_events_code" ON "public"."business_referral_events" USING "btree" ("referral_code", "created_at" DESC);



CREATE INDEX "idx_business_sectors_code" ON "public"."business_sectors" USING "btree" ("code");



CREATE INDEX "idx_catalog_business_settings_tenant_id" ON "public"."catalog_business_settings" USING "btree" ("tenant_id");



CREATE INDEX "idx_catalog_item_options_item" ON "public"."catalog_item_options" USING "btree" ("catalog_item_id", "status");



CREATE INDEX "idx_catalog_item_options_tenant_id" ON "public"."catalog_item_options" USING "btree" ("tenant_id");



CREATE INDEX "idx_catalog_item_prices_branch_id" ON "public"."catalog_item_prices" USING "btree" ("branch_id");



CREATE INDEX "idx_catalog_item_prices_lookup" ON "public"."catalog_item_prices" USING "btree" ("catalog_item_id", "branch_id", "status", "effective_from" DESC);



CREATE INDEX "idx_catalog_item_prices_tenant_id" ON "public"."catalog_item_prices" USING "btree" ("tenant_id");



CREATE INDEX "idx_catalog_items_branch" ON "public"."catalog_items" USING "btree" ("tenant_id", "business_id", "branch_id", "status");



CREATE INDEX "idx_catalog_items_branch_id" ON "public"."catalog_items" USING "btree" ("branch_id");



CREATE INDEX "idx_catalog_items_business_status" ON "public"."catalog_items" USING "btree" ("tenant_id", "business_id", "status");



CREATE INDEX "idx_chart_of_accounts_tenant_id" ON "public"."chart_of_accounts" USING "btree" ("tenant_id");



CREATE INDEX "idx_coa_tenant_type" ON "public"."chart_of_accounts" USING "btree" ("tenant_id", "account_type");



CREATE INDEX "idx_comm_biz_order" ON "public"."commission_transactions" USING "btree" ("business_id", "order_id");



CREATE INDEX "idx_commission_rules_tenant_id" ON "public"."commission_rules" USING "btree" ("tenant_id");



CREATE INDEX "idx_commission_transactions_order_id" ON "public"."commission_transactions" USING "btree" ("order_id");



CREATE INDEX "idx_commission_transactions_rule_id" ON "public"."commission_transactions" USING "btree" ("rule_id");



CREATE INDEX "idx_commission_transactions_tenant_id" ON "public"."commission_transactions" USING "btree" ("tenant_id");



CREATE INDEX "idx_consent_audit_user_time" ON "public"."consent_audit_log" USING "btree" ("user_id", "event_at" DESC);



CREATE INDEX "idx_credit_accounts_tenant_status" ON "public"."credit_accounts" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_credit_periods_due" ON "public"."credit_periods" USING "btree" ("tenant_id", "due_date", "status");



CREATE INDEX "idx_credit_policies_tenant" ON "public"."credit_policies" USING "btree" ("tenant_id");



CREATE INDEX "idx_departments_tenant_id" ON "public"."departments" USING "btree" ("tenant_id");



CREATE INDEX "idx_digital_page_orders_product_id" ON "public"."digital_page_orders" USING "btree" ("product_id");



CREATE INDEX "idx_digital_page_payment_events_order_id" ON "public"."digital_page_payment_events" USING "btree" ("digital_page_order_id");



CREATE INDEX "idx_erp_purchase_orders_scope" ON "public"."erp_purchase_orders" USING "btree" ("tenant_id", "business_id", "created_at" DESC);



CREATE INDEX "idx_erp_purchase_receipts_scope" ON "public"."erp_purchase_receipts" USING "btree" ("tenant_id", "business_id", "created_at" DESC);



CREATE INDEX "idx_erp_stock_transfers_scope" ON "public"."erp_stock_transfers" USING "btree" ("tenant_id", "business_id", "created_at" DESC);



CREATE INDEX "idx_financial_obligations_order" ON "public"."financial_obligations" USING "btree" ("tenant_id", "order_id");



CREATE INDEX "idx_financial_obligations_order_id" ON "public"."financial_obligations" USING "btree" ("order_id");



CREATE INDEX "idx_financial_obligations_tenant_status" ON "public"."financial_obligations" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_general_ledger_journal_entry_id" ON "public"."general_ledger" USING "btree" ("journal_entry_id");



CREATE INDEX "idx_general_ledger_journal_line_id" ON "public"."general_ledger" USING "btree" ("journal_line_id");



CREATE INDEX "idx_general_ledger_tenant_id" ON "public"."general_ledger" USING "btree" ("tenant_id");



CREATE INDEX "idx_geo_areas_coords" ON "public"."platform_geo_areas" USING "btree" ("latitude", "longitude");



CREATE INDEX "idx_geo_areas_lookup" ON "public"."platform_geo_areas" USING "btree" ("country_code", "level", "code", "status");



CREATE INDEX "idx_geo_areas_parent" ON "public"."platform_geo_areas" USING "btree" ("parent_id");



CREATE INDEX "idx_gl_account_date" ON "public"."general_ledger" USING "btree" ("account_id", "entry_date");



CREATE INDEX "idx_gl_tenant_biz" ON "public"."general_ledger" USING "btree" ("tenant_id", "business_id");



CREATE INDEX "idx_global_ads_active_space" ON "public"."platform_global_advertisements" USING "btree" ("status", "approval_status", "ad_space_id", "start_at", "end_at");



CREATE INDEX "idx_indrive_bids_provider" ON "public"."indrive_bids" USING "btree" ("provider_user_id");



CREATE INDEX "idx_indrive_bids_request" ON "public"."indrive_bids" USING "btree" ("request_id");



CREATE INDEX "idx_indrive_bids_status_request" ON "public"."indrive_bids" USING "btree" ("request_id", "status");



CREATE INDEX "idx_indrive_requests_accepted_bid_id" ON "public"."indrive_requests" USING "btree" ("accepted_bid_id");



CREATE INDEX "idx_indrive_requests_domain_status" ON "public"."indrive_requests" USING "btree" ("domain_type", "status");



CREATE INDEX "idx_indrive_requests_owner" ON "public"."indrive_requests" USING "btree" ("owner_user_id");



CREATE INDEX "idx_inventory_transactions_branch_id" ON "public"."inventory_transactions" USING "btree" ("branch_id");



CREATE INDEX "idx_inventory_transactions_tenant_id" ON "public"."inventory_transactions" USING "btree" ("tenant_id");



CREATE INDEX "idx_inventory_transactions_warehouse_id" ON "public"."inventory_transactions" USING "btree" ("warehouse_id");



CREATE INDEX "idx_je_ref" ON "public"."journal_entries" USING "btree" ("reference_type", "reference_id");



CREATE INDEX "idx_je_tenant_status" ON "public"."journal_entries" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_jel_account" ON "public"."journal_entry_lines" USING "btree" ("account_id");



CREATE INDEX "idx_jel_entry" ON "public"."journal_entry_lines" USING "btree" ("journal_entry_id");



CREATE INDEX "idx_job_applications_applicant" ON "public"."job_applications" USING "btree" ("applicant_user_id", "created_at" DESC);



CREATE INDEX "idx_job_applications_job" ON "public"."job_applications" USING "btree" ("job_id", "created_at" DESC);



CREATE INDEX "idx_jobs_active_created_at" ON "public"."jobs" USING "btree" ("is_active", "created_at" DESC);



CREATE INDEX "idx_jobs_business_id" ON "public"."jobs" USING "btree" ("business_id");



CREATE INDEX "idx_jobs_owner" ON "public"."jobs" USING "btree" ("owner_user_id");



CREATE INDEX "idx_legal_documents_type_status" ON "public"."legal_documents" USING "btree" ("document_type", "status");



CREATE INDEX "idx_legal_requirements_action" ON "public"."legal_requirements" USING "btree" ("action_key", "enabled");



CREATE INDEX "idx_legal_versions_document" ON "public"."legal_document_versions" USING "btree" ("document_id", "version_number" DESC);



CREATE INDEX "idx_mantigo_bids_ride_status_created" ON "public"."mantigo_bids" USING "btree" ("ride_id", "status", "created_at" DESC);



CREATE INDEX "idx_mantigo_ledger_captain_settlement" ON "public"."mantigo_financial_ledger" USING "btree" ("captain_id", "settlement_status", "updated_at" DESC);



CREATE INDEX "idx_mantigo_rides_customer_status_created" ON "public"."mantigo_rides" USING "btree" ("customer_id", "status", "created_at" DESC);



CREATE INDEX "idx_mkt_leads_status" ON "public"."marketing_leads" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_mkt_project_participants_provider" ON "public"."marketing_project_participants" USING "btree" ("provider_id");



CREATE INDEX "idx_mkt_projects_status" ON "public"."marketing_projects" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_mkt_provider_services_service" ON "public"."marketing_provider_services" USING "btree" ("service_id");



CREATE INDEX "idx_mkt_provider_status_kind" ON "public"."marketing_provider_profiles" USING "btree" ("status", "provider_kind");



CREATE INDEX "idx_order_status_history_tenant_id" ON "public"."order_status_history" USING "btree" ("tenant_id");



CREATE INDEX "idx_orders_assigned_partner_id" ON "public"."orders" USING "btree" ("assigned_partner_id");



CREATE INDEX "idx_orders_branch" ON "public"."orders" USING "btree" ("branch_id");



CREATE INDEX "idx_orders_business_id" ON "public"."orders" USING "btree" ("business_id");



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_orders_customer" ON "public"."orders" USING "btree" ("customer_id");



CREATE INDEX "idx_orders_organization_id" ON "public"."orders" USING "btree" ("organization_id");



CREATE INDEX "idx_orders_payment_intents_order_id" ON "public"."payment_intents" USING "btree" ("order_id");



CREATE INDEX "idx_orders_tenant_biz" ON "public"."orders" USING "btree" ("tenant_id", "business_id");



CREATE INDEX "idx_payment_events_payment_id" ON "public"."payment_events" USING "btree" ("payment_id");



CREATE INDEX "idx_payment_intents_order_pricing" ON "public"."payment_intents" USING "btree" ("order_id", "pricing_hash");



CREATE INDEX "idx_payment_provider_events_payment_intent_id" ON "public"."payment_provider_events" USING "btree" ("payment_intent_id");



CREATE INDEX "idx_payment_provider_events_tenant_id" ON "public"."payment_provider_events" USING "btree" ("tenant_id");



CREATE INDEX "idx_payout_destinations_owner" ON "public"."payout_destinations" USING "btree" ("tenant_id", "owner_type", "owner_id");



CREATE INDEX "idx_payout_destinations_tenant_id" ON "public"."payout_destinations" USING "btree" ("tenant_id");



CREATE INDEX "idx_pe_event_id" ON "public"."payment_events" USING "btree" ("event_id");



CREATE INDEX "idx_pfr_payment_intent" ON "public"."payment_financial_reconciliations" USING "btree" ("payment_intent_id");



CREATE INDEX "idx_pfr_tenant_status" ON "public"."payment_financial_reconciliations" USING "btree" ("tenant_id", "reconciliation_status", "created_at" DESC);



CREATE INDEX "idx_provider_onboarding_requests_organization_id" ON "public"."provider_onboarding_requests" USING "btree" ("organization_id");



CREATE INDEX "idx_provider_onboarding_requests_reviewed_by" ON "public"."provider_onboarding_requests" USING "btree" ("reviewed_by");



CREATE INDEX "idx_provider_onboarding_requests_tenant_id" ON "public"."provider_onboarding_requests" USING "btree" ("tenant_id");



CREATE INDEX "idx_provider_onboarding_status" ON "public"."provider_onboarding_requests" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_provider_onboarding_user_status" ON "public"."provider_onboarding_requests" USING "btree" ("user_id", "status", "created_at" DESC);



CREATE INDEX "idx_referral_events_code" ON "public"."referral_events" USING "btree" ("referral_code", "created_at" DESC);



CREATE INDEX "idx_referral_events_referrer" ON "public"."referral_events" USING "btree" ("referrer_user_id", "created_at" DESC);



CREATE INDEX "idx_refund_transactions_tenant_order" ON "public"."refund_transactions" USING "btree" ("tenant_id", "order_id");



CREATE INDEX "idx_settlement_attempts_obligation" ON "public"."settlement_attempts" USING "btree" ("obligation_id", "created_at" DESC);



CREATE INDEX "idx_settlement_transactions_reference" ON "public"."settlement_transactions" USING "btree" ("reference_id");



CREATE INDEX "idx_settlement_transactions_tenant_created" ON "public"."settlement_transactions" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_settlement_transactions_tenant_id" ON "public"."settlement_transactions" USING "btree" ("tenant_id");



CREATE INDEX "idx_stl_beneficiary" ON "public"."settlement_transactions" USING "btree" ("beneficiary_type", "beneficiary_id");



CREATE INDEX "idx_stock_balances_tenant_id" ON "public"."stock_balances" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_modules_tenant_id" ON "public"."tenant_modules" USING "btree" ("tenant_id");



CREATE INDEX "idx_ticket_messages_ticket_id" ON "public"."ticket_messages" USING "btree" ("ticket_id");



CREATE INDEX "idx_tpm_tenant_enabled" ON "public"."tenant_payment_methods" USING "btree" ("tenant_id", "is_enabled");



CREATE INDEX "idx_used_item_ads_active_created_at" ON "public"."used_item_ads" USING "btree" ("is_sold", "created_at" DESC);



CREATE INDEX "idx_used_item_ads_owner" ON "public"."used_item_ads" USING "btree" ("owner_user_id");



CREATE INDEX "idx_user_consents_user_doc" ON "public"."user_consents" USING "btree" ("user_id", "document_id", "document_version_id");



CREATE INDEX "idx_wallet_accounts_tenant_id" ON "public"."wallet_accounts" USING "btree" ("tenant_id");



CREATE INDEX "idx_wallet_owner" ON "public"."wallet_accounts" USING "btree" ("owner_type", "owner_id");



CREATE INDEX "idx_wallet_transactions_tenant_id" ON "public"."wallet_transactions" USING "btree" ("tenant_id");



CREATE INDEX "idx_warehouses_tenant_id" ON "public"."warehouses" USING "btree" ("tenant_id");



CREATE INDEX "idx_wt_idempotency" ON "public"."wallet_transactions" USING "btree" ("idempotency_key");



CREATE INDEX "idx_wt_wallet_created" ON "public"."wallet_transactions" USING "btree" ("wallet_id", "created_at");



CREATE UNIQUE INDEX "indrive_bids_request_provider_uq" ON "public"."indrive_bids" USING "btree" ("request_id", "provider_user_id");



CREATE UNIQUE INDEX "indrive_requests_owner_idempotency_uq" ON "public"."indrive_requests" USING "btree" ("owner_user_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "ix_business_subscriptions_business_status" ON "public"."business_subscriptions" USING "btree" ("business_id", "status");



CREATE INDEX "ix_subscription_payment_intents_business_status" ON "public"."subscription_payment_intents" USING "btree" ("business_id", "status");



CREATE UNIQUE INDEX "mantigo_bids_ride_captain_uq" ON "public"."mantigo_bids" USING "btree" ("ride_id", "captain_id");



CREATE INDEX "mantigo_captain_matching_idx" ON "public"."mantigo_captain_profiles" USING "btree" ("status", "verification_status", "availability_status", "vehicle_category", "last_seen_at" DESC);



CREATE INDEX "mantigo_financial_ledger_captain_idx" ON "public"."mantigo_financial_ledger" USING "btree" ("captain_id", "payment_status", "settlement_status");



CREATE INDEX "mantigo_financial_ledger_customer_idx" ON "public"."mantigo_financial_ledger" USING "btree" ("customer_id", "payment_status");



CREATE UNIQUE INDEX "mantigo_financial_provider_intent_uidx" ON "public"."mantigo_financial_ledger" USING "btree" ("provider", "provider_intent_id") WHERE ("provider_intent_id" IS NOT NULL);



CREATE UNIQUE INDEX "mantigo_rides_accepted_bid_uq" ON "public"."mantigo_rides" USING "btree" ("accepted_bid_id") WHERE ("accepted_bid_id" IS NOT NULL);



CREATE UNIQUE INDEX "mantigo_rides_customer_idempotency_uq" ON "public"."mantigo_rides" USING "btree" ("customer_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "mantigo_rides_customer_status_idx" ON "public"."mantigo_rides" USING "btree" ("customer_id", "status", "updated_at" DESC);



CREATE INDEX "mantigo_rides_open_matching_idx" ON "public"."mantigo_rides" USING "btree" ("status", "vehicle_category", "created_at" DESC) WHERE ("status" = ANY (ARRAY['OPEN'::"text", 'OPEN_FOR_BIDS'::"text"]));



CREATE INDEX "medical_appointments_business_idx" ON "public"."medical_appointments" USING "btree" ("tenant_id", "business_id", "date_time" DESC);



CREATE INDEX "medical_appointments_patient_idx" ON "public"."medical_appointments" USING "btree" ("patient_id", "date_time" DESC);



CREATE INDEX "notifications_tenant_created_idx" ON "public"."notifications" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "notifications_user_created_idx" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "organizations_tenant_id_idx" ON "public"."organizations" USING "btree" ("tenant_id");



CREATE INDEX "payment_events_tenant_id_idx" ON "public"."payment_events" USING "btree" ("tenant_id");



CREATE INDEX "payment_intents_tenant_id_idx" ON "public"."payment_intents" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "platform_feature_flags_unique_idx" ON "public"."platform_feature_flags" USING "btree" ("scope_type", COALESCE("scope_id", ''::character varying), COALESCE("sector_id", ''::character varying), COALESCE("tenant_id", ''::character varying), COALESCE(("business_id")::"text", ''::"text"), COALESCE("branch_id", ''::character varying), "module_code", COALESCE("feature_code", ''::character varying));



CREATE INDEX "push_subscriptions_enabled_idx" ON "public"."push_subscriptions" USING "btree" ("enabled") WHERE ("enabled" = true);



CREATE INDEX "push_subscriptions_user_id_idx" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX "restaurant_inventory_scope_idx" ON "public"."restaurant_inventory" USING "btree" ("tenant_id", "business_id", "branch_id");



CREATE INDEX "restaurant_menu_items_scope_idx" ON "public"."restaurant_menu_items" USING "btree" ("tenant_id", "business_id", "branch_id");



CREATE INDEX "restaurant_orders_scope_idx" ON "public"."restaurant_orders" USING "btree" ("tenant_id", "business_id", "branch_id");



CREATE INDEX "restaurant_tables_scope_idx" ON "public"."restaurant_tables" USING "btree" ("tenant_id", "business_id", "branch_id");



CREATE INDEX "smm_orders_status_idx" ON "public"."smm_orders" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "smm_orders_user_idx" ON "public"."smm_orders" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "smm_services_platform_idx" ON "public"."smm_services" USING "btree" ("platform", "active");



CREATE INDEX "support_tickets_requester_idx" ON "public"."support_tickets" USING "btree" ("requester_id", "updated_at" DESC);



CREATE INDEX "support_tickets_tenant_updated_idx" ON "public"."support_tickets" USING "btree" ("tenant_id", "updated_at" DESC);



CREATE INDEX "ticket_messages_ticket_created_idx" ON "public"."ticket_messages" USING "btree" ("ticket_id", "created_at");



CREATE UNIQUE INDEX "uq_business_subscriptions_idempotency" ON "public"."business_subscriptions" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE UNIQUE INDEX "uq_commission_transactions_order_id" ON "public"."commission_transactions" USING "btree" ("order_id");



CREATE UNIQUE INDEX "uq_financial_obligation_idempotent" ON "public"."financial_obligations" USING "btree" ("tenant_id", "obligation_type", "order_id", "beneficiary_id") WHERE ("order_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_medical_appointment_active_doctor_slot" ON "public"."medical_appointments" USING "btree" ("doctor_id", "date_time") WHERE (("status")::"text" <> ALL ((ARRAY['CANCELLED'::character varying, 'COMPLETED'::character varying])::"text"[]));



CREATE UNIQUE INDEX "uq_payment_intents_provider_order" ON "public"."payment_intents" USING "btree" ("provider", "provider_order_id") WHERE ("provider_order_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_payout_destination_active" ON "public"."payout_destinations" USING "btree" ("tenant_id", "owner_type", "owner_id", "payout_method") WHERE (("status")::"text" = 'ACTIVE'::"text");



CREATE UNIQUE INDEX "uq_subscription_payment_intents_idempotency" ON "public"."subscription_payment_intents" USING "btree" ("idempotency_key");



CREATE UNIQUE INDEX "uq_subscription_payment_intents_provider_intent" ON "public"."subscription_payment_intents" USING "btree" ("provider", "provider_intent_id") WHERE ("provider_intent_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_subscription_payment_intents_provider_order" ON "public"."subscription_payment_intents" USING "btree" ("provider", "provider_order_id") WHERE ("provider_order_id" IS NOT NULL);



CREATE INDEX "user_memberships_business_id_idx" ON "public"."user_memberships" USING "btree" ("business_id");



CREATE UNIQUE INDEX "ux_catalog_items_business_legacy_ref" ON "public"."catalog_items" USING "btree" ("business_id", "legacy_ref") WHERE ("legacy_ref" IS NOT NULL);



CREATE UNIQUE INDEX "ux_orders_tenant_client_idempotency" ON "public"."orders" USING "btree" ("tenant_id", "client_idempotency_key") WHERE ("client_idempotency_key" IS NOT NULL);



CREATE OR REPLACE TRIGGER "mantigo_bid_rate_limit_guard" BEFORE INSERT ON "public"."mantigo_bids" FOR EACH ROW EXECUTE FUNCTION "public"."mantigo_guard_bid_rate_limit"();



CREATE OR REPLACE TRIGGER "mantigo_ride_acceptance_integrity_trg" BEFORE INSERT OR UPDATE OF "accepted_bid_id", "status" ON "public"."mantigo_rides" FOR EACH ROW EXECUTE FUNCTION "public"."validate_mantigo_ride_acceptance_integrity"();



CREATE OR REPLACE TRIGGER "mantigo_ride_rate_limit_guard" BEFORE INSERT ON "public"."mantigo_rides" FOR EACH ROW EXECUTE FUNCTION "public"."mantigo_guard_ride_rate_limit"();



CREATE OR REPLACE TRIGGER "mnty_notifications_push_after_insert" AFTER INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."mnty_push_notification_hook"();



CREATE OR REPLACE TRIGGER "mnty_order_created_notifications" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "private"."mnty_notify_order_created"();



CREATE OR REPLACE TRIGGER "mnty_order_status_notifications" AFTER INSERT ON "public"."order_status_history" FOR EACH ROW EXECUTE FUNCTION "private"."mnty_notify_order_status_changed"();



CREATE OR REPLACE TRIGGER "mnty_order_status_notifications" AFTER UPDATE OF "status" ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "private"."mnty_notify_order_status"();



CREATE OR REPLACE TRIGGER "trg_businesses_updated_at" BEFORE UPDATE ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_consent_audit_immutable" BEFORE DELETE OR UPDATE ON "public"."consent_audit_log" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_legal_mutation"();



CREATE OR REPLACE TRIGGER "trg_digital_page_sections_touch" BEFORE UPDATE ON "public"."digital_page_sections" FOR EACH ROW EXECUTE FUNCTION "public"."touch_digital_page_section"();



CREATE OR REPLACE TRIGGER "trg_digital_pages_touch" BEFORE UPDATE ON "public"."digital_pages" FOR EACH ROW EXECUTE FUNCTION "public"."touch_digital_page_version"();



CREATE OR REPLACE TRIGGER "trg_indrive_bids_server_fields" BEFORE UPDATE ON "public"."indrive_bids" FOR EACH ROW EXECUTE FUNCTION "public"."guard_indrive_server_fields"();



CREATE OR REPLACE TRIGGER "trg_indrive_requests_server_fields" BEFORE UPDATE ON "public"."indrive_requests" FOR EACH ROW EXECUTE FUNCTION "public"."guard_indrive_server_fields"();



CREATE OR REPLACE TRIGGER "trg_journal_entry_immutability" BEFORE DELETE OR UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enforce_journal_entry_immutability"();



CREATE OR REPLACE TRIGGER "trg_journal_line_immutability" BEFORE INSERT OR DELETE OR UPDATE ON "public"."journal_entry_lines" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enforce_journal_line_immutability"();



CREATE OR REPLACE TRIGGER "trg_legal_business_activation" BEFORE INSERT OR UPDATE OF "status" ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."legal_gate_business_activation"();



CREATE OR REPLACE TRIGGER "trg_legal_commission_insert" BEFORE INSERT ON "public"."commission_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."legal_gate_commission_insert"();



CREATE OR REPLACE TRIGGER "trg_legal_documents_audit" AFTER INSERT OR UPDATE ON "public"."legal_documents" FOR EACH ROW EXECUTE FUNCTION "public"."legal_audit_bridge"();



CREATE OR REPLACE TRIGGER "trg_legal_employee_activation" BEFORE UPDATE OF "status" ON "public"."user_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."legal_gate_employee_activation"();



CREATE OR REPLACE TRIGGER "trg_legal_order_insert" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."legal_gate_order_insert"();



CREATE OR REPLACE TRIGGER "trg_legal_referral_insert" BEFORE INSERT ON "public"."referral_events" FOR EACH ROW EXECUTE FUNCTION "public"."legal_gate_referral_insert"();



CREATE OR REPLACE TRIGGER "trg_legal_version_immutable" BEFORE UPDATE ON "public"."legal_document_versions" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_published_legal_version_mutation"();



CREATE OR REPLACE TRIGGER "trg_legal_versions_audit" AFTER INSERT OR UPDATE ON "public"."legal_document_versions" FOR EACH ROW EXECUTE FUNCTION "public"."legal_audit_bridge"();



CREATE OR REPLACE TRIGGER "trg_orders_financial_lock" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_order_financial_mutation_after_payment"();



CREATE OR REPLACE TRIGGER "trg_post_journal_to_gl" AFTER INSERT OR UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."trg_post_journal_to_general_ledger"();



CREATE OR REPLACE TRIGGER "trg_support_ticket_security_fields" BEFORE UPDATE ON "public"."support_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_support_ticket_security_field_changes"();



CREATE OR REPLACE TRIGGER "trg_user_consents_immutable" BEFORE DELETE OR UPDATE ON "public"."user_consents" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_legal_mutation"();



CREATE OR REPLACE TRIGGER "trg_validate_journal_balance" BEFORE INSERT OR UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."trg_validate_journal_entry_balance"();



CREATE OR REPLACE TRIGGER "trg_wallet_balance_integrity" BEFORE INSERT ON "public"."wallet_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enforce_wallet_balance_integrity"();



ALTER TABLE ONLY "private"."platform_admins"
    ADD CONSTRAINT "platform_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."account_registration_requests"
    ADD CONSTRAINT "account_registration_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."account_registration_requests"
    ADD CONSTRAINT "account_registration_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."advertisement_target_locations"
    ADD CONSTRAINT "advertisement_target_locations_advertisement_id_fkey" FOREIGN KEY ("advertisement_id") REFERENCES "public"."advertisements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."advertisement_target_locations"
    ADD CONSTRAINT "advertisement_target_locations_geo_area_id_fkey" FOREIGN KEY ("geo_area_id") REFERENCES "public"."platform_geo_areas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."advertisements"
    ADD CONSTRAINT "advertisements_ad_space_id_fkey" FOREIGN KEY ("ad_space_id") REFERENCES "public"."ad_spaces"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."advertisements"
    ADD CONSTRAINT "advertisements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."agreement_participants"
    ADD CONSTRAINT "agreement_participants_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."agreement_participants"
    ADD CONSTRAINT "agreement_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "public"."legal_document_versions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."approval_actions"
    ADD CONSTRAINT "approval_actions_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."business_categories"
    ADD CONSTRAINT "business_categories_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "public"."business_sectors"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."business_modules"
    ADD CONSTRAINT "business_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_referral_codes"
    ADD CONSTRAINT "business_referral_codes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_referral_events"
    ADD CONSTRAINT "business_referral_events_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."business_referral_events"
    ADD CONSTRAINT "business_referral_events_referral_code_id_fkey" FOREIGN KEY ("referral_code_id") REFERENCES "public"."business_referral_codes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."business_referral_events"
    ADD CONSTRAINT "business_referral_events_visitor_user_id_fkey" FOREIGN KEY ("visitor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."catalog_business_settings"
    ADD CONSTRAINT "catalog_business_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catalog_business_settings"
    ADD CONSTRAINT "catalog_business_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catalog_item_options"
    ADD CONSTRAINT "catalog_item_options_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catalog_item_options"
    ADD CONSTRAINT "catalog_item_options_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catalog_item_prices"
    ADD CONSTRAINT "catalog_item_prices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catalog_item_prices"
    ADD CONSTRAINT "catalog_item_prices_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catalog_item_prices"
    ADD CONSTRAINT "catalog_item_prices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."commission_rules"
    ADD CONSTRAINT "commission_rules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."commission_rules"
    ADD CONSTRAINT "commission_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."commission_transactions"
    ADD CONSTRAINT "commission_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."commission_transactions"
    ADD CONSTRAINT "commission_transactions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."commission_rules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commission_transactions"
    ADD CONSTRAINT "commission_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."consent_audit_log"
    ADD CONSTRAINT "consent_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."consent_audit_log"
    ADD CONSTRAINT "consent_audit_log_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."consent_audit_log"
    ADD CONSTRAINT "consent_audit_log_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "public"."user_consents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."consent_audit_log"
    ADD CONSTRAINT "consent_audit_log_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."consent_audit_log"
    ADD CONSTRAINT "consent_audit_log_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "public"."legal_document_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."consent_audit_log"
    ADD CONSTRAINT "consent_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_accounts"
    ADD CONSTRAINT "credit_accounts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_accounts"
    ADD CONSTRAINT "credit_accounts_credit_policy_id_fkey" FOREIGN KEY ("credit_policy_id") REFERENCES "public"."credit_policies"("id");



ALTER TABLE ONLY "public"."credit_accounts"
    ADD CONSTRAINT "credit_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_periods"
    ADD CONSTRAINT "credit_periods_credit_account_id_fkey" FOREIGN KEY ("credit_account_id") REFERENCES "public"."credit_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_periods"
    ADD CONSTRAINT "credit_periods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_policies"
    ADD CONSTRAINT "credit_policies_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_policies"
    ADD CONSTRAINT "credit_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."digital_page_orders"
    ADD CONSTRAINT "digital_page_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."digital_page_products"("id");



ALTER TABLE ONLY "public"."digital_page_orders"
    ADD CONSTRAINT "digital_page_orders_target_business_id_fkey" FOREIGN KEY ("target_business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."digital_page_payment_events"
    ADD CONSTRAINT "digital_page_payment_events_digital_page_order_id_fkey" FOREIGN KEY ("digital_page_order_id") REFERENCES "public"."digital_page_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."digital_page_sections"
    ADD CONSTRAINT "digital_page_sections_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."digital_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."digital_pages"
    ADD CONSTRAINT "digital_pages_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."digital_pages"
    ADD CONSTRAINT "digital_pages_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."digital_pages"
    ADD CONSTRAINT "digital_pages_digital_page_order_id_fkey" FOREIGN KEY ("digital_page_order_id") REFERENCES "public"."digital_page_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."digital_pages"
    ADD CONSTRAINT "digital_pages_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."marketing_provider_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."digital_pages"
    ADD CONSTRAINT "digital_pages_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."education_requests"
    ADD CONSTRAINT "education_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."erp_purchase_orders"
    ADD CONSTRAINT "erp_purchase_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."erp_purchase_orders"
    ADD CONSTRAINT "erp_purchase_orders_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."erp_purchase_orders"
    ADD CONSTRAINT "erp_purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."erp_purchase_orders"
    ADD CONSTRAINT "erp_purchase_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."erp_purchase_receipts"
    ADD CONSTRAINT "erp_purchase_receipts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."erp_purchase_receipts"
    ADD CONSTRAINT "erp_purchase_receipts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."erp_purchase_receipts"
    ADD CONSTRAINT "erp_purchase_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."erp_purchase_receipts"
    ADD CONSTRAINT "erp_purchase_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."erp_stock_transfers"
    ADD CONSTRAINT "erp_stock_transfers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."erp_stock_transfers"
    ADD CONSTRAINT "erp_stock_transfers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."erp_stock_transfers"
    ADD CONSTRAINT "erp_stock_transfers_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."erp_stock_transfers"
    ADD CONSTRAINT "erp_stock_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."erp_stock_transfers"
    ADD CONSTRAINT "erp_stock_transfers_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."fashion_orders"
    ADD CONSTRAINT "fashion_orders_branch_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."fashion_orders"
    ADD CONSTRAINT "fashion_orders_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."fashion_orders"
    ADD CONSTRAINT "fashion_orders_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fashion_orders"
    ADD CONSTRAINT "fashion_orders_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."fashion_products"
    ADD CONSTRAINT "fashion_products_branch_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."fashion_products"
    ADD CONSTRAINT "fashion_products_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."fashion_products"
    ADD CONSTRAINT "fashion_products_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fashion_products"
    ADD CONSTRAINT "fashion_products_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."fashion_tailor_services"
    ADD CONSTRAINT "fashion_tailor_services_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_obligations"
    ADD CONSTRAINT "financial_obligations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."general_ledger"
    ADD CONSTRAINT "general_ledger_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."general_ledger"
    ADD CONSTRAINT "general_ledger_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."general_ledger"
    ADD CONSTRAINT "general_ledger_journal_line_id_fkey" FOREIGN KEY ("journal_line_id") REFERENCES "public"."journal_entry_lines"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."general_ledger"
    ADD CONSTRAINT "general_ledger_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."indrive_bids"
    ADD CONSTRAINT "indrive_bids_provider_user_id_fkey" FOREIGN KEY ("provider_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."indrive_bids"
    ADD CONSTRAINT "indrive_bids_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."indrive_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."indrive_requests"
    ADD CONSTRAINT "indrive_requests_accepted_bid_fk" FOREIGN KEY ("accepted_bid_id") REFERENCES "public"."indrive_bids"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."indrive_requests"
    ADD CONSTRAINT "indrive_requests_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."journal_entry_lines"
    ADD CONSTRAINT "journal_entry_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."journal_entry_lines"
    ADD CONSTRAINT "journal_entry_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."legal_document_versions"
    ADD CONSTRAINT "legal_document_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."legal_document_versions"
    ADD CONSTRAINT "legal_document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."legal_documents"
    ADD CONSTRAINT "legal_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."legal_documents"
    ADD CONSTRAINT "legal_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."legal_documents"
    ADD CONSTRAINT "legal_documents_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mantigo_bids"
    ADD CONSTRAINT "mantigo_bids_captain_id_fkey" FOREIGN KEY ("captain_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mantigo_bids"
    ADD CONSTRAINT "mantigo_bids_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "public"."mantigo_rides"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mantigo_captain_profiles"
    ADD CONSTRAINT "mantigo_captain_profiles_captain_id_fkey" FOREIGN KEY ("captain_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mantigo_financial_ledger"
    ADD CONSTRAINT "mantigo_financial_ledger_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "public"."mantigo_rides"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."mantigo_ride_ratings"
    ADD CONSTRAINT "mantigo_ride_ratings_captain_id_fkey" FOREIGN KEY ("captain_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mantigo_ride_ratings"
    ADD CONSTRAINT "mantigo_ride_ratings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mantigo_ride_ratings"
    ADD CONSTRAINT "mantigo_ride_ratings_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "public"."mantigo_rides"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mantigo_rides"
    ADD CONSTRAINT "mantigo_rides_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_commission_rules"
    ADD CONSTRAINT "marketing_commission_rules_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."marketing_services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_leads"
    ADD CONSTRAINT "marketing_leads_assigned_provider_id_fkey" FOREIGN KEY ("assigned_provider_id") REFERENCES "public"."marketing_provider_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_leads"
    ADD CONSTRAINT "marketing_leads_requester_business_id_fkey" FOREIGN KEY ("requester_business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_leads"
    ADD CONSTRAINT "marketing_leads_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_project_participants"
    ADD CONSTRAINT "marketing_project_participants_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."marketing_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_project_participants"
    ADD CONSTRAINT "marketing_project_participants_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."marketing_provider_profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."marketing_projects"
    ADD CONSTRAINT "marketing_projects_client_business_id_fkey" FOREIGN KEY ("client_business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_projects"
    ADD CONSTRAINT "marketing_projects_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."marketing_leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_provider_profiles"
    ADD CONSTRAINT "marketing_provider_profiles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_provider_profiles"
    ADD CONSTRAINT "marketing_provider_profiles_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_provider_services"
    ADD CONSTRAINT "marketing_provider_services_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."marketing_provider_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_provider_services"
    ADD CONSTRAINT "marketing_provider_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."marketing_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_provider_subscriptions"
    ADD CONSTRAINT "marketing_provider_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."marketing_plans"("id");



ALTER TABLE ONLY "public"."marketing_provider_subscriptions"
    ADD CONSTRAINT "marketing_provider_subscriptions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."marketing_provider_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matrimony_contact_unlocks"
    ADD CONSTRAINT "matrimony_contact_unlocks_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."matrimony_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matrimony_profiles"
    ADD CONSTRAINT "matrimony_profiles_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matrimony_requests"
    ADD CONSTRAINT "matrimony_requests_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matrimony_requests"
    ADD CONSTRAINT "matrimony_requests_to_profile_id_fkey" FOREIGN KEY ("to_profile_id") REFERENCES "public"."matrimony_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_assigned_partner_id_fkey" FOREIGN KEY ("assigned_partner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_provider_events"
    ADD CONSTRAINT "payment_provider_events_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_provider_events"
    ADD CONSTRAINT "payment_provider_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."platform_feature_flags"
    ADD CONSTRAINT "platform_feature_flags_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_feature_flags"
    ADD CONSTRAINT "platform_feature_flags_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_feature_flags"
    ADD CONSTRAINT "platform_feature_flags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_feature_flags"
    ADD CONSTRAINT "platform_feature_flags_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_geo_areas"
    ADD CONSTRAINT "platform_geo_areas_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."platform_geo_areas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."platform_global_advertisements"
    ADD CONSTRAINT "platform_global_advertisements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."provider_onboarding_requests"
    ADD CONSTRAINT "provider_onboarding_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."provider_onboarding_requests"
    ADD CONSTRAINT "provider_onboarding_requests_registration_request_id_fkey" FOREIGN KEY ("registration_request_id") REFERENCES "public"."account_registration_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_onboarding_requests"
    ADD CONSTRAINT "provider_onboarding_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."provider_onboarding_requests"
    ADD CONSTRAINT "provider_onboarding_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."provider_onboarding_requests"
    ADD CONSTRAINT "provider_onboarding_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referral_codes"
    ADD CONSTRAINT "referral_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referral_events"
    ADD CONSTRAINT "referral_events_referral_code_id_fkey" FOREIGN KEY ("referral_code_id") REFERENCES "public"."referral_codes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."referral_events"
    ADD CONSTRAINT "referral_events_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."referral_events"
    ADD CONSTRAINT "referral_events_referrer_user_id_fkey" FOREIGN KEY ("referrer_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refund_transactions"
    ADD CONSTRAINT "refund_transactions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."refund_transactions"
    ADD CONSTRAINT "refund_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."restaurant_inventory"
    ADD CONSTRAINT "restaurant_inventory_branch_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."restaurant_inventory"
    ADD CONSTRAINT "restaurant_inventory_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."restaurant_inventory"
    ADD CONSTRAINT "restaurant_inventory_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_inventory"
    ADD CONSTRAINT "restaurant_inventory_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."restaurant_menu_items"
    ADD CONSTRAINT "restaurant_menu_items_branch_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."restaurant_menu_items"
    ADD CONSTRAINT "restaurant_menu_items_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."restaurant_menu_items"
    ADD CONSTRAINT "restaurant_menu_items_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_menu_items"
    ADD CONSTRAINT "restaurant_menu_items_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."restaurant_orders"
    ADD CONSTRAINT "restaurant_orders_branch_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."restaurant_orders"
    ADD CONSTRAINT "restaurant_orders_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."restaurant_orders"
    ADD CONSTRAINT "restaurant_orders_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_orders"
    ADD CONSTRAINT "restaurant_orders_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."restaurant_tables"
    ADD CONSTRAINT "restaurant_tables_branch_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."restaurant_tables"
    ADD CONSTRAINT "restaurant_tables_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."restaurant_tables"
    ADD CONSTRAINT "restaurant_tables_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_tables"
    ADD CONSTRAINT "restaurant_tables_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."school_profiles"
    ADD CONSTRAINT "school_profiles_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settlement_attempts"
    ADD CONSTRAINT "settlement_attempts_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "public"."payout_destinations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."settlement_attempts"
    ADD CONSTRAINT "settlement_attempts_obligation_id_fkey" FOREIGN KEY ("obligation_id") REFERENCES "public"."financial_obligations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."settlement_attempts"
    ADD CONSTRAINT "settlement_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."settlement_transactions"
    ADD CONSTRAINT "settlement_transactions_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."settlement_transactions"
    ADD CONSTRAINT "settlement_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."smm_admins"
    ADD CONSTRAINT "smm_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."smm_order_events"
    ADD CONSTRAINT "smm_order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."smm_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."smm_orders"
    ADD CONSTRAINT "smm_orders_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."smm_services"("id");



ALTER TABLE ONLY "public"."smm_orders"
    ADD CONSTRAINT "smm_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."smm_provider_credentials"
    ADD CONSTRAINT "smm_provider_credentials_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."smm_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."smm_services"
    ADD CONSTRAINT "smm_services_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."smm_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."smm_wallet_transactions"
    ADD CONSTRAINT "smm_wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."smm_wallets"
    ADD CONSTRAINT "smm_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_balances"
    ADD CONSTRAINT "stock_balances_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."stock_balances"
    ADD CONSTRAINT "stock_balances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."stock_balances"
    ADD CONSTRAINT "stock_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."subscription_payment_intents"
    ADD CONSTRAINT "subscription_payment_intents_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."subscription_payment_intents"
    ADD CONSTRAINT "subscription_payment_intents_tier_code_fkey" FOREIGN KEY ("tier_code") REFERENCES "public"."subscription_tier_prices"("tier_code");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sync_logs"
    ADD CONSTRAINT "sync_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."teacher_profiles"
    ADD CONSTRAINT "teacher_profiles_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_modules"
    ADD CONSTRAINT "tenant_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_modules"
    ADD CONSTRAINT "tenant_modules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_payment_methods"
    ADD CONSTRAINT "tenant_payment_methods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_messages"
    ADD CONSTRAINT "ticket_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ticket_messages"
    ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."used_item_ads"
    ADD CONSTRAINT "used_item_ads_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."used_item_ads"
    ADD CONSTRAINT "used_item_ads_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."used_item_category_fees"
    ADD CONSTRAINT "used_item_category_fees_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "public"."legal_document_versions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_memberships"
    ADD CONSTRAINT "user_memberships_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_memberships"
    ADD CONSTRAINT "user_memberships_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."user_memberships"
    ADD CONSTRAINT "user_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_memberships"
    ADD CONSTRAINT "user_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_profile_media"
    ADD CONSTRAINT "user_profile_media_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_accounts"
    ADD CONSTRAINT "wallet_accounts_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_accounts"
    ADD CONSTRAINT "wallet_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallet_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



CREATE POLICY "mnty_deny_unexposed_platform_admins" ON "private"."platform_admins" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "private"."platform_admins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Authenticated can view active commission rules" ON "public"."marketing_commission_rules" FOR SELECT TO "authenticated" USING ((("status")::"text" = 'ACTIVE'::"text"));



CREATE POLICY "CRM managers view marketing leads" ON "public"."marketing_leads" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(COALESCE(("um"."role")::"text", ''::"text")) = ANY (ARRAY['SUPER_ADMIN'::"text", 'ADMIN'::"text", 'OWNER'::"text", 'MANAGER'::"text", 'BUSINESS_OWNER'::"text"]))))));



CREATE POLICY "CRM managers view marketing providers" ON "public"."marketing_provider_profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(COALESCE(("um"."role")::"text", ''::"text")) = ANY (ARRAY['SUPER_ADMIN'::"text", 'ADMIN'::"text", 'OWNER'::"text", 'MANAGER'::"text", 'BUSINESS_OWNER'::"text"]))))));



CREATE POLICY "Owners manage their marketing provider profile" ON "public"."marketing_provider_profiles" TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND ("auth"."uid"() = "owner_user_id"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND ("auth"."uid"() = "owner_user_id")));



CREATE POLICY "Owners view their subscriptions" ON "public"."marketing_provider_subscriptions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."marketing_provider_profiles" "p"
  WHERE (("p"."id" = "marketing_provider_subscriptions"."provider_id") AND ("p"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Project clients can view own marketing projects" ON "public"."marketing_projects" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "marketing_projects"."client_business_id") AND (EXISTS ( SELECT 1
           FROM "public"."user_memberships" "um"
          WHERE (("um"."business_id" = "b"."id") AND ("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."status")::"text" = 'ACTIVE'::"text"))))))));



CREATE POLICY "Providers view assigned projects" ON "public"."marketing_project_participants" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."marketing_provider_profiles" "p"
  WHERE (("p"."id" = "marketing_project_participants"."provider_id") AND ("p"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Public can view active marketing plans" ON "public"."marketing_plans" FOR SELECT TO "authenticated", "anon" USING ((("status")::"text" = 'ACTIVE'::"text"));



CREATE POLICY "Public can view active marketing providers" ON "public"."marketing_provider_profiles" FOR SELECT TO "authenticated", "anon" USING ((("status")::"text" = 'ACTIVE'::"text"));



CREATE POLICY "Public can view active marketing services" ON "public"."marketing_services" FOR SELECT TO "authenticated", "anon" USING ((("status")::"text" = 'ACTIVE'::"text"));



CREATE POLICY "Public can view active platform brand assets" ON "public"."platform_brand_assets" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can view active provider services" ON "public"."marketing_provider_services" FOR SELECT TO "authenticated", "anon" USING ((("status")::"text" = 'ACTIVE'::"text"));



CREATE POLICY "Public can view official showcase businesses" ON "public"."businesses" FOR SELECT TO "authenticated", "anon" USING (((("status")::"text" = 'ACTIVE'::"text") AND (COALESCE(("settings" ->> 'showcase'::"text"), 'false'::"text") = 'true'::"text")));



CREATE POLICY "Super admins manage platform brand assets" ON "public"."platform_brand_assets" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("m"."role")::"text") = 'SUPER_ADMIN'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("m"."role")::"text") = 'SUPER_ADMIN'::"text")))));



CREATE POLICY "Users create marketing leads" ON "public"."marketing_leads" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "requester_user_id"));



CREATE POLICY "Users view own marketing leads" ON "public"."marketing_leads" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "requester_user_id"));



ALTER TABLE "public"."account_registration_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "account_registration_requests_platform_review" ON "public"."account_registration_requests" FOR SELECT TO "authenticated" USING (((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['SUPER_ADMIN'::character varying, 'OWNER'::character varying, 'ADMIN'::character varying])::"text"[])))))));



CREATE POLICY "account_registration_requests_self_insert" ON "public"."account_registration_requests" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (("status")::"text" = 'PENDING'::"text") AND (COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")));



CREATE POLICY "account_registration_requests_self_select" ON "public"."account_registration_requests" FOR SELECT TO "authenticated" USING (((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text") AND (( SELECT "auth"."uid"() AS "uid") = "user_id")));



ALTER TABLE "public"."ad_spaces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ad_spaces_authenticated_read" ON "public"."ad_spaces" FOR SELECT TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



ALTER TABLE "public"."advertisement_target_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."advertisements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "advertisements_manager_delete" ON "public"."advertisements" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("advertisements"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))));



CREATE POLICY "advertisements_manager_insert" ON "public"."advertisements" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("advertisements"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))));



CREATE POLICY "advertisements_manager_update" ON "public"."advertisements" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("advertisements"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("advertisements"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))));



CREATE POLICY "advertisements_member_read" ON "public"."advertisements" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("advertisements"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text")))));



ALTER TABLE "public"."agreement_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agreement_participants_admin_write" ON "public"."agreement_participants" TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false) = false) AND "private"."legal_is_admin"(( SELECT "auth"."uid"() AS "uid")))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false) = false) AND "private"."legal_is_admin"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "agreement_participants_read" ON "public"."agreement_participants" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false) = false) AND ("private"."legal_is_admin"(( SELECT "auth"."uid"() AS "uid")) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."agreements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agreements_admin_write" ON "public"."agreements" TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false) = false) AND "private"."legal_is_admin"(( SELECT "auth"."uid"() AS "uid")))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false) = false) AND "private"."legal_is_admin"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "agreements_participant_read" ON "public"."agreements" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false) = false) AND ("private"."legal_is_admin"(( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."agreement_participants" "ap"
  WHERE (("ap"."agreement_id" = "ap"."id") AND ("ap"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



ALTER TABLE "public"."approval_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "approval_actions_member_insert" ON "public"."approval_actions" FOR INSERT TO "authenticated" WITH CHECK ((("acted_by" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM ("public"."approval_requests" "ar"
     JOIN "public"."user_memberships" "um" ON ((("um"."tenant_id")::"text" = ("ar"."tenant_id")::"text")))
  WHERE ((("ar"."id")::"text" = ("approval_actions"."approval_request_id")::"text") AND ("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."status")::"text" = 'ACTIVE'::"text"))))));



CREATE POLICY "approval_actions_member_read" ON "public"."approval_actions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."approval_requests" "ar"
     JOIN "public"."user_memberships" "um" ON ((("um"."tenant_id")::"text" = ("ar"."tenant_id")::"text")))
  WHERE ((("ar"."id")::"text" = ("approval_actions"."approval_request_id")::"text") AND ("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."status")::"text" = 'ACTIVE'::"text")))));



ALTER TABLE "public"."approval_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "approval_requests_manager_update" ON "public"."approval_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("approval_requests"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("approval_requests"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))));



CREATE POLICY "approval_requests_member_insert" ON "public"."approval_requests" FOR INSERT TO "authenticated" WITH CHECK ((("requested_by" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("approval_requests"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text"))))));



CREATE POLICY "approval_requests_scoped_read" ON "public"."approval_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("approval_requests"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("approval_requests"."requested_by" = "auth"."uid"()) OR (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'SUPER_ADMIN'::character varying, 'MANAGER'::character varying])::"text"[])))))));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_insert_tenant" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("audit_logs"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text")))));



CREATE POLICY "audit_logs_select_admin_scope" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("audit_logs"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("um"."role")::"text") = ANY (ARRAY['OWNER'::"text", 'BUSINESS_OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text"])))))));



CREATE POLICY "authenticated_sessions_only" ON "public"."ad_spaces" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."advertisements" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."approval_actions" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."approval_requests" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."audit_logs" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."bookings" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."branches" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."business_categories" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."business_modules" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."business_referral_codes" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."business_referral_events" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."business_sectors" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."catalog_business_settings" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."catalog_item_options" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."catalog_item_prices" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."catalog_items" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."chart_of_accounts" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."credit_accounts" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."credit_periods" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."credit_policies" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."departments" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."education_requests" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."fashion_orders" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."fashion_products" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."fashion_tailor_services" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."inventory_transactions" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."job_applications" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."jobs" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."mantigo_bids" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."mantigo_ride_ratings" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."mantigo_rides" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."marketing_commission_rules" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."marketing_plans" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."marketing_project_participants" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."marketing_provider_subscriptions" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."matrimony_contact_unlocks" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."matrimony_profiles" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."matrimony_requests" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."modules" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."order_status_history" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."organizations" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."payout_destinations" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."platform_brand_identity" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."platform_feature_flags" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."referral_codes" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."referral_events" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."restaurant_inventory" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."restaurant_menu_items" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."restaurant_orders" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."restaurant_tables" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."school_profiles" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."stock_balances" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."sync_logs" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."teacher_profiles" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."tenant_modules" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."tenant_payment_methods" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."tenants" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."used_item_ads" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."used_item_category_fees" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "authenticated_sessions_only" ON "public"."warehouses" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "branches_manager_write" ON "public"."branches" TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("branches"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text"]))))))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("branches"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text"])))))));



CREATE POLICY "branches_member_read" ON "public"."branches" FOR SELECT TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("branches"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text"))))));



CREATE POLICY "branches_super_admin_write" ON "public"."branches" TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("branches"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("um"."role")::"text") = 'SUPER_ADMIN'::"text") AND (COALESCE(("um"."permissions" ->> 'scope'::"text"), ''::"text") = 'PLATFORM'::"text") AND (COALESCE((("um"."permissions" ->> 'full_control'::"text"))::boolean, false) = true)))))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("branches"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("um"."role")::"text") = 'SUPER_ADMIN'::"text") AND (COALESCE(("um"."permissions" ->> 'scope'::"text"), ''::"text") = 'PLATFORM'::"text") AND (COALESCE((("um"."permissions" ->> 'full_control'::"text"))::boolean, false) = true))))));



CREATE POLICY "brand_identity_authenticated_read" ON "public"."platform_brand_identity" FOR SELECT TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "brand_identity_deny_anonymous" ON "public"."platform_brand_identity" TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



ALTER TABLE "public"."business_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_categories_authenticated_read" ON "public"."business_categories" FOR SELECT TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



ALTER TABLE "public"."business_modules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_modules_manager_delete" ON "public"."business_modules" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."businesses" "b"
     JOIN "public"."user_memberships" "um" ON ((("um"."tenant_id")::"text" = ("b"."tenant_id")::"text")))
  WHERE (("b"."id" = "business_modules"."business_id") AND ("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))));



CREATE POLICY "business_modules_manager_insert" ON "public"."business_modules" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."businesses" "b"
     JOIN "public"."user_memberships" "um" ON ((("um"."tenant_id")::"text" = ("b"."tenant_id")::"text")))
  WHERE (("b"."id" = "business_modules"."business_id") AND ("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))));



CREATE POLICY "business_modules_manager_update" ON "public"."business_modules" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."businesses" "b"
     JOIN "public"."user_memberships" "um" ON ((("um"."tenant_id")::"text" = ("b"."tenant_id")::"text")))
  WHERE (("b"."id" = "business_modules"."business_id") AND ("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."businesses" "b"
     JOIN "public"."user_memberships" "um" ON ((("um"."tenant_id")::"text" = ("b"."tenant_id")::"text")))
  WHERE (("b"."id" = "business_modules"."business_id") AND ("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))));



CREATE POLICY "business_modules_member_read" ON "public"."business_modules" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."businesses" "b"
     JOIN "public"."user_memberships" "um" ON ((("um"."tenant_id")::"text" = ("b"."tenant_id")::"text")))
  WHERE (("b"."id" = "business_modules"."business_id") AND ("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."status")::"text" = 'ACTIVE'::"text")))));



ALTER TABLE "public"."business_referral_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_referral_codes_member_read" ON "public"."business_referral_codes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."business_id" = "business_referral_codes"."business_id") AND (("m"."status")::"text" = 'ACTIVE'::"text")))));



ALTER TABLE "public"."business_referral_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_referral_events_member_read" ON "public"."business_referral_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."business_id" = "business_referral_events"."business_id") AND (("m"."status")::"text" = 'ACTIVE'::"text")))));



ALTER TABLE "public"."business_sectors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_sectors_authenticated_read" ON "public"."business_sectors" FOR SELECT TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



ALTER TABLE "public"."business_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_subscriptions_owner_select" ON "public"."business_subscriptions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND ("m"."business_id" = "business_subscriptions"."business_id")))));



ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "businesses_manager_delete" ON "public"."businesses" FOR DELETE TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("businesses"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text"])))))));



CREATE POLICY "businesses_manager_insert" ON "public"."businesses" FOR INSERT TO "authenticated" WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("businesses"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text"])))))));



CREATE POLICY "businesses_manager_update" ON "public"."businesses" FOR UPDATE TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("businesses"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text"]))))))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("businesses"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text"])))))));



CREATE POLICY "businesses_member_select" ON "public"."businesses" FOR SELECT TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("businesses"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text"))))));



ALTER TABLE "public"."catalog_business_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "catalog_business_settings_member_read" ON "public"."catalog_business_settings" FOR SELECT TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("catalog_business_settings"."tenant_id")::"text") AND ((COALESCE("m"."status", 'ACTIVE'::character varying))::"text" = 'ACTIVE'::"text"))))));



ALTER TABLE "public"."catalog_item_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "catalog_item_options_member_read" ON "public"."catalog_item_options" FOR SELECT TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("catalog_item_options"."tenant_id")::"text") AND ((COALESCE("m"."status", 'ACTIVE'::character varying))::"text" = 'ACTIVE'::"text"))))));



ALTER TABLE "public"."catalog_item_prices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "catalog_item_prices_member_read" ON "public"."catalog_item_prices" FOR SELECT TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("catalog_item_prices"."tenant_id")::"text") AND ((COALESCE("m"."status", 'ACTIVE'::character varying))::"text" = 'ACTIVE'::"text"))))));



ALTER TABLE "public"."catalog_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "catalog_items_member_read" ON "public"."catalog_items" FOR SELECT TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("catalog_items"."tenant_id")::"text") AND ((COALESCE("m"."status", 'ACTIVE'::character varying))::"text" = 'ACTIVE'::"text"))))));



ALTER TABLE "public"."chart_of_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chart_of_accounts_deny_anonymous" ON "public"."chart_of_accounts" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) IS FALSE)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) IS FALSE));



CREATE POLICY "chart_of_accounts_member_read" ON "public"."chart_of_accounts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("chart_of_accounts"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text")))));



ALTER TABLE "public"."commission_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "commission_rules_admin_delete" ON "public"."commission_rules" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("commission_rules"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))));



CREATE POLICY "commission_rules_admin_insert" ON "public"."commission_rules" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("commission_rules"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))));



CREATE POLICY "commission_rules_admin_update" ON "public"."commission_rules" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("commission_rules"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("commission_rules"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))));



CREATE POLICY "commission_rules_member_read" ON "public"."commission_rules" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("commission_rules"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text")))));



ALTER TABLE "public"."commission_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "commission_transactions_finance_read" ON "public"."commission_transactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("commission_transactions"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("um"."role")::"text") = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text", 'FINANCE'::"text", 'ACCOUNTANT'::"text", 'FINANCE_MANAGER'::"text"]))))));



ALTER TABLE "public"."consent_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "consent_audit_own_read" ON "public"."consent_audit_log" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false) = false) AND (("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "private"."legal_is_admin"(( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."credit_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_accounts_finance_read" ON "public"."credit_accounts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("credit_accounts"."tenant_id")::"text") AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."business_id" = "credit_accounts"."business_id") OR ("m"."business_id" IS NULL)) AND (("m"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying, 'FINANCE'::character varying, 'ACCOUNTANT'::character varying, 'FINANCE_MANAGER'::character varying])::"text"[]))))));



ALTER TABLE "public"."credit_periods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_periods_finance_read" ON "public"."credit_periods" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."credit_accounts" "a"
     JOIN "public"."user_memberships" "m" ON (((("m"."tenant_id")::"text" = ("a"."tenant_id")::"text") AND ("m"."user_id" = "auth"."uid"()) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."business_id" = "a"."business_id") OR ("m"."business_id" IS NULL)) AND (("m"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying, 'FINANCE'::character varying, 'ACCOUNTANT'::character varying, 'FINANCE_MANAGER'::character varying])::"text"[])))))
  WHERE (("a"."id")::"text" = ("credit_periods"."credit_account_id")::"text"))));



ALTER TABLE "public"."credit_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deny_anonymous_users" ON "public"."ad_spaces" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."advertisements" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."approval_actions" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."approval_requests" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."audit_logs" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."bookings" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."branches" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."business_categories" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."business_modules" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."business_sectors" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."chart_of_accounts" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."departments" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."inventory_transactions" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."modules" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."order_status_history" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."organizations" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."stock_balances" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."sync_logs" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."tenant_modules" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."tenant_payment_methods" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."tenants" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_anonymous_users" ON "public"."warehouses" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "deny_direct_access_authenticated" ON "public"."advertisement_target_locations" AS RESTRICTIVE TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "deny_direct_access_authenticated" ON "public"."platform_geo_areas" AS RESTRICTIVE TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "deny_direct_access_authenticated" ON "public"."platform_global_advertisements" AS RESTRICTIVE TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "deny_direct_access_authenticated" ON "public"."smm_providers" AS RESTRICTIVE TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "departments_manager_write" ON "public"."departments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("departments"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("departments"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))));



CREATE POLICY "departments_member_read" ON "public"."departments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("departments"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text")))));



ALTER TABLE "public"."digital_page_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "digital_page_orders_owner_read" ON "public"."digital_page_orders" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."digital_page_payment_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."digital_page_products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "digital_page_products_admin_write" ON "public"."digital_page_products" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."role")::"text" = ANY ((ARRAY['SUPER_ADMIN'::character varying, 'ADMIN'::character varying])::"text"[])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."role")::"text" = ANY ((ARRAY['SUPER_ADMIN'::character varying, 'ADMIN'::character varying])::"text"[]))))));



CREATE POLICY "digital_page_products_public_read" ON "public"."digital_page_products" FOR SELECT TO "authenticated", "anon" USING (("active" = true));



ALTER TABLE "public"."digital_page_sections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "digital_page_sections_owner_manage" ON "public"."digital_page_sections" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."digital_pages" "p"
  WHERE (("p"."id" = "digital_page_sections"."page_id") AND ((("p"."business_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."user_memberships" "m"
          WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."business_id" = "p"."business_id") AND (("m"."status")::"text" = 'ACTIVE'::"text") AND ("upper"((COALESCE("m"."role", ''::character varying))::"text") = ANY (ARRAY['SUPER_ADMIN'::"text", 'ADMIN'::"text", 'OWNER'::"text", 'MANAGER'::"text", 'BUSINESS_OWNER'::"text"])))))) OR (("p"."provider_profile_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."marketing_provider_profiles" "mp"
          WHERE (("mp"."id" = "p"."provider_profile_id") AND ("mp"."owner_user_id" = "auth"."uid"())))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."digital_pages" "p"
  WHERE (("p"."id" = "digital_page_sections"."page_id") AND ((("p"."business_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."user_memberships" "m"
          WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."business_id" = "p"."business_id") AND (("m"."status")::"text" = 'ACTIVE'::"text") AND ("upper"((COALESCE("m"."role", ''::character varying))::"text") = ANY (ARRAY['SUPER_ADMIN'::"text", 'ADMIN'::"text", 'OWNER'::"text", 'MANAGER'::"text", 'BUSINESS_OWNER'::"text"])))))) OR (("p"."provider_profile_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."marketing_provider_profiles" "mp"
          WHERE (("mp"."id" = "p"."provider_profile_id") AND ("mp"."owner_user_id" = "auth"."uid"()))))))))));



CREATE POLICY "digital_page_sections_public_read" ON "public"."digital_page_sections" FOR SELECT TO "authenticated", "anon" USING ((("active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."digital_pages" "p"
  WHERE (("p"."id" = "digital_page_sections"."page_id") AND ("p"."status" = 'PUBLISHED'::"text"))))));



ALTER TABLE "public"."digital_pages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "digital_pages_admin_manage" ON "public"."digital_pages" TO "authenticated" USING (( SELECT "public"."mnty_can_platform_admin"() AS "mnty_can_platform_admin")) WITH CHECK (( SELECT "public"."mnty_can_platform_admin"() AS "mnty_can_platform_admin"));



CREATE POLICY "digital_pages_owner_insert" ON "public"."digital_pages" FOR INSERT TO "authenticated" WITH CHECK ((("status" = 'DRAFT'::"text") AND ("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("updated_by" = ( SELECT "auth"."uid"() AS "uid")) AND ((("business_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("m"."business_id" = "digital_pages"."business_id") AND (("m"."status")::"text" = 'ACTIVE'::"text") AND ("upper"((COALESCE("m"."role", ''::character varying))::"text") = ANY (ARRAY['SUPER_ADMIN'::"text", 'ADMIN'::"text", 'OWNER'::"text", 'MANAGER'::"text", 'BUSINESS_OWNER'::"text"])))))) OR (("provider_profile_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."marketing_provider_profiles" "p"
  WHERE (("p"."id" = "digital_pages"."provider_profile_id") AND ("p"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")))))))));



CREATE POLICY "digital_pages_owner_select" ON "public"."digital_pages" FOR SELECT TO "authenticated" USING (((("business_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("m"."business_id" = "digital_pages"."business_id") AND (("m"."status")::"text" = 'ACTIVE'::"text") AND ("upper"((COALESCE("m"."role", ''::character varying))::"text") = ANY (ARRAY['SUPER_ADMIN'::"text", 'ADMIN'::"text", 'OWNER'::"text", 'MANAGER'::"text", 'BUSINESS_OWNER'::"text"])))))) OR (("provider_profile_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."marketing_provider_profiles" "p"
  WHERE (("p"."id" = "digital_pages"."provider_profile_id") AND ("p"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "digital_pages_owner_update_draft" ON "public"."digital_pages" FOR UPDATE TO "authenticated" USING ((("status" <> 'PUBLISHED'::"text") AND ((("business_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("m"."business_id" = "digital_pages"."business_id") AND (("m"."status")::"text" = 'ACTIVE'::"text") AND ("upper"((COALESCE("m"."role", ''::character varying))::"text") = ANY (ARRAY['SUPER_ADMIN'::"text", 'ADMIN'::"text", 'OWNER'::"text", 'MANAGER'::"text", 'BUSINESS_OWNER'::"text"])))))) OR (("provider_profile_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."marketing_provider_profiles" "p"
  WHERE (("p"."id" = "digital_pages"."provider_profile_id") AND ("p"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))))))) WITH CHECK ((("status" <> 'PUBLISHED'::"text") AND ("updated_by" = ( SELECT "auth"."uid"() AS "uid")) AND ((("business_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("m"."business_id" = "digital_pages"."business_id") AND (("m"."status")::"text" = 'ACTIVE'::"text") AND ("upper"((COALESCE("m"."role", ''::character varying))::"text") = ANY (ARRAY['SUPER_ADMIN'::"text", 'ADMIN'::"text", 'OWNER'::"text", 'MANAGER'::"text", 'BUSINESS_OWNER'::"text"])))))) OR (("provider_profile_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."marketing_provider_profiles" "p"
  WHERE (("p"."id" = "digital_pages"."provider_profile_id") AND ("p"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")))))))));



CREATE POLICY "digital_pages_public_read" ON "public"."digital_pages" FOR SELECT TO "authenticated", "anon" USING (("status" = 'PUBLISHED'::"text"));



ALTER TABLE "public"."education_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "education_requests_insert" ON "public"."education_requests" FOR INSERT TO "authenticated" WITH CHECK (("requester_user_id" = "auth"."uid"()));



CREATE POLICY "education_requests_select" ON "public"."education_requests" FOR SELECT TO "authenticated" USING ((("requester_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "education_requests_update" ON "public"."education_requests" FOR UPDATE TO "authenticated" USING ((("requester_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"())) WITH CHECK ((("requester_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."erp_purchase_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."erp_purchase_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."erp_stock_transfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fashion_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fashion_orders_delete" ON "public"."fashion_orders" FOR DELETE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "fashion_orders_insert" ON "public"."fashion_orders" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "fashion_orders_select" ON "public"."fashion_orders" FOR SELECT TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "fashion_orders_update" ON "public"."fashion_orders" FOR UPDATE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"())) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."fashion_products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fashion_products_delete" ON "public"."fashion_products" FOR DELETE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "fashion_products_insert" ON "public"."fashion_products" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "fashion_products_select" ON "public"."fashion_products" FOR SELECT TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "fashion_products_update" ON "public"."fashion_products" FOR UPDATE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"())) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."fashion_tailor_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fashion_tailor_services_delete" ON "public"."fashion_tailor_services" FOR DELETE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "fashion_tailor_services_insert" ON "public"."fashion_tailor_services" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "fashion_tailor_services_select" ON "public"."fashion_tailor_services" FOR SELECT TO "authenticated" USING (("is_available" OR ("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "fashion_tailor_services_update" ON "public"."fashion_tailor_services" FOR UPDATE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"())) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "feature_flags_read_member" ON "public"."platform_feature_flags" FOR SELECT TO "authenticated" USING (("public"."is_platform_admin"() OR ("tenant_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."tenant_id")::"text" = ("platform_feature_flags"."tenant_id")::"text") AND (("m"."business_id" = "platform_feature_flags"."business_id") OR ("platform_feature_flags"."business_id" IS NULL)) AND ((("m"."branch_id")::"text" = ("platform_feature_flags"."branch_id")::"text") OR ("platform_feature_flags"."branch_id" IS NULL)))))));



CREATE POLICY "feature_flags_write_admin" ON "public"."platform_feature_flags" TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



ALTER TABLE "public"."financial_obligations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_obligations_member_read" ON "public"."financial_obligations" AS RESTRICTIVE FOR SELECT TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE ((("um"."tenant_id")::"text" = ("financial_obligations"."tenant_id")::"text") AND ("um"."user_id" = "auth"."uid"()) AND ((COALESCE("um"."status", 'ACTIVE'::character varying))::"text" = 'ACTIVE'::"text"))))));



ALTER TABLE "public"."general_ledger" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "general_ledger_finance_read" ON "public"."general_ledger" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("general_ledger"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("um"."role")::"text") = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text", 'FINANCE'::"text", 'ACCOUNTANT'::"text", 'FINANCE_MANAGER'::"text"]))))));



ALTER TABLE "public"."indrive_bids" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "indrive_bids_delete" ON "public"."indrive_bids" FOR DELETE TO "authenticated" USING ((("provider_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "indrive_bids_insert" ON "public"."indrive_bids" FOR INSERT TO "authenticated" WITH CHECK ((("provider_user_id" = "auth"."uid"()) AND ("status" = 'OFFERED'::"text") AND ( SELECT "private"."can_submit_indrive_bid"("indrive_bids"."request_id") AS "can_submit_indrive_bid")));



CREATE POLICY "indrive_bids_select" ON "public"."indrive_bids" FOR SELECT TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND ( SELECT "private"."can_read_indrive_bid"("indrive_bids"."request_id", "indrive_bids"."provider_user_id") AS "can_read_indrive_bid")));



CREATE POLICY "indrive_bids_update" ON "public"."indrive_bids" FOR UPDATE TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND ( SELECT "private"."can_read_indrive_bid"("indrive_bids"."request_id", "indrive_bids"."provider_user_id") AS "can_read_indrive_bid"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND ( SELECT "private"."can_read_indrive_bid"("indrive_bids"."request_id", "indrive_bids"."provider_user_id") AS "can_read_indrive_bid")));



ALTER TABLE "public"."indrive_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "indrive_requests_delete" ON "public"."indrive_requests" FOR DELETE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "indrive_requests_insert" ON "public"."indrive_requests" FOR INSERT TO "authenticated" WITH CHECK ((("owner_user_id" = "auth"."uid"()) AND ("status" = 'OPEN_FOR_BIDS'::"text")));



CREATE POLICY "indrive_requests_select" ON "public"."indrive_requests" FOR SELECT TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND ( SELECT "private"."can_read_indrive_request"("indrive_requests"."id") AS "can_read_indrive_request")));



CREATE POLICY "indrive_requests_update" ON "public"."indrive_requests" FOR UPDATE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"())) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."inventory_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_transactions_manager_insert" ON "public"."inventory_transactions" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("inventory_transactions"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))) AND ("created_by" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "inventory_transactions_member_read" ON "public"."inventory_transactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("inventory_transactions"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text")))));



ALTER TABLE "public"."job_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_applications_delete_self_admin" ON "public"."job_applications" FOR DELETE TO "authenticated" USING ((("applicant_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "job_applications_insert_self" ON "public"."job_applications" FOR INSERT TO "authenticated" WITH CHECK (("applicant_user_id" = "auth"."uid"()));



CREATE POLICY "job_applications_select_parties" ON "public"."job_applications" FOR SELECT TO "authenticated" USING ((("applicant_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."jobs" "j"
  WHERE (("j"."id" = "job_applications"."job_id") AND ("j"."owner_user_id" = "auth"."uid"())))) OR "public"."is_platform_admin"()));



CREATE POLICY "job_applications_update_self_admin" ON "public"."job_applications" FOR UPDATE TO "authenticated" USING ((("applicant_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"())) WITH CHECK ((("applicant_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jobs_delete_owner_admin" ON "public"."jobs" FOR DELETE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "jobs_insert_owner" ON "public"."jobs" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "jobs_select_authenticated" ON "public"."jobs" FOR SELECT TO "authenticated" USING ((("is_active" = true) OR ("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "jobs_update_owner_admin" ON "public"."jobs" FOR UPDATE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"())) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."journal_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "journal_entries_finance_read" ON "public"."journal_entries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("journal_entries"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("um"."role")::"text") = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text", 'FINANCE'::"text", 'ACCOUNTANT'::"text", 'FINANCE_MANAGER'::"text"]))))));



CREATE POLICY "journal_entries_manager_insert" ON "public"."journal_entries" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("journal_entries"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[])))))));



CREATE POLICY "journal_entries_manager_update" ON "public"."journal_entries" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("journal_entries"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("journal_entries"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))));



ALTER TABLE "public"."journal_entry_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "journal_entry_lines_finance_read" ON "public"."journal_entry_lines" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."journal_entries" "je"
     JOIN "public"."user_memberships" "um" ON ((("um"."tenant_id")::"text" = ("je"."tenant_id")::"text")))
  WHERE ((("je"."id")::"text" = ("journal_entry_lines"."journal_entry_id")::"text") AND ("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("um"."role")::"text") = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text", 'FINANCE'::"text", 'ACCOUNTANT'::"text", 'FINANCE_MANAGER'::"text"]))))));



CREATE POLICY "legacy_idempotency_deny_direct" ON "public"."legacy_module_idempotency" AS RESTRICTIVE USING (false) WITH CHECK (false);



ALTER TABLE "public"."legacy_module_idempotency" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "legacy_scope_boundary" ON "public"."fashion_orders" AS RESTRICTIVE TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."tenant_id")::"text" = ("fashion_orders"."tenant_id")::"text") AND ("m"."business_id" = "fashion_orders"."business_id") AND (("m"."branch_id")::"text" = ("fashion_orders"."branch_id")::"text")))))) WITH CHECK (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."tenant_id")::"text" = ("fashion_orders"."tenant_id")::"text") AND ("m"."business_id" = "fashion_orders"."business_id") AND (("m"."branch_id")::"text" = ("fashion_orders"."branch_id")::"text"))))));



CREATE POLICY "legacy_scope_boundary" ON "public"."fashion_products" AS RESTRICTIVE TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."tenant_id")::"text" = ("fashion_products"."tenant_id")::"text") AND ("m"."business_id" = "fashion_products"."business_id") AND (("m"."branch_id")::"text" = ("fashion_products"."branch_id")::"text")))))) WITH CHECK (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."tenant_id")::"text" = ("fashion_products"."tenant_id")::"text") AND ("m"."business_id" = "fashion_products"."business_id") AND (("m"."branch_id")::"text" = ("fashion_products"."branch_id")::"text"))))));



CREATE POLICY "legacy_scope_boundary" ON "public"."restaurant_inventory" AS RESTRICTIVE TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."tenant_id")::"text" = ("restaurant_inventory"."tenant_id")::"text") AND ("m"."business_id" = "restaurant_inventory"."business_id") AND (("m"."branch_id")::"text" = ("restaurant_inventory"."branch_id")::"text")))))) WITH CHECK (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."tenant_id")::"text" = ("restaurant_inventory"."tenant_id")::"text") AND ("m"."business_id" = "restaurant_inventory"."business_id") AND (("m"."branch_id")::"text" = ("restaurant_inventory"."branch_id")::"text"))))));



CREATE POLICY "legacy_scope_boundary" ON "public"."restaurant_menu_items" AS RESTRICTIVE TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."tenant_id")::"text" = ("restaurant_menu_items"."tenant_id")::"text") AND ("m"."business_id" = "restaurant_menu_items"."business_id") AND (("m"."branch_id")::"text" = ("restaurant_menu_items"."branch_id")::"text")))))) WITH CHECK (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."tenant_id")::"text" = ("restaurant_menu_items"."tenant_id")::"text") AND ("m"."business_id" = "restaurant_menu_items"."business_id") AND (("m"."branch_id")::"text" = ("restaurant_menu_items"."branch_id")::"text"))))));



CREATE POLICY "legacy_scope_boundary" ON "public"."restaurant_orders" AS RESTRICTIVE TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."tenant_id")::"text" = ("restaurant_orders"."tenant_id")::"text") AND ("m"."business_id" = "restaurant_orders"."business_id") AND (("m"."branch_id")::"text" = ("restaurant_orders"."branch_id")::"text")))))) WITH CHECK (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."tenant_id")::"text" = ("restaurant_orders"."tenant_id")::"text") AND ("m"."business_id" = "restaurant_orders"."business_id") AND (("m"."branch_id")::"text" = ("restaurant_orders"."branch_id")::"text"))))));



CREATE POLICY "legacy_scope_boundary" ON "public"."restaurant_tables" AS RESTRICTIVE TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."tenant_id")::"text" = ("restaurant_tables"."tenant_id")::"text") AND ("m"."business_id" = "restaurant_tables"."business_id") AND (("m"."branch_id")::"text" = ("restaurant_tables"."branch_id")::"text")))))) WITH CHECK (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."tenant_id")::"text" = ("restaurant_tables"."tenant_id")::"text") AND ("m"."business_id" = "restaurant_tables"."business_id") AND (("m"."branch_id")::"text" = ("restaurant_tables"."branch_id")::"text"))))));



ALTER TABLE "public"."legal_document_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "legal_documents_admin_write" ON "public"."legal_documents" TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false) = false) AND "private"."legal_is_admin"(( SELECT "auth"."uid"() AS "uid")))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false) = false) AND "private"."legal_is_admin"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "legal_documents_public_read" ON "public"."legal_documents" FOR SELECT TO "authenticated", "anon" USING (((("status")::"text" = 'PUBLISHED'::"text") OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false) = false) AND "private"."legal_is_admin"(( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."legal_requirements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "legal_versions_admin_write" ON "public"."legal_document_versions" TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false) = false) AND "private"."legal_is_admin"(( SELECT "auth"."uid"() AS "uid")))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false) = false) AND "private"."legal_is_admin"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "legal_versions_public_read" ON "public"."legal_document_versions" FOR SELECT TO "authenticated", "anon" USING (((("status")::"text" = 'PUBLISHED'::"text") OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false) = false) AND "private"."legal_is_admin"(( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."mantigo_bids" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mantigo_bids_insert" ON "public"."mantigo_bids" FOR INSERT TO "authenticated" WITH CHECK (("captain_id" = "auth"."uid"()));



CREATE POLICY "mantigo_bids_select" ON "public"."mantigo_bids" FOR SELECT TO "authenticated" USING ((("captain_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."mantigo_rides" "r"
  WHERE (("r"."id" = "mantigo_bids"."ride_id") AND ("r"."customer_id" = "auth"."uid"())))) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."mantigo_captain_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mantigo_captain_self_select" ON "public"."mantigo_captain_profiles" FOR SELECT TO "authenticated" USING (("captain_id" = "auth"."uid"()));



ALTER TABLE "public"."mantigo_financial_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mantigo_financial_config_admin_select" ON "public"."mantigo_financial_config" FOR SELECT TO "authenticated" USING (( SELECT "public"."mnty_can_platform_admin"() AS "mnty_can_platform_admin"));



CREATE POLICY "mantigo_financial_config_admin_update" ON "public"."mantigo_financial_config" FOR UPDATE TO "authenticated" USING (( SELECT "public"."mnty_can_platform_admin"() AS "mnty_can_platform_admin")) WITH CHECK (( SELECT "public"."mnty_can_platform_admin"() AS "mnty_can_platform_admin"));



CREATE POLICY "mantigo_financial_customer_select" ON "public"."mantigo_financial_ledger" FOR SELECT TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR ("captain_id" = "auth"."uid"())));



ALTER TABLE "public"."mantigo_financial_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mantigo_rate_limit_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mantigo_rate_limit_config_admin_select" ON "public"."mantigo_rate_limit_config" FOR SELECT TO "authenticated" USING (( SELECT "public"."mnty_can_platform_admin"() AS "mnty_can_platform_admin"));



CREATE POLICY "mantigo_rate_limit_config_admin_update" ON "public"."mantigo_rate_limit_config" FOR UPDATE TO "authenticated" USING (( SELECT "public"."mnty_can_platform_admin"() AS "mnty_can_platform_admin")) WITH CHECK (( SELECT "public"."mnty_can_platform_admin"() AS "mnty_can_platform_admin"));



CREATE POLICY "mantigo_ratings_insert" ON "public"."mantigo_ride_ratings" FOR INSERT TO "authenticated" WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "mantigo_ratings_select" ON "public"."mantigo_ride_ratings" FOR SELECT TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR ("captain_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."mantigo_ride_ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mantigo_rides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mantigo_rides_insert" ON "public"."mantigo_rides" FOR INSERT TO "authenticated" WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "mantigo_rides_select" ON "public"."mantigo_rides" FOR SELECT TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."marketing_commission_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_project_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_provider_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_provider_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_provider_services_owner_manage" ON "public"."marketing_provider_services" TO "authenticated" USING (((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false) AND (EXISTS ( SELECT 1
   FROM "public"."marketing_provider_profiles" "p"
  WHERE (("p"."id" = "marketing_provider_services"."provider_id") AND ("p"."owner_user_id" = "auth"."uid"())))))) WITH CHECK (((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false) AND (EXISTS ( SELECT 1
   FROM "public"."marketing_provider_profiles" "p"
  WHERE (("p"."id" = "marketing_provider_services"."provider_id") AND ("p"."owner_user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."marketing_provider_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_services_admin_manage" ON "public"."marketing_services" TO "authenticated" USING (((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false) AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ((COALESCE("m"."status", 'ACTIVE'::character varying))::"text" = 'ACTIVE'::"text") AND ("upper"(("m"."role")::"text") = ANY (ARRAY['SUPER_ADMIN'::"text", 'ADMIN'::"text", 'OWNER'::"text"]))))))) WITH CHECK (((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false) AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ((COALESCE("m"."status", 'ACTIVE'::character varying))::"text" = 'ACTIVE'::"text") AND ("upper"(("m"."role")::"text") = ANY (ARRAY['SUPER_ADMIN'::"text", 'ADMIN'::"text", 'OWNER'::"text"])))))));



ALTER TABLE "public"."matrimony_contact_unlocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matrimony_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matrimony_profiles_delete" ON "public"."matrimony_profiles" FOR DELETE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "matrimony_profiles_insert" ON "public"."matrimony_profiles" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "matrimony_profiles_select" ON "public"."matrimony_profiles" FOR SELECT TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "matrimony_profiles_update" ON "public"."matrimony_profiles" FOR UPDATE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"())) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."matrimony_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matrimony_requests_insert" ON "public"."matrimony_requests" FOR INSERT TO "authenticated" WITH CHECK (("from_user_id" = "auth"."uid"()));



CREATE POLICY "matrimony_requests_select" ON "public"."matrimony_requests" FOR SELECT TO "authenticated" USING ((("from_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."matrimony_profiles" "p"
  WHERE (("p"."id" = "matrimony_requests"."to_profile_id") AND ("p"."owner_user_id" = "auth"."uid"())))) OR "public"."is_platform_admin"()));



CREATE POLICY "matrimony_requests_update" ON "public"."matrimony_requests" FOR UPDATE TO "authenticated" USING ((("from_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."matrimony_profiles" "p"
  WHERE (("p"."id" = "matrimony_requests"."to_profile_id") AND ("p"."owner_user_id" = "auth"."uid"())))) OR "public"."is_platform_admin"())) WITH CHECK ((("from_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."matrimony_profiles" "p"
  WHERE (("p"."id" = "matrimony_requests"."to_profile_id") AND ("p"."owner_user_id" = "auth"."uid"())))) OR "public"."is_platform_admin"()));



CREATE POLICY "matrimony_unlocks_insert" ON "public"."matrimony_contact_unlocks" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."matrimony_requests" "r"
     JOIN "public"."matrimony_profiles" "p" ON (("p"."id" = "r"."to_profile_id")))
  WHERE (("r"."id" = "matrimony_contact_unlocks"."request_id") AND (("r"."from_user_id" = "auth"."uid"()) OR ("p"."owner_user_id" = "auth"."uid"())) AND ("r"."status" = 'ACCEPTED_MUTUAL'::"text")))));



CREATE POLICY "matrimony_unlocks_select" ON "public"."matrimony_contact_unlocks" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."matrimony_requests" "r"
     JOIN "public"."matrimony_profiles" "p" ON (("p"."id" = "r"."to_profile_id")))
  WHERE (("r"."id" = "matrimony_contact_unlocks"."request_id") AND (("r"."from_user_id" = "auth"."uid"()) OR ("p"."owner_user_id" = "auth"."uid"()))))) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."medical_appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "medical_appointments_customer_select" ON "public"."medical_appointments" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "patient_id"));



CREATE POLICY "medical_appointments_provider_select" ON "public"."medical_appointments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("medical_appointments"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("um"."role")::"text") = ANY (ARRAY['SERVICE_PROVIDER'::"text", 'OWNER'::"text", 'BUSINESS_OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text"])) AND (("um"."business_id" IS NULL) OR ("um"."business_id" = "medical_appointments"."business_id"))))));



CREATE POLICY "memberships_select_self" ON "public"."user_memberships" FOR SELECT TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND ("auth"."uid"() = "user_id")));



COMMENT ON POLICY "memberships_select_self" ON "public"."user_memberships" IS 'Client can read only its own active/owned membership rows. Membership creation, role changes, permissions, status changes and deletion are server-authoritative.';



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."ad_spaces" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."advertisements" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."agreement_participants" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."agreements" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."approval_actions" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."approval_requests" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."audit_logs" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."bookings" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."branches" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."business_categories" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."business_modules" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."business_referral_codes" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."business_referral_events" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."business_sectors" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."business_subscriptions" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."catalog_business_settings" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."catalog_item_options" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."catalog_item_prices" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."catalog_items" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."chart_of_accounts" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."consent_audit_log" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."credit_accounts" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."credit_periods" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."credit_policies" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."departments" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."education_requests" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."fashion_orders" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."fashion_products" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."fashion_tailor_services" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."inventory_transactions" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."job_applications" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."jobs" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."legal_document_versions" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."legal_documents" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."legal_requirements" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."mantigo_bids" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."mantigo_ride_ratings" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."mantigo_rides" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."marketing_commission_rules" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."marketing_plans" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."marketing_project_participants" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."marketing_provider_subscriptions" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."matrimony_contact_unlocks" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."matrimony_profiles" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."matrimony_requests" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."modules" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."order_status_history" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."organizations" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."payout_destinations" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."platform_brand_identity" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."platform_feature_flags" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."referral_codes" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."referral_events" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."restaurant_inventory" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."restaurant_menu_items" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."restaurant_orders" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."restaurant_tables" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."school_profiles" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."stock_balances" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."subscription_tier_prices" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."sync_logs" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."teacher_profiles" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."tenant_modules" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."tenant_payment_methods" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."tenants" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."used_item_ads" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."used_item_category_fees" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."user_consents" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."user_profile_media" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnt_non_anonymous_boundary" ON "public"."warehouses" AS RESTRICTIVE TO "authenticated" USING ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false)) WITH CHECK ((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false));



CREATE POLICY "mnty_deny_unexposed_client_access" ON "public"."erp_purchase_orders" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "mnty_deny_unexposed_client_access" ON "public"."erp_purchase_receipts" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "mnty_deny_unexposed_client_access" ON "public"."erp_stock_transfers" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "mnty_deny_unexposed_client_access" ON "public"."smm_admins" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "mnty_deny_unexposed_client_access" ON "public"."smm_provider_credentials" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."modules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "modules_authenticated_read" ON "public"."modules" FOR SELECT TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."ad_spaces" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."advertisements" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."agreement_participants" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."agreements" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."approval_actions" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."approval_requests" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."audit_logs" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."bookings" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."branches" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."business_categories" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."business_modules" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."business_referral_codes" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."business_referral_events" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."business_sectors" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."business_subscriptions" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."catalog_business_settings" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."catalog_item_options" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."catalog_item_prices" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."catalog_items" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."chart_of_accounts" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."consent_audit_log" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."credit_accounts" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."credit_periods" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."credit_policies" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."departments" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."education_requests" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."fashion_orders" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."fashion_products" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."fashion_tailor_services" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."inventory_transactions" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."job_applications" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."jobs" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."legal_document_versions" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."legal_documents" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."legal_requirements" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."mantigo_bids" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."mantigo_ride_ratings" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."mantigo_rides" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."marketing_commission_rules" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."marketing_plans" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."marketing_project_participants" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."marketing_provider_subscriptions" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."matrimony_contact_unlocks" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."matrimony_profiles" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."matrimony_requests" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."modules" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."order_status_history" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."organizations" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."payout_destinations" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."platform_brand_identity" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."platform_feature_flags" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."referral_codes" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."referral_events" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."restaurant_inventory" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."restaurant_menu_items" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."restaurant_orders" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."restaurant_tables" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."school_profiles" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."stock_balances" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."subscription_tier_prices" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."sync_logs" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."teacher_profiles" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."tenant_modules" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."tenant_payment_methods" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."tenants" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."used_item_ads" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."used_item_category_fees" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."user_consents" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."user_profile_media" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_guard" ON "public"."warehouses" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "non_anonymous_authenticated_only" ON "public"."business_subscriptions" AS RESTRICTIVE TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")) WITH CHECK ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_insert_self" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."order_status_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_status_history_customer_select_own" ON "public"."order_status_history" FOR SELECT TO "authenticated" USING (((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false) AND (EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_status_history"."order_id") AND ("o"."customer_id" = "auth"."uid"()))))));



CREATE POLICY "order_status_history_manager_insert" ON "public"."order_status_history" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("order_status_history"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))) AND ("changed_by" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "order_status_history_member_read" ON "public"."order_status_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("order_status_history"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text")))));



ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_customer_select_own" ON "public"."orders" FOR SELECT TO "authenticated" USING (((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false) AND ("customer_id" = "auth"."uid"())));



CREATE POLICY "orders_member_insert" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND ("customer_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("orders"."tenant_id")::"text") AND (("m"."status")::"text" = 'ACTIVE'::"text"))))));



CREATE POLICY "orders_member_select" ON "public"."orders" FOR SELECT TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("orders"."tenant_id")::"text") AND (("m"."status")::"text" = 'ACTIVE'::"text")))) AND (("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m2"
  WHERE (("m2"."user_id" = "auth"."uid"()) AND (("m2"."tenant_id")::"text" = ("orders"."tenant_id")::"text") AND (("m2"."status")::"text" = 'ACTIVE'::"text") AND (("m2"."role")::"text" = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text", 'STAFF'::"text", 'EMPLOYEE'::"text", 'FINANCE'::"text", 'ACCOUNTANT'::"text", 'FINANCE_MANAGER'::"text"]))))) OR (("assigned_partner_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "mp"
  WHERE (("mp"."user_id" = "auth"."uid"()) AND (("mp"."tenant_id")::"text" = ("orders"."tenant_id")::"text") AND (("mp"."status")::"text" = 'ACTIVE'::"text"))))))));



CREATE POLICY "orders_member_update" ON "public"."orders" FOR UPDATE TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("orders"."tenant_id")::"text") AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying, 'STAFF'::character varying, 'EMPLOYEE'::character varying])::"text"[]))))))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("orders"."tenant_id")::"text") AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying, 'STAFF'::character varying, 'EMPLOYEE'::character varying])::"text"[])))))));



CREATE POLICY "orders_provider_select_own_business" ON "public"."orders" FOR SELECT TO "authenticated" USING (((COALESCE((("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean, false) = false) AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("orders"."tenant_id")::"text") AND ("m"."business_id" = "orders"."business_id") AND ((COALESCE("m"."status", 'ACTIVE'::character varying))::"text" = 'ACTIVE'::"text") AND ("upper"(("m"."role")::"text") = 'SERVICE_PROVIDER'::"text"))))));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_admin_write" ON "public"."organizations" TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("organizations"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text"]))))))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("organizations"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text"])))))));



CREATE POLICY "organizations_member_read" ON "public"."organizations" FOR SELECT TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("organizations"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text"))))));



ALTER TABLE "public"."payment_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_events_finance_read" ON "public"."payment_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("payment_events"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("um"."role")::"text") = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text", 'FINANCE'::"text", 'ACCOUNTANT'::"text", 'FINANCE_MANAGER'::"text"]))))));



ALTER TABLE "public"."payment_financial_reconciliations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_financial_reconciliations_finance_read" ON "public"."payment_financial_reconciliations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("payment_financial_reconciliations"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("um"."role")::"text") = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text", 'FINANCE'::"text", 'ACCOUNTANT'::"text", 'FINANCE_MANAGER'::"text"]))))));



ALTER TABLE "public"."payment_intents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_intents_finance_read" ON "public"."payment_intents" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("payment_intents"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("um"."role")::"text") = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text", 'FINANCE'::"text", 'ACCOUNTANT'::"text", 'FINANCE_MANAGER'::"text"]))))));



ALTER TABLE "public"."payment_provider_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_provider_events_finance_read" ON "public"."payment_provider_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("payment_provider_events"."tenant_id")::"text") AND (("m"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("m"."role")::"text") = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'FINANCE'::"text", 'ACCOUNTANT'::"text", 'FINANCE_MANAGER'::"text"]))))));



ALTER TABLE "public"."payout_destinations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payout_destinations_member_read" ON "public"."payout_destinations" AS RESTRICTIVE FOR SELECT TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



ALTER TABLE "public"."platform_brand_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_brand_identity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_feature_flags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_geo_areas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_geo_areas_public_active_select" ON "public"."platform_geo_areas" FOR SELECT TO "authenticated", "anon" USING (((("status")::"text" = 'ACTIVE'::"text") AND (("country_code")::"text" = 'EG'::"text") AND (("level")::"text" = ANY ((ARRAY['COUNTRY'::character varying, 'GOVERNORATE'::character varying, 'CENTER'::character varying])::"text"[]))));



ALTER TABLE "public"."platform_global_advertisements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provider_onboarding_admin_select" ON "public"."provider_onboarding_requests" FOR SELECT TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("provider_onboarding_requests"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("um"."role")::"text") = ANY (ARRAY['SUPER_ADMIN'::"text", 'ADMIN'::"text", 'OWNER'::"text", 'MANAGER'::"text"])))))));



ALTER TABLE "public"."provider_onboarding_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provider_onboarding_self_select" ON "public"."provider_onboarding_requests" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") AND (COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_subscriptions_delete_own" ON "public"."push_subscriptions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "push_subscriptions_insert_own" ON "public"."push_subscriptions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "push_subscriptions_select_own" ON "public"."push_subscriptions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "push_subscriptions_update_own" ON "public"."push_subscriptions" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."referral_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "referral_codes_self_read" ON "public"."referral_codes" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."referral_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "referral_events_self_read" ON "public"."referral_events" FOR SELECT TO "authenticated" USING ((("referrer_user_id" = "auth"."uid"()) OR ("referred_user_id" = "auth"."uid"())));



ALTER TABLE "public"."refund_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refund_transactions_finance_select" ON "public"."refund_transactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("refund_transactions"."tenant_id")::"text") AND (("m"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("m"."role")::"text") = ANY (ARRAY['ADMIN'::"text", 'SUPER_ADMIN'::"text", 'OWNER'::"text", 'BUSINESS_OWNER'::"text", 'ACCOUNTANT'::"text", 'FINANCE_MANAGER'::"text", 'FINANCE'::"text"]))))));



CREATE POLICY "requirements_admin_all" ON "public"."legal_requirements" TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false) = false) AND "private"."legal_is_admin"(( SELECT "auth"."uid"() AS "uid")))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false) = false) AND "private"."legal_is_admin"(( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."restaurant_inventory" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurant_inventory_delete" ON "public"."restaurant_inventory" FOR DELETE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "restaurant_inventory_insert" ON "public"."restaurant_inventory" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "restaurant_inventory_select" ON "public"."restaurant_inventory" FOR SELECT TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "restaurant_inventory_update" ON "public"."restaurant_inventory" FOR UPDATE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"())) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."restaurant_menu_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurant_menu_items_delete" ON "public"."restaurant_menu_items" FOR DELETE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "restaurant_menu_items_insert" ON "public"."restaurant_menu_items" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "restaurant_menu_items_select" ON "public"."restaurant_menu_items" FOR SELECT TO "authenticated" USING (("is_available" OR ("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "restaurant_menu_items_update" ON "public"."restaurant_menu_items" FOR UPDATE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"())) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."restaurant_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurant_orders_delete" ON "public"."restaurant_orders" FOR DELETE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "restaurant_orders_insert" ON "public"."restaurant_orders" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "restaurant_orders_select" ON "public"."restaurant_orders" FOR SELECT TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "restaurant_orders_update" ON "public"."restaurant_orders" FOR UPDATE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"())) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."restaurant_tables" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurant_tables_delete" ON "public"."restaurant_tables" FOR DELETE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "restaurant_tables_insert" ON "public"."restaurant_tables" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "restaurant_tables_select" ON "public"."restaurant_tables" FOR SELECT TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "restaurant_tables_update" ON "public"."restaurant_tables" FOR UPDATE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"())) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."school_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "school_profiles_delete" ON "public"."school_profiles" FOR DELETE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "school_profiles_insert" ON "public"."school_profiles" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "school_profiles_select" ON "public"."school_profiles" FOR SELECT TO "authenticated" USING (("is_available" OR ("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "school_profiles_update" ON "public"."school_profiles" FOR UPDATE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"())) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."settlement_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settlement_attempts_finance_read" ON "public"."settlement_attempts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."financial_obligations" "o"
     JOIN "public"."user_memberships" "m" ON (((("m"."tenant_id")::"text" = ("o"."tenant_id")::"text") AND ("m"."user_id" = "auth"."uid"()) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND (("m"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'FINANCE'::character varying, 'ACCOUNTANT'::character varying, 'FINANCE_MANAGER'::character varying])::"text"[])))))
  WHERE (("o"."id")::"text" = ("settlement_attempts"."obligation_id")::"text"))));



ALTER TABLE "public"."settlement_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settlement_transactions_finance_read" ON "public"."settlement_transactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("settlement_transactions"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("um"."role")::"text") = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text", 'FINANCE'::"text", 'ACCOUNTANT'::"text", 'FINANCE_MANAGER'::"text"]))))));



ALTER TABLE "public"."smm_admins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."smm_order_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "smm_order_events_owner_read" ON "public"."smm_order_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."smm_orders" "o"
  WHERE (("o"."id" = "smm_order_events"."order_id") AND ("o"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."smm_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "smm_orders_owner_insert" ON "public"."smm_orders" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "smm_orders_owner_read" ON "public"."smm_orders" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."smm_provider_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."smm_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."smm_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "smm_services_public_read" ON "public"."smm_services" FOR SELECT TO "authenticated", "anon" USING (("active" = true));



CREATE POLICY "smm_wallet_owner_read" ON "public"."smm_wallets" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."smm_wallet_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "smm_wallet_tx_owner_read" ON "public"."smm_wallet_transactions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."smm_wallets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_balances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_balances_member_read" ON "public"."stock_balances" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("stock_balances"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text")))));



ALTER TABLE "public"."subscription_payment_intents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_payment_intents_owner_read" ON "public"."subscription_payment_intents" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."status")::"text" = 'ACTIVE'::"text") AND ("m"."business_id" = "subscription_payment_intents"."business_id")))));



ALTER TABLE "public"."subscription_tier_prices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_tier_prices_authenticated_read" ON "public"."subscription_tier_prices" FOR SELECT TO "authenticated" USING (("active" = true));



ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_tickets_insert_self" ON "public"."support_tickets" FOR INSERT TO "authenticated" WITH CHECK ((("requester_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("support_tickets"."tenant_id")::"text") AND (("m"."status")::"text" = 'ACTIVE'::"text"))))));



CREATE POLICY "support_tickets_select_member" ON "public"."support_tickets" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("support_tickets"."tenant_id")::"text") AND (("m"."status")::"text" = 'ACTIVE'::"text")))) AND (("requester_id" = "auth"."uid"()) OR ("assigned_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m2"
  WHERE (("m2"."user_id" = "auth"."uid"()) AND (("m2"."tenant_id")::"text" = ("support_tickets"."tenant_id")::"text") AND (("m2"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("m2"."role")::"text") = ANY (ARRAY['ADMIN'::"text", 'SUPER_ADMIN'::"text", 'OWNER'::"text", 'BUSINESS_OWNER'::"text", 'SUPPORT'::"text", 'SUPPORT_MANAGER'::"text"]))))))));



CREATE POLICY "support_tickets_update_staff" ON "public"."support_tickets" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("support_tickets"."tenant_id")::"text") AND (("m"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("m"."role")::"text") = ANY (ARRAY['ADMIN'::"text", 'SUPER_ADMIN'::"text", 'OWNER'::"text", 'BUSINESS_OWNER'::"text", 'SUPPORT'::"text", 'SUPPORT_MANAGER'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("support_tickets"."tenant_id")::"text") AND (("m"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("m"."role")::"text") = ANY (ARRAY['ADMIN'::"text", 'SUPER_ADMIN'::"text", 'OWNER'::"text", 'BUSINESS_OWNER'::"text", 'SUPPORT'::"text", 'SUPPORT_MANAGER'::"text"]))))));



ALTER TABLE "public"."sync_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sync_logs_insert_tenant" ON "public"."sync_logs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("sync_logs"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text")))));



CREATE POLICY "sync_logs_select_tenant" ON "public"."sync_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("sync_logs"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text")))));



ALTER TABLE "public"."teacher_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teacher_profiles_delete" ON "public"."teacher_profiles" FOR DELETE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "teacher_profiles_insert" ON "public"."teacher_profiles" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "teacher_profiles_select" ON "public"."teacher_profiles" FOR SELECT TO "authenticated" USING (("is_available" OR ("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "teacher_profiles_update" ON "public"."teacher_profiles" FOR UPDATE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"())) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."tenant_modules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_modules_admin_delete" ON "public"."tenant_modules" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("tenant_modules"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying])::"text"[]))))));



CREATE POLICY "tenant_modules_admin_insert" ON "public"."tenant_modules" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("tenant_modules"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying])::"text"[]))))));



CREATE POLICY "tenant_modules_admin_update" ON "public"."tenant_modules" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("tenant_modules"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying])::"text"[])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("tenant_modules"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying])::"text"[]))))));



CREATE POLICY "tenant_modules_member_read" ON "public"."tenant_modules" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("tenant_modules"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text")))));



ALTER TABLE "public"."tenant_payment_methods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_payment_methods_manage" ON "public"."tenant_payment_methods" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("tenant_payment_methods"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("tenant_payment_methods"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))));



ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenants_no_direct_update" ON "public"."tenants" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "tenants_select_member" ON "public"."tenants" FOR SELECT TO "authenticated" USING (((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = "auth"."uid"()) AND (("um"."tenant_id")::"text" = ("tenants"."id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text"))))));



ALTER TABLE "public"."ticket_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ticket_messages_insert_member" ON "public"."ticket_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."support_tickets" "t"
     JOIN "public"."user_memberships" "m" ON ((("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("t"."tenant_id")::"text") AND (("m"."status")::"text" = 'ACTIVE'::"text"))))
  WHERE ((("t"."id")::"text" = ("ticket_messages"."ticket_id")::"text") AND (("t"."requester_id" = "auth"."uid"()) OR ("t"."assigned_user_id" = "auth"."uid"()) OR ("upper"(("m"."role")::"text") = ANY (ARRAY['ADMIN'::"text", 'SUPER_ADMIN'::"text", 'OWNER'::"text", 'BUSINESS_OWNER'::"text", 'SUPPORT'::"text", 'SUPPORT_MANAGER'::"text"]))))))));



CREATE POLICY "ticket_messages_select_member" ON "public"."ticket_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."support_tickets" "t"
     JOIN "public"."user_memberships" "m" ON ((("m"."user_id" = "auth"."uid"()) AND (("m"."tenant_id")::"text" = ("t"."tenant_id")::"text") AND (("m"."status")::"text" = 'ACTIVE'::"text"))))
  WHERE ((("t"."id")::"text" = ("ticket_messages"."ticket_id")::"text") AND (("t"."requester_id" = "auth"."uid"()) OR ("t"."assigned_user_id" = "auth"."uid"()) OR ("upper"(("m"."role")::"text") = ANY (ARRAY['ADMIN'::"text", 'SUPER_ADMIN'::"text", 'OWNER'::"text", 'BUSINESS_OWNER'::"text", 'SUPPORT'::"text", 'SUPPORT_MANAGER'::"text"])))))));



ALTER TABLE "public"."used_item_ads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "used_item_ads_delete_owner_admin" ON "public"."used_item_ads" FOR DELETE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "used_item_ads_insert_owner" ON "public"."used_item_ads" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "used_item_ads_select_authenticated" ON "public"."used_item_ads" FOR SELECT TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "used_item_ads_update_owner_admin" ON "public"."used_item_ads" FOR UPDATE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"())) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."used_item_category_fees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "used_item_category_fees_select_authenticated" ON "public"."used_item_category_fees" FOR SELECT TO "authenticated" USING ((COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"));



CREATE POLICY "used_item_category_fees_update_admin" ON "public"."used_item_category_fees" FOR UPDATE TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



ALTER TABLE "public"."user_consents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_consents_own_read" ON "public"."user_consents" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false) = false) AND (("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "private"."legal_is_admin"(( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."user_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profile_media" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_profile_media_insert_self" ON "public"."user_profile_media" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")));



CREATE POLICY "user_profile_media_select_self" ON "public"."user_profile_media" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND (COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")));



CREATE POLICY "user_profile_media_update_self" ON "public"."user_profile_media" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND (COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text"))) WITH CHECK ((("user_id" = "auth"."uid"()) AND (COALESCE(("auth"."jwt"() ->> 'is_anonymous'::"text"), 'false'::"text") <> 'true'::"text")));



ALTER TABLE "public"."wallet_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_accounts_finance_read" ON "public"."wallet_accounts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("wallet_accounts"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("um"."role")::"text") = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text", 'FINANCE'::"text", 'ACCOUNTANT'::"text", 'FINANCE_MANAGER'::"text"]))))));



ALTER TABLE "public"."wallet_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_transactions_finance_read" ON "public"."wallet_transactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("wallet_transactions"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND ("upper"(("um"."role")::"text") = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MANAGER'::"text", 'FINANCE'::"text", 'ACCOUNTANT'::"text", 'FINANCE_MANAGER'::"text"]))))));



ALTER TABLE "public"."warehouses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "warehouses_manager_delete" ON "public"."warehouses" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("warehouses"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))));



CREATE POLICY "warehouses_manager_insert" ON "public"."warehouses" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("warehouses"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))));



CREATE POLICY "warehouses_manager_update" ON "public"."warehouses" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("warehouses"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("warehouses"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text") AND (("um"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying])::"text"[]))))));



CREATE POLICY "warehouses_member_read" ON "public"."warehouses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_memberships" "um"
  WHERE (("um"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("um"."tenant_id")::"text" = ("warehouses"."tenant_id")::"text") AND (("um"."status")::"text" = 'ACTIVE'::"text")))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."approval_requests";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."mantigo_bids";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."mantigo_rides";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."order_status_history";






GRANT USAGE ON SCHEMA "private" TO "authenticated";
GRANT USAGE ON SCHEMA "private" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "private"."accept_indrive_bid_impl"("p_request_id" "uuid", "p_bid_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."accept_indrive_bid_impl"("p_request_id" "uuid", "p_bid_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."activate_customer_registration_atomic"("p_user_id" "uuid", "p_tenant_id" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."activate_customer_registration_atomic"("p_user_id" "uuid", "p_tenant_id" character varying) TO "service_role";



REVOKE ALL ON FUNCTION "private"."bootstrap_platform_admin"("p_user_id" "uuid", "p_tenant_id" character varying, "p_tenant_name" character varying, "p_tenant_code" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."bootstrap_platform_admin"("p_user_id" "uuid", "p_tenant_id" character varying, "p_tenant_name" character varying, "p_tenant_code" character varying) TO "service_role";



REVOKE ALL ON FUNCTION "private"."can_read_indrive_bid"("p_request_id" "uuid", "p_provider_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_read_indrive_bid"("p_request_id" "uuid", "p_provider_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_read_indrive_request"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_read_indrive_request"("p_request_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_submit_indrive_bid"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_submit_indrive_bid"("p_request_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."disable_mnty_push_subscription"("p_endpoint" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."disable_mnty_push_subscription"("p_endpoint" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."ensure_customer_membership_for_user"("p_user_id" "uuid", "p_tenant_id" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."ensure_customer_membership_for_user"("p_user_id" "uuid", "p_tenant_id" character varying) TO "service_role";



REVOKE ALL ON FUNCTION "private"."handle_auth_user_customer_membership"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."handle_auth_user_customer_membership"() TO "service_role";



REVOKE ALL ON FUNCTION "private"."legal_is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."legal_is_admin"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."legal_is_admin"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."legal_is_admin"("p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."mnty_notify_order_created"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."mnty_notify_order_status"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."mnty_notify_order_status_changed"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."reject_indrive_bid_impl"("p_request_id" "uuid", "p_bid_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."reject_indrive_bid_impl"("p_request_id" "uuid", "p_bid_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."review_business_approval_atomic"("p_actor_user_id" "uuid", "p_approval_request_id" character varying, "p_action" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."review_business_approval_atomic"("p_actor_user_id" "uuid", "p_approval_request_id" character varying, "p_action" character varying) TO "service_role";



REVOKE ALL ON FUNCTION "private"."review_provider_onboarding_atomic"("p_actor_user_id" "uuid", "p_onboarding_request_id" "uuid", "p_decision" "text", "p_rejection_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."review_provider_onboarding_atomic"("p_actor_user_id" "uuid", "p_onboarding_request_id" "uuid", "p_decision" "text", "p_rejection_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "private"."review_registration_request_atomic"("p_actor_user_id" "uuid", "p_request_id" "uuid", "p_decision" "text", "p_tenant_id" character varying, "p_organization_id" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."review_registration_request_atomic"("p_actor_user_id" "uuid", "p_request_id" "uuid", "p_decision" "text", "p_tenant_id" character varying, "p_organization_id" character varying) TO "service_role";



REVOKE ALL ON FUNCTION "private"."submit_provider_onboarding"("p_user_id" "uuid", "p_registration_request_id" "uuid", "p_tenant_id" character varying, "p_organization_id" character varying, "p_business_name" character varying, "p_provider_kind" character varying, "p_name_en" character varying, "p_description" "text", "p_specialties" "jsonb", "p_service_areas" "jsonb", "p_portfolio" "jsonb", "p_profile_image_path" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."submit_provider_onboarding"("p_user_id" "uuid", "p_registration_request_id" "uuid", "p_tenant_id" character varying, "p_organization_id" character varying, "p_business_name" character varying, "p_provider_kind" character varying, "p_name_en" character varying, "p_description" "text", "p_specialties" "jsonb", "p_service_areas" "jsonb", "p_portfolio" "jsonb", "p_profile_image_path" "text") TO "service_role";



GRANT MAINTAIN ON TABLE "public"."push_subscriptions" TO "anon";
GRANT MAINTAIN ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



REVOKE ALL ON FUNCTION "private"."upsert_mnty_push_subscription"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text", "p_platform" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."upsert_mnty_push_subscription"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text", "p_platform" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."accept_indrive_bid"("p_request_id" "uuid", "p_bid_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_indrive_bid"("p_request_id" "uuid", "p_bid_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."accept_mantigo_bid_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_bid_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_mantigo_bid_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_bid_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_create_global_ad"("p_title" character varying, "p_creative_url" "text", "p_target_url" "text", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_create_global_ad"("p_title" character varying, "p_creative_url" "text", "p_target_url" "text", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone) TO "authenticated";



GRANT MAINTAIN ON TABLE "public"."audit_logs" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



REVOKE ALL ON FUNCTION "public"."append_audit_log_backend"("p_id" character varying, "p_tenant_id" character varying, "p_organization_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_action" character varying, "p_entity_type" character varying, "p_entity_id" character varying, "p_old_values" "jsonb", "p_new_values" "jsonb", "p_result" character varying) FROM PUBLIC;



GRANT MAINTAIN ON TABLE "public"."ticket_messages" TO "anon";
GRANT MAINTAIN ON TABLE "public"."ticket_messages" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ticket_messages" TO "service_role";



REVOKE ALL ON FUNCTION "public"."append_ticket_message_backend"("p_id" character varying, "p_ticket_id" character varying, "p_content" "text", "p_sender_role" character varying) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."assert_financial_membership"("p_tenant_id" character varying) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."claim_digital_page_payment_intent_backend"("p_order_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text", "p_claim_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_digital_page_payment_intent_backend"("p_order_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text", "p_claim_token" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."claim_referral"("p_code" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_referral"("p_code" character varying) TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirm_cash_payment"("p_payment_intent_id" character varying, "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_cash_payment"("p_payment_intent_id" character varying, "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirm_mantigo_cash_payment_backend"("p_user_id" "uuid", "p_ride_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_mantigo_cash_payment_backend"("p_user_id" "uuid", "p_ride_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."confirm_obligation_settlement"("p_obligation_id" character varying, "p_external_reference" character varying, "p_confirmed_amount" numeric, "p_currency" character varying, "p_provider" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_obligation_settlement"("p_obligation_id" character varying, "p_external_reference" character varying, "p_confirmed_amount" numeric, "p_currency" character varying, "p_provider" character varying) TO "service_role";



REVOKE ALL ON FUNCTION "public"."counter_offer_indrive_bid"("p_request_id" "uuid", "p_bid_id" "uuid", "p_new_counter_price" numeric) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."create_commission_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_rule_id" character varying, "p_order_amount" numeric, "p_commission_rate" numeric, "p_commission_amount" numeric, "p_platform_net" numeric, "p_merchant_net" numeric, "p_journal_entry" "jsonb", "p_journal_lines" "jsonb") FROM PUBLIC;



GRANT MAINTAIN ON TABLE "public"."education_requests" TO "anon";
GRANT SELECT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."education_requests" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."education_requests" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_education_request_backend"("p_target_id" "uuid", "p_target_type" "text", "p_student_name" "text", "p_subject_or_grade" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_education_request_backend"("p_target_id" "uuid", "p_target_type" "text", "p_student_name" "text", "p_subject_or_grade" "text") TO "authenticated";



GRANT MAINTAIN ON TABLE "public"."indrive_bids" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."indrive_bids" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."indrive_bids" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_indrive_bid_backend"("p_user_id" "uuid", "p_request_id" "uuid", "p_provider_name" "text", "p_provider_type" "text", "p_offered_price" numeric, "p_note" "text", "p_estimated_delivery_time" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_indrive_bid_backend"("p_user_id" "uuid", "p_request_id" "uuid", "p_provider_name" "text", "p_provider_type" "text", "p_offered_price" numeric, "p_note" "text", "p_estimated_delivery_time" "text") TO "authenticated";



GRANT MAINTAIN ON TABLE "public"."indrive_requests" TO "anon";
GRANT SELECT,DELETE,MAINTAIN ON TABLE "public"."indrive_requests" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."indrive_requests" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_indrive_request_backend"("p_user_id" "uuid", "p_domain_type" "text", "p_category_name" "text", "p_title" "text", "p_details_description" "text", "p_user_proposed_price" numeric, "p_target_provider_type" "text", "p_req_location_district" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_indrive_request_backend"("p_user_id" "uuid", "p_domain_type" "text", "p_category_name" "text", "p_title" "text", "p_details_description" "text", "p_user_proposed_price" numeric, "p_target_provider_type" "text", "p_req_location_district" "text", "p_idempotency_key" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_job_backend"("p_user_id" "uuid", "p_job_id" "text", "p_tenant_id" character varying, "p_business_id" "uuid", "p_title" "text", "p_company_name" "text", "p_category" "text", "p_location" "text", "p_job_type" "text", "p_salary_range" "text", "p_description" "text", "p_requirements" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_job_backend"("p_user_id" "uuid", "p_job_id" "text", "p_tenant_id" character varying, "p_business_id" "uuid", "p_title" "text", "p_company_name" "text", "p_category" "text", "p_location" "text", "p_job_type" "text", "p_salary_range" "text", "p_description" "text", "p_requirements" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_mantigo_bid_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_captain_name" "text", "p_captain_phone" "text", "p_captain_rating" numeric, "p_vehicle_category" "text", "p_vehicle_model" "text", "p_vehicle_plate" "text", "p_offered_price" numeric, "p_eta_minutes" integer, "p_captain_message" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_mantigo_bid_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_captain_name" "text", "p_captain_phone" "text", "p_captain_rating" numeric, "p_vehicle_category" "text", "p_vehicle_model" "text", "p_vehicle_plate" "text", "p_offered_price" numeric, "p_eta_minutes" integer, "p_captain_message" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_mantigo_ride_backend"("p_user_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_vehicle_category" "text", "p_ride_type" "text", "p_pickup_location" "text", "p_destination_location" "text", "p_proposed_price" numeric, "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_mantigo_ride_backend"("p_user_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_vehicle_category" "text", "p_ride_type" "text", "p_pickup_location" "text", "p_destination_location" "text", "p_proposed_price" numeric, "p_note" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_mantigo_ride_backend_v2"("p_user_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_vehicle_category" "text", "p_ride_type" "text", "p_pickup_location" "text", "p_destination_location" "text", "p_proposed_price" numeric, "p_note" "text", "p_idempotency_key" "text", "p_pickup_lat" double precision, "p_pickup_lon" double precision, "p_destination_lat" double precision, "p_destination_lon" double precision) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_mantigo_ride_backend_v2"("p_user_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_vehicle_category" "text", "p_ride_type" "text", "p_pickup_location" "text", "p_destination_location" "text", "p_proposed_price" numeric, "p_note" "text", "p_idempotency_key" "text", "p_pickup_lat" double precision, "p_pickup_lon" double precision, "p_destination_lat" double precision, "p_destination_lon" double precision) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_medical_appointment_backend"("p_user_id" "uuid", "p_appointment_id" "text", "p_business_id" "uuid", "p_doctor_id" "text", "p_date_time" bigint, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_medical_appointment_backend"("p_user_id" "uuid", "p_appointment_id" "text", "p_business_id" "uuid", "p_doctor_id" "text", "p_date_time" bigint, "p_reason" "text") TO "authenticated";



GRANT MAINTAIN ON TABLE "public"."notifications" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."notifications" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notifications" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_notification_backend"("p_id" character varying, "p_tenant_id" character varying, "p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_body" "text", "p_entity_type" character varying, "p_entity_id" character varying) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."create_order_backend"("p_order_id" "uuid", "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_customer_id" "uuid", "p_client_idempotency_key" character varying, "p_subtotal" numeric, "p_discount" numeric, "p_tax" numeric, "p_delivery_fee" numeric, "p_total_amount" numeric, "p_currency" character varying, "p_customer_name" "text", "p_customer_phone" "text", "p_delivery_address" "text", "p_items_json" "jsonb", "p_notes" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_order_backend"("p_order_id" "uuid", "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_customer_id" "uuid", "p_client_idempotency_key" character varying, "p_subtotal" numeric, "p_discount" numeric, "p_tax" numeric, "p_delivery_fee" numeric, "p_total_amount" numeric, "p_currency" character varying, "p_customer_name" "text", "p_customer_phone" "text", "p_delivery_address" "text", "p_items_json" "jsonb", "p_notes" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_payment_intent_backend"("p_tenant_id" character varying, "p_order_id" "uuid", "p_amount" numeric, "p_currency" character varying, "p_provider" character varying, "p_payment_method" character varying, "p_idempotency_key" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_payment_intent_backend"("p_tenant_id" character varying, "p_order_id" "uuid", "p_amount" numeric, "p_currency" character varying, "p_provider" character varying, "p_payment_method" character varying, "p_idempotency_key" character varying) TO "service_role";
GRANT ALL ON FUNCTION "public"."create_payment_intent_backend"("p_tenant_id" character varying, "p_order_id" "uuid", "p_amount" numeric, "p_currency" character varying, "p_provider" character varying, "p_payment_method" character varying, "p_idempotency_key" character varying) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_payment_obligations"("p_id_prefix" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_payment_intent_id" character varying, "p_gross_amount" numeric, "p_commission_amount" numeric, "p_provider_id" character varying, "p_currency" character varying, "p_payment_method" character varying) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."create_purchase_order_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_order_number" character varying, "p_supplier_id" character varying, "p_total_amount" numeric, "p_tax_amount" numeric, "p_discount_amount" numeric, "p_reason" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."create_settlement_and_post_journal"("p_id" character varying, "p_tenant_id" character varying, "p_beneficiary_type" character varying, "p_beneficiary_id" character varying, "p_gross" numeric, "p_platform_fee" numeric, "p_net" numeric, "p_voucher" numeric, "p_channel" character varying, "p_reference_id" character varying, "p_business_id" "uuid", "p_description" "text", "p_actor_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_settlement_and_post_journal"("p_id" character varying, "p_tenant_id" character varying, "p_beneficiary_type" character varying, "p_beneficiary_id" character varying, "p_gross" numeric, "p_platform_fee" numeric, "p_net" numeric, "p_voucher" numeric, "p_channel" character varying, "p_reference_id" character varying, "p_business_id" "uuid", "p_description" "text", "p_actor_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_settlement_backend"("p_id" character varying, "p_tenant_id" character varying, "p_beneficiary_type" character varying, "p_beneficiary_id" character varying, "p_gross" numeric, "p_platform_fee" numeric, "p_net" numeric, "p_voucher" numeric, "p_channel" character varying, "p_reference_id" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_settlement_backend"("p_id" character varying, "p_tenant_id" character varying, "p_beneficiary_type" character varying, "p_beneficiary_id" character varying, "p_gross" numeric, "p_platform_fee" numeric, "p_net" numeric, "p_voucher" numeric, "p_channel" character varying, "p_reference_id" character varying) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_stock_transfer_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_transfer_number" character varying, "p_from_warehouse_id" character varying, "p_to_warehouse_id" character varying, "p_product_id" "uuid", "p_quantity" numeric) FROM PUBLIC;



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."subscription_payment_intents" TO "service_role";
GRANT SELECT ON TABLE "public"."subscription_payment_intents" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_subscription_payment_intent_backend"("p_business_id" "uuid", "p_tier_code" "text", "p_billing_cycle" "text", "p_sector" "text", "p_idempotency_key" "text", "p_actor_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_subscription_payment_intent_backend"("p_business_id" "uuid", "p_tier_code" "text", "p_billing_cycle" "text", "p_sector" "text", "p_idempotency_key" "text", "p_actor_user_id" "uuid") TO "service_role";



GRANT MAINTAIN ON TABLE "public"."support_tickets" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."support_tickets" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."support_tickets" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_support_ticket_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_subject" character varying, "p_description" "text", "p_category" character varying, "p_priority" character varying) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."create_wallet_transaction_backend"("p_id" character varying, "p_tenant_id" character varying, "p_wallet_id" character varying, "p_transaction_type" character varying, "p_amount" numeric, "p_idempotency_key" character varying, "p_reference_type" character varying, "p_reference_id" character varying, "p_description" "text", "p_journal_entry" "jsonb", "p_journal_lines" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."create_warehouse_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_name" character varying, "p_code" character varying) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."current_business_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_business_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_business_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_tenant_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_user_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."deactivate_business"("p_business_id" "uuid", "p_reason" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."disable_mnty_push_subscription"("p_endpoint" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."disable_mnty_push_subscription"("p_endpoint" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."expire_stale_mantigo_rides_backend"("p_admin_user_id" "uuid", "p_age_minutes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expire_stale_mantigo_rides_backend"("p_admin_user_id" "uuid", "p_age_minutes" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."fashion_erp_mutate"("p_action" "text", "p_payload" "jsonb", "p_idempotency_key" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."finalize_digital_page_payment_intent_backend"("p_order_id" "uuid", "p_user_id" "uuid", "p_claim_token" "text", "p_provider_intent_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_digital_page_payment_intent_backend"("p_order_id" "uuid", "p_user_id" "uuid", "p_claim_token" "text", "p_provider_intent_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."find_mnty_nearby_provider_businesses"("p_lat" double precision, "p_lon" double precision, "p_radius_km" double precision) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."find_mnty_nearest_provider_businesses"("p_lat" double precision, "p_lon" double precision, "p_limit" integer) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."fulfill_digital_page_publish"("p_actor_user_id" "uuid", "p_order_id" "uuid", "p_page_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fulfill_digital_page_publish"("p_actor_user_id" "uuid", "p_order_id" "uuid", "p_page_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_credit_status"("p_tenant_id" character varying, "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_credit_status"("p_tenant_id" character varying, "p_business_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_mantigo_admin_dashboard_backend"("p_admin_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_mantigo_admin_dashboard_backend"("p_admin_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_mantigo_admin_financial_report_backend"("p_admin_user_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_mantigo_admin_financial_report_backend"("p_admin_user_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_mantigo_captain_earnings_backend"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_mantigo_captain_earnings_backend"("p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_mnty_push_secrets"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_mnty_push_secrets"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_mnty_targeted_advertisements"("p_country_code" character varying, "p_governorate_code" character varying, "p_center_code" character varying, "p_lat" double precision, "p_lon" double precision, "p_ad_space_id" character varying, "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_mnty_targeted_advertisements"("p_country_code" character varying, "p_governorate_code" character varying, "p_center_code" character varying, "p_lat" double precision, "p_lon" double precision, "p_ad_space_id" character varying, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_mnty_targeted_advertisements"("p_country_code" character varying, "p_governorate_code" character varying, "p_center_code" character varying, "p_lat" double precision, "p_lon" double precision, "p_ad_space_id" character varying, "p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_or_create_business_referral_profile"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_or_create_business_referral_profile"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_or_create_my_referral_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_or_create_my_referral_profile"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_indrive_server_fields"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."initialize_opening_stock_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_warehouse_id" character varying, "p_product_id" "uuid", "p_quantity" numeric, "p_unit_cost" numeric, "p_reference_id" character varying) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."is_platform_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."legal_assert_action"("p_user_id" "uuid", "p_action_key" "text", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."legal_assert_action"("p_user_id" "uuid", "p_action_key" "text", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."legal_audit_bridge"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."legal_check_action"("p_action_key" "text", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."legal_check_action"("p_action_key" "text", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."legal_effective_version"("p_document_type" "text", "p_audience" "text", "p_business_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."legal_gate_business_activation"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."legal_gate_commission_insert"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."legal_gate_employee_activation"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."legal_gate_order_insert"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."legal_gate_referral_insert"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."legal_is_admin"("p_user_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."legal_publish_version"("p_actor_user_id" "uuid", "p_document_id" "uuid", "p_version_number" integer, "p_effective_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."legal_publish_version"("p_actor_user_id" "uuid", "p_document_id" "uuid", "p_version_number" integer, "p_effective_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."legal_suspend_document"("p_actor_user_id" "uuid", "p_document_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."legal_suspend_document"("p_actor_user_id" "uuid", "p_document_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."legal_update_document"("p_actor_user_id" "uuid", "p_document_id" "uuid", "p_title" "text", "p_target_audience" "text"[], "p_required_consent" boolean, "p_requires_reconsent" boolean, "p_sector_codes" "text"[], "p_locale" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."legal_update_document"("p_actor_user_id" "uuid", "p_document_id" "uuid", "p_title" "text", "p_target_audience" "text"[], "p_required_consent" boolean, "p_requires_reconsent" boolean, "p_sector_codes" "text"[], "p_locale" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."legal_update_draft_version"("p_actor_user_id" "uuid", "p_version_id" "uuid", "p_content" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."legal_update_draft_version"("p_actor_user_id" "uuid", "p_version_id" "uuid", "p_content" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_mantigo_captain_rides_backend"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_mantigo_captain_rides_backend"("p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."list_mantigo_customer_rides_backend"("p_user_id" "uuid", "p_ride_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_mantigo_customer_rides_backend"("p_user_id" "uuid", "p_ride_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."list_open_mantigo_rides_backend"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_open_mantigo_rides_backend"("p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."lock_mantigo_fare_backend"("p_user_id" "uuid", "p_ride_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lock_mantigo_fare_backend"("p_user_id" "uuid", "p_ride_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."mantigo_accept_bid"("p_ride_id" "text", "p_bid_id" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."mantigo_cancel_ride"("p_ride_id" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."mantigo_create_ride"("p_vehicle_category" "text", "p_ride_type" "text", "p_pickup_location" "text", "p_destination_location" "text", "p_proposed_price" numeric, "p_note" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."mantigo_guard_bid_rate_limit"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."mantigo_guard_ride_rate_limit"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."mantigo_mutate"("p_action" "text", "p_payload" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."mantigo_rate_limit_check"("p_action" "text", "p_actor" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."mantigo_rate_ride"("p_ride_id" "text", "p_rating" integer, "p_comment" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mantigo_rate_ride"("p_ride_id" "text", "p_rating" integer, "p_comment" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."mantigo_submit_bid"("p_ride_id" "text", "p_offered_price" numeric, "p_captain_name" "text", "p_vehicle_category" "text", "p_vehicle_model" "text", "p_captain_message" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."mantigo_update_proposed_price"("p_ride_id" "text", "p_new_price" numeric) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."mark_notifications_read_backend"("p_notification_id" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_notifications_read_backend"("p_notification_id" character varying) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."match_mantigo_ride_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."match_mantigo_ride_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."mnty_active_membership"("p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mnty_active_membership"("p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."mnty_can"("p_permission" "text", "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mnty_can"("p_permission" "text", "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."mnty_can_platform_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mnty_can_platform_admin"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."mnty_push_notification_hook"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."payment_financial_reconciliation_check"("p_tenant_id" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."payment_financial_reconciliation_check"("p_tenant_id" character varying) TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_financial_journal"("p_entry" "jsonb", "p_lines" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."post_financial_journal_backend"("p_user_id" "uuid", "p_entry" "jsonb", "p_lines" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."prevent_legal_mutation"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."prevent_order_financial_mutation_after_payment"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."prevent_published_legal_version_mutation"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."prevent_support_ticket_security_field_changes"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."preview_commission_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_module_id" character varying, "p_gross_amount" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."preview_commission_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_module_id" character varying, "p_gross_amount" numeric) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."process_verified_digital_page_payment_backend"("p_order_id" "uuid", "p_external_event_id" "text", "p_event_type" "text", "p_status" "text", "p_signature_verified" boolean, "p_amount" numeric, "p_currency" "text", "p_provider_transaction_id" "text", "p_provider_order_id" "text", "p_raw_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_verified_digital_page_payment_backend"("p_order_id" "uuid", "p_external_event_id" "text", "p_event_type" "text", "p_status" "text", "p_signature_verified" boolean, "p_amount" numeric, "p_currency" "text", "p_provider_transaction_id" "text", "p_provider_order_id" "text", "p_raw_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."process_verified_provider_payment"("p_event_id" character varying, "p_tenant_id" character varying, "p_provider" character varying, "p_external_event_id" character varying, "p_payment_intent_id" character varying, "p_event_type" character varying, "p_signature_verified" boolean, "p_provider_confirmed_amount" numeric, "p_provider_confirmed_currency" character varying, "p_platform_received_amount" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_verified_provider_payment"("p_event_id" character varying, "p_tenant_id" character varying, "p_provider" character varying, "p_external_event_id" character varying, "p_payment_intent_id" character varying, "p_event_type" character varying, "p_signature_verified" boolean, "p_provider_confirmed_amount" numeric, "p_provider_confirmed_currency" character varying, "p_platform_received_amount" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."process_verified_subscription_payment"("p_event_id" "text", "p_external_event_id" "text", "p_subscription_payment_intent_id" "uuid", "p_provider_transaction_id" "text", "p_provider_confirmed_amount" numeric, "p_provider_confirmed_currency" "text", "p_signature_verified" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_verified_subscription_payment"("p_event_id" "text", "p_external_event_id" "text", "p_subscription_payment_intent_id" "uuid", "p_provider_transaction_id" "text", "p_provider_confirmed_amount" numeric, "p_provider_confirmed_currency" "text", "p_signature_verified" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."receive_purchase_stock_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_purchase_order_id" character varying, "p_receipt_number" character varying, "p_warehouse_id" character varying, "p_product_id" "uuid", "p_received_quantity" numeric, "p_unit_cost" numeric) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."receive_stock_transfer_backend"("p_transfer_id" character varying) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."record_cash_commission_due"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_provider_id" character varying, "p_gross_amount" numeric, "p_commission_amount" numeric, "p_currency" character varying) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."record_legal_consent"("p_document_id" "uuid", "p_document_version_id" "uuid", "p_account_type" "text", "p_agreement_id" "uuid", "p_ip_address" "text", "p_user_agent" "text", "p_device_info" "jsonb", "p_session_id" "text", "p_source" "text", "p_consent_status" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."record_legal_consent_backend"("p_user_id" "uuid", "p_document_id" "uuid", "p_document_version_id" "uuid", "p_account_type" "text", "p_agreement_id" "uuid", "p_ip_address" "text", "p_user_agent" "text", "p_device_info" "jsonb", "p_session_id" "text", "p_source" "text", "p_consent_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_legal_consent_backend"("p_user_id" "uuid", "p_document_id" "uuid", "p_document_version_id" "uuid", "p_account_type" "text", "p_agreement_id" "uuid", "p_ip_address" "text", "p_user_agent" "text", "p_device_info" "jsonb", "p_session_id" "text", "p_source" "text", "p_consent_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_refund_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_payment_intent_id" character varying, "p_customer_wallet_id" character varying, "p_original_amount" numeric, "p_refund_amount" numeric, "p_reason" "text", "p_idempotency_key" character varying, "p_journal_entry" "jsonb", "p_journal_lines" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_refund_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_payment_intent_id" character varying, "p_customer_wallet_id" character varying, "p_original_amount" numeric, "p_refund_amount" numeric, "p_reason" "text", "p_idempotency_key" character varying, "p_journal_entry" "jsonb", "p_journal_lines" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reject_indrive_bid"("p_request_id" "uuid", "p_bid_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_indrive_bid"("p_request_id" "uuid", "p_bid_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."release_digital_page_payment_intent_claim_backend"("p_order_id" "uuid", "p_user_id" "uuid", "p_claim_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."release_digital_page_payment_intent_claim_backend"("p_order_id" "uuid", "p_user_id" "uuid", "p_claim_token" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."resolve_commission_rule_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_module_id" character varying) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."resolve_legacy_scope"("p_branch_id" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."resolve_platform_feature"("p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_module_code" character varying, "p_feature_code" character varying, "p_sector_id" character varying) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."restaurant_erp_mutate"("p_action" "text", "p_payload" "jsonb", "p_idempotency_key" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."restaurant_table_mutate"("p_action" "text", "p_payload" "jsonb", "p_idempotency_key" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."reverse_journal_entry"("p_original_entry_id" character varying, "p_reason" "text", "p_reversed_by" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverse_journal_entry"("p_original_entry_id" character varying, "p_reason" "text", "p_reversed_by" character varying) TO "service_role";



REVOKE ALL ON FUNCTION "public"."review_mantigo_captain_application"("p_admin_user_id" "uuid", "p_captain_id" "uuid", "p_decision" "text", "p_vehicle_category" "text", "p_vehicle_model" "text", "p_vehicle_plate" "text", "p_service_areas" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_mantigo_captain_application"("p_admin_user_id" "uuid", "p_captain_id" "uuid", "p_decision" "text", "p_vehicle_category" "text", "p_vehicle_model" "text", "p_vehicle_plate" "text", "p_service_areas" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_mantigo_financial_config_backend"("p_admin_user_id" "uuid", "p_commission_rate" numeric, "p_currency" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_mantigo_financial_config_backend"("p_admin_user_id" "uuid", "p_commission_rate" numeric, "p_currency" "text") TO "authenticated";



GRANT MAINTAIN ON TABLE "public"."platform_feature_flags" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."platform_feature_flags" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."platform_feature_flags" TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_platform_feature_flag_backend"("p_scope_type" character varying, "p_scope_id" character varying, "p_sector_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_module_code" character varying, "p_feature_code" character varying, "p_enabled" boolean, "p_configuration" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."settle_mantigo_captain_backend"("p_admin_user_id" "uuid", "p_ride_id" "text", "p_channel" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."settle_mantigo_captain_backend"("p_admin_user_id" "uuid", "p_ride_id" "text", "p_channel" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."smm_admin_credit_wallet"("p_actor" "uuid", "p_user" "uuid", "p_amount" numeric, "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."smm_admin_credit_wallet"("p_actor" "uuid", "p_user" "uuid", "p_amount" numeric, "p_description" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."smm_bootstrap_first_admin"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."smm_debit_wallet"("p_user" "uuid", "p_amount" numeric, "p_reference" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."smm_debit_wallet"("p_user" "uuid", "p_amount" numeric, "p_reference" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."smm_get_provider_secret"("p_provider_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."smm_get_provider_secret"("p_provider_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."smm_refund_wallet"("p_user" "uuid", "p_amount" numeric, "p_reference" "uuid", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."smm_refund_wallet"("p_user" "uuid", "p_amount" numeric, "p_reference" "uuid", "p_description" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."smm_set_provider_secret"("p_provider_id" "uuid", "p_actor_user_id" "uuid", "p_secret" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."smm_set_provider_secret"("p_provider_id" "uuid", "p_actor_user_id" "uuid", "p_secret" "text") TO "service_role";



GRANT MAINTAIN ON TABLE "public"."business_subscriptions" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."business_subscriptions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."business_subscriptions" TO "service_role";



REVOKE ALL ON FUNCTION "public"."start_business_trial_backend"("p_business_id" "uuid", "p_tier_code" "text", "p_sector" "text", "p_trial_days" integer, "p_idempotency_key" "text", "p_actor_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_business_trial_backend"("p_business_id" "uuid", "p_tier_code" "text", "p_sector" "text", "p_trial_days" integer, "p_idempotency_key" "text", "p_actor_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_job_application_backend"("p_user_id" "uuid", "p_job_id" "uuid", "p_applicant_name" "text", "p_applicant_phone" "text", "p_qualifications" "text", "p_cv_summary_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_job_application_backend"("p_user_id" "uuid", "p_job_id" "uuid", "p_applicant_name" "text", "p_applicant_phone" "text", "p_qualifications" "text", "p_cv_summary_text" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."submit_mantigo_captain_application"("p_user_id" "uuid", "p_vehicle_category" "text", "p_vehicle_model" "text", "p_vehicle_plate" "text", "p_service_areas" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_mantigo_captain_application"("p_user_id" "uuid", "p_vehicle_category" "text", "p_vehicle_model" "text", "p_vehicle_plate" "text", "p_service_areas" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."track_business_referral_event"("p_code" character varying, "p_event_type" character varying, "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."track_business_referral_event"("p_code" character varying, "p_event_type" character varying, "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_enforce_journal_entry_immutability"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_enforce_journal_entry_immutability"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_enforce_journal_line_immutability"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_enforce_journal_line_immutability"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_enforce_wallet_balance_integrity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_enforce_wallet_balance_integrity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_post_journal_to_general_ledger"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_post_journal_to_general_ledger"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_validate_journal_entry_balance"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_validate_journal_entry_balance"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_mantigo_captain_presence_backend"("p_user_id" "uuid", "p_availability_status" "text", "p_current_lat" double precision, "p_current_lon" double precision) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_mantigo_captain_presence_backend"("p_user_id" "uuid", "p_availability_status" "text", "p_current_lat" double precision, "p_current_lon" double precision) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_mantigo_trip_status_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_target_status" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_mantigo_trip_status_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_target_status" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_medical_appointment_status_backend"("p_user_id" "uuid", "p_appointment_id" "text", "p_target_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_medical_appointment_status_backend"("p_user_id" "uuid", "p_appointment_id" "text", "p_target_status" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_order_status_backend"("p_order_id" "uuid", "p_tenant_id" character varying, "p_user_id" "uuid", "p_new_status" character varying, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_order_status_backend"("p_order_id" "uuid", "p_tenant_id" character varying, "p_user_id" "uuid", "p_new_status" character varying, "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_purchase_order_status_backend"("p_order_id" character varying, "p_target_status" character varying) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."update_stock_transfer_status_backend"("p_transfer_id" character varying, "p_target_status" character varying) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."update_support_ticket_status_backend"("p_ticket_id" character varying, "p_status" character varying, "p_assigned_user_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."upsert_catalog_item_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_legacy_ref" character varying, "p_item_type" character varying, "p_name_ar" "text", "p_name_en" "text", "p_description" "text", "p_sku" character varying, "p_tax_rate" numeric, "p_metadata" "jsonb", "p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_catalog_item_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_legacy_ref" character varying, "p_item_type" character varying, "p_name_ar" "text", "p_name_en" "text", "p_description" "text", "p_sku" character varying, "p_tax_rate" numeric, "p_metadata" "jsonb", "p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_catalog_price_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_catalog_item_id" "uuid", "p_branch_id" character varying, "p_currency" character varying, "p_unit_price" numeric, "p_effective_from" timestamp with time zone, "p_effective_to" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_catalog_price_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_catalog_item_id" "uuid", "p_branch_id" character varying, "p_currency" character varying, "p_unit_price" numeric, "p_effective_from" timestamp with time zone, "p_effective_to" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_catalog_settings_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_currency" character varying, "p_delivery_fee" numeric, "p_tax_inclusive" boolean, "p_allow_discounts" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_catalog_settings_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_currency" character varying, "p_delivery_fee" numeric, "p_tax_inclusive" boolean, "p_allow_discounts" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_mnty_push_subscription"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text", "p_platform" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_mnty_push_subscription"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text", "p_platform" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."validate_journal_entry_balance"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_journal_entry_balance"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_mantigo_ride_acceptance_integrity"() FROM PUBLIC;


















GRANT ALL ON TABLE "private"."platform_admins" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."account_registration_requests" TO "anon";
GRANT SELECT,INSERT,MAINTAIN ON TABLE "public"."account_registration_requests" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."account_registration_requests" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."ad_spaces" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."ad_spaces" TO "authenticated";
GRANT ALL ON TABLE "public"."ad_spaces" TO "service_role";



GRANT ALL ON TABLE "public"."advertisement_target_locations" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."advertisements" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."advertisements" TO "authenticated";
GRANT ALL ON TABLE "public"."advertisements" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."agreement_participants" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."agreement_participants" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."agreement_participants" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."agreements" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."agreements" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."agreements" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."approval_actions" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."approval_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_actions" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."approval_requests" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."approval_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_requests" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."tenant_payment_methods" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."tenant_payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_payment_methods" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."user_memberships" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."user_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."user_memberships" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."available_payment_methods" TO "anon";
GRANT MAINTAIN ON TABLE "public"."available_payment_methods" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."available_payment_methods" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."bookings" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."branches" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."business_categories" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."business_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."business_categories" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."business_modules" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."business_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."business_modules" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."business_referral_codes" TO "anon";
GRANT MAINTAIN ON TABLE "public"."business_referral_codes" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."business_referral_codes" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."business_referral_events" TO "anon";
GRANT MAINTAIN ON TABLE "public"."business_referral_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."business_referral_events" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."business_sectors" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."business_sectors" TO "authenticated";
GRANT ALL ON TABLE "public"."business_sectors" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."businesses" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."businesses" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."catalog_business_settings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."catalog_business_settings" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."catalog_item_options" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."catalog_item_options" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."catalog_item_prices" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."catalog_item_prices" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."catalog_items" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."catalog_items" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."chart_of_accounts" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."chart_of_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."chart_of_accounts" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."commission_rules" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."commission_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."commission_rules" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."commission_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."commission_transactions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."consent_audit_log" TO "service_role";
GRANT SELECT ON TABLE "public"."consent_audit_log" TO "authenticated";



GRANT MAINTAIN ON TABLE "public"."credit_accounts" TO "anon";
GRANT MAINTAIN ON TABLE "public"."credit_accounts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."credit_accounts" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."credit_periods" TO "anon";
GRANT MAINTAIN ON TABLE "public"."credit_periods" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."credit_periods" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."credit_policies" TO "anon";
GRANT MAINTAIN ON TABLE "public"."credit_policies" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."credit_policies" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."departments" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."digital_page_orders" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."digital_page_orders" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."digital_page_payment_events" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."digital_page_products" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."digital_page_products" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."digital_page_products" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."digital_page_sections" TO "service_role";
GRANT SELECT ON TABLE "public"."digital_page_sections" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."digital_page_sections" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."digital_pages" TO "service_role";
GRANT SELECT ON TABLE "public"."digital_pages" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."digital_pages" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."erp_purchase_orders" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."erp_purchase_receipts" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."erp_stock_transfers" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."fashion_orders" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."fashion_orders" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."fashion_orders" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."fashion_products" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."fashion_products" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."fashion_products" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."fashion_tailor_services" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."fashion_tailor_services" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."fashion_tailor_services" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."financial_obligations" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."financial_obligations" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."general_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."general_ledger" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."inventory_transactions" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."inventory_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."job_applications" TO "anon";
GRANT MAINTAIN ON TABLE "public"."job_applications" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."job_applications" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."jobs" TO "anon";
GRANT MAINTAIN ON TABLE "public"."jobs" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."jobs" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entries" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."journal_entry_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entry_lines" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."legacy_module_idempotency" TO "anon";
GRANT MAINTAIN ON TABLE "public"."legacy_module_idempotency" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."legacy_module_idempotency" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."legal_document_versions" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."legal_document_versions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."legal_document_versions" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."legal_documents" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."legal_documents" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."legal_documents" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."legal_requirements" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."legal_requirements" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."legal_requirements" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."mantigo_bids" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."mantigo_bids" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mantigo_bids" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mantigo_captain_profiles" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mantigo_captain_profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mantigo_captain_profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mantigo_financial_config" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mantigo_financial_ledger" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mantigo_financial_ledger" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mantigo_financial_ledger" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mantigo_rate_limit_config" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."mantigo_ride_ratings" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."mantigo_ride_ratings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mantigo_ride_ratings" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."mantigo_rides" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."mantigo_rides" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mantigo_rides" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."marketing_commission_rules" TO "anon";
GRANT MAINTAIN ON TABLE "public"."marketing_commission_rules" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketing_commission_rules" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."marketing_leads" TO "anon";
GRANT SELECT,INSERT,MAINTAIN ON TABLE "public"."marketing_leads" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketing_leads" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."marketing_plans" TO "anon";
GRANT MAINTAIN ON TABLE "public"."marketing_plans" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketing_plans" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."marketing_project_participants" TO "anon";
GRANT MAINTAIN ON TABLE "public"."marketing_project_participants" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketing_project_participants" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."marketing_projects" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."marketing_projects" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketing_projects" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."marketing_provider_profiles" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."marketing_provider_profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketing_provider_profiles" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."marketing_provider_services" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."marketing_provider_services" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketing_provider_services" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."marketing_provider_subscriptions" TO "anon";
GRANT MAINTAIN ON TABLE "public"."marketing_provider_subscriptions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketing_provider_subscriptions" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."marketing_services" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."marketing_services" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketing_services" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."matrimony_contact_unlocks" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."matrimony_contact_unlocks" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."matrimony_contact_unlocks" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."matrimony_profiles" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."matrimony_profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."matrimony_profiles" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."matrimony_requests" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."matrimony_requests" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."matrimony_requests" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."medical_appointments" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."medical_appointments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."medical_appointments" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."modules" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."modules" TO "authenticated";
GRANT ALL ON TABLE "public"."modules" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."order_status_history" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."order_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."order_status_history" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."orders" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."orders" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."organizations" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."payment_events" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."payment_financial_reconciliations" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."payment_financial_reconciliations" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payment_financial_reconciliations" TO "service_role";



GRANT ALL ON TABLE "public"."payment_intents" TO "service_role";
GRANT SELECT ON TABLE "public"."payment_intents" TO "authenticated";



GRANT SELECT,MAINTAIN ON TABLE "public"."payment_provider_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payment_provider_events" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."payout_destinations" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payout_destinations" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."platform_brand_assets" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."platform_brand_assets" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."platform_brand_assets" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."platform_brand_identity" TO "anon";
GRANT MAINTAIN ON TABLE "public"."platform_brand_identity" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."platform_brand_identity" TO "service_role";



GRANT ALL ON TABLE "public"."platform_geo_areas" TO "service_role";
GRANT SELECT ON TABLE "public"."platform_geo_areas" TO "anon";
GRANT SELECT ON TABLE "public"."platform_geo_areas" TO "authenticated";



GRANT ALL ON TABLE "public"."platform_global_advertisements" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."provider_onboarding_requests" TO "service_role";
GRANT SELECT ON TABLE "public"."provider_onboarding_requests" TO "authenticated";



GRANT MAINTAIN ON TABLE "public"."referral_codes" TO "anon";
GRANT MAINTAIN ON TABLE "public"."referral_codes" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."referral_codes" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."referral_events" TO "anon";
GRANT MAINTAIN ON TABLE "public"."referral_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."referral_events" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."refund_transactions" TO "anon";
GRANT MAINTAIN ON TABLE "public"."refund_transactions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."refund_transactions" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."restaurant_inventory" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."restaurant_inventory" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."restaurant_inventory" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."restaurant_menu_items" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."restaurant_menu_items" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."restaurant_menu_items" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."restaurant_orders" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."restaurant_orders" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."restaurant_orders" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."restaurant_tables" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."restaurant_tables" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."restaurant_tables" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."school_profiles" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."school_profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."school_profiles" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."settlement_attempts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."settlement_attempts" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."settlement_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."settlement_transactions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."smm_admins" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."smm_order_events" TO "anon";
GRANT MAINTAIN ON TABLE "public"."smm_order_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."smm_order_events" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."smm_orders" TO "anon";
GRANT MAINTAIN ON TABLE "public"."smm_orders" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."smm_orders" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."smm_provider_credentials" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."smm_providers" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."smm_services" TO "anon";
GRANT MAINTAIN ON TABLE "public"."smm_services" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."smm_services" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."smm_wallet_transactions" TO "anon";
GRANT MAINTAIN ON TABLE "public"."smm_wallet_transactions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."smm_wallet_transactions" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."smm_wallets" TO "anon";
GRANT MAINTAIN ON TABLE "public"."smm_wallets" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."smm_wallets" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."stock_balances" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."stock_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_balances" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."subscription_tier_prices" TO "service_role";
GRANT SELECT ON TABLE "public"."subscription_tier_prices" TO "authenticated";



GRANT MAINTAIN ON TABLE "public"."sync_logs" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."sync_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_logs" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."teacher_profiles" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."teacher_profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."teacher_profiles" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."tenant_modules" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."tenant_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_modules" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."tenants" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."used_item_ads" TO "anon";
GRANT MAINTAIN ON TABLE "public"."used_item_ads" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."used_item_ads" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."used_item_category_fees" TO "anon";
GRANT MAINTAIN ON TABLE "public"."used_item_category_fees" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."used_item_category_fees" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_consents" TO "service_role";
GRANT SELECT ON TABLE "public"."user_consents" TO "authenticated";



GRANT MAINTAIN ON TABLE "public"."user_profile_media" TO "anon";
GRANT MAINTAIN ON TABLE "public"."user_profile_media" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_profile_media" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."wallet_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_accounts" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."wallet_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."warehouses" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."warehouses" TO "authenticated";
GRANT ALL ON TABLE "public"."warehouses" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";































