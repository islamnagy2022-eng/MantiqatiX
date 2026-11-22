# PASS 1791–1800 — Live directory contact-consent release gate recheck — 2026-11-22

## Scope and method

Read-only verification of the production Supabase project `moyhiluyhjsujhwlyeuu`, the deployed `directory-listings` Edge Function, current GitHub source on the PR #969 head, and the live Security Advisor. No listing-level contact values were selected. No public directory request was replayed. No Production mutation or deployment occurred.

## Verified live state

- `directory-listings` is ACTIVE at version 16 with `verify_jwt=false`; the handler authenticates POST actions itself and intentionally serves public GET requests.
- The deployed bundle contains only `index.ts`, `pagination-filter.mjs`, and `doctor-import-contract.mjs`.
- The deployed GET projection selects `phone`, `secondary_phone`, and `address` as public fields and the deployed response path returns these fields without the current consent-aware sanitizer.
- Current GitHub source adds `public-directory-output-contract.mjs`, `consent-pagination.mjs`, `contact-consent-pagination.mjs`, and `platform-admin-registry.mjs`; the entrypoint imports and uses those modules for sanitized public output, consent pagination, and owner/platform authorization.
- Read-only catalog check: `public.directory_listing_contact_consents` does not exist (`to_regclass` returned NULL); migration ledger version `20261118020000` (RC473) has zero rows.
- Aggregate-only listing check: 869 published listings; 869 have a primary phone; 178 have a secondary phone; 869 have an address. No contact values or owner identities were selected.
- Current-source sanitizer removes phone, secondary phone, address and precise-map URL unless each matching active consent scope is present. Consent lookup discards partial results and fails closed. Owner editing/consent controls also fail closed if the consent registry is unavailable.
- The RC473 source migration creates the consent registry with FORCE RLS and revokes all browser-role access; service_role is the only granted data role.

## Security Advisor snapshot

Observed at 2026-11-22 01:14:46Z:
- 9 RLS-enabled tables without policies (the Advisor finding alone does not establish client exposure; effective grants still require review).
- 65 authenticated-callable SECURITY DEFINER functions and 1 anon-callable SECURITY DEFINER function.
- Leaked-password protection is disabled.
- The anonymous SECURITY DEFINER finding identifies `get_mnty_targeted_advertisements`; keep its intentionally public, read-only, bounded, approved/date-valid ad contract under review rather than applying a blanket revoke.

## Release decision

**P0 — PRODUCTION BLOCKED / NOT CERTIFIED.**

Do not deploy only the Edge bundle or only RC473. The complete sequence requires:
1. Operator-controlled encrypted off-site database and Storage backup, key/Vault recovery evidence, and independent PostgreSQL 17 restore/rollback rehearsal.
2. Exact chronological migration rehearsal and coordinated application of the RC473 schema plus all prerequisite registry/authorization migrations.
3. Deploy the complete seven-file Edge bundle with exact version/hash verification.
4. Anonymous negative tests proving no phone, secondary phone, address, or precise map URL is returned without the matching consent.
5. Positive tests for each consent scope, owner grant/revoke, branch/business owner boundaries, registry outage, pagination beyond server row caps, and all public GET modes.
6. Post-deployment public-origin checks and rollback readiness.

Deploying the current consent-aware source before RC473 would fail closed and hide contact fields, but the owner consent workflow would remain unavailable until the migration is applied. This is a controlled outage of contact display, not a complete release.

## Marketplace / Li2Lak status

PR #969 remains OPEN and UNMERGED. The latest exact-head CI runs were still QUEUED/PENDING at the last check; no green result is claimed. Marketplace ad resilience tests remain source-only until exact-head CI finishes.

## Safety

Read-only Supabase SQL, live Edge source retrieval, GitHub source inspection and Security Advisor retrieval only. No Production DDL/DML, Auth, RLS, GRANT, Storage policy, Edge deployment, payment, wallet, customer-data mutation, or public deployment.
