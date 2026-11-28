BEGIN;

-- DEMO-only coordinated platform-root convergence.

-- Replays the reviewed RC464/RC469/RC471/RC484/RC485 contracts against the DEMO schema.

-- RC472 contributes only the null-safe membership index because directory claim tables are absent in DEMO.

-- Source files remain unchanged; this forward migration is scoped to MantiqatiX-DEMO.


-- RC464: one forward-only correction for the live platform-root authorization drift.
-- The protected private.platform_admins registry is canonical (RC113/RC115).
-- Replaces the current weak null-scope helper and the four live MantiGO global RPCs.
-- This migration is intentionally additive/forward-only; historical RC441/RC449/RC462 files remain unchanged.


DO $preflight$
DECLARE
  v_rls boolean;
  v_registry_owner oid;
  v_guard_owner oid;
  v_rpc_count integer;
  v_helper_caller_count integer;
BEGIN
  IF pg_catalog.to_regclass('private.platform_admins') IS NULL THEN
    RAISE EXCEPTION 'RC464_PLATFORM_ADMIN_REGISTRY_MISSING';
  END IF;

  SELECT c.relrowsecurity, c.relowner
    INTO v_rls, v_registry_owner
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'private' AND c.relname = 'platform_admins';

  IF NOT coalesce(v_rls, false) THEN
    RAISE EXCEPTION 'RC464_PLATFORM_ADMIN_REGISTRY_RLS_REQUIRED';
  END IF;

  IF pg_catalog.has_table_privilege('anon', 'private.platform_admins', 'SELECT')
     OR pg_catalog.has_table_privilege('anon', 'private.platform_admins', 'INSERT')
     OR pg_catalog.has_table_privilege('anon', 'private.platform_admins', 'UPDATE')
     OR pg_catalog.has_table_privilege('anon', 'private.platform_admins', 'DELETE')
     OR pg_catalog.has_table_privilege('authenticated', 'private.platform_admins', 'SELECT')
     OR pg_catalog.has_table_privilege('authenticated', 'private.platform_admins', 'INSERT')
     OR pg_catalog.has_table_privilege('authenticated', 'private.platform_admins', 'UPDATE')
     OR pg_catalog.has_table_privilege('authenticated', 'private.platform_admins', 'DELETE') THEN
    RAISE EXCEPTION 'RC464_PLATFORM_ADMIN_REGISTRY_CLIENT_TABLE_GRANT_FOUND';
  END IF;

  IF pg_catalog.to_regprocedure('public.mnty_can_platform_admin()') IS NULL THEN
    RAISE EXCEPTION 'RC464_PLATFORM_ADMIN_GUARD_MISSING';
  END IF;

  SELECT p.proowner INTO v_guard_owner
  FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure('public.mnty_can_platform_admin()');

  IF v_guard_owner IS DISTINCT FROM v_registry_owner
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_roles r
       WHERE r.oid = v_guard_owner AND r.rolbypassrls
     ) THEN
    RAISE EXCEPTION 'RC464_REGISTRY_GUARD_OWNER_MUST_MATCH_BYPASS_RLS_TABLE_OWNER';
  END IF;

  SELECT count(*) INTO v_rpc_count
  FROM pg_catalog.pg_proc p
  WHERE p.oid IN (
    pg_catalog.to_regprocedure('public.get_mantigo_admin_dashboard_backend(uuid)'),
    pg_catalog.to_regprocedure('public.get_mantigo_admin_financial_report_backend(uuid,timestamp with time zone,timestamp with time zone)'),
    pg_catalog.to_regprocedure('public.settle_mantigo_captain_backend(uuid,text,text)'),
    pg_catalog.to_regprocedure('public.expire_stale_mantigo_rides_backend(uuid,integer)')
  )
  AND p.prosecdef;

  IF v_rpc_count <> 4 THEN
    RAISE EXCEPTION 'RC464_EXPECTS_FOUR_EXISTING_GLOBAL_MANTIGO_RPCS: found %', v_rpc_count;
  END IF;

  -- These four additional platform-wide SECURITY DEFINER entrypoints already
  -- route through the shared helper. The canonical replacement hardens them too.
  SELECT count(*) INTO v_helper_caller_count
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (
      (p.proname = 'admin_create_global_ad'
       AND p.proargtypes = '1043 25 25 1184 1184'::oidvector)
      OR (p.proname = 'fulfill_digital_page_publish'
       AND p.proargtypes = '2950 2950 2950'::oidvector)
      OR (p.proname = 'review_mantigo_captain_application'
       AND p.proargtypes = '2950 2950 25 25 25 25 3802'::oidvector)
      OR (p.proname = 'set_mantigo_financial_config_backend'
       AND p.proargtypes = '2950 1700 25'::oidvector)
    )
    AND p.prosrc ILIKE '%mnty_can_platform_admin%';

  IF v_helper_caller_count <> 4 THEN
    RAISE EXCEPTION 'RC464_EXPECTS_FOUR_OTHER_SHARED_GUARD_CALLERS: found %', v_helper_caller_count;
  END IF;

  -- Confirm the global digital-page and MantiGO configuration RLS policies
  -- use the same shared gate, so the replacement protects both RPC and RLS paths.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'digital_pages'
      AND policyname = 'digital_pages_admin_manage'
      AND cmd = 'ALL'
      AND coalesce(qual, '') ILIKE '%mnty_can_platform_admin%'
      AND coalesce(with_check, '') ILIKE '%mnty_can_platform_admin%'
  ) THEN
    RAISE EXCEPTION 'RC464_DIGITAL_PAGES_PLATFORM_RLS_POLICY_DRIFT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mantigo_financial_config'
      AND policyname = 'mantigo_financial_config_admin_update'
      AND cmd = 'UPDATE'
      AND coalesce(qual, '') ILIKE '%mnty_can_platform_admin%'
      AND coalesce(with_check, '') ILIKE '%mnty_can_platform_admin%'
  ) THEN
    RAISE EXCEPTION 'RC464_MANTIGO_FINANCIAL_CONFIG_POLICY_DRIFT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mantigo_rate_limit_config'
      AND policyname = 'mantigo_rate_limit_config_admin_update'
      AND cmd = 'UPDATE'
      AND coalesce(qual, '') ILIKE '%mnty_can_platform_admin%'
      AND coalesce(with_check, '') ILIKE '%mnty_can_platform_admin%'
  ) THEN
    RAISE EXCEPTION 'RC464_MANTIGO_RATE_LIMIT_POLICY_DRIFT';
  END IF;
END;
$preflight$;

-- Match the hardened registry posture in every environment. The owner is postgres,
-- while API client roles have no direct table privileges; FORCE RLS protects any
-- non-owner path that may be added later without changing the canonical read contract.
ALTER TABLE private.platform_admins FORCE ROW LEVEL SECURITY;

-- Canonical platform-root authority: private.platform_admins only.
-- SECURITY DEFINER permits the function owner to consult the FORCE-RLS registry;
-- client roles receive EXECUTE on the guard but no direct registry table access.
CREATE OR REPLACE FUNCTION public.mnty_can_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM private.platform_admins pa
    WHERE pa.user_id = auth.uid()
  )
$function$;

REVOKE ALL ON FUNCTION public.mnty_can_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mnty_can_platform_admin() TO authenticated;

COMMENT ON FUNCTION public.mnty_can_platform_admin() IS
  'RC464: canonical platform-root guard backed only by private.platform_admins (RC113/RC115); tenant membership or tenant OWNER/ADMIN roles do not imply platform authority.';

create or replace function public.get_mantigo_admin_dashboard_backend(p_admin_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null or p_admin_user_id is null or v_user <> p_admin_user_id then
    raise exception 'USER_CONTEXT_MISMATCH';
  end if;
  if not public.mnty_can_platform_admin() then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;

  select pg_catalog.jsonb_build_object(
    'rides_total', count(*),
    'open_requests', count(*) filter (where r.status in ('OPEN','OPEN_FOR_BIDS','MATCHING')),
    'accepted', count(*) filter (where r.status='ACCEPTED'),
    'arrived', count(*) filter (where r.status='ARRIVED'),
    'started', count(*) filter (where r.status='STARTED'),
    'in_progress', count(*) filter (where r.status='IN_PROGRESS'),
    'completed', count(*) filter (where r.status='COMPLETED'),
    'cancelled', count(*) filter (where r.status='CANCELLED'),
    'failed', count(*) filter (where r.status='FAILED'),
    'show_no', count(*) filter (where r.status='SHOW_NO'),
    'expired', count(*) filter (where r.status='EXPIRED'),
    'revenue', coalesce((select sum(l.gross_amount) from public.mantigo_financial_ledger l),0),
    'commission', coalesce((select sum(l.commission_amount) from public.mantigo_financial_ledger l),0),
    'captain_earnings', coalesce((select sum(l.captain_net_amount) from public.mantigo_financial_ledger l),0),
    'paid', coalesce((select sum(l.gross_amount) from public.mantigo_financial_ledger l where l.payment_status in ('PAID','CASH_CONFIRMED')),0),
    'unsettled', coalesce((select sum(l.captain_net_amount) from public.mantigo_financial_ledger l where l.settlement_status in ('READY','HELD')),0)
  ) into v_result
  from public.mantigo_rides r;
  return v_result;
end
$function$;

create or replace function public.get_mantigo_admin_financial_report_backend(
  p_admin_user_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth uuid := auth.uid();
  v_from timestamptz := coalesce(p_from, 'epoch'::timestamptz);
  v_to timestamptz := coalesce(p_to, 'infinity'::timestamptz);
  v_ledger jsonb;
begin
  if v_auth is null or v_auth <> p_admin_user_id then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not public.mnty_can_platform_admin() then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;

  select pg_catalog.jsonb_build_object(
    'ledger_count', count(*),
    'gross', coalesce(sum(l.gross_amount),0),
    'commission', coalesce(sum(l.commission_amount),0),
    'captain_amount', coalesce(sum(l.captain_net_amount),0),
    'paid_count', count(*) filter (where l.payment_status in ('PAID','CASH_CONFIRMED')),
    'paid_amount', coalesce(sum(l.gross_amount) filter (where l.payment_status in ('PAID','CASH_CONFIRMED')),0),
    'settled_count', count(*) filter (where l.settlement_status='SETTLED'),
    'settled_amount', coalesce(sum(l.captain_net_amount) filter (where l.settlement_status='SETTLED'),0),
    'unsettled_count', count(*) filter (where l.settlement_status is distinct from 'SETTLED'),
    'unsettled_amount', coalesce(sum(l.captain_net_amount) filter (where l.settlement_status is distinct from 'SETTLED'),0),
    'from', v_from, 'to', v_to
  ) into v_ledger
  from public.mantigo_financial_ledger l
  where l.created_at >= v_from and l.created_at < v_to;
  return v_ledger;
end
$function$;

create or replace function public.settle_mantigo_captain_backend(
  p_admin_user_id uuid,
  p_ride_id text,
  p_channel text default 'BANK_TRANSFER'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_f public.mantigo_financial_ledger%rowtype;
  v_ride_status text;
  v_result jsonb;
begin
  if p_admin_user_id is null or p_admin_user_id <> auth.uid() then
    raise exception 'USER_CONTEXT_MISMATCH';
  end if;
  if not public.mnty_can_platform_admin() then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;

  select r.status into v_ride_status
  from public.mantigo_rides r
  where r.id = p_ride_id;
  if v_ride_status is null then raise exception 'RIDE_NOT_FOUND'; end if;
  if v_ride_status <> 'COMPLETED' then raise exception 'RIDE_NOT_COMPLETED'; end if;

  select * into v_f
  from public.mantigo_financial_ledger l
  where l.ride_id = p_ride_id
  for update;
  if not found then raise exception 'FINANCIAL_RECORD_NOT_FOUND'; end if;
  if v_f.payment_status not in ('PAID','CASH_CONFIRMED') then raise exception 'PAYMENT_NOT_CONFIRMED'; end if;
  if v_f.settlement_status = 'SETTLED' then
    return pg_catalog.jsonb_build_object('ride_id',p_ride_id,'settlement_status','SETTLED','settlement_reference',v_f.settlement_reference,'idempotent',true);
  end if;
  if v_f.commission_rate is null then raise exception 'COMMISSION_NOT_LOCKED'; end if;

  v_result := public.create_settlement_and_post_journal(
    'MGO-SET-'||p_ride_id,'MNTY-PLATFORM','PARTNER',v_f.captain_id::text,
    v_f.gross_amount,v_f.commission_amount,v_f.captain_net_amount,0,
    coalesce(nullif(pg_catalog.btrim(p_channel),''),'BANK_TRANSFER'),p_ride_id,null,
    'MantiGO captain settlement for ride '||p_ride_id,p_admin_user_id
  );
  update public.mantigo_financial_ledger
  set settlement_status='SETTLED',settlement_reference='MGO-SET-'||p_ride_id,updated_at=pg_catalog.now()
  where ride_id=p_ride_id;

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,
    'MANTIGO_CAPTAIN_SETTLED','MANTIGO_FINANCIAL',v_f.id,
    pg_catalog.jsonb_build_object('settlement_status',v_f.settlement_status),
    pg_catalog.jsonb_build_object('settlement_status','SETTLED','settlement_reference','MGO-SET-'||p_ride_id,'provider_result',v_result),'SUCCESS');
  begin
    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_f.captain_id,
      'MANTIGO_SETTLEMENT','تمت التسوية','تمت تسوية مستحقاتك عن رحلة MantiGO بنجاح.','MANTIGO_RIDE',p_ride_id);
  exception when others then
    insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
    values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,
      'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,
      pg_catalog.jsonb_build_object('notification_type','MANTIGO_SETTLEMENT','error',sqlerrm),'PARTIAL');
  end;
  return pg_catalog.jsonb_build_object('ride_id',p_ride_id,'settlement_status','SETTLED',
    'settlement_reference','MGO-SET-'||p_ride_id,'provider_result',v_result,'idempotent',false);
end
$function$;

create or replace function public.expire_stale_mantigo_rides_backend(
  p_admin_user_id uuid,
  p_age_minutes integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer := 0;
  v_ride record;
begin
  if p_admin_user_id is null or p_admin_user_id <> auth.uid() then
    raise exception 'USER_CONTEXT_MISMATCH';
  end if;
  if not public.mnty_can_platform_admin() then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;
  if p_age_minutes is null or p_age_minutes < 1 or p_age_minutes > 10080 then
    raise exception 'INVALID_EXPIRATION_WINDOW';
  end if;

  for v_ride in
    select r.id,r.customer_id,r.status,r.updated_at
    from public.mantigo_rides r
    where r.status in ('OPEN','OPEN_FOR_BIDS') and r.updated_at < pg_catalog.now() - pg_catalog.make_interval(mins=>p_age_minutes)
    for update skip locked
  loop
    update public.mantigo_rides r set status='EXPIRED',updated_at=pg_catalog.now()
    where r.id=v_ride.id and r.status=v_ride.status;
    if found then
      v_count := v_count+1;
      insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
      values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,
        'MANTIGO_RIDE_EXPIRED','MANTIGO_RIDE',v_ride.id,
        pg_catalog.jsonb_build_object('status',v_ride.status,'updated_at',v_ride.updated_at),
        pg_catalog.jsonb_build_object('status','EXPIRED','reason','STALE_REQUEST'),'SUCCESS');
      begin
        insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
        values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_ride.customer_id,
          'MANTIGO_EXPIRED','انتهى طلب الرحلة','انتهت مدة طلب الرحلة لعدم اكتمال المطابقة. يمكنك إنشاء طلب جديد.','MANTIGO_RIDE',v_ride.id);
      exception when others then
        insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
        values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,
          'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',v_ride.id,'{}'::jsonb,
          pg_catalog.jsonb_build_object('notification_type','MANTIGO_EXPIRED','error',sqlerrm),'PARTIAL');
      end;
    end if;
  end loop;
  return pg_catalog.jsonb_build_object('expired_count',v_count,'age_minutes',p_age_minutes);
end
$function$;

