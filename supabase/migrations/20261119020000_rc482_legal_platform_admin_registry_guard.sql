-- RC482: make the protected platform-admin registry the sole root authority
-- for global Legal CMS actions. Business-scoped ADMIN/OWNER memberships and
-- delegated LEGAL_ADMIN labels must not imply platform-wide legal authority.
BEGIN;

-- Keep the existing UUID signature (and its authenticated grant/policy
-- dependencies). Its NULL default preserves no-argument callers. Remove the
-- redundant zero-argument overload, which makes legal_is_admin() ambiguous.
CREATE OR REPLACE FUNCTION private.legal_is_admin(p_user_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM private.platform_admins pa
    WHERE pa.user_id = coalesce(p_user_id, (SELECT auth.uid()))
      AND (
        (SELECT auth.uid()) IS NULL
        OR p_user_id IS NULL
        OR p_user_id = (SELECT auth.uid())
      )
  );
$function$;

DROP FUNCTION IF EXISTS private.legal_is_admin();

CREATE OR REPLACE FUNCTION public.legal_assert_admin_backend(p_actor_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF p_actor_user_id IS NULL
     OR NOT private.legal_is_admin(p_actor_user_id) THEN
    RAISE EXCEPTION 'LEGAL_ADMIN_REQUIRED';
  END IF;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.legal_assert_admin_backend(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.legal_assert_admin_backend(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.legal_assert_admin_backend(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.legal_assert_admin_backend(uuid) TO service_role;

COMMIT;
