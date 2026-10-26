-- RC571: close the NULL-business scope bypass in order-backed MENU pages.
-- RC569 returned early when business_id was NULL, which could skip order/entitlement
-- checks and let the public-read policy treat an order-backed MENU as a legacy page.
-- Preserve legacy MENU rows only when they have no self-service order attached.

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
  if new.page_type <> 'MENU' then
    return new;
  end if;

  -- A MENU row with an attached self-service order must always be business-bound.
  if new.digital_page_order_id is not null and new.business_id is null then
    raise exception 'DIGITAL_PAGE_MENU_BUSINESS_REQUIRED';
  end if;

  -- Keep the pre-RC571 behavior for business-bound MENU rows: they must be
  -- backed by a self-service order. Only non-business legacy MENU rows retain
  -- the old early-return path.
  if new.digital_page_order_id is null then
    if new.business_id is not null then
      raise exception 'DIGITAL_PAGE_MENU_ORDER_REQUIRED';
    end if;
    return new;
  end if;

  if new.business_id is null
     or v_actor is null
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

revoke all on function public.digital_page_business_menu_insert_guard() from public, anon, authenticated;

-- Any order-backed MENU must use the subscription gate regardless of business_id.
drop policy if exists digital_pages_public_read on public.digital_pages;
create policy digital_pages_public_read
on public.digital_pages
for select to anon, authenticated
using (
  status = 'PUBLISHED'
  and (
    (
      owner_user_id is null
      and not (page_type = 'MENU' and digital_page_order_id is not null)
    )
    or public.digital_page_public_subscription_active(digital_page_order_id)
  )
);

drop policy if exists digital_page_sections_public_read on public.digital_page_sections;
create policy digital_page_sections_public_read
on public.digital_page_sections
for select to anon, authenticated
using (
  active = true
  and exists (
    select 1 from public.digital_pages p
    where p.id = digital_page_sections.page_id
      and p.status = 'PUBLISHED'
      and (
        (
          p.owner_user_id is null
          and not (p.page_type = 'MENU' and p.digital_page_order_id is not null)
        )
        or public.digital_page_public_subscription_active(p.digital_page_order_id)
      )
  )
);

comment on function public.digital_page_business_menu_insert_guard() is
  'RC571: validates all order-backed MENU pages; rejects missing business scope; requires an order for business-bound MENU rows; preserves the existing public-read contract for legacy pages while keeping business-bound MENU inserts order-backed.';
