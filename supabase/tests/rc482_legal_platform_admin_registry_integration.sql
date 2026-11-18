-- Run after the RC482 fixture and migration in disposable PostgreSQL.
DO $acl$
BEGIN
  IF has_function_privilege('anon','private.legal_is_admin()','EXECUTE') THEN
    RAISE EXCEPTION 'RC482_ANON_MUST_NOT_EXECUTE_PRIVATE_LEGAL_ADMIN';
  END IF;
  IF NOT has_function_privilege('authenticated','private.legal_is_admin()','EXECUTE')
     OR NOT has_function_privilege('authenticated','private.legal_is_admin(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'RC482_EXISTING_AUTHENTICATED_HELPER_EXECUTE_CHANGED';
  END IF;
  IF has_function_privilege('anon','public.legal_assert_admin_backend(uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.legal_assert_admin_backend(uuid)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.legal_assert_admin_backend(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'RC482_BACKEND_ASSERTION_RPC_ACL_INVALID';
  END IF;
  IF has_table_privilege('authenticated','private.platform_admins','SELECT')
     OR has_table_privilege('authenticated','private.platform_admins','INSERT')
     OR has_table_privilege('authenticated','private.platform_admins','UPDATE')
     OR has_table_privilege('authenticated','private.platform_admins','DELETE')
     OR has_table_privilege('service_role','private.platform_admins','SELECT') THEN
    RAISE EXCEPTION 'RC482_PLATFORM_ADMIN_REGISTRY_DIRECT_ACCESS_EXPOSED';
  END IF;
END;
$acl$;

-- Membership labels alone must not grant global legal authority.
DO $membership$
BEGIN
  IF private.legal_is_admin('20000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'RC482_BUSINESS_ADMIN_ESCALATED_TO_GLOBAL_LEGAL_ADMIN';
  END IF;
  IF private.legal_is_admin('30000000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'RC482_LEGAL_ADMIN_LABEL_ESCALATED_WITHOUT_ROOT_REGISTRY';
  END IF;
  IF private.legal_is_admin('40000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'RC482_TENANT_SUPER_ADMIN_ESCALATED_TO_GLOBAL_LEGAL_ADMIN';
  END IF;
  IF NOT private.legal_is_admin('10000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'RC482_PLATFORM_ADMIN_REGISTRY_ACTOR_REJECTED';
  END IF;
END;
$membership$;

-- Authenticated RLS helper is bound to the JWT actor, not an arbitrary UUID.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
DO $authenticated$
BEGIN
  IF private.legal_is_admin() THEN
    RAISE EXCEPTION 'RC482_AUTHENTICATED_BUSINESS_ADMIN_GOT_GLOBAL_LEGAL_AUTHORITY';
  END IF;
  IF private.legal_is_admin('10000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'RC482_AUTHENTICATED_ACTOR_IMPERSONATED_PLATFORM_ADMIN';
  END IF;
END;
$authenticated$;
RESET ROLE;
RESET request.jwt.claim.sub;

-- The service-role Edge assertion accepts only the protected registry actor.
SET ROLE service_role;
DO $service$
BEGIN
  IF NOT public.legal_assert_admin_backend('10000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'RC482_PLATFORM_ADMIN_EDGE_ASSERTION_FAILED';
  END IF;
  BEGIN
    PERFORM public.legal_assert_admin_backend('20000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'RC482_BUSINESS_ADMIN_EDGE_ASSERTION_SUCCEEDED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'LEGAL_ADMIN_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.legal_assert_admin_backend('30000000-0000-4000-8000-000000000003');
    RAISE EXCEPTION 'RC482_LEGAL_ADMIN_LABEL_EDGE_ASSERTION_SUCCEEDED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'LEGAL_ADMIN_REQUIRED' THEN RAISE; END IF;
  END;
END;
$service$;
RESET ROLE;

SELECT 'RC482 Legal platform-admin registry authorization: PASS' AS result;
