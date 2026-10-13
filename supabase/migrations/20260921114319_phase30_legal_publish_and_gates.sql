
BEGIN;
CREATE OR REPLACE FUNCTION public.legal_publish_version(p_document_id uuid,p_version_number integer,p_effective_at timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_hash text; v_content text;
BEGIN
 IF NOT public.legal_is_admin(auth.uid()) THEN RAISE EXCEPTION 'LEGAL_ADMIN_REQUIRED'; END IF;
 SELECT id,content,content_hash INTO v_id,v_content,v_hash FROM public.legal_document_versions
 WHERE document_id=p_document_id AND version_number=p_version_number AND status='DRAFT' FOR UPDATE;
 IF v_id IS NULL THEN RAISE EXCEPTION 'LEGAL_DRAFT_VERSION_NOT_FOUND'; END IF;
 IF length(trim(v_content))<1 OR upper(trim(v_content))='LEGAL_CONTENT_PENDING_APPROVAL' THEN RAISE EXCEPTION 'LEGAL_CONTENT_REQUIRED'; END IF;
 IF v_hash IS NULL OR length(v_hash)<32 THEN RAISE EXCEPTION 'LEGAL_CONTENT_HASH_REQUIRED'; END IF;
 UPDATE public.legal_document_versions SET status='PUBLISHED',published_at=coalesce(p_effective_at,now()),effective_at=coalesce(p_effective_at,now()) WHERE id=v_id;
 UPDATE public.legal_documents SET status='PUBLISHED',published_at=coalesce(p_effective_at,now()),effective_at=coalesce(p_effective_at,now()),updated_by=auth.uid(),updated_at=now() WHERE id=p_document_id;
 INSERT INTO public.consent_audit_log(actor_user_id,event_type,document_id,document_version_id,event_at,metadata)
 VALUES(auth.uid(),'LEGAL_VERSION_PUBLISHED',p_document_id,v_id,now(),jsonb_build_object('version_number',p_version_number));
 RETURN jsonb_build_object('document_id',p_document_id,'version_id',v_id,'status','PUBLISHED');
END;$$;

CREATE OR REPLACE FUNCTION public.legal_gate_business_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid;
BEGIN
 IF NEW.status='ACTIVE' AND coalesce(OLD.status,'')<>'ACTIVE' THEN
   SELECT m.user_id INTO v_owner FROM public.user_memberships m WHERE m.business_id=NEW.id AND coalesce(m.status,'ACTIVE')='ACTIVE'
     AND upper(m.role) IN('OWNER','BUSINESS_OWNER') ORDER BY m.created_at LIMIT 1;
   IF v_owner IS NULL THEN RAISE EXCEPTION 'LEGAL_BUSINESS_OWNER_REQUIRED'; END IF;
   PERFORM public.legal_assert_action(v_owner,'BUSINESS_ACTIVATION',NEW.id);
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_legal_business_activation ON public.businesses;
CREATE TRIGGER trg_legal_business_activation BEFORE UPDATE OF status ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.legal_gate_business_activation();

CREATE OR REPLACE FUNCTION public.legal_gate_employee_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='ACTIVE' AND coalesce(OLD.status,'')<>'ACTIVE' AND upper(NEW.role) IN('EMPLOYEE','STAFF') THEN
   PERFORM public.legal_assert_action(NEW.user_id,'EMPLOYEE_ACTIVATION',NEW.business_id);
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_legal_employee_activation ON public.user_memberships;
CREATE TRIGGER trg_legal_employee_activation BEFORE UPDATE OF status ON public.user_memberships FOR EACH ROW EXECUTE FUNCTION public.legal_gate_employee_activation();

CREATE OR REPLACE FUNCTION public.legal_gate_order_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid;
BEGIN
 IF NEW.customer_id IS NOT NULL THEN PERFORM public.legal_assert_action(NEW.customer_id,'BUSINESS_TRANSACTION',NEW.business_id); END IF;
 SELECT m.user_id INTO v_owner FROM public.user_memberships m WHERE m.business_id=NEW.business_id AND coalesce(m.status,'ACTIVE')='ACTIVE'
   AND upper(m.role) IN('OWNER','BUSINESS_OWNER') ORDER BY m.created_at LIMIT 1;
 IF v_owner IS NOT NULL THEN PERFORM public.legal_assert_action(v_owner,'BUSINESS_TRANSACTION',NEW.business_id); END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_legal_order_insert ON public.orders;
CREATE TRIGGER trg_legal_order_insert BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.legal_gate_order_insert();

GRANT EXECUTE ON FUNCTION public.legal_publish_version(uuid,integer,timestamptz) TO authenticated,service_role;
COMMIT;
