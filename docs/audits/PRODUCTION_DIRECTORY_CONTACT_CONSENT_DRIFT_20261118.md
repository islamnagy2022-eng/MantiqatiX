# Production directory contact disclosure — live Edge/source drift

Date: 2026-11-18
Project: `moyhiluyhjsujhwlyeuu`
Live Edge Function: `directory-listings`, version 16
Deployed source SHA-256: `13f83fcf2faec148af34c08a006ab7bd8f9aa5946bc8af971ebf3e58a9120de0`

## Confirmed live/source difference

The current GitHub `main` source has a contact-consent sanitizer:
- `sanitizePublicDirectoryListing` omits `phone`, `secondary_phone`, and `address` unless matching consent scopes are active.
- It queries `public.directory_listing_contact_consents` and fails closed if that registry query fails.

The deployed Production Edge Function version 16 is older:
- It selects `phone`, `secondary_phone`, and `address` through `publicFields`.
- Its GET response returns the selected public rows directly after only removing internal verification fields and sanitizing metadata. It has no `directory_listing_contact_consents` lookup or row-level contact-scope sanitizer.
- The deployed version therefore does not enforce the contact-consent behavior now present in `main`.

## Database evidence (read-only)

- `to_regclass('public.directory_listing_contact_consents')` returned NULL: the contact-consent table is absent in Production.
- `directory_source_permission_evidence` exists but currently has zero rows. This is a separate registry for source republication permissions; it is not the contact-consent table and must not be conflated with it.
- Public-directory aggregates show 965 rows total, 869 published, 964 unclaimed; 868 published/unclaimed rows have a stored phone and 868 have a stored address. No contact values were retrieved.
- This aggregate is the number of stored source values, not proof of the exact count returned by the live HTTP endpoint; the deployed function source demonstrates that the contact columns are selected and not consent-sanitized.

## Risk and disposition

**P0 — production privacy control is not at source parity.** A published/unclaimed listing may have its stored contact fields returned by the live public Edge endpoint without a consent check. The current GitHub source fixes the output contract, but neither its database registry nor the sanitizer is deployed in Production.

No Production changes were made. Do not claim the privacy fix is live.

## Required release sequence

1. Verify an off-site logical backup and a successful restore in an isolated project.
2. Review the exact consent migration, table RLS/service-role access, consent capture UX, audit trail and revocation behavior.
3. Apply the database migration and deploy the matching `directory-listings` Edge source as one coordinated release.
4. Immediately smoke-test published/unclaimed listings with no consent, explicit phone-only consent, address consent, precise-location consent, revoked consent, and consent-registry query failure. All non-consented contact scopes must be absent.
5. Confirm deployed Edge source/version and migration ledger after release; retain rollback evidence.

**Release status: BLOCKED.** Supabase Production is on Free plan; no connected evidence of an off-site backup/restore point is available. No DDL, data, Auth, RLS, GRANT, Edge deployment or public-contact mutation was performed.
