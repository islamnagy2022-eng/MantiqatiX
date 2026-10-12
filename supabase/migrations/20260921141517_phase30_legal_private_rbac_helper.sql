BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.legal_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(
   SELECT 1 FROM public.user_memberships m
   WHERE m.user_id=(SELECT auth.uid()) AND coalesce(m.status,'ACTIVE')='ACTIVE'
     AND upper(m.role) IN('SUPER_ADMIN','ADMIN','LEGAL_ADMIN')
 );
$$;
REVOKE ALL ON FUNCTION private.legal_is_admin() FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.legal_is_admin() TO authenticated;
ALTER FUNCTION private.legal_is_admin() OWNER TO postgres;

DROP POLICY IF EXISTS legal_documents_public_read ON public.legal_documents;
DROP POLICY IF EXISTS legal_documents_admin_write ON public.legal_documents;
DROP POLICY IF EXISTS legal_versions_public_read ON public.legal_document_versions;
DROP POLICY IF EXISTS legal_versions_admin_write ON public.legal_document_versions;
DROP POLICY IF EXISTS agreements_participant_read ON public.agreements;
DROP POLICY IF EXISTS agreements_admin_write ON public.agreements;
DROP POLICY IF EXISTS agreement_participants_read ON public.agreement_participants;
DROP POLICY IF EXISTS agreement_participants_admin_write ON public.agreement_participants;
DROP POLICY IF EXISTS user_consents_own_read ON public.user_consents;
DROP POLICY IF EXISTS consent_audit_own_read ON public.consent_audit_log;
DROP POLICY IF EXISTS requirements_admin_all ON public.legal_requirements;

CREATE POLICY legal_documents_public_read ON public.legal_documents FOR SELECT TO anon,authenticated USING(status='PUBLISHED' OR (SELECT private.legal_is_admin()));
CREATE POLICY legal_documents_admin_write ON public.legal_documents FOR ALL TO authenticated USING((SELECT private.legal_is_admin())) WITH CHECK((SELECT private.legal_is_admin()));
CREATE POLICY legal_versions_public_read ON public.legal_document_versions FOR SELECT TO anon,authenticated USING(status='PUBLISHED' OR (SELECT private.legal_is_admin()));
CREATE POLICY legal_versions_admin_write ON public.legal_document_versions FOR ALL TO authenticated USING((SELECT private.legal_is_admin())) WITH CHECK((SELECT private.legal_is_admin()));
CREATE POLICY agreements_participant_read ON public.agreements FOR SELECT TO authenticated USING((SELECT private.legal_is_admin()) OR EXISTS(SELECT 1 FROM public.agreement_participants ap WHERE ap.agreement_id=id AND ap.user_id=(SELECT auth.uid())));
CREATE POLICY agreements_admin_write ON public.agreements FOR ALL TO authenticated USING((SELECT private.legal_is_admin())) WITH CHECK((SELECT private.legal_is_admin()));
CREATE POLICY agreement_participants_read ON public.agreement_participants FOR SELECT TO authenticated USING((SELECT private.legal_is_admin()) OR user_id=(SELECT auth.uid()));
CREATE POLICY agreement_participants_admin_write ON public.agreement_participants FOR ALL TO authenticated USING((SELECT private.legal_is_admin())) WITH CHECK((SELECT private.legal_is_admin()));
CREATE POLICY user_consents_own_read ON public.user_consents FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR (SELECT private.legal_is_admin()));
CREATE POLICY consent_audit_own_read ON public.consent_audit_log FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR (SELECT private.legal_is_admin()));
CREATE POLICY requirements_admin_all ON public.legal_requirements FOR ALL TO authenticated USING((SELECT private.legal_is_admin())) WITH CHECK((SELECT private.legal_is_admin()));

CREATE OR REPLACE FUNCTION public.legal_publish_version(p_document_id uuid,p_version_number integer,p_effective_at timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_hash text;v_content text;v_type text;
BEGIN
 IF NOT private.legal_is_admin() THEN RAISE EXCEPTION 'LEGAL_ADMIN_REQUIRED'; END IF;
 SELECT v.id,v.content,v.content_hash,d.document_type INTO v_id,v_content,v_hash,v_type
 FROM public.legal_document_versions v JOIN public.legal_documents d ON d.id=v.document_id
 WHERE v.document_id=p_document_id AND v.version_number=p_version_number AND v.status='DRAFT' FOR UPDATE;
 IF v_id IS NULL THEN RAISE EXCEPTION 'LEGAL_DRAFT_VERSION_NOT_FOUND'; END IF;
 IF length(trim(v_content))<1 OR upper(trim(v_content))='LEGAL_CONTENT_PENDING_APPROVAL' THEN RAISE EXCEPTION 'LEGAL_CONTENT_REQUIRED'; END IF;
 IF v_hash IS NULL OR length(v_hash)<32 THEN RAISE EXCEPTION 'LEGAL_CONTENT_HASH_REQUIRED'; END IF;
 UPDATE public.legal_document_versions SET status='PUBLISHED',published_at=coalesce(p_effective_at,now()),effective_at=coalesce(p_effective_at,now()) WHERE id=v_id;
 UPDATE public.legal_documents SET status='PUBLISHED',published_at=coalesce(p_effective_at,now()),effective_at=coalesce(p_effective_at,now()),updated_by=(SELECT auth.uid()),updated_at=now() WHERE id=p_document_id;
 UPDATE public.legal_requirements SET enabled=true,updated_at=now() WHERE document_type=v_type AND required=true;
 INSERT INTO public.consent_audit_log(actor_user_id,event_type,document_id,document_version_id,event_at,metadata)
 VALUES((SELECT auth.uid()),'LEGAL_VERSION_PUBLISHED',p_document_id,v_id,now(),jsonb_build_object('version_number',p_version_number,'enforcement_enabled',true));
 RETURN jsonb_build_object('document_id',p_document_id,'version_id',v_id,'status','PUBLISHED','enforcement_enabled',true);
END;$$;

REVOKE ALL ON FUNCTION public.legal_is_admin(uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
