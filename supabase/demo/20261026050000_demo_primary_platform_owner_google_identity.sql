CREATE OR REPLACE FUNCTION public.demo_register_customer_atomic(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_email text;
  v_email_confirmed boolean;
  v_google_identity boolean;
  v_is_primary_platform_owner boolean := false;
  v_customer_membership_id varchar;
  v_platform_membership_id varchar;
  v_created_customer boolean := false;
BEGIN
  SELECT
    pg_catalog.lower(coalesce(u.email, '')),
    u.email_confirmed_at IS NOT NULL,
    (
      coalesce(u.raw_app_meta_data->>'provider', '') = 'google'
      OR coalesce(u.raw_app_meta_data->'providers', '[]'::jsonb) @> '["google"]'::jsonb
    )
  INTO v_email, v_email_confirmed, v_google_identity
  FROM auth.users u
  WHERE u.id = p_user_id;

  IF p_user_id IS NULL OR v_email IS NULL THEN
    RAISE EXCEPTION 'DEMO_AUTH_USER_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = 'MNTY-PLATFORM' AND t.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'DEMO_TENANT_NOT_READY';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 90126)
  );

  SELECT m.id INTO v_customer_membership_id
  FROM public.user_memberships m
  WHERE m.user_id = p_user_id
    AND m.tenant_id = 'MNTY-PLATFORM'
    AND m.business_id IS NULL
    AND m.branch_id IS NULL
    AND pg_catalog.upper(m.role) = 'CUSTOMER'
    AND m.status = 'ACTIVE'
  LIMIT 1;

  IF v_customer_membership_id IS NULL THEN
    v_customer_membership_id := pg_catalog.gen_random_uuid()::text;
    INSERT INTO public.user_memberships
      (id, user_id, tenant_id, organization_id, business_id, branch_id, role, permissions, status)
    VALUES
      (v_customer_membership_id, p_user_id, 'MNTY-PLATFORM', 'MNTY-MAIN',
       NULL, NULL, 'CUSTOMER', '{"scope":"TENANT","demo":true}'::jsonb, 'ACTIVE');
    v_created_customer := true;
  END IF;

  -- Only the explicitly configured, Google-authenticated, confirmed primary account
  -- becomes platform owner in this isolated DEMO project. Email text alone is not
  -- sufficient; the identity must exist in this project's own auth.users.
  v_is_primary_platform_owner :=
    v_email = 'islam.nagy2022@gmail.com'
    AND v_email_confirmed
    AND v_google_identity;

  IF v_is_primary_platform_owner THEN
    INSERT INTO private.platform_admins(user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT m.id INTO v_platform_membership_id
    FROM public.user_memberships m
    WHERE m.user_id = p_user_id
      AND m.tenant_id = 'MNTY-PLATFORM'
      AND m.business_id IS NULL
      AND m.branch_id IS NULL
      AND pg_catalog.upper(m.role) = 'SUPER_ADMIN'
      AND m.status = 'ACTIVE'
      AND m.permissions->>'scope' = 'PLATFORM'
      AND m.permissions->>'full_control' = 'true'
    LIMIT 1;

    IF v_platform_membership_id IS NULL THEN
      v_platform_membership_id := pg_catalog.gen_random_uuid()::text;
      INSERT INTO public.user_memberships
        (id, user_id, tenant_id, organization_id, business_id, branch_id, role, permissions, status)
      VALUES
        (v_platform_membership_id, p_user_id, 'MNTY-PLATFORM', 'MNTY-MAIN',
         NULL, NULL, 'SUPER_ADMIN',
         '{"scope":"PLATFORM","full_control":true,"demo":true}'::jsonb, 'ACTIVE');
    END IF;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'created', v_created_customer,
    'membership_id', v_customer_membership_id,
    'role', 'CUSTOMER',
    'tenant_id', 'MNTY-PLATFORM',
    'is_platform_owner', v_is_primary_platform_owner
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.demo_register_customer_atomic(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_register_customer_atomic(uuid) TO service_role;
