BEGIN;
CREATE OR REPLACE FUNCTION public.record_legal_consent_backend(
 p_user_id uuid,p_document_id uuid,p_document_version_id uuid,p_account_type text,p_agreement_id uuid DEFAULT NULL,p_ip_address text DEFAULT NULL,p_user_agent text DEFAULT NULL,
 p_device_info jsonb DEFAULT '{}'::jsonb,p_session_id text DEFAULT NULL,p_source text DEFAULT 'APP_EDGE',p_consent_status text DEFAULT 'ACCEPTED')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_doc public.legal_documents;v_ver public.legal_document_versions;v_consent uuid;v_integrity text;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'LEGAL_AUTH_REQUIRED'; END IF;
 IF upper(p_consent_status)<>'ACCEPTED' THEN RAISE EXCEPTION 'LEGAL_CONSENT_ONLY_ACCEPTED'; END IF;
 SELECT * INTO v_doc FROM public.legal_documents WHERE id=p_document_id AND status='PUBLISHED';IF NOT FOUND THEN RAISE EXCEPTION 'LEGAL_DOCUMENT_NOT_PUBLISHED';END IF;
 SELECT * INTO v_ver FROM public.legal_document_versions WHERE id=p_document_version_id AND document_id=p_document_id AND status='PUBLISHED';IF NOT FOUND THEN RAISE EXCEPTION 'LEGAL_VERSION_NOT_PUBLISHED';END IF;
 IF coalesce(v_ver.effective_at,v_ver.published_at,now())>now() THEN RAISE EXCEPTION 'LEGAL_VERSION_NOT_EFFECTIVE';END IF;
 IF NOT(v_doc.target_audience @> ARRAY['ALL']::text[] OR v_doc.target_audience @> ARRAY[upper(p_account_type)]::text[]) THEN RAISE EXCEPTION 'LEGAL_AUDIENCE_NOT_ALLOWED';END IF;
 INSERT INTO public.user_consents(user_id,account_type,document_id,document_version_id,agreement_id,consent_status,ip_address,user_agent,device_info,session_id,content_hash,source)
 VALUES(p_user_id,upper(p_account_type),p_document_id,p_document_version_id,p_agreement_id,'ACCEPTED',p_ip_address,p_user_agent,coalesce(p_device_info,'{}'::jsonb),p_session_id,v_ver.content_hash,upper(p_source)) RETURNING id INTO v_consent;
 v_integrity:=encode(digest(p_user_id::text||':'||v_consent::text||':'||p_document_version_id::text||':'||v_ver.content_hash||':'||clock_timestamp()::text,'sha256'),'hex');
 INSERT INTO public.consent_audit_log(user_id,account_type,document_id,document_version_id,agreement_id,consent_id,event_type,consent_status,content_hash,ip_address,user_agent,device_info,session_id,actor_user_id,integrity_hash)
 VALUES(p_user_id,upper(p_account_type),p_document_id,p_document_version_id,p_agreement_id,v_consent,'CONSENT_RECORDED','ACCEPTED',v_ver.content_hash,p_ip_address,p_user_agent,coalesce(p_device_info,'{}'::jsonb),p_session_id,p_user_id,v_integrity);
 RETURN jsonb_build_object('consent_id',v_consent,'document_id',p_document_id,'document_version_id',p_document_version_id,'content_hash',v_ver.content_hash,'consented_at',now());
END;$$;
REVOKE ALL ON FUNCTION public.record_legal_consent_backend(uuid,uuid,uuid,text,uuid,text,text,jsonb,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_legal_consent_backend(uuid,uuid,uuid,text,uuid,text,text,jsonb,text,text,text) TO service_role;
COMMIT;
