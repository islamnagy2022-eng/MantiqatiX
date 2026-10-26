-- RC574 runtime regression for scoped cash-payment authorization.
-- Run only after the full candidate chain in the disposable Supabase replay database.
-- Fixtures are synthetic and rolled back. The payment intent is already SUCCEEDED
-- specifically to prove the idempotent success response does not leak before authorization.
begin;

insert into public.tenants (id, name, code, status)
values ('RC574-TEST', 'RC574 Disposable Payment Scope Test', 'RC574-TEST', 'ACTIVE');

insert into public.businesses (id, tenant_id, name, code, status)
values
  ('57400000-0000-4000-8000-000000000010', 'RC574-TEST', 'RC574 Business A', 'RC574-A', 'INACTIVE'),
  ('57400000-0000-4000-8000-000000000020', 'RC574-TEST', 'RC574 Business B', 'RC574-B', 'INACTIVE');

insert into public.branches (id, tenant_id, business_id, name, code)
values
  ('RC574-BRANCH-A', 'RC574-TEST', '57400000-0000-4000-8000-000000000010', 'RC574 Branch A', 'RC574-A'),
  ('RC574-BRANCH-B', 'RC574-TEST', '57400000-0000-4000-8000-000000000020', 'RC574 Branch B', 'RC574-B');

insert into auth.users
  (id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   is_sso_user, is_anonymous)
values
  ('57400000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rc574-owner-a@example.invalid', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"test_fixture":true}'::jsonb, now(), now(), false, false),
  ('57400000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rc574-owner-b@example.invalid', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"test_fixture":true}'::jsonb, now(), now(), false, false),
  ('57400000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'rc574-tenant-admin@example.invalid', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"test_fixture":true}'::jsonb, now(), now(), false, false),
  ('57400000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'rc574-unscoped-owner@example.invalid', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"test_fixture":true}'::jsonb, now(), now(), false, false);

insert into public.user_memberships
  (id, user_id, tenant_id, business_id, branch_id, role, permissions, status)
values
  ('RC574-OWNER-A', '57400000-0000-4000-8000-000000000001', 'RC574-TEST',
   '57400000-0000-4000-8000-000000000010', 'RC574-BRANCH-A', 'OWNER', '{}'::jsonb, 'ACTIVE'),
  ('RC574-OWNER-B', '57400000-0000-4000-8000-000000000002', 'RC574-TEST',
   '57400000-0000-4000-8000-000000000020', 'RC574-BRANCH-B', 'OWNER', '{}'::jsonb, 'ACTIVE'),
  ('RC574-TENANT-ADMIN', '57400000-0000-4000-8000-000000000003', 'RC574-TEST',
   null, null, 'ADMIN', '{}'::jsonb, 'ACTIVE'),
  ('RC574-UNSCOPED-OWNER', '57400000-0000-4000-8000-000000000004', 'RC574-TEST',
   null, null, 'OWNER', '{}'::jsonb, 'ACTIVE');

insert into public.orders
  (id, tenant_id, business_id, branch_id, customer_id, status, subtotal, discount, tax,
   delivery_fee, total_amount, currency, customer_name, customer_phone,
   delivery_address, items_json, metadata, pricing_version, pricing_hash, pricing_snapshot, pricing_authority)
values
  ('57400000-0000-4000-8000-000000000030', 'RC574-TEST',
   '57400000-0000-4000-8000-000000000020', 'RC574-BRANCH-B', null, 'NEW',
   82, 0, 0, 0, 82, 'EGP', 'RC574 Test Order', '0000000000',
   'Disposable only', '[]'::jsonb, '{"test_fixture":true}'::jsonb,
   1, 'rc574-pricing-hash', '[]'::jsonb, 'catalog_v1');

insert into public.tenant_payment_methods
  (tenant_id, provider, payment_method, is_enabled, public_config, provider_secrets)
values
  ('RC574-TEST', 'CASH_ON_DELIVERY', 'CASH_ON_DELIVERY', true, '{}'::jsonb, '{}'::jsonb);

insert into public.payment_intents
  (id, tenant_id, order_id, amount, currency, status, provider, idempotency_key,
   payment_method, pricing_version, pricing_hash)
values
  ('57400000-0000-4000-8000-000000000040', 'RC574-TEST',
   '57400000-0000-4000-8000-000000000030', 82, 'EGP', 'SUCCEEDED',
   'CASH_ON_DELIVERY', 'rc574-succeeded-intent', 'CASH_ON_DELIVERY',
   1, 'rc574-pricing-hash');

do $test$
declare
  v_rejected boolean;
  v_result jsonb;
begin
  -- Same tenant, wrong business/branch: must not expose an already-successful payment.
  perform pg_catalog.set_config('request.jwt.claim.sub', '57400000-0000-4000-8000-000000000001', true);
  v_rejected := false;
  begin
    v_result := public.confirm_cash_payment(
      '57400000-0000-4000-8000-000000000040',
      '57400000-0000-4000-8000-000000000001'
    );
  exception when others then
    if sqlerrm = 'FORBIDDEN' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then
    raise exception 'RC574_CROSS_BUSINESS_OWNER_READ_SUCCEEDED_INTENT: %', v_result;
  end if;

  -- An OWNER with no business scope is not a tenant-wide administrator.
  perform pg_catalog.set_config('request.jwt.claim.sub', '57400000-0000-4000-8000-000000000004', true);
  v_rejected := false;
  begin
    v_result := public.confirm_cash_payment(
      '57400000-0000-4000-8000-000000000040',
      '57400000-0000-4000-8000-000000000004'
    );
  exception when others then
    if sqlerrm = 'FORBIDDEN' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then
    raise exception 'RC574_UNSCOPED_OWNER_READ_SUCCEEDED_INTENT: %', v_result;
  end if;

  -- Correct branch owner and explicit tenant-wide ADMIN may use the idempotent response.
  perform pg_catalog.set_config('request.jwt.claim.sub', '57400000-0000-4000-8000-000000000002', true);
  v_result := public.confirm_cash_payment(
    '57400000-0000-4000-8000-000000000040',
    '57400000-0000-4000-8000-000000000002'
  );
  if v_result->>'status' <> 'success' or v_result->>'message' <> 'Already confirmed' then
    raise exception 'RC574_MATCHING_BRANCH_OWNER_IDEMPOTENT_READ_FAILED: %', v_result;
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', '57400000-0000-4000-8000-000000000003', true);
  v_result := public.confirm_cash_payment(
    '57400000-0000-4000-8000-000000000040',
    '57400000-0000-4000-8000-000000000003'
  );
  if v_result->>'status' <> 'success' or v_result->>'message' <> 'Already confirmed' then
    raise exception 'RC574_TENANT_ADMIN_IDEMPOTENT_READ_FAILED: %', v_result;
  end if;
end;
$test$;

rollback;
\echo 'RC574 cash-payment business/branch authorization regression: PASS'
