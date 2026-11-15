-- Disposable RC468 fixture overlay. Never run against Production.
alter table public.digital_page_orders
  add column if not exists provider text,
  add column if not exists provider_order_id text;

create function public.finalize_digital_page_payment_intent_backend(
  p_order_id uuid,p_user_id uuid,p_claim_token text,p_provider_intent_id text
)
returns boolean language plpgsql security definer set search_path=public,pg_temp
as $function$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'FORBIDDEN'; end if;
  update public.digital_page_orders
  set provider='PAYMOB',provider_intent_id=p_provider_intent_id,payment_status='PENDING',
      metadata=metadata-'payment_intent_claim',updated_at=now()
  where id=p_order_id and user_id=p_user_id and provider_intent_id is null
    and payment_status='PENDING' and metadata->'payment_intent_claim'->>'token'=p_claim_token;
  return found;
end;
$function$;
revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text) to authenticated;
