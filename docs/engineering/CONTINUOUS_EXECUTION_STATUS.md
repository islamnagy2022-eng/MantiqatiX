# MantiqatiX Continuous Execution Status
Last updated: 2026-10-10 — RC449A journal schema prerequisite merged; production release not certified

## Release status
**NOT CERTIFIED.** Source, CI, and disposable-PostgreSQL evidence are not proof that migrations or function definitions are deployed in production.

## Latest verified continuation — RC449A financial schema prerequisite (2026-10-10)

- Main checkpoint before this documentation update: `5bcd7dff1f2fd3edbec2cb90e52c2b98085a3738`.
- PR #166 merged as `5bcd7dff1f2fd3edbec2cb90e52c2b98085a3738`, adding RC449A `20261010175000_rc449a_financial_journal_schema_prerequisites.sql`. It is ordered after RC449 (`20261010170000`) and before RC450 (`20261010180000`), because RC450's own preflight correctly rejects the live schema when these columns are absent.
- Fresh read-only production schema check found `journal_entries` lacks `entry_number`, `total_debit`, `total_credit`, `posted_at`, `updated_at`, and `reversed_by_entry_id`; `journal_entry_lines` lacks `line_number`. Existing posting, settlement, and reversal function bodies reference these fields. Counts at the time of inspection were `journal_entries=0`, `journal_lines=0`, `general_ledger_rows=0`, and `posted_entries=0`; these counts do not remove the schema dependency.
- RC449A exact-head validation on `185eee0d05bc9ec6d66004c697316f50edda4c22`: [Financial Journal Schema Prerequisites](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38066458912) passed; [Backend-only Module Boundary](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38066458875) passed, including the RC450 financial-journal integration; [Module Professionalization Validation](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38066458948), [Migration History Immutability](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38066458926), [Migration Version Uniqueness](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38066458910), [Open PR Migration Collision Guard](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38066458944), MantiGO privacy, approval-audit integration, and Pages validation also passed. The Pages deploy job was skipped; no web asset was part of this PR.
- Production migration ledger remains at RC424 version `20261008222845`. **RC447, RC448, RC449, RC449A, and RC450 are all source-only and unapplied to production.** Apply in the reviewed timestamp order only after explicit rollout approval: RC447 → RC448 → RC449 → RC449A → RC450. RC449A must precede RC450.
- No production migration, data mutation, grant/RLS/Auth change, journal post, settlement, payment, Edge Function deployment, or web deployment occurred. Release remains **NOT CERTIFIED**.

## Latest verified continuation — RC449/RC450 security hardening (2026-10-10)

- Main checkpoint before this status update: `6302b5da8828bbb5a2e4002aa9266d9ab40916c9`.
- PR #163 merged as `67ced2d0c5eb22200c552ed332ef7c0692a9fddc`, adding forward-only RC449 `20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql`. It requires an ACTIVE `SUPER_ADMIN` membership bound to `MNTY-PLATFORM` with `scope=PLATFORM` and `full_control=true` for the platform-wide MantiGO dashboard, financial report, settlement, and stale-ride expiry RPCs.
- RC449 exact-head validation on `3e958b8abc6cc3edf8d2aba1691bd92f34d1837b`: PostgreSQL 16 platform-admin integration, static module validation, Backend-only Module Boundary, migration-history immutability, migration-version uniqueness, cross-PR collision guard, MantiGO open-ride privacy, approval-action audit, and Pages validation all passed. The Pages deploy job was skipped because this was backend-only source.
- PR #164 merged as `6302b5da8828bbb5a2e4002aa9266d9ab40916c9`, adding forward-only RC450 `20261010180000_rc450_financial_journal_service_role_boundary.sql` and a hardened `financial-journal` Edge Function source. Exact-head PostgreSQL 16 financial-journal integration, static validation, Backend-only Module Boundary, Module Professionalization Validation, migration-history immutability, migration-version uniqueness, cross-PR collision guard, and related regression suites passed. Pages validation passed and deployment was skipped.
- Stale PR #159 was closed without merge; its earlier RC448 financial-journal migration was replaced by clean-main RC450 so the source migration order remains reviewable after RC449.
- Read-only production checks still show the migration ledger ends at RC424 `20261008222845`; **RC447, RC448, RC449, and RC450 are not applied to production**. Live MantiGO admin RPCs remain on the old authorization until RC449 is approved/applied. The live financial-journal RPC still denies `service_role` EXECUTE and the deployed Edge Function remains behind the RC450 source until its approved rollout.
- Read-only matrimony preflight returned `active_requests=0`, `duplicate_active_request_pairs=0`, `unlock_rows=0`, and `duplicate_unlock_request_ids=0`. RLS/FORCE RLS are enabled; authenticated still has direct request/unlock DML grants until RC448 is applied. Do not change these grants manually outside the reviewed migration.
- UI PR #158 remains open/unmerged and is intentionally gated until RC447 and RC448 are applied in order, live policy/RPC acceptance tests pass, and authenticated browser flows are verified. No production migration, Edge Function, RLS/Auth/grant, financial data, payment, or UI deployment was performed in this continuation.
- Supabase security advisor still reports one anon-executable SECURITY DEFINER function and 40 authenticated-executable SECURITY DEFINER functions, plus leaked-password protection disabled. Do not bulk-revoke these grants; triage each function and resolve Auth settings through an approved change.
- Release remains **NOT CERTIFIED**. RC424 source/ledger mismatch, Paymob Edge Function parity, RC439 checkout recovery, sandbox payment E2E, backup/restore and rollback rehearsals, and branch protection remain release gates.

