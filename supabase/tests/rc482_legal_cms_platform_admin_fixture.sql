-- Disposable RC482 authorization fixture; no production data.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA private;
CREATE TABLE private.platform_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_memberships (
  user_id uuid NOT NULL,
  role varchar NOT NULL,
  status varchar NOT NULL
);
GRANT USAGE ON SCHEMA public, private TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.platform_admins TO service_role;
INSERT INTO private.platform_admins(user_id)
VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO public.user_memberships(user_id,role,status)
VALUES
 ('11111111-1111-4111-8111-111111111111','SUPER_ADMIN','ACTIVE'),
 ('22222222-2222-4222-8222-222222222222','ADMIN','ACTIVE'),
 ('33333333-3333-4333-8333-333333333333','LEGAL_ADMIN','ACTIVE');
