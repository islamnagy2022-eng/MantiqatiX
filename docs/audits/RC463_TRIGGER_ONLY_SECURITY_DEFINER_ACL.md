# RC463 — Trigger-only SECURITY DEFINER ACL hardening

**Status:** implementation candidate; exact-head isolated PostgreSQL CI required before merge.  
**Production rollout:** not authorized by this change.

## Scope

RC463 targets two trigger-only SECURITY DEFINER functions observed in live Production:

- `public.assign_default_owner_to_unowned_business()` — deferred AFTER INSERT trigger on `public.businesses`.
- `public.capture_commission_rule_audit()` — AFTER INSERT/UPDATE/DELETE trigger on `public.commission_rules`.

These are trigger entrypoints, not client RPC endpoints. The intentionally public read-only `get_mnty_targeted_advertisements(...)` RPC is explicitly out of scope.

The older captured schema-only checkpoint (2026-10-17, through `20261008222845`) does not contain the default-owner function/trigger. RC463 therefore:
- Hardens a function only when its matching expected trigger exists and is enabled.
- Skips a function/trigger pair only when both are fully absent from the older checkpoint.
- Fails closed on partial, disabled, or mismatched function/trigger state.

No function source, default-owner behavior, trigger definition, or business data is created or replaced by RC463.

## Change

For each present function, the migration:

1. Verifies it is a SECURITY DEFINER trigger function.
2. Verifies the expected trigger is attached to the expected table and enabled.
3. Pins `search_path` to the empty path. The live function bodies use schema-qualified application objects.
4. Revokes direct EXECUTE from PUBLIC, anon, authenticated and service_role.
5. Verifies no effective API-role/PUBLIC EXECUTE remains and the empty search_path is active.

## Verification

The disposable PostgreSQL 16 integration fixture creates synthetic trigger functions and triggers using a synthetic `.example.test` owner identity, applies the exact RC463 migration, then verifies:

- PUBLIC/anon/authenticated/service_role cannot directly EXECUTE either trigger function.
- Both functions remain SECURITY DEFINER with empty search_path.
- Both expected triggers remain enabled.
- A service_role business insert still creates the fixture default-owner membership.
- A service_role commission-rule insert still writes the audit row.

The integration runs inside a transaction and rolls back its fixture data. The synthetic functions exist only in the disposable test fixture; they are not production migration source.

## Replay checkpoint limitation

The captured schema-only checkpoint is older than the live Production catalog and is not a current Production restore. The first strict RC463 replay exposed the missing default-owner function in that checkpoint. The current migration handles this bounded difference without creating or replacing the live-only function. Even a passing replay does not certify a current-Oct-31 Production backup/restore rehearsal.

## Release boundary

- Do not apply RC463 to Production from this PR.
- Require exact-head CI PASS and current-main reconciliation.
- Include RC463 in a restorable current-schema migration rehearsal.
- Before any Production rollout, confirm backup/restore, migration ordering, live trigger definitions, role ACLs and rollback.
- This change does not certify payment, finance, Auth, RLS or platform-wide Production readiness.
