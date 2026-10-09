-- RC424: make digital-page Paymob event persistence and order transition atomic.
-- This migration is source-only until explicitly applied to the intended Supabase project.
create or replace function public.process_verified_digital_page_payment_backend(
  p_order_id uuid,
  p_external_event_id text,
  p_event_type text,
  p_status text,
  p_signature_verified boolean,
  p_amount numeric,
  p_currency text,
  p_provider_transaction_id text,
  p_provider_order_id text,
  p_raw_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.digital_page_orders%rowtype;
  v_event public.digital_page_payment_events%rowtype;
  v_next_payment_status text;
  v_next_fulfillment_status text;
begin
  if coalesce(p_signature_verified, false) is not true then
    raise exception 'DIGITAL_PAGE_SIGNATURE_REQUIRED';
  end if;
  if p_external_event_id is null or length(trim(p_external_event_id)) = 0 then
    raise exception 'DIGITAL_PAGE_EVENT_ID_REQUIRED';
  end if;
  if p_status not in ('SUCCEEDED', 'FAILED') then
    raise exception 'DIGITAL_PAGE_EVENT_STATUS_INVALID';
  end if;
  if p_amount is null or p_amount <= 0 or p_currency is null or length(trim(p_currency)) = 0 then
    raise exception 'DIGITAL_PAGE_AMOUNT_CURRENCY_INVALID';
  end if;

  select * into v_order
  from public.digital_page_orders
  where id = p_order_id and provider = 'PAYMOB'
  for update;
  if not found then
    raise exception 'DIGITAL_PAGE_ORDER_NOT_FOUND';
  end if;
  if nullif(trim(p_provider_order_id), '') is null
     or v_order.provider_order_id is null
     or v_order.provider_order_id <> p_provider_order_id then
    raise exception 'DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH';
  end if;
  if abs(v_order.amount - p_amount) > 0.01
     or upper(v_order.currency) <> upper(p_currency) then
    raise exception 'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH';
  end if;

  select * into v_event
  from public.digital_page_payment_events
  where external_event_id = p_external_event_id;
  if found then
    if v_event.digital_page_order_id <> v_order.id then
      raise exception 'DIGITAL_PAGE_EVENT_ORDER_MISMATCH';
    end if;
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'payment_status', v_order.payment_status,
      'fulfillment_status', v_order.fulfillment_status
    );
  end if;

  insert into public.digital_page_payment_events(
    digital_page_order_id, provider, external_event_id, event_type,
    status, signature_verified, raw_payload
  ) values (
    v_order.id, 'PAYMOB', p_external_event_id, p_event_type,
    p_status, true, coalesce(p_raw_payload, '{}'::jsonb)
  );

  -- Never let a later or duplicate provider event downgrade an already paid order.
  if v_order.payment_status <> 'PENDING' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', false,
      'already_final', true,
      'payment_status', v_order.payment_status,
      'fulfillment_status', v_order.fulfillment_status
    );
  end if;

  v_next_payment_status := case when p_status = 'SUCCEEDED' then 'PAID' else 'FAILED' end;
  v_next_fulfillment_status := case when p_status = 'SUCCEEDED' then 'IN_REVIEW' else v_order.fulfillment_status end;

  update public.digital_page_orders
  set payment_status = v_next_payment_status,
      fulfillment_status = v_next_fulfillment_status,
      provider_transaction_id = p_provider_transaction_id,
      provider_order_id = coalesce(nullif(p_provider_order_id, ''), provider_order_id),
      updated_at = now()
  where id = v_order.id and payment_status = 'PENDING';

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'already_final', false,
    'payment_status', v_next_payment_status,
    'fulfillment_status', v_next_fulfillment_status
  );
end;
$function$;

revoke all on function public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb) from public;
revoke all on function public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb) from anon;
revoke all on function public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb) from authenticated;
grant execute on function public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb) to service_role;


-- Harden the existing admin publish gate against cross-order page reuse.
create or replace function public.fulfill_digital_page_publish(p_actor_user_id uuid,p_order_id uuid,p_page_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_order public.digital_page_orders%rowtype; v_page public.digital_pages%rowtype;
begin
  if p_actor_user_id is null or p_actor_user_id <> auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if not public.mnty_can_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  select * into v_order from public.digital_page_orders where id=p_order_id for update;
  if not found then raise exception 'DIGITAL_PAGE_ORDER_NOT_FOUND'; end if;
  if v_order.payment_status <> 'PAID' then raise exception 'PAYMENT_REQUIRED'; end if;
  if v_order.fulfillment_status not in ('REQUESTED','IN_REVIEW','IN_PROGRESS') and v_order.fulfillment_status <> 'PUBLISHED' then raise exception 'INVALID_FULFILLMENT_STATE'; end if;
  select * into v_page from public.digital_pages where id=p_page_id for update;
  if not found then raise exception 'DIGITAL_PAGE_NOT_FOUND'; end if;
  if v_page.created_by <> v_order.user_id then raise exception 'PAGE_OWNER_MISMATCH'; end if;
  if v_page.page_type <> v_order.page_type then raise exception 'PAGE_TYPE_MISMATCH'; end if;
  if v_order.target_business_id is not null and v_page.business_id is distinct from v_order.target_business_id then raise exception 'BUSINESS_SCOPE_MISMATCH'; end if;
  if v_order.page_type = 'MENU' and (v_order.target_business_id is null or v_page.business_id is distinct from v_order.target_business_id) then raise exception 'MENU_BUSINESS_SCOPE_REQUIRED'; end if;
  if v_page.digital_page_order_id is not null and v_page.digital_page_order_id <> v_order.id then raise exception 'PAGE_ALREADY_LINKED_TO_DIFFERENT_ORDER'; end if;
  if v_page.status = 'PUBLISHED' then
    if v_page.digital_page_order_id = v_order.id and v_order.fulfillment_status = 'PUBLISHED' then
      return jsonb_build_object('page_id',v_page.id,'order_id',v_order.id,'status','PUBLISHED','replayed',true);
    end if;
    raise exception 'PUBLISHED_PAGE_NOT_LINKED_TO_ORDER';
  end if;
  update public.digital_pages set digital_page_order_id=v_order.id,status='PUBLISHED',published_at=coalesce(published_at,now()),version=version+1,updated_by=p_actor_user_id,updated_at=now() where id=v_page.id;
  update public.digital_page_orders set fulfillment_status='PUBLISHED',updated_at=now() where id=v_order.id;
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,new_values,result,created_at)
  values(gen_random_uuid()::text,'MNTY-PLATFORM',p_actor_user_id,'DIGITAL_PAGE_PUBLISHED','digital_page_order',v_order.id::text,jsonb_build_object('page_id',v_page.id,'page_type',v_page.page_type),'SUCCESS',now());
  return jsonb_build_object('page_id',v_page.id,'order_id',v_order.id,'status','PUBLISHED','replayed',false);
end;
$function$;
