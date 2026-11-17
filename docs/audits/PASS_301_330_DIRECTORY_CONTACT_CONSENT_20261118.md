# Pass 301–330 — Public directory contact disclosure controls

Date: 2026-11-18
Base: `main` at `ae090081015b0c3af410fb6ee114165f300b1bba`
Branch: `fix/directory-contact-consent-20261118`
Status: SOURCE CANDIDATE; focused CI passed on intermediate head `3bb3820045ff8bde9fd72d97e044cf7256765051`; final-head checks pending. No Production migration or Edge deployment.

## Read-only Production aggregate evidence

Project: `MANTIQATIX FINAL` (`moyhiluyhjsujhwlyeuu`).

- Published directory rows: 869.
- Rows with primary phone: 869; secondary phone: 178; exact address: 869.
- Rows carrying any existing `public_contact_enabled`, `contact_consent`, or `public_contact_consent_audit_verified` metadata flag: 0.
- Claim state: 868 UNCLAIMED; 0 CLAIMED; one row has a non-UNCLAIMED/non-CLAIMED state.
- The current source projection previously returned phone, secondary phone and address for all PUBLISHED rows. It also returned `metadata.google_maps_url` when present without a directory-listing-specific consent record.
- This is aggregate-only evidence; no phone, address, owner identity or row-level personal data was selected.
- A separate source-rights aggregate found 26 distinct source hosts. The largest group is `dalil140.com` (746 listings), followed by Google Maps URLs (49), FindHealthClinics (11), DalilMadina (7), the Medical Professions Union project-treatment guide (6), Yellow Pages (6), South Sinai government (5), and other mixed hosts.
- The Production `directory_source_permission_evidence` registry contains zero rows. None of the 869 published listings carries a `sourcePermissionEvidenceId` or `source_permission_evidence_id` metadata reference. No exact source-name/host pair had active, non-revoked, current doctor-profile + commercial republication permission.
- The earlier `497` figure refers only to the single source label `Dalil140 — دليل عام غير رسمي`; it is not the total for the `dalil140.com` host. The aggregate host count is 746 across multiple source labels.

## Changes on this branch

- Added forward migration `20261118020000_rc473_directory_listing_contact_consent.sql`.
- Added private `directory_listing_contact_consents` registry with four separate scopes: `PHONE`, `SECONDARY_PHONE`, `ADDRESS`, `PRECISE_LOCATION`.
- Each grant records authenticated user, consent-text version and timestamp. Revocation records actor, timestamp and reason; prior records remain in the audit history. Active duplicate grants are prevented.
- Registry has ENABLE + FORCE RLS, no PUBLIC/anon/authenticated table privileges, and service-role-only SELECT/INSERT/UPDATE. Deletion of a listing is restricted while consent audit rows exist.
- Changed public projection to fail closed: phone, secondary phone, address and exact Google Maps URL are omitted unless the matching active consent scope exists. Coarse governorate/district/village and ordinary public profile fields remain available.
- Consent lookup failures fail closed. Both legacy and keyset-paginated directory responses use the same projection.
- Public free-text search no longer probes phone, secondary phone or address. Explicit address search is restricted to listing IDs with active ADDRESS consent.
- Added authenticated `SET_PUBLIC_CONTACT_CONSENT` action. Only the verified claimant or active BUSINESS_OWNER/OWNER of a CLAIMED listing may grant/revoke. Revocation remains available if the listing is temporarily hidden.
- Added four independent owner UI controls and an authenticated client helper; no existing page layout redesign.
- Added PostgreSQL fixture/integration tests, a source projection/search validator, Deno type-check and frontend build workflow.

## Verification

- Production read-only aggregate inspection: PASS.
- Focused PostgreSQL + source-contract + Deno + frontend build workflow: PASS on intermediate head `3bb3820045ff8bde9fd72d97e044cf7256765051`.
- Final branch head `a9946412e0d004dd990a9fa54e35a2fcfa1493f3`: focused workflow and cross-module workflows are currently rerunning; do not close until final-head success.
- No Production migration, data mutation, Auth/RLS/GRANT change outside the new source migration, Edge deployment, Pages deployment or payment action occurred on this branch.

## Independent remaining blockers

- The source-rights audit remains unresolved. The existing national directory includes 497 rows labelled Dalil140 and mixed third-party/official sources. A URL or public visibility is not permission for commercial republication. No further bulk ingestion from restricted sources is authorized without a dataset-specific licence or written permission.
- Existing published rows have no owner contact consent. After RC473 is separately released, their contact fields will remain hidden until an authorized owner claims the listing and grants each scope.
- RC472 claim-approval migration and `directory-listings` Edge Function are merged in GitHub but have not been applied/deployed to Production. RC473 depends on the claim flow to make owner consent available.
- Before Production release: exact-head CI, final SQL/Edge review, chronological migration replay from current Production checkpoint, backup/rollback plan, then separately authorized migration followed by Edge deployment and deployed-origin privacy/owner-consent smoke tests.
