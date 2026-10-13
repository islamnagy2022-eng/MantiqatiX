BEGIN;
CREATE OR REPLACE FUNCTION public.legal_audit_bridge() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_tenant varchar;
BEGIN
 SELECT tenant_id INTO v_tenant FROM public.user_memberships WHERE user_id=v_uid AND coalesce(status,'ACTIVE')='ACTIVE' ORDER BY created_at LIMIT 1;
 IF v_uid IS NOT NULL THEN
  INSERT INTO public.consent_audit_log(actor_user_id,event_type,document_id,document_version_id,event_at,metadata)
  VALUES(v_uid,'LEGAL_CMS_'||TG_OP,CASE WHEN TG_TABLE_NAME='legal_documents' THEN NEW.id ELSE NEW.document_id END,CASE WHEN TG_TABLE_NAME='legal_document_versions' THEN NEW.id ELSE NULL END,now(),jsonb_build_object('table',TG_TABLE_NAME,'operation',TG_OP));
  IF v_tenant IS NOT NULL THEN
   INSERT INTO public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,result,created_at)
   VALUES('LEGAL-'||gen_random_uuid()::text,v_tenant,v_uid,'LEGAL_CMS_'||TG_OP,TG_TABLE_NAME,(CASE WHEN TG_TABLE_NAME='legal_documents' THEN NEW.id ELSE NEW.id END)::text,'SUCCESS',now());
  END IF;
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_legal_documents_audit ON public.legal_documents;
DROP TRIGGER IF EXISTS trg_legal_versions_audit ON public.legal_document_versions;
CREATE TRIGGER trg_legal_documents_audit AFTER INSERT OR UPDATE ON public.legal_documents FOR EACH ROW EXECUTE FUNCTION public.legal_audit_bridge();
CREATE TRIGGER trg_legal_versions_audit AFTER INSERT OR UPDATE ON public.legal_document_versions FOR EACH ROW EXECUTE FUNCTION public.legal_audit_bridge();
COMMIT;
