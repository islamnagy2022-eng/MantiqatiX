-- RC473: owner-controlled, auditable public contact disclosure for directory listings.
-- Public phone/address/map fields are hidden unless an authenticated, verified owner grants scope.

CREATE TABLE IF NOT EXISTS public.directory_listing_contact_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.public_directory_listings(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('PHONE','SECONDARY_PHONE','ADDRESS','PRECISE_LOCATION')),
  consented_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  consent_version text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT directory_listing_contact_consent_revocation_pair
    CHECK ((revoked_at IS NULL AND revoked_by IS NULL) OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL)),
  CONSTRAINT directory_listing_contact_consent_reason_length
    CHECK (revocation_reason IS NULL OR length(revocation_reason) <= 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_directory_listing_contact_consents_active
  ON public.directory_listing_contact_consents(listing_id, scope)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_directory_listing_contact_consents_listing
  ON public.directory_listing_contact_consents(listing_id, scope, revoked_at);

ALTER TABLE public.directory_listing_contact_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_listing_contact_consents FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.directory_listing_contact_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.directory_listing_contact_consents TO service_role;
