BEGIN;
CREATE OR REPLACE FUNCTION public.legal_assert_action(p_user_id uuid,p_action_key text,p_business_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_audience text;v_req record;v_doc record;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'LEGAL_AUTH_REQUIRED'; END IF;
 IF (SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) IS DISTINCT FROM p_user_id AND NOT private.legal_is_admin(p_user_id) THEN RAISE EXCEPTION 'LEGAL_AUTH_MISMATCH'; END IF;
 SELECT upper(m.role) INTO v_audience FROM public.user_memberships m WHERE m.user_id=p_user_id AND coalesce(m.status,'ACTIVE')='ACTIVE'
 AND(p_business_id IS NULL OR m.business_id=p_business_id OR m.business_id IS NULL) ORDER BY CASE WHEN m.business_id=p_business_id THEN 0 ELSE 1 END LIMIT 1;
 v_audience:=coalesce(v_audience,'CUSTOMER');
 FOR v_req IN SELECT * FROM public.legal_requirements WHERE action_key=p_action_key AND enabled AND required LOOP
   SELECT * INTO v_doc FROM public.legal_effective_version(v_req.document_type,v_req.target_audience,p_business_id);
   IF NOT FOUND THEN RAISE EXCEPTION 'LEGAL_DOCUMENT_NOT_PUBLISHED:%',v_req.document_type; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.user_consents c WHERE c.user_id=p_user_id AND c.document_id=v_doc.document_id AND c.document_version_id=v_doc.version_id AND c.consent_status='ACCEPTED' AND c.content_hash=v_doc.content_hash)
   THEN RAISE EXCEPTION 'LEGAL_CONSENT_REQUIRED:%:%',v_req.document_type,v_doc.version_id; END IF;
 END LOOP;
 RETURN jsonb_build_object('allowed',true,'action_key',p_action_key,'audience',v_audience);
END;$$;
COMMIT;
