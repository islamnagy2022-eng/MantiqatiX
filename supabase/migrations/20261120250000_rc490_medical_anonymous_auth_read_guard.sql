-- RC490: private medical appointment reads require a confirmed Auth identity.
-- Patient and provider tenant predicates remain intact for confirmed users.
BEGIN;

DO $preflight$
BEGIN
  IF pg_catalog.to_regclass('public.medical_appointments') IS NULL THEN
    RAISE EXCEPTION 'RC490_MEDICAL_APPOINTMENTS_TABLE_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    WHERE c.oid='public.medical_appointments'::regclass
      AND c.relrowsecurity AND c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'RC490_MEDICAL_APPOINTMENTS_RLS_NOT_FORCED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies p
    WHERE p.schemaname='public' AND p.tablename='medical_appointments'
      AND p.cmd='SELECT' AND p.permissive='PERMISSIVE'
      AND 'authenticated'=ANY(p.roles)
  ) THEN
    RAISE EXCEPTION 'RC490_EXPECTED_MEDICAL_READ_POLICIES_MISSING';
  END IF;
END;
$preflight$;

CREATE POLICY mnty_confirmed_auth_medical_read
ON public.medical_appointments
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING ((SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE);

COMMENT ON POLICY mnty_confirmed_auth_medical_read ON public.medical_appointments IS
  'RC490: patient/provider appointment records require a confirmed Auth identity.';

COMMIT;
