-- RC571 disposable-database regression contract.
-- Run only against the isolated replay database after the forward migration chain.
do $$
declare
  v_guard text;
  v_page_policy text;
  v_section_policy text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.digital_page_business_menu_insert_guard()'::regprocedure
  ) into v_guard;

  if position('DIGITAL_PAGE_MENU_BUSINESS_REQUIRED' in v_guard) = 0 then
    raise exception 'RC571_REGRESSION: order-backed MENU without business scope is not rejected';
  end if;
  if position('digital_page_subscription_active' in v_guard) = 0 then
    raise exception 'RC571_REGRESSION: insert guard does not check active subscription';
  end if;
  if position('new.digital_page_order_id is null' in lower(v_guard)) = 0 then
    raise exception 'RC571_REGRESSION: legacy non-order-backed MENU path is not explicitly preserved';
  end if;
  if position('v_order.target_business_id is distinct from new.business_id' in v_guard) = 0 then
    raise exception 'RC571_REGRESSION: order/page business binding is missing';
  end if;

  select qual into v_page_policy
    from pg_catalog.pg_policies
   where schemaname = 'public'
     and tablename = 'digital_pages'
     and policyname = 'digital_pages_public_read';

  if v_page_policy is null
     or position('digital_page_public_subscription_active' in v_page_policy) = 0
     or position('DIGITAL_PAGE_ORDER_ID IS NOT NULL' in upper(v_page_policy)) = 0 then
    raise exception 'RC571_REGRESSION: public digital page policy does not gate order-backed MENU rows';
  end if;

  select qual into v_section_policy
    from pg_catalog.pg_policies
   where schemaname = 'public'
     and tablename = 'digital_page_sections'
     and policyname = 'digital_page_sections_public_read';

  if v_section_policy is null
     or position('digital_page_public_subscription_active' in v_section_policy) = 0
     or position('DIGITAL_PAGE_ORDER_ID IS NOT NULL' in upper(v_section_policy)) = 0 then
    raise exception 'RC571_REGRESSION: public section policy does not gate order-backed MENU rows';
  end if;
end;
$$;

select 'RC571 MENU scope bypass disposable-database regression: PASS' as result;
