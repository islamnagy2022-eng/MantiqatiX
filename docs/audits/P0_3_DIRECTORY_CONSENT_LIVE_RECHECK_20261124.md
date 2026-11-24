# P0.3 — Directory Contact Consent and Publication Live Recheck
**Date:** 2026-11-24  
**Repository main inspected:** `80cd991f6d591c42f77f58531de995d4e1ef2f3f`  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Method:** read-only Supabase catalog, aggregate-only row counts, Edge Function source retrieval, and GitHub migration/Edge source inspection. No listing contact values or owner identifiers were selected.

## 1. Live Production database state

### Contact-consent registry (RC473)

- `public.directory_listing_contact_consents` is **absent** (`to_regclass` is NULL).
- The RC473 migration version `20261118020000` is absent from `supabase_migrations.schema_migrations`.
- No table-level consent rows can exist until that migration is released.
- RC473 source defines four separate scopes: `PHONE`, `SECONDARY_PHONE`, `ADDRESS`, and `PRECISE_LOCATION`; an active partial unique index allows one active consent per listing/scope; revocation attribution and reason are retained; RLS + FORCE RLS are enabled; browser roles receive no table access and service_role receives SELECT/INSERT/UPDATE.
- Existing RC473 isolated PostgreSQL integration asserts create, duplicate-active rejection, revocation history, re-consent, browser-role denial, service-role grants and FORCE RLS.

### Source/republication permission evidence

- `public.directory_source_permission_evidence` **exists**, with RLS and FORCE RLS enabled.
- Effective SELECT is denied to both `anon` and `authenticated`; service_role has the server-only privileges required by the Edge workflow.
- Aggregate row count is **0**, including **0 APPROVED** records, 0 active records, and 0 records that allow both doctor-profile and commercial republication.
- Current Edge source requires a current, approved, unrevoked evidence record matching source host and source name, with both permission flags, valid-from and expiry checks, before a new doctor publication. New doctor imports are staged as DRAFT; changes to published doctor source attribution require reviewed publication. Admin evidence approval requires a different user from the evidence creator. Revocation records actor, timestamp and reason.
- This source-rights contract is specifically for doctor-profile republication. Other listing types are described by the current source as separately governed; their underlying source-rights rules are not established by this audit and remain an open acceptance item.

### Claims and listing base tables (RC472)

- `public.public_directory_listings` and `public.directory_listing_claim_requests` exist, both with RLS and FORCE RLS enabled.
- Neither table grants SELECT to `anon` or `authenticated`; service_role has server-side access. No client table policies were found for these tables.
- RC472 function `public.review_directory_listing_claim_atomic(uuid,text,uuid,text,uuid,boolean,boolean)` is absent.
- RC472 null-safe owner index `ux_user_memberships_user_business_branch_nullsafe` is absent; no equivalent `COALESCE(branch_id,'')` index was found in the read-only index catalog query.
- The claim queue contains one row in `REVIEWING`; the query read only the status aggregate, not the claim row or applicant identity.

### Aggregate directory inventory

| Metric | Live count |
|---|---:|
| Total listing rows | 965 |
| PUBLISHED | 869 |
| DRAFT | 87 |
| HIDDEN | 9 |
| PUBLISHED doctors | 568 |
| PUBLISHED clinics | 7 |
| PUBLISHED pharmacies | 48 |
| PUBLISHED hospitals | 1 |
| PUBLISHED laboratories | 10 |
| PUBLISHED medical centres | 7 |
| PUBLISHED listings with a primary phone | 869 |
| PUBLISHED listings with a secondary phone | 178 |
| PUBLISHED listings with an address | 869 |

The database publication flag is not owner contact consent and does not itself establish source/republication rights.

## 2. Deployed Edge Function — exact live source

Supabase returned the deployed `directory-listings` function source directly:

- Status: **ACTIVE**
- Version: **18**
- `verify_jwt=false` (the handler has its own public GET / authenticated POST boundaries)
- Deployed source files: **one file only — `index.ts`**
- Deployed bundle SHA-256: `bb65d74325f8bdf08f060f7ae2517bb30901630635d1de4f35523d7cef6afe48`
- The deployed file is a fail-closed stub, not the current consent-aware implementation.
- GET returns HTTP 200 with an empty page and `directoryDisabled: true`.
- POST returns HTTP 503 with `DIRECTORY_LISTINGS_DISABLED_FOR_V1`.
- The function does not query the directory or return listing/contact values in this deployed version.

