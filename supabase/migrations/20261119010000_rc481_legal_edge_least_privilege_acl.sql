-- RC481: align the Legal Center/CMS service-role table access with the
-- exact projections and inserts used by the deployed Edge Functions.
-- Column grants intentionally avoid table-level SELECT/INSERT, UPDATE, DELETE,
-- and any changes to anon/authenticated grants or RLS policies.
BEGIN;

GRANT SELECT (
  id,
  document_type,
  title,
  status,
  published_at,
  effective_at,
  target_audience,
  required_consent,
  requires_reconsent,
  sector_codes,
  locale
) ON TABLE public.legal_documents TO service_role;

GRANT SELECT (
  id,
  document_id,
  version_number,
  published_at,
  effective_at,
  content_hash,
  content,
  status
) ON TABLE public.legal_document_versions TO service_role;

GRANT SELECT (
  action_key,
  document_type,
  target_audience,
  required,
  enabled,
  business_scoped
) ON TABLE public.legal_requirements TO service_role;

GRANT SELECT (
  id,
  user_id,
  document_id,
  document_version_id,
  agreement_id,
  account_type,
  consent_status,
  consented_at,
  content_hash,
  source
) ON TABLE public.user_consents TO service_role;

GRANT INSERT (
  document_type,
  title,
  target_audience,
  required_consent,
  requires_reconsent,
  sector_codes,
  locale,
  status,
  created_by,
  updated_by
) ON TABLE public.legal_documents TO service_role;

GRANT SELECT (id, status)
  ON TABLE public.legal_documents TO service_role;

GRANT INSERT (
  document_id,
  version_number,
  content,
  content_hash,
  status,
  created_by
) ON TABLE public.legal_document_versions TO service_role;

GRANT SELECT (
  id,
  document_id,
  version_number,
  status,
  content_hash
) ON TABLE public.legal_document_versions TO service_role;

GRANT INSERT (
  actor_user_id,
  event_type,
  document_id,
  document_version_id,
  event_at,
  metadata
) ON TABLE public.consent_audit_log TO service_role;

COMMIT;
