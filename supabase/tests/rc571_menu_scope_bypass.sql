-- RC571 disposable-database regression contract.
-- Run only against the isolated replay database after the forward migration chain.
do $$
declare
  v_guard text;
  v_binding_guard text;
  v_section_write_guard text;
  v_page_policy text;
  v_section_policy text;
  v_tenant_type text;
  v_branch_type text;
begin
  -- Keep the binding schema aligned with the canonical text identifiers.
  select data_type into v_tenant_type
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'digital_page_menu_branch_bindings'
     and column_name = 'tenant_id';
  select data_type into v_branch_type
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'digital_page_menu_branch_bindings'
     and column_name = 'branch_id';
  if v_tenant_type is distinct from 'character varying' then
    raise exception 'RC571_REGRESSION: binding tenant_id must be VARCHAR, got %', v_tenant_type;
  end if;
  if v_branch_type is distinct from 'character varying' then
    raise exception 'RC571_REGRESSION: binding branch_id must be VARCHAR, got %', v_branch_type;
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.digital_page_menu_branch_binding_scope_guard()'::regprocedure
  ) into v_binding_guard;
  if position('public.branches' in v_binding_guard) = 0
     or position('public.businesses' in v_binding_guard) = 0
     or position('DIGITAL_PAGE_MENU_BRANCH_BINDING_TENANT_SCOPE_INVALID' in v_binding_guard) = 0
     or position('DIGITAL_PAGE_MENU_BRANCH_BINDING_BRANCH_SCOPE_INVALID' in v_binding_guard) = 0 then
    raise exception 'RC571_REGRESSION: private branch binding does not enforce canonical tenant/business/branch scope';
  end if;

  if position('digital_page_subscription_active' in v_binding_guard) = 0
     or position('digital_page_public_subscription_active' in v_binding_guard) > 0 then
    raise exception 'RC571_REGRESSION: owner branch binding must check the paid owner entitlement, not public publication state';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.digital_page_menu_section_write_allowed(uuid, uuid)'::regprocedure
  ) into v_section_write_guard;
  if position('digital_page_subscription_active' in v_section_write_guard) = 0
     or position('digital_page_public_subscription_active' in v_section_write_guard) > 0 then
    raise exception 'RC571_REGRESSION: authenticated section writes must support active draft subscriptions without exposing them publicly';
  end if;

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
  if position('DIGITAL_PAGE_MENU_ORDER_REQUIRED' in v_guard) = 0 then
    raise exception 'RC571_REGRESSION: business-bound MENU without an order must be rejected';
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
