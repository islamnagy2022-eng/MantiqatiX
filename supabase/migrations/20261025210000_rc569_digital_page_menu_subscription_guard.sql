-- RC569: bind self-service MENU pages to a paid order for the same business.
-- Candidate only: deploy only after the full migration/release gates pass.
create or replace function public.digital_page_business_menu_insert_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.digital_page_orders%rowtype;
  v_actor uuid := auth.uid();
begin
  if new.page_type <> 'MENU' or new.business_id is null then
    return new;
  end if;

  if v_actor is null
     or new.created_by is distinct from v_actor
     or new.updated_by is distinct from v_actor
     or new.owner_user_id is not null
     or new.provider_profile_id is not null then
    raise exception 'DIGITAL_PAGE_MENU_OWNER_SCOPE_INVALID';
  end if;

  select * into v_order
  from public.digital_page_orders
  where id = new.digital_page_order_id
  for update;

  if not found
     or v_order.user_id is distinct from v_actor
     or v_order.target_business_id is distinct from new.business_id
     or v_order.page_type <> 'MENU'
     or v_order.payment_status <> 'PAID'
     or v_order.fulfillment_status not in ('REQUESTED','IN_REVIEW','IN_PROGRESS','PUBLISHED') then
    raise exception 'DIGITAL_PAGE_MENU_ORDER_SCOPE_INVALID';
  end if;

  if not coalesce(public.digital_page_subscription_active(v_order.id, v_actor), false) then
    raise exception 'DIGITAL_PAGE_MENU_SUBSCRIPTION_INACTIVE';
  end if;

  if exists (
    select 1 from public.digital_pages p
    where p.digital_page_order_id = v_order.id
  ) then
    raise exception 'DIGITAL_PAGE_ORDER_ALREADY_USED';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_digital_page_business_menu_insert_guard on public.digital_pages;
create trigger trg_digital_page_business_menu_insert_guard
before insert on public.digital_pages
for each row
execute function public.digital_page_business_menu_insert_guard();

revoke all on function public.digital_page_business_menu_insert_guard() from public, anon, authenticated;


-- Extend the audited WhatsApp activation queue to MENU subscriptions as well.
create or replace function public.mnty_admin_list_pending_digital_page_subscriptions()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not coalesce(public.mnty_can_platform_admin(), false) then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', o.id,
        'user_id', o.user_id,
        'product_id', o.product_id,
        'page_type', o.page_type,
        'target_business_id', o.target_business_id,
        'business_name', o.business_name,
        'title', o.title,
        'amount', o.amount,
        'currency', o.currency,
        'created_at', o.created_at,
        'payment_status', o.payment_status
      ) order by o.created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select o.*, b.name as business_name
    from public.digital_page_orders o
    left join public.businesses b on b.id = o.target_business_id
    where o.page_type = any(array['PORTFOLIO','MENU'])
      and o.payment_status = 'PENDING'
    order by o.created_at desc
    limit 50
  ) o;

  return v_result;
end;
$$;

revoke all on function public.mnty_admin_list_pending_digital_page_subscriptions() from public, anon;
grant execute on function public.mnty_admin_list_pending_digital_page_subscriptions() to authenticated;

create or replace function public.mnty_admin_activate_digital_page_subscription(
  p_order_id uuid,
  p_payment_reference text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.digital_page_orders%rowtype;
begin
  if v_actor is null or not coalesce(public.mnty_can_platform_admin(), false) then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;
  if p_order_id is null then
    raise exception 'DIGITAL_PAGE_ORDER_REQUIRED';
  end if;
  if p_payment_reference is null
     or pg_catalog.char_length(pg_catalog.btrim(p_payment_reference)) < 3
     or pg_catalog.char_length(pg_catalog.btrim(p_payment_reference)) > 160 then
    raise exception 'MANUAL_PAYMENT_REFERENCE_REQUIRED';
  end if;
  if p_notes is not null and pg_catalog.char_length(p_notes) > 1000 then
    raise exception 'MANUAL_ACTIVATION_NOTES_TOO_LONG';
  end if;

  select * into v_order
  from public.digital_page_orders
  where id = p_order_id
  for update;
  if not found then raise exception 'DIGITAL_PAGE_ORDER_NOT_FOUND'; end if;
  if v_order.page_type not in ('PORTFOLIO','MENU') then
    raise exception 'MANUAL_ACTIVATION_PAGE_TYPE_NOT_SUPPORTED';
  end if;
  if v_order.payment_status <> 'PENDING' then
    raise exception 'DIGITAL_PAGE_ORDER_NOT_PENDING';
  end if;
  if v_order.user_id is null or v_order.product_id is null then
    raise exception 'DIGITAL_PAGE_ORDER_SCOPE_INVALID';
  end if;
  if not exists (
    select 1 from public.digital_page_products p
    where p.id = v_order.product_id and p.page_type = v_order.page_type
  ) then
    raise exception 'DIGITAL_PAGE_PRODUCT_TYPE_MISMATCH';
  end if;
  if v_order.page_type = 'MENU' then
    if v_order.target_business_id is null or not exists (
      select 1 from public.user_memberships m
      where m.user_id = v_order.user_id
        and m.business_id = v_order.target_business_id
        and m.status = 'ACTIVE'
        and upper(coalesce(m.role,'')) = any(array['OWNER','BUSINESS_OWNER','ADMIN','MANAGER'])
    ) then
      raise exception 'DIGITAL_PAGE_MENU_BUSINESS_SCOPE_INVALID';
    end if;
  elsif v_order.target_business_id is not null then
    raise exception 'DIGITAL_PAGE_PORTFOLIO_BUSINESS_SCOPE_INVALID';
  end if;

  update public.digital_page_orders
  set payment_status = 'PAID'
  where id = p_order_id
  returning * into v_order;

  insert into public.digital_page_manual_activation_audit (
    order_id, actor_user_id, payment_reference, notes, amount, currency
  ) values (
    v_order.id, v_actor, pg_catalog.btrim(p_payment_reference),
    nullif(pg_catalog.btrim(coalesce(p_notes, '')), ''),
    v_order.amount, v_order.currency
  );

  return pg_catalog.jsonb_build_object(
    'order_id', v_order.id,
    'payment_status', v_order.payment_status,
    'paid_at', v_order.paid_at,
    'page_type', v_order.page_type,
    'target_business_id', v_order.target_business_id,
    'activated_by', v_actor
  );
end;
$$;

revoke all on function public.mnty_admin_activate_digital_page_subscription(uuid, text, text) from public, anon;
grant execute on function public.mnty_admin_activate_digital_page_subscription(uuid, text, text) to authenticated;

comment on function public.mnty_admin_activate_digital_page_subscription(uuid, text, text) is
  'Platform-admin-only manual activation for PORTFOLIO and business-scoped MENU subscriptions after independent external payment verification; records an audit row and does not collect funds.';
