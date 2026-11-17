CREATE SCHEMA IF NOT EXISTS auth;
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END;
$roles$;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY
);

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY,
  tenant_id varchar NOT NULL,
  organization_id varchar,
  status varchar NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.user_memberships (
  id varchar PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id varchar NOT NULL,
  organization_id varchar,
  business_id uuid REFERENCES public.businesses(id),
  branch_id varchar,
  role varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'ACTIVE',
  permissions jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE public.public_directory_listings (
  id uuid PRIMARY KEY,
  claim_status text NOT NULL,
  claimed_user_id uuid REFERENCES auth.users(id),
  claimed_business_id uuid REFERENCES public.businesses(id),
  claimed_at timestamptz,
  last_verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  outreach_status text NOT NULL DEFAULT 'NEW',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.directory_listing_claim_requests (
  id uuid PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES public.public_directory_listings(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL,
  review_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  linked_business_id uuid REFERENCES public.businesses(id),
  linked_membership_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.test_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_claim_updated_at BEFORE UPDATE ON public.directory_listing_claim_requests
FOR EACH ROW EXECUTE FUNCTION public.test_touch_updated_at();
CREATE TRIGGER test_listing_updated_at BEFORE UPDATE ON public.public_directory_listings
FOR EACH ROW EXECUTE FUNCTION public.test_touch_updated_at();

CREATE OR REPLACE FUNCTION public.test_fail_directory_listing_write()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('test.fail_directory_listing_write', true) = 'on' THEN
    RAISE EXCEPTION 'forced_directory_listing_write_failure';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_fail_directory_listing_write
BEFORE UPDATE ON public.public_directory_listings
FOR EACH ROW EXECUTE FUNCTION public.test_fail_directory_listing_write();

CREATE OR REPLACE FUNCTION public.test_fail_claim_approval_write()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'APPROVED'
     AND current_setting('test.fail_claim_approval_write', true) = 'on' THEN
    RAISE EXCEPTION 'forced_claim_approval_write_failure';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_fail_claim_approval_write
BEFORE UPDATE ON public.directory_listing_claim_requests
FOR EACH ROW EXECUTE FUNCTION public.test_fail_claim_approval_write();

CREATE OR REPLACE FUNCTION public.test_pause_directory_claim()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.claim_status = 'CLAIMED'
     AND current_setting('test.pause_directory_claim', true) = 'on' THEN
    PERFORM pg_sleep(2);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_pause_directory_claim
BEFORE UPDATE ON public.public_directory_listings
FOR EACH ROW EXECUTE FUNCTION public.test_pause_directory_claim();
