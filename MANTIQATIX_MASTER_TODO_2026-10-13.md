# MANTIQATIX MASTER TODO — 2026-10-13

**Release state: BLOCKED / NOT CERTIFIED.** This is the requested root-level continuation index. Detailed historical records remain append-only in docs/SESSION_LOG.md; canonical project continuity and broad backlog remain in docs/PROJECT_CONTINUITY.md and docs/MASTER_PRODUCTION_TODO.md. Do not replace those records with this summary.

## Current repository state

- Repository: islamnagy2022-eng/MantiqaTix
- Working branch: reconcile/rc425-458-current-main-20261011
- Main last verified: 8a56358d505d2c12878440037f7f24ba65d2ea10
- PR #207: open, draft, unmerged. At the start of the 2026-10-13 continuation, head was 3e06f004cf6a575c2d88af3ce143b45750355b97; subsequent commits update the candidate. Query the current PR head before acting.
- PR #218: open, draft, unmerged at last inspection, head 77012649e41fe22077538c39cd8593bf696ab33e.
- Supabase project: moyhiluyhjsujhwlyeuu.
- Production migration ledger last documented at RC424 / version 20261008222845. Do not mutate or rewrite it.
- Latest replay run known before this TODO file commit: 38349259664 was pending/in progress for Disposable Supabase Migration Chain Replay. Check latest exact-head CI before assuming its result.
- No production schema/data/grants/RLS/Auth/secrets, deployed functions, or release settings were changed during this continuation. No merge or deployment occurred.

## P0 — security and financial integrity

1. **Payment webhook table privilege mismatch — NOT VERIFIED runtime, high-risk evidence.**
   - Read-only catalog reports public.payment_provider_events ACL: postgres=arwdDxtm/postgres, authenticated=rm/postgres, service_role=Dxtm/postgres.
   - has_table_privilege reports service_role lacks SELECT/INSERT/UPDATE/DELETE on this table, while deployed paymob-webhook v8 directly selects and inserts using the service-role client.
   - Next: trace intended call path/RPCs and existing grants across all relevant tables, reproduce safely in disposable CI, add a least-privilege regression test and propose a scoped migration/RPC. Do not apply production grants or deploy without separate explicit authorization.
2. **Other permission-denied runtime evidence.**
   - Recent Postgres logs include permission denied for smm_orders, smm_services, smm_wallets, digital_page_orders and digital_page_products.
   - Next: inventory intended client/server access, RLS and grants per table. Do not mass-grant or weaken policies. Respect the initial-launch SMM feature freeze; do not implement SMM feature changes or weaken SMM tests.
3. Verify RPC SECURITY DEFINER caller authorization, tenant isolation, order/payment idempotency, webhook replay and journal integrity using exact-head CI and safe isolated tests. Production payment E2E remains NOT VERIFIED.

## P1 — migration history and disposable replay

1. Inspect latest run for current PR #207 head and capture complete logs.
2. A read-only catalog query recovered the current public.payment_provider_events schema: 13 columns, PK(id), unique(provider, external_event_id), FKs to payment_intents and tenants, two later-created indexes, RLS+FORCE RLS, and SELECT-only finance policy. The fixture supabase/tests/baselines/payment_provider_events.sql is schema-only and deliberately includes no policy, grants, rows, payloads, or secrets.
3. CI copies the fixture byte-for-byte only into the disposable workspace as 20260920211716_test_only_live_derived_payment_provider_events_baseline.sql, before the ordered finance-read policy migration. Validator checks source provenance, shape, RLS, no policy/grants/data, timestamp order and policy contract. This is not historical DDL or a production migration.
4. Current live catalog recheck confirms all seven credit amount/generated columns use numeric(18,2), precision 18 scale 2. The three credit fixtures and validator have been restored to that exact type after an incorrect interim edit.
5. Continue chronological replay through every subsequent migration. A successful preflight is not a successful replay. Verify final schema/constraints/indexes/RLS/grants/functions against evidence. Preserve duplicate migration timestamp collision gates and immutable production ledger.
6. Record every blocker and exact SHA/run. Never invent missing policy or historical provenance.

## P2 — SMM and marketing

- Initial-launch SMM feature freeze remains in effect from the prior explicit owner instruction. Preserve failed/deferred validation evidence; inspect and document only until the owner explicitly lifts the freeze.
- After authorization, review gateway server-side deny behavior, tenant/provider access, credential secrecy, provider timeouts, retry/idempotency and payment safety.

## P3 — functionality and UX

- Membership/account-role counts and authorization correctness.
- Orders, inventory, accounting, reports, notifications, PWA and mobile/browser UX.
- Validate with isolated automated tests; do not claim runtime behavior from static source checks.

## P4 — release and recovery

- Full disposable migration replay on exact candidate SHA.
- Exact-head build and required regression/security workflows.
- Tenant-isolation and payment/refund/settlement E2E in safe test environment.
- Backup/restore and rollback drill.
- Auth/security advisor remediation evidence, browser/device smoke, release gate, and release decision.
- No production launch until all critical gates are proven and a separate release approval is given.

