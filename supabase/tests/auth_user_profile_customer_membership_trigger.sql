-- Behavioral regression for RC215: auth.users insert must create profile before membership.
-- This entire test rolls back and creates no persistent test account.
BEGIN;

DO $test$
DECLARE
  v_user_id uuid := 'f7914ac7-4b03-4456-afdd-e386f2ac6a5c'::uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'trigger_regression_fixture_id_already_exists';
  END IF;

  INSERT INTO auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous
  )
  VALUES (
    v_user_id,
    'authenticated',
    'authenticated',
    'auth-trigger-regression@invalid.example',
    '',
    NULL,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Synthetic Trigger Regression"}'::jsonb,
    now(),
    now(),
    false
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = v_user_id
      AND tenant_id = 'MNTY-PLATFORM'
      AND email = 'auth-trigger-regression@invalid.example'
  ) THEN
    RAISE EXCEPTION 'auth_user_profile_not_created_before_membership';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_memberships
    WHERE user_id = v_user_id
      AND tenant_id = 'MNTY-PLATFORM'
      AND upper(role) = 'CUSTOMER'
      AND status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'auth_user_customer_membership_not_created';
  END IF;
END;
$test$;

ROLLBACK;
