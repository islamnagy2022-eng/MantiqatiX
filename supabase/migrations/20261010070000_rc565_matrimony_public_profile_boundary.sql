-- RC565: separate public matrimony discovery fields from private contact/profile data.
-- Source-only until review, isolated tests, and an approved production release.
-- Direct table SELECT is owner-only; discovery returns an explicit allowlist for verified profiles.

DROP POLICY IF EXISTS matrimony_profiles_select ON public.matrimony_profiles;

CREATE POLICY matrimony_profiles_select_owner
ON public.matrimony_profiles
FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.list_matrimony_public_profiles_backend(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  pseudonym text,
  age integer,
  city text,
  education text,
  occupation text,
  marital_status text,
  is_verified boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_anonymous boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  v_limit integer := pg_catalog.least(pg_catalog.greatest(coalesce(p_limit, 50), 1), 100);
BEGIN
  IF v_user_id IS NULL OR v_is_anonymous THEN
    RAISE EXCEPTION 'AUTHENTICATED_USER_REQUIRED';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.pseudonym,
    p.age,
    p.city,
    p.education,
    p.occupation,
    p.marital_status,
    p.is_verified,
    p.created_at
  FROM public.matrimony_profiles AS p
  WHERE p.is_verified IS TRUE
  ORDER BY p.created_at DESC, p.id
  LIMIT v_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_matrimony_public_profiles_backend(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_matrimony_public_profiles_backend(integer) TO authenticated;
