# PASS 1285–1294 — Directory consent live-boundary recheck — 2026-11-20

## Current Production evidence (read-only)

Project `moyhiluyhjsujhwlyeuu`, PostgreSQL 17.6.1.155, status ACTIVE_HEALTHY.

- Live `directory-listings` Edge Function is ACTIVE v16 with `verify_jwt=false`.
- Retrieved live bundle has exactly three files: `index.ts`, `pagination-filter.mjs`, `doctor-import-contract.mjs`. It does not include `public-directory-output-contract.mjs` or `consent-pagination.mjs`.
- Live entrypoint does not reference `directory_listing_contact_consents`, `sanitizePublicDirectoryListing`, or fail-closed consent state. It returns public directory rows using the legacy output path. This is the deployed consent-boundary gap.
- Read-only SQL: `public.directory_listings` consent registry table absent; `public.public_directory_listings` exists; anon and authenticated do not have direct SELECT on that public view. 869 published listings exist and all 869 have phone or address fields populated. This narrows the public exposure path to the public Edge Function rather than direct PostgREST SELECT on the view.
- RC473 migration ledger entry `20261118020000` is absent (0 rows). The migration source is present on main as `supabase/migrations/20261118020000_rc473_directory_listing_contact_consent.sql`.
- Current main source already includes the fail-closed implementation, explicit per-field consent projection, owner-only consent grant/revoke action, durable consent history, full address-consent pagination, source validator, isolated PostgreSQL fixture, and release gate requiring exact complete Edge bundle parity plus zero published contact exposure without consent.
- The source migration RC473 has forced RLS and revokes browser-role access to the consent registry; isolated fixture/integration tests cover grant uniqueness, revocation history, service_role access, and browser-role denial.

## Assessment

The source-side fix is present; the live deployment is not. The production mismatch is not resolved by merely applying RC473: the compatible complete Edge Function bundle must be deployed with the migration in the approved coordinated release, then anonymous GET and owner grant/revoke tests must be repeated against the live origin. Do not deploy the Edge Function or migration independently.

## Safety

- Read-only inspection only. No production migration, SQL write, grant, RLS, Auth, Storage, Edge deployment, customer data or contact-field values were changed or selected.
- No individual phone numbers, addresses, owner IDs or row values were queried.
- Production remains BLOCKED / NOT CERTIFIED pending encrypted off-site DB + Storage backup, Vault recovery, isolated PostgreSQL 17 restore, measured RPO/RTO/rollback, ordered migration reconciliation and coordinated release.

## Next

1. Preserve this exact live evidence in the release manifest and keep issue #876 open.
2. Continue source/CI-only authorization tests for the directory consent grant/revoke endpoint and public projection.
3. Keep RC472/RC473 and the complete `directory-listings` bundle behind the full release gate.