## Previous checkpoint — RC448 lifecycle gate (2026-10-10 16:05 UTC)

- Current main checkpoint before this documentation update: `7c2e2efa157e330b1d4fbb738ff91df5cc59664a`.
- PR #160 was merged as `17cb67aba1b025cecf936d8c21db86b1341b92ab` after fixing the disposable integration test: the test had counted unlock rows while still running as `authenticated`, whose RLS correctly hides direct rows. The row-cardinality assertion now runs as the fixture/database owner; the RPC idempotency timestamps remain checked under the authenticated role.
- Exact-head validation on commit `4defe8966362883dc700457b7a1b1d4f0424e23b`: [RC448 PostgreSQL lifecycle integration](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38065604601) **passed**; [Module Professionalization Validation](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38065604621) **passed**; [Backend-only Module Boundary](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38065604635) **passed**; [MantiGO Open Ride Privacy Boundary](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38065604598) **passed**; [Approval Action Audit Atomicity](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38065604658) **passed**; [Migration History Immutability](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38065604655), [Migration Version Uniqueness](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38065604656), and [Open PR Migration Collision Guard](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38065604586) **passed**.
- The Pages workflow on the RC448 PR passed web validation, while its actual deploy job was skipped. No production UI or database deployment occurred as part of PR #160.
- Read-only production RC448 preflight: `active_requests=0`, `duplicate_active_request_pairs=0`, `unlock_rows=0`, `duplicate_unlock_request_ids=0`. RLS and FORCE RLS are enabled on the three matrimony tables. Existing unique indexes include `matrimony_profiles_owner_user_id_key` and `matrimony_contact_unlocks_request_id_key`. This is a clean count snapshot, not rollout approval.
- The production migration ledger remains at RC424 version `20261008222845`; **RC447–RC450 remain unapplied**. Production `authenticated` still has direct DML grants on request/unlock tables until the approved RC448 rollout; do not revoke them manually outside the migration.
- UI PR #158 remains open and unmerged. Its latest source/contract workflows passed, but its Pages workflow was cancelled; it must remain gated until RC447 and RC448 are applied in order and live policy/RPC acceptance tests pass.
- Production DB/Auth/RLS/grants, Edge Functions, user data, payments, and web assets were not changed in this continuation. Release remains **NOT CERTIFIED**.

## Latest verified continuation — 2026-10-10

- Current main checkpoint: `ac8979a17862000d545d90df90f972b8e0f2bcdc` (`docs: reconcile RC447 privacy and staged rollout status`).
- Main Pages deployment after PR #154: [workflow 38063841084](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38063841084) passed both validation and deployment; the `Verify deployed site` step succeeded. PR #154 contained no web assets, so this was a deployment of the unchanged UI.
- RC447 migration `20261010150000_rc447_matrimony_profile_privacy_boundary.sql` is now on main with PostgreSQL 16 fixture/integration tests and a rollout runbook. **It has not been applied to production.** The read-only Supabase migration ledger still ends at RC424 version `20261008222845`; RC447 is absent.
- Production privacy boundary confirmed by read-only inspection: `matrimony_profiles` has RLS and FORCE RLS enabled, `authenticated` has SELECT, `anon` does not, and the live permissive `matrimony_profiles_select` policy only excludes anonymous sessions rather than restricting rows to their owners.
- Production schema matches RC447's referenced columns; `matrimony_profiles.owner_user_id` is unique and `matrimony_requests.status` is NOT NULL. The generic `public.is_platform_admin()` helper only checks active ADMIN/SUPER_ADMIN roles without platform-scope binding, so RC447 does not trust it for verification; the trigger permits only trusted server/database roles.
- RC447 source-contract checks, migration-history/version/collision guards, and PostgreSQL 16 privacy integration passed on the backend-only PR head. This is isolated-test evidence, not production certification.
- UI PR #158 is open and intentionally unmerged; it now routes discovery and request/contact actions through RC447/RC448 RPCs. It must not be merged/published until RC447 and RC448 are approved/applied in order and the live policy/RPC acceptance tests pass.
- PR #160 is merged as `17cb67aba1b025cecf936d8c21db86b1341b92ab`. Its corrected exact-head PostgreSQL 16 lifecycle integration passed run `38065604601`; the initial failure was a test assertion that attempted to count rows under RLS as `authenticated`, not an RPC idempotency failure.
- PR #141 was closed as stale/superseded. Do not reopen it; its duplicate RC443 migration and older lifecycle integration test are replaced by the staged candidates.
- PR #153 was closed in favor of the staged rollout. Duplicate/stale PRs #129, #119, #126, #111 and stacked UI PR #155 were closed as superseded. Do not merge old alternatives.
- No production migration, RLS/Auth/grant change, customer data mutation, payment, or Edge Function deployment occurred in this continuation. Release state remains **NOT CERTIFIED**.


