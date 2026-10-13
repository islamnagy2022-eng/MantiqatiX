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

## P1 replay continuation — approval policy source gap
- Run 38351334323 failed at 20260927140500_remove_anonymous_sensitive_policy_access_v2.sql because approval_requests_scoped_read was not created earlier in the replay.
- Read-only live catalog confirms the policy exists with authenticated SELECT and tenant/requester/finance-role-like visibility scope; repository and RC40 archive search did not recover its creation migration.
- Added policy-only disposable fixture `supabase/tests/baselines/approval_requests_scoped_read.sql` at temporary version 20260927140499, with validator and CI exact-copy/untracked/no-data guards. No table DDL, grants, or data in this fixture.
- Candidate code head e7fcd20f5c9a125d2a99590cb56a688086ab95cb; exact-head replay NOT VERIFIED.
## SESSION-004 addendum — 2026-10-13 (append-only)

- Current head when recorded: eca81d7deded9051ed4e7cb7c271049cfb299390; session log append is commit 839d305d657f67e26df6a66dd749f60305a0cd3d. Query PR #207 again for the latest head before acting.
- Disposable replay run 38352747923 on earlier SHA 2b5ecf7257c794f38e401f34397e910f05c756c7 passed the schema baseline preflight and fixture-copy/untracked guards; Supabase startup was still in progress. Full chronological replay and latest-head CI remain NOT VERIFIED.
- Replay validator was corrected after run 38349544642: RC256 proves only the tenant_id index; the observed payment_intent_id index has no tracked creation statement and now resides in the disposable-only catalog fixture. Do not call it recovered historical DDL.
- P0 deployed/source drift: deployed paymob-webhook v8 directly reads/writes payment_provider_events, but the tracked branch source routes payment processing through atomic RPCs and now has a static regression guard against direct provider-event table operations. Read-only live ACL evidence reports service_role lacks SELECT/INSERT/UPDATE/DELETE on that table. No production function or grants were changed. A separately authorized, tested Edge Function rollout is required to align deployment with source; no live callback test was sent.
- Next exact action: inspect newest PR #207 CI for the current head; if replay reaches migration execution, diagnose the first SQL failure and repeat; if it completes, record complete replay outcome and then continue P0 webhook source/deployed parity, payment idempotency, and safe RPC tests.
- Release remains BLOCKED / NOT CERTIFIED.

## 2026-10-13 17:36 UTC — autonomous continuation checkpoint

### Current exact status
- Working branch: reconcile/rc425-458-current-main-20261011
- Current candidate head at this checkpoint: 0ede832fbe93eebfb41d390e88f7c8e7558bbf3d
- PR #207 remains open/draft/unmerged; the latest replay run triggered by the new baseline set is [#38414543916](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38414543916), queued at the last check. Do not claim replay PASS until this exact run and any successor complete.
- PR #241 (stacked on PR #218) is open/draft/unmerged. Run [#38414086540](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38414086540) passed static Paymob webhook contract checks, disposable RC425 MantiGO integration, RC428/RC429/RC430 failure/replay/terminal-state integration, and Deno type-check. The RC430 stale-row bug discovered by the integration test was corrected to persist the verified transaction ID argument.
- PR #225 remains open/draft/unmerged. SMM gateway stays intentionally fail-closed; no production SMM enablement or deployment was performed.
- Release state remains **BLOCKED / NOT CERTIFIED**.

### P0/P1 findings added this cycle
1. **SMM historical source gap:** clean replay exposed that production contains smm_wallet_transactions, smm_services, smm_orders, smm_order_events, and smm_wallets, while the historical source archive lacks their canonical table-creation DDL before policy/privilege migrations reference them. Read-only catalog queries captured columns, constraints, indexes, RLS flags and relevant existing policies.
2. **Disposable-only SMM compatibility fixtures:** added test-only baselines for smm_wallet_transactions, smm_services, smm_orders, smm_order_events, and smm_wallets. The replay workflow injects byte-identical temporary migration copies at 20260927140488–20260927140491 and 20261011009999, respectively. The historical policy/grant migrations remain in order. Fixtures contain no rows or direct grants, are explicitly labeled test-only, and are not recovered historical DDL.
3. **Replay cutoff root fix:** workflow now isolates migrations later than 20260927033924 before the pre-lockdown reset using a filesystem stash and EXIT restore trap. Run #38411737603 verified this let the replay pass the earlier smm_bootstrap_first_admin() failure and reach the next real schema gap.
4. **Paymob webhook atomicity:** candidate webhook source now delegates subscription success/failure to RC430/RC429, MantiGO state/event/notification changes to RC425, and normal payment failures to RC428; normal payment processing also binds the signed provider order ID to the stored intent before processing. The candidate is not deployed.
5. **Production authorization blocker remains:** read-only live catalog checks still show the four MantiGO global dashboard/report/settlement/expiry RPCs are SECURITY DEFINER, have search_path=public, are executable by authenticated, and lack mnty_can_platform_admin(). RC449/RC462 tests passing in disposable PostgreSQL do not imply the live functions are fixed.

### Next exact actions
1. Inspect run #38414543916. If it fails, use the first SQL error and inspect production schema through SELECT-only queries; add only a schema/policy compatibility fixture if it is strictly necessary for disposable replay and explicitly mark provenance as unrecovered.
2. Continue the complete chronological replay; do not skip or rewrite historical migrations to force a pass.
3. Review PR #241 and require its atomic payment migrations to ship together; no live provider HTTP transaction has been tested and no production deployment is authorized.
4. Preserve no-merge/no-deploy/no-production-write boundaries. Keep P0 live authorization and full replay blockers open until evidence proves closure.
