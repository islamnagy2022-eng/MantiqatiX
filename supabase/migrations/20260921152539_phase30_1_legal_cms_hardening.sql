BEGIN;

CREATE OR REPLACE FUNCTION public.legal_update_document(
  p_actor_user_id uuid,
  p_document_id uuid,
  p_title text,
  p_target_audience text[],
  p_required_consent boolean,
  p_requires_reconsent boolean,
  p_sector_codes text[] DEFAULT ARRAY[]::text[],
  p_locale text DEFAULT 'ar-EG'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_doc public.legal_documents;
BEGIN
  IF NOT private.legal_is_admin(p_actor_user_id) THEN RAISE EXCEPTION 'LEGAL_ADMIN_REQUIRED'; END IF;
  SELECT * INTO v_doc FROM public.legal_documents WHERE id=p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEGAL_DOCUMENT_NOT_FOUND'; END IF;
  IF v_doc.status='RETIRED' THEN RAISE EXCEPTION 'LEGAL_DOCUMENT_RETIRED'; END IF;
  IF nullif(trim(coalesce(p_title,'')),'') IS NULL THEN RAISE EXCEPTION 'LEGAL_TITLE_REQUIRED'; END IF;
  UPDATE public.legal_documents
     SET title=trim(p_title),
         target_audience=coalesce(p_target_audience,ARRAY['ALL']::text[]),
         required_consent=coalesce(p_required_consent,false),
         requires_reconsent=coalesce(p_requires_reconsent,false),
         sector_codes=coalesce(p_sector_codes,ARRAY[]::text[]),
         locale=coalesce(nullif(trim(p_locale),''),'ar-EG'),
         updated_by=p_actor_user_id,
         updated_at=now()
   WHERE id=p_document_id;
  INSERT INTO public.consent_audit_log(actor_user_id,event_type,document_id,event_at,metadata)
  VALUES(p_actor_user_id,'LEGAL_DOCUMENT_UPDATED',p_document_id,now(),jsonb_build_object('title',trim(p_title)));
  SELECT * INTO v_doc FROM public.legal_documents WHERE id=p_document_id;
  RETURN jsonb_build_object('id',v_doc.id,'status',v_doc.status,'updated_at',v_doc.updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_update_draft_version(
  p_actor_user_id uuid,
  p_version_id uuid,
  p_content text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_version public.legal_document_versions; v_hash text;
BEGIN
  IF NOT private.legal_is_admin(p_actor_user_id) THEN RAISE EXCEPTION 'LEGAL_ADMIN_REQUIRED'; END IF;
  IF nullif(trim(coalesce(p_content,'')),'') IS NULL THEN RAISE EXCEPTION 'LEGAL_CONTENT_REQUIRED'; END IF;
  SELECT * INTO v_version FROM public.legal_document_versions WHERE id=p_version_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEGAL_VERSION_NOT_FOUND'; END IF;
  IF v_version.status<>'DRAFT' THEN RAISE EXCEPTION 'LEGAL_VERSION_NOT_DRAFT'; END IF;
  v_hash:=encode(digest(p_content,'sha256'),'hex');
  UPDATE public.legal_document_versions SET content=p_content, content_hash=v_hash WHERE id=p_version_id;
  INSERT INTO public.consent_audit_log(actor_user_id,event_type,document_id,document_version_id,event_at,metadata)
  VALUES(p_actor_user_id,'LEGAL_DRAFT_VERSION_UPDATED',v_version.document_id,p_version_id,now(),jsonb_build_object('version_number',v_version.version_number,'content_hash',v_hash));
  RETURN jsonb_build_object('id',p_version_id,'content_hash',v_hash,'status','DRAFT');
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_suspend_document(
  p_actor_user_id uuid,
  p_document_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_doc public.legal_documents; v_previous_status text;
BEGIN
  IF NOT private.legal_is_admin(p_actor_user_id) THEN RAISE EXCEPTION 'LEGAL_ADMIN_REQUIRED'; END IF;
  SELECT * INTO v_doc FROM public.legal_documents WHERE id=p_document_id FOR UPDATE;
  IF NOT FOUND OR v_doc.status NOT IN('PUBLISHED','DRAFT') THEN RAISE EXCEPTION 'LEGAL_DOCUMENT_NOT_FOUND_OR_ALREADY_RETIRED'; END IF;
  v_previous_status:=v_doc.status;
  UPDATE public.legal_documents SET status='SUSPENDED',updated_by=p_actor_user_id,updated_at=now() WHERE id=p_document_id;
  INSERT INTO public.consent_audit_log(actor_user_id,event_type,document_id,event_at,metadata)
  VALUES(p_actor_user_id,'LEGAL_DOCUMENT_SUSPENDED',p_document_id,now(),jsonb_build_object('previous_status',v_previous_status));
  RETURN jsonb_build_object('id',p_document_id,'status','SUSPENDED');
END;
$$;

REVOKE ALL ON FUNCTION public.legal_update_document(uuid,uuid,text,text[],boolean,boolean,text[],text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.legal_update_draft_version(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.legal_suspend_document(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.legal_update_document(uuid,uuid,text,text[],boolean,boolean,text[],text) TO service_role;
GRANT EXECUTE ON FUNCTION public.legal_update_draft_version(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.legal_suspend_document(uuid,uuid) TO service_role;

COMMIT;