revoke all on function public.get_mantigo_admin_dashboard_backend(uuid) from public, anon;
grant execute on function public.get_mantigo_admin_dashboard_backend(uuid) to authenticated;
revoke all on function public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz) from public, anon;
grant execute on function public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz) to authenticated;
revoke all on function public.settle_mantigo_captain_backend(uuid,text,text) from public, anon;
grant execute on function public.settle_mantigo_captain_backend(uuid,text,text) to authenticated;
revoke all on function public.expire_stale_mantigo_rides_backend(uuid,integer) from public, anon;
grant execute on function public.expire_stale_mantigo_rides_backend(uuid,integer) to authenticated;

comment on function public.mnty_can_platform_admin() is
  'RC449: platform scope requires an active SUPER_ADMIN membership with PLATFORM scope and full_control; tenant roles are not platform administrators.';
COMMENT ON FUNCTION public.mnty_can_platform_admin() IS
  'RC464: canonical platform-root guard backed only by private.platform_admins (RC113/RC115); tenant membership or tenant OWNER/ADMIN roles do not imply platform authority.';


-- DEMO previously exposed these actor-bound, registry-guarded RPCs only to service_role.
-- RC469 requires authenticated entry after verifying auth.uid() and the registry helper.
REVOKE ALL ON FUNCTION public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone) TO authenticated;
REVOKE ALL ON FUNCTION public.fulfill_digital_page_publish(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fulfill_digital_page_publish(uuid,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.set_mantigo_financial_config_backend(uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_mantigo_financial_config_backend(uuid,numeric,text) TO authenticated;


-- RC469: pin the four existing SECURITY DEFINER entrypoints that inherit
-- the canonical platform-admin guard to an empty search_path.
-- Function bodies, execution grants and authorization behavior remain unchanged.
-- Requires RC464's canonical public.mnty_can_platform_admin() helper.

DO $preflight$
DECLARE
  v_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    WHERE p.oid = pg_catalog.to_regprocedure('public.mnty_can_platform_admin()')
      AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']
  ) THEN
    RAISE EXCEPTION 'RC469_CANONICAL_PLATFORM_ADMIN_GUARD_NOT_HARDENED';
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_proc p
  WHERE p.oid IN (
    pg_catalog.to_regprocedure('public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)'),
    pg_catalog.to_regprocedure('public.fulfill_digital_page_publish(uuid,uuid,uuid)'),
    pg_catalog.to_regprocedure('public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)'),
    pg_catalog.to_regprocedure('public.set_mantigo_financial_config_backend(uuid,numeric,text)')
  )
    AND p.prosecdef
    AND p.prosrc ILIKE '%mnty_can_platform_admin%';

  IF v_count <> 4 THEN
    RAISE EXCEPTION 'RC469_EXPECTS_FOUR_SHARED_PLATFORM_ADMIN_CALLERS: found %', v_count;
  END IF;

  IF has_function_privilege('anon','public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)','EXECUTE')
     OR has_function_privilege('anon','public.fulfill_digital_page_publish(uuid,uuid,uuid)','EXECUTE')
     OR has_function_privilege('anon','public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.set_mantigo_financial_config_backend(uuid,numeric,text)','EXECUTE') THEN
    RAISE EXCEPTION 'RC469_ANON_EXECUTE_MUST_REMAIN_REVOKED';
  END IF;

  IF NOT has_function_privilege('authenticated','public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.fulfill_digital_page_publish(uuid,uuid,uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.set_mantigo_financial_config_backend(uuid,numeric,text)','EXECUTE') THEN
    RAISE EXCEPTION 'RC469_AUTHENTICATED_EXECUTE_MUST_BE_PRESERVED';
  END IF;
END;
$preflight$;

ALTER FUNCTION public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)
  SET search_path = '';
ALTER FUNCTION public.fulfill_digital_page_publish(uuid,uuid,uuid)
  SET search_path = '';
ALTER FUNCTION public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)
  SET search_path = '';
ALTER FUNCTION public.set_mantigo_financial_config_backend(uuid,numeric,text)
  SET search_path = '';

DO $postcondition$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_proc p
  WHERE p.oid IN (
    pg_catalog.to_regprocedure('public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)'),
    pg_catalog.to_regprocedure('public.fulfill_digital_page_publish(uuid,uuid,uuid)'),
    pg_catalog.to_regprocedure('public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)'),
    pg_catalog.to_regprocedure('public.set_mantigo_financial_config_backend(uuid,numeric,text)')
  )
    AND p.prosecdef
    AND p.proconfig @> ARRAY['search_path=""'];

  IF v_count <> 4 THEN
    RAISE EXCEPTION 'RC469_EMPTY_SEARCH_PATH_POSTCONDITION_FAILED: expected 4, found %', v_count;
  END IF;
END;
$postcondition$;

-- RC471 forward-only platform-scope hardening after RC470. Source-only until disposable PostgreSQL tests pass.
-- Canonical platform-root authority: private.platform_admins (RC113/RC115/RC462).
-- Replaces five function definitions and protects four additional helper-dependent RPCs.


