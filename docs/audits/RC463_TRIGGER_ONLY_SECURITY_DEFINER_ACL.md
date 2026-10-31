# RC463 — Trigger-only SECURITY DEFINER ACL hardening

**Status:** implementation candidate; isolated PostgreSQL CI required before merge.  
**Production rollout:** not authorized by this change.

## Scope

RC463 hardens only these two existing trigger entrypoints:

- `public.assign_default_owner_to_unowned_business()`
- `public.capture_commission_rule_audit()`

Both functions are SECURITY DEFINER trigger functions, not client RPC endpoints. Their enabled triggers are attached to:

- `public.businesses` — deferred AFTER INSERT default-owner assignment.
- `public.commission_rules` — AFTER INSERT/UPDATE/DELETE audit capture.

## Change

The migration:

1. Fails closed if either function is missing, is not a SECURITY DEFINER trigger function, or its expected trigger is absent/disabled.
2. Pins both function search paths to the empty path. Function bodies use schema-qualified application objects.
3. Revokes EXECUTE from PUBLIC, anon, authenticated and service_role.
4. Verifies no effective API-role/PUBLIC EXECUTE remains and both functions retain an empty search path.

The public read-only `get_mnty_targeted_advertisements(...)` RPC is explicitly out of scope and remains untouched.

## Verification

The disposable PostgreSQL 16 integration fixture applies the exact migration file, then verifies:

- PUBLIC/anon/authenticated/service_role cannot directly EXECUTE either trigger function.
- Both functions remain SECURITY DEFINER with empty search_path.
- Both expected triggers remain enabled.
- A service_role business insert still creates the default owner membership.
- A service_role commission-rule insert still writes the audit row.

The integration runs inside a transaction and rolls back its fixture data.

## Release boundary

- Do not apply RC463 to Production from this PR.
- Require exact-head CI PASS and current-main reconciliation.
- Include RC463 in the restorable current-schema migration rehearsal.
- Before any Production rollout, confirm backup/restore, migration ordering, live trigger definitions, role ACLs and rollback.
- This change does not certify payment, finance, Auth, RLS or platform-wide Production readiness.


## Replay checkpoint limitation discovered

The repository's captured schema-only checkpoint was captured 2026-10-17 at migration `20261008222845`, while the live Production catalog now contains a default-owner trigger function that is absent from that checkpoint. The first RC463 forward replay therefore failed preflight at the expected missing-function guard. This demonstrates that the old checkpoint is not a current Production schema restore.

A disposable-only overlay fixture is being added to reproduce this known live-only trigger immediately before RC463 during CI. It uses a synthetic `.example.test` identity and is not a migration, is not production data, and must never be deployed. Passing replay with this overlay will prove the tracked migration chain plus this explicitly modeled object; it will **not** certify a fresh current-Production backup/restore. That gate remains NOT VERIFIED until an authorized current schema/data backup is independently restored and checked.
