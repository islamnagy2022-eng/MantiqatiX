# Pass 1651–1660 — live directory and platform-root source parity recheck — 2026-11-22

## Scope and method

Read-only recheck of canonical GitHub main and Supabase Production project moyhiluyhjsujhwlyeuu. No directory row values or personal contact details were selected. Only aggregate counts, catalog metadata, deployed Edge Function source metadata and migration versions were inspected.

## Verified live Production facts

- Supabase migration ledger: 310 rows; latest version 20261110150618.
- None of these required versions is present: 20261117190000 (RC471), 20261119020000 (RC482), 20261119030000 (RC483), 20261119040000 (RC484), 20261120200000 (RC485), 20261120210000 (RC486), 20261120220000 (RC487).
- public.is_platform_admin() remains SECURITY INVOKER, configured with search_path=public, and returns true for any ACTIVE public.user_memberships ADMIN/SUPER_ADMIN membership. It does not consult private.platform_admins.
- private.platform_admins exists, but FORCE ROW LEVEL SECURITY is false.
- 57 policies across 24 tables still reference is_platform_admin().
- public.directory_listing_contact_consents is absent.
- Aggregate count of PUBLISHED public_directory_listings: 869. No row-level contact data was queried.
- Deployed directory-listings Edge Function is ACTIVE version 16, verify_jwt=false, bundle SHA-256 13f83fcf2faec148af34c08a006ab7bd8f9aa5946bc8af971ebf3e58a9120de0.
- Deployed bundle contains only index.ts, pagination-filter.mjs and doctor-import-contract.mjs. Its index imports only pagination-filter, doctor-import-contract and supabase-js.
- Canonical main index blob is 0d378cc88770ab23ab029a628bd891848a2348f4. It additionally imports public-directory-output-contract.mjs, consent-pagination.mjs, contact-consent-pagination.mjs and platform-admin-registry.mjs; it contains resolveListingOwner with exact business-wide membership requirement branch_id IS NULL.
- The deployed v16 index does not contain resolveListingOwner. It still allows the original claimed_user_id to edit a business-linked listing before checking current membership, and its membership query does not require branch_id IS NULL. The deployed public field projection includes phone, secondary_phone and address.
- The live consent table absence means the merged consent-aware source is not deployable as a standalone Edge replacement. Its migration and dependent Edge bundle must be released as one ordered, verified unit.

## Risk interpretation

These are confirmed source/live parity and authorization defects, not proof that an attacker accessed the data. The 869 count is aggregate only; no contact values were read. The P0 platform-root defect and directory contact-consent exposure remain unresolved in Production.

## Required next steps

1. Keep Production database and Edge read-only until a verified encrypted off-site backup, Vault recovery, independent PostgreSQL 17 restore, rollback rehearsal and measured RPO/RTO are documented by the operator.
2. Reconcile and rehearse the complete chronological migration chain; do not apply RC471/RC482/RC483/RC484/RC485/RC486/RC487 or directory consent migrations individually.
3. Deploy the full consent-aware directory Edge bundle only after its exact migration dependencies are present and verified.
4. Verify deployed Edge bundle hash/version and run adversarial live checks: public output omits non-consented phone/address; active consent enables only the selected scope; revoked/missing consent denies disclosure; current business-wide owner is allowed; branch-scoped, revoked, legacy stale claimant and unrelated users are denied.
5. Re-read the 57 RLS policies and helper definition/ACL/search_path after the coordinated platform-root release.

## Disposition

SOURCE authorization fix PR #962 is merged and its 12/12 exact-head workflows passed. Production is **BLOCKED / NOT CERTIFIED**. No Production SQL DDL/DML, migration, Auth/RLS/GRANT, Storage, Edge deployment, payment, wallet or customer data was changed in this pass.
