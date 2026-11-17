# PASS 91–110 — Audited Public Contact Privacy

Date: 2026-11-17
Repository: islamnagy2022-eng/MantiqatiX
Candidate PR: #756 (source-only; not merged at report time)

## Objective
Prevent disclosure of owner phone, WhatsApp, address, additional contact numbers and precise map pins unless the owner explicitly opts in and the server records that consent durably.

## Implemented source changes
- Added supabase/functions/_shared/public-contact-visibility.mjs with deny-by-default projection and HTTPS allow-lists for WhatsApp and Google Maps URLs.
- Added seven tests in public-contact-visibility.test.mjs covering implicit denial, affirmative audited consent, pending audit, revocation, invalid phone/URL, field bounds and precise map links.
- Applied the helper in public-catalog and public-catalog-directory.
- Removed phone and address from public branch objects; public branch objects expose only ID/name/code.
- Gated top-level contactPhone and google_maps_url through the same projection.
- Added an explicit merchant dashboard consent control and frontend state/payload handling.
- catalog-admin validates the boolean, first stores the consent as unverified, writes a GRANTED/REVOKED audit row, and only activates public visibility after audit persistence and a compare-and-set update. Audit failures and conflicts fail closed.
- Updated the frontend business mapper and type contract so public projection mapping never falls back to branch phone/address.
- Updated the legacy social-link regression contract to expect the new privacy projection rather than raw contact data.
- Added a dedicated privacy workflow and a 23-assertion source validator.

## Test evidence
- Node unit suite: 7/7 passed.
- Static privacy source contract: 23/23 passed.
- Initial Deno type-check found duplicate response keys and typing errors. Those were corrected: submittedSocialFields is typed for booleans, profile response keys are unique, the sanitized activity-module map is normalized, and the .mjs helper exposes JSDoc record/argument contracts.
- Exact-head CI rerun at 178588019ac831e1cd7e06c8535fec241b88ac3c remained in progress when this report was written. Do not claim release success until required checks are all green.

## Production safety boundary
No Supabase Production Edge Function was deployed. No production database migration, RLS policy, GRANT/REVOKE, payment, wallet, settlement, Auth, or production data mutation was performed. PR #756 must pass exact-head CI and review before merge and a separate controlled Edge deployment.