DO $preflight$
DECLARE v_guarded_rpc_count integer;
BEGIN
  IF pg_catalog.to_regclass('private.platform_admins') IS NULL THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REGISTRY_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid=pg_catalog.to_regclass('private.platform_admins')
      AND attname='user_id' AND attnum>0 AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REGISTRY_USER_ID_MISSING';
  END IF;
  IF pg_catalog.to_regprocedure(
    'public.create_settlement_and_post_journal(character varying,character varying,character varying,character varying,numeric,numeric,numeric,numeric,character varying,character varying,uuid,text,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'MANTIGO_SETTLEMENT_JOURNAL_DEPENDENCY_MISSING';
  END IF;

  -- Fail closed if the live financial/audit/notification shape differs from the
  -- columns used by the replacement RPCs. This is a preflight only; it writes nothing.
  IF EXISTS (
    WITH expected(table_name,column_name) AS (
      VALUES
        ('mantigo_rides','id'),('mantigo_rides','customer_id'),('mantigo_rides','status'),('mantigo_rides','updated_at'),
        ('mantigo_financial_ledger','id'),('mantigo_financial_ledger','ride_id'),('mantigo_financial_ledger','captain_id'),
        ('mantigo_financial_ledger','gross_amount'),('mantigo_financial_ledger','commission_amount'),
        ('mantigo_financial_ledger','captain_net_amount'),('mantigo_financial_ledger','payment_status'),
        ('mantigo_financial_ledger','settlement_status'),('mantigo_financial_ledger','commission_rate'),
        ('mantigo_financial_ledger','settlement_reference'),('mantigo_financial_ledger','created_at'),('mantigo_financial_ledger','updated_at'),
        ('audit_logs','id'),('audit_logs','tenant_id'),('audit_logs','actor_user_id'),('audit_logs','action'),
        ('audit_logs','entity_type'),('audit_logs','entity_id'),('audit_logs','old_values'),('audit_logs','new_values'),('audit_logs','result'),
        ('notifications','id'),('notifications','tenant_id'),('notifications','user_id'),('notifications','type'),
        ('notifications','title'),('notifications','body'),('notifications','entity_type'),('notifications','entity_id')
    )
    SELECT 1
    FROM expected e
    LEFT JOIN pg_catalog.pg_attribute a
      ON a.attrelid=pg_catalog.to_regclass('public.'||e.table_name)
     AND a.attname=e.column_name
     AND a.attnum>0
     AND NOT a.attisdropped
    WHERE a.attname IS NULL
  ) THEN
    RAISE EXCEPTION 'RC471_LIVE_SCHEMA_DEPENDENCY_MISSING';
  END IF;
  WITH expected(proname, argument_types) AS (
    VALUES
      ('admin_create_global_ad', 'character varying, text, text, timestamp with time zone, timestamp with time zone'),
      ('fulfill_digital_page_publish', 'uuid, uuid, uuid'),
      ('review_mantigo_captain_application', 'uuid, uuid, text, text, text, text, jsonb'),
      ('set_mantigo_financial_config_backend', 'uuid, numeric, text')
  )
  SELECT count(*) INTO v_guarded_rpc_count
    FROM expected e
    JOIN pg_catalog.pg_proc p
      ON p.proname=e.proname
     AND pg_catalog.oidvectortypes(p.proargtypes)=e.argument_types
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prosecdef
     AND p.prosrc ILIKE '%mnty_can_platform_admin%';
  IF v_guarded_rpc_count<>4 THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_HELPER_CALLERS_NOT_READY: expected all 4 exact SECURITY DEFINER signatures to call mnty_can_platform_admin(), found %',v_guarded_rpc_count;
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.get_mantigo_admin_dashboard_backend(p_admin_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_user uuid:=auth.uid(); v_result jsonb;
BEGIN
  IF v_user IS NULL OR p_admin_user_id IS NULL OR v_user IS DISTINCT FROM p_admin_user_id THEN
    RAISE EXCEPTION 'USER_CONTEXT_MISMATCH';
  END IF;
  IF NOT public.mnty_can_platform_admin() THEN RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED'; END IF;
  SELECT jsonb_build_object(
    'rides_total',count(*),
    'open_requests',count(*) FILTER (WHERE status IN ('OPEN','OPEN_FOR_BIDS','MATCHING')),
    'accepted',count(*) FILTER (WHERE status='ACCEPTED'),
    'arrived',count(*) FILTER (WHERE status='ARRIVED'),
    'started',count(*) FILTER (WHERE status='STARTED'),
    'in_progress',count(*) FILTER (WHERE status='IN_PROGRESS'),
    'completed',count(*) FILTER (WHERE status='COMPLETED'),
    'cancelled',count(*) FILTER (WHERE status='CANCELLED'),
    'failed',count(*) FILTER (WHERE status='FAILED'),
    'show_no',count(*) FILTER (WHERE status='SHOW_NO'),
    'expired',count(*) FILTER (WHERE status='EXPIRED'),
    'revenue',coalesce((SELECT sum(gross_amount) FROM public.mantigo_financial_ledger),0),
    'commission',coalesce((SELECT sum(commission_amount) FROM public.mantigo_financial_ledger),0),
    'captain_earnings',coalesce((SELECT sum(captain_net_amount) FROM public.mantigo_financial_ledger),0),
    'paid',coalesce((SELECT sum(gross_amount) FROM public.mantigo_financial_ledger WHERE payment_status IN ('PAID','CASH_CONFIRMED')),0),
    'unsettled',coalesce((SELECT sum(captain_net_amount) FROM public.mantigo_financial_ledger WHERE settlement_status IN ('READY','HELD')),0)
  ) INTO v_result FROM public.mantigo_rides;
  RETURN v_result;
END
$function$;

CREATE OR REPLACE FUNCTION public.get_mantigo_admin_financial_report_backend(
  p_admin_user_id uuid,p_from timestamp with time zone DEFAULT NULL,p_to timestamp with time zone DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_auth uuid:=auth.uid();
  v_from timestamptz:=coalesce(p_from,'epoch'::timestamptz);
  v_to timestamptz:=coalesce(p_to,'infinity'::timestamptz);
  v_ledger jsonb;
BEGIN
  IF v_auth IS NULL OR v_auth IS DISTINCT FROM p_admin_user_id THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.mnty_can_platform_admin() THEN RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED'; END IF;
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_to<=p_from THEN RAISE EXCEPTION 'INVALID_FINANCIAL_REPORT_RANGE'; END IF;
  SELECT jsonb_build_object(
    'ledger_count',count(*),
    'gross',coalesce(sum(l.gross_amount),0),
    'commission',coalesce(sum(l.commission_amount),0),
    'captain_amount',coalesce(sum(l.captain_net_amount),0),
    'paid_count',count(*) FILTER (WHERE l.payment_status IN ('PAID','CASH_CONFIRMED')),
    'paid_amount',coalesce(sum(l.gross_amount) FILTER (WHERE l.payment_status IN ('PAID','CASH_CONFIRMED')),0),
    'settled_count',count(*) FILTER (WHERE l.settlement_status='SETTLED'),
    'settled_amount',coalesce(sum(l.captain_net_amount) FILTER (WHERE l.settlement_status='SETTLED'),0),
    'unsettled_count',count(*) FILTER (WHERE l.settlement_status IS DISTINCT FROM 'SETTLED'),
    'unsettled_amount',coalesce(sum(l.captain_net_amount) FILTER (WHERE l.settlement_status IS DISTINCT FROM 'SETTLED'),0),
    'from',v_from,'to',v_to
  ) INTO v_ledger FROM public.mantigo_financial_ledger l
   WHERE l.created_at>=v_from AND l.created_at<v_to;
  RETURN v_ledger;
END
$function$;

CREATE OR REPLACE FUNCTION public.mnty_can_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM private.platform_admins pa WHERE pa.user_id=auth.uid())
$function$;

CREATE OR REPLACE FUNCTION public.expire_stale_mantigo_rides_backend(
  p_admin_user_id uuid,p_age_minutes integer DEFAULT 30
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_count integer:=0; v_ride record;
BEGIN
  IF p_admin_user_id IS NULL OR p_admin_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'USER_CONTEXT_MISMATCH'; END IF;
  IF NOT public.mnty_can_platform_admin() THEN RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED'; END IF;
  IF p_age_minutes IS NULL OR p_age_minutes<1 OR p_age_minutes>10080 THEN RAISE EXCEPTION 'INVALID_EXPIRATION_WINDOW'; END IF;
  FOR v_ride IN
    SELECT id,customer_id,status,updated_at FROM public.mantigo_rides
     WHERE status IN ('OPEN','OPEN_FOR_BIDS') AND updated_at<now()-make_interval(mins=>p_age_minutes)
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.mantigo_rides SET status='EXPIRED',updated_at=now() WHERE id=v_ride.id AND status=v_ride.status;
    IF FOUND THEN
      v_count:=v_count+1;
      INSERT INTO public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
      VALUES('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,
        'MANTIGO_RIDE_EXPIRED','MANTIGO_RIDE',v_ride.id,
        jsonb_build_object('status',v_ride.status,'updated_at',v_ride.updated_at),
        jsonb_build_object('status','EXPIRED','reason','STALE_REQUEST'),'SUCCESS');
      BEGIN
        INSERT INTO public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
        VALUES('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_ride.customer_id,
          'MANTIGO_EXPIRED','انتهى طلب الرحلة','انتهت مدة طلب الرحلة لعدم اكتمال المطابقة. يمكنك إنشاء طلب جديد.','MANTIGO_RIDE',v_ride.id);
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
        VALUES('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,
          'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',v_ride.id,'{}'::jsonb,
          jsonb_build_object('notification_type','MANTIGO_EXPIRED','error',SQLERRM),'PARTIAL');
      END;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('expired_count',v_count,'age_minutes',p_age_minutes);
END
$function$;

CREATE OR REPLACE FUNCTION public.settle_mantigo_captain_backend(
  p_admin_user_id uuid,p_ride_id text,p_channel text DEFAULT 'BANK_TRANSFER'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_f public.mantigo_financial_ledger%rowtype; v_ride_status text; v_result jsonb;
BEGIN
  IF p_admin_user_id IS NULL OR p_admin_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'USER_CONTEXT_MISMATCH'; END IF;
  IF NOT public.mnty_can_platform_admin() THEN RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED'; END IF;
  SELECT r.status INTO v_ride_status FROM public.mantigo_rides r WHERE r.id=p_ride_id;
  IF v_ride_status IS NULL THEN RAISE EXCEPTION 'RIDE_NOT_FOUND'; END IF;
  IF v_ride_status<>'COMPLETED' THEN RAISE EXCEPTION 'RIDE_NOT_COMPLETED'; END IF;
  SELECT * INTO v_f FROM public.mantigo_financial_ledger f WHERE f.ride_id=p_ride_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FINANCIAL_RECORD_NOT_FOUND'; END IF;
  IF v_f.payment_status NOT IN ('PAID','CASH_CONFIRMED') THEN RAISE EXCEPTION 'PAYMENT_NOT_CONFIRMED'; END IF;
  IF v_f.settlement_status='SETTLED' THEN
    RETURN jsonb_build_object('ride_id',p_ride_id,'settlement_status','SETTLED',
      'settlement_reference',v_f.settlement_reference,'idempotent',true);
  END IF;
  IF v_f.commission_rate IS NULL THEN RAISE EXCEPTION 'COMMISSION_NOT_LOCKED'; END IF;
  v_result:=public.create_settlement_and_post_journal(
    'MGO-SET-'||p_ride_id,'MNTY-PLATFORM','PARTNER',v_f.captain_id::text,
    v_f.gross_amount,v_f.commission_amount,v_f.captain_net_amount,0,
    coalesce(nullif(trim(p_channel),''),'BANK_TRANSFER'),p_ride_id,NULL,
    'MantiGO captain settlement for ride '||p_ride_id,p_admin_user_id);
  UPDATE public.mantigo_financial_ledger SET settlement_status='SETTLED',
    settlement_reference='MGO-SET-'||p_ride_id,updated_at=now() WHERE ride_id=p_ride_id;
  INSERT INTO public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  VALUES('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,
    'MANTIGO_CAPTAIN_SETTLED','MANTIGO_FINANCIAL',v_f.id,
    jsonb_build_object('settlement_status',v_f.settlement_status),
    jsonb_build_object('settlement_status','SETTLED','settlement_reference','MGO-SET-'||p_ride_id,'provider_result',v_result),'SUCCESS');
  BEGIN
    INSERT INTO public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    VALUES('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_f.captain_id,
      'MANTIGO_SETTLEMENT','تمت التسوية','تمت تسوية مستحقاتك عن رحلة MantiGO بنجاح.','MANTIGO_RIDE',p_ride_id);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
    VALUES('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,
      'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,
      jsonb_build_object('notification_type','MANTIGO_SETTLEMENT','error',SQLERRM),'PARTIAL');
  END;
  RETURN jsonb_build_object('ride_id',p_ride_id,'settlement_status','SETTLED',
    'settlement_reference','MGO-SET-'||p_ride_id,'provider_result',v_result,'idempotent',false);
END
$function$;

REVOKE ALL ON FUNCTION public.mnty_can_platform_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mnty_can_platform_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.get_mantigo_admin_dashboard_backend(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_mantigo_admin_dashboard_backend(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_mantigo_admin_financial_report_backend(uuid,timestamp with time zone,timestamp with time zone) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_mantigo_admin_financial_report_backend(uuid,timestamp with time zone,timestamp with time zone) TO authenticated;
REVOKE ALL ON FUNCTION public.expire_stale_mantigo_rides_backend(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_mantigo_rides_backend(uuid,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.settle_mantigo_captain_backend(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.settle_mantigo_captain_backend(uuid,text,text) TO authenticated;

-- Pin the four existing helper-dependent SECURITY DEFINER callers to an empty
-- search_path. Their application objects are schema-qualified and remaining
-- unqualified calls are pg_catalog built-ins.
ALTER FUNCTION public.admin_create_global_ad(character varying, text, text, timestamp with time zone, timestamp with time zone) SET search_path TO '';
ALTER FUNCTION public.fulfill_digital_page_publish(uuid, uuid, uuid) SET search_path TO '';
ALTER FUNCTION public.review_mantigo_captain_application(uuid, uuid, text, text, text, text, jsonb) SET search_path TO '';
ALTER FUNCTION public.set_mantigo_financial_config_backend(uuid, numeric, text) SET search_path TO '';

COMMENT ON FUNCTION public.mnty_can_platform_admin() IS
  'Platform-root authorization is backed only by private.platform_admins, aligned with RC113/RC115/RC462; tenant memberships alone do not grant platform administration.';


-- RC472 DEMO subset: only the null-safe membership invariant is applicable here.
-- DEMO does not contain directory_listing_claim_requests/public_directory_listings,
-- so the directory claim-review function from the full RC472 migration is not copied.
DO $demo_membership_index_preflight$
DECLARE v_duplicates bigint;
BEGIN
  SELECT count(*) INTO v_duplicates FROM (
    SELECT user_id,business_id,coalesce(branch_id,'') AS branch_scope
    FROM public.user_memberships
    WHERE business_id IS NOT NULL
    GROUP BY user_id,business_id,coalesce(branch_id,'')
    HAVING count(*)>1
  ) d;
  IF v_duplicates>0 THEN
    RAISE EXCEPTION 'DEMO_MEMBERSHIP_SCOPE_DUPLICATES: %',v_duplicates;
  END IF;
END;
$demo_membership_index_preflight$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_user_memberships_user_business_branch_nullsafe
  ON public.user_memberships(user_id,business_id,(COALESCE(branch_id,'')))
  WHERE business_id IS NOT NULL;


-- RC484: replace the generic tenant-role global bypass with the protected platform-root registry.
-- All dependent RLS policies and SECURITY DEFINER callers inherit this stricter root predicate.
-- Tenant-local ownership/membership predicates remain unchanged.

DO $preflight$
DECLARE
  v_registry_owner oid;
  v_helper_owner oid;
  v_registry_rls boolean;
  v_registry_force_rls boolean;
  v_policy_count integer;
  v_policy_table_count integer;
  v_policy_hash text;
BEGIN
  IF pg_catalog.to_regclass('private.platform_admins') IS NULL THEN
    RAISE EXCEPTION 'RC484_PLATFORM_ADMIN_REGISTRY_MISSING';
  END IF;

  SELECT c.relowner,c.relrowsecurity,c.relforcerowsecurity
    INTO v_registry_owner,v_registry_rls,v_registry_force_rls
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='private' AND c.relname='platform_admins';

  IF NOT coalesce(v_registry_rls,false) THEN
    RAISE EXCEPTION 'RC484_PLATFORM_ADMIN_REGISTRY_RLS_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid=pg_catalog.to_regclass('private.platform_admins')
      AND attname='user_id' AND atttypid='uuid'::pg_catalog.regtype
      AND attnum>0 AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'RC484_PLATFORM_ADMIN_REGISTRY_USER_ID_UUID_REQUIRED';
  END IF;

  IF pg_catalog.has_table_privilege('anon','private.platform_admins','SELECT')
     OR pg_catalog.has_table_privilege('authenticated','private.platform_admins','SELECT')
     OR pg_catalog.has_table_privilege('anon','private.platform_admins','INSERT')
     OR pg_catalog.has_table_privilege('authenticated','private.platform_admins','INSERT')
     OR pg_catalog.has_table_privilege('anon','private.platform_admins','UPDATE')
     OR pg_catalog.has_table_privilege('authenticated','private.platform_admins','UPDATE')
     OR pg_catalog.has_table_privilege('anon','private.platform_admins','DELETE')
     OR pg_catalog.has_table_privilege('authenticated','private.platform_admins','DELETE') THEN
    RAISE EXCEPTION 'RC484_PLATFORM_ADMIN_REGISTRY_CLIENT_TABLE_PRIVILEGE_FOUND';
  END IF;

  IF pg_catalog.to_regprocedure('public.is_platform_admin()') IS NULL THEN
    RAISE EXCEPTION 'RC484_IS_PLATFORM_ADMIN_HELPER_MISSING';
  END IF;

  SELECT p.proowner INTO v_helper_owner
  FROM pg_catalog.pg_proc p
  WHERE p.oid=pg_catalog.to_regprocedure('public.is_platform_admin()');

  IF v_helper_owner IS DISTINCT FROM v_registry_owner
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_roles r
       WHERE r.oid=v_helper_owner AND r.rolbypassrls
     ) THEN
    RAISE EXCEPTION 'RC484_HELPER_OWNER_MUST_MATCH_BYPASS_RLS_REGISTRY_OWNER';
  END IF;

  SELECT count(*),
         count(DISTINCT schemaname||'.'||tablename),
         md5(string_agg(
           schemaname||'|'||tablename||'|'||policyname||'|'||cmd||'|'||
           array_to_string(roles,',')||'|'||coalesce(qual,'')||'|'||coalesce(with_check,''),
           E'\n' ORDER BY schemaname,tablename,policyname
         ))
    INTO v_policy_count,v_policy_table_count,v_policy_hash
  FROM pg_catalog.pg_policies
  WHERE coalesce(qual,'') ILIKE '%is_platform_admin()%'
     OR coalesce(with_check,'') ILIKE '%is_platform_admin()%';

  -- Main/production checkpoint retains the canonical 57-policy/24-table surface.
  -- DEMO has one fewer legacy policy/table; accept it only with the exact reviewed
  -- fingerprint captured from its live catalog, never by count alone.
  IF NOT (
    (v_policy_count>=57 AND v_policy_table_count>=24)
    OR (v_policy_count=56 AND v_policy_table_count=23
        AND v_policy_hash='f307f246e905c9dc1a3964184718b570')
  ) THEN
    RAISE EXCEPTION 'RC484_RLS_POLICY_BLAST_RADIUS_DRIFT: unexpected inventory % policies across % tables (hash %)',
      v_policy_count,v_policy_table_count,v_policy_hash;
  END IF;
END;
$preflight$;

-- The canonical registry is locked under FORCE RLS before the helper is replaced.
-- The helper owner is checked above to be the registry owner with BYPASSRLS, so
-- the SECURITY DEFINER lookup remains functional without granting client access.
-- Empty search_path prevents
-- object-shadowing; every referenced object is schema-qualified.
ALTER TABLE private.platform_admins FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM private.platform_admins pa
    WHERE pa.user_id=(SELECT auth.uid())
  )
$function$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

COMMENT ON FUNCTION public.is_platform_admin() IS
  'RC484: platform-root authority only; backed exclusively by private.platform_admins. Tenant ADMIN/SUPER_ADMIN membership does not grant global RLS or SECURITY DEFINER bypass.';

-- RC485: remove tenant-membership metadata as a platform-root credential in catalog RPCs.
-- Preserve tenant-local OWNER/ADMIN/MANAGER/BUSINESS_OWNER scope checks.
-- Registry-backed is_platform_admin() is supplied by RC484.

DO $preflight$
DECLARE
  v_helper oid := pg_catalog.to_regprocedure('public.is_platform_admin()');
  v_helper_config text;
BEGIN
  IF v_helper IS NULL THEN
    RAISE EXCEPTION 'RC485_REGISTRY_BACKED_PLATFORM_ADMIN_HELPER_REQUIRED';
  END IF;
  SELECT pg_catalog.array_to_string(p.proconfig, ',')
    INTO v_helper_config
    FROM pg_catalog.pg_proc p
   WHERE p.oid = v_helper;
  IF pg_catalog.pg_get_functiondef(v_helper) NOT ILIKE '%private.platform_admins%'
     OR pg_catalog.pg_get_functiondef(v_helper) NOT ILIKE '%SECURITY DEFINER%'
     OR coalesce(v_helper_config, '') NOT ILIKE '%search_path=""%' THEN
    RAISE EXCEPTION 'RC485_PLATFORM_ADMIN_HELPER_CONTRACT_MISMATCH';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.adjust_catalog_stock_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_branch_id character varying,
  p_warehouse_id character varying,
  p_catalog_item_id uuid,
  p_target_quantity numeric,
  p_unit_cost numeric,
  p_request_id character varying,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_warehouse_branch character varying;
  v_reference_prefix text;
  v_reference text;
  v_existing public.inventory_transactions%rowtype;
  v_balance public.stock_balances%rowtype;
  v_current numeric := 0;
  v_reserved numeric := 0;
  v_delta numeric := 0;
  v_broad_scope boolean := false;
  v_tx_id character varying;
BEGIN
  IF v_uid IS NULL OR coalesce((auth.jwt()->>'is_anonymous'), 'false') = 'true' THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_tenant_id IS NULL OR length(trim(p_tenant_id)) < 1 OR length(trim(p_tenant_id)) > 80
     OR p_branch_id IS NULL OR length(trim(p_branch_id)) < 1 OR length(trim(p_branch_id)) > 80
     OR p_warehouse_id IS NULL OR length(trim(p_warehouse_id)) < 1 OR length(trim(p_warehouse_id)) > 80
     OR p_request_id IS NULL OR trim(p_request_id) !~ '^[A-Za-z0-9_-]{8,80}$'
     OR p_reason IS NULL OR length(trim(p_reason)) < 3 OR length(trim(p_reason)) > 300 THEN
    RAISE EXCEPTION 'INVALID_STOCK_ADJUSTMENT_INPUT';
  END IF;

  IF p_target_quantity IS NULL OR p_target_quantity < 0 OR p_target_quantity > 1000000000
     OR p_target_quantity::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_unit_cost IS NULL OR p_unit_cost < 0 OR p_unit_cost > 1000000000
     OR p_unit_cost::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'INVALID_STOCK_ADJUSTMENT_AMOUNT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships m
     WHERE m.user_id = v_uid AND m.tenant_id = p_tenant_id
       AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
       AND (
         (
           upper(m.role::text) = 'SUPER_ADMIN' AND public.is_platform_admin()
           AND m.business_id IS NULL
         )
         OR (
           upper(m.role::text) IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER')
           AND (
             m.business_id = p_business_id
             OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL)
           )
           AND ((upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id) OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id)))
         )
       )
  ) THEN
    RAISE EXCEPTION 'CATALOG_STOCK_WRITE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
     WHERE b.id = p_business_id AND b.tenant_id = p_tenant_id
       AND upper(coalesce(b.status, '')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BUSINESS_NOT_ACTIVE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches br
     WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
       AND br.business_id = p_business_id AND upper(coalesce(br.status, '')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH';
  END IF;

  SELECT w.branch_id INTO v_warehouse_branch
    FROM public.warehouses w
   WHERE w.id = p_warehouse_id AND w.tenant_id = p_tenant_id
     AND w.business_id = p_business_id AND upper(coalesce(w.status, '')) = 'ACTIVE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WAREHOUSE_INVALID';
  END IF;

  IF v_warehouse_branch IS NOT NULL AND v_warehouse_branch <> p_branch_id THEN
    RAISE EXCEPTION 'WAREHOUSE_BRANCH_MISMATCH';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_memberships m
     WHERE m.user_id = v_uid AND m.tenant_id = p_tenant_id
       AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
       AND m.branch_id IS NULL
       AND (
         (
           upper(m.role::text) = 'SUPER_ADMIN' AND public.is_platform_admin()
           AND m.business_id IS NULL
         )
         OR (
           upper(m.role::text) IN ('OWNER','BUSINESS_OWNER','ADMIN')
           AND (
             m.business_id = p_business_id
             OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL)
           )
         )
       )
  ) INTO v_broad_scope;

  IF v_warehouse_branch IS NULL AND NOT v_broad_scope THEN
    RAISE EXCEPTION 'WAREHOUSE_SCOPE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_items ci
     WHERE ci.id = p_catalog_item_id
       AND ci.tenant_id = p_tenant_id
       AND ci.business_id = p_business_id
       AND upper(coalesce(ci.status, '')) = 'ACTIVE'
       AND upper(coalesce(ci.item_type, '')) = 'PRODUCT'
       AND (ci.branch_id IS NULL OR ci.branch_id = p_branch_id)
  ) THEN
    RAISE EXCEPTION 'PRODUCT_NOT_AVAILABLE_FOR_STOCK';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_warehouse_id || ':' || p_catalog_item_id::text)::bigint);

  v_reference_prefix := 'MNTY-CATALOG-STOCK:' || trim(p_request_id) || ':';
  v_reference := v_reference_prefix ||
    trim_scale(p_target_quantity)::text || ':' ||
    trim_scale(p_unit_cost)::text || ':' ||
    left(trim(p_reason), 300);

  SELECT * INTO v_existing
    FROM public.inventory_transactions it
   WHERE it.tenant_id = p_tenant_id
     AND it.business_id = p_business_id
     AND it.warehouse_id = p_warehouse_id
     AND it.product_id = p_catalog_item_id
     AND left(coalesce(it.reference_id, ''), length(v_reference_prefix)) = v_reference_prefix
   ORDER BY it.created_at DESC
   LIMIT 1;

  IF FOUND THEN
    IF v_existing.reference_id <> v_reference THEN
      RAISE EXCEPTION 'STOCK_IDEMPOTENCY_KEY_REUSED';
    END IF;
    SELECT * INTO v_balance FROM public.stock_balances sb
     WHERE sb.tenant_id = p_tenant_id AND sb.business_id = p_business_id
       AND sb.warehouse_id = p_warehouse_id AND sb.product_id = p_catalog_item_id;
    RETURN jsonb_build_object(
      'success', true, 'idempotent', true,
      'quantityOnHand', coalesce(v_balance.quantity_on_hand, 0),
      'quantityReserved', coalesce(v_balance.quantity_reserved, 0),
      'transactionId', v_existing.id
    );
  END IF;

  SELECT * INTO v_balance
    FROM public.stock_balances sb
   WHERE sb.tenant_id = p_tenant_id AND sb.business_id = p_business_id
     AND sb.warehouse_id = p_warehouse_id AND sb.product_id = p_catalog_item_id
   FOR UPDATE;

  IF FOUND THEN
    v_current := v_balance.quantity_on_hand;
    v_reserved := v_balance.quantity_reserved;
  END IF;

  IF p_target_quantity < v_reserved THEN
    RAISE EXCEPTION 'TARGET_BELOW_RESERVED_STOCK';
  END IF;

  v_delta := p_target_quantity - v_current;

  IF v_balance.id IS NULL THEN
    INSERT INTO public.stock_balances(
      id, tenant_id, business_id, branch_id, warehouse_id, product_id,
      quantity_on_hand, quantity_reserved
    ) VALUES (
      'sb-' || gen_random_uuid()::text,
      p_tenant_id, p_business_id, v_warehouse_branch, p_warehouse_id,
      p_catalog_item_id, p_target_quantity, 0
    )
    RETURNING * INTO v_balance;
  ELSE
    UPDATE public.stock_balances
       SET quantity_on_hand = p_target_quantity, updated_at = now()
     WHERE id = v_balance.id
    RETURNING * INTO v_balance;
  END IF;

  v_tx_id := 'it-' || gen_random_uuid()::text;
  INSERT INTO public.inventory_transactions(
    id, tenant_id, business_id, branch_id, warehouse_id, product_id,
    transaction_type, quantity, unit_cost, reference_id, created_by
  ) VALUES (
    v_tx_id, p_tenant_id, p_business_id, v_warehouse_branch, p_warehouse_id,
    p_catalog_item_id, 'STOCK_ADJUSTMENT', v_delta, p_unit_cost, v_reference, v_uid
  );

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false,
    'quantityOnHand', v_balance.quantity_on_hand,
    'quantityReserved', v_balance.quantity_reserved,
    'delta', v_delta,
    'transactionId', v_tx_id,
    'warehouseId', p_warehouse_id
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.create_catalog_warehouse_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_branch_id character varying,
  p_name character varying,
  p_code character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id character varying;
  v_code character varying;
  v_row public.warehouses%rowtype;
