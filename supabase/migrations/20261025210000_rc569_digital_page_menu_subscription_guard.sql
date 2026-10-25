-- RC569: bind self-service MENU pages to a paid order for the same business.
-- Candidate only: deploy only after the full migration/release gates pass.
create or replace function public.digital_page_business_menu_insert_guard()
returns trigger
language plpgsql
security invoker
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
