-- RC463: one forward-only correction for the live platform-root authorization drift.
-- The protected private.platform_admins registry is canonical (RC113/RC115).
-- Replaces the current weak null-scope helper and the four live MantiGO global RPCs.
-- This migration is intentionally additive/forward-only; historical RC441/RC449/RC462 files remain unchanged.

BEGIN;

DO $preflight$
DECLARE
  v_rls boolean;
  v_registry_owner oid;
  v_guard_owner oid;
  v_rpc_count integer;
  v_helper_caller_count integer;
BEGIN
  IF pg_catalog.to_regclass('private.platform_admins') IS NULL THEN
    RAISE EXCEPTION 'RC463_PLATFORM_ADMIN_REGISTRY_MISSING';
  END IF;

  SELECT c.relrowsecurity, c.relowner
    INTO v_rls, v_registry_owner
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'private' AND c.relname = 'platform_admins';

  IF NOT coalesce(v_rls, false) THEN
    RAISE EXCEPTION 'RC463_PLATFORM_ADMIN_REGISTRY_RLS_REQUIRED';
  END IF;

  IF pg_catalog.has_table_privilege('anon', 'private.platform_admins', 'SELECT')
     OR pg_catalog.has_table_privilege('anon', 'private.platform_admins', 'INSERT')
     OR pg_catalog.has_table_privilege('anon', 'private.platform_admins', 'UPDATE')
     OR pg_catalog.has_table_privilege('anon', 'private.platform_admins', 'DELETE')
     OR pg_catalog.has_table_privilege('authenticated', 'private.platform_admins', 'SELECT')
     OR pg_catalog.has_table_privilege('authenticated', 'private.platform_admins', 'INSERT')
     OR pg_catalog.has_table_privilege('authenticated', 'private.platform_admins', 'UPDATE')
     OR pg_catalog.has_table_privilege('authenticated', 'private.platform_admins', 'DELETE') THEN
    RAISE EXCEPTION 'RC463_PLATFORM_ADMIN_REGISTRY_CLIENT_TABLE_GRANT_FOUND';
  END IF;

  IF pg_catalog.to_regprocedure('public.mnty_can_platform_admin()') IS NULL THEN
    RAISE EXCEPTION 'RC463_PLATFORM_ADMIN_GUARD_MISSING';
  END IF;

  SELECT p.proowner INTO v_guard_owner
  FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure('public.mnty_can_platform_admin()');

  IF v_guard_owner IS DISTINCT FROM v_registry_owner
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_roles r
       WHERE r.oid = v_guard_owner AND r.rolbypassrls
     ) THEN
    RAISE EXCEPTION 'RC463_REGISTRY_GUARD_OWNER_MUST_MATCH_BYPASS_RLS_TABLE_OWNER';
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
    RAISE EXCEPTION 'RC463_EXPECTS_FOUR_EXISTING_GLOBAL_MANTIGO_RPCS: found %', v_rpc_count;
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
    RAISE EXCEPTION 'RC463_EXPECTS_FOUR_OTHER_SHARED_GUARD_CALLERS: found %', v_helper_caller_count;
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
    RAISE EXCEPTION 'RC463_DIGITAL_PAGES_PLATFORM_RLS_POLICY_DRIFT';
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
    RAISE EXCEPTION 'RC463_MANTIGO_FINANCIAL_CONFIG_POLICY_DRIFT';
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
    RAISE EXCEPTION 'RC463_MANTIGO_RATE_LIMIT_POLICY_DRIFT';
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
  'RC463: canonical platform-root guard backed only by private.platform_admins (RC113/RC115); tenant membership or tenant OWNER/ADMIN roles do not imply platform authority.';

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
    'gross', coalesce(sum(l.amount),0),
    'commission', coalesce(sum(l.commission_amount),0),
    'captain_amount', coalesce(sum(l.captain_amount),0),
    'paid_count', count(*) filter (where l.payment_status in ('PAID','CASH_CONFIRMED')),
    'paid_amount', coalesce(sum(l.amount) filter (where l.payment_status in ('PAID','CASH_CONFIRMED')),0),
    'settled_count', count(*) filter (where l.settlement_status='SETTLED'),
    'settled_amount', coalesce(sum(l.captain_amount) filter (where l.settlement_status='SETTLED'),0),
    'unsettled_count', count(*) filter (where l.settlement_status is distinct from 'SETTLED'),
    'unsettled_amount', coalesce(sum(l.captain_amount) filter (where l.settlement_status is distinct from 'SETTLED'),0),
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
  'RC463: canonical platform-root guard backed only by private.platform_admins (RC113/RC115); tenant membership or tenant OWNER/ADMIN roles do not imply platform authority.';

COMMIT;
