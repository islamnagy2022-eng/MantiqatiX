# Unapplied RC199 migration correction exception — 2026-10-17

**Status:** Draft review evidence only. This does not authorize production changes, migration application, merge, or release.

## Why this correction is allowed

The disposable chronological replay failed at migration 20260928184000_rc199_customer_cross_tenant_order_visibility.sql with SQLSTATE 42710 because policy order_status_history_customer_select_own already exists. The preceding migration 20260928154411_rc199_marketplace_order_read_grants_v2.sql creates that exact policy. The later file also tries to create orders_customer_select_own, which is already present in the captured live schema.

The read-only production migration-version capture at workflow run 38993809648 records:
- Last applied version: 20261008222845
- Applied version count: 283
- Version 20260928154411 is present.
- Version 20260928184000 is absent.
- The applied-version list SHA-256 is pinned in the manifest as 0b60096967ef51a912a08b437a10377e2f12d357dd6b25d5dc80677b1f8832b2.

This establishes that the exact 20260928184000 version is not recorded as applied in the captured production ledger. The schema snapshot manifest remains PENDING_REVIEW and deployment_approved=false; this is evidence for a candidate-source correction only, not release certification.

## Narrow source correction

The migration remains in place at its existing path/version, but policy creation is now idempotent:
- Existing same-name policies are checked for SELECT command, authenticated-only role, permissive mode, and expected customer/anonymous predicate fragments.
- A matching policy is reused.
- A same-name policy with a mismatching contract raises an exception and fails closed.
- If absent, the policy is created.
- Grants remain read-only SELECT grants.
- The already-applied history policy from 20260928154411 is not duplicated.

No production SQL, production grants, RLS, Auth, Edge Function, payment, or ledger was changed.

## Immutable-history guard exception

scripts/validate-migration-history-immutability.mjs permits this one correction only if all of the following remain true:
- the base migration blob SHA equals 4e87ab0526640c390f5427cbddf9350f3cde1632;
- the pinned version list hashes to the manifest's applied_migration_versions_sha256;
- the prior applied version is present and this migration version is absent;
- the manifest still points to read-only schema capture 38993809648 and says deployment is not approved;
- the corrected source contains the idempotent policy-contract guards.

Any changed base blob, ledger version, manifest hash, or other migration path blocks the exception. The exception is not a general waiver of migration immutability.

## Acceptance

- The migration-history immutability self-test passes and only this exact evidence-backed correction is allowed.
- The disposable full replay passes this migration without suppressing/skipping it, then continues to the next first error.
- Policy contract tests confirm no broad grants and no change to customer-only row scope.
- PR remains Draft until independent review. Release remains BLOCKED / NOT CERTIFIED.


## Follow-up evidence — replay duplicate policy

Replay at SHA d1eff709f01927f30a676f9bd96d20ae122f7837 reached migration 20260928184000 and failed because order_status_history_customer_select_own already existed. Earlier migration 20260928154411 creates the same policy and is present in the captured production version list; 20260928184000 is absent. The candidate source was made idempotent with fail-closed policy-contract checks and the immutability guard was narrowed to this exact original blob and pinned read-only version list. Applied source version 20260928154527 is still missing from repository history. The production snapshot manifest remains PENDING_REVIEW, so this is a draft candidate only.


## Replay checkpoint — REPLAY-ORDER-003

A later full replay failed at applied migration 20260929073244 because the schema-only disposable database lacked tenant MNTY-PLATFORM, a data dependency of the inactive test-business seed. Added a synthetic, idempotent test-only tenant fixture and inject it before the consumer as untracked temporary migration 20260929073243. The validator limits the fixture to one public.tenants INSERT for MNTY-PLATFORM, no auth users or production data, and confirms timestamp ordering. Replay run 39071511736 passed fixture-copy/untracked verification and was in progress at the last check. This is not historical source recovery and does not change production; release remains BLOCKED / NOT CERTIFIED.


## Follow-up — REPLAY-ORDER-004

The RC339 showcase migration fails in schema-only replay because its fixed owner UUID is absent from public.users/auth.users. A test-only synthetic owner fixture is now injected at 20261004005817 before organization seed 05818 and canonical consumer 05819. It uses the source UUID only in a disposable database, a reserved invalid.example email, an empty password hash, no tokens, and a public profile. Validation/exact-copy checks passed in 39072088344; full replay was still in progress. No production user was created or changed.


## Follow-up — REPLAY-ORDER-005 (RC215 signup trigger)

A disposable replay revealed a real ordering defect in applied migration 20260930100000: the auth.users AFTER INSERT trigger attempts to insert a CUSTOMER membership before a public.users profile exists. Added forward-only migration 20261018010000_auth_user_profile_before_customer_membership.sql to create the profile before invoking the existing membership helper, plus a rollback-only behavioral regression test. The earlier showcase fixture suppresses only the legacy trigger while creating the hardcoded synthetic user, restores it, and calls the membership helper; this workaround is limited to disposable CI. Source integrity and the narrow migration immutability exception passed, but full replay was still in progress. No production changes; release remains BLOCKED / NOT CERTIFIED.
