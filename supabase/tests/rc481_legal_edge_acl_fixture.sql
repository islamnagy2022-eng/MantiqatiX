-- Disposable PostgreSQL fixture for RC481. No production data is used.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE TABLE public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar,
  document_type varchar NOT NULL,
  title varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'DRAFT',
  published_at timestamptz,
  effective_at timestamptz,
  created_by uuid,
  updated_by uuid,
  target_audience text[] NOT NULL DEFAULT ARRAY['ALL']::text[],
  required_consent boolean NOT NULL DEFAULT false,
  requires_reconsent boolean NOT NULL DEFAULT false,
  sector_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  jurisdiction_country varchar,
  jurisdiction_region varchar,
  locale varchar NOT NULL DEFAULT 'ar-EG',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.legal_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  version_number integer NOT NULL,
  content text NOT NULL,
  content_hash varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'DRAFT',
  published_at timestamptz,
  effective_at timestamptz,
  retired_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.legal_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key varchar NOT NULL,
  document_type varchar NOT NULL,
  target_audience varchar NOT NULL DEFAULT 'ALL',
  required boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  business_scoped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_type varchar NOT NULL,
  document_id uuid NOT NULL,
  document_version_id uuid NOT NULL,
  agreement_id uuid,
  consent_status varchar NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  ip_address varchar,
  user_agent text,
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  session_id varchar,
  content_hash varchar NOT NULL,
  source varchar NOT NULL DEFAULT 'APP',
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.consent_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  account_type varchar,
  document_id uuid,
  document_version_id uuid,
  agreement_id uuid,
  consent_id uuid,
  event_type varchar NOT NULL,
  consent_status varchar,
  content_hash varchar,
  ip_address varchar,
  user_agent text,
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  session_id varchar,
  event_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  integrity_hash varchar,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY legal_documents_public_read ON public.legal_documents
  FOR SELECT TO anon, authenticated USING (status='PUBLISHED');
CREATE POLICY legal_versions_public_read ON public.legal_document_versions
  FOR SELECT TO anon, authenticated USING (status='PUBLISHED');

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.legal_documents, public.legal_document_versions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.legal_documents, public.legal_document_versions,
  public.legal_requirements, public.user_consents,
  public.consent_audit_log TO authenticated;
