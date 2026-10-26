-- RC568 runtime regression: WhatsApp-requested subscription activation is gated, audited and idempotently fails closed.
-- Intended only for disposable PostgreSQL after the candidate RC567-RC572 chain.
-- All fixture writes, including the synthetic auth user, are rolled back at the end.
begin;

insert into public.tenants (id, name, code, status)
values ('MNTY-PLATFORM', 'RC568 Platform Test Tenant', 'RC568-PLATFORM', 'ACTIVE')
on conflict (id) do nothing;

insert into public.tenants (id, name, code, status)
values ('RC568-TEST', 'RC568 Disposable Activation Test', 'RC568-TEST', 'ACTIVE');

insert into public.businesses (id, tenant_id, name, code)
values ('56800000-0000-4000-8000-000000000030', 'RC568-TEST',
        'RC568 Test Restaurant', 'RC568-TEST-BIZ');

insert into public.branches (id, tenant_id, business_id, name, code)
values ('RC568-BRANCH-001', 'RC568-TEST', '56800000-0000-4000-8000-000000000030',
        'RC568 Test Branch', 'RC568-BRANCH-001');

insert into auth.users
  (id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   is_sso_user, is_anonymous)
values
  ('56800000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'rc568-platform-admin@example.invalid', '', pg_catalog.now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"RC568 Test Platform Admin"}'::jsonb,
   pg_catalog.now(), pg_catalog.now(), false, false),
  ('56800000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'rc568-customer@example.invalid', '', pg_catalog.now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"RC568 Test Customer"}'::jsonb,
   pg_catalog.now(), pg_catalog.now(), false, false),
  ('56800000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'rc568-tenant-owner@example.invalid', '', pg_catalog.now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"RC568 Tenant Owner"}'::jsonb,
   pg_catalog.now(), pg_catalog.now(), false, false);

insert into public.user_memberships
  (id, user_id, tenant_id, business_id, branch_id, role, permissions, status)
values
  ('RC568-PLATFORM-ADMIN', '56800000-0000-4000-8000-000000000001',
   'MNTY-PLATFORM', null, null, 'SUPER_ADMIN',
   '{"scope":"PLATFORM","full_control":true}'::jsonb, 'ACTIVE'),
  ('RC568-TENANT-OWNER', '56800000-0000-4000-8000-000000000003',
   'RC568-TEST', null, null, 'OWNER',
   '{"admin":true,"scope":"PLATFORM","full_control":true}'::jsonb, 'ACTIVE'),
  ('RC568-MENU-BUSINESS-OWNER', '56800000-0000-4000-8000-000000000002',
   'RC568-TEST', '56800000-0000-4000-8000-000000000030', 'RC568-BRANCH-001', 'OWNER',
   '{"business":"owner"}'::jsonb, 'ACTIVE');

insert into public.digital_page_products
  (id, page_type, code, name_ar, price, currency, duration_days, features, active)
values
  ('56800000-0000-4000-8000-000000000010', 'PORTFOLIO', 'RC568-PORTFOLIO-TEST',
   'RC568 Portfolio Test Package', 125.50, 'EGP', 30, '[]'::jsonb, true),
  ('56800000-0000-4000-8000-000000000011', 'MENU', 'RC568-MENU-TEST',
   'RC568 Menu Test Package', 82.00, 'EGP', 30, '[]'::jsonb, true);

insert into public.digital_page_orders
  (id, user_id, target_business_id, product_id, page_type, title, amount, currency,
   pricing_hash, idempotency_key, payment_status, fulfillment_status, metadata)
values
  ('56800000-0000-4000-8000-000000000020',
   '56800000-0000-4000-8000-000000000002', null,
   '56800000-0000-4000-8000-000000000010',
   'PORTFOLIO', 'RC568 Pending Portfolio A', 125.50, 'EGP',
   'rc568-test-pricing-hash-a', 'rc568-test-idempotency-a',
   'PENDING', 'REQUESTED', '{"test_fixture":true}'::jsonb),
  ('56800000-0000-4000-8000-000000000021',
   '56800000-0000-4000-8000-000000000002', '56800000-0000-4000-8000-000000000030',
   '56800000-0000-4000-8000-000000000011',
   'MENU', 'RC568 Pending Menu', 82.00, 'EGP',
   'rc568-test-pricing-hash-menu', 'rc568-test-idempotency-menu',
   'PENDING', 'REQUESTED', '{"test_fixture":true}'::jsonb),
  ('56800000-0000-4000-8000-000000000022',
   '56800000-0000-4000-8000-000000000002', null,
   '56800000-0000-4000-8000-000000000010',
   'PORTFOLIO', 'RC568 Pending Portfolio C', 125.50, 'EGP',
   'rc568-test-pricing-hash-c', 'rc568-test-idempotency-c',
   'PENDING', 'REQUESTED', '{"test_fixture":true}'::jsonb),
  ('56800000-0000-4000-8000-000000000023',
   '56800000-0000-4000-8000-000000000002', null,
   '56800000-0000-4000-8000-000000000011',
   'MENU', 'RC568 Invalid Pending Menu', 82.00, 'EGP',
   'rc568-test-pricing-hash-invalid-menu', 'rc568-test-idempotency-invalid-menu',
   'PENDING', 'REQUESTED', '{"test_fixture":true}'::jsonb);

