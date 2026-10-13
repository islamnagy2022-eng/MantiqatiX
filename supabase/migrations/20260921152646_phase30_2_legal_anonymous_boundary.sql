BEGIN;
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

CREATE POLICY legal_documents_public_read ON public.legal_documents FOR SELECT TO anon,authenticated USING(status='PUBLISHED' OR ((SELECT auth.uid()) IS NOT NULL AND coalesce(((SELECT auth.jwt())->>'is_anonymous')::boolean,false)=false AND private.legal_is_admin((SELECT auth.uid()))));
CREATE POLICY legal_documents_admin_write ON public.legal_documents FOR ALL TO authenticated
USING((SELECT auth.uid()) IS NOT NULL AND coalesce(((SELECT auth.jwt())->>'is_anonymous')::boolean,false)=false AND private.legal_is_admin((SELECT auth.uid())))
WITH CHECK((SELECT auth.uid()) IS NOT NULL AND coalesce(((SELECT auth.jwt())->>'is_anonymous')::boolean,false)=false AND private.legal_is_admin((SELECT auth.uid())));

CREATE POLICY legal_versions_public_read ON public.legal_document_versions FOR SELECT TO anon,authenticated USING(status='PUBLISHED' OR ((SELECT auth.uid()) IS NOT NULL AND coalesce(((SELECT auth.jwt())->>'is_anonymous')::boolean,false)=false AND private.legal_is_admin((SELECT auth.uid()))));
CREATE POLICY legal_versions_admin_write ON public.legal_document_versions FOR ALL TO authenticated
USING((SELECT auth.uid()) IS NOT NULL AND coalesce(((SELECT auth.jwt())->>'is_anonymous')::boolean,false)=false AND private.legal_is_admin((SELECT auth.uid())))
WITH CHECK((SELECT auth.uid()) IS NOT NULL AND coalesce(((SELECT auth.jwt())->>'is_anonymous')::boolean,false)=false AND private.legal_is_admin((SELECT auth.uid())));

CREATE POLICY agreements_participant_read ON public.agreements FOR SELECT TO authenticated USING((SELECT auth.uid()) IS NOT NULL AND coalesce(((SELECT auth.jwt())->>'is_anonymous')::boolean,false)=false AND (private.legal_is_admin((SELECT auth.uid())) OR EXISTS(SELECT 1 FROM public.agreement_participants ap WHERE ap.agreement_id=id AND ap.user_id=(SELECT auth.uid()))));
CREATE POLICY agreements_admin_write ON public.agreements FOR ALL TO authenticated
USING((SELECT auth.uid()) IS NOT NULL AND coalesce(((SELECT auth.jwt())->>'is_anonymous')::boolean,false)=false AND private.legal_is_admin((SELECT auth.uid())))
WITH CHECK((SELECT auth.uid()) IS NOT NULL AND coalesce(((SELECT auth.jwt())->>'is_anonymous')::boolean,false)=false AND private.legal_is_admin((SELECT auth.uid())));

CREATE POLICY agreement_participants_read ON public.agreement_participants FOR SELECT TO authenticated USING((SELECT auth.uid()) IS NOT NULL AND coalesce(((SELECT auth.jwt())->>'is_anonymous')::boolean,false)=false AND (private.legal_is_admin((SELECT auth.uid())) OR user_id=(SELECT auth.uid())));
CREATE POLICY agreement_participants_admin_write ON public.agreement_participants FOR ALL TO authenticated
USING((SELECT auth.uid()) IS NOT NULL AND coalesce(((SELECT auth.jwt())->>'is_anonymous')::boolean,false)=false AND private.legal_is_admin((SELECT auth.uid())))
WITH CHECK((SELECT auth.uid()) IS NOT NULL AND coalesce(((SELECT auth.jwt())->>'is_anonymous')::boolean,false)=false AND private.legal_is_admin((SELECT auth.uid())));

CREATE POLICY user_consents_own_read ON public.user_consents FOR SELECT TO authenticated USING((SELECT auth.uid()) IS NOT NULL AND coalesce(((SELECT auth.jwt())->>'is_anonymous')::boolean,false)=false AND (user_id=(SELECT auth.uid()) OR private.legal_is_admin((SELECT auth.uid()))));
CREATE POLICY consent_audit_own_read ON public.consent_audit_log FOR SELECT TO authenticated USING((SELECT auth.uid()) IS NOT NULL AND coalesce(((SELECT auth.jwt())->>'is_anonymous')::boolean,false)=false AND (user_id=(SELECT auth.uid()) OR private.legal_is_admin((SELECT auth.uid()))));

CREATE POLICY requirements_admin_all ON public.legal_requirements FOR ALL TO authenticated
USING((SELECT auth.uid()) IS NOT NULL AND coalesce(((SELECT auth.jwt())->>'is_anonymous')::boolean,false)=false AND private.legal_is_admin((SELECT auth.uid())))
WITH CHECK((SELECT auth.uid()) IS NOT NULL AND coalesce(((SELECT auth.jwt())->>'is_anonymous')::boolean,false)=false AND private.legal_is_admin((SELECT auth.uid())));
COMMIT;
