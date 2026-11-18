-- Disposable PostgreSQL 17 regression fixture for issue #811.
-- This is NOT a Production migration. It reproduces the observed owner-specific
-- defaults, proves the effect of a narrow postgres-owner repair, and proves that
-- the supabase_admin defaults and existing table ACLs are not silently changed.

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE ROLE supabase_admin NOLOGIN;

GRANT USAGE, CREATE ON SCHEMA public TO supabase_admin;

-- Reproduce the observed postgres-owned public-table defaults.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES
  TO anon, authenticated, service_role;

-- Reproduce the separately observed supabase_admin default ACL.
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON TABLES
  TO anon, authenticated, postgres, service_role;

-- Baseline table created by the ordinary migration owner.
CREATE TABLE public.postgres_before_repair (id integer PRIMARY KEY);

-- Baseline table created by the distinct Supabase-managed owner.
SET ROLE supabase_admin;
CREATE TABLE public.supabase_admin_before_repair (id integer PRIMARY KEY);
RESET ROLE;

DO $assert_baseline$
DECLARE
  api_role text;
  privilege_name text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    FOREACH privilege_name IN ARRAY ARRAY['MAINTAIN', 'REFERENCES', 'TRIGGER', 'TRUNCATE'] LOOP
      IF NOT has_table_privilege(api_role, 'public.postgres_before_repair', privilege_name) THEN
        RAISE EXCEPTION 'Expected baseline privilege % for % on postgres-owned table', privilege_name, api_role;
      END IF;
    END LOOP;

    FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
      IF has_table_privilege(api_role, 'public.postgres_before_repair', privilege_name) THEN
        RAISE EXCEPTION 'Unexpected baseline DML privilege % for % on postgres-owned table', privilege_name, api_role;
      END IF;
      IF NOT has_table_privilege(api_role, 'public.supabase_admin_before_repair', privilege_name) THEN
        RAISE EXCEPTION 'Expected supabase_admin default DML privilege % for %', privilege_name, api_role;
      END IF;
    END LOOP;

    FOREACH privilege_name IN ARRAY ARRAY['MAINTAIN', 'REFERENCES', 'TRIGGER', 'TRUNCATE'] LOOP
      IF NOT has_table_privilege(api_role, 'public.supabase_admin_before_repair', privilege_name) THEN
        RAISE EXCEPTION 'Expected supabase_admin default privilege % for %', privilege_name, api_role;
      END IF;
    END LOOP;
  END LOOP;
END;
$assert_baseline$;

-- Candidate-only narrow repair: revoke only the four non-DML defaults from
-- the verified postgres owner. Do not touch supabase_admin defaults or existing
-- relation ACLs. Production provenance/compatibility review is still required.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES
  FROM anon, authenticated, service_role;

CREATE TABLE public.postgres_after_repair (id integer PRIMARY KEY);

SET ROLE supabase_admin;
CREATE TABLE public.supabase_admin_after_repair (id integer PRIMARY KEY);
RESET ROLE;

DO $assert_repair$
DECLARE
  api_role text;
  privilege_name text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    FOREACH privilege_name IN ARRAY ARRAY['MAINTAIN', 'REFERENCES', 'TRIGGER', 'TRUNCATE', 'SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
      IF has_table_privilege(api_role, 'public.postgres_after_repair', privilege_name) THEN
        RAISE EXCEPTION 'Narrow repair failed: % retains % on new postgres-owned table', api_role, privilege_name;
      END IF;
    END LOOP;

    -- Default-privilege changes must not rewrite ACLs on existing tables.
    IF NOT has_table_privilege(api_role, 'public.postgres_before_repair', 'MAINTAIN')
       OR NOT has_table_privilege(api_role, 'public.postgres_before_repair', 'TRUNCATE') THEN
      RAISE EXCEPTION 'Existing postgres-owned table ACL unexpectedly changed for %', api_role;
    END IF;

    -- The distinct owner contract must remain unchanged.
    FOREACH privilege_name IN ARRAY ARRAY['MAINTAIN', 'REFERENCES', 'TRIGGER', 'TRUNCATE', 'SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
      IF NOT has_table_privilege(api_role, 'public.supabase_admin_after_repair', privilege_name) THEN
        RAISE EXCEPTION 'supabase_admin default changed unexpectedly: % lacks %', api_role, privilege_name;
      END IF;
    END LOOP;
  END LOOP;
END;
$assert_repair$;

SELECT 'PASS: PostgreSQL 17 owner-specific default ACL regression' AS result;
