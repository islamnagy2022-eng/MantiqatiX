# RC42 Platform Admin Bootstrap and Historical Source Recovery — 2026-10-31

## Scope
Read-only Production metadata review plus exact recovery of applied migration statements into a source branch. No registry rows, identities or business records were queried.

## Evidence
- Exact historical source files and hashes are recorded in the appended 2026-10-31 section of this report's companion TODO/session/RC42 manifest files.
- Four applied statements were restored exactly: registry creation, atomic registration review, one-time platform bootstrap, and the live RLS alias.
- The separate owner-bootstrap statement version 20260927131555 contains a hard-coded personal email. It was not re-published as a public migration file. Its ledger hash and byte length are documented without reproducing the identifier.
- The live bootstrap function is SECURITY DEFINER with empty search_path and service_role-only EXECUTE. The private registry has RLS enabled, FORCE RLS disabled, no direct anon/authenticated SELECT/INSERT, and service_role SELECT/INSERT.
- The bootstrap function's default tenant ID is `MNTY_PLATFORM`, while the canonical production tenant identifier is `MNTY-PLATFORM`. The function unconditionally inserts the tenant, creates a SUPER_ADMIN membership with empty permissions, inserts the registry row, and records the target user as the audit actor.
- The live Edge inventory has `mnty-registration-review` v5 (JWT required), but no dedicated platform-bootstrap Edge function. Registration review is not a bootstrap operation.
- RC220 ledger alias 20261002044021 reconciles SUPER_ADMIN memberships from the private registry; it does not create the registry root entry.

## Security assessment
The registry itself is protected from direct client table access. The remaining risk is operational bootstrap correctness and audit attribution, not evidence of direct anon/authenticated access to the registry. The current one-time bootstrap function must not be invoked with defaults: the tenant ID mismatch and unconditional tenant insert can fail against the existing canonical tenant or create an unintended tenant if called with the wrong parameters. Do not attempt to infer current registry population.

## Required remediation
1. Design a fail-closed, explicitly authorized bootstrap/recovery path that handles the existing canonical tenant without duplicate creation.
2. Separate the actual operator identity from the target platform-admin identity in audit records.
3. Require negative tests for anonymous, tenant admin, wrong target, already-bootstrapped and replay attempts.
4. Verify the root registry state only during an explicitly authorized controlled operation with a backup/rollback plan.
5. Keep Production blocked until bootstrap eligibility, live object parity, backup/restore, payment/finance E2E and remaining release gates are verified.

## Safety
No Production DDL/DML, grants, RLS/Auth changes, Edge deployments, registry-row reads, payments, settlements or journal mutations occurred.


## Cross-PR source collision reconciliation

- PR #207 already carried the same three RC42 migration paths but with an extra trailing newline, producing different Git blob SHAs from the applied-ledger statements.
- Updated only those three migration files on PR #207's draft branch to the exact canonical bytes recovered for PR #598. The source contents now compare equal byte-for-byte across both branches; no other PR #207 files were changed.
- The cross-PR collision guard is expected to treat the identical path/version/blob as one canonical migration source. PR #598 still must pass a fresh exact-head run before merge; PR #207 remains draft and unmerged.