Therefore, **869 rows contain stored contact fields in Production, but 0 unconsented directory rows are returned by the deployed v18 endpoint**. This is a safe, deliberate outage of directory discovery and owner claim/consent functionality, not a successful release of the consent workflow.

Current main source requires additional modules not present in the deployed v18 bundle, including pagination, doctor import/source-rights, public output sanitization, both consent pagination helpers, platform-admin registry and release-gate modules.

## 3. Current source behavior verified

The main-source implementation has the following safeguards:

1. Public projection is an explicit allowlist; phone, secondary phone, address and precise map URL are each revealed only by their matching active consent scope.
2. Coarse governorate/district/village data is separate from exact address and precise-location disclosure.
3. Contact-consent retrieval is paginated beyond PostgREST row caps; any failed, thrown or malformed page discards the partial result and fails closed.
4. The public address filter requires active `ADDRESS` consent IDs and fails closed if its registry query is incomplete.
5. Grant/revoke POST actions authenticate a confirmed non-anonymous Supabase user; actor identity is derived from the verified token, not from request-body input.
6. Only the current claimed owner or an active business-wide OWNER/BUSINESS_OWNER may change contact scopes; branch-only membership does not qualify.
7. Grant is idempotent; revocation is scope-specific and records `revoked_by`, `revoked_at` and reason.
8. Doctor source evidence is separate from owner contact consent. Missing/expired/revoked or incomplete republication evidence excludes doctor rows.
9. The main-source release gate defaults GET to an empty response unless `DIRECTORY_LISTINGS_ENABLED === "true"`; POST additionally requires the contact-consent registry to be reachable.
10. RC472 performs claim/listing/business/membership transitions in one locked transaction. Its SQL migration and concurrency tests are source-only until the migration is applied.

The current source tests include no-consent output, separate phone/secondary-phone/address/precise-location scopes, unsafe map URL rejection, owner visibility behavior, partial pagination failures, revocation filtering, source evidence controls and the RC473 registry schema contract. These are source/isolated tests, not proof that the v18 deployed Edge bundle has the full implementation.

## 4. Stale release evidence corrected

The previous release manifest and validator still expected deployed `directory-listings` v16 and counted 869 contact-bearing rows as exposed through the public endpoint. That description no longer matched live v18.

This branch updates `docs/release/production-migration-reconciliation.json` with:
- exact live v18 version and deployed bundle hash;
- the single deployed source file and missing consent-aware modules;
- GET empty / POST 503 fail-closed behavior;
- zero contact rows returned by the live Edge endpoint;
- the consent registry absent;
- the source-rights registry present but empty;
- RC472 claim RPC and null-safe membership index absent;
- aggregate stored-contact counts kept separate from public exposure counts.

The directory consent validator now asserts the current v18 fail-closed live boundary rather than v16-era metadata.

## 5. Release decision

**P0.3 remains BLOCKED / NOT CERTIFIED.** Preserve the deployed v18 fail-closed stub. Do not enable `DIRECTORY_LISTINGS_ENABLED`, apply RC472/RC473 to Production, deploy the consent-aware Edge bundle, or publicly publish listings as part of this audit.

Release requires, in order:
1. Complete migration/physical-effect reconciliation and encrypted recoverable backup/restore.
2. Coordinated ordered DB release of RC472 + RC473 with all authorization prerequisites; post-release read-back of index, RPC, FORCE RLS and exact service-role/browser ACL.
3. Preserve the fixed non-doctor allowlist (business, clinic, pharmacy, medical_center, hospital, laboratory, health_provider); the doctor evidence registry applies to doctor-profile republication. Any new non-doctor category or altered provenance/publication rule requires separate review.
4. Run exact-head PostgreSQL and source-contract suites, owner grant/revoke/expiry tests, no-consent/revoked/each-scope public projection tests, cross-business owner negatives, registry outage behavior, and pagination limits.
5. Deploy the complete Edge bundle as a single coordinated version, verify source hash/file inventory, and run deployed-origin negative and positive GET/POST tests.
6. Keep the directory disabled until all gates pass.

**Safety:** this pass used aggregate counts and schema/function metadata only. No phone, address, listing-level contact row, owner identity, Auth data or object content was read. No Production DDL/DML, RLS, GRANT, Storage, Edge, directory, payment or business-data write occurred.
