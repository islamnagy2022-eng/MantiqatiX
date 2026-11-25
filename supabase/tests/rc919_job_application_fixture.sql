-- RC919 disposable integration fixture. Never run against production.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.jobs(id uuid PRIMARY KEY, owner_user_id uuid NOT NULL, title varchar NOT NULL, company_name varchar NOT NULL, category varchar NOT NULL, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.job_applications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE, applicant_user_id uuid NOT NULL, applicant_name varchar NOT NULL, applicant_phone varchar NOT NULL, qualifications text NOT NULL DEFAULT '', cv_summary_text text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(job_id,applicant_user_id));
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
INSERT INTO public.jobs VALUES
('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Active job','Fixture Co','Test',true),
('a0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','Inactive job','Fixture Co','Test',false);
