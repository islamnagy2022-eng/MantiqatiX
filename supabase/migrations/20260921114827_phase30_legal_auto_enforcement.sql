BEGIN;
CREATE OR REPLACE FUNCTION public.legal_publish_version(p_document_id uuid,p_version_number integer,p_effective_at timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;v_hash text;v_content text;v_type text;
BEGIN
 IF NOT public.legal_is_admin(auth.uid()) THEN RAISE EXCEPTION 'LEGAL_ADMIN_REQUIRED'; END IF;
 SELECT v.id,v.content,v.content_hash,d.document_type INTO v_id,v_content,v_hash,v_type
 FROM public.legal_document_versions v JOIN public.legal_documents d ON d.id=v.document_id
 WHERE v.document_id=p_document_id AND v.version_number=p_version_number AND v.status='DRAFT' FOR UPDATE;
 IF v_id IS NULL THEN RAISE EXCEPTION 'LEGAL_DRAFT_VERSION_NOT_FOUND'; END IF;
 IF length(trim(v_content))<1 OR upper(trim(v_content))='LEGAL_CONTENT_PENDING_APPROVAL' THEN RAISE EXCEPTION 'LEGAL_CONTENT_REQUIRED'; END IF;
 IF v_hash IS NULL OR length(v_hash)<32 THEN RAISE EXCEPTION 'LEGAL_CONTENT_HASH_REQUIRED'; END IF;
 UPDATE public.legal_document_versions SET status='PUBLISHED',published_at=coalesce(p_effective_at,now()),effective_at=coalesce(p_effective_at,now()) WHERE id=v_id;
 UPDATE public.legal_documents SET status='PUBLISHED',published_at=coalesce(p_effective_at,now()),effective_at=coalesce(p_effective_at,now()),updated_by=auth.uid(),updated_at=now() WHERE id=p_document_id;
 UPDATE public.legal_requirements SET enabled=true,updated_at=now() WHERE document_type=v_type AND required=true;
 INSERT INTO public.consent_audit_log(actor_user_id,event_type,document_id,document_version_id,event_at,metadata)
 VALUES(auth.uid(),'LEGAL_VERSION_PUBLISHED',p_document_id,v_id,now(),jsonb_build_object('version_number',p_version_number,'enforcement_enabled',true));
 RETURN jsonb_build_object('document_id',p_document_id,'version_id',v_id,'status','PUBLISHED','enforcement_enabled',true);
END;$$;
COMMIT;