## Latest evidence pointers

- docs/SESSION_LOG.md — chronological append-only session history.
- docs/PROJECT_CONTINUITY.md — handoff and cross-session state.
- docs/MASTER_PRODUCTION_TODO.md — existing detailed backlog.
- docs/release/MIGRATION_REPLAY_BLOCKERS.md — migration evidence, exact blockers, catalog findings and replay decisions.
- docs/release/CREDIT_SCHEMA_BASELINE_EVIDENCE_20261013.md — credit fixture evidence and limits.
- PR #207: https://github.com/islamnagy2022-eng/MantiqaTix/pull/207
- PR #218: https://github.com/islamnagy2022-eng/MantiqaTix/pull/218

## Last safe checkpoint

Checkpoint source head before this root index was added: d2c84a7be34a8bbd40523964944a8b5403c02208.
Next executable action: inspect exact-head workflow run for the current PR #207 candidate, then fix the next evidenced blocker on the same working branch and update this index plus the append-only session log.

## 2026-10-13 SESSION-004 update
- Newly observed replay failure at run 38349796102: public.settlement_attempts missing when historical finance-read policy migration 20260920211717 runs.
- Added catalog-derived schema-only fixture supabase/tests/baselines/settlement_attempts.sql, temporary replay version 20260920211715, CI exact-copy/untracked/no-data guards, and validator contract checks.
- Candidate head at this checkpoint: 6b481ca4ea8d1b8d8855871db49b2ca262ad1801.
- Exact-head replay run 38350384105 is pending/in progress; do not claim replay success until it finishes.
- Next: inspect exact-head replay result, fix next evidenced blocker, then continue P0 payment-webhook ACL/source analysis. No production change, merge, or deployment.

## P0 payment-webhook ACL investigation — 2026-10-13
- Read-only live function inspection: deployed `paymob-webhook` version 8 directly reads/writes `payment_provider_events`, `subscription_payment_intents`, `digital_page_orders`, `mantigo_financial_ledger`, and `notifications`; ACL checks show service_role has no SELECT/INSERT/UPDATE/DELETE on those tables. `payment_intents` does have service_role DML privileges.
- Existing SECURITY DEFINER RPCs `process_verified_provider_payment`, `process_verified_subscription_payment`, and `process_verified_digital_page_payment_backend` are service_role-only by observed function ACL. This favors aligning the webhook to RPC boundaries over broad table grants.
- Evidence recorded in `docs/release/PAYMOB_WEBHOOK_PRIVILEGE_MISMATCH_20261013.md`. No production ACL/function/data changes were made; no real webhook was sent.
- Latest replay candidate with settlement_attempts fixture reached the exact-copy/untracked check but exposed a CI shell-scope defect: `settlement_attempts_baseline: unbound variable` because verification step lacked its own declarations. Added those declarations in commit `9291b38976dd9348c3808c039ab4027d02042a48`. Exact-head run for that code passed baseline validation/injection but had the verification step fail; the follow-up candidate adds the declaration fix.
- A later run exposed a validator regex escaping defect for the settlement policy; fixed in commit `56dc3375ec8cde875d886e1aa95b2329889139b0`. Current exact-head replay run was queued at `e0cdd1f12f89dfbfdd3476ebd121a1dff09c4de1` as of the last check; inspect the newest run after this documentation commit.
- Continue to treat full replay as NOT VERIFIED until the latest head reaches the chronological replay step and finishes.

## P1 migration replay — SMM bootstrap function dependency
- Run 38350577917 progressed through settlement_attempts and failed at 20260927033925_harden_smm_bootstrap_trigger_execute_privilege.sql because public.smm_bootstrap_first_admin() is missing from prior repository history (SQLSTATE 42883).
- Live catalog confirms the function exists with SECURITY DEFINER, RETURNS trigger, search_path public, postgres-only ACL. Added disposable-only definition fixture `supabase/tests/baselines/smm_bootstrap_first_admin.sql` at temporary replay version 20260927033924; subsequent historical migration still applies the EXECUTE revoke. No trigger is created or invoked by replay; no SMM feature work is resumed.
- Validator and CI injection/byte-identity/untracked checks added. Current candidate head: ee839091a7494300a85eb094595549f136c47ac2. Exact-head replay run 38350836940 pending; do not claim replay success.

## P1 migration replay — registration baseline chronology correction
- Exact replay evidence from run 38350881761: migration 20260927065247_mnty_atomic_registration_review.sql failed because public.account_registration_requests did not exist. The previous disposable baseline version 20260927074155 came too late.
- Split the registration fixture into schema-only at 20260927065246 and policy/grant-only at 20260927074155; the pending unique index remains owned by the existing 20260927134000 migration.
- Updated workflow exact-copy/untracked/no-data guards and validator checks for both layers. Candidate code head 14cae3a824dbac5e2da85ad90d05b1c303a460b4; exact-head replay outcome NOT VERIFIED.
- Verified uploaded RC40 archive hash e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e. Its migration 20260921154500 references but does not create settlement_attempts and is absent from production's applied migration ledger.
