-- Preserve unrelated catalog_profile metadata when an owner edits their business profile.
-- Historical RC107 migration remains unchanged; this is a forward-only replacement.
BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_catalog_business_profile_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_branch_id character varying,
  p_name text,
  p_bio text,
  p_phone text,
  p_address text,
  p_governorate text,
  p_markaz text,
  p_village text,
  p_working_hours text,
  p_logo_url text,
  p_cover_url text,
  p_public_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_profile_id uuid;
  v_profile jsonb;
BEGIN
  IF v_uid IS NULL OR coalesce((auth.jwt()->>'is_anonymous'), 'false') = 'true' THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF nullif(trim(p_name), '') IS NULL OR length(trim(p_name)) > 200
     OR length(coalesce(p_bio, '')) > 3000
     OR length(coalesce(p_phone, '')) > 40
     OR length(coalesce(p_address, '')) > 500
     OR length(coalesce(p_governorate, '')) > 100
     OR length(coalesce(p_markaz, '')) > 100
     OR length(coalesce(p_village, '')) > 100
     OR length(coalesce(p_working_hours, '')) > 300
     OR length(coalesce(p_logo_url, '')) > 1500
     OR length(coalesce(p_cover_url, '')) > 1500 THEN
    RAISE EXCEPTION 'INVALID_BUSINESS_PROFILE';
  END IF;

  IF nullif(trim(coalesce(p_logo_url, '')), '') IS NOT NULL
     AND trim(p_logo_url) !~* '^https://' THEN
    RAISE EXCEPTION 'INVALID_LOGO_URL';
  END IF;
  IF nullif(trim(coalesce(p_cover_url, '')), '') IS NOT NULL
     AND trim(p_cover_url) !~* '^https://' THEN
    RAISE EXCEPTION 'INVALID_COVER_URL';
  END IF;

  SELECT upper(m.role::text) INTO v_role
    FROM public.user_memberships m
   WHERE m.user_id = v_uid AND m.tenant_id = p_tenant_id
     AND m.status = 'ACTIVE'
     AND (
       (upper(m.role::text) = 'SUPER_ADMIN'
          AND coalesce(m.permissions->>'scope', '') = 'PLATFORM'
          AND coalesce((m.permissions->>'full_control')::boolean, false) = true
          AND m.business_id IS NULL)
       OR (upper(m.role::text) IN ('OWNER','BUSINESS_OWNER','ADMIN')
          AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
          AND m.branch_id IS NULL)
     )
   ORDER BY CASE upper(m.role::text)
     WHEN 'SUPER_ADMIN' THEN 0 WHEN 'OWNER' THEN 1 WHEN 'BUSINESS_OWNER' THEN 2
     WHEN 'ADMIN' THEN 3 WHEN 'MANAGER' THEN 4 ELSE 99 END
   LIMIT 1;

  IF v_role IS NULL THEN RAISE EXCEPTION 'CATALOG_PROFILE_WRITE_FORBIDDEN'; END IF;
  IF coalesce(p_public_enabled, false) AND v_role = 'MANAGER' THEN
    RAISE EXCEPTION 'CATALOG_PUBLISH_REQUIRES_OWNER';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
     WHERE b.id = p_business_id AND b.tenant_id = p_tenant_id
       AND upper(coalesce(b.status, '')) = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'BUSINESS_NOT_ACTIVE'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches br
     WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
       AND br.business_id = p_business_id AND upper(coalesce(br.status, '')) = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH'; END IF;

  SELECT p.id INTO v_profile_id
    FROM public.marketing_provider_profiles p
   WHERE p.business_id = p_business_id AND upper(p.status) = 'ACTIVE'
   ORDER BY p.updated_at DESC NULLS LAST LIMIT 1;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'ACTIVE_PROVIDER_PROFILE_REQUIRED'; END IF;

  -- Lock the row and preserve profile keys written by other production features
  -- (Google Maps, contact metadata, catalog display preferences, and future fields).
  SELECT CASE
           WHEN jsonb_typeof(b.settings->'catalog_profile') = 'object'
             THEN b.settings->'catalog_profile'
           ELSE '{}'::jsonb
         END
    INTO v_profile
    FROM public.businesses b
   WHERE b.id = p_business_id
     AND b.tenant_id = p_tenant_id
     AND upper(coalesce(b.status, '')) = 'ACTIVE'
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_NOT_ACTIVE'; END IF;

  v_profile := coalesce(v_profile, '{}'::jsonb) || jsonb_build_object(
    'bio', trim(coalesce(p_bio, '')),
    'governorate', trim(coalesce(p_governorate, '')),
    'markaz', trim(coalesce(p_markaz, '')),
    'village', trim(coalesce(p_village, '')),
    'working_hours', trim(coalesce(p_working_hours, '')),
    'logo_url', trim(coalesce(p_logo_url, '')),
    'cover_url', trim(coalesce(p_cover_url, ''))
  );

  UPDATE public.businesses b
     SET name = trim(p_name),
         settings = jsonb_set(
           coalesce(b.settings, '{}'::jsonb),
           '{catalog_profile}', v_profile, true
         ),
         updated_at = now()
   WHERE b.id = p_business_id AND b.tenant_id = p_tenant_id;

  UPDATE public.marketing_provider_profiles p
     SET name_ar = trim(p_name),
         description = nullif(trim(coalesce(p_bio, '')), ''),
         updated_at = now()
   WHERE p.id = v_profile_id;

  UPDATE public.branches br
     SET phone = nullif(trim(coalesce(p_phone, '')), ''),
         address = nullif(trim(coalesce(p_address, '')), ''),
         updated_at = now()
   WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
     AND br.business_id = p_business_id;

  RETURN jsonb_build_object(
    'success', true, 'businessId', p_business_id, 'providerProfileId', v_profile_id,
    'branchId', p_branch_id, 'name', trim(p_name),
    'publicEnabled', coalesce(p_public_enabled, false)
  );
END
$function$;

REVOKE ALL ON FUNCTION public.upsert_catalog_business_profile_backend(character varying, uuid, character varying, text, text, text, text, text, text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_catalog_business_profile_backend(character varying, uuid, character varying, text, text, text, text, text, text, text, text, text, text, boolean) TO authenticated;

COMMIT;