BEGIN
  IF v_uid IS NULL OR coalesce((auth.jwt()->>'is_anonymous'), 'false') = 'true' THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_tenant_id IS NULL OR length(trim(p_tenant_id)) < 1 OR length(trim(p_tenant_id)) > 80
     OR p_business_id IS NULL
     OR p_branch_id IS NULL OR length(trim(p_branch_id)) < 1 OR length(trim(p_branch_id)) > 80
     OR p_name IS NULL OR length(trim(p_name)) < 2 OR length(trim(p_name)) > 160
     OR p_code IS NULL OR trim(p_code) !~ '^[A-Za-z0-9_-]{2,40}$' THEN
    RAISE EXCEPTION 'INVALID_WAREHOUSE_INPUT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships m
     WHERE m.user_id = v_uid AND m.tenant_id = p_tenant_id
       AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
       AND (
         (
           upper(m.role::text) = 'SUPER_ADMIN' AND public.is_platform_admin()
           AND m.business_id IS NULL
         )
         OR (
           upper(m.role::text) IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER')
           AND (
             m.business_id = p_business_id
             OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL)
           )
           AND (
             (upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id)
             OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id))
           )
         )
       )
  ) THEN
    RAISE EXCEPTION 'CATALOG_WAREHOUSE_CREATE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
     WHERE b.id = p_business_id AND b.tenant_id = p_tenant_id
       AND upper(coalesce(b.status,'')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BUSINESS_NOT_ACTIVE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches br
     WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
       AND br.business_id = p_business_id AND upper(coalesce(br.status,'')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH';
  END IF;

  v_code := upper(trim(p_code));
  IF EXISTS (
    SELECT 1 FROM public.warehouses w
     WHERE w.tenant_id = p_tenant_id AND w.business_id = p_business_id
       AND upper(w.code) = v_code AND upper(coalesce(w.status,'')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'WAREHOUSE_CODE_ALREADY_EXISTS';
  END IF;

  v_id := 'wh-' || gen_random_uuid()::text;
  INSERT INTO public.warehouses(
    id, tenant_id, business_id, branch_id, name, code, status
  ) VALUES (
    v_id, p_tenant_id, p_business_id, p_branch_id, trim(p_name), v_code, 'ACTIVE'
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'success', true,
    'warehouse', jsonb_build_object(
      'id', v_row.id, 'tenant_id', v_row.tenant_id, 'business_id', v_row.business_id,
      'branch_id', v_row.branch_id, 'name', v_row.name, 'code', v_row.code, 'status', v_row.status
    )
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.upsert_catalog_item_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_branch_id character varying,
  p_legacy_ref character varying,
  p_item_type character varying,
  p_name_ar text,
  p_name_en text,
  p_description text,
  p_sku character varying,
  p_tax_rate numeric,
  p_metadata jsonb,
  p_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_public jsonb;
  v_image_url text;
  v_compare_price numeric;
  v_active_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = p_tenant_id
      AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
      AND (
        (
          upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
        )
        OR (
          upper(m.role) IN ('OWNER', 'ADMIN', 'MANAGER', 'BUSINESS_OWNER')
          AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
          AND ((upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id) OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id)))
        )
      )
  ) THEN
    RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'BUSINESS_TENANT_MISMATCH';
  END IF;

  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.branches br
    WHERE br.id = p_branch_id
      AND br.tenant_id = p_tenant_id
      AND br.business_id = p_business_id
      AND upper(coalesce(br.status, '')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH';
  END IF;

  IF p_name_ar IS NULL OR nullif(trim(p_name_ar), '') IS NULL
     OR p_tax_rate IS NULL OR p_tax_rate < 0 OR p_tax_rate > 100
     OR p_tax_rate::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'INVALID_CATALOG_ITEM';
  END IF;

  IF upper(coalesce(p_item_type, 'PRODUCT')) NOT IN ('PRODUCT', 'SERVICE') THEN
    RAISE EXCEPTION 'INVALID_CATALOG_ITEM_TYPE';
  END IF;

  v_image_url := nullif(trim(coalesce(p_metadata->'catalog_public'->>'image_url', '')), '');
  IF length(coalesce(v_image_url, '')) > 1500
     OR (v_image_url IS NOT NULL AND v_image_url !~* '^https://') THEN
    RAISE EXCEPTION 'INVALID_CATALOG_IMAGE_URL';
  END IF;

  BEGIN
    v_compare_price := nullif(trim(coalesce(p_metadata->'catalog_public'->>'compare_price', '')), '')::numeric;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'INVALID_COMPARE_PRICE';
  END;

  IF v_compare_price IS NOT NULL AND
     (v_compare_price < 0 OR v_compare_price::text IN ('NaN', 'Infinity', '-Infinity')) THEN
    RAISE EXCEPTION 'INVALID_COMPARE_PRICE';
  END IF;

  IF length(coalesce(p_metadata->'catalog_public'->>'category', '')) > 100
     OR length(coalesce(p_metadata->'catalog_public'->>'unit', '')) > 40 THEN
    RAISE EXCEPTION 'INVALID_CATALOG_METADATA';
  END IF;

  v_public := jsonb_strip_nulls(jsonb_build_object(
    'category', nullif(trim(coalesce(p_metadata->'catalog_public'->>'category', '')), ''),
    'unit', nullif(trim(coalesce(p_metadata->'catalog_public'->>'unit', '')), ''),
    'image_url', v_image_url,
    'compare_price', v_compare_price,
    'track_stock', CASE
      WHEN jsonb_typeof(p_metadata->'catalog_public'->'track_stock') = 'boolean'
      THEN (p_metadata->'catalog_public'->>'track_stock')::boolean
      ELSE false
    END,
    'is_available', CASE
      WHEN jsonb_typeof(p_metadata->'catalog_public'->'is_available') = 'boolean'
      THEN (p_metadata->'catalog_public'->>'is_available')::boolean
      ELSE true
    END
  ));

  IF p_id IS NULL THEN
    -- Serialize item creation per business to prevent concurrent requests from
    -- exceeding the published module limit of 150 active products/services.
    PERFORM pg_advisory_xact_lock(hashtext(p_business_id::text)::bigint);
    SELECT count(*)::integer INTO v_active_count
      FROM public.catalog_items
     WHERE business_id = p_business_id AND status = 'ACTIVE';
    IF v_active_count >= 150 THEN
      RAISE EXCEPTION 'CATALOG_ITEM_LIMIT_REACHED';
    END IF;

    INSERT INTO public.catalog_items(
      tenant_id, business_id, branch_id, legacy_ref, item_type,
      name_ar, name_en, description, sku, tax_rate, metadata
    ) VALUES (
      p_tenant_id, p_business_id, p_branch_id,
      nullif(trim(p_legacy_ref), ''), upper(coalesce(p_item_type, 'PRODUCT')),
      trim(p_name_ar), nullif(trim(p_name_en), ''), p_description, nullif(trim(p_sku), ''),
      p_tax_rate, jsonb_strip_nulls(jsonb_build_object('source', left(coalesce(nullif(trim(p_metadata->>'source'), ''), 'MNTY_CATALOG_MANAGER'), 80), 'provider_kind', nullif(trim(coalesce(p_metadata->>'provider_kind', '')), ''), 'catalog_public', v_public))
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.catalog_items
       SET branch_id = p_branch_id,
           legacy_ref = nullif(trim(p_legacy_ref), ''),
           item_type = upper(coalesce(p_item_type, item_type)),
           name_ar = trim(p_name_ar),
           name_en = nullif(trim(p_name_en), ''),
           description = p_description,
           sku = nullif(trim(p_sku), ''),
           tax_rate = p_tax_rate,
           metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{catalog_public}', v_public, true),
           updated_at = now()
     WHERE id = p_id
       AND tenant_id = p_tenant_id
       AND business_id = p_business_id
       AND (
         branch_id = p_branch_id
         OR (
           branch_id IS NULL
           AND EXISTS (
             SELECT 1 FROM public.user_memberships m
              WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
                AND m.status = 'ACTIVE' AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
                AND m.branch_id IS NULL
                AND upper(m.role) IN ('OWNER','ADMIN','BUSINESS_OWNER')
           )
         )
         OR EXISTS (
           SELECT 1 FROM public.user_memberships m
            WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
              AND m.status = 'ACTIVE' AND upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
              AND m.business_id IS NULL
         )
       )
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'CATALOG_ITEM_NOT_FOUND';
    END IF;
  END IF;

  RETURN jsonb_build_object('id', v_id);
END
$function$;

CREATE OR REPLACE FUNCTION public.upsert_catalog_price_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_catalog_item_id uuid,
  p_branch_id character varying,
  p_currency character varying,
  p_unit_price numeric,
  p_effective_from timestamp with time zone DEFAULT now(),
  p_effective_to timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_version bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = p_tenant_id
      AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
      AND (
        (
          upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
        )
        OR (
          upper(m.role) IN ('OWNER', 'ADMIN', 'MANAGER', 'BUSINESS_OWNER')
          AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
          AND ((upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id) OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id)))
        )
      )
  ) THEN
    RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.catalog_items ci
    WHERE ci.id = p_catalog_item_id
      AND ci.tenant_id = p_tenant_id
      AND ci.business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'CATALOG_ITEM_NOT_FOUND';
  END IF;

  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.branches br
    WHERE br.id = p_branch_id
      AND br.tenant_id = p_tenant_id
      AND br.business_id = p_business_id
      AND upper(coalesce(br.status, '')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH';
  END IF;

  IF p_unit_price IS NULL OR p_unit_price < 0
     OR p_unit_price::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'INVALID_PRICE';
  END IF;

  IF p_currency IS NULL OR upper(trim(p_currency)) !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'INVALID_CURRENCY';
  END IF;

  SELECT coalesce(max(version), 0) + 1
    INTO v_version
    FROM public.catalog_item_prices
   WHERE catalog_item_id = p_catalog_item_id
     AND coalesce(branch_id, '') = coalesce(p_branch_id, '');

  INSERT INTO public.catalog_item_prices(
    tenant_id, catalog_item_id, branch_id, currency, unit_price,
    version, effective_from, effective_to
  ) VALUES (
    p_tenant_id, p_catalog_item_id, p_branch_id, upper(trim(p_currency)),
    p_unit_price, v_version, coalesce(p_effective_from, now()), p_effective_to
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'version', v_version);
END
$function$;

CREATE OR REPLACE FUNCTION public.upsert_catalog_settings_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_currency character varying DEFAULT 'EGP'::character varying,
  p_delivery_fee numeric DEFAULT 0,
  p_tax_inclusive boolean DEFAULT false,
  p_allow_discounts boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_row public.catalog_business_settings%rowtype;
BEGIN
  IF v_uid IS NULL OR coalesce((auth.jwt()->>'is_anonymous'), 'false') = 'true' THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_currency IS NULL OR upper(trim(p_currency)) !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'INVALID_CURRENCY';
  END IF;

  IF p_delivery_fee IS NULL OR p_delivery_fee < 0
     OR p_delivery_fee::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_FEE';
  END IF;

  SELECT upper(m.role::text)
    INTO v_role
    FROM public.user_memberships m
   WHERE m.user_id = v_uid
     AND m.tenant_id = p_tenant_id
     AND m.status = 'ACTIVE'
     AND (
       (
         upper(m.role::text) = 'SUPER_ADMIN' AND public.is_platform_admin()
       )
       OR (
         upper(m.role::text) IN ('OWNER', 'ADMIN', 'BUSINESS_OWNER')
         AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
         AND m.branch_id IS NULL
       )
     )
   ORDER BY CASE upper(m.role::text)
     WHEN 'SUPER_ADMIN' THEN 0
     WHEN 'OWNER' THEN 1
     WHEN 'ADMIN' THEN 2
     WHEN 'BUSINESS_OWNER' THEN 3
     WHEN 'MANAGER' THEN 4
     ELSE 99
   END
   LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'BUSINESS_TENANT_MISMATCH';
  END IF;

  INSERT INTO public.catalog_business_settings(
    business_id, tenant_id, currency, delivery_fee,
    tax_inclusive, allow_discounts, updated_at
  ) VALUES (
    p_business_id, p_tenant_id, upper(trim(p_currency)), p_delivery_fee,
    coalesce(p_tax_inclusive, false), coalesce(p_allow_discounts, false), now()
  )
  ON CONFLICT (business_id) DO UPDATE
    SET tenant_id = excluded.tenant_id,
        currency = excluded.currency,
        delivery_fee = excluded.delivery_fee,
        tax_inclusive = excluded.tax_inclusive,
        allow_discounts = excluded.allow_discounts,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END
$function$;

CREATE OR REPLACE FUNCTION public.update_catalog_item_status_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_catalog_item_id uuid,
  p_branch_id character varying,
  p_status character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_status text := upper(trim(coalesce(p_status, '')));
  v_id uuid;
  v_active_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF v_status NOT IN ('ACTIVE', 'INACTIVE') THEN RAISE EXCEPTION 'INVALID_CATALOG_ITEM_STATUS'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships m
     WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
       AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
       AND (
         (upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin())
         OR (upper(m.role) IN ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER')
           AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
           AND ((upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id) OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id))))
       )
  ) THEN RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN'; END IF;

  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.branches br
     WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
       AND br.business_id = p_business_id AND upper(coalesce(br.status,'')) = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH'; END IF;

  -- Reactivation counts against the same per-business cap as item creation.
  -- Use the same transaction lock to prevent concurrent creates/reactivations
  -- from racing past the 150 active item limit.
  IF v_status = 'ACTIVE' THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_business_id::text)::bigint);
    IF EXISTS (
      SELECT 1 FROM public.catalog_items ci
       WHERE ci.id = p_catalog_item_id
         AND ci.tenant_id = p_tenant_id
         AND ci.business_id = p_business_id
         AND ci.status <> 'ACTIVE'
    ) THEN
      SELECT count(*)::integer INTO v_active_count
        FROM public.catalog_items ci
       WHERE ci.business_id = p_business_id
         AND ci.tenant_id = p_tenant_id
         AND ci.status = 'ACTIVE';
      IF v_active_count >= 150 THEN
        RAISE EXCEPTION 'CATALOG_ITEM_LIMIT_REACHED';
      END IF;
    END IF;
  END IF;

  UPDATE public.catalog_items
     SET status = v_status, updated_at = now()
   WHERE id = p_catalog_item_id
     AND tenant_id = p_tenant_id
     AND business_id = p_business_id
     AND (
       branch_id = p_branch_id
       OR (
         branch_id IS NULL
         AND EXISTS (
           SELECT 1 FROM public.user_memberships m
            WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
              AND m.status = 'ACTIVE' AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
              AND m.branch_id IS NULL
              AND upper(m.role) IN ('OWNER','ADMIN','BUSINESS_OWNER')
         )
       )
       OR EXISTS (
         SELECT 1 FROM public.user_memberships m
          WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
            AND m.status = 'ACTIVE' AND upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
       )
     )
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RAISE EXCEPTION 'CATALOG_ITEM_NOT_FOUND'; END IF;
  RETURN jsonb_build_object('id', v_id, 'status', v_status);
