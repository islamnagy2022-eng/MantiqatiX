# MantiGO P0 Authorization Remediation — Production Change Runbook

**Status: PREPARATION ONLY — NOT AN EXECUTION AUTHORIZATION**
**Scope:** `public.mnty_can_platform_admin()`, `get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)`, `settle_mantigo_captain_backend(uuid,text,text)`, and related MantiGO platform-wide RPC guards.
**Candidate sources:** RC441 and forward-only RC462 on PR #248.
**Production ledger observed:** ends at `20261008222845 / rc424_atomic_digital_page_payment_webhook` on 2026-10-14 read-only inspection.

## Stop conditions

Do not execute this runbook until all are true:

- The complete chronological migration chain replays successfully from an empty disposable database using documented, separately approved test-only fixtures.
- Every migration in the proposed production bundle has been reviewed against the exact live ledger and schema; no migration is skipped, renamed, or rewritten.
- Exact-head CI and focused authorization tests pass for the exact reviewed commit.
- The owner separately approves a production change window, operator, rollback/forward-fix plan, and customer-impact window.
- A verified database backup/restore path and on-call contact are available.
- The release approver records the exact commit SHA and migration filenames to apply.

Any unmet item means **STOP — BLOCKED / NOT CERTIFIED**. Passing disposable tests is not production approval.

## Intended authorization invariant

Only a membership satisfying all of these conditions may use platform-wide MantiGO administration:

- `user_id = auth.uid()`
- `tenant_id = 'MNTY-PLATFORM'`
- `status = 'ACTIVE'`
- `upper(role) = 'SUPER_ADMIN'`
- `permissions` contains the exact JSON values `{"scope":"PLATFORM","full_control":true}`

Tenant OWNER, BUSINESS_OWNER, ADMIN, OPERATIONS, OPERATIONS_MANAGER, finance roles, malformed permission strings, missing keys, and boolean `false` must be denied. A valid platform SUPER_ADMIN remains permitted. `anon` must not execute these privileged RPCs.

## Before the window — read-only evidence

1. Capture the current applied migration ledger and verify its latest version/name.
2. Capture `pg_get_functiondef` for all affected functions, `prosecdef`, `proconfig`, and effective EXECUTE grants for `anon`, `authenticated`, and `service_role`.
3. Capture existing deployment/version identifiers for relevant Edge Functions and the current application commit.
4. Verify backup timestamp and restore-readiness evidence; do not use a production restore as a test.
5. Save outputs with timestamp, project reference, operator, and change ticket. Do not include secrets, credentials, or customer data in the evidence bundle.

## Apply — only after approval

1. Pause the change if migration replay, schema comparison, or exact-head CI differs from the reviewed evidence.
2. Apply only the approved, reviewed forward-only migration bundle through the established migration pipeline. Do not paste ad-hoc SQL into production or edit the applied migration ledger.
3. Do not run settlement, wallet, payment, or customer-data writes as part of this change.
4. If any statement fails or an unexpected object/grant is observed, stop immediately. Do not mark the release successful and do not continue with later migrations.

## Post-apply acceptance

Run read-only verification and attach results to the change record:

- `mnty_can_platform_admin()` is defined with an empty, safe `search_path` and exact JSON containment for platform scope/full-control.
- The financial report, dashboard, settlement, and stale-ride expiration functions call the platform guard before accessing or mutating platform-wide data.
- `anon` has no EXECUTE on privileged RPCs; authenticated execution is limited to intended entry points whose function bodies enforce the platform guard.
- Disposable behavioral tests and approved staging tests reject tenant roles, missing/wrong tenant scope, malformed `full_control`, `false`, and absent platform membership; only the exact valid platform membership passes.
- Function definitions, grants, and applied migration ledger match the approved bundle; no unrelated schema, RLS, Auth, secret, financial-row, or Edge Function changes occurred.
- Review logs for errors and confirm the customer-facing site and non-financial workflows remain healthy.

## Failure and rollback policy

- Do **not** restore the known-insecure pre-fix platform-admin guard as a rollback.
- If post-apply verification fails, stop privileged MantiGO admin/financial operations using the approved operational containment procedure, preserve logs, notify the owner, and prepare a reviewed **forward fix**.
- Restore from backup only under a separately approved recovery decision and only after assessing the impact on all writes since the backup.
- Re-open release certification only after the failed check is understood, corrected, and rerun on the exact candidate head.

## Evidence status as of 2026-10-14

Focused disposable PostgreSQL tests for RC441/RC462 and related CI checks passed on PR #248 candidate commits. Production catalog inspection still showed the old broad authorization implementation and the applied ledger still ended at RC424. No production migration was applied by this work. This runbook documents safe prerequisites; it does not claim remediation is deployed or authorize deployment.


## Additional test-fidelity limitation — 2026-10-14

Review of `supabase/tests/rc449_mantigo_platform_admin_fixture.sql` and `supabase/tests/rc449_mantigo_platform_admin_integration.sql` confirms that the disposable fixture defines a **test-only stand-in** for `public.create_settlement_and_post_journal(...)`. The stand-in returns a JSON result and deliberately performs no journal/accounting writes.

Therefore the passing RC449 integration test is meaningful evidence for the platform-admin authorization gate, settlement RPC ledger-state transition, audit/notification behavior, and replay/idempotency against the fixture. It is **not** evidence that the real production journal writer posts balanced journal entries, applies the correct account mappings, or remains atomic with settlement in the actual schema. Those require a separate isolated integration test using the authoritative journal schema/function and real database constraints, with no production financial writes.

Do not remove the stand-in's warning, relabel this test as financial E2E, or run the production journal writer as part of the authorization remediation window. Keep the accounting E2E gate open until the real journal path is validated in an approved disposable/staging environment.
