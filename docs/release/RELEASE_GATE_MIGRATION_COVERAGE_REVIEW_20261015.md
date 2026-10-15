# Release Gate Migration Coverage Review — 2026-10-15

**Status: STATIC FINDING DOCUMENTED; NO CODE CHANGE APPLIED.**  
**Release decision: BLOCKED / NOT CERTIFIED.**

## Finding: explicit required-migration contract appears stale

The reviewed `scripts/validate-production-migration-chain-gate.mjs` contains a hard-coded `required` array described as the complete 28-file migration source set. Its latest listed item is:

`20261011010000_rc456_smm_service_role_access_boundary.sql`

The same recovery branch contains later forward-only candidate migrations:
- `20261012040000_rc462_mantigo_platform_admin_guard_malformed_permissions.sql`
- `20261015010000_rc526_marketing_services_platform_scope.sql`
- `20261015020000_rc527_marketing_platform_permission_boolean_hardening.sql`

Those three filenames are not in the inspected `required` array. Thus, the explicit required-source assertion does not itself ensure that these newer security corrections are present. Other generic chain checks may catch some missing files or ordering conflicts, but that does not replace an explicit required-release set for the current candidate.

## Required remediation

1. Decide which forward-only migrations belong to the release candidate based on scope and dependency review; do not automatically include every candidate.
2. Extend the required migration set and tests to include every approved release migration, including RC462/RC526/RC527 if they are in scope.
3. Assert exact file existence, strict timestamp ordering, no duplicate versions, dependency order, and matching integration test/fixture coverage.
4. Add a regression test that removes each required source file in a temporary fixture and proves the production gate returns BLOCKED.
5. Run the chain-gate contract, exact-head CI, and disposable baseline-forward replay after the changes.
6. Keep the live reconciliation manifest unverified until the approved migrations are proven applied by read-only live-ledger evidence.

## Security and release guardrails

- Do not modify the production migration ledger or apply migrations to production.
- Do not mark the current migrations deployed; they remain candidate source files while PR #248 is unmerged.
- Do not merge PRs or deploy without the explicit owner approval and all P0 gates passing.
- Preserve email OTP and the existing web/PWA release model.

## Evidence reviewed

- `scripts/validate-production-migration-chain-gate.mjs`
- `supabase/migrations/20261012040000_rc462_mantigo_platform_admin_guard_malformed_permissions.sql`
- `supabase/migrations/20261015010000_rc526_marketing_services_platform_scope.sql`
- `supabase/migrations/20261015020000_rc527_marketing_platform_permission_boolean_hardening.sql`
- PR #248: https://github.com/islamnagy2022-eng/MantiqaTiX/pull/248

This review note documents a likely gate-coverage gap; it does not claim the migrations are deployed or that the production gate currently passes.