END
$function$;

CREATE OR REPLACE FUNCTION public.upsert_catalog_business_profile_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_branch_id character varying,
  p_name text,
  p_bio text,
  p_phone text,
  p_address text,
  p_governorate text,
  p_markaz text,
  p_village text,
  p_working_hours text,
  p_logo_url text,
  p_cover_url text,
  p_public_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_profile_id uuid;
  v_profile jsonb;
  v_public_enabled boolean := false;
BEGIN
  IF v_uid IS NULL OR coalesce((auth.jwt()->>'is_anonymous'), 'false') = 'true' THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF nullif(trim(p_name), '') IS NULL OR length(trim(p_name)) > 200
     OR length(coalesce(p_bio, '')) > 3000
     OR length(coalesce(p_phone, '')) > 40
     OR length(coalesce(p_address, '')) > 500
     OR length(coalesce(p_governorate, '')) > 100
     OR length(coalesce(p_markaz, '')) > 100
     OR length(coalesce(p_village, '')) > 100
     OR length(coalesce(p_working_hours, '')) > 300
     OR length(coalesce(p_logo_url, '')) > 1500
     OR length(coalesce(p_cover_url, '')) > 1500 THEN
    RAISE EXCEPTION 'INVALID_BUSINESS_PROFILE';
  END IF;

  IF nullif(trim(coalesce(p_logo_url, '')), '') IS NOT NULL
     AND trim(p_logo_url) !~* '^https://' THEN
    RAISE EXCEPTION 'INVALID_LOGO_URL';
  END IF;
  IF nullif(trim(coalesce(p_cover_url, '')), '') IS NOT NULL
     AND trim(p_cover_url) !~* '^https://' THEN
    RAISE EXCEPTION 'INVALID_COVER_URL';
  END IF;

  SELECT upper(m.role::text) INTO v_role
    FROM public.user_memberships m
   WHERE m.user_id = v_uid AND m.tenant_id = p_tenant_id
     AND m.status = 'ACTIVE'
     AND (
       (upper(m.role::text) = 'SUPER_ADMIN' AND public.is_platform_admin()
          AND m.business_id IS NULL)
       OR (upper(m.role::text) IN ('OWNER','BUSINESS_OWNER','ADMIN')
          AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
          AND m.branch_id IS NULL)
     )
   ORDER BY CASE upper(m.role::text)
     WHEN 'SUPER_ADMIN' THEN 0 WHEN 'OWNER' THEN 1 WHEN 'BUSINESS_OWNER' THEN 2
     WHEN 'ADMIN' THEN 3 WHEN 'MANAGER' THEN 4 ELSE 99 END
   LIMIT 1;

  IF v_role IS NULL THEN RAISE EXCEPTION 'CATALOG_PROFILE_WRITE_FORBIDDEN'; END IF;
  IF coalesce(p_public_enabled, false) AND v_role = 'MANAGER' THEN
    RAISE EXCEPTION 'CATALOG_PUBLISH_REQUIRES_OWNER';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
     WHERE b.id = p_business_id AND b.tenant_id = p_tenant_id
       AND upper(coalesce(b.status, '')) = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'BUSINESS_NOT_ACTIVE'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches br
     WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
       AND br.business_id = p_business_id AND upper(coalesce(br.status, '')) = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH'; END IF;

  SELECT p.id INTO v_profile_id
    FROM public.marketing_provider_profiles p
   WHERE p.business_id = p_business_id AND upper(p.status) = 'ACTIVE'
   ORDER BY p.updated_at DESC NULLS LAST LIMIT 1;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'ACTIVE_PROVIDER_PROFILE_REQUIRED'; END IF;

  -- Lock the row and preserve profile keys written by other production features
  -- (Google Maps, contact metadata, catalog display preferences, and future fields).
  SELECT CASE
           WHEN jsonb_typeof(b.settings->'catalog_profile') = 'object'
             THEN b.settings->'catalog_profile'
           ELSE '{}'::jsonb
         END,
         coalesce(b.settings->'catalog_public_enabled' = 'true'::jsonb, false)
    INTO v_profile, v_public_enabled
    FROM public.businesses b
   WHERE b.id = p_business_id
     AND b.tenant_id = p_tenant_id
     AND upper(coalesce(b.status, '')) = 'ACTIVE'
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_NOT_ACTIVE'; END IF;

  v_profile := coalesce(v_profile, '{}'::jsonb) || jsonb_build_object(
    'bio', trim(coalesce(p_bio, '')),
    'governorate', trim(coalesce(p_governorate, '')),
    'markaz', trim(coalesce(p_markaz, '')),
    'village', trim(coalesce(p_village, '')),
    'working_hours', trim(coalesce(p_working_hours, '')),
    'logo_url', trim(coalesce(p_logo_url, '')),
    'cover_url', trim(coalesce(p_cover_url, ''))
  );

  UPDATE public.businesses b
     SET name = trim(p_name),
         settings = jsonb_set(
           coalesce(b.settings, '{}'::jsonb),
           '{catalog_profile}', v_profile, true
         ),
         updated_at = now()
   WHERE b.id = p_business_id AND b.tenant_id = p_tenant_id;

  UPDATE public.marketing_provider_profiles p
     SET name_ar = trim(p_name),
         description = nullif(trim(coalesce(p_bio, '')), ''),
         updated_at = now()
   WHERE p.id = v_profile_id;

  UPDATE public.branches br
     SET phone = nullif(trim(coalesce(p_phone, '')), ''),
         address = nullif(trim(coalesce(p_address, '')), ''),
         updated_at = now()
   WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
     AND br.business_id = p_business_id;

  RETURN jsonb_build_object(
    'success', true, 'businessId', p_business_id, 'providerProfileId', v_profile_id,
    'branchId', p_branch_id, 'name', trim(p_name),
    'publicEnabled', v_public_enabled
  );
END
$function$;

-- Preserve the chronological RC486/RC923/RC925 catalog serialization and auth-boundary repairs after RC485.
-- RC485 catalog RPCs retain their scoped auth.uid()/membership checks.
-- DEMO's existing rows were service_role-only; RC923/RC925 require authenticated
-- EXECUTE while keeping anon and PUBLIC closed.
REVOKE ALL ON FUNCTION public.adjust_catalog_stock_backend(character varying,uuid,character varying,character varying,uuid,numeric,numeric,character varying,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_catalog_stock_backend(character varying,uuid,character varying,character varying,uuid,numeric,numeric,character varying,text) TO authenticated;
REVOKE ALL ON FUNCTION public.create_catalog_warehouse_backend(character varying,uuid,character varying,character varying,character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_catalog_warehouse_backend(character varying,uuid,character varying,character varying,character varying) TO authenticated;
REVOKE ALL ON FUNCTION public.upsert_catalog_item_backend(character varying,uuid,character varying,character varying,character varying,text,text,text,character varying,numeric,jsonb,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_catalog_item_backend(character varying,uuid,character varying,character varying,character varying,text,text,text,character varying,numeric,jsonb,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.upsert_catalog_price_backend(character varying,uuid,uuid,character varying,character varying,numeric,timestamp with time zone,timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_catalog_price_backend(character varying,uuid,uuid,character varying,character varying,numeric,timestamp with time zone,timestamp with time zone) TO authenticated;
REVOKE ALL ON FUNCTION public.upsert_catalog_settings_backend(character varying,uuid,character varying,numeric,boolean,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_catalog_settings_backend(character varying,uuid,character varying,numeric,boolean,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.update_catalog_item_status_backend(character varying,uuid,uuid,character varying,character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_catalog_item_status_backend(character varying,uuid,uuid,character varying,character varying) TO authenticated;
REVOKE ALL ON FUNCTION public.upsert_catalog_business_profile_backend(character varying,uuid,character varying,text,text,text,text,text,text,text,text,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_catalog_business_profile_backend(character varying,uuid,character varying,text,text,text,text,text,text,text,text,text,text,boolean) TO authenticated;

-- RC486: serialize catalog price-version allocation per item/branch.
-- The null-safe key matches the RPC's existing coalesce(branch_id, '') scope.

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.catalog_item_prices
     GROUP BY catalog_item_id, coalesce(branch_id, ''), version
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'RC486_DUPLICATE_CATALOG_PRICE_VERSIONS_REQUIRE_RECONCILIATION';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.catalog_item_prices WHERE version IS NULL
  ) THEN
    RAISE EXCEPTION 'RC486_NULL_CATALOG_PRICE_VERSION_REQUIRES_RECONCILIATION';
  END IF;
END;
$preflight$;

-- Enforce the same item/branch/version uniqueness that the allocator expects.
CREATE UNIQUE INDEX IF NOT EXISTS catalog_item_prices_item_branch_version_uidx
  ON public.catalog_item_prices (
    catalog_item_id,
    (coalesce(branch_id, ''::character varying)),
    version
  );

CREATE OR REPLACE FUNCTION public.upsert_catalog_price_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_catalog_item_id uuid,
  p_branch_id character varying,
  p_currency character varying,
  p_unit_price numeric,
  p_effective_from timestamp with time zone DEFAULT now(),
  p_effective_to timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_version bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = p_tenant_id
      AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
      AND (
        (
          upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
        )
        OR (
          upper(m.role) IN ('OWNER', 'ADMIN', 'MANAGER', 'BUSINESS_OWNER')
          AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
          AND ((upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id) OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id)))
        )
      )
  ) THEN
    RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.catalog_items ci
    WHERE ci.id = p_catalog_item_id
      AND ci.tenant_id = p_tenant_id
      AND ci.business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'CATALOG_ITEM_NOT_FOUND';
  END IF;

  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.branches br
    WHERE br.id = p_branch_id
      AND br.tenant_id = p_tenant_id
      AND br.business_id = p_business_id
      AND upper(coalesce(br.status, '')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH';
  END IF;

  IF p_unit_price IS NULL OR p_unit_price < 0
     OR p_unit_price::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'INVALID_PRICE';
  END IF;

  IF p_currency IS NULL OR upper(trim(p_currency)) !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'INVALID_CURRENCY';
  END IF;

  -- Serialize writers for this item/branch before reading MAX(version).
  -- Hash collisions only cause harmless extra serialization.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_catalog_item_id::text || ':' || coalesce(p_branch_id, ''))::bigint
  );

  SELECT coalesce(max(version), 0) + 1
    INTO v_version
    FROM public.catalog_item_prices
   WHERE catalog_item_id = p_catalog_item_id
     AND coalesce(branch_id, '') = coalesce(p_branch_id, '');

  INSERT INTO public.catalog_item_prices(
    tenant_id, catalog_item_id, branch_id, currency, unit_price,
    version, effective_from, effective_to
  ) VALUES (
    p_tenant_id, p_catalog_item_id, p_branch_id, upper(trim(p_currency)),
    p_unit_price, v_version, coalesce(p_effective_from, now()), p_effective_to
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'version', v_version);
END
$function$;

-- RC923 — Reject Anonymous Auth sessions at the direct catalog RPC boundary.
-- Forward-only replacement for three RC485 RPCs. RC485 itself remains immutable.

DO $preflight$
DECLARE
  v_signature text;
  v_oid oid;
  v_is_definer boolean;
  v_config text;
  v_definition text;
  v_expected text[] := ARRAY[
    'public.upsert_catalog_item_backend(character varying,uuid,character varying,character varying,character varying,text,text,text,character varying,numeric,jsonb,uuid)',
    'public.upsert_catalog_price_backend(character varying,uuid,uuid,character varying,character varying,numeric,timestamp with time zone,timestamp with time zone)',
    'public.update_catalog_item_status_backend(character varying,uuid,uuid,character varying,character varying)'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    WHERE p.oid = 'public.is_platform_admin()'::regprocedure
      AND pg_catalog.pg_get_functiondef(p.oid) ILIKE '%private.platform_admins%'
  ) THEN
    RAISE EXCEPTION 'RC923_REGISTRY_BACKED_PLATFORM_ADMIN_HELPER_REQUIRED';
  END IF;

  FOREACH v_signature IN ARRAY v_expected LOOP
    v_oid := pg_catalog.to_regprocedure(v_signature);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'RC923_RC485_FUNCTION_MISSING:%',v_signature;
    END IF;

    SELECT p.prosecdef,
           pg_catalog.array_to_string(p.proconfig,','),
           pg_catalog.pg_get_functiondef(p.oid)
      INTO v_is_definer,v_config,v_definition
      FROM pg_catalog.pg_proc p
     WHERE p.oid=v_oid;

    IF NOT v_is_definer
       OR coalesce(v_config,'') NOT ILIKE '%search_path=""%'
       OR v_definition NOT ILIKE '%public.is_platform_admin()%' THEN
      RAISE EXCEPTION 'RC923_RC485_PRECONDITION_FAILED:%',v_signature;
    END IF;

    IF v_signature = 'public.upsert_catalog_price_backend(character varying,uuid,uuid,character varying,character varying,numeric,timestamp with time zone,timestamp with time zone)'
       AND position('pg_catalog.pg_advisory_xact_lock' IN v_definition) = 0 THEN
      RAISE EXCEPTION 'RC923_RC486_PRICE_SERIALIZATION_PRECONDITION_REQUIRED';
    END IF;

    IF NOT pg_catalog.has_function_privilege('authenticated',v_oid,'EXECUTE')
       OR pg_catalog.has_function_privilege('anon',v_oid,'EXECUTE') THEN
      RAISE EXCEPTION 'RC923_DIRECT_RPC_ACL_UNEXPECTED:%',v_signature;
    END IF;
  END LOOP;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.upsert_catalog_item_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_branch_id character varying,
  p_legacy_ref character varying,
  p_item_type character varying,
  p_name_ar text,
  p_name_en text,
  p_description text,
  p_sku character varying,
  p_tax_rate numeric,
  p_metadata jsonb,
  p_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_public jsonb;
  v_image_url text;
  v_compare_price numeric;
  v_active_count integer;
BEGIN
  IF auth.uid() IS NULL OR coalesce((auth.jwt()->>'is_anonymous'),'false') = 'true' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = p_tenant_id
      AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
      AND (
        (
          upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
        )
        OR (
          upper(m.role) IN ('OWNER', 'ADMIN', 'MANAGER', 'BUSINESS_OWNER')
          AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
          AND ((upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id) OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id)))
        )
      )
  ) THEN
    RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'BUSINESS_TENANT_MISMATCH';
  END IF;

  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.branches br
    WHERE br.id = p_branch_id
      AND br.tenant_id = p_tenant_id
      AND br.business_id = p_business_id
      AND upper(coalesce(br.status, '')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH';
  END IF;

  IF p_name_ar IS NULL OR nullif(trim(p_name_ar), '') IS NULL
     OR p_tax_rate IS NULL OR p_tax_rate < 0 OR p_tax_rate > 100
     OR p_tax_rate::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'INVALID_CATALOG_ITEM';
  END IF;

  IF upper(coalesce(p_item_type, 'PRODUCT')) NOT IN ('PRODUCT', 'SERVICE') THEN
    RAISE EXCEPTION 'INVALID_CATALOG_ITEM_TYPE';
  END IF;

  v_image_url := nullif(trim(coalesce(p_metadata->'catalog_public'->>'image_url', '')), '');
  IF length(coalesce(v_image_url, '')) > 1500
     OR (v_image_url IS NOT NULL AND v_image_url !~* '^https://') THEN
    RAISE EXCEPTION 'INVALID_CATALOG_IMAGE_URL';
  END IF;

  BEGIN
    v_compare_price := nullif(trim(coalesce(p_metadata->'catalog_public'->>'compare_price', '')), '')::numeric;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'INVALID_COMPARE_PRICE';
  END;

  IF v_compare_price IS NOT NULL AND
     (v_compare_price < 0 OR v_compare_price::text IN ('NaN', 'Infinity', '-Infinity')) THEN
    RAISE EXCEPTION 'INVALID_COMPARE_PRICE';
  END IF;

  IF length(coalesce(p_metadata->'catalog_public'->>'category', '')) > 100
     OR length(coalesce(p_metadata->'catalog_public'->>'unit', '')) > 40 THEN
    RAISE EXCEPTION 'INVALID_CATALOG_METADATA';
  END IF;

  v_public := jsonb_strip_nulls(jsonb_build_object(
    'category', nullif(trim(coalesce(p_metadata->'catalog_public'->>'category', '')), ''),
    'unit', nullif(trim(coalesce(p_metadata->'catalog_public'->>'unit', '')), ''),
    'image_url', v_image_url,
    'compare_price', v_compare_price,
    'track_stock', CASE
      WHEN jsonb_typeof(p_metadata->'catalog_public'->'track_stock') = 'boolean'
      THEN (p_metadata->'catalog_public'->>'track_stock')::boolean
      ELSE false
    END,
    'is_available', CASE
      WHEN jsonb_typeof(p_metadata->'catalog_public'->'is_available') = 'boolean'
      THEN (p_metadata->'catalog_public'->>'is_available')::boolean
      ELSE true
    END
  ));

  IF p_id IS NULL THEN
    -- Serialize item creation per business to prevent concurrent requests from
    -- exceeding the published module limit of 150 active products/services.
    PERFORM pg_advisory_xact_lock(hashtext(p_business_id::text)::bigint);
    SELECT count(*)::integer INTO v_active_count
      FROM public.catalog_items
     WHERE business_id = p_business_id AND status = 'ACTIVE';
    IF v_active_count >= 150 THEN
      RAISE EXCEPTION 'CATALOG_ITEM_LIMIT_REACHED';
    END IF;

    INSERT INTO public.catalog_items(
      tenant_id, business_id, branch_id, legacy_ref, item_type,
      name_ar, name_en, description, sku, tax_rate, metadata
    ) VALUES (
      p_tenant_id, p_business_id, p_branch_id,
      nullif(trim(p_legacy_ref), ''), upper(coalesce(p_item_type, 'PRODUCT')),
      trim(p_name_ar), nullif(trim(p_name_en), ''), p_description, nullif(trim(p_sku), ''),
      p_tax_rate, jsonb_strip_nulls(jsonb_build_object('source', left(coalesce(nullif(trim(p_metadata->>'source'), ''), 'MNTY_CATALOG_MANAGER'), 80), 'provider_kind', nullif(trim(coalesce(p_metadata->>'provider_kind', '')), ''), 'catalog_public', v_public))
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.catalog_items
       SET branch_id = p_branch_id,
           legacy_ref = nullif(trim(p_legacy_ref), ''),
           item_type = upper(coalesce(p_item_type, item_type)),
           name_ar = trim(p_name_ar),
           name_en = nullif(trim(p_name_en), ''),
           description = p_description,
           sku = nullif(trim(p_sku), ''),
           tax_rate = p_tax_rate,
           metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{catalog_public}', v_public, true),
           updated_at = now()
     WHERE id = p_id
       AND tenant_id = p_tenant_id
       AND business_id = p_business_id
       AND (
         branch_id = p_branch_id
         OR (
           branch_id IS NULL
           AND EXISTS (
             SELECT 1 FROM public.user_memberships m
              WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
                AND m.status = 'ACTIVE' AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
                AND m.branch_id IS NULL
                AND upper(m.role) IN ('OWNER','ADMIN','BUSINESS_OWNER')
           )
         )
         OR EXISTS (
           SELECT 1 FROM public.user_memberships m
            WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
              AND m.status = 'ACTIVE' AND upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
              AND m.business_id IS NULL
         )
       )
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'CATALOG_ITEM_NOT_FOUND';
    END IF;
  END IF;

  RETURN jsonb_build_object('id', v_id);
END
$function$;

CREATE OR REPLACE FUNCTION public.upsert_catalog_price_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_catalog_item_id uuid,
  p_branch_id character varying,
  p_currency character varying,
  p_unit_price numeric,
  p_effective_from timestamp with time zone DEFAULT now(),
  p_effective_to timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_version bigint;
BEGIN
  IF auth.uid() IS NULL OR coalesce((auth.jwt()->>'is_anonymous'),'false') = 'true' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = p_tenant_id
      AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
      AND (
        (
          upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
        )
        OR (
          upper(m.role) IN ('OWNER', 'ADMIN', 'MANAGER', 'BUSINESS_OWNER')
          AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
          AND ((upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id) OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id)))
        )
      )
  ) THEN
    RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.catalog_items ci
    WHERE ci.id = p_catalog_item_id
      AND ci.tenant_id = p_tenant_id
      AND ci.business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'CATALOG_ITEM_NOT_FOUND';
  END IF;

  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.branches br
    WHERE br.id = p_branch_id
      AND br.tenant_id = p_tenant_id
      AND br.business_id = p_business_id
      AND upper(coalesce(br.status, '')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH';
  END IF;

  IF p_unit_price IS NULL OR p_unit_price < 0
     OR p_unit_price::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'INVALID_PRICE';
  END IF;

  IF p_currency IS NULL OR upper(trim(p_currency)) !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'INVALID_CURRENCY';
  END IF;

  -- Serialize writers for this item/branch before reading MAX(version).
  -- Hash collisions only cause harmless extra serialization.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_catalog_item_id::text || ':' || coalesce(p_branch_id, ''))::bigint
  );

  SELECT coalesce(max(version), 0) + 1
    INTO v_version
    FROM public.catalog_item_prices
   WHERE catalog_item_id = p_catalog_item_id
     AND coalesce(branch_id, '') = coalesce(p_branch_id, '');

  INSERT INTO public.catalog_item_prices(
    tenant_id, catalog_item_id, branch_id, currency, unit_price,
    version, effective_from, effective_to
  ) VALUES (
    p_tenant_id, p_catalog_item_id, p_branch_id, upper(trim(p_currency)),
    p_unit_price, v_version, coalesce(p_effective_from, now()), p_effective_to
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'version', v_version);
END
$function$;

