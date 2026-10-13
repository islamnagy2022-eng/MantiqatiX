-- RC200: allow a marketplace customer to create/pay an intent for their own
-- cross-tenant order without granting provider-tenant membership.
-- Non-customer actors remain tenant/business membership scoped.
create or replace function public.create_payment_intent_backend(
  p_tenant_id character varying,
  p_order_id uuid,
  p_amount numeric,
  p_currency character varying,
  p_provider character varying,
  p_payment_method character varying,
  p_idempotency_key character varying
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_id varchar;
  v_order orders%rowtype;
  v_uid uuid := auth.uid();
  v_existing payment_intents%rowtype;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous'),'false')='true' then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_order from orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.tenant_id<>p_tenant_id then raise exception 'TENANT_MISMATCH'; end if;

  if upper(coalesce(v_order.status,'')) not in ('PENDING','CREATED') then
    raise exception 'ORDER_NOT_PAYABLE';
  end if;

  if v_order.customer_id is distinct from v_uid
     and not exists(
       select 1 from user_memberships m
       where m.user_id=v_uid and m.tenant_id=p_tenant_id and m.status='ACTIVE'
         and (m.business_id=v_order.business_id or m.business_id is null)
     ) then
    raise exception 'TENANT_ACCESS_DENIED';
  end if;

  if v_order.customer_id is not null and v_order.customer_id<>v_uid and not exists(
    select 1 from user_memberships m
    where m.user_id=v_uid and m.tenant_id=p_tenant_id and m.status='ACTIVE'
      and m.role in ('OWNER','ADMIN','MANAGER','FINANCE','ACCOUNTANT','FINANCE_MANAGER')
  ) then
    raise exception 'ORDER_ACCESS_DENIED';
  end if;

  if v_order.pricing_hash is null or v_order.pricing_version is null or v_order.pricing_authority is null then raise exception 'PRICING_SNAPSHOT_REQUIRED'; end if;
  if p_amount<=0 or abs(p_amount-v_order.total_amount)>0.01 or abs(p_amount-v_order.total)>0.01 then raise exception 'INVALID_AMOUNT'; end if;
  if upper(coalesce(p_currency,''))<>upper(v_order.currency) then raise exception 'INVALID_CURRENCY'; end if;
  if p_provider is null or length(trim(p_provider))=0 then raise exception 'INVALID_PROVIDER'; end if;
  if p_payment_method is null or length(trim(p_payment_method))=0 then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key))=0 or length(p_idempotency_key)>200 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;

  select * into v_existing
  from payment_intents
  where tenant_id=p_tenant_id and idempotency_key=trim(p_idempotency_key)
  for update;

  if found then
    if v_existing.order_id<>p_order_id
       or abs(v_existing.amount-v_order.total_amount)>0.01
       or upper(v_existing.currency)<>upper(v_order.currency)
       or v_existing.pricing_hash<>v_order.pricing_hash
    then raise exception 'IDEMPOTENCY_CONFLICT'; end if;

    return jsonb_build_object(
      'id',v_existing.id,'status',v_existing.status,'amount',v_existing.amount,
      'currency',v_existing.currency,'pricing_version',v_existing.pricing_version,
      'pricing_hash',v_existing.pricing_hash,'idempotent',true
    );
  end if;

  insert into payment_intents(
    id,tenant_id,order_id,amount,currency,status,provider,payment_method,
    idempotency_key,pricing_version,pricing_hash
  )
  values(
    gen_random_uuid()::text,p_tenant_id,p_order_id,v_order.total_amount,v_order.currency,
    'CREATED',p_provider,p_payment_method,trim(p_idempotency_key),
    v_order.pricing_version,v_order.pricing_hash
  )
  returning id into v_id;

  return jsonb_build_object(
    'id',v_id,'status','CREATED','amount',v_order.total_amount,'currency',v_order.currency,
    'pricing_version',v_order.pricing_version,'pricing_hash',v_order.pricing_hash,'idempotent',false
  );
end
$function$;
