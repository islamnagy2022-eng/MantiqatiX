BEGIN;
CREATE OR REPLACE FUNCTION public.legal_gate_commission_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid;
BEGIN
 SELECT m.user_id INTO v_owner FROM public.user_memberships m WHERE m.business_id=NEW.business_id AND coalesce(m.status,'ACTIVE')='ACTIVE' AND upper(m.role) IN('OWNER','BUSINESS_OWNER') ORDER BY m.created_at LIMIT 1;
 IF v_owner IS NOT NULL THEN PERFORM public.legal_assert_action(v_owner,'COMMISSION_PROGRAM',NEW.business_id); END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_legal_commission_insert ON public.commission_transactions;
CREATE TRIGGER trg_legal_commission_insert BEFORE INSERT ON public.commission_transactions FOR EACH ROW EXECUTE FUNCTION public.legal_gate_commission_insert();
CREATE OR REPLACE FUNCTION public.legal_gate_referral_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.referrer_user_id IS NOT NULL THEN PERFORM public.legal_assert_action(NEW.referrer_user_id,'REFERRAL_PROGRAM',NULL); END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_legal_referral_insert ON public.referral_events;
CREATE TRIGGER trg_legal_referral_insert BEFORE INSERT ON public.referral_events FOR EACH ROW EXECUTE FUNCTION public.legal_gate_referral_insert();
COMMIT;
