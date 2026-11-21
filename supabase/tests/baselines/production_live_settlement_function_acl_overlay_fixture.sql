-- TEST ONLY: reconcile the captured schema checkpoint with the independently verified
-- Production ACL for create_settlement_and_post_journal before RC494 forward replay.
-- Live read-only evidence: postgres owns the function; only service_role has EXECUTE.
-- Never apply this fixture to a hosted or production database.
DO $preflight$
BEGIN
  IF pg_catalog.to_regprocedure(
    'public.create_settlement_and_post_journal(character varying,character varying,character varying,character varying,numeric,numeric,numeric,numeric,character varying,character varying,uuid,text,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'RC494_TEST_OVERLAY_SETTLEMENT_FUNCTION_MISSING';
  END IF;
END;
$preflight$;

REVOKE ALL ON FUNCTION public.create_settlement_and_post_journal(
  character varying,character varying,character varying,character varying,
  numeric,numeric,numeric,numeric,character varying,character varying,uuid,text,uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_settlement_and_post_journal(
  character varying,character varying,character varying,character varying,
  numeric,numeric,numeric,numeric,character varying,character varying,uuid,text,uuid
) TO service_role;

DO $verify$
DECLARE
  v_function oid := pg_catalog.to_regprocedure(
    'public.create_settlement_and_post_journal(character varying,character varying,character varying,character varying,numeric,numeric,numeric,numeric,character varying,character varying,uuid,text,uuid)'
  );
BEGIN
  IF pg_catalog.has_function_privilege('anon',v_function,'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated',v_function,'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role',v_function,'EXECUTE') THEN
    RAISE EXCEPTION 'RC494_TEST_OVERLAY_SETTLEMENT_FUNCTION_ACL_MISMATCH';
  END IF;
END;
$verify$;

SELECT 'TEST_ONLY_RC494_SETTLEMENT_FUNCTION_ACL_OVERLAY=PASS' AS result;
