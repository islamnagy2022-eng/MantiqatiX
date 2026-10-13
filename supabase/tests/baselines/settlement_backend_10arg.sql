-- TEST-ONLY LIVE-DERIVED SETTLEMENT FUNCTION BASELINE
-- Source: read-only pg_get_functiondef/pg_proc catalog snapshot from Supabase project moyhiluyhjsujhwlyeuu.
-- Snapshot date: 2026-10-12.
-- This is NOT recovered historical creation DDL and MUST NOT be applied to production.
-- Injected only into a fresh disposable CI replay immediately before the historical privilege-lockdown migration.
-- No production data is included. This function definition must never be invoked by replay tests.
-- A passing replay with this fixture does NOT certify historical function-body provenance.

CREATE OR REPLACE FUNCTION public.create_settlement_backend(
  p_id character varying,
  p_tenant_id character varying,
  p_beneficiary_type character varying,
  p_beneficiary_id character varying,
  p_gross numeric,
  p_platform_fee numeric,
  p_net numeric,
  p_voucher numeric,
  p_channel character varying,
  p_reference_id character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_existing public.settlement_transactions%ROWTYPE;
BEGIN
 PERFORM public.assert_financial_membership(p_tenant_id);
 IF p_id IS NULL OR p_id='' OR p_tenant_id IS NULL OR p_tenant_id='' THEN RAISE EXCEPTION 'SETTLEMENT_ID_AND_TENANT_REQUIRED'; END IF;
 IF p_beneficiary_type IS NULL OR p_beneficiary_type='' OR p_beneficiary_id IS NULL OR p_beneficiary_id='' THEN RAISE EXCEPTION 'BENEFICIARY_REQUIRED'; END IF;
 IF p_gross < 0 OR p_platform_fee < 0 OR p_net < 0 OR p_voucher < 0 THEN RAISE EXCEPTION 'INVALID_SETTLEMENT_AMOUNT'; END IF;
 IF round(p_gross,2) <> round(p_platform_fee + p_net + p_voucher,2) THEN RAISE EXCEPTION 'SETTLEMENT_BREAKDOWN_MISMATCH'; END IF;
 SELECT * INTO v_existing FROM public.settlement_transactions WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
   IF v_existing.tenant_id<>p_tenant_id OR v_existing.beneficiary_id<>p_beneficiary_id
      OR v_existing.gross_amount<>p_gross OR v_existing.platform_fee<>p_platform_fee
      OR v_existing.net_payout<>p_net OR v_existing.voucher_reserve<>p_voucher THEN
      RAISE EXCEPTION 'SETTLEMENT_ID_REPLAY_MISMATCH';
   END IF;
   RETURN jsonb_build_object('id',p_id,'status',v_existing.status,'idempotent',true);
 END IF;
 INSERT INTO public.settlement_transactions(id,tenant_id,beneficiary_type,beneficiary_id,gross_amount,platform_fee,net_payout,voucher_reserve,payout_channel,status,reference_id)
 VALUES(p_id,p_tenant_id,p_beneficiary_type,p_beneficiary_id,p_gross,p_platform_fee,p_net,p_voucher,COALESCE(p_channel,'BANK_TRANSFER'),'PENDING',p_reference_id);
 RETURN jsonb_build_object('id',p_id,'status','PENDING','idempotent',false);
END; $function$;

REVOKE ALL ON FUNCTION public.create_settlement_backend(varchar,varchar,varchar,varchar,numeric,numeric,numeric,numeric,varchar,varchar) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_settlement_backend(varchar,varchar,varchar,varchar,numeric,numeric,numeric,numeric,varchar,varchar) TO service_role;
