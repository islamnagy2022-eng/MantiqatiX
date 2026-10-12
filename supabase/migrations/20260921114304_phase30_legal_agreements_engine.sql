
BEGIN;
CREATE TABLE IF NOT EXISTS public.legal_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id varchar REFERENCES public.tenants(id) ON DELETE RESTRICT,
 document_type varchar(96) NOT NULL, title varchar(255) NOT NULL, status varchar(32) NOT NULL DEFAULT 'DRAFT',
 published_at timestamptz, effective_at timestamptz, created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 target_audience text[] NOT NULL DEFAULT ARRAY['ALL']::text[], required_consent boolean NOT NULL DEFAULT false, requires_reconsent boolean NOT NULL DEFAULT false,
 sector_codes text[] NOT NULL DEFAULT ARRAY[]::text[], jurisdiction_country varchar(8), jurisdiction_region varchar(128), locale varchar(16) NOT NULL DEFAULT 'ar-EG',
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT legal_documents_status_ck CHECK(status IN('DRAFT','PUBLISHED','SUSPENDED','RETIRED')));
CREATE TABLE IF NOT EXISTS public.legal_document_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE RESTRICT, version_number integer NOT NULL,
 content text NOT NULL, content_hash varchar(128) NOT NULL, status varchar(32) NOT NULL DEFAULT 'DRAFT', published_at timestamptz, effective_at timestamptz, retired_at timestamptz,
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 CONSTRAINT legal_document_versions_status_ck CHECK(status IN('DRAFT','PUBLISHED','RETIRED')), CONSTRAINT legal_document_versions_version_ck CHECK(version_number>0),
 CONSTRAINT legal_document_versions_unique UNIQUE(document_id,version_number));
CREATE TABLE IF NOT EXISTS public.agreements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id varchar REFERENCES public.tenants(id) ON DELETE RESTRICT, agreement_type varchar(96) NOT NULL,
 document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE RESTRICT, document_version_id uuid NOT NULL REFERENCES public.legal_document_versions(id) ON DELETE RESTRICT,
 business_id uuid REFERENCES public.businesses(id) ON DELETE RESTRICT, status varchar(32) NOT NULL DEFAULT 'PENDING', effective_at timestamptz,
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 CONSTRAINT agreements_status_ck CHECK(status IN('PENDING','ACTIVE','SUSPENDED','EXPIRED','TERMINATED')));
CREATE TABLE IF NOT EXISTS public.agreement_participants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agreement_id uuid NOT NULL REFERENCES public.agreements(id) ON DELETE RESTRICT, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 account_type varchar(96) NOT NULL, participant_role varchar(96) NOT NULL, status varchar(32) NOT NULL DEFAULT 'PENDING',
 joined_at timestamptz, left_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 CONSTRAINT agreement_participants_status_ck CHECK(status IN('PENDING','ACTIVE','DECLINED','SUSPENDED','TERMINATED')));
CREATE TABLE IF NOT EXISTS public.user_consents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, account_type varchar(96) NOT NULL,
 document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE RESTRICT, document_version_id uuid NOT NULL REFERENCES public.legal_document_versions(id) ON DELETE RESTRICT,
 agreement_id uuid REFERENCES public.agreements(id) ON DELETE RESTRICT, consent_status varchar(32) NOT NULL, consented_at timestamptz NOT NULL DEFAULT now(),
 ip_address varchar(128), user_agent text, device_info jsonb NOT NULL DEFAULT '{}'::jsonb, session_id varchar(255), content_hash varchar(128) NOT NULL,
 source varchar(64) NOT NULL DEFAULT 'APP', created_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 CONSTRAINT user_consents_status_ck CHECK(consent_status IN('ACCEPTED','DECLINED','REVOKED')));
CREATE TABLE IF NOT EXISTS public.consent_audit_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, account_type varchar(96),
 document_id uuid REFERENCES public.legal_documents(id) ON DELETE SET NULL, document_version_id uuid REFERENCES public.legal_document_versions(id) ON DELETE SET NULL,
 agreement_id uuid REFERENCES public.agreements(id) ON DELETE SET NULL, consent_id uuid REFERENCES public.user_consents(id) ON DELETE SET NULL, event_type varchar(64) NOT NULL,
 consent_status varchar(32), content_hash varchar(128), ip_address varchar(128), user_agent text, device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
 session_id varchar(255), event_at timestamptz NOT NULL DEFAULT now(), actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, integrity_hash varchar(128), metadata jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE IF NOT EXISTS public.legal_requirements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action_key varchar(128) NOT NULL, document_type varchar(96) NOT NULL, target_audience varchar(96) NOT NULL DEFAULT 'ALL',
 required boolean NOT NULL DEFAULT true, enabled boolean NOT NULL DEFAULT true, business_scoped boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT legal_requirements_unique UNIQUE(action_key,document_type,target_audience));
