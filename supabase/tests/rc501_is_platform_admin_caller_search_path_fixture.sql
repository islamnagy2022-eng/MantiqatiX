-- Disposable RC501 PostgreSQL 17 fixture. No Production rows or grants are used.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END;
$roles$;

CREATE SCHEMA auth;
CREATE SCHEMA private;

CREATE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $function$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$function$;

GRANT USAGE ON SCHEMA public,auth,private TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;

CREATE TABLE private.platform_admins(user_id uuid PRIMARY KEY);
ALTER TABLE private.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.platform_admins FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.platform_admins FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE private.platform_admins TO service_role;
INSERT INTO private.platform_admins(user_id)
VALUES ('10000000-0000-4000-8000-000000000001');

CREATE TABLE public.user_memberships(
  user_id uuid NOT NULL,
  tenant_id text NOT NULL,
  role text NOT NULL,
  status text NOT NULL
);
INSERT INTO public.user_memberships(user_id,tenant_id,role,status)
VALUES ('20000000-0000-4000-8000-000000000002','TENANT-A','ADMIN','ACTIVE');

CREATE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM private.platform_admins pa
    WHERE pa.user_id=(SELECT auth.uid())
  );
$function$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- These fixture functions deliberately use only the schema-qualified registry
-- helper. RC501 must preserve their bodies, owners and ACLs while pinning paths.
CREATE FUNCTION public.create_notification_backend(
  p_id character varying,p_tenant_id character varying,p_user_id uuid,p_type character varying,
  p_title character varying,p_body text,p_entity_type character varying,p_entity_id character varying
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN RETURN public.is_platform_admin(); END; $function$;

CREATE FUNCTION public.deactivate_business(p_business_id uuid,p_reason text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN RETURN public.is_platform_admin(); END; $function$;

CREATE FUNCTION public.fashion_erp_mutate(p_action text,p_payload jsonb,p_idempotency_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN RETURN public.is_platform_admin(); END; $function$;

CREATE FUNCTION public.resolve_legacy_scope(p_branch_id text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN RETURN public.is_platform_admin(); END; $function$;

CREATE FUNCTION public.restaurant_erp_mutate(p_action text,p_payload jsonb,p_idempotency_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN RETURN public.is_platform_admin(); END; $function$;

CREATE FUNCTION public.restaurant_table_mutate(p_action text,p_payload jsonb,p_idempotency_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN RETURN public.is_platform_admin(); END; $function$;

CREATE FUNCTION public.set_platform_feature_flag_backend(
  p_scope_type character varying,p_scope_id character varying,p_sector_id character varying,p_tenant_id character varying,
  p_business_id uuid,p_branch_id character varying,p_module_code character varying,p_feature_code character varying,
  p_enabled boolean,p_configuration jsonb
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN RETURN public.is_platform_admin(); END; $function$;

REVOKE ALL ON FUNCTION public.create_notification_backend(character varying,character varying,uuid,character varying,character varying,text,character varying,character varying) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.deactivate_business(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.fashion_erp_mutate(text,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.resolve_legacy_scope(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.restaurant_erp_mutate(text,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.restaurant_table_mutate(text,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.set_platform_feature_flag_backend(character varying,character varying,character varying,character varying,uuid,character varying,character varying,character varying,boolean,jsonb) FROM PUBLIC,anon,authenticated,service_role;