CREATE OR REPLACE FUNCTION public.update_catalog_item_status_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_catalog_item_id uuid,
  p_branch_id character varying,
  p_status character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_status text := upper(trim(coalesce(p_status, '')));
  v_id uuid;
  v_active_count integer;
BEGIN
  IF auth.uid() IS NULL OR coalesce((auth.jwt()->>'is_anonymous'),'false') = 'true' THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF v_status NOT IN ('ACTIVE', 'INACTIVE') THEN RAISE EXCEPTION 'INVALID_CATALOG_ITEM_STATUS'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships m
     WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
       AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
       AND (
         (upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin())
         OR (upper(m.role) IN ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER')
           AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
           AND ((upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id) OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id))))
       )
  ) THEN RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN'; END IF;

  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.branches br
     WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
       AND br.business_id = p_business_id AND upper(coalesce(br.status,'')) = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH'; END IF;

  -- Reactivation counts against the same per-business cap as item creation.
  -- Use the same transaction lock to prevent concurrent creates/reactivations
  -- from racing past the 150 active item limit.
  IF v_status = 'ACTIVE' THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_business_id::text)::bigint);
    IF EXISTS (
      SELECT 1 FROM public.catalog_items ci
       WHERE ci.id = p_catalog_item_id
         AND ci.tenant_id = p_tenant_id
         AND ci.business_id = p_business_id
         AND ci.status <> 'ACTIVE'
    ) THEN
      SELECT count(*)::integer INTO v_active_count
        FROM public.catalog_items ci
       WHERE ci.business_id = p_business_id
         AND ci.tenant_id = p_tenant_id
         AND ci.status = 'ACTIVE';
      IF v_active_count >= 150 THEN
        RAISE EXCEPTION 'CATALOG_ITEM_LIMIT_REACHED';
      END IF;
    END IF;
  END IF;

  UPDATE public.catalog_items
     SET status = v_status, updated_at = now()
   WHERE id = p_catalog_item_id
     AND tenant_id = p_tenant_id
     AND business_id = p_business_id
     AND (
       branch_id = p_branch_id
       OR (
         branch_id IS NULL
         AND EXISTS (
           SELECT 1 FROM public.user_memberships m
            WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
              AND m.status = 'ACTIVE' AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
              AND m.branch_id IS NULL
              AND upper(m.role) IN ('OWNER','ADMIN','BUSINESS_OWNER')
         )
       )
       OR EXISTS (
         SELECT 1 FROM public.user_memberships m
          WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
            AND m.status = 'ACTIVE' AND upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
       )
     )
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RAISE EXCEPTION 'CATALOG_ITEM_NOT_FOUND'; END IF;
  RETURN jsonb_build_object('id', v_id, 'status', v_status);
END
$function$;
DO $postflight$
DECLARE
  v_signature text;
  v_oid oid;
  v_is_definer boolean;
  v_config text;
  v_definition text;
  v_expected text[] := ARRAY[
    'public.upsert_catalog_item_backend(character varying,uuid,character varying,character varying,character varying,text,text,text,character varying,numeric,jsonb,uuid)',
    'public.upsert_catalog_price_backend(character varying,uuid,uuid,character varying,character varying,numeric,timestamp with time zone,timestamp with time zone)',
    'public.update_catalog_item_status_backend(character varying,uuid,uuid,character varying,character varying)'
  ];
BEGIN
  FOREACH v_signature IN ARRAY v_expected LOOP
    v_oid := pg_catalog.to_regprocedure(v_signature);
    SELECT p.prosecdef,
           pg_catalog.array_to_string(p.proconfig,','),
           pg_catalog.pg_get_functiondef(p.oid)
      INTO v_is_definer,v_config,v_definition
      FROM pg_catalog.pg_proc p
     WHERE p.oid=v_oid;

    IF NOT v_is_definer
       OR coalesce(v_config,'') NOT ILIKE '%search_path=""%'
       OR v_definition NOT ILIKE '%auth.jwt()->>''is_anonymous''%'
       OR NOT pg_catalog.has_function_privilege('authenticated',v_oid,'EXECUTE')
       OR pg_catalog.has_function_privilege('anon',v_oid,'EXECUTE') THEN
      RAISE EXCEPTION 'RC923_POSTFLIGHT_ANONYMOUS_AUTH_GUARD_OR_ACL_FAILED:%',v_signature;
    END IF;

    IF v_signature = 'public.upsert_catalog_price_backend(character varying,uuid,uuid,character varying,character varying,numeric,timestamp with time zone,timestamp with time zone)'
       AND (
         position('pg_catalog.pg_advisory_xact_lock' IN v_definition) = 0
         OR position('pg_catalog.pg_advisory_xact_lock' IN v_definition)
              >= position('SELECT coalesce(max(version)' IN v_definition)
       ) THEN
      RAISE EXCEPTION 'RC923_PRICE_SERIALIZATION_LOCK_LOST';
    END IF;
  END LOOP;
END;
$postflight$;

-- RC925: require a positively confirmed non-anonymous Auth identity at all seven direct catalog RPC boundaries.
-- COALESCE(..., 'false') = 'true' rejects explicit Anonymous Auth tokens but allows a missing is_anonymous claim.
-- RC925 changes only the guard predicate; it preserves the current tenant/business/branch authorization and ACLs.

DO $rc925_preflight$
DECLARE
  v_signature text;
  v_oid oid;
  v_security_definer boolean;
  v_config text;
  v_definition text;
  v_helper oid := pg_catalog.to_regprocedure('public.is_platform_admin()');
  v_registry_owner oid;
  v_helper_owner oid;
  v_registry_force_rls boolean;
BEGIN
  IF v_helper IS NULL THEN
    RAISE EXCEPTION 'RC925_REGISTRY_BACKED_PLATFORM_ADMIN_HELPER_MISSING';
  END IF;

  SELECT c.relowner,c.relforcerowsecurity
    INTO v_registry_owner,v_registry_force_rls
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='private' AND c.relname='platform_admins';

  SELECT p.proowner INTO v_helper_owner
    FROM pg_catalog.pg_proc p
   WHERE p.oid=v_helper;

  SELECT p.prosecdef,pg_catalog.array_to_string(p.proconfig,','),
         pg_catalog.pg_get_functiondef(p.oid)
    INTO v_security_definer,v_config,v_definition
    FROM pg_catalog.pg_proc p
   WHERE p.oid=v_helper;

  IF v_helper_owner IS DISTINCT FROM v_registry_owner
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_roles r
        WHERE r.oid=v_registry_owner AND r.rolbypassrls
     )
     OR NOT coalesce(v_registry_force_rls,false)
     OR NOT v_security_definer
     OR coalesce(v_config,'') NOT ILIKE '%search_path=""%'
     OR v_definition NOT ILIKE '%private.platform_admins%' THEN
    RAISE EXCEPTION 'RC925_REGISTRY_ROOT_CONTRACT_REQUIRED';
  END IF;

  FOREACH v_signature IN ARRAY ARRAY[
    'public.adjust_catalog_stock_backend(character varying,uuid,character varying,character varying,uuid,numeric,numeric,character varying,text)',
    'public.create_catalog_warehouse_backend(character varying,uuid,character varying,character varying,character varying)',
    'public.upsert_catalog_item_backend(character varying,uuid,character varying,character varying,character varying,text,text,text,character varying,numeric,jsonb,uuid)',
    'public.upsert_catalog_price_backend(character varying,uuid,uuid,character varying,character varying,numeric,timestamp with time zone,timestamp with time zone)',
    'public.upsert_catalog_settings_backend(character varying,uuid,character varying,numeric,boolean,boolean)',
    'public.update_catalog_item_status_backend(character varying,uuid,uuid,character varying,character varying)',
    'public.upsert_catalog_business_profile_backend(character varying,uuid,character varying,text,text,text,text,text,text,text,text,text,text,boolean)'
  ] LOOP
    v_oid := pg_catalog.to_regprocedure(v_signature);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'RC925_REQUIRED_CATALOG_RPC_MISSING:%',v_signature;
    END IF;

    SELECT p.prosecdef,pg_catalog.array_to_string(p.proconfig,',')
      INTO v_security_definer,v_config
      FROM pg_catalog.pg_proc p
     WHERE p.oid=v_oid;

    IF NOT v_security_definer
       OR coalesce(v_config,'') NOT ILIKE '%search_path=""%'
       OR NOT pg_catalog.has_function_privilege('authenticated',v_oid,'EXECUTE')
       OR pg_catalog.has_function_privilege('anon',v_oid,'EXECUTE') THEN
      RAISE EXCEPTION 'RC925_CATALOG_RPC_BASE_CONTRACT_FAILED:%',v_signature;
    END IF;
  END LOOP;

  v_oid := pg_catalog.to_regprocedure(
    'public.upsert_catalog_price_backend(character varying,uuid,uuid,character varying,character varying,numeric,timestamp with time zone,timestamp with time zone)'
  );
  SELECT pg_catalog.pg_get_functiondef(p.oid) INTO v_definition
    FROM pg_catalog.pg_proc p WHERE p.oid=v_oid;
  IF position('pg_catalog.pg_advisory_xact_lock' IN v_definition)=0
     OR position('pg_catalog.pg_advisory_xact_lock' IN v_definition)
          >= position('SELECT coalesce(max(version)' IN v_definition) THEN
    RAISE EXCEPTION 'RC925_RC486_PRICE_SERIALIZATION_PREREQUISITE_FAILED';
  END IF;
