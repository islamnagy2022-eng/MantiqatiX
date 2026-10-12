BEGIN;
CREATE OR REPLACE FUNCTION private.legal_is_admin(p_user_id uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_memberships m WHERE m.user_id=coalesce(p_user_id,(SELECT auth.uid())) AND coalesce(m.status,'ACTIVE')='ACTIVE' AND upper(m.role) IN('SUPER_ADMIN','ADMIN','LEGAL_ADMIN'));
$$;
REVOKE ALL ON FUNCTION private.legal_is_admin(uuid) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.legal_is_admin(uuid) TO authenticated;
ALTER FUNCTION private.legal_is_admin(uuid) OWNER TO postgres;

DROP FUNCTION IF EXISTS public.legal_publish_version(uuid,integer,timestamptz);
CREATE OR REPLACE FUNCTION public.legal_publish_version(p_actor_user_id uuid,p_document_id uuid,p_version_number integer,p_effective_at timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_hash text;v_content text;v_type text;
BEGIN
 IF NOT private.legal_is_admin(p_actor_user_id) THEN RAISE EXCEPTION 'LEGAL_ADMIN_REQUIRED'; END IF;
 SELECT v.id,v.content,v.content_hash,d.document_type INTO v_id,v_content,v_hash,v_type FROM public.legal_document_versions v JOIN public.legal_documents d ON d.id=v.document_id WHERE v.document_id=p_document_id AND v.version_number=p_version_number AND v.status='DRAFT' FOR UPDATE;
 IF v_id IS NULL OR length(trim(v_content))<1 OR upper(trim(v_content))='LEGAL_CONTENT_PENDING_APPROVAL' THEN RAISE EXCEPTION 'LEGAL_CONTENT_REQUIRED'; END IF;
 IF v_hash IS NULL OR length(v_hash)<32 THEN RAISE EXCEPTION 'LEGAL_CONTENT_HASH_REQUIRED'; END IF;
 UPDATE public.legal_document_versions SET status='PUBLISHED',published_at=coalesce(p_effective_at,now()),effective_at=coalesce(p_effective_at,now()) WHERE id=v_id;
 UPDATE public.legal_documents SET status='PUBLISHED',published_at=coalesce(p_effective_at,now()),effective_at=coalesce(p_effective_at,now()),updated_by=p_actor_user_id,updated_at=now() WHERE id=p_document_id;
 UPDATE public.legal_requirements SET enabled=true,updated_at=now() WHERE document_type=v_type AND required=true;
 INSERT INTO public.consent_audit_log(actor_user_id,event_type,document_id,document_version_id,event_at,metadata) VALUES(p_actor_user_id,'LEGAL_VERSION_PUBLISHED',p_document_id,v_id,now(),jsonb_build_object('version_number',p_version_number,'enforcement_enabled',true));
 RETURN jsonb_build_object('document_id',p_document_id,'version_id',v_id,'status','PUBLISHED');
END;$$;
REVOKE ALL ON FUNCTION public.legal_publish_version(uuid,uuid,integer,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.legal_publish_version(uuid,uuid,integer,timestamptz) TO service_role;
COMMIT;