## Safety/actions taken
- All live Supabase queries in this execution cycle were read-only.
- No production database migrations, grants, RLS/Auth settings, financial data, payments, or payment Edge Functions were changed/deployed. The latest post-PR #154 Pages deployment was independently verified in workflow `38063841084`, including the deployed-site smoke check.
- Source/CI-only PRs #124 (cross-PR migration collision guard), #132 (canonical module aliases), and #133 (local migration-version uniqueness guard) were merged after passing CI.
- No changes were merged that apply database migrations or modify production configuration.

## Current main
- Latest main SHA at the time of this update: `c475092cb7b498ea6155a8633a6434e3cc2ba0f8` (PR #154 backend-only RC447 privacy gate).
- PR #124 was squash-merged as `cb0b0a594f64def5b55488b0229369473091f495`. Cross-PR migration collision guard is on main. CI on its PR head passed: guard run `38052383301`, Module Professionalization Validation `38052383360`, Backend-only Module Boundary `38052383327`; Pages validation passed but deploy was skipped (`38052383344`).
- PR #132 was squash-merged as `ba94b8469f7f5d1d994d70a2c26e80bb7c11a899`. It aligns canonical module flag codes to UI categories and keeps `ACCOUNTING_SERVICES` under professional services rather than MantiGO. CI on head `0de2a2c07516e2988d52ab4d1f6525f52be0ece4` passed: Module Professionalization Validation `38052923207`, Backend-only Module Boundary `38052923211`, Pages validation `38052923232`; deploy job skipped.
- PR #133 was merged as `7dd8dc4b480f69b1314e9b5b883f3146f367f146`, adding local migration-version uniqueness validation alongside the cross-PR guard. Main-commit checks passed, including `validate-migration-versions` run `38053072649`, health run `38053072662`, and Pages deploy run `38053072656`; deploy logs reported smoke verification passed.
- Main branch metadata reports branch protection disabled and no required status checks. No branch-protection write tool was available in this cycle; this remains a governance risk.

## Relevant PRs

- #154 — CLOSED, merged as `c475092cb7b498ea6155a8633a6434e3cc2ba0f8`. Adds the RC447 forward-only matrimony privacy migration, source contract, disposable PostgreSQL 16 integration tests, and rollout runbook. No web assets or production database changes were included; all required checks on the merge head passed.
- #158 — OPEN, unmerged UI release gate. Calls RC447 discovery and RC448 request/contact RPCs, adds explicit read-error handling, and keeps revealed contact details in memory only. Do not merge until both backend migrations are approved/applied in order and live acceptance tests pass.
- #160 — CLOSED, merged as `17cb67aba1b025cecf936d8c21db86b1341b92ab`; RC448 server-authoritative matrimony request/contact lifecycle. PostgreSQL 16 integration and migration guards passed on the corrected exact head. Migration remains unapplied to production.
- #156 — CLOSED without merge; superseded by expanded UI PR #158.
- #153 — CLOSED without merge; replaced by backend-only #154 and staged UI #158 to avoid deploying frontend code before its database dependency.
- #141 — CLOSED without merge; stale duplicate RC443 branch with failed PostgreSQL integration, replaced by #154, #158, and #160.
- #129, #119, #126, #111, #155 — CLOSED without merge as stale/superseded by the staged RC447/RC448 candidates.
- #84 — OPEN, unmerged. Latest observed head: `934f2fc28ec61bdfc5023479b0e796e743244eb1`. Latest Module Professionalization Validation run `38053053450` completed successfully with all 12 jobs, including payment, checkout recovery, search-path, and MantiGO platform-admin integration. Cross-PR collision guard run `38053053434` passed. This is source/isolated-test evidence only; see the live Edge Function parity audit below. Do not merge until RC424 historical migration immutability and source/production parity are resolved.
- #95 — CLOSED without merge; duplicate migration and migration-specific validator/workflow were removed from its branch. No duplicate migration is retained in the active PR set.
- #121 — CLOSED without merge as superseded by the canonical RC441 integration suite in #84.
- #122 — CLOSED without merge; superseded by #133.
- #123 — CLOSED without merge due stale-base workflow conflict; replaced by #132, now merged.
- #124 — CLOSED, merged as above.
- #125 — CLOSED without merge in favor of #124.
- #131 — CLOSED without merge; superseded by #136.
- #133 — CLOSED, merged as `7dd8dc4b480f69b1314e9b5b883f3146f367f146`; adds local migration-version uniqueness validation and its CI workflow.
- #134 — CLOSED without merge; superseded by #136.
- #135 — CLOSED, merged as `3255966463600c58fe581ac02f557f5100c8ea0f`. Migration-history immutability guard is now on main. CI on its head passed self-test and all validation workflows (`38057071404`, `38057071370`, `38057071412`, `38057071431`; Pages deploy skipped).
- #136 — CLOSED, merged as `5d3a9df1e6020b8cf1337fbc224dc9bfa34e977e`. Updated this status report after #135 merged; Module Professionalization Validation (`38057335158`), Backend-only Module Boundary (`38057335147`), and Pages validation (`38057335146`) passed; deploy was skipped on the PR.

## Migration collision remediation
- Latest main includes migration-history immutability gate #135 and migration-version uniqueness guard #133. PR #84 is stale/conflicted against current main and edits historical RC424; it must be rebuilt against current main with RC424 unchanged before review can proceed.
- Migration-history immutability is enforced by `.github/workflows/migration-history-immutability.yml` and `scripts/validate-migration-history-immutability.mjs`, merged via #135. It only allows adding new migration files; edits/deletions of existing migration files fail the PR gate.
- Migration-history immutability gate #135 is now on main. It rejects PR changes/deletions to existing migration files. Existing PR #84 was opened before this gate and its head is stale/conflicted; do not merge it. Rebase/recreate its candidate so the guard runs against the current base, restore historical RC424 exactly, and move any hardening to a new forward-only migration. Main still lacks required branch-protection checks.
- The real conflict was version `20261009170000`: RC430 subscription success webhook in #84 vs duplicate MantiGO admin migration in #95.
- The duplicate migration was removed from #95 and #95 closed without merge. No applied migration was renamed.
- The #124 guard was fixed to ignore GitHub changed-file entries with status `removed`, with a regression self-test. The guard passed on the corrected PR head and is now on main.
- Local uniqueness guard #122 still provides complementary filename checks with a fixed allowlist of exact legacy collisions.

## Live Supabase findings (read-only)
Project: `moyhiluyhjsujhwlyeuu`.

### Migration ledger/source parity
The latest rows returned for versions >= `20261008000000` are:
- `20261008125422 / rc423_convert_authenticated_guard_policies_to_restrictive`
- `20261008222845 / rc424_atomic_digital_page_payment_webhook`

The canonical source file for RC424 is `20261009010000_rc424_atomic_digital_page_payment_webhook.sql`. This source/ledger version discrepancy is unresolved. Do not rename or replay historical migrations blindly.

### Payment RPCs
- Live `process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)` has `search_path=public, pg_temp`, but the current live definition lacks the provider-order binding and replay-status guards expected by RC424/RC431 source/runbook.
- Live finalizer is the legacy four-argument `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)`; RC431 source expects a five-argument signature.
- `subscription_payment_intents` lacks `checkout_secret_ciphertext`, `checkout_secret_iv`, and `checkout_secret_key_version`; RC439 encrypted checkout recovery is not reflected in the live schema.
- These are release blockers. Reconcile the exact deployed RC424 artifact and ledger first, then plan a reviewed ordered migration chain and sandbox verification. No production change was made.

### MantiGO platform-wide RPCs
Read-only catalog checks show the following live RPCs remain `SECURITY DEFINER`, use `search_path=public`, are executable by `authenticated`, and do not call `mnty_can_platform_admin()`:
- `get_mantigo_admin_dashboard_backend`
- `get_mantigo_admin_financial_report_backend`
- `settle_mantigo_captain_backend`
- `expire_stale_mantigo_rides_backend`

RC449 is now merged in main and hardens these RPCs behind an active `MNTY-PLATFORM` membership with `SUPER_ADMIN`, `scope=PLATFORM`, and `full_control=true`. Its PostgreSQL 16 integration passed, but RC449 is not recorded in the inspected live migration ledger and has not been applied. This remains a critical release blocker.

### RLS/table ACL triage
- Supabase advisors reported one anon-executable SECURITY DEFINER function, 40 authenticated-executable SECURITY DEFINER functions, leaked-password protection disabled, and several `auth_allow_anonymous_sign_ins` labels.
- For the inspected finance/module tables, those advisor labels did not match actual `anon` policies: policies were scoped to `authenticated`, and direct `anon` SELECT/INSERT privileges were false on all inspected tables.
- `refund_transactions`, `settlement_attempts`, `settlement_transactions`, `wallet_accounts`, `wallet_transactions`, and `tenant_modules` had FORCE RLS enabled. `digital_page_payment_events` had RLS enabled, no policies, and direct SELECT/INSERT denied to anon/authenticated; this is consistent with backend-only access but must remain an explicit contract.
- Do not bulk-revoke SECURITY DEFINER grants based solely on advisor counts; review each function's intended exposure and authorization behavior.


### Live payment Edge Function parity (read-only audit, 2026-10-10)
- Deployed `paymob-webhook` (live version 8) does not contain the branch's atomic MantiGO/subscription payment RPC paths or the provider-order mismatch guards. It still has direct table writes for parts of the ledger/event/notification flow and an early return on existing events before full replay binding. The deployed source is behind the PR #84 source.
- Deployed `subscription-payment-intent` (live version 2) lacks the RC439 checkout-encryption version/key handling and encrypt/decrypt recovery helpers. This confirms encrypted checkout recovery is not deployed; do not infer more than that from the audit.
- Deployed `digital-page-payment-intent` (live version 3) still uses the legacy four-argument finalizer; the source chain expects the five-argument order-bound finalizer.
- Deployed `payment-intent` (live version 6) lacks the provider-outcome-unknown / already-initialized guards and provider-order persistence expected by the branch.
- No Edge Functions were deployed because the migration ledger, live RPC signatures, and source are not reconciled. A comment documenting these blockers was added to PR #84 (comment ID `6098132918`).

## CI evidence and limits
- RC440 search-path integration passed on #84's tested code head; it tests anon/authenticated exposure, already-hardened and service-only exclusions, grant preservation, and temporary-table shadowing.
- RC449 platform-admin integration passed on the clean-main PR #163 head, including positive platform-admin flow, tenant role denials, settlement replay/idempotency, stale-ride expiry/audit/notification, and ACL assertions.
- #84's tested head: `cffbe446630ba717bb5fd05c51ce28cd54bcd0a8`. Later head `6aec05eb58a75c6a5292caa638fe467238d0bfaf` only added read-only diagnostic SQL to `docs/runbooks/VERIFY_PAYMOB_RC424_RC431.sql`; no SQL runtime code changed after the passing tests.
- CI passes do not establish production migration application, real Paymob sandbox E2E, or payment Edge Function deployment. Main commit `7dd8dc4b480f69b1314e9b5b883f3146f367f146` did deploy the static GitHub Pages site and smoke verification passed; that does not certify payment/backend production readiness.

## Next actions, in order
1. Reconcile RC424 source/ledger mismatch and actual live function definition without renumbering or replaying history blindly.
2. Prepare one ordered, reviewable migration release for RC431/RC439/RC440/RC447/RC448/RC449/RC450 and related dependencies; validate the full pending chain on disposable PostgreSQL.
3. Run signed Paymob sandbox E2E: success/failure/replay/conflicting replay, amount/currency/order tampering, callback-before-persistence, concurrency, ambiguous provider timeout, and encrypted checkout recovery. No live payments.
4. Apply RC447–RC450 only through a separately reviewed and approved release process; then verify live RPC definitions, grants, and role-negative cases read-only.
5. Triage all SECURITY DEFINER advisor findings per function; address leaked-password protection via authorized Supabase Auth settings.
6. Continue two-user/two-tenant E2E, Auth/OTP, module source-of-truth and membership checks, finance/inventory regression, backup restore on an isolated environment, monitoring/alerts, rollback, and Android build/signing/device gates.
7. Enable main branch protection/required checks through a controlled GitHub repository settings action; main is currently unprotected.

## Fresh production recheck — read-only, 2026-10-10 14:12 UTC

- Supabase migration listing returned **283 migrations**. The latest entries include RC422 (`20261007223944`), RC423 (`20261008125422`), and RC424 (`20261008222845`); no RC425+ migration is recorded as applied.
- Deployed Edge Function inventory still reports: `paymob-webhook` v8, `payment-intent` v6, `subscription-payment-intent` v2, `digital-page-payment-intent` v3, and `mantigo-payment-intent` v3. Inventory versions are not evidence that source/production parity has been restored.
- The live `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)` is SECURITY DEFINER with `search_path=public, pg_temp`; `anon` cannot execute it, while `authenticated` can. Its body checks `auth.uid()`, but it remains the legacy four-argument finalizer and does not mention provider-order binding. Review whether authenticated EXECUTE is intended for this claim-token-bound flow; do not revoke it blindly without tracing the client/Edge call contract.
- The live digital-page payment processor remains SECURITY DEFINER with `search_path=public, pg_temp`; `anon` and `authenticated` cannot execute it directly. The inspected source/production gaps remain: provider-order binding and replay-status comparison are absent from its live body.
- A read-only policy catalog comparison found 126 public tables with at least one policy targeting `authenticated`; 71 have a restrictive policy whose expression explicitly checks the `is_anonymous` JWT claim, while 55 do not have that particular guard. **This is a triage signal, not a confirmed exposure count**: each remaining table must be evaluated against its ownership/membership predicates, direct table grants, and actual anonymous-session behavior before any policy changes.
- The Supabase security advisor still includes an Auth warning that leaked-password protection is disabled, plus `auth_allow_anonymous_sign_ins` notices for policies targeting `authenticated`. Many inspected tables have restrictive anonymous-session guards, so do not interpret every advisor notice as a proven vulnerability and do not bulk-revoke policies/grants. Confirm the Auth setting through authorized project configuration and test representative anonymous and normal-user sessions.
- The same live catalog query reconfirmed that the four platform-wide MantiGO RPCs (`get_mantigo_admin_dashboard_backend`, `get_mantigo_admin_financial_report_backend`, `settle_mantigo_captain_backend`, `expire_stale_mantigo_rides_backend`) remain SECURITY DEFINER, executable by `authenticated`, and do not call `mnty_can_platform_admin()`.
- All checks in this recheck were read-only. No production writes, migrations, grant/RLS/Auth changes, Edge Function deployments, or financial operations were performed.

## Continuation update — 2026-10-10 14:32 UTC

### Source-only merges since the previous report
- PR #128 merged as `650572eaf1ec4c7cd125e0e2b0035eb9424dab6a`: RC442 approval audit atomicity. Its disposable PostgreSQL integration passed, including direct-write revocation, atomic state/audit transition, unauthorized actor denial, duplicate resolution denial, role-conflict fail-closed behavior, and `search_path=pg_catalog`. Migration is in source only; production was not migrated.
- PR #102 merged as `3863f800720d7bd7cc68e41a559f77574bc4f52c`: MantiGO open-ride location privacy. Its RC446 disposable PostgreSQL integration passed; migration is in source only; production was not migrated.
- PR #138 merged as `412605e77446978f586dba5557603db2bb025d7d` and PR #139 merged as `44d020fa7f3dcfaae09f861d5fe9f543d0469dbc`; both are documentation-only.

### Current source-candidate coordination
- PR #127 SMM trusted-read gateway: latest head `ef2dc590cad968e270626de9e6b12d97f45f7311` passed Backend-only Module Boundary, Module Professionalization Validation (including SMM gateway contract), and web workflow validation. The Pages deploy job is skipped on a PR. **Do not merge yet**: production `smm-gateway` is still v6, so publishing the new web client before a coordinated Edge Function rollout would break SMM reads. No production Edge Function deployment was performed.
- PR #129 is now a combined candidate targeting `main`: enterprise read-error visibility + dedicated MEDICAL workspace + matrimony privacy boundary. Latest source edits reject anonymous Auth sessions in both matrimony RPCs, retain the production-style restrictive anonymous-session guard in the disposable fixture, and test anonymous raw reads, discovery, and contact denial. Source-level assertions passed in-session; latest-head CI evidence is still required before merge.
- PR #111 and #126 overlap the read-error/MEDICAL changes now being carried by #129. Keep them unmerged; close as superseded only after the combined candidate passes latest-head CI.
- PR #101 ERP server-mutation candidate was relabeled RC445 because RC442 is now used by merged approval-audit work. Its workflow was reconciled with the current main workflow to retain both the approval-audit and ERP integration jobs. Latest-head CI and mergeability still need rechecking.
- PR #87 financial-journal service-role boundary remains open; review must resolve business/branch scope binding before merge.
- PR #84 remains blocked by the immutable RC424 source/ledger mismatch and payment runtime parity. Do not merge or deploy it as-is.

### Release-candidate migration labels
Migration version prefixes remain unique; the labels are now disambiguated for the new source candidates:
- RC442 — approval audit atomicity (merged source; not applied to production).
- RC443 — matrimony privacy (PR #129; unmerged).
- RC444 — CRM business-scope RLS (PR #130; unmerged).
- RC445 — ERP service mutations (PR #101; unmerged).
- RC446 — MantiGO open-ride privacy (PR #102; merged source; not applied to production).
- RC563/RC564/RC565/RC566 remain separate candidates in their respective open PRs; review dependencies before selecting a single ordered migration batch.

### Safety boundary for this continuation
All Supabase production queries were read-only. No production migrations, table writes, grants, RLS/Auth settings, Edge Function deployments, payments, wallet changes, or financial operations were performed. Source merges and isolated PostgreSQL tests do not certify production readiness.

## Status vocabulary
- SOURCE_FIXED: source changed, not yet validated.
- CI_VERIFIED: CI passed for an exact commit.
- ISOLATED_DB_VERIFIED: disposable PostgreSQL integration passed.
- PRODUCTION_VERIFIED: production state checked after approved rollout.
- NOT VERIFIED: no adequate evidence.

## Continuation security review — 2026-10-10

### Candidate freshness and overlap
- Read-only GitHub compare found the combined matrimony/workspace candidate PR #129's branch `fix/matrimony-profile-privacy-20261010` is behind/diverged from current main (main checkpoint `e9a42941a6b99c9b67017458ab51dea612ee6ea0`); PR #129's latest observed head `738f06c733af5ee0ca0c14342a91af8ae1ecadb7` had no fresh workflow runs returned by the current check. PR #129 currently reports `mergeable=false`. Do not merge until rebuilt against current main, conflicts resolved, and latest-head CI/integration evidence passes.
- The separate older matrimony candidate PR #119 had passing source-contract and disposable-PostgreSQL runs on head `3abe4e10560e061df23c77b6d5802f731dea8d8e` (runs `38060226500`, `38060226557`, with migration guards `38060226503`, `38060226524` successful). This is not proof that PR #129's distinct combined head passes.
- PRs #111, #126, #119, and #120 were reopened as backup review candidates after a premature closure, because the consolidated replacements have not yet been proven mergeable and current-head verified. Keep overlapping candidates unmerged; select one canonical implementation per domain and reconcile migration order before release.
- PR #130's RC444 CRM migration is also a source candidate, not production state. It is stacked on the matrimony/workspace work; refresh its base and validate the final combined candidate before merge. PR #120 is a duplicate/alternate RC566 CRM candidate and remains open only as a backup.
- PR #138 and PR #139 are documented as merged documentation-only changes; their merges do not certify the production backend.

### Read-only production authorization findings
- `public.matrimony_profiles` currently has a permissive `matrimony_profiles_select` policy for authenticated non-anonymous sessions without an owner predicate. The proposed RC443 migration replaces that policy with `owner_user_id = auth.uid()`, but RC443 is not applied to production. Do not claim the matrimony privacy fix is live.
- `public.matrimony_contact_unlocks` currently grants authenticated INSERT, with a permissive policy allowing either party to create an unlock row for an `ACCEPTED_MUTUAL` request. The proposed RC443 contact RPC treats row existence as the unlock gate. If unlocking is meant to require payment or server approval, this is a bypass risk; if mutual acceptance alone is intended, document that product contract and test it explicitly. Review note added to PR #129 (comment `6098584785`).
- Live CRM policies `CRM managers view marketing leads` and `CRM managers view marketing providers` currently grant SELECT based on active role alone, without business binding. RC444 proposes business-scoped membership checks and explicit platform full-control checks; it has not been applied to production.
- PR #87 / RC564 financial-journal source currently checks active finance membership by actor + tenant and chart account tenant, but does not bind the entry's business/branch scope to the actor or account. Review comment `6098613000` blocks merge pending an explicit scope contract and cross-business/cross-branch denial tests.

### Safety boundary
- This continuation used read-only Supabase catalog/privilege queries and GitHub source/CI review only.
- No production migrations, data writes, grants, RLS/Auth settings, Edge Function deployments, payments, wallet changes, or financial operations were performed.
- The latest post-merge GitHub Pages deployment was not independently rechecked during this review; prior Pages smoke verification remains limited to its recorded commit/run.

## Follow-up verification — RC443 / RC444 candidates

### RC444 CRM business scope — PR #143
- Clean-main CRM-only PR #143 was squash-merged as `e9d44f90c80b543ce1109ad469f1b27bf77bc95f`: https://github.com/islamnagy2022-eng/MantiqatiX/pull/143
- Exact head `68c5fae13ec7e9be4154c5ed5817448f2a07d299` passed the RC444 source-contract and disposable PostgreSQL integration jobs (run `38060878977`). Migration-history immutability (`38060878837`), migration-version uniqueness (`38060878850`), cross-PR migration collision guard (`38060878832`), Module Professionalization Validation (`38060878852`), Backend-only Module Boundary (`38060878874`), and the other associated checks passed. The Pages workflow validation passed but the deploy job was skipped because this is a PR.
- PR #130 was closed as a duplicate stacked candidate because it included both RC443 and RC444, causing an avoidable migration collision. PR #120 was closed as superseded by the clean RC444-only candidate. RC444 is now in main source only; no production migration was applied.

### RC443 matrimony/workspace — PR #141
- Clean-main candidate PR #141: https://github.com/islamnagy2022-eng/MantiqatiX/pull/141. Source-contract and migration-history/uniqueness checks have passed on prior checkpoints, but the latest observed disposable PostgreSQL run failed in `matrimony_unlock_contact_backend(uuid)`: `RETURNING unlocked_at` is ambiguous with the output parameter of the same name. The safe correction is to alias the INSERT target and return `inserted_unlock.unlocked_at`. A direct SQL-file update was blocked by repository safety controls; no bypass was attempted.
- A separate prior check failed because the static validator expected an outdated medical-workspace string; that validator was updated afterward, but fresh CI on the exact newest head is still required.
- The cross-PR collision guard previously flagged duplicate RC443 files in PRs #129 and #130. #130 is now closed; #129 remains open and stale/unmergeable. Re-run the guard after reconciling #129; do not merge RC443 while the integration failure remains.
- The RC443 candidate also revokes direct authenticated writes to request/unlock tables and provides server RPCs for request creation, response, and unlock. The disposable test covers anonymous denial, raw profile owner-only reads, verified discovery, contact gating, idempotency, and self-verification denial. These are source/isolated-test checks, not production proof.

### Other reviewed authorization gates
- PR #87 financial-journal candidate: review comment `6098613000` requires explicit business/branch scope binding and negative cross-business/cross-branch tests.
- PR #101 ERP service-mutation candidate: review comment `6098667875` requires a branch-scope contract and cross-branch negative tests for order and stock-transfer operations.
- PR #129 remains open only as a stale/duplicate candidate pending reconciliation; PR #119, #111, and #126 remain unmerged backup candidates while the consolidated PR #141 has not passed its full release gate.
- No production migrations, grants, RLS/Auth settings, Edge Function deployments, payments, or financial data were changed during this continuation.

### RC443 latest failure detail
- The latest observed RC443 PostgreSQL integration failed at `matrimony_unlock_contact_backend(uuid)` with `column reference "unlocked_at" is ambiguous` in `INSERT ... RETURNING unlocked_at`. The correct source correction is to alias the inserted table and return `inserted_unlock.unlocked_at`; the direct migration-file update was blocked by repository safety checks and was not bypassed.
- The privacy source-contract validator passed after the contact-verification guard was added, but a separate enterprise workspace validator failed on an outdated MEDICAL assertion. The validator was updated in commit `437d95966adc430645eaa746d51385f1f1b35f69`; fresh CI on that exact head has not been confirmed. RC443 remains blocked.
- RC444's merge adds only the migration/test/validator source to main. It does not mean the policy is live; production migration approval, ordered batch rehearsal, and read-only post-rollout verification remain required.

## SMM trusted-read gateway — PR #145

- Clean-main PR #145 is ready for review and remains unmerged: https://github.com/islamnagy2022-eng/MantiqatiX/pull/145
- Exact head `32bfaa39b4d204f10aefa79cefc043f4b805cb8a` passed Module Professionalization Validation (`38061291329`), Backend-only Module Boundary (`38061291372`), Pages validation (`38061291362`; deploy skipped because this is a PR), MantiGO Open Ride Privacy integration (`38061291344`), and associated validation/integration jobs.
- The candidate routes SMM catalog and personal order/wallet reads through authenticated `smm-gateway` actions, rejects anonymous sessions, restricts membership-based SMM administration to active platform-scoped full-control SUPER_ADMIN, and renders an explicit unavailable state instead of falsely showing an empty catalog or zero wallet on read failure.
- PRs #127 and #113 were closed as superseded by #145. No production Edge Function was deployed. The Pages web deployment and SMM gateway deployment must be coordinated; do not enable the new UI in production until the gateway actions are deployed and smoke-tested together.
- This is CI/source verification only. It does not establish that the live SMM gateway version supports `catalog` and `my_data`.

## Selected membership / activity profile — PR #148

- Clean-main PR #148 is ready for review and remains unmerged: https://github.com/islamnagy2022-eng/MantiqatiX/pull/148
- Exact head `4226a0df6bb96d5226c0a562092a7e00101b7728` passed Module Professionalization Validation (`38061600711`), Backend-only Module Boundary (`38061600716`), Pages validation (`38061600730`; deploy skipped because this is a PR), and associated integration jobs (`38061600740`).
- The candidate no longer silently falls back to the first membership when a saved membership ID is stale; provider profile loading is bound to the selected active business, and the homepage activity label resolves only from the selected membership/business.
- PRs #99 and #103 were closed as superseded by #148. Before merge/production rollout, test switching between two businesses in a deployed staging build; CI source assertions do not replace this browser E2E gate.

### Current release boundary
- PR #143's RC444 CRM source is merged in main but has not been applied to production.
- PR #145's SMM trusted-read gateway is ready for review but unmerged; deploy the Edge Function first, smoke-test it, then deploy the web bundle under the runbook in `docs/runbooks/SMM_TRUSTED_READ_GATEWAY_ROLLOUT.md`.
- PR #141 remains blocked by the ambiguous `RETURNING unlocked_at` SQL expression in `matrimony_unlock_contact_backend(uuid)`. Repository safety controls blocked a direct migration-file update; no bypass was attempted. PR #129 remains stale/unmergeable and continues to conflict with the RC443 migration collision guard.
- No production migrations, RLS/grant/Auth changes, Edge Function deployments, wallet changes, payments, or financial mutations were performed in this continuation.

