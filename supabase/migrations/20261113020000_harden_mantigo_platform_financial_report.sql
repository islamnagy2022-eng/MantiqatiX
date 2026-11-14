-- MantiqaTix platform-scope hardening proposal. Source-only until disposable PostgreSQL tests pass.
-- Canonical platform-root authority: private.platform_admins (RC113/RC115/RC462).
-- Replaces five function definitions and protects four additional helper-dependent RPCs.

BEGIN;

DO $preflight$
DECLARE v_guarded_rpc_count integer;
BEGIN
  IF pg_catalog.to_regclass('private.platform_admins') IS NULL THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REGISTRY_MISSING';
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

COMMIT;
