-- Run after RC482 fixture and migration in disposable PostgreSQL.
DO $acl$
BEGIN
  IF NOT has_function_privilege('service_role','public.legal_cms_is_platform_admin(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'RC482_SERVICE_ROLE_EXECUTE_MISSING';
  END IF;
  IF has_function_privilege('anon','public.legal_cms_is_platform_admin(uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.legal_cms_is_platform_admin(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'RC482_UNTRUSTED_EXECUTE_GRANTED';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.legal_cms_is_platform_admin(uuid)'::regprocedure) THEN
    RAISE EXCEPTION 'RC482_FUNCTION_NOT_SECURITY_DEFINER';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid='public.legal_cms_is_platform_admin(uuid)'::regprocedure
      AND p.proconfig @> ARRAY['search_path=""']
  ) THEN
    RAISE EXCEPTION 'RC482_SEARCH_PATH_NOT_EMPTY';
  END IF;
END;
$acl$;

SET ROLE service_role;
DO $authorization$
BEGIN
  IF public.legal_cms_is_platform_admin('11111111-1111-4111-8111-111111111111') IS NOT TRUE THEN
    RAISE EXCEPTION 'RC482_REGISTERED_PLATFORM_ADMIN_DENIED';
  END IF;
  IF public.legal_cms_is_platform_admin('22222222-2222-4222-8222-222222222222') IS NOT FALSE THEN
    RAISE EXCEPTION 'RC482_TENANT_ADMIN_WITHOUT_REGISTRY_ALLOWED';
  END IF;
  IF public.legal_cms_is_platform_admin('33333333-3333-4333-8333-333333333333') IS NOT FALSE THEN
    RAISE EXCEPTION 'RC482_MEMBERSHIP_ROLE_WITHOUT_REGISTRY_ALLOWED';
  END IF;
  IF public.legal_cms_is_platform_admin('44444444-4444-4444-8444-444444444444') IS NOT FALSE THEN
    RAISE EXCEPTION 'RC482_UNKNOWN_USER_ALLOWED';
  END IF;
END;
$authorization$;
RESET ROLE;

SELECT 'RC482 canonical Legal CMS platform-admin authorization: PASS' AS result;
