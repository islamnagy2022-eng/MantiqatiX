# Pass 1771–1780 — Live directory Edge consent drift recheck

Date: 2026-11-22  
Supabase project: `moyhiluyhjsujhwlyeuu`  
Method: read-only Edge function metadata/source retrieval, GitHub source comparison, and aggregate-only SQL. No personal contact values were selected.

## Live deployed Edge function

- `directory-listings` is ACTIVE, version **16**, `verify_jwt=false`.
- Deployed source SHA-256: `13f83fcf2faec148af34c08a006ab7bd8f9aa5946bc8af971ebf3e58a9120de0`.
- Deployed bundle contains only `index.ts`, `pagination-filter.mjs`, and `doctor-import-contract.mjs`.
- Deployed `index.ts` is 46,907 characters and does **not** include the current source consent/output-contract modules. It still selects and returns `phone`, `secondary_phone`, and `address` for public listing GETs, including legacy unpaginated reads. Its platform-admin helper still checks mutable `SUPER_ADMIN` membership flags and permissions.
- The deployed `pagination-filter.mjs` differs from current source. `doctor-import-contract.mjs` matches byte-for-byte.

## Current repository source parity

Current `main` contains seven files for this function:
- `index.ts` (50,906 chars; SHA `0d378cc88770ab23ab029a628bd891848a2348f4`)
- `pagination-filter.mjs` (9,820 chars; SHA `f5537252909bbf493c6ffd85ef1ecb4c5ee84f4b`)
- `doctor-import-contract.mjs` (4,366 chars; exact deployed match)
- `public-directory-output-contract.mjs` (4,219 chars; absent from deployed bundle)
- `consent-pagination.mjs` (1,132 chars; absent from deployed bundle)
- `contact-consent-pagination.mjs` (1,556 chars; absent from deployed bundle)
- `platform-admin-registry.mjs` (133 chars; absent from deployed bundle)

Current source imports consent pagination, contact-consent scope resolution, public output sanitization and private platform-admin registry resolution. This source is materially newer and cannot be considered deployed.

## Live aggregate privacy check

Read-only SQL returned:
- Contact-consent registry table `public.directory_contact_consents`: **absent**.
- Alternate `public.directory_listing_contact_consents`: **absent**.
- Published directory records: **869**.
- Published records with non-empty phone: **869**.
- Published records with non-empty address: **869**.
- Published records with at least one of those contact fields: **869**.

No phone/address values were read. The current deployed unauthenticated GET contract therefore remains a P0 privacy release blocker.

## Required coordinated remediation

1. Complete genuine encrypted off-site database + Storage backup, key/Vault recovery and independent PostgreSQL 17 restore/rollback; capture RPO/RTO.
2. Apply the complete ordered migration chain containing the consent registry and platform-admin dependencies only after release approval; do not hand-create the table or mutate rows ad hoc.
3. Deploy the exact current `directory-listings` bundle with all seven source files as one coordinated release; verify the deployed hash and version.
4. Test anonymous GET for no phone/address by default; explicit consent grant/revoke for each contact scope; owner GET/UPDATE boundaries; no stale cache; registry/table outage fails closed; cross-tenant claims; and no legacy/unpaginated bypass.
5. Verify current platform-admin registry checks in the deployed bundle, not the legacy membership metadata branch.
6. Re-run aggregate-only live checks and Security Advisor after release.

## Disposition

**P0 — LIVE PRIVACY BLOCKER CONFIRMED.** Current source repair exists but is not deployed and the consent table is absent. Do not deploy Edge or apply migrations before the backup/restore and coordinated release gates. No Production DDL/DML, Edge deployment, Auth/RLS/GRANT, Storage, payment, wallet or user-data mutation occurred.
