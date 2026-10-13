BEGIN;
CREATE OR REPLACE FUNCTION public.legal_gate_business_activation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid;
BEGIN
 IF NEW.status='ACTIVE' AND (TG_OP='INSERT' OR coalesce(OLD.status,'')<>'ACTIVE') THEN
  SELECT m.user_id INTO v_owner FROM public.user_memberships m WHERE m.business_id=NEW.id AND coalesce(m.status,'ACTIVE')='ACTIVE' AND upper(m.role) IN('OWNER','BUSINESS_OWNER') ORDER BY m.created_at LIMIT 1;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'LEGAL_BUSINESS_OWNER_REQUIRED'; END IF;
  PERFORM public.legal_assert_action(v_owner,'BUSINESS_ACTIVATION',NEW.id);
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_legal_business_activation ON public.businesses;
CREATE TRIGGER trg_legal_business_activation BEFORE INSERT OR UPDATE OF status ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.legal_gate_business_activation();
COMMIT;
