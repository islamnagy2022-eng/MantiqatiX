-- Forward-only fix for the RC215 auth-user trigger ordering defect.
-- A new auth.users row must have a public.users profile before its CUSTOMER membership is inserted.
-- This preserves the existing trigger and membership contract while making signup ordering safe.

CREATE OR REPLACE FUNCTION private.handle_auth_user_customer_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF COALESCE(NEW.is_anonymous, false) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE id = 'MNTY-PLATFORM'
      AND status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'active_tenant_required';
  END IF;

  INSERT INTO public.users (
    id,
    tenant_id,
    organization_id,
    name,
    email,
    role,
    roles,
    active_workspace_role,
    status,
    custom_permissions,
    current_region
  )
  VALUES (
    NEW.id,
    'MNTY-PLATFORM',
    NULL,
    COALESCE(
      NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'name'), ''),
      NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
      'MantiqatiX User'
    ),
    NEW.email,
    'CUSTOMER',
    '["CUSTOMER"]'::jsonb,
    'CUSTOMER',
    'ACTIVE',
    '[]'::jsonb,
    '{}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  PERFORM private.ensure_customer_membership_for_user(NEW.id, 'MNTY-PLATFORM');
  RETURN NEW;
END;
$function$;
