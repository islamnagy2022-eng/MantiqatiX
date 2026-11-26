-- RC928: atomically persist approved catalog profile metadata with the
-- canonical business-profile upsert. This prevents a separate service-role
-- read/merge/write from overwriting concurrent owner profile changes.
BEGIN;

DO $preflight$
BEGIN
  IF pg_catalog.to_regprocedure(
    'public.upsert_catalog_business_profile_backend(character varying,uuid,character varying,text,text,text,text,text,text,text,text,text,text,boolean)'
  ) IS NULL THEN
    RAISE EXCEPTION 'RC928_BASE_CATALOG_PROFILE_RPC_MISSING';
  END IF;
END
$preflight$;

CREATE OR REPLACE FUNCTION public.upsert_catalog_business_profile_atomic_backend(
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
  p_public_enabled boolean,
  p_profile_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_metadata jsonb := coalesce(p_profile_metadata, '{}'::jsonb);
  v_key text;
  v_url text;
  v_authority text;
  v_urls text[] := ARRAY[]::text[];
  v_profile jsonb;
  v_logo_source text;
  v_cover_source text;
  v_previous_public_contact_enabled boolean := false;
  v_result jsonb;
  v_rows integer;
BEGIN
  -- This wrapper is deliberately stricter than legacy compatibility RPCs:
  -- missing identity claims and Anonymous Auth sessions must fail closed.
  IF v_uid IS NULL OR (auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF pg_catalog.jsonb_typeof(v_metadata) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_CATALOG_PROFILE_METADATA';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_object_keys(v_metadata) AS item(key)
     WHERE item.key NOT IN (
       'facebook_url',
       'instagram_url',
       'tiktok_url',
       'additional_contact_phones',
       'promotional_images',
       'public_contact_enabled'
     )
  ) THEN
    RAISE EXCEPTION 'UNSUPPORTED_CATALOG_PROFILE_METADATA_KEY';
  END IF;

  -- Social profile URLs are navigational links, never server-fetched resources.
  FOREACH v_key IN ARRAY ARRAY['facebook_url', 'instagram_url', 'tiktok_url'] LOOP
    IF v_metadata ? v_key THEN
      IF pg_catalog.jsonb_typeof(v_metadata->v_key) NOT IN ('string', 'null') THEN
        RAISE EXCEPTION 'INVALID_SOCIAL_PROFILE_METADATA';
      END IF;
      v_url := v_metadata->>v_key;
      IF v_url IS NOT NULL THEN
        v_authority := (pg_catalog.regexp_match(v_url, '^https?://([^/?#]+)'))[1];
        IF pg_catalog.length(v_url) > 1000
           OR v_url !~* '^https?://'
           OR v_authority IS NULL
           OR v_authority = ''
           OR v_authority ~ '@'
           OR v_authority ~ '[[:space:]]' THEN
          RAISE EXCEPTION 'INVALID_SOCIAL_PROFILE_METADATA';
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF v_metadata ? 'additional_contact_phones' THEN
    IF pg_catalog.jsonb_typeof(v_metadata->'additional_contact_phones') <> 'array'
       OR pg_catalog.jsonb_array_length(v_metadata->'additional_contact_phones') > 20 THEN
      RAISE EXCEPTION 'INVALID_ADDITIONAL_CONTACT_PHONES';
    END IF;
    IF EXISTS (
      SELECT 1
        FROM pg_catalog.jsonb_array_elements(v_metadata->'additional_contact_phones') AS item(value)
       WHERE pg_catalog.jsonb_typeof(item.value) <> 'string'
          OR pg_catalog.length(item.value #>> '{}') > 40
          OR pg_catalog.length(pg_catalog.regexp_replace(item.value #>> '{}', '[^0-9]', '', 'g')) NOT BETWEEN 10 AND 15
    ) THEN
      RAISE EXCEPTION 'INVALID_ADDITIONAL_CONTACT_PHONES';
    END IF;
  END IF;

  IF v_metadata ? 'promotional_images' THEN
    IF pg_catalog.jsonb_typeof(v_metadata->'promotional_images') <> 'array'
       OR pg_catalog.jsonb_array_length(v_metadata->'promotional_images') > 10 THEN
      RAISE EXCEPTION 'INVALID_PROMOTIONAL_IMAGES';
    END IF;
    IF EXISTS (
      SELECT 1
        FROM pg_catalog.jsonb_array_elements(v_metadata->'promotional_images') AS item(value)
       WHERE pg_catalog.jsonb_typeof(item.value) <> 'string'
    ) THEN
      RAISE EXCEPTION 'INVALID_PROMOTIONAL_IMAGE_URL';
    END IF;

    FOR v_url IN
      SELECT pg_catalog.jsonb_array_elements_text(v_metadata->'promotional_images')
    LOOP
      IF v_url IS NULL
         OR v_url <> pg_catalog.btrim(v_url)
         OR pg_catalog.length(v_url) > 1500
         OR v_url ~ '[[:space:]]'
         OR v_url !~* '^https://' THEN
        RAISE EXCEPTION 'INVALID_PROMOTIONAL_IMAGE_URL';
      END IF;

      v_authority := (pg_catalog.regexp_match(v_url, '^https://([^/?#]+)'))[1];
      IF v_authority IS NULL
         OR v_authority !~ '^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$'
         OR v_authority ~ '\.\.'
         OR v_authority ~ '\.-|\.-'
         OR v_authority ~ '^[0-9.]+$'
         OR pg_catalog.lower(v_authority) = 'localhost'
         OR pg_catalog.lower(v_authority) LIKE '%.localhost'
         OR pg_catalog.lower(v_authority) LIKE '%.local' THEN
        RAISE EXCEPTION 'INVALID_PROMOTIONAL_IMAGE_URL';
      END IF;

      IF pg_catalog.array_position(v_urls, v_url) IS NULL THEN
        v_urls := pg_catalog.array_append(v_urls, v_url);
      END IF;
    END LOOP;

    -- Deduplicate again at the database boundary; clients are not trusted.
    v_metadata := pg_catalog.jsonb_set(v_metadata, '{promotional_images}', pg_catalog.to_jsonb(v_urls), true);
  END IF;

  IF v_metadata ? 'public_contact_enabled' THEN
    IF pg_catalog.jsonb_typeof(v_metadata->'public_contact_enabled') <> 'boolean' THEN
      RAISE EXCEPTION 'INVALID_PUBLIC_CONTACT_CONSENT';
    END IF;
    -- Consent is not publicly active until the separate durable audit insert
    -- and compare-and-set activation in catalog-admin succeed.
    v_metadata := v_metadata || pg_catalog.jsonb_build_object(
      'public_contact_consent_audit_verified', false
    );
  END IF;

  v_logo_source := CASE
    WHEN NULLIF(pg_catalog.btrim(coalesce(p_logo_url, '')), '') IS NULL THEN 'auto'
    WHEN pg_catalog.strpos(pg_catalog.lower(p_logo_url), '/catalog-ai/')  > 0 THEN 'ai'
    WHEN pg_catalog.lower(p_logo_url) ~ '(business-cover-placeholder|business-placeholder|catalog-item-placeholder)\.svg|/legacy/(activity|activities)/' THEN 'auto'
    ELSE 'owner'
  END;
  v_cover_source := CASE
    WHEN NULLIF(pg_catalog.btrim(coalesce(p_cover_url, '')), '') IS NULL THEN 'auto'
    WHEN pg_catalog.strpos(pg_catalog.lower(p_cover_url), '/catalog-ai/')  > 0 THEN 'ai'
    WHEN pg_catalog.lower(p_cover_url) ~ '(business-cover-placeholder|business-placeholder|catalog-item-placeholder)\.svg|/legacy/(activity|activities)/' THEN 'auto'
    ELSE 'owner'
  END;
  v_metadata := v_metadata || pg_catalog.jsonb_build_object(
    'logo_image_source', v_logo_source,
    'cover_image_source', v_cover_source
  );

  -- The existing RPC performs exact ACTIVE membership, tenant/business/branch,
  -- provider-profile and owner/admin checks, then locks the business row FOR UPDATE.
  -- Its row lock is retained for this entire outer RPC transaction.
  v_result := public.upsert_catalog_business_profile_backend(
    p_tenant_id, p_business_id, p_branch_id,
    p_name, p_bio, p_phone, p_address,
    p_governorate, p_markaz, p_village, p_working_hours,
    p_logo_url, p_cover_url, p_public_enabled
  );

  SELECT coalesce((b.settings->'catalog_profile'->>'public_contact_enabled') = 'true', false),
         CASE
           WHEN pg_catalog.jsonb_typeof(b.settings->'catalog_profile') = 'object'
             THEN b.settings->'catalog_profile'
           ELSE '{}'::jsonb
         END
    INTO v_previous_public_contact_enabled, v_profile
    FROM public.businesses b
   WHERE b.id = p_business_id
     AND b.tenant_id = p_tenant_id
     AND pg_catalog.upper(coalesce(b.status, '')) = 'ACTIVE'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BUSINESS_NOT_ACTIVE';
  END IF;

  UPDATE public.businesses b
     SET settings = pg_catalog.jsonb_set(
           coalesce(b.settings, '{}'::jsonb),
           '{catalog_profile}',
           coalesce(v_profile, '{}'::jsonb) || v_metadata,
           true
         ),
         updated_at = pg_catalog.now()
   WHERE b.id = p_business_id
     AND b.tenant_id = p_tenant_id
     AND pg_catalog.upper(coalesce(b.status, '')) = 'ACTIVE';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'BUSINESS_PROFILE_METADATA_WRITE_FAILED';
  END IF;

  RETURN coalesce(v_result, '{}'::jsonb) || pg_catalog.jsonb_build_object(
    'previousPublicContactEnabled', v_previous_public_contact_enabled
  );
END
$function$;

REVOKE ALL ON FUNCTION public.upsert_catalog_business_profile_atomic_backend(
  character varying, uuid, character varying, text, text, text, text, text,
  text, text, text, text, text, boolean, jsonb
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.upsert_catalog_business_profile_atomic_backend(
  character varying, uuid, character varying, text, text, text, text, text,
  text, text, text, text, text, boolean, jsonb
) TO authenticated;

COMMIT;
