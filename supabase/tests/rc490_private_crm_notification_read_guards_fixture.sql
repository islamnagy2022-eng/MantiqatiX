-- Disposable RC490 private-read fixture. Synthetic data only.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb LANGUAGE sql STABLE AS $function$
  SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$function$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon,authenticated,service_role;

DO $fixture$
DECLARE v_table text;
DECLARE v_tables text[] := ARRAY['marketing_leads','marketing_projects','notifications'];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('CREATE TABLE public.%I (id integer PRIMARY KEY, owner_id uuid NOT NULL, payload text NOT NULL)',v_table);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',v_table);
    EXECUTE format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR SELECT TO authenticated USING (owner_id=auth.uid())',
      v_table||'_existing_owner_read',v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',v_table);
    EXECUTE format('INSERT INTO public.%I(id,owner_id,payload) VALUES (1,%L,%L)',
      v_table,'49000000-0000-4000-8000-000000000001','synthetic private fixture');
  END LOOP;
END;
$fixture$;
