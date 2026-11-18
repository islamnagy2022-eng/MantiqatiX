-- RC483: make Legal CMS document/version creation and its audit record atomic.
-- Remove the now-unneeded direct service-role INSERT surface introduced by RC481.
BEGIN;

CREATE FUNCTION public.legal_create_document_backend(
  p_actor_user_id uuid,
  p_document_type text,
  p_title text,
  p_target_audience text[],
  p_required_consent boolean,
  p_requires_reconsent boolean,
  p_sector_codes text[],
  p_locale text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_document_type text;
  v_title text;
  v_target_audience text[];
  v_sector_codes text[];
  v_locale text;
  v_id uuid;
  v_status text;
BEGIN
  PERFORM public.legal_assert_admin_backend(p_actor_user_id);

  v_document_type := upper(btrim(coalesce(p_document_type, '')));
  v_title := btrim(coalesce(p_title, ''));
  v_locale := coalesce(nullif(btrim(p_locale), ''), 'ar-EG');

  IF v_document_type = '' OR length(v_document_type) > 96 THEN
    RAISE EXCEPTION 'LEGAL_DOCUMENT_TYPE_INVALID';
  END IF;
  IF v_title = '' OR length(v_title) > 255 THEN
    RAISE EXCEPTION 'LEGAL_TITLE_INVALID';
  END IF;
  IF length(v_locale) > 16 THEN
    RAISE EXCEPTION 'LEGAL_LOCALE_INVALID';
  END IF;

  IF p_target_audience IS NULL THEN
    v_target_audience := ARRAY['ALL']::text[];
  ELSE
    SELECT coalesce(
      array_agg(DISTINCT upper(btrim(a.value)) ORDER BY upper(btrim(a.value))) FILTER (WHERE btrim(a.value) <> ''),
      ARRAY[]::text[]
    )
    INTO v_target_audience
    FROM unnest(p_target_audience) AS a(value);
  END IF;

  SELECT coalesce(
    array_agg(DISTINCT upper(btrim(a.value))) FILTER (WHERE btrim(a.value) <> ''),
    ARRAY[]::text[]
  )
  INTO v_sector_codes
  FROM unnest(coalesce(p_sector_codes, ARRAY[]::text[])) AS a(value);

  INSERT INTO public.legal_documents (
    document_type, title, target_audience, required_consent,
    requires_reconsent, sector_codes, locale, status, created_by, updated_by
  )
  VALUES (
    v_document_type, v_title, v_target_audience,
    coalesce(p_required_consent, false),
    coalesce(p_requires_reconsent, false),
    v_sector_codes, v_locale, 'DRAFT', p_actor_user_id, p_actor_user_id
  )
  RETURNING id, status INTO v_id, v_status;

  INSERT INTO public.consent_audit_log (
    actor_user_id, event_type, document_id, event_at, metadata
  )
  VALUES (
    p_actor_user_id, 'LEGAL_DOCUMENT_CREATED', v_id, now(),
    jsonb_build_object('document_type', v_document_type, 'title', v_title)
  );

  RETURN jsonb_build_object('id', v_id, 'status', v_status);
END;
$function$;

CREATE FUNCTION public.legal_create_draft_version_backend(
  p_actor_user_id uuid,
  p_document_id uuid,
  p_version_number integer,
  p_content text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_document_id uuid;
  v_id uuid;
  v_content text;
  v_hash text;
BEGIN
  PERFORM public.legal_assert_admin_backend(p_actor_user_id);

  IF p_document_id IS NULL THEN
    RAISE EXCEPTION 'LEGAL_DOCUMENT_REQUIRED';
  END IF;
  IF p_version_number IS NULL OR p_version_number < 1 THEN
    RAISE EXCEPTION 'LEGAL_VERSION_INVALID';
  END IF;

  v_content := coalesce(p_content, '');
  IF btrim(v_content) = '' THEN
    RAISE EXCEPTION 'LEGAL_CONTENT_REQUIRED';
  END IF;

  SELECT d.id
  INTO v_document_id
  FROM public.legal_documents d
  WHERE d.id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEGAL_DOCUMENT_NOT_FOUND';
  END IF;

  v_hash := pg_catalog.encode(extensions.digest(v_content, 'sha256'), 'hex');

  INSERT INTO public.legal_document_versions (
    document_id, version_number, content, content_hash, status, created_by
  )
  VALUES (
    v_document_id, p_version_number, v_content, v_hash, 'DRAFT', p_actor_user_id
  )
  RETURNING id INTO v_id;

  INSERT INTO public.consent_audit_log (
    actor_user_id, event_type, document_id, document_version_id, event_at, metadata
  )
  VALUES (
    p_actor_user_id, 'LEGAL_DRAFT_VERSION_CREATED', v_document_id, v_id, now(),
    jsonb_build_object('version_number', p_version_number, 'content_hash', v_hash)
  );

  RETURN jsonb_build_object(
    'id', v_id,
    'document_id', v_document_id,
    'version_number', p_version_number,
    'status', 'DRAFT',
    'content_hash', v_hash
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.legal_create_document_backend(uuid,text,text,text[],boolean,boolean,text[],text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.legal_create_document_backend(uuid,text,text,text[],boolean,boolean,text[],text) FROM anon;
REVOKE ALL ON FUNCTION public.legal_create_document_backend(uuid,text,text,text[],boolean,boolean,text[],text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.legal_create_document_backend(uuid,text,text,text[],boolean,boolean,text[],text) TO service_role;

REVOKE ALL ON FUNCTION public.legal_create_draft_version_backend(uuid,uuid,integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.legal_create_draft_version_backend(uuid,uuid,integer,text) FROM anon;
REVOKE ALL ON FUNCTION public.legal_create_draft_version_backend(uuid,uuid,integer,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.legal_create_draft_version_backend(uuid,uuid,integer,text) TO service_role;

-- RC481's direct INSERT grants are no longer needed: the Edge Function now
-- uses the two atomic, service-role-only RPCs above.
REVOKE INSERT (
  document_type, title, target_audience, required_consent, requires_reconsent,
  sector_codes, locale, status, created_by, updated_by
) ON TABLE public.legal_documents FROM service_role;

REVOKE INSERT (
  document_id, version_number, content, content_hash, status, created_by
) ON TABLE public.legal_document_versions FROM service_role;

REVOKE INSERT (
  actor_user_id, event_type, document_id, document_version_id, event_at, metadata
) ON TABLE public.consent_audit_log FROM service_role;

COMMIT;
