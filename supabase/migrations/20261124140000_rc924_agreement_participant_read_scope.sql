-- RC924: correct participant-to-parent agreement correlation.
-- Preserve the existing non-anonymous authenticated and platform-admin boundary.
-- This is an additive forward repair; no table, row, grant or helper is changed.
BEGIN;
-- RC924 depends on RC482: the UUID overload must use the canonical registry,
-- not tenant ADMIN/SUPER_ADMIN/LEGAL_ADMIN membership labels.
DO $rc924_preflight$
DECLARE
  v_definition text;
  v_security_definer boolean;
  v_config text[];
BEGIN
  IF to_regprocedure('private.legal_is_admin(uuid)') IS NULL THEN
    RAISE EXCEPTION 'RC924_REQUIRES_RC482_REGISTRY_BACKED_LEGAL_ADMIN_HELPER';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname = 'legal_is_admin'
      AND p.pronargs = 0
  ) THEN
    RAISE EXCEPTION 'RC924_REQUIRES_RC482_REMOVAL_OF_ZERO_ARGUMENT_LEGAL_ADMIN_OVERLOAD';
  END IF;

  SELECT pg_get_functiondef(p.oid), p.prosecdef, p.proconfig
    INTO v_definition, v_security_definer, v_config
  FROM pg_proc p
  WHERE p.oid = to_regprocedure('private.legal_is_admin(uuid)');

  IF v_definition NOT ILIKE '%FROM private.platform_admins%'
     OR v_definition ILIKE '%FROM public.user_memberships%' THEN
    RAISE EXCEPTION 'RC924_LEGAL_ADMIN_HELPER_IS_NOT_REGISTRY_BACKED';
  END IF;

  IF NOT v_security_definer
     OR NOT ('search_path=""' = ANY(coalesce(v_config, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'RC924_LEGAL_ADMIN_HELPER_SECURITY_CONTRACT_INVALID';
  END IF;

  IF has_function_privilege('anon', 'private.legal_is_admin(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'private.legal_is_admin(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'RC924_LEGAL_ADMIN_HELPER_ACL_INVALID';
  END IF;
END;
$rc924_preflight$;


DROP POLICY IF EXISTS agreements_participant_read ON public.agreements;
DROP POLICY IF EXISTS agreements_confirmed_auth_select ON public.agreements;

-- Restrictive guard is required because the existing agreements_admin_write
-- FOR ALL policy is also permissive for SELECT and must not bypass the JWT gate.
CREATE POLICY agreements_confirmed_auth_select
  ON public.agreements
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (((SELECT auth.jwt()) ->> 'is_anonymous')::boolean IS FALSE);

CREATE POLICY agreements_participant_read
  ON public.agreements
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (((SELECT auth.jwt()) ->> 'is_anonymous')::boolean IS FALSE)
    AND (
      private.legal_is_admin((SELECT auth.uid()))
      OR EXISTS (
        SELECT 1
        FROM public.agreement_participants ap
        WHERE ap.agreement_id = agreements.id
          AND ap.user_id = (SELECT auth.uid())
      )
    )
  );

COMMIT;
