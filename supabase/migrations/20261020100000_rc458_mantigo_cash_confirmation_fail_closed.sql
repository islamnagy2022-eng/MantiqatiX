-- RC458: prevent customer-side self-confirmation of MantiGO cash receipt.
-- Cash confirmation remains fail-closed until a captain/finance-authorized workflow is implemented and tested.
-- This does not affect the generic order CASH_ON_DELIVERY API.
begin;
revoke all on function public.confirm_mantigo_cash_payment_backend(uuid,text) from public, anon, authenticated;
commit;
