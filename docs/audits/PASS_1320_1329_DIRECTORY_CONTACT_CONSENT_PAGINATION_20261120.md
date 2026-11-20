# PASS 1320–1329 — Directory contact-consent pagination

Date: 2026-11-20

## Scope

Correct the legacy `directory-listings` Edge Function contact-consent lookup so a large active consent set cannot be silently truncated by a PostgREST response cap. The directory can return up to 500 listings, and each listing may have four independently controlled contact scopes: `PHONE`, `SECONDARY_PHONE`, `ADDRESS`, and `PRECISE_LOCATION`.

## Change merged

PR #901: https://github.com/islamnagy2022-eng/MantiqatiX/pull/901

Merge commit: `a4c803a8d7e851ab9d591d70e6fdeb65c4e8ae19`

- Added `contact-consent-pagination.mjs` to deduplicate listing IDs and collect all active consent scopes page-by-page.
- Updated `directory-listings/index.ts` to query in stable `listing_id, scope` order and use explicit range pagination.
- Advances by the actual returned row count, so a server-side cap below the requested page size does not skip rows.
- If any page throws, errors, or returns malformed data, partial scopes are discarded and the caller fails closed. Contact disclosure and owner controls remain unavailable without a complete consent lookup.
- Added synthetic regression coverage for 2,205 consent rows, 600 unique listing IDs plus a duplicate, four independent scopes, 400-row server response caps, registry failure after a successful first page, malformed responses, and empty input.

## Exact-head CI

All workflows below completed with conclusion `success` for head `77991765e92b5a1767018040a9056b0fdacfca6d`:

| Workflow | Run |
|---|---:|
| Directory Contact Consent (isolated PostgreSQL fixture, source contract, Deno check, frontend lint/build) | 44763355453 |
| MantiGO Open Ride Privacy Boundary | 44763355928 |
| Doctor Incremental Import Contract | 44763355391 |
| Backend-only Module Boundary | 44763355379 |
| RC425 MantiGO Paymob Atomicity | 44763355538 |
| Module Professionalization Validation | 44763355603 |
| Deploy MantiqatiX Web validation workflow | 44763355360 |
| Primary Catalog Frontend Validation | 44763355499 |

The Pages workflow's PR validation and smoke checks passed; this does not mean a production deployment occurred. The frontend build and dashboard browser tests passed. The dedicated consent workflow completed both its isolated PostgreSQL job and source-contract/type-check/build job successfully.

## Safety boundary

- Source and CI only.
- No Production migration, database DDL/DML, RLS, GRANT, Auth, Storage, Edge deployment, payment, wallet, settlement, or customer-data mutation.
- No production data was selected or exposed by this change.
- Existing RC473 release dependencies remain subject to the approved coordinated release process.

## Remaining release gates

This source fix does not certify Production. Keep the release blocked pending:
1. Operator-controlled encrypted off-site database and Storage exports.
2. Independent artifact retrieval, Vault recovery and PostgreSQL 17 restore/rollback rehearsal.
3. Measured RPO/RTO and release-owner approval.
4. Exact chronological migration reconciliation and coordinated Edge-function parity.
5. Post-release live authorization, consent and payment verification.

Production status remains **BLOCKED / NOT CERTIFIED**.
