-- RC481: restore only the direct table privileges required by the deployed
-- Legal Center / Legal CMS Edge Functions, which authenticate callers before
-- using the service-role client.
--
-- This deliberately avoids table-level grants, UPDATE, DELETE, and ALL.
-- Legal consent recording and legal administration state transitions continue
-- to use their existing SECURITY DEFINER RPCs.
BEGIN;

-- legal-center read projections
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
  content
) ON TABLE public.legal_document_versions TO service_role;

GRANT SELECT (
  action_key,
  document_type,
  target_audience,
  required,
  enabled,
  business_scoped
) ON TABLE public.legal_requirements TO service_role;

-- The Edge Function returns only these consent fields for the authenticated
-- caller's own rows. user_id is granted for the equality filter but is not
-- added to the selected response projection. IP/device/session metadata stays
-- unavailable to direct service-role table reads.
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

-- legal-cms create_document direct INSERT + RETURNING id,status
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

-- legal-cms create_version direct INSERT + RETURNING its public response fields
GRANT INSERT (
  document_id,
  version_number,
  content,
  content_hash,
  status,
  created_by
) ON TABLE public.legal_document_versions TO service_role;

-- legal-cms audit helper direct INSERT. No SELECT/UPDATE/DELETE is granted
-- on the audit log; existing authenticated own/admin-read RLS stays intact.
GRANT INSERT (
  actor_user_id,
  event_type,
  document_id,
  document_version_id,
  event_at,
  metadata
) ON TABLE public.consent_audit_log TO service_role;

COMMIT;
