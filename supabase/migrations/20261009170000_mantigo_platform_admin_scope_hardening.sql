-- Restrict MantiGO platform-wide operational/financial RPCs to explicit platform-scoped SUPER_ADMIN.
-- Tenant OWNER/ADMIN/OPERATIONS roles must never authorize platform-wide reads or ride mutations.
-- Human actor remains bound to auth.uid(); scheduled work requires a separate approved system-actor design.

CREATE OR REPLACE FUNCTION public.get_mantigo_admin_dashboard_backend(p_admin_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user IS NULL OR p_admin_user_id IS NULL OR v_user <> p_admin_user_id THEN
    RAISE EXCEPTION 'USER_CONTEXT_MISMATCH';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = v_user
      AND m.tenant_id = 'MNTY-PLATFORM'
      AND m.status = 'ACTIVE'
      AND upper(m.role) = 'SUPER_ADMIN'
      AND coalesce(m.permissions->>'scope', '') = 'PLATFORM'
      AND coalesce((m.permissions->>'full_control')::boolean, false) = true
  ) THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED';
  END IF;

  SELECT jsonb_build_object(
    'rides_total', count(*),
    'open_requests', count(*) FILTER (WHERE status IN ('OPEN','OPEN_FOR_BIDS','MATCHING')),
    'accepted', count(*) FILTER (WHERE status = 'ACCEPTED'),
    'arrived', count(*) FILTER (WHERE status = 'ARRIVED'),
    'started', count(*) FILTER (WHERE status = 'STARTED'),
    'in_progress', count(*) FILTER (WHERE status = 'IN_PROGRESS'),
    'completed', count(*) FILTER (WHERE status = 'COMPLETED'),
    'cancelled', count(*) FILTER (WHERE status = 'CANCELLED'),
    'failed', count(*) FILTER (WHERE status = 'FAILED'),
    'show_no', count(*) FILTER (WHERE status = 'SHOW_NO'),
    'expired', count(*) FILTER (WHERE status = 'EXPIRED'),
    'revenue', coalesce((SELECT sum(gross_amount) FROM public.mantigo_financial_ledger), 0),
    'commission', coalesce((SELECT sum(commission_amount) FROM public.mantigo_financial_ledger), 0),
    'captain_earnings', coalesce((SELECT sum(captain_net_amount) FROM public.mantigo_financial_ledger), 0),
    'paid', coalesce((SELECT sum(gross_amount) FROM public.mantigo_financial_ledger WHERE payment_status IN ('PAID','CASH_CONFIRMED')), 0),
    'unsettled', coalesce((SELECT sum(captain_net_amount) FROM public.mantigo_financial_ledger WHERE settlement_status IN ('READY','HELD')), 0)
  ) INTO v_result
  FROM public.mantigo_rides;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_mantigo_admin_financial_report_backend(
  p_admin_user_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_auth uuid := auth.uid();
  v_from timestamptz := coalesce(p_from, 'epoch'::timestamptz);
  v_to timestamptz := coalesce(p_to, 'infinity'::timestamptz);
  v_ledger jsonb;
BEGIN
  IF v_auth IS NULL OR v_auth <> p_admin_user_id THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = v_auth
      AND m.tenant_id = 'MNTY-PLATFORM'
      AND m.status = 'ACTIVE'
      AND upper(m.role) = 'SUPER_ADMIN'
      AND coalesce(m.permissions->>'scope', '') = 'PLATFORM'
      AND coalesce((m.permissions->>'full_control')::boolean, false) = true
  ) THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED';
  END IF;

  SELECT jsonb_build_object(
    'ledger_count', count(*),
    'gross', coalesce(sum(l.amount), 0),
    'commission', coalesce(sum(l.commission_amount), 0),
    'captain_amount', coalesce(sum(l.captain_amount), 0),
    'paid_count', count(*) FILTER (WHERE l.payment_status IN ('PAID','CASH_CONFIRMED')),
    'paid_amount', coalesce(sum(l.amount) FILTER (WHERE l.payment_status IN ('PAID','CASH_CONFIRMED')), 0),
    'settled_count', count(*) FILTER (WHERE l.settlement_status = 'SETTLED'),
    'settled_amount', coalesce(sum(l.captain_amount) FILTER (WHERE l.settlement_status = 'SETTLED'), 0),
    'unsettled_count', count(*) FILTER (WHERE l.settlement_status IS DISTINCT FROM 'SETTLED'),
    'unsettled_amount', coalesce(sum(l.captain_amount) FILTER (WHERE l.settlement_status IS DISTINCT FROM 'SETTLED'), 0),
    'from', v_from,
    'to', v_to
  ) INTO v_ledger
  FROM public.mantigo_financial_ledger l
  WHERE l.created_at >= v_from AND l.created_at < v_to;

  RETURN v_ledger;
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_stale_mantigo_rides_backend(
  p_admin_user_id uuid,
  p_age_minutes integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count integer := 0;
  v_ride record;
BEGIN
  IF p_admin_user_id IS NULL OR p_admin_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'USER_CONTEXT_MISMATCH';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = p_admin_user_id
      AND m.tenant_id = 'MNTY-PLATFORM'
      AND m.status = 'ACTIVE'
      AND upper(m.role) = 'SUPER_ADMIN'
      AND coalesce(m.permissions->>'scope', '') = 'PLATFORM'
      AND coalesce((m.permissions->>'full_control')::boolean, false) = true
  ) THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED';
  END IF;

  IF p_age_minutes IS NULL OR p_age_minutes < 1 OR p_age_minutes > 10080 THEN
    RAISE EXCEPTION 'INVALID_EXPIRATION_WINDOW';
  END IF;

  FOR v_ride IN
    SELECT id, customer_id, status, updated_at
    FROM public.mantigo_rides
    WHERE status IN ('OPEN', 'OPEN_FOR_BIDS')
      AND updated_at < now() - make_interval(mins => p_age_minutes)
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.mantigo_rides
    SET status = 'EXPIRED', updated_at = now()
    WHERE id = v_ride.id AND status = v_ride.status;

    IF FOUND THEN
      v_count := v_count + 1;
      INSERT INTO public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
      VALUES(
        'AUD-MG-' || replace(gen_random_uuid()::text, '-', ''),
        'MNTY-PLATFORM', p_admin_user_id, 'MANTIGO_RIDE_EXPIRED', 'MANTIGO_RIDE', v_ride.id,
        jsonb_build_object('status', v_ride.status, 'updated_at', v_ride.updated_at),
        jsonb_build_object('status', 'EXPIRED', 'reason', 'STALE_REQUEST'), 'SUCCESS'
      );

      BEGIN
        INSERT INTO public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
        VALUES(
          'NTF-' || replace(gen_random_uuid()::text, '-', ''),
          'MNTY-PLATFORM', v_ride.customer_id, 'MANTIGO_EXPIRED',
          'انتهى طلب الرحلة', 'انتهت مدة طلب الرحلة لعدم اكتمال المطابقة. يمكنك إنشاء طلب جديد.',
          'MANTIGO_RIDE', v_ride.id
        );
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
        VALUES(
          'AUD-MG-' || replace(gen_random_uuid()::text, '-', ''),
          'MNTY-PLATFORM', p_admin_user_id, 'MANTIGO_NOTIFICATION_FAILED', 'MANTIGO_RIDE', v_ride.id,
          '{}'::jsonb, jsonb_build_object('notification_type', 'MANTIGO_EXPIRED', 'error', sqlerrm), 'PARTIAL'
        );
      END;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('expired_count', v_count, 'age_minutes', p_age_minutes);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_mantigo_admin_dashboard_backend(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mantigo_admin_dashboard_backend(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.expire_stale_mantigo_rides_backend(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_mantigo_rides_backend(uuid,integer) TO authenticated;
