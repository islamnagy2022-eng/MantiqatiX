-- RC458 disposable PostgreSQL fixture. Mirrors the three live function bodies
-- and their existing authenticated caller grants so the forward migration can be
-- verified without touching production.

create schema auth;
create function auth.uid()
returns uuid
language sql stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$function$;

create function public.mnty_can_platform_admin()
returns boolean
language sql stable
as $function$
  select coalesce(current_setting('mantiqatix_test.is_platform_admin', true), 'false') = 'true';
$function$;

create table public.digital_page_orders (
  id uuid primary key,
  user_id uuid not null,
  amount numeric not null,
  currency text not null,
  payment_status text not null,
  fulfillment_status text not null,
  pricing_hash text,
  provider_intent_id text,
  title text not null,
  page_type text not null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  target_business_id uuid,
  updated_at timestamptz not null default now()
);

create table public.digital_pages (
  id uuid primary key,
  created_by uuid not null,
  page_type text not null,
  business_id uuid,
  digital_page_order_id uuid,
  status text not null,
  published_at timestamptz,
  version integer not null default 1,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id text primary key,
  tenant_id text,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  new_values jsonb,
  result text not null,
  created_at timestamptz not null default now()
);

create function public.claim_digital_page_payment_intent_backend(
  p_order_id uuid,
  p_user_id uuid,
  p_idempotency_key text,
  p_claim_token text
)
returns table(
  id uuid,
  user_id uuid,
  amount numeric,
  currency text,
  payment_status text,
  fulfillment_status text,
  pricing_hash text,
  provider_intent_id text,
  title text,
  page_type text,
  claim_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_order public.digital_page_orders%rowtype;
  v_claim jsonb;
  v_claimed_at timestamptz;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'FORBIDDEN';
  end if;

  select o.* into v_order
  from public.digital_page_orders as o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.user_id <> p_user_id then
    raise exception 'FORBIDDEN';
  end if;

  if v_order.idempotency_key <> p_idempotency_key then
    raise exception 'IDEMPOTENCY_KEY_MISMATCH';
  end if;

  if v_order.payment_status = 'PAID' then
    raise exception 'ALREADY_PAID';
  end if;

  if v_order.provider_intent_id is not null then
    return query
      select v_order.id,v_order.user_id,v_order.amount,v_order.currency,v_order.payment_status,
             v_order.fulfillment_status,v_order.pricing_hash,v_order.provider_intent_id,
             v_order.title,v_order.page_type,'EXISTING'::text;
    return;
  end if;

  v_claim := coalesce(v_order.metadata->'payment_intent_claim','null'::jsonb);
  v_claimed_at := nullif(v_claim->>'claimed_at','')::timestamptz;

  if v_claim ? 'token'
     and v_claimed_at is not null
     and v_claimed_at > now() - interval '5 minutes'
     and (v_claim->>'token') <> p_claim_token then
    return query
      select v_order.id,v_order.user_id,v_order.amount,v_order.currency,v_order.payment_status,
             v_order.fulfillment_status,v_order.pricing_hash,v_order.provider_intent_id,
             v_order.title,v_order.page_type,'IN_PROGRESS'::text;
    return;
  end if;

  update public.digital_page_orders as o
  set metadata = jsonb_set(
      coalesce(o.metadata,'{}'::jsonb),
      '{payment_intent_claim}',
      jsonb_build_object('token',p_claim_token,'claimed_at',now()::text),
      true
    ),
    updated_at = now()
  where o.id = v_order.id;

  return query
    select v_order.id,v_order.user_id,v_order.amount,v_order.currency,v_order.payment_status,
           v_order.fulfillment_status,v_order.pricing_hash,v_order.provider_intent_id,
           v_order.title,v_order.page_type,'CLAIMED'::text;
end;
$function$;

create function public.release_digital_page_payment_intent_claim_backend(
  p_order_id uuid,
  p_user_id uuid,
  p_claim_token text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'FORBIDDEN';
  end if;

  update public.digital_page_orders
  set metadata=metadata - 'payment_intent_claim',
      updated_at=now()
  where id=p_order_id
    and user_id=p_user_id
    and provider_intent_id is null
    and metadata->'payment_intent_claim'->>'token'=p_claim_token;

  return found;
end;
$function$;

create function public.fulfill_digital_page_publish(
  p_actor_user_id uuid,
  p_order_id uuid,
  p_page_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_order public.digital_page_orders%rowtype;
  v_page public.digital_pages%rowtype;
begin
  if p_actor_user_id is null or p_actor_user_id <> auth.uid() then
    raise exception 'USER_CONTEXT_MISMATCH';
  end if;

  if not public.mnty_can_platform_admin() then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;

  select * into v_order
  from public.digital_page_orders
  where id=p_order_id
  for update;

  if not found then raise exception 'DIGITAL_PAGE_ORDER_NOT_FOUND'; end if;
  if v_order.payment_status <> 'PAID' then raise exception 'PAYMENT_REQUIRED'; end if;
  if v_order.fulfillment_status not in ('REQUESTED','IN_REVIEW','IN_PROGRESS')
     and v_order.fulfillment_status <> 'PUBLISHED' then
    raise exception 'INVALID_FULFILLMENT_STATE';
  end if;

  select * into v_page
  from public.digital_pages
  where id=p_page_id
  for update;

  if not found then raise exception 'DIGITAL_PAGE_NOT_FOUND'; end if;
  if v_page.created_by <> v_order.user_id then raise exception 'PAGE_OWNER_MISMATCH'; end if;
  if v_page.page_type <> v_order.page_type then raise exception 'PAGE_TYPE_MISMATCH'; end if;
  if v_order.target_business_id is not null
     and v_page.business_id is distinct from v_order.target_business_id then
    raise exception 'BUSINESS_SCOPE_MISMATCH';
  end if;
  if v_order.page_type = 'MENU'
     and (v_order.target_business_id is null or v_page.business_id is distinct from v_order.target_business_id) then
    raise exception 'MENU_BUSINESS_SCOPE_REQUIRED';
  end if;
  if v_page.digital_page_order_id is not null
     and v_page.digital_page_order_id <> v_order.id then
    raise exception 'PAGE_ALREADY_LINKED_TO_DIFFERENT_ORDER';
  end if;

  if v_page.status = 'PUBLISHED' then
    if v_page.digital_page_order_id = v_order.id and v_order.fulfillment_status = 'PUBLISHED' then
      return jsonb_build_object('page_id',v_page.id,'order_id',v_order.id,'status','PUBLISHED','replayed',true);
    end if;
    raise exception 'PUBLISHED_PAGE_NOT_LINKED_TO_ORDER';
  end if;

  update public.digital_pages
  set digital_page_order_id=v_order.id,
      status='PUBLISHED',
      published_at=coalesce(published_at,now()),
      version=version+1,
      updated_by=p_actor_user_id,
      updated_at=now()
  where id=v_page.id;

  update public.digital_page_orders
  set fulfillment_status='PUBLISHED',updated_at=now()
  where id=v_order.id;

  insert into public.audit_logs(
    id,tenant_id,actor_user_id,action,entity_type,entity_id,new_values,result,created_at
  )
  values(
    gen_random_uuid()::text,'MNTY-PLATFORM',p_actor_user_id,'DIGITAL_PAGE_PUBLISHED',
    'digital_page_order',v_order.id::text,
    jsonb_build_object('page_id',v_page.id,'page_type',v_page.page_type),
    'SUCCESS',now()
  );

  return jsonb_build_object('page_id',v_page.id,'order_id',v_order.id,'status','PUBLISHED','replayed',false);
end;
$function$;

revoke all on function public.claim_digital_page_payment_intent_backend(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.claim_digital_page_payment_intent_backend(uuid,uuid,text,text) to authenticated;

revoke all on function public.release_digital_page_payment_intent_claim_backend(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.release_digital_page_payment_intent_claim_backend(uuid,uuid,text) to authenticated;

revoke all on function public.fulfill_digital_page_publish(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.fulfill_digital_page_publish(uuid,uuid,uuid) to authenticated;