END;
$rc925_preflight$;

CREATE OR REPLACE FUNCTION public.adjust_catalog_stock_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_branch_id character varying,
  p_warehouse_id character varying,
  p_catalog_item_id uuid,
  p_target_quantity numeric,
  p_unit_cost numeric,
  p_request_id character varying,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_warehouse_branch character varying;
  v_reference_prefix text;
  v_reference text;
  v_existing public.inventory_transactions%rowtype;
  v_balance public.stock_balances%rowtype;
  v_current numeric := 0;
  v_reserved numeric := 0;
  v_delta numeric := 0;
  v_broad_scope boolean := false;
  v_tx_id character varying;
BEGIN
  IF v_uid IS NULL OR (auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_tenant_id IS NULL OR length(trim(p_tenant_id)) < 1 OR length(trim(p_tenant_id)) > 80
     OR p_branch_id IS NULL OR length(trim(p_branch_id)) < 1 OR length(trim(p_branch_id)) > 80
     OR p_warehouse_id IS NULL OR length(trim(p_warehouse_id)) < 1 OR length(trim(p_warehouse_id)) > 80
     OR p_request_id IS NULL OR trim(p_request_id) !~ '^[A-Za-z0-9_-]{8,80}$'
     OR p_reason IS NULL OR length(trim(p_reason)) < 3 OR length(trim(p_reason)) > 300 THEN
    RAISE EXCEPTION 'INVALID_STOCK_ADJUSTMENT_INPUT';
  END IF;

  IF p_target_quantity IS NULL OR p_target_quantity < 0 OR p_target_quantity > 1000000000
     OR p_target_quantity::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_unit_cost IS NULL OR p_unit_cost < 0 OR p_unit_cost > 1000000000
     OR p_unit_cost::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'INVALID_STOCK_ADJUSTMENT_AMOUNT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships m
     WHERE m.user_id = v_uid AND m.tenant_id = p_tenant_id
       AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
       AND (
         (
           upper(m.role::text) = 'SUPER_ADMIN' AND public.is_platform_admin()
           AND m.business_id IS NULL
         )
         OR (
           upper(m.role::text) IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER')
           AND (
             m.business_id = p_business_id
             OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL)
           )
           AND ((upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id) OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id)))
         )
       )
  ) THEN
    RAISE EXCEPTION 'CATALOG_STOCK_WRITE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
     WHERE b.id = p_business_id AND b.tenant_id = p_tenant_id
       AND upper(coalesce(b.status, '')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BUSINESS_NOT_ACTIVE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches br
     WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
       AND br.business_id = p_business_id AND upper(coalesce(br.status, '')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH';
  END IF;

  SELECT w.branch_id INTO v_warehouse_branch
    FROM public.warehouses w
   WHERE w.id = p_warehouse_id AND w.tenant_id = p_tenant_id
     AND w.business_id = p_business_id AND upper(coalesce(w.status, '')) = 'ACTIVE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WAREHOUSE_INVALID';
  END IF;

  IF v_warehouse_branch IS NOT NULL AND v_warehouse_branch <> p_branch_id THEN
    RAISE EXCEPTION 'WAREHOUSE_BRANCH_MISMATCH';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_memberships m
     WHERE m.user_id = v_uid AND m.tenant_id = p_tenant_id
       AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
       AND m.branch_id IS NULL
       AND (
         (
           upper(m.role::text) = 'SUPER_ADMIN' AND public.is_platform_admin()
           AND m.business_id IS NULL
         )
         OR (
           upper(m.role::text) IN ('OWNER','BUSINESS_OWNER','ADMIN')
           AND (
             m.business_id = p_business_id
             OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL)
           )
         )
       )
  ) INTO v_broad_scope;

  IF v_warehouse_branch IS NULL AND NOT v_broad_scope THEN
    RAISE EXCEPTION 'WAREHOUSE_SCOPE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_items ci
     WHERE ci.id = p_catalog_item_id
       AND ci.tenant_id = p_tenant_id
       AND ci.business_id = p_business_id
       AND upper(coalesce(ci.status, '')) = 'ACTIVE'
       AND upper(coalesce(ci.item_type, '')) = 'PRODUCT'
       AND (ci.branch_id IS NULL OR ci.branch_id = p_branch_id)
  ) THEN
    RAISE EXCEPTION 'PRODUCT_NOT_AVAILABLE_FOR_STOCK';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_warehouse_id || ':' || p_catalog_item_id::text)::bigint);

  v_reference_prefix := 'MNTY-CATALOG-STOCK:' || trim(p_request_id) || ':';
  v_reference := v_reference_prefix ||
    trim_scale(p_target_quantity)::text || ':' ||
    trim_scale(p_unit_cost)::text || ':' ||
    left(trim(p_reason), 300);

  SELECT * INTO v_existing
    FROM public.inventory_transactions it
   WHERE it.tenant_id = p_tenant_id
     AND it.business_id = p_business_id
     AND it.warehouse_id = p_warehouse_id
     AND it.product_id = p_catalog_item_id
     AND left(coalesce(it.reference_id, ''), length(v_reference_prefix)) = v_reference_prefix
   ORDER BY it.created_at DESC
   LIMIT 1;

  IF FOUND THEN
    IF v_existing.reference_id <> v_reference THEN
      RAISE EXCEPTION 'STOCK_IDEMPOTENCY_KEY_REUSED';
    END IF;
    SELECT * INTO v_balance FROM public.stock_balances sb
     WHERE sb.tenant_id = p_tenant_id AND sb.business_id = p_business_id
       AND sb.warehouse_id = p_warehouse_id AND sb.product_id = p_catalog_item_id;
    RETURN jsonb_build_object(
      'success', true, 'idempotent', true,
      'quantityOnHand', coalesce(v_balance.quantity_on_hand, 0),
      'quantityReserved', coalesce(v_balance.quantity_reserved, 0),
      'transactionId', v_existing.id
    );
  END IF;

  SELECT * INTO v_balance
    FROM public.stock_balances sb
   WHERE sb.tenant_id = p_tenant_id AND sb.business_id = p_business_id
     AND sb.warehouse_id = p_warehouse_id AND sb.product_id = p_catalog_item_id
   FOR UPDATE;

  IF FOUND THEN
    v_current := v_balance.quantity_on_hand;
    v_reserved := v_balance.quantity_reserved;
  END IF;

  IF p_target_quantity < v_reserved THEN
    RAISE EXCEPTION 'TARGET_BELOW_RESERVED_STOCK';
  END IF;

  v_delta := p_target_quantity - v_current;

  IF v_balance.id IS NULL THEN
    INSERT INTO public.stock_balances(
      id, tenant_id, business_id, branch_id, warehouse_id, product_id,
      quantity_on_hand, quantity_reserved
    ) VALUES (
      'sb-' || gen_random_uuid()::text,
      p_tenant_id, p_business_id, v_warehouse_branch, p_warehouse_id,
      p_catalog_item_id, p_target_quantity, 0
    )
    RETURNING * INTO v_balance;
  ELSE
    UPDATE public.stock_balances
       SET quantity_on_hand = p_target_quantity, updated_at = now()
     WHERE id = v_balance.id
    RETURNING * INTO v_balance;
  END IF;

  v_tx_id := 'it-' || gen_random_uuid()::text;
  INSERT INTO public.inventory_transactions(
    id, tenant_id, business_id, branch_id, warehouse_id, product_id,
    transaction_type, quantity, unit_cost, reference_id, created_by
  ) VALUES (
    v_tx_id, p_tenant_id, p_business_id, v_warehouse_branch, p_warehouse_id,
    p_catalog_item_id, 'STOCK_ADJUSTMENT', v_delta, p_unit_cost, v_reference, v_uid
  );

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false,
    'quantityOnHand', v_balance.quantity_on_hand,
    'quantityReserved', v_balance.quantity_reserved,
    'delta', v_delta,
    'transactionId', v_tx_id,
    'warehouseId', p_warehouse_id
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.create_catalog_warehouse_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_branch_id character varying,
  p_name character varying,
  p_code character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id character varying;
  v_code character varying;
  v_row public.warehouses%rowtype;
