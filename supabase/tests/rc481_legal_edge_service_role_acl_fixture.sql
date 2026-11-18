-- RC481 disposable PostgreSQL fixture.
-- Models the current Production grants: authenticated users can use the
-- existing owner/admin access surface; anon can read only the pre-existing
-- published documents/versions; service_role has no direct legal table DML
-- before RC481. The migration adds only its explicit column-level surface.

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

CREATE POLICY legal_documents_public_read
  ON public.legal_documents FOR SELECT TO anon, authenticated
  USING (status = 'PUBLISHED');
CREATE POLICY legal_versions_public_read
  ON public.legal_document_versions FOR SELECT TO anon, authenticated
  USING (status = 'PUBLISHED');

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Existing pre-RC481 role boundary.
GRANT SELECT ON public.legal_documents, public.legal_document_versions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.legal_documents, public.legal_document_versions, public.legal_requirements TO authenticated;
GRANT SELECT ON public.user_consents, public.consent_audit_log TO authenticated;
GRANT REFERENCES, TRIGGER ON public.legal_documents, public.legal_document_versions,
  public.legal_requirements, public.user_consents, public.consent_audit_log TO service_role;

INSERT INTO public.legal_documents (
  id,tenant_id,document_type,title,status,published_at,effective_at,
  created_by,updated_by,target_audience,required_consent,requires_reconsent,
  sector_codes,locale,metadata
) VALUES (
  '10000000-0000-4000-8000-000000000001','tenant-private','TERMS','Published terms',
  'PUBLISHED',now(),now(),
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  ARRAY['ALL']::text[],true,false,ARRAY['GENERAL']::text[],'ar-EG',
  '{"internal_note":"not-for-edge-response"}'::jsonb
);

INSERT INTO public.legal_document_versions (
  id,document_id,version_number,content,content_hash,status,published_at,effective_at,
  retired_at,created_by,metadata
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',1,
  'Published legal terms','0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'PUBLISHED',now(),now(),null,
  '20000000-0000-4000-8000-000000000001',
  '{"internal_note":"not-for-edge-response"}'::jsonb
);

INSERT INTO public.legal_requirements (
  action_key,document_type,target_audience,required,enabled,business_scoped
) VALUES ('CHECKOUT','TERMS','ALL',true,true,false);

INSERT INTO public.user_consents (
  user_id,account_type,document_id,document_version_id,agreement_id,consent_status,
  ip_address,user_agent,device_info,session_id,content_hash,source,metadata
) VALUES (
  '40000000-0000-4000-8000-000000000001','CUSTOMER',
  '10000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',null,'ACCEPTED',
  '192.0.2.10','test-user-agent','{"device_secret":"never-return"}'::jsonb,
  'private-session','0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'APP','{"private_note":"never-return"}'::jsonb
);

INSERT INTO public.consent_audit_log (
  user_id,account_type,document_id,document_version_id,event_type,
  consent_status,ip_address,user_agent,device_info,session_id,actor_user_id,
  integrity_hash,metadata
) VALUES (
  '40000000-0000-4000-8000-000000000001','CUSTOMER',
  '10000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001','CONSENT_RECORDED',
  'ACCEPTED','192.0.2.10','test-user-agent','{"device_secret":"never-return"}'::jsonb,
  'private-session','40000000-0000-4000-8000-000000000001',
  'integrity-secret','{"private_note":"never-return"}'::jsonb
);
