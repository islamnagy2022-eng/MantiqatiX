# Pass 191–230 — Public directory metadata and release-gate review

Date: 2026-11-17  
Branch: `security/public-contact-consent-current-main-20261117`  
PR: #756  
Scope: source-level review and regression coverage only.

## Work completed

- Rechecked the directory public-output allowlist and the separation between public display metadata and internal ingestion, verification, ownership, and moderation metadata.
- Found that `google_maps_url` already had a dedicated HTTPS/Google-host/path sanitizer, while other URL-bearing metadata keys (`logoUrl`, `logo_url`, `coverUrl`, `cover_url`, `websiteUrl`, `bookingUrl`, `profileImageUrl`) were being copied as arbitrary strings.
- Added `sanitizePublicHttpsUrl` for those URL-bearing keys. It accepts parseable HTTPS URLs and rejects non-HTTPS schemes, credentials, and explicit ports. Invalid values are omitted from the public response.
- Added behavior coverage for a valid HTTPS website and cover image, plus rejection of javascript:, data:, and HTTP URL values.
- Extended the doctor incremental-import source-contract validator to require the HTTPS URL key set and sanitizer.
- Rechecked the owner partial-update path: omitted geographic fields preserve the saved listing values; the previous fabricated Monufia/Berket El-Sabaa fallback is absent.
- Rechecked import staging and public publication separation: batch ingestion remains capped at 20, staged as DRAFT when a public state is requested, and distinct from the source-evidence gate for public doctor publication.
- Rechecked the claim approval/rejection lifecycle and retained atomic finalization as an unresolved release blocker. Do not replace the multi-write flow with unreviewed sequential writes; the safe remediation requires a transactional database operation and dedicated tests.

## Files changed

- `supabase/functions/directory-listings/public-directory-output-contract.mjs`
- `scripts/production/test-public-directory-output-contract.mjs`
- `scripts/production/validate-doctor-incremental-import.mjs`

## CI and release status

- An earlier Doctor Incremental Import Contract run on a superseded commit failed during JavaScript parsing of a malformed regular expression in the validator. The branch subsequently advanced; the validator source at the reviewed branch head contains the corrected single-escape regular expressions. Treat the old failure as stale, not as a result for the current head.
- The current branch changes require a fresh exact-head CI result. Do not claim the behavior tests passed until the new run completes successfully.
- No production deployment, Supabase schema/data mutation, RLS/GRANT/Auth change, payment change, or GitHub Pages cutover was performed.
- PR #756 remains the review/release boundary. Do not merge or deploy until all required exact-head checks pass and the claim atomicity issue is addressed or explicitly accepted through a separate release decision.

## Remaining blockers

1. Implement atomic claim approval and rejection with a single database transaction, including reliable claim-lock release.
2. Decide the explicit contact and precise-map disclosure rule for imported/unclaimed national directory listings; keep it separate from catalog merchant consent.
3. Obtain fresh exact-head CI for all affected workflows.
4. Conduct a controlled Edge Function release only after review and approval.

