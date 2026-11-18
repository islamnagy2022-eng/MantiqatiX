-- RC482: make the canonical platform-admin registry the sole authority
-- for Legal CMS write access. The caller identity is derived from a verified
-- access token by the Edge Function; this RPC is service_role-only.
BEGIN;

CREATE OR REPLACE FUNCTION public.legal_cms_is_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM private.platform_admins AS pa
    WHERE pa.user_id = p_user_id
  );
$function$;

REVOKE ALL ON FUNCTION public.legal_cms_is_platform_admin(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legal_cms_is_platform_admin(uuid)
  TO service_role;

COMMIT;
