-- payment-intent Edge Function authenticates the user, then calls this RPC
-- using the user's authenticated session. The function itself enforces auth.uid(),
-- tenant membership, order ownership/staff access, pricing, currency, and idempotency.
grant execute on function public.create_payment_intent_backend(
  character varying, uuid, numeric, character varying, character varying, character varying, character varying
) to authenticated;
revoke execute on function public.create_payment_intent_backend(
  character varying, uuid, numeric, character varying, character varying, character varying, character varying
) from anon;
