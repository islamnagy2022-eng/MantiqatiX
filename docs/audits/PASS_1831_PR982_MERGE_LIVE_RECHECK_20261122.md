# Pass 1831 — PR982 merge and live Production recheck

**Date:** 2026-11-22  
**PR #982:** merged as `dbf40f6b9f8087fd5a274749c4a4db3ceb7c7564`.  
**Production status:** **BLOCKED / NOT CERTIFIED**. This pass performed read-only Production checks only.

## Source and CI result

- PR #982 `fix(directory): keep national listings disabled until consent release` merged after exact-head workflow runs completed successfully.
- Nine workflow runs on exact head `4decec8a8f4aa317c8094c33eac27386e5497485` completed successfully: Flexible commission drafts, RC425 MantiGo Paymob Atomicity, Directory Contact Consent, Doctor Incremental Import Contract, MantiGO Open Ride Privacy Boundary, Deploy MantiqatiX Web validation, Module Professionalization Validation, Backend-only Module Boundary, and Primary Catalog Frontend Validation.
- Primary Catalog build, professional dashboard browser E2E, and employee RBAC PostgreSQL all passed.
- The deployment workflow associated with this PR reported validation success but the `deploy` job was skipped. Do not treat this PR as a verified post-merge deployment.
- PR #978 remains DRAFT; exact-head tests passed earlier (28 success, 2 skipped, 0 failures), but its gallery still depends on matching catalog Edge/schema contracts.

## Fresh live Production checks

Project: `MANTIQATIX FINAL` (`moyhiluyhjsujhwlyeuu`), status ACTIVE_HEALTHY, PostgreSQL 17.6.1.155.

- Live migration ledger: **310** rows; latest `20261110150618`.
- Exact required release migration set: **0/76 present**; all 76 identifiers remain absent.
- `public.directory_listing_contact_consents`: absent.
- `public.migration_release_registry`: absent.
- Public schema table inventory: 137 tables.
- Selected live Edge Functions remain at versions: `directory-listings` v18, `catalog-admin` v20, `public-catalog-directory` v19, `public-catalog` v9. Their deployed entrypoint hashes remain those recorded in the prior Pass 1821–1830 audit; no Edge function was deployed in this pass.
- The national directory remains intentionally disabled in live Production. Keep it disabled until consent schema, audit writer, matching public readers, authorization, migration chain and backup/restore gates are released together.

## Security advisor snapshot

Fresh Supabase security advisor output includes:
- 9 RLS-enabled tables with no policies (INFO).
- 1 anonymous-callable SECURITY DEFINER function (WARN).
- 65 authenticated-callable SECURITY DEFINER functions (WARN).
- Multiple anonymous-role policy findings across exposed tables (WARN).
- Leaked-password protection disabled (WARN).

These findings require function-by-function authorization review; do not blindly revoke backend RPC execution or change RLS policies without verifying callers, intended roles and tests. Treat the advisor output as a triage inventory, not proof that all 65 functions are exploitable.

## Change boundary and next gates

- This pass made no Production DDL/DML, migration, RLS/GRANT, Auth, Storage, Edge deployment, payment, wallet, settlement or customer-data changes.
- Next: verify a fresh post-merge `main` Pages deployment and browser E2E; inspect the security advisor findings against actual grants/callers; obtain operator-owned encrypted off-site database and Storage backups; test Vault recovery and independent PostgreSQL 17 restore/rollback; reconcile the ordered 76-migration release chain.
- Do not merge/deploy PR #978 or enable the national directory until the coordinated schema + writer + reader + authorization release and restore gates pass.

**Production remains BLOCKED / NOT CERTIFIED.**
