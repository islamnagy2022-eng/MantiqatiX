# MantiGO platform settlement authorization drift — 2026-10-31 03:25 UTC

## Scope and safety

Read-only inspection of live Supabase project metadata, migration history, SECURITY DEFINER function metadata, and the exact function definition. No business rows were read. No SQL mutation, migration, grant, Auth/RLS change, Edge Function deployment, payment, settlement, wallet, or journal operation was performed.

## Live Production evidence

- Project status: `ACTIVE_HEALTHY`; PostgreSQL 17.6.
- Live migration ledger: 308 records; latest version `20261029083845`.
- Migration versions `20261010030000` (RC441) and `20261010170000` (RC449) are absent from the live migration ledger.
- Live `public.settle_mantigo_captain_backend(uuid,text,text)` is `SECURITY DEFINER`, configured with `search_path=public`, and directly executable by `authenticated` (`anon` is not executable).
- The live function checks `p_admin_user_id = auth.uid()`, then accepts any active membership for that user whose role is one of `ADMIN`, `SUPER_ADMIN`, `OWNER`, `BUSINESS_OWNER`, `ACCOUNTANT`, `FINANCE_MANAGER`, or `FINANCE`. The membership predicate is not restricted to tenant `MNTY-PLATFORM`, does not require platform scope/full-control permissions, and does not call `mnty_can_platform_admin()`.
- After that check, the function reads a platform-wide MantiGO ride and financial ledger row, calls `create_settlement_and_post_journal`, marks the ledger settled, and writes audit/notification records.

## Risk classification

**P0 / BLOCKING — platform-wide financial authorization is broader than the intended platform-admin boundary.**

A signed-in user with one of the accepted active tenant roles may be able to invoke the authenticated RPC for a qualifying completed and paid/cash-confirmed MantiGO ride. This is a confirmed authorization-contract defect in the live function definition and EXECUTE grant. This audit does not establish that the function has been abused or that any unauthorized settlement occurred.

## Existing source remediation

The repository already contains a forward-only source remediation in:

- `supabase/migrations/20261010030000_rc441_platform_admin_scope_hardening.sql`
- `supabase/migrations/20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql`

The RC449 source replaces the broad role predicate with `public.mnty_can_platform_admin()`, requiring an active `SUPER_ADMIN` membership in `MNTY-PLATFORM` with explicit `scope=PLATFORM` and `full_control=true`; it pins an empty `search_path` and keeps authenticated RPC entrypoints while enforcing authorization inside each RPC.

The isolated integration test `supabase/tests/rc449_mantigo_platform_admin_integration.sql` covers rejection of tenant OWNER, tenant ADMIN, OPERATIONS_MANAGER and tenant-scoped SUPER_ADMIN, acceptance of the explicit platform SUPER_ADMIN, authorized settlement persistence, and replay/idempotency. This is source/test evidence only, not proof that the live Production migration has been applied.

## Required closure

1. Keep Production financial mutations blocked; do not test this by invoking settlement against live records.
2. Obtain an approved, cost-reviewed, restorable, schema-faithful isolated environment and a credential-scrubbed current Production schema capture.
3. Restore and rehearse the exact chronological forward-only migration chain, including RC441/RC449 and payment/journal dependencies, with the existing isolated integration tests.
4. Verify the exact current source/ledger/object/ACL contract and rollback plan before release approval.
5. Apply the approved migration only through the controlled Production release process.
6. Re-read the live function body, `search_path`, `mnty_can_platform_admin()` contract and grants after deployment.
7. Run negative tests for tenant-scoped roles and positive/idempotency tests for the explicit platform SUPER_ADMIN in the isolated environment; do not create live financial transactions as a test.

## Status

- Live authorization drift: **CONFIRMED / NOT REMEDIATED IN PRODUCTION**.
- Source remediation: **PRESENT / ISOLATED TEST SOURCE PRESENT**.
- Production migration: **NOT APPLIED**.
- Overall Production Gate: **BLOCKED / NOT CERTIFIED**.