BEGIN
  IF v_uid IS NULL OR (auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_tenant_id IS NULL OR length(trim(p_tenant_id)) < 1 OR length(trim(p_tenant_id)) > 80
     OR p_business_id IS NULL
     OR p_branch_id IS NULL OR length(trim(p_branch_id)) < 1 OR length(trim(p_branch_id)) > 80
     OR p_name IS NULL OR length(trim(p_name)) < 2 OR length(trim(p_name)) > 160
     OR p_code IS NULL OR trim(p_code) !~ '^[A-Za-z0-9_-]{2,40}$' THEN
    RAISE EXCEPTION 'INVALID_WAREHOUSE_INPUT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships m
     WHERE m.user_id = v_uid AND m.tenant_id = p_tenant_id
       AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
       AND (
         (
           upper(m.role::text) = 'SUPER_ADMIN' AND public.is_platform_admin()
           AND m.business_id IS NULL
         )
         OR (
           upper(m.role::text) IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER')
           AND (
             m.business_id = p_business_id
             OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL)
           )
           AND (
             (upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id)
             OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id))
           )
         )
       )
  ) THEN
    RAISE EXCEPTION 'CATALOG_WAREHOUSE_CREATE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
     WHERE b.id = p_business_id AND b.tenant_id = p_tenant_id
       AND upper(coalesce(b.status,'')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BUSINESS_NOT_ACTIVE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches br
     WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
       AND br.business_id = p_business_id AND upper(coalesce(br.status,'')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH';
  END IF;

  v_code := upper(trim(p_code));
  IF EXISTS (
    SELECT 1 FROM public.warehouses w
     WHERE w.tenant_id = p_tenant_id AND w.business_id = p_business_id
       AND upper(w.code) = v_code AND upper(coalesce(w.status,'')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'WAREHOUSE_CODE_ALREADY_EXISTS';
  END IF;

  v_id := 'wh-' || gen_random_uuid()::text;
  INSERT INTO public.warehouses(
    id, tenant_id, business_id, branch_id, name, code, status
  ) VALUES (
    v_id, p_tenant_id, p_business_id, p_branch_id, trim(p_name), v_code, 'ACTIVE'
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'success', true,
    'warehouse', jsonb_build_object(
      'id', v_row.id, 'tenant_id', v_row.tenant_id, 'business_id', v_row.business_id,
      'branch_id', v_row.branch_id, 'name', v_row.name, 'code', v_row.code, 'status', v_row.status
    )
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.upsert_catalog_item_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_branch_id character varying,
  p_legacy_ref character varying,
  p_item_type character varying,
  p_name_ar text,
  p_name_en text,
  p_description text,
  p_sku character varying,
  p_tax_rate numeric,
  p_metadata jsonb,
  p_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_public jsonb;
  v_image_url text;
  v_compare_price numeric;
  v_active_count integer;
BEGIN
  IF auth.uid() IS NULL OR (auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = p_tenant_id
      AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
      AND (
        (
          upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
        )
        OR (
          upper(m.role) IN ('OWNER', 'ADMIN', 'MANAGER', 'BUSINESS_OWNER')
          AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
          AND ((upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id) OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id)))
        )
      )
  ) THEN
    RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'BUSINESS_TENANT_MISMATCH';
  END IF;

  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.branches br
    WHERE br.id = p_branch_id
      AND br.tenant_id = p_tenant_id
      AND br.business_id = p_business_id
      AND upper(coalesce(br.status, '')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH';
  END IF;

  IF p_name_ar IS NULL OR nullif(trim(p_name_ar), '') IS NULL
     OR p_tax_rate IS NULL OR p_tax_rate < 0 OR p_tax_rate > 100
     OR p_tax_rate::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'INVALID_CATALOG_ITEM';
  END IF;

  IF upper(coalesce(p_item_type, 'PRODUCT')) NOT IN ('PRODUCT', 'SERVICE') THEN
    RAISE EXCEPTION 'INVALID_CATALOG_ITEM_TYPE';
  END IF;

  v_image_url := nullif(trim(coalesce(p_metadata->'catalog_public'->>'image_url', '')), '');
  IF length(coalesce(v_image_url, '')) > 1500
     OR (v_image_url IS NOT NULL AND v_image_url !~* '^https://') THEN
    RAISE EXCEPTION 'INVALID_CATALOG_IMAGE_URL';
  END IF;

  BEGIN
    v_compare_price := nullif(trim(coalesce(p_metadata->'catalog_public'->>'compare_price', '')), '')::numeric;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'INVALID_COMPARE_PRICE';
  END;

  IF v_compare_price IS NOT NULL AND
     (v_compare_price < 0 OR v_compare_price::text IN ('NaN', 'Infinity', '-Infinity')) THEN
    RAISE EXCEPTION 'INVALID_COMPARE_PRICE';
  END IF;

  IF length(coalesce(p_metadata->'catalog_public'->>'category', '')) > 100
     OR length(coalesce(p_metadata->'catalog_public'->>'unit', '')) > 40 THEN
    RAISE EXCEPTION 'INVALID_CATALOG_METADATA';
  END IF;

  v_public := jsonb_strip_nulls(jsonb_build_object(
    'category', nullif(trim(coalesce(p_metadata->'catalog_public'->>'category', '')), ''),
    'unit', nullif(trim(coalesce(p_metadata->'catalog_public'->>'unit', '')), ''),
    'image_url', v_image_url,
    'compare_price', v_compare_price,
    'track_stock', CASE
      WHEN jsonb_typeof(p_metadata->'catalog_public'->'track_stock') = 'boolean'
      THEN (p_metadata->'catalog_public'->>'track_stock')::boolean
      ELSE false
    END,
    'is_available', CASE
      WHEN jsonb_typeof(p_metadata->'catalog_public'->'is_available') = 'boolean'
      THEN (p_metadata->'catalog_public'->>'is_available')::boolean
      ELSE true
    END
  ));

  IF p_id IS NULL THEN
    -- Serialize item creation per business to prevent concurrent requests from
    -- exceeding the published module limit of 150 active products/services.
    PERFORM pg_advisory_xact_lock(hashtext(p_business_id::text)::bigint);
    SELECT count(*)::integer INTO v_active_count
      FROM public.catalog_items
     WHERE business_id = p_business_id AND status = 'ACTIVE';
    IF v_active_count >= 150 THEN
      RAISE EXCEPTION 'CATALOG_ITEM_LIMIT_REACHED';
    END IF;

    INSERT INTO public.catalog_items(
      tenant_id, business_id, branch_id, legacy_ref, item_type,
      name_ar, name_en, description, sku, tax_rate, metadata
    ) VALUES (
      p_tenant_id, p_business_id, p_branch_id,
      nullif(trim(p_legacy_ref), ''), upper(coalesce(p_item_type, 'PRODUCT')),
      trim(p_name_ar), nullif(trim(p_name_en), ''), p_description, nullif(trim(p_sku), ''),
      p_tax_rate, jsonb_strip_nulls(jsonb_build_object('source', left(coalesce(nullif(trim(p_metadata->>'source'), ''), 'MNTY_CATALOG_MANAGER'), 80), 'provider_kind', nullif(trim(coalesce(p_metadata->>'provider_kind', '')), ''), 'catalog_public', v_public))
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.catalog_items
       SET branch_id = p_branch_id,
           legacy_ref = nullif(trim(p_legacy_ref), ''),
           item_type = upper(coalesce(p_item_type, item_type)),
           name_ar = trim(p_name_ar),
           name_en = nullif(trim(p_name_en), ''),
           description = p_description,
           sku = nullif(trim(p_sku), ''),
           tax_rate = p_tax_rate,
           metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{catalog_public}', v_public, true),
           updated_at = now()
     WHERE id = p_id
       AND tenant_id = p_tenant_id
       AND business_id = p_business_id
       AND (
         branch_id = p_branch_id
         OR (
           branch_id IS NULL
           AND EXISTS (
             SELECT 1 FROM public.user_memberships m
              WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
                AND m.status = 'ACTIVE' AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
                AND m.branch_id IS NULL
                AND upper(m.role) IN ('OWNER','ADMIN','BUSINESS_OWNER')
           )
         )
         OR EXISTS (
           SELECT 1 FROM public.user_memberships m
            WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
              AND m.status = 'ACTIVE' AND upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
              AND m.business_id IS NULL
         )
       )
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'CATALOG_ITEM_NOT_FOUND';
    END IF;
  END IF;

  RETURN jsonb_build_object('id', v_id);
END
$function$;

CREATE OR REPLACE FUNCTION public.upsert_catalog_price_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_catalog_item_id uuid,
  p_branch_id character varying,
  p_currency character varying,
  p_unit_price numeric,
  p_effective_from timestamp with time zone DEFAULT now(),
  p_effective_to timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_version bigint;
BEGIN
  IF auth.uid() IS NULL OR (auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = p_tenant_id
      AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
      AND (
        (
          upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
        )
        OR (
          upper(m.role) IN ('OWNER', 'ADMIN', 'MANAGER', 'BUSINESS_OWNER')
          AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
          AND ((upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id) OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id)))
        )
      )
  ) THEN
    RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.catalog_items ci
    WHERE ci.id = p_catalog_item_id
      AND ci.tenant_id = p_tenant_id
      AND ci.business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'CATALOG_ITEM_NOT_FOUND';
  END IF;

  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.branches br
    WHERE br.id = p_branch_id
      AND br.tenant_id = p_tenant_id
      AND br.business_id = p_business_id
      AND upper(coalesce(br.status, '')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH';
  END IF;

  IF p_unit_price IS NULL OR p_unit_price < 0
     OR p_unit_price::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'INVALID_PRICE';
  END IF;

  IF p_currency IS NULL OR upper(trim(p_currency)) !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'INVALID_CURRENCY';
  END IF;

  -- Serialize writers for this item/branch before reading MAX(version).
  -- Hash collisions only cause harmless extra serialization.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_catalog_item_id::text || ':' || coalesce(p_branch_id, ''))::bigint
  );

  SELECT coalesce(max(version), 0) + 1
    INTO v_version
    FROM public.catalog_item_prices
   WHERE catalog_item_id = p_catalog_item_id
     AND coalesce(branch_id, '') = coalesce(p_branch_id, '');

  INSERT INTO public.catalog_item_prices(
    tenant_id, catalog_item_id, branch_id, currency, unit_price,
    version, effective_from, effective_to
  ) VALUES (
    p_tenant_id, p_catalog_item_id, p_branch_id, upper(trim(p_currency)),
    p_unit_price, v_version, coalesce(p_effective_from, now()), p_effective_to
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'version', v_version);
END
$function$;

CREATE OR REPLACE FUNCTION public.upsert_catalog_settings_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_currency character varying DEFAULT 'EGP'::character varying,
  p_delivery_fee numeric DEFAULT 0,
  p_tax_inclusive boolean DEFAULT false,
  p_allow_discounts boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_row public.catalog_business_settings%rowtype;
BEGIN
  IF v_uid IS NULL OR (auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_currency IS NULL OR upper(trim(p_currency)) !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'INVALID_CURRENCY';
  END IF;

  IF p_delivery_fee IS NULL OR p_delivery_fee < 0
     OR p_delivery_fee::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_FEE';
  END IF;

  SELECT upper(m.role::text)
    INTO v_role
    FROM public.user_memberships m
   WHERE m.user_id = v_uid
     AND m.tenant_id = p_tenant_id
     AND m.status = 'ACTIVE'
     AND (
       (
         upper(m.role::text) = 'SUPER_ADMIN' AND public.is_platform_admin()
       )
       OR (
         upper(m.role::text) IN ('OWNER', 'ADMIN', 'BUSINESS_OWNER')
         AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
         AND m.branch_id IS NULL
       )
     )
   ORDER BY CASE upper(m.role::text)
     WHEN 'SUPER_ADMIN' THEN 0
     WHEN 'OWNER' THEN 1
     WHEN 'ADMIN' THEN 2
     WHEN 'BUSINESS_OWNER' THEN 3
     WHEN 'MANAGER' THEN 4
     ELSE 99
   END
   LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'BUSINESS_TENANT_MISMATCH';
  END IF;

  INSERT INTO public.catalog_business_settings(
    business_id, tenant_id, currency, delivery_fee,
    tax_inclusive, allow_discounts, updated_at
  ) VALUES (
    p_business_id, p_tenant_id, upper(trim(p_currency)), p_delivery_fee,
    coalesce(p_tax_inclusive, false), coalesce(p_allow_discounts, false), now()
  )
  ON CONFLICT (business_id) DO UPDATE
    SET tenant_id = excluded.tenant_id,
        currency = excluded.currency,
        delivery_fee = excluded.delivery_fee,
        tax_inclusive = excluded.tax_inclusive,
        allow_discounts = excluded.allow_discounts,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END
$function$;

CREATE OR REPLACE FUNCTION public.update_catalog_item_status_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_catalog_item_id uuid,
  p_branch_id character varying,
  p_status character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_status text := upper(trim(coalesce(p_status, '')));
  v_id uuid;
  v_active_count integer;
BEGIN
  IF auth.uid() IS NULL OR (auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF v_status NOT IN ('ACTIVE', 'INACTIVE') THEN RAISE EXCEPTION 'INVALID_CATALOG_ITEM_STATUS'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships m
     WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
       AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
       AND (
         (upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin())
         OR (upper(m.role) IN ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER')
           AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
           AND ((upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id) OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id))))
       )
  ) THEN RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN'; END IF;

  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.branches br
     WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
       AND br.business_id = p_business_id AND upper(coalesce(br.status,'')) = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH'; END IF;

  -- Reactivation counts against the same per-business cap as item creation.
  -- Use the same transaction lock to prevent concurrent creates/reactivations
  -- from racing past the 150 active item limit.
  IF v_status = 'ACTIVE' THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_business_id::text)::bigint);
    IF EXISTS (
      SELECT 1 FROM public.catalog_items ci
       WHERE ci.id = p_catalog_item_id
         AND ci.tenant_id = p_tenant_id
         AND ci.business_id = p_business_id
         AND ci.status <> 'ACTIVE'
    ) THEN
      SELECT count(*)::integer INTO v_active_count
        FROM public.catalog_items ci
       WHERE ci.business_id = p_business_id
         AND ci.tenant_id = p_tenant_id
         AND ci.status = 'ACTIVE';
      IF v_active_count >= 150 THEN
        RAISE EXCEPTION 'CATALOG_ITEM_LIMIT_REACHED';
      END IF;
    END IF;
  END IF;

  UPDATE public.catalog_items
     SET status = v_status, updated_at = now()
   WHERE id = p_catalog_item_id
     AND tenant_id = p_tenant_id
     AND business_id = p_business_id
     AND (
       branch_id = p_branch_id
       OR (
         branch_id IS NULL
         AND EXISTS (
           SELECT 1 FROM public.user_memberships m
            WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
              AND m.status = 'ACTIVE' AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
              AND m.branch_id IS NULL
              AND upper(m.role) IN ('OWNER','ADMIN','BUSINESS_OWNER')
         )
       )
       OR EXISTS (
         SELECT 1 FROM public.user_memberships m
          WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
            AND m.status = 'ACTIVE' AND upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
       )
     )
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RAISE EXCEPTION 'CATALOG_ITEM_NOT_FOUND'; END IF;
  RETURN jsonb_build_object('id', v_id, 'status', v_status);
END
$function$;

CREATE OR REPLACE FUNCTION public.upsert_catalog_business_profile_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_branch_id character varying,
  p_name text,
  p_bio text,
  p_phone text,
  p_address text,
  p_governorate text,
  p_markaz text,
  p_village text,
  p_working_hours text,
  p_logo_url text,
  p_cover_url text,
  p_public_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_profile_id uuid;
  v_profile jsonb;
  v_public_enabled boolean := false;
BEGIN
  IF v_uid IS NULL OR (auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF nullif(trim(p_name), '') IS NULL OR length(trim(p_name)) > 200
     OR length(coalesce(p_bio, '')) > 3000
     OR length(coalesce(p_phone, '')) > 40
     OR length(coalesce(p_address, '')) > 500
     OR length(coalesce(p_governorate, '')) > 100
     OR length(coalesce(p_markaz, '')) > 100
     OR length(coalesce(p_village, '')) > 100
     OR length(coalesce(p_working_hours, '')) > 300
     OR length(coalesce(p_logo_url, '')) > 1500
     OR length(coalesce(p_cover_url, '')) > 1500 THEN
    RAISE EXCEPTION 'INVALID_BUSINESS_PROFILE';
  END IF;

  IF nullif(trim(coalesce(p_logo_url, '')), '') IS NOT NULL
     AND trim(p_logo_url) !~* '^https://' THEN
    RAISE EXCEPTION 'INVALID_LOGO_URL';
  END IF;
  IF nullif(trim(coalesce(p_cover_url, '')), '') IS NOT NULL
     AND trim(p_cover_url) !~* '^https://' THEN
    RAISE EXCEPTION 'INVALID_COVER_URL';
  END IF;

  SELECT upper(m.role::text) INTO v_role
    FROM public.user_memberships m
   WHERE m.user_id = v_uid AND m.tenant_id = p_tenant_id
     AND m.status = 'ACTIVE'
     AND (
       (upper(m.role::text) = 'SUPER_ADMIN' AND public.is_platform_admin()
          AND m.business_id IS NULL)
       OR (upper(m.role::text) IN ('OWNER','BUSINESS_OWNER','ADMIN')
          AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
          AND m.branch_id IS NULL)
     )
   ORDER BY CASE upper(m.role::text)
     WHEN 'SUPER_ADMIN' THEN 0 WHEN 'OWNER' THEN 1 WHEN 'BUSINESS_OWNER' THEN 2
     WHEN 'ADMIN' THEN 3 WHEN 'MANAGER' THEN 4 ELSE 99 END
   LIMIT 1;

  IF v_role IS NULL THEN RAISE EXCEPTION 'CATALOG_PROFILE_WRITE_FORBIDDEN'; END IF;
  IF coalesce(p_public_enabled, false) AND v_role = 'MANAGER' THEN
    RAISE EXCEPTION 'CATALOG_PUBLISH_REQUIRES_OWNER';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
     WHERE b.id = p_business_id AND b.tenant_id = p_tenant_id
       AND upper(coalesce(b.status, '')) = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'BUSINESS_NOT_ACTIVE'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches br
     WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
       AND br.business_id = p_business_id AND upper(coalesce(br.status, '')) = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH'; END IF;

  SELECT p.id INTO v_profile_id
    FROM public.marketing_provider_profiles p
   WHERE p.business_id = p_business_id AND upper(p.status) = 'ACTIVE'
   ORDER BY p.updated_at DESC NULLS LAST LIMIT 1;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'ACTIVE_PROVIDER_PROFILE_REQUIRED'; END IF;

  -- Lock the row and preserve profile keys written by other production features
  -- (Google Maps, contact metadata, catalog display preferences, and future fields).
  SELECT CASE
           WHEN jsonb_typeof(b.settings->'catalog_profile') = 'object'
             THEN b.settings->'catalog_profile'
           ELSE '{}'::jsonb
         END,
         coalesce(b.settings->'catalog_public_enabled' = 'true'::jsonb, false)
    INTO v_profile, v_public_enabled
    FROM public.businesses b
   WHERE b.id = p_business_id
     AND b.tenant_id = p_tenant_id
     AND upper(coalesce(b.status, '')) = 'ACTIVE'
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_NOT_ACTIVE'; END IF;

  v_profile := coalesce(v_profile, '{}'::jsonb) || jsonb_build_object(
    'bio', trim(coalesce(p_bio, '')),
    'governorate', trim(coalesce(p_governorate, '')),
    'markaz', trim(coalesce(p_markaz, '')),
    'village', trim(coalesce(p_village, '')),
    'working_hours', trim(coalesce(p_working_hours, '')),
    'logo_url', trim(coalesce(p_logo_url, '')),
    'cover_url', trim(coalesce(p_cover_url, ''))
  );

  UPDATE public.businesses b
     SET name = trim(p_name),
         settings = jsonb_set(
           coalesce(b.settings, '{}'::jsonb),
           '{catalog_profile}', v_profile, true
         ),
         updated_at = now()
   WHERE b.id = p_business_id AND b.tenant_id = p_tenant_id;

  UPDATE public.marketing_provider_profiles p
     SET name_ar = trim(p_name),
         description = nullif(trim(coalesce(p_bio, '')), ''),
         updated_at = now()
   WHERE p.id = v_profile_id;

  UPDATE public.branches br
     SET phone = nullif(trim(coalesce(p_phone, '')), ''),
         address = nullif(trim(coalesce(p_address, '')), ''),
         updated_at = now()
   WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
     AND br.business_id = p_business_id;

  RETURN jsonb_build_object(
    'success', true, 'businessId', p_business_id, 'providerProfileId', v_profile_id,
    'branchId', p_branch_id, 'name', trim(p_name),
    'publicEnabled', v_public_enabled
  );
END
$function$;

DO $rc925_postflight$
DECLARE
  v_signature text;
  v_oid oid;
  v_definition text;
  v_compact text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.adjust_catalog_stock_backend(character varying,uuid,character varying,character varying,uuid,numeric,numeric,character varying,text)',
    'public.create_catalog_warehouse_backend(character varying,uuid,character varying,character varying,character varying)',
    'public.upsert_catalog_item_backend(character varying,uuid,character varying,character varying,character varying,text,text,text,character varying,numeric,jsonb,uuid)',
    'public.upsert_catalog_price_backend(character varying,uuid,uuid,character varying,character varying,numeric,timestamp with time zone,timestamp with time zone)',
    'public.upsert_catalog_settings_backend(character varying,uuid,character varying,numeric,boolean,boolean)',
    'public.update_catalog_item_status_backend(character varying,uuid,uuid,character varying,character varying)',
    'public.upsert_catalog_business_profile_backend(character varying,uuid,character varying,text,text,text,text,text,text,text,text,text,text,boolean)'
  ] LOOP
    v_oid := pg_catalog.to_regprocedure(v_signature);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'RC925_POSTFLIGHT_FUNCTION_MISSING:%',v_signature;
    END IF;

    SELECT pg_catalog.pg_get_functiondef(p.oid) INTO v_definition
      FROM pg_catalog.pg_proc p WHERE p.oid=v_oid;
    v_compact := pg_catalog.regexp_replace(v_definition,'[[:space:]]+','','g');

    IF position('is_anonymous' IN v_compact)=0
       THEN
      RAISE EXCEPTION 'RC925_POSTFLIGHT_ANONYMOUS_CLAIM_GUARD_MISSING:%',v_signature;
    END IF;

    IF v_compact NOT ILIKE '%isdistinctfrom''false''%' THEN
      RAISE EXCEPTION 'RC925_POSTFLIGHT_MISSING_CLAIM_NOT_FAIL_CLOSED:%',v_signature;
    END IF;

    IF NOT pg_catalog.has_function_privilege('authenticated',v_oid,'EXECUTE')
       OR pg_catalog.has_function_privilege('anon',v_oid,'EXECUTE') THEN
      RAISE EXCEPTION 'RC925_POSTFLIGHT_ACL_CHANGED:%',v_signature;
    END IF;
  END LOOP;
END;
$rc925_postflight$;

COMMIT;
