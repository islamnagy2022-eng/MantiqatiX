-- RC568: audited manual activation for WhatsApp-requested digital-page subscriptions.
-- This does not collect payments. A platform admin may activate only after independently
-- verifying an external payment/reference and records the decision in an immutable audit row.

create table if not exists public.digital_page_manual_activation_audit (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.digital_page_orders(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  payment_reference text not null check (char_length(pg_catalog.btrim(payment_reference)) between 3 and 160),
  notes text,
  amount numeric not null,
  currency text not null,
  activated_at timestamptz not null default pg_catalog.now()
);

alter table public.digital_page_manual_activation_audit enable row level security;

drop policy if exists digital_page_manual_activation_audit_admin_read on public.digital_page_manual_activation_audit;
create policy digital_page_manual_activation_audit_admin_read
  on public.digital_page_manual_activation_audit
  for select
  to authenticated
  using (coalesce(public.mnty_can_platform_admin(), false));

revoke all on public.digital_page_manual_activation_audit from anon, authenticated;
grant select on public.digital_page_manual_activation_audit to authenticated;

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

  select *
    into v_order
    from public.digital_page_orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'DIGITAL_PAGE_ORDER_NOT_FOUND';
  end if;

  if v_order.page_type <> 'PORTFOLIO' then
    raise exception 'MANUAL_ACTIVATION_PAGE_TYPE_NOT_SUPPORTED';
  end if;

  if v_order.payment_status <> 'PENDING' then
    raise exception 'DIGITAL_PAGE_ORDER_NOT_PENDING';
  end if;

  if v_order.user_id is null or v_order.product_id is null then
    raise exception 'DIGITAL_PAGE_ORDER_SCOPE_INVALID';
  end if;

  update public.digital_page_orders
     set payment_status = 'PAID'
   where id = p_order_id
   returning * into v_order;

  insert into public.digital_page_manual_activation_audit (
    order_id, actor_user_id, payment_reference, notes, amount, currency
  ) values (
    v_order.id,
    v_actor,
    pg_catalog.btrim(p_payment_reference),
    nullif(pg_catalog.btrim(coalesce(p_notes, '')), ''),
    v_order.amount,
    v_order.currency
  );

  return pg_catalog.jsonb_build_object(
    'order_id', v_order.id,
    'payment_status', v_order.payment_status,
    'paid_at', v_order.paid_at,
    'activated_by', v_actor
  );
end;
$$;

revoke all on function public.mnty_admin_activate_digital_page_subscription(uuid, text, text) from public, anon;
grant execute on function public.mnty_admin_activate_digital_page_subscription(uuid, text, text) to authenticated;

comment on function public.mnty_admin_activate_digital_page_subscription(uuid, text, text) is
  'Platform-admin-only manual activation after independent external payment verification; records an audit row and does not collect funds.';
