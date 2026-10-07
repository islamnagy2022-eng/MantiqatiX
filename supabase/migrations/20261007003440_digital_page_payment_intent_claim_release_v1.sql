create or replace function public.release_digital_page_payment_intent_claim_backend(
  p_order_id uuid,
  p_user_id uuid,
  p_claim_token text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'FORBIDDEN'; end if;
  update public.digital_page_orders
  set metadata=metadata-'payment_intent_claim',updated_at=now()
  where id=p_order_id and user_id=p_user_id and provider_intent_id is null and metadata->'payment_intent_claim'->>'token'=p_claim_token;
  return found;
end;
$$;
revoke all on function public.release_digital_page_payment_intent_claim_backend(uuid,uuid,text) from public;
revoke all on function public.release_digital_page_payment_intent_claim_backend(uuid,uuid,text) from anon;
grant execute on function public.release_digital_page_payment_intent_claim_backend(uuid,uuid,text) to authenticated;