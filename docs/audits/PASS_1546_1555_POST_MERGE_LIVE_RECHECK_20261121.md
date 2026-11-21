# Pass 1546–1555 — post-merge directory privacy guard and live release recheck

Date: 2026-11-21  
Repository: `islamnagy2022-eng/MantiqaTix`  
Main after source merge: `3084283da8e83c9f216631248b3a06a0e5ca3431`

## 1. Source change and exact-head validation

PR [#952](https://github.com/islamnagy2022-eng/MantiqaTix/pull/952) merged to main as `3084283da8e83c9f216631248b3a06a0e5ca3431`.

The change closes a fail-closed consistency gap in address-consent pagination: a rejected page-fetch promise now causes all partial consent IDs to be discarded and returns `ready:false`. The regression covers a successful first page followed by a thrown second-page fetch.

Exact source-head commit: `43bf69244a9a798ffb53a3c8ccf4ac4e282cb7e5`. Eight associated workflow runs completed successfully. Directory Contact Consent source contract, Deno type-check, frontend build/type-check, isolated PostgreSQL migration/consent assertions passed. Primary Catalog Frontend Validation browser E2E, employee RBAC PostgreSQL integration, TypeScript, privacy and release-gate validations passed. Other associated workflows included Backend-only Module Boundary, Module Professionalization, MantiGO Open Ride Privacy Boundary, Doctor Incremental Import Contract, RC425 MantiGo Paymob Atomicity and web validation.

Important: the web workflow's `deploy` and `validate_public_only` jobs were SKIPPED. The workflow name containing “Deploy” is not proof of a deployed release. No Supabase Edge deployment or Production migration is claimed.

## 2. Live Production database and Edge parity

Read-only live Supabase checks at 2026-11-21:
- Project `moyhiluyhjsujhwlyeuu`: ACTIVE_HEALTHY, PostgreSQL 17.6.
- Migration ledger: 310 rows; latest `20261110150618`. RC472/RC473 remain unapplied.
- Edge `directory-listings`: ACTIVE v16, `verify_jwt=false`, deployed SHA-256 `13f83fcf2faec148af34c08a006ab7bd8f9aa5946bc8af971ebf3e58a9120de0`.
- Deployed function contains `index.ts`, `pagination-filter.mjs`, `doctor-import-contract.mjs`; it does not contain the current-main consent sanitizer/contact/address helper modules.

Therefore the privacy source fix is merged but the live public directory is still on an older Edge bundle. Do not deploy only the entrypoint or apply RC472/RC473 independently. Treat migration + complete Edge bundle + positive/negative consent tests as a coordinated release.

## 3. Scoped Security Advisor follow-up

The latest Security Advisor snapshot still includes:
- 9 RLS-enabled tables without policies.
- 1 anon-executable SECURITY DEFINER routine.
- 65 authenticated-executable SECURITY DEFINER routines.
- 90 anonymous-session policy warnings.
- Leaked-password protection disabled.

A read-only privilege query against all nine RLS-enabled/no-policy tables found no direct `anon` or `authenticated` SELECT/INSERT grants. Eight tables have FORCE RLS. `digital_page_payment_events` does not have FORCE RLS, but it also has no direct anon/authenticated SELECT/INSERT grant in the checked privileges. These are not grounds for blanket policy creation or grants.

The sole anon-executable SECURITY DEFINER RPC reviewed, `public.get_mnty_targeted_advertisements`, is a read-only SQL function with empty `search_path`, returns only active, approved, time-valid advertisements, and clamps the result limit to 1–50. This appears consistent with a deliberate public advertisement-read contract; retain pending explicit product/API contract review rather than revoking blindly.

The remaining anonymous-session policies and 65 SECURITY DEFINER routines still require itemized caller-contract review. Leaked-password protection is an Auth setting; it was not changed in this pass.

## 4. Supabase platform changes checked

Current Supabase changelog review identified:
- Nov 16, 2026: merging Supabase branches now requires Production Branches read-write access. No branch merge was performed.
- Nov 4, 2026: CLI v3 is local-first and prompts before hosted changes; CI should pin/validate CLI major-version behavior before upgrading.
- Oct 30, 2026 enforcement: new public-schema tables are no longer automatically exposed through Data/GraphQL APIs. New migrations must explicitly review Data API exposure and required grants alongside RLS.
- Nov 10, 2026 TLS change: older CBC-mode TLS 1.2 ciphers were removed from Supabase HTTP APIs. Review legacy/mobile clients for supported TLS stacks; no client failure has been observed here.

References:
- https://supabase.com/changelog?types=breaking-change
- https://supabase.com/changelog?tags=data+apis
- https://supabase.com/changelog/cbc-tls-ciphers-deprecated

## 5. Production safety and remaining gates

No Production DDL/DML, migration, RLS/GRANT, Auth, Storage, Edge deployment, payment, wallet, or customer-data mutation was performed.

Still required before Production release:
1. Operator-owned encrypted database and Storage backup with off-site retrieval evidence.
2. Vault/secrets recovery evidence.
3. Independent PostgreSQL 17 restore and rollback rehearsal with measured RPO/RTO.
4. Ordered RC472/RC473 migration replay and full Edge bundle parity.
5. Positive and negative live-origin directory consent tests after coordinated deployment.
6. Itemized review of anonymous-session policies and SECURITY DEFINER routines.
7. Explicit source-republication rights policy for imported directory records.

**Disposition: SOURCE FIX MERGED / EXACT-HEAD CI PASS; PRODUCTION BLOCKED / NOT CERTIFIED.**