CREATE INDEX IF NOT EXISTS idx_legal_documents_type_status ON public.legal_documents(document_type,status);
CREATE INDEX IF NOT EXISTS idx_legal_versions_document ON public.legal_document_versions(document_id,version_number DESC);
CREATE INDEX IF NOT EXISTS idx_user_consents_user_doc ON public.user_consents(user_id,document_id,document_version_id);
CREATE INDEX IF NOT EXISTS idx_consent_audit_user_time ON public.consent_audit_log(user_id,event_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_requirements_action ON public.legal_requirements(action_key,enabled);

CREATE OR REPLACE FUNCTION public.legal_is_admin(p_user_id uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_memberships m WHERE m.user_id=p_user_id AND coalesce(m.status,'ACTIVE')='ACTIVE' AND upper(m.role) IN('SUPER_ADMIN','ADMIN','LEGAL_ADMIN'));
$$;
CREATE OR REPLACE FUNCTION public.legal_effective_version(p_document_type text,p_audience text DEFAULT 'ALL',p_business_id uuid DEFAULT NULL)
RETURNS TABLE(document_id uuid,version_id uuid,document_type text,title text,version_number integer,content text,content_hash text,requires_reconsent boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT d.id,v.id,d.document_type::text,d.title::text,v.version_number,v.content,v.content_hash,d.requires_reconsent
 FROM public.legal_documents d JOIN public.legal_document_versions v ON v.document_id=d.id
 WHERE d.document_type=p_document_type AND d.status='PUBLISHED' AND v.status='PUBLISHED' AND coalesce(v.effective_at,v.published_at,now())<=now()
 AND (p_audience='ALL' OR d.target_audience @> ARRAY['ALL']::text[] OR d.target_audience @> ARRAY[p_audience]::text[])
 AND (cardinality(d.sector_codes)=0 OR p_business_id IS NULL OR EXISTS(SELECT 1 FROM public.businesses b WHERE b.id=p_business_id AND upper(coalesce(b.settings->>'sector',''))=ANY(SELECT upper(x) FROM unnest(d.sector_codes) x)))
 ORDER BY v.version_number DESC LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.legal_assert_action(p_user_id uuid,p_action_key text,p_business_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_audience text;v_req record;v_doc record;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'LEGAL_AUTH_REQUIRED'; END IF;
 IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id AND NOT public.legal_is_admin(auth.uid()) THEN RAISE EXCEPTION 'LEGAL_AUTH_MISMATCH'; END IF;
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
CREATE OR REPLACE FUNCTION public.legal_check_action(p_action_key text,p_business_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM public.legal_assert_action(auth.uid(),p_action_key,p_business_id);RETURN jsonb_build_object('allowed',true,'action_key',p_action_key);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('allowed',false,'action_key',p_action_key,'reason',SQLERRM);END;$$;
CREATE OR REPLACE FUNCTION public.record_legal_consent(
 p_document_id uuid,p_document_version_id uuid,p_account_type text,p_agreement_id uuid DEFAULT NULL,p_ip_address text DEFAULT NULL,p_user_agent text DEFAULT NULL,
 p_device_info jsonb DEFAULT '{}'::jsonb,p_session_id text DEFAULT NULL,p_source text DEFAULT 'APP',p_consent_status text DEFAULT 'ACCEPTED')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid();v_doc public.legal_documents;v_ver public.legal_document_versions;v_consent uuid;v_integrity text;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'LEGAL_AUTH_REQUIRED';END IF;
 IF upper(p_consent_status)<>'ACCEPTED' THEN RAISE EXCEPTION 'LEGAL_CONSENT_ONLY_ACCEPTED';END IF;
 SELECT * INTO v_doc FROM public.legal_documents WHERE id=p_document_id AND status='PUBLISHED';IF NOT FOUND THEN RAISE EXCEPTION 'LEGAL_DOCUMENT_NOT_PUBLISHED';END IF;
 SELECT * INTO v_ver FROM public.legal_document_versions WHERE id=p_document_version_id AND document_id=p_document_id AND status='PUBLISHED';IF NOT FOUND THEN RAISE EXCEPTION 'LEGAL_VERSION_NOT_PUBLISHED';END IF;
 IF coalesce(v_ver.effective_at,v_ver.published_at,now())>now() THEN RAISE EXCEPTION 'LEGAL_VERSION_NOT_EFFECTIVE';END IF;
 IF NOT(v_doc.target_audience @> ARRAY['ALL']::text[] OR v_doc.target_audience @> ARRAY[upper(p_account_type)]::text[]) THEN RAISE EXCEPTION 'LEGAL_AUDIENCE_NOT_ALLOWED';END IF;
 INSERT INTO public.user_consents(user_id,account_type,document_id,document_version_id,agreement_id,consent_status,ip_address,user_agent,device_info,session_id,content_hash,source)
 VALUES(v_uid,upper(p_account_type),p_document_id,p_document_version_id,p_agreement_id,'ACCEPTED',p_ip_address,p_user_agent,coalesce(p_device_info,'{}'::jsonb),p_session_id,v_ver.content_hash,upper(p_source)) RETURNING id INTO v_consent;
 v_integrity:=encode(digest(v_uid::text||':'||v_consent::text||':'||p_document_version_id::text||':'||v_ver.content_hash||':'||clock_timestamp()::text,'sha256'),'hex');
 INSERT INTO public.consent_audit_log(user_id,account_type,document_id,document_version_id,agreement_id,consent_id,event_type,consent_status,content_hash,ip_address,user_agent,device_info,session_id,actor_user_id,integrity_hash)
 VALUES(v_uid,upper(p_account_type),p_document_id,p_document_version_id,p_agreement_id,v_consent,'CONSENT_RECORDED','ACCEPTED',v_ver.content_hash,p_ip_address,p_user_agent,coalesce(p_device_info,'{}'::jsonb),p_session_id,v_uid,v_integrity);
 RETURN jsonb_build_object('consent_id',v_consent,'document_id',p_document_id,'document_version_id',p_document_version_id,'content_hash',v_ver.content_hash,'consented_at',now());
END;$$;

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;ALTER TABLE public.agreement_participants ENABLE ROW LEVEL SECURITY;ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;ALTER TABLE public.consent_audit_log ENABLE ROW LEVEL SECURITY;ALTER TABLE public.legal_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY legal_documents_public_read ON public.legal_documents FOR SELECT USING(status='PUBLISHED' OR public.legal_is_admin(auth.uid()));
CREATE POLICY legal_documents_admin_write ON public.legal_documents FOR ALL USING(public.legal_is_admin(auth.uid())) WITH CHECK(public.legal_is_admin(auth.uid()));
CREATE POLICY legal_versions_public_read ON public.legal_document_versions FOR SELECT USING(status='PUBLISHED' OR public.legal_is_admin(auth.uid()));
CREATE POLICY legal_versions_admin_write ON public.legal_document_versions FOR ALL USING(public.legal_is_admin(auth.uid())) WITH CHECK(public.legal_is_admin(auth.uid()));
CREATE POLICY agreements_participant_read ON public.agreements FOR SELECT USING(public.legal_is_admin(auth.uid()) OR EXISTS(SELECT 1 FROM public.agreement_participants ap WHERE ap.agreement_id=id AND ap.user_id=auth.uid()));
CREATE POLICY agreements_admin_write ON public.agreements FOR ALL USING(public.legal_is_admin(auth.uid())) WITH CHECK(public.legal_is_admin(auth.uid()));
CREATE POLICY agreement_participants_read ON public.agreement_participants FOR SELECT USING(public.legal_is_admin(auth.uid()) OR user_id=auth.uid());
CREATE POLICY agreement_participants_admin_write ON public.agreement_participants FOR ALL USING(public.legal_is_admin(auth.uid())) WITH CHECK(public.legal_is_admin(auth.uid()));
CREATE POLICY user_consents_own_read ON public.user_consents FOR SELECT USING(user_id=auth.uid() OR public.legal_is_admin(auth.uid()));
CREATE POLICY consent_audit_own_read ON public.consent_audit_log FOR SELECT USING(user_id=auth.uid() OR public.legal_is_admin(auth.uid()));
CREATE POLICY requirements_admin_all ON public.legal_requirements FOR ALL USING(public.legal_is_admin(auth.uid())) WITH CHECK(public.legal_is_admin(auth.uid()));
REVOKE ALL ON public.user_consents,public.consent_audit_log FROM anon,authenticated;
GRANT SELECT ON public.legal_documents,public.legal_document_versions TO anon,authenticated;
GRANT SELECT ON public.agreements,public.agreement_participants,public.user_consents,public.consent_audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.legal_check_action(text,uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_legal_consent(uuid,uuid,text,uuid,text,text,jsonb,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.legal_effective_version(text,text,uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.legal_assert_action(uuid,text,uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.prevent_legal_mutation() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'LEGAL_RECORD_IMMUTABLE';END;$$;
DROP TRIGGER IF EXISTS trg_user_consents_immutable ON public.user_consents;DROP TRIGGER IF EXISTS trg_consent_audit_immutable ON public.consent_audit_log;
CREATE TRIGGER trg_user_consents_immutable BEFORE UPDATE OR DELETE ON public.user_consents FOR EACH ROW EXECUTE FUNCTION public.prevent_legal_mutation();
CREATE TRIGGER trg_consent_audit_immutable BEFORE UPDATE OR DELETE ON public.consent_audit_log FOR EACH ROW EXECUTE FUNCTION public.prevent_legal_mutation();
CREATE OR REPLACE FUNCTION public.prevent_published_legal_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF OLD.status='PUBLISHED' THEN RAISE EXCEPTION 'LEGAL_PUBLISHED_VERSION_IMMUTABLE';END IF;RETURN NEW;END;$$;
DROP TRIGGER IF EXISTS trg_legal_version_immutable ON public.legal_document_versions;
CREATE TRIGGER trg_legal_version_immutable BEFORE UPDATE ON public.legal_document_versions FOR EACH ROW EXECUTE FUNCTION public.prevent_published_legal_version_mutation();
INSERT INTO public.legal_documents(document_type,title,target_audience,required_consent,requires_reconsent,locale,status) VALUES
('TERMS_OF_USE','Terms of Use',ARRAY['ALL'],true,true,'ar-EG','DRAFT'),('PRIVACY_POLICY','Privacy Policy',ARRAY['ALL'],true,true,'ar-EG','DRAFT'),
('CUSTOMER_AGREEMENT','Customer Agreement',ARRAY['CUSTOMER'],true,true,'ar-EG','DRAFT'),('BUSINESS_OWNER_AGREEMENT','Business Owner Agreement',ARRAY['BUSINESS_OWNER','OWNER'],true,true,'ar-EG','DRAFT'),
('EMPLOYEE_AGREEMENT','Employee Agreement',ARRAY['EMPLOYEE'],true,true,'ar-EG','DRAFT'),('SUBSCRIPTION_AGREEMENT','Subscription Agreement',ARRAY['BUSINESS_OWNER','OWNER'],true,true,'ar-EG','DRAFT'),
('COMMISSION_AGREEMENT','Commission Agreement',ARRAY['BUSINESS_OWNER','OWNER'],true,true,'ar-EG','DRAFT'),('PARTNER_AGREEMENT','Partner Agreement',ARRAY['MARKETING_PARTNER','PARTNER'],true,true,'ar-EG','DRAFT'),
('REFERRAL_AFFILIATE_AGREEMENT','Referral / Affiliate Agreement',ARRAY['AFFILIATE','REFERRAL_PARTNER'],true,true,'ar-EG','DRAFT') ON CONFLICT DO NOTHING;
INSERT INTO public.legal_requirements(action_key,document_type,target_audience,required,enabled,business_scoped) VALUES
('ACCOUNT_REGISTRATION','TERMS_OF_USE','ALL',true,false,false),('ACCOUNT_REGISTRATION','PRIVACY_POLICY','ALL',true,false,false),
('CUSTOMER_CORE_USE','TERMS_OF_USE','CUSTOMER',true,false,false),('CUSTOMER_CORE_USE','PRIVACY_POLICY','CUSTOMER',true,false,false),
('BUSINESS_ACTIVATION','TERMS_OF_USE','BUSINESS_OWNER',true,false,true),('BUSINESS_ACTIVATION','PRIVACY_POLICY','BUSINESS_OWNER',true,false,true),
('BUSINESS_ACTIVATION','BUSINESS_OWNER_AGREEMENT','BUSINESS_OWNER',true,false,true),('EMPLOYEE_ACTIVATION','EMPLOYEE_AGREEMENT','EMPLOYEE',true,false,true),
('SUBSCRIPTION_ACTIVATION','SUBSCRIPTION_AGREEMENT','BUSINESS_OWNER',true,false,true),('COMMISSION_PROGRAM','COMMISSION_AGREEMENT','BUSINESS_OWNER',true,false,true),
('PARTNER_PROGRAM','PARTNER_AGREEMENT','MARKETING_PARTNER',true,false,false),('REFERRAL_PROGRAM','REFERRAL_AFFILIATE_AGREEMENT','AFFILIATE',true,false,false),
('BUSINESS_TRANSACTION','TERMS_OF_USE','CUSTOMER',true,false,true),('BUSINESS_TRANSACTION','BUSINESS_OWNER_AGREEMENT','BUSINESS_OWNER',true,false,true)
ON CONFLICT DO NOTHING;
COMMIT;
