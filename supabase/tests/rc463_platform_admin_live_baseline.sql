-- RC463 disposable regression baseline: reproduce the currently live weak authorization
-- contract before applying the forward-only hardening migration.
-- This file runs only inside the dedicated throwaway PostgreSQL workflow.
CREATE OR REPLACE FUNCTION public.get_mantigo_admin_dashboard_backend(p_admin_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
BEGIN
  IF p_admin_user_id IS NULL OR p_admin_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'USER_CONTEXT_MISMATCH';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships
    WHERE user_id = p_admin_user_id AND status = 'ACTIVE'
      AND upper(role) IN ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','MANAGER','OPERATIONS','OPERATIONS_MANAGER')
  ) THEN RAISE EXCEPTION 'OPERATIONS_ROLE_REQUIRED'; END IF;
  RETURN jsonb_build_object('authorized', true, 'endpoint', 'GLOBAL_DASHBOARD');
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_mantigo_admin_financial_report_backend(
  p_admin_user_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
BEGIN
  IF p_admin_user_id IS NULL OR p_admin_user_id <> auth.uid() THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships
    WHERE user_id = p_admin_user_id AND status = 'ACTIVE'
      AND upper(role) IN ('SUPER_ADMIN','OWNER','BUSINESS_OWNER','ADMIN','OPERATIONS','OPERATIONS_MANAGER')
  ) THEN RAISE EXCEPTION 'ADMIN_ROLE_REQUIRED'; END IF;
  RETURN jsonb_build_object('authorized', true, 'endpoint', 'GLOBAL_FINANCIAL_REPORT');
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_mantigo_captain_backend(
  p_admin_user_id uuid,
  p_ride_id text,
  p_channel text DEFAULT 'BANK_TRANSFER'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
BEGIN
  IF p_admin_user_id IS NULL OR p_admin_user_id <> auth.uid() THEN RAISE EXCEPTION 'USER_CONTEXT_MISMATCH'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships
    WHERE user_id = p_admin_user_id AND status = 'ACTIVE'
      AND upper(role) IN ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','ACCOUNTANT','FINANCE_MANAGER','FINANCE')
  ) THEN RAISE EXCEPTION 'FINANCE_ROLE_REQUIRED'; END IF;
  RETURN jsonb_build_object('authorized', true, 'endpoint', 'GLOBAL_SETTLEMENT');
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_stale_mantigo_rides_backend(
  p_admin_user_id uuid,
  p_age_minutes integer DEFAULT 30
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
BEGIN
  IF p_admin_user_id IS NULL OR p_admin_user_id <> auth.uid() THEN RAISE EXCEPTION 'USER_CONTEXT_MISMATCH'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships
    WHERE user_id = p_admin_user_id AND status = 'ACTIVE'
      AND upper(role) IN ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','MANAGER','OPERATIONS','OPERATIONS_MANAGER')
  ) THEN RAISE EXCEPTION 'OPERATIONS_ROLE_REQUIRED'; END IF;
  RETURN jsonb_build_object('authorized', true, 'endpoint', 'GLOBAL_RIDE_EXPIRATION');
END;
$function$;


BEGIN;

CREATE OR REPLACE FUNCTION public.mnty_can(
  p_permission text,
  p_tenant_id character varying DEFAULT NULL,
  p_business_id uuid DEFAULT NULL,
  p_branch_id character varying DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = auth.uid()
      AND m.status = 'ACTIVE'
      AND (
        coalesce((m.permissions ->> p_permission)::boolean, false)
        OR (
          upper(m.role) = 'OWNER'
          AND p_permission IN ('admin','owner','platform','manage_users','manage_business')
        )
        OR (
          upper(m.role) = 'ADMIN'
          AND p_permission IN ('admin','manage_users','manage_business')
        )
        OR (
          upper(m.role) IN ('SUPER_ADMIN','BUSINESS_OWNER','MANAGER','OPERATIONS','OPERATIONS_MANAGER')
          AND p_permission = 'admin'
        )
      )
  )
$function$;

-- Exact weak helper shape observed in live Production before RC463.
CREATE OR REPLACE FUNCTION public.mnty_can_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT public.mnty_can('admin', NULL, NULL, NULL)
$function$;
REVOKE ALL ON FUNCTION public.mnty_can_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mnty_can_platform_admin() TO authenticated;

-- The live MantiGO global endpoints accepted active operational/tenant roles
-- after checking only that the supplied actor UUID matched auth.uid().
DO $baseline$
DECLARE
  v_owner uuid := '10000000-0000-4000-8000-000000000050';
  v_result jsonb;
BEGIN
  INSERT INTO public.user_memberships(id,user_id,tenant_id,role,status,permissions)
  VALUES ('rc463-vulnerable-tenant-owner',v_owner,'TENANT-UNRELATED','OWNER','ACTIVE','{}'::jsonb);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_owner::text,false);

  IF NOT public.mnty_can_platform_admin() THEN
    RAISE EXCEPTION 'RC463_BASELINE_DID_NOT_REPRODUCE_WEAK_NULL_SCOPE_HELPER';
  END IF;

  v_result := public.get_mantigo_admin_dashboard_backend(v_owner);
  IF v_result->>'authorized' <> 'true' THEN RAISE EXCEPTION 'RC463_BASELINE_DASHBOARD_NOT_REACHABLE'; END IF;

  v_result := public.get_mantigo_admin_financial_report_backend(v_owner,NULL,NULL);
  IF v_result->>'authorized' <> 'true' THEN RAISE EXCEPTION 'RC463_BASELINE_FINANCE_NOT_REACHABLE'; END IF;

  v_result := public.settle_mantigo_captain_backend(v_owner,'baseline-ride','BANK_TRANSFER');
  IF v_result->>'authorized' <> 'true' THEN RAISE EXCEPTION 'RC463_BASELINE_SETTLEMENT_NOT_REACHABLE'; END IF;

  v_result := public.expire_stale_mantigo_rides_backend(v_owner,30);
  IF v_result->>'authorized' <> 'true' THEN RAISE EXCEPTION 'RC463_BASELINE_EXPIRATION_NOT_REACHABLE'; END IF;
END;
$baseline$;

ROLLBACK;