do $test$
declare
  v_admin constant uuid := '56800000-0000-4000-8000-000000000001';
  v_owner constant uuid := '56800000-0000-4000-8000-000000000003';
  v_order_a constant uuid := '56800000-0000-4000-8000-000000000020';
  v_order_menu constant uuid := '56800000-0000-4000-8000-000000000021';
  v_order_c constant uuid := '56800000-0000-4000-8000-000000000022';
  v_order_invalid_menu constant uuid := '56800000-0000-4000-8000-000000000023';
  v_test_business constant uuid := '56800000-0000-4000-8000-000000000030';
  v_result jsonb;
  v_pending jsonb;
  v_status text;
  v_paid_at timestamptz;
  v_audit_count integer;
  v_audit_actor uuid;
  v_audit_reference text;
  v_audit_amount numeric;
  v_audit_currency text;
  v_rejected boolean;
  v_rls_enabled boolean;
begin
  -- Access configuration must keep the audit table available only through its
  -- authenticated, platform-admin-filtered read policy.
  if has_table_privilege('anon', 'public.digital_page_manual_activation_audit', 'SELECT') then
    raise exception 'RC568_ANON_AUDIT_READ_MUST_BE_REVOKED';
  end if;
  if not has_table_privilege('authenticated', 'public.digital_page_manual_activation_audit', 'SELECT') then
    raise exception 'RC568_AUTHENTICATED_AUDIT_READ_GRANT_MISSING';
  end if;
  select c.relrowsecurity into v_rls_enabled
    from pg_catalog.pg_class c
   where c.oid = 'public.digital_page_manual_activation_audit'::regclass;
  if v_rls_enabled is distinct from true then
    raise exception 'RC568_AUDIT_TABLE_RLS_MUST_BE_ENABLED';
  end if;

  -- Tenant owner must not enumerate the queue or activate an order, even when
  -- its local permission JSON claims admin/platform flags.
  perform pg_catalog.set_config('request.jwt.claim.sub', v_owner::text, true);
  v_rejected := false;
  begin
    perform public.mnty_admin_list_pending_digital_page_subscriptions();
  exception when others then
    if sqlerrm = 'PLATFORM_ADMIN_REQUIRED' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then
    raise exception 'RC568_TENANT_OWNER_READ_PENDING_QUEUE';
  end if;

  v_rejected := false;
  begin
    perform public.mnty_admin_activate_digital_page_subscription(
      v_order_a, 'RC568-UNAUTHORIZED-REFERENCE', null
    );
  exception when others then
    if sqlerrm = 'PLATFORM_ADMIN_REQUIRED' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then
    raise exception 'RC568_TENANT_OWNER_ACTIVATED_SUBSCRIPTION';
  end if;

  select payment_status into v_status
    from public.digital_page_orders where id = v_order_a;
  if v_status <> 'PENDING' then
    raise exception 'RC568_UNAUTHORIZED_CALL_CHANGED_PAYMENT_STATUS';
  end if;
  select count(*) into v_audit_count
    from public.digital_page_manual_activation_audit where order_id = v_order_a;
  if v_audit_count <> 0 then
    raise exception 'RC568_UNAUTHORIZED_CALL_CREATED_AUDIT_ROW';
  end if;

  -- Platform admins can see only the bounded PENDING PORTFOLIO queue.
  perform pg_catalog.set_config('request.jwt.claim.sub', v_admin::text, true);
  v_pending := public.mnty_admin_list_pending_digital_page_subscriptions();
  if pg_catalog.jsonb_array_length(v_pending) <> 4
     or not (v_pending @> pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id', v_order_a::text)))
     or not (v_pending @> pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id', v_order_c::text)))
     or not (v_pending @> pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id', v_order_menu::text)))
     or not (v_pending @> pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id', v_order_invalid_menu::text))) then
    raise exception 'RC568_PENDING_QUEUE_SCOPE_OR_FILTER_INCORRECT: %', v_pending;
  end if;

  -- A blank reference and oversized notes must fail before mutating the order.
  v_rejected := false;
  begin
    perform public.mnty_admin_activate_digital_page_subscription(v_order_a, '  ', null);
  exception when others then
    if sqlerrm = 'MANUAL_PAYMENT_REFERENCE_REQUIRED' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'RC568_BLANK_PAYMENT_REFERENCE_ACCEPTED'; end if;

  v_rejected := false;
  begin
    perform public.mnty_admin_activate_digital_page_subscription(v_order_a, 'RC568-VALID-REF', pg_catalog.repeat('x', 1001));
  exception when others then
    if sqlerrm = 'MANUAL_ACTIVATION_NOTES_TOO_LONG' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'RC568_OVERSIZED_NOTES_ACCEPTED'; end if;

  select payment_status into v_status
    from public.digital_page_orders where id = v_order_a;
  select count(*) into v_audit_count
    from public.digital_page_manual_activation_audit where order_id = v_order_a;
  if v_status <> 'PENDING' or v_audit_count <> 0 then
    raise exception 'RC568_INVALID_INPUT_MUTATED_ORDER_OR_AUDIT';
  end if;

  -- A MENU order without a target business must be rejected without mutation.
  v_rejected := false;
  begin
    perform public.mnty_admin_activate_digital_page_subscription(
      v_order_invalid_menu, 'RC568-INVALID-MENU-REF', null
    );
  exception when others then
    if sqlerrm = 'DIGITAL_PAGE_MENU_BUSINESS_SCOPE_INVALID' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'RC568_MENU_ORDER_WITHOUT_BUSINESS_SCOPE_ACCEPTED'; end if;
  select payment_status into v_status
    from public.digital_page_orders where id = v_order_invalid_menu;
  if v_status <> 'PENDING' then raise exception 'RC568_INVALID_MENU_ORDER_STATUS_CHANGED'; end if;

  -- Valid admin activation must atomically mark PAID, stamp paid_at, and write
  -- exactly one immutable audit record with the authenticated actor and amount.
  v_result := public.mnty_admin_activate_digital_page_subscription(
    v_order_a, '  RC568-EXTERNAL-REFERENCE-001  ', '  Independently checked in test fixture  '
  );
  if v_result->>'payment_status' <> 'PAID'
     or nullif(v_result->>'paid_at', '') is null
     or v_result->>'activated_by' <> v_admin::text then
    raise exception 'RC568_ACTIVATION_RESPONSE_INVALID: %', v_result;
  end if;

  select payment_status, paid_at into v_status, v_paid_at
    from public.digital_page_orders where id = v_order_a;
  if v_status <> 'PAID' or v_paid_at is null then
    raise exception 'RC568_PAID_AT_OR_PAYMENT_STATUS_NOT_SET';
  end if;

  select count(*) into v_audit_count
    from public.digital_page_manual_activation_audit where order_id = v_order_a;
  if v_audit_count <> 1 then
    raise exception 'RC568_EXPECTED_ONE_AUDIT_ROW_GOT_%', v_audit_count;
  end if;
  select actor_user_id, payment_reference, amount, currency
    into v_audit_actor, v_audit_reference, v_audit_amount, v_audit_currency
    from public.digital_page_manual_activation_audit where order_id = v_order_a;
  if v_audit_actor <> v_admin
     or v_audit_reference <> 'RC568-EXTERNAL-REFERENCE-001'
     or v_audit_amount <> 125.50
     or v_audit_currency <> 'EGP' then
    raise exception 'RC568_AUDIT_CONTENT_MISMATCH';
  end if;

  -- A repeat attempt cannot replace the evidence or create a second audit row.
  v_rejected := false;
  begin
    perform public.mnty_admin_activate_digital_page_subscription(v_order_a, 'RC568-SECOND-REFERENCE', null);
  exception when others then
    if sqlerrm = 'DIGITAL_PAGE_ORDER_NOT_PENDING' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'RC568_DUPLICATE_ACTIVATION_WAS_ACCEPTED'; end if;
  select count(*) into v_audit_count
    from public.digital_page_manual_activation_audit where order_id = v_order_a;
  if v_audit_count <> 1 then raise exception 'RC568_DUPLICATE_AUDIT_ROW_CREATED'; end if;

  -- The owner-side entitlement RPC reflects the activation and remains tied to
  -- the authenticated customer and the canonical order/product.
  perform pg_catalog.set_config('request.jwt.claim.sub', '56800000-0000-4000-8000-000000000002', true);
  if public.digital_page_subscription_active(v_order_a, '56800000-0000-4000-8000-000000000002') is not true then
    raise exception 'RC568_OWNER_SUBSCRIPTION_ENTITLEMENT_NOT_ACTIVE_AFTER_PAID';
  end if;
  if public.digital_page_subscription_active(v_order_a, v_admin) is not false then
    raise exception 'RC568_ENTITLEMENT_HELPER_ACCEPTED_WRONG_USER';
  end if;

  -- A published-page binding may be stored only for a real branch belonging to
  -- the same business and tenant. First create the paid MENU page under its owner.
  perform pg_catalog.set_config('request.jwt.claim.sub', '56800000-0000-4000-8000-000000000002', true);
  insert into public.digital_pages
    (id, page_type, business_id, slug, title, status, created_by, updated_by, digital_page_order_id)
  values
    ('56800000-0000-4000-8000-000000000040', 'MENU',
     '56800000-0000-4000-8000-000000000030',
     'rc568-branch-menu-test', 'RC568 Branch Menu Test',
     'DRAFT', '56800000-0000-4000-8000-000000000002',
     '56800000-0000-4000-8000-000000000002', v_order_menu);

  -- An inconsistent tenant/business pair is rejected by the trigger, even when
  -- the caller is authorized for the page itself.
  v_rejected := false;
  begin
    insert into public.digital_page_menu_branch_bindings
      (page_id, tenant_id, business_id, branch_id, updated_by)
    values
      ('56800000-0000-4000-8000-000000000040', 'MNTY-PLATFORM',
       '56800000-0000-4000-8000-000000000030', 'RC568-BRANCH-001',
       '56800000-0000-4000-8000-000000000002');
  exception when others then
    if sqlerrm = 'DIGITAL_PAGE_MENU_BRANCH_BINDING_TENANT_SCOPE_INVALID' then
      v_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_rejected then
    raise exception 'RC568_CROSS_TENANT_MENU_BRANCH_BINDING_ACCEPTED';
  end if;

  insert into public.digital_page_menu_branch_bindings
    (page_id, tenant_id, business_id, branch_id, updated_by)
  values
    ('56800000-0000-4000-8000-000000000040', 'RC568-TEST',
     '56800000-0000-4000-8000-000000000030', 'RC568-BRANCH-001',
     '56800000-0000-4000-8000-000000000002');

  v_rejected := false;
  begin
    update public.digital_page_menu_branch_bindings
       set branch_id = 'MNTY-BERKET-MAIN'
     where page_id = '56800000-0000-4000-8000-000000000040';
  exception when others then
    if sqlerrm = 'DIGITAL_PAGE_MENU_BRANCH_BINDING_IMMUTABLE' then
      v_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_rejected then
    raise exception 'RC568_MENU_BRANCH_BINDING_IDENTITY_WAS_MUTABLE';
  end if;

  -- A correctly scoped MENU subscription must activate successfully, record its
  -- payment reference and preserve the target-business boundary.
  v_result := public.mnty_admin_activate_digital_page_subscription(
    v_order_menu, '  RC568-MENU-EXTERNAL-REFERENCE-002  ', 'Business-scoped menu fixture'
  );
  if v_result->>'payment_status' <> 'PAID'
     or v_result->>'page_type' <> 'MENU'
     or v_result->>'target_business_id' <> v_test_business::text
     or v_result->>'activated_by' <> v_admin::text
     or nullif(v_result->>'paid_at', '') is null then
    raise exception 'RC568_MENU_ACTIVATION_RESPONSE_INVALID: %', v_result;
  end if;
  select count(*) into v_audit_count
    from public.digital_page_manual_activation_audit where order_id = v_order_menu;
  if v_audit_count <> 1 then
    raise exception 'RC568_MENU_ACTIVATION_AUDIT_MISSING_OR_DUPLICATED';
  end if;
  select actor_user_id, payment_reference, amount, currency
    into v_audit_actor, v_audit_reference, v_audit_amount, v_audit_currency
    from public.digital_page_manual_activation_audit where order_id = v_order_menu;
  if v_audit_actor <> v_admin
     or v_audit_reference <> 'RC568-MENU-EXTERNAL-REFERENCE-002'
     or v_audit_amount <> 82.00
     or v_audit_currency <> 'EGP' then
    raise exception 'RC568_MENU_AUDIT_CONTENT_MISMATCH';
  end if;

  -- After both valid activations, the pending queue must retain only the
  -- invalidly scoped MENU and the still-pending PORTFOLIO order.
  perform pg_catalog.set_config('request.jwt.claim.sub', v_admin::text, true);
  v_pending := public.mnty_admin_list_pending_digital_page_subscriptions();
  if pg_catalog.jsonb_array_length(v_pending) <> 2
     or v_pending @> pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id', v_order_a::text))
     or v_pending @> pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id', v_order_menu::text))
     or not (v_pending @> pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id', v_order_c::text)))
     or not (v_pending @> pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id', v_order_invalid_menu::text))) then
    raise exception 'RC568_ACTIVATED_OR_INVALID_ORDER_QUEUE_FILTER_INCORRECT: %', v_pending;
  end if;
end;
$test$;

rollback;
\echo 'RC568 manual activation integration regression: PASS'
