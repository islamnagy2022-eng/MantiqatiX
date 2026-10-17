# MantiqatiX — Append-only Session Log

This is the chronological handoff ledger for material project decisions and execution across ChatGPT sessions. The latest state is summarized in `docs/PROJECT_CONTINUITY.md`; the open work list is `docs/MASTER_PRODUCTION_TODO.md`.

## 2026-10-11 — SESSION-001 — Establish cross-session continuity and capture release blockers

- **User requirement:** Every material thing agreed or done across sessions must be referenced in project files so a new session can resume in sequence without re-asking or repeating work.
- **Repository baseline verified:** `main` at `735f0451bf6dae9ed8cf681f83c4856a4b029041`.
- **Verified:** production gate run [38108142127](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38108142127) failed closed; release remains blocked.
- **Verified:** production migration ledger contains 283 migrations through `20261008222845` (RC424); RC425–432 and RC434–441 source files are absent from main and not applied in production.
- **Verified:** PR #202 and PR #84 disagree on RC434 migration `20261009200000_rc434_atomic_erp_purchase_receiving.sql`; collision guard must remain enabled. PR #202 has missing-script CI failures for `scripts/validate-smm-payment-safety.mjs` and `scripts/test-checkout-secret-crypto.mjs`.
- **Verified source parity:** live payment-intent v6, paymob-webhook v8, digital-page-payment-intent v3, subscription-payment-intent v2 match main/PR #202, not PR #84; erp-purchase-receive v1 matches neither PR; smm-gateway v6 matches none of the compared sources.
- **Verified:** live subscription payment flow does not use RC439 encrypted checkout recovery; required columns are not in the live table schema and RC439 is not applied.
- **Verified from live SMM source:** unsafe global-admin fallback via tenant membership roles; no explicit provider-call timeout; ambiguous provider failures can trigger automatic refund; some persistence outcomes are unchecked; status updates lack a terminal-state guard.
- **Verified advisor snapshot:** 94 mixed-severity lints; leaked-password protection disabled; SECURITY DEFINER and policy findings require scoped review, not blanket changes.
- **Action performed:** this continuity protocol and session log are being committed to the repository. Documentation is not a software fix and does not change production.
- **Not performed:** no production DDL/data mutation, no function deployment, no PR merge, no release approval.
- **Next action:** reconcile RC434 variants and the missing migration chain; fix missing CI scripts from authoritative contracts; isolated full replay; then close SMM/payment/security gaps with tests.
- **Release state:** **BLOCKED / NOT CERTIFIED**.

## Logging convention for future sessions

Append a new dated section. Never rewrite or delete historical entries; if a fact is superseded, add a later correction that links to the earlier entry and explains the new evidence. Each session entry should include user decisions, exact code/commit/PR/run references, tests/results, production impact, unresolved risks, and the next executable action.


## 2026-10-12 — SESSION-002 — Exact-head CI follow-up and safe continuation

### Verified facts
- Current candidate head before this documentation update was `95db1770bd89286bfadba9172b0c9409a68e0566` on branch `reconcile/rc425-458-current-main-20261011`; PR #207 remains open, draft, unmerged. GitHub reports mergeable, which is not production approval.
- Exact-head CI: Module Professionalization Validation [38178521555], Backend-only Module Boundary [38178521457], MantiGO Open Ride Privacy Boundary [38178521521], Approval Action Audit Atomicity [38178521525], Migration Version Uniqueness [38178521452], Migration History Immutability [38178521625], Open PR Migration Collision Guard [38178521533], and SMM Service Role Access Boundary [38178521548] completed successfully.
- Pages workflow [38178521567] passed validation; deploy job [114586045525] was skipped because this is a draft PR. No deployment occurred.
- SMM Deferred Module Validation [38178521468] failed. This remains visible and is not weakened or repaired while the owner’s SMM feature freeze is active.
- Issue [#212](https://github.com/islamnagy2022-eng/MantiqaTix/issues/212) remains open. It requires a separately approved server-side deny gate and live negative-test evidence; static UI deferral is not proof that the live gateway is disabled.
- The isolated module validation workflow had all 15 listed jobs successful, including RC434 receiving, RC437 order lines, payment binding, checkout recovery, financial journal, RC449 platform-admin scope, and RC458 branch-scope integration. These remain isolated CI evidence, not production E2E.

### Action performed
- Added a documentation checkpoint to `docs/engineering/CONTINUOUS_EXECUTION_STATUS.md` on candidate branch, commit `95db1770bd89286bfadba9172b0c9409a68e0566`, recording the exact-head results and release blockers.

### Not performed
- No PR merge, production deployment, migration application, production Edge Function change, Auth/RLS/grant change, or payment/wallet/customer-data write.
- No SMM implementation or SMM-only test changes.

### Remaining blockers / next steps
- Recover trusted historical CREATE DDL for ten legacy SECURITY DEFINER dependencies or obtain separate explicit approval for a current-definition-only test baseline in disposable replay; do not invent migrations or skip the revoke migration.
- Resolve the P0 global MantiGO authorization finding through reviewed release controls and tested candidate evidence; do not hot-edit production.
- Obtain enforced main branch protection; complete tenant/auth/payment/ERP runtime E2E, Paymob sandbox flow, and backup restore/RPO/RTO evidence.
- Keep SMM feature development frozen. Server-side containment remains a separately approved production change-control requirement before public launch.
- Release remains **BLOCKED / NOT CERTIFIED**. Re-query exact-head CI after this documentation commit before treating checks as current.

## 2026-10-12 — SESSION-003 — Internal marketing campaign workspace integration

### Verified facts
- The launch-scope internal Marketing & Advertising workspace already displayed live leads, marketing projects, advertisements, provider profiles, and services. The RC453 backend migration defines campaign and campaign-participant tables plus protected create, invite, respond, and status-transition RPCs.
- The live production migration ledger still only reconciles through RC424. Therefore RC452/RC453 candidate schema/RPC behavior must not be treated as deployed or available in production.
- SMM storefront/provider-order/wallet functionality remains frozen until after launch; this batch touched only the separate internal Marketing & Advertising workspace and its campaign backend validator.

### Actions performed
- Updated `web/app.js` on candidate branch to load campaign and participant records through existing authenticated Supabase client reads; failed/missing-table results degrade to empty lists rather than aborting the workspace.
- Added campaign creation UI calling `create_marketing_campaign_backend`, with business-scope RBAC check, objective/channel/budget/date/audience validation, unique idempotency key, and no direct browser writes to campaign tables.
- Added campaign lifecycle UI calling `update_marketing_campaign_status_backend`; transition options are constrained in the UI and authoritative state-transition checks remain server-side.
- Added partner invitation and response controls calling `invite_marketing_campaign_partner_backend` and `respond_marketing_campaign_invitation_backend`; the backend remains responsible for partner eligibility, allocation caps, actor identity, and state enforcement.
- Extended `scripts/validate-marketing-campaign-backend.mjs` with frontend contract checks and wired it into `.github/workflows/module-professionalization.yml`.
- Candidate code commits in this batch: `b904899993c8c124ec0480551f06f1652540bdb7`, `2a0c7f8dd15bb02958c07b7f9762e5e33f14e35a`, `56fa7d5e861f5a0a40e105e0e784de2544d692b8`, `e2192c8c50c77a74db534d81ae68ec9737c423a8`, `67c151f34da0f89f620e43d86be5c3d17ec6b031`, `e96520f4155a4c1607e01e3512b57796df9d2643`, `bc5e1a3f466aa20f185c6431a25bcd211f2da055`, `8ab5b7ed59328f4513f7a22f6bdf5af123736df4`, `bba4f7ade95ca448cc423beb73726fb670c5081d`.
- Latest application change at time of this entry: `bba4f7ade95ca448cc423beb73726fb670c5081d`. CI results for that exact head have not yet been verified; earlier runs on `8ab5b7ed59328f4513f7a22f6bdf5af123736df4` were queued at the last query.

### Not performed
- No production migration, Edge Function deployment, direct campaign/participant table mutation from the browser, external ad platform publishing, budget spend, financial/wallet change, PR merge, or production release.
- No claim that the marketing module or platform is fully production-certified. Existing marketing leads lifecycle/CRM depth, provider marketplace breadth, external ad publishing, analytics attribution, and live end-to-end acceptance remain open.

### Next steps
1. Verify JavaScript syntax and the new marketing workspace contract on the newest exact commit; do not infer results from earlier queued runs.
2. Add/edit campaign support only through reviewed backend RPCs and migrations if needed; avoid direct client writes.
3. Complete lead assignment/status/follow-up workflow and role-scoped reporting as a separate tested slice.
4. Keep the overall release gate **BLOCKED / NOT CERTIFIED** until migration replay, P0 authorization, live tenant/payment/ERP E2E, backup restore/RPO-RTO, Auth configuration, and branch protection evidence are resolved.


## 2026-10-12 — SESSION-002 — Historical replay blocker and live SMM containment recheck

- **Verified repository baseline:** current `main` remains `8a56358d505d2c12878440037f7f24ba65d2ea10`; work was confined to the release-remediation branch `reconcile/rc425-458-current-main-20261011`.
- **Verified migration dependency:** all 12 committed migrations before `20260919233425_production_security_hardening_v1.sql` were inspected; they create 36 tables. The hardening migration alters 21 tables; `public.bookings` is the only one without a matching create-table statement in that earlier migration set.
- **Verified live catalog metadata (read-only):** `public.bookings` currently has `id uuid NOT NULL DEFAULT gen_random_uuid()` and `created_at timestamp without time zone DEFAULT now()`, primary key, RLS, four restrictive authenticated non-anonymous policies, authenticated CRUD grants, and no direct service_role table grants in the inspected grant rows. No booking rows were queried during this metadata check.
- **Inference / limit:** current live schema/policies/grants do not reconstruct original DDL or prove historical policy/grant chronology. The RC40 archive and source search did not recover authoritative creation DDL.
- **Verified CI:** replay run [38195776127](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38195776127) failed intentionally at `Fail closed if the historical schema baseline is missing`; all bootstrap, Supabase startup, and replay steps were skipped. Targeted source/integration workflows passed on the candidate merge head, including module validation [38195776086](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38195776086), SMM deferred validation [38195776073](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38195776073), and SMM service-role boundary [38195776161](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38195776161). Pages validation passed, but its deploy job was skipped [38195776024](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38195776024).
- **Verified live SMM state:** deployed `smm-gateway` is ACTIVE v6 with JWT verification; deployed source lacks `MNTY_SMM_ENABLED` and `SMM_POST_LAUNCH_DEFERRED`. PR #214 contains candidate-only containment code; no gateway request/deployment was performed.
- **Action performed:** appended source recovery, dependency comparison, current bookings policy/grant metadata, replay outcome, and SMM containment evidence to `docs/release/MIGRATION_REPLAY_BLOCKERS.md`. Latest documentation commit: `9ddc11ab860546c86c0ebadb8a81f38cf707b68b` (workflow results for that docs-only commit not yet returned at check time).
- **Not performed:** no production database write, migration, RLS/grant/Auth change, Edge Function deployment, wallet/payment mutation, PR merge, or release approval.
- **Next action:** preserve fail-closed replay; continue trusted-source recovery for bookings; verify exact-head checks on latest branch head; keep SMM launch blocked until approved deployment and negative runtime proof. No test-only bookings baseline is authorized yet.
- **Release state:** **BLOCKED / NOT CERTIFIED**.


## 2026-10-12 — SESSION-004 — Exact-head checks and expanded historical source recovery

### Verified facts
- Exact current candidate head `65e1830e22768ce9d1b65346c1c8abd35b310d4f` now has PR-triggered CI results. Successful runs: MantiGO Open Ride Privacy Boundary [38196086985](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38196086985), Open PR Migration Collision Guard [38196087029](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38196087029), Marketing Campaign Backend [38196086981](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38196086981), SMM Service Role Access Boundary [38196087022](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38196087022), Backend-only Module Boundary [38196087172](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38196087172), Migration History Immutability [38196087094](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38196087094), Migration Version Uniqueness [38196087032](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38196087032), Approval Action Audit Atomicity [38196087243](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38196087243), Marketing CRM Tenant Scope [38196087142](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38196087142), SMM Deferred Module Validation [38196087067](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38196087067), and Module Professionalization Validation [38196087016](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38196087016).
- Pages workflow [38196087014](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38196087014) completed successfully overall, but the deployment job was skipped for the draft PR; no production/site deployment is claimed.
- Chronological migration replay [38196087005](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38196087005) failed at the intended fail-closed historical-baseline preflight. Supabase setup and replay steps were skipped. This is a correctly detected blocker, not a replay pass.
- Expanded GitHub branch, code, and commit searches for `public.bookings`, `CREATE TABLE bookings`, `bookings.sql`, schema, and baseline found no authoritative historical `CREATE TABLE public.bookings` artifact. Results surfaced application/docs references and booking-flow work, not the missing original DDL. This does not prove no external backup exists.
- `main` remains `8a56358d505d2c12878440037f7f24ba65d2ea10`; PR #207 and PR #214 remain candidate-only and unmerged.

### Actions / boundaries
- Updated this session log, continuity snapshot, and master TODO with the exact-head evidence and expanded source-search outcome.
- No production database write, migration, Edge Function deployment, PR merge, Auth/RLS/grant change, payment/wallet mutation, or release approval occurred.
- No synthetic historical DDL or disposable compatibility baseline was added.

### Next executable actions
1. Recover original `public.bookings` DDL/policy/grant history from a trusted release artifact or database backup, or obtain explicit owner approval for a separately labelled disposable-only compatibility baseline.
2. Keep chronological replay blocked until that prerequisite is resolved and then run the full timestamp-ordered replay.
3. Keep SMM storefront exposure blocked until the server-side deny gate is approved, deployed through change control, and negative runtime tests prove no order/wallet/provider side effects.
4. Continue the production release checklist only with read-only evidence or separately authorized candidate changes.
- **Release state: BLOCKED / NOT CERTIFIED.**


## 2026-10-12 — SESSION-005 — Approved bookings baseline injected into disposable replay

### Verified facts
- Candidate branch: `reconcile/rc425-458-current-main-20261011`; PR #207 remains open and unmerged. Main remains `8a56358d505d2c12878440037f7f24ba65d2ea10`.
- The owner-approved, explicitly test-only `supabase/tests/baselines/bookings.sql` is a minimal schema-only compatibility fixture sourced from read-only production catalog inspection. It is not claimed to be recovered historical DDL and must never be applied to production.
- The earlier blocker was a missing disposable fixture injection before `20260919233425_production_security_hardening_v1.sql`, not permission to invent or alter production history.

### Action performed
- Updated `.github/workflows/migration-chain-replay.yml` to inject the approved baseline only into the disposable CI migration directory as `20260919233424_test_only_approved_bookings_baseline.sql`, immediately before the historical hardening migration that first references `public.bookings`.
- Added fail-closed checks for source-file existence and destination absence, exact byte-for-byte copy comparison, untracked temporary migration verification, and exclusion from data-import checks.
- Commit: [48bcf340f901e545e547b39639c641c899ea696c](https://github.com/islamnagy2022-eng/MantiqatiX/commit/48bcf340f901e545e547b39639c641c899ea696c).

### Exact-head CI evidence
- Module Professionalization Validation [38239527689](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38239527689): SUCCESS; all 16 listed jobs completed successfully.
- Backend-only Module Boundary [38239527705](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38239527705): SUCCESS.
- Approval Action Audit Atomicity [38239527674](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38239527674): SUCCESS.
- Marketing Campaign Backend [38239527654](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38239527654): SUCCESS.
- MantiGO Open Ride Privacy Boundary [38239527647](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38239527647): SUCCESS.
- SMM Service Role Access Boundary [38239527736](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38239527736): SUCCESS.
- SMM Deferred Module Validation [38239527662](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38239527662): SUCCESS.
- Migration Version Uniqueness [38239527714](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38239527714), Migration History Immutability [38239527709](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38239527709), and Open PR Migration Collision Guard [38239527658](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38239527658): SUCCESS.
- Pages workflow [38239527732](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38239527732): validation SUCCESS; deploy job SKIPPED, so no publication is claimed.
- Disposable Migration Chain Replay [38239527707](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38239527707): still IN_PROGRESS. Historical-baseline preflight, temporary baseline injection, exact-copy/untracked/no-row checks, CLI setup and disposable config all passed. Disposable Supabase service startup is still in progress; chronological migration replay has NOT STARTED and is NOT VERIFIED.

### Not performed
- No production schema/data/migration ledger change, Edge Function deployment, Auth/RLS/grant change, wallet/payment write, PR merge, or production release.
- No claim of full migration replay success or Production Ready status.

### Next executable actions
1. Observe run 38239527707 until disposable services either start or exhaust their configured retries.
2. If startup succeeds, inspect the first actual timestamp-ordered replay result and resolve only the next evidenced blocker using authoritative source or separately approved test-only baseline; do not skip migrations or create placeholder DDL.
3. Keep the overall release gate **BLOCKED / NOT CERTIFIED** until full replay and the independent live runtime/security/payment/backup/device gates are verified.


## 2026-10-12 — SESSION-006 — Exact-head replay failure reconfirmed; SMM remains live

### Current source and PR state verified
- `main` is still at `8a56358d505d2c12878440037f7f24ba65d2ea10` in this checkpoint.
- PR #207 remains open Draft, head `7d871e19560fcce9895218f0e2f3236a974826c1`, branch `reconcile/rc425-458-current-main-20261011`.
- PR #214 remains open, head `c3c91b503b9615a07b4f8b5013775d396894cdee`; PR #175 remains open, head `ec0a4b39231e0dc52eaca69ac28dca61bce06066`.
- Exact-head run batch for PR #207: [38277095706](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38277095706) disposable migration replay **FAIL**; module professionalization, backend-only boundary, MantiGO privacy, approval audit atomicity, migration collision guard, migration history immutability, migration version uniqueness, Marketing Campaign Backend, Marketing CRM Tenant Scope, SMM service-role boundary, SMM deferred-module validation, and Pages workflow validation **PASS**. Pages deploy job was **SKIPPED**, not deployed.

### Confirmed P0/P1 blockers
- Downloaded exact replay job logs for run 38277095706. Disposable Supabase services started and timestamp-ordered replay reached `20260920155456_harden_credit_status_authorization.sql`, then failed because `public.credit_accounts` does not exist; the function also references missing `public.credit_periods`. This is a real schema/history failure, not an image-registry startup failure.
- Re-ran bounded GitHub source/commit searches for `CREATE TABLE credit_accounts`, `CREATE TABLE credit_periods`, `credit_accounts_finance_read`, and `production_credit_control`. No authoritative creation migration or policy-creation source was found in the searchable default-branch code or commit results. These are bounded negative-search results, not proof that no source exists elsewhere.
- Read-only `information_schema.columns` query against live Supabase project `moyhiluyhjsujhwlyeuu` confirms the live credit amount columns use `numeric(18,2)`; the recovered RC40 archive DDL uses `numeric(14,2)` for several amount columns. The live schema and archive also differ in defaults/policy provenance. Do not blindly inject archive DDL, synthesize credit tables, or alter applied migration history.
- Read-only Edge Function inspection confirms production `smm-gateway` is ACTIVE v8, `verify_jwt=true`, deployed-source SHA-256 `c16d88610845d8dbab5ee40f366452a40e9cc021df487d45ebcd8077199ee40f`. It does not contain `MNTY_SMM_ENABLED` or `SMM_POST_LAUNCH_DEFERRED`; issue [#212](https://github.com/islamnagy2022-eng/MantiqaTiX/issues/212) remains open. PR #214's source gate has not been deployed. Live SMM containment remains **NOT VERIFIED**.
- Supabase production migration ledger remains 283 entries through `20261008222845` / RC424. No production writes or deployments occurred.

### Action performed in this session
- Updated this append-only session log on the existing PR #207 candidate branch to preserve current evidence and prevent repeated stale checks. This documentation-only commit does not repair the migration chain or contain production.
- No PR merge, production deployment, production migration, Auth/RLS/GRANT change, secret change, wallet/payment mutation, or backup/restore operation was performed.

### Next executable actions
1. Continue historical-ref and artifact-provenance recovery for credit table creation and finance-read policy creation. If authoritative source remains unavailable, prepare a clearly labelled review proposal for an owner-approved disposable-only baseline or forward-repair design; do not implement it without approval.
2. Keep the release gate closed while the replay fails.
3. Treat live SMM containment as an independent P0: require explicit deployment approval, deploy the reviewed fail-closed gate only through change control, then perform approved negative runtime tests proving no order, wallet, database-write, or provider side effects.
4. Continue independent tenant-isolation, finance/webhook, backup/restore, and production-configuration verification without touching live financial data.

**Release status: BLOCKED / NOT CERTIFIED.**


## 2026-10-13 — Migration replay preflight diagnostics

- Reviewed failed Disposable Supabase Migration Chain Replay run [38305097937](https://github.com/islamnagy2022-eng/MantiQatiX/actions/runs/38305097937). The job failed before starting Docker/Supabase because the historical baseline for `public.credit_policies` is missing; no migration was executed.
- Improved `scripts/validate-historical-schema-baseline.mjs` to report **all** missing historical dependency baselines in one run rather than stopping at the first missing table. It remains fail-closed and preserves a distinct diagnostic for each missing dependency; no baseline is fabricated and no migration is skipped.
- Commit: `8eca1e956cd256256f79d734f4886b211f2a5336` on the open draft PR #207 branch.
- Next evidence: run the validator/CI at this exact head and record the complete missing-baseline inventory. The RC40 archive's credit-table DDL is not automatically authoritative because the live schema differs in precision/default/FK semantics and finance-read policy provenance is unresolved.
- Safety: candidate-source only; no production database, migration ledger, data, policies, grants, Edge Functions, or payments were changed. Release remains **BLOCKED / NOT CERTIFIED**.

## 2026-10-13 — SESSION-003 — Catalog-verified replay baseline and live ACL risk

### Starting state rechecked
- Repository: islamnagy2022-eng/MantiqaTix.
- PR #207: open, draft, unmerged; source head at the start of this continuation was 3e06f004cf6a575c2d88af3ce143b45750355b97. PR #218: open, draft, unmerged at 77012649e41fe22077538c39cd8593bf696ab33e.
- Main remains 8a56358d505d2c12878440037f7f24ba65d2ea10. No merge, deployment, production DDL, grants, Auth changes, RLS changes, or data writes were performed.
- The requested root-level MANTIQATIX_MASTER_TODO_2026-10-13.md did not exist; docs/MASTER_PRODUCTION_TODO.md and docs/PROJECT_CONTINUITY.md existed but had older checkpoint details.

### Actions and evidence
- Read-only Supabase catalog introspection for public.payment_provider_events recovered all 13 column definitions/defaults, PK/unique/FKs, indexes, RLS+FORCE RLS, current SELECT policy, and direct ACL metadata. No row data or payloads were queried.
- Added supabase/tests/baselines/payment_provider_events.sql as a schema-only, catalog-verified compatibility fixture. It deliberately contains no policy, grants, rows, payloads, IDs, or secrets. The historical migration 20260920211717_security_definer_surface_reduction_and_finance_rls.sql remains the source for payment_provider_events_finance_read.
- Updated scripts/validate-historical-schema-baseline.mjs to validate fixture provenance/shape/RLS/no-policy/no-grant/no-data, reject timestamp collisions, and assert the ordered policy's role contract.
- Updated .github/workflows/migration-chain-replay.yml to copy the fixture only into disposable CI as 20260920211716_test_only_live_derived_payment_provider_events_baseline.sql, then verify byte identity, untracked status, and no row imports.
- Rechecked live credit amount columns with information_schema.columns: all seven queried credit amount/generated columns have numeric_precision=18 and numeric_scale=2. Reverted the earlier incorrect candidate change to unconstrained numeric in all three credit fixtures and the validator. Current candidate assertions require numeric(18,2).
- Read-only ACL query for payment_provider_events returned relacl {postgres=arwdDxtm/postgres,authenticated=rm/postgres,service_role=Dxtm/postgres}; has_table_privilege reported no anon SELECT/INSERT, no authenticated INSERT, and no service_role SELECT/INSERT/UPDATE/DELETE. The live paymob-webhook v8 source directly selects and inserts payment_provider_events with a service-role client. This is a separate P0 production runtime concern requiring a least-privilege design and explicit authorized rollout; no production privileges were changed. Log search in the available recent window surfaced other table permission-denied errors (smm_orders, smm_services, smm_wallets, digital_page_orders/products); no claim is made that payment_provider_events itself has a logged failure.
- RC40 source archive search did not find a CREATE TABLE for payment_provider_events, so it was not treated as authoritative historical DDL.

### CI
- Latest exact-head replay after the initial fixture change was run 38348485717 and failed at the prior fail-closed preflight. New candidate changes trigger a fresh workflow; the latest queried exact-head run set before this log update was still in progress/pending (run 38349259664 for Disposable Supabase Migration Chain Replay).
- Migration History Immutability and Migration Version Uniqueness passed on the latest observed run set. Full replay remains NOT VERIFIED until the newest run completes and reaches chronological replay.

### Release and next actions
- Release status remains BLOCKED / NOT CERTIFIED.
- Inspect exact-head replay logs first. If baseline validation passes, continue through all subsequent chronological migration failures; do not assume the payment event table was the final blocker.
- Inspect the new table fixture and validator for exact live catalog parity; confirm the finance policy is created only by its ordered migration.
- Resolve the payment webhook ACL finding via source-path analysis and tests; do not apply grants or migrations to production without a separate explicit authorization.
- Continue with safe P0/P1 work while honoring the previously recorded SMM feature freeze for initial launch; do not weaken SMM tests to force green.
- No PR merge, deployment, production migration, production data write, or production privilege change occurred.

## 2026-10-13 — SESSION-004 — Continue chronological migration replay

### Exact-head evidence
- Candidate head at inspection: 6b481ca4ea8d1b8d8855871db49b2ca262ad1801 on reconcile/rc425-458-current-main-20261011.
- PR #207 is open/draft/unmerged. PR #218 is open/draft/unmerged.
- Replay run 38349796102 at earlier head 5221973aad1cb37ebd411e6d896c57732da111d3 passed the historical-baseline preflight and disposable fixture injection, started the local Supabase stack after transient Docker Hub rate limits, and advanced through payment_provider_events. It then failed at migration 20260920211717_security_definer_surface_reduction_and_finance_rls.sql with ERROR: relation "public.settlement_attempts" does not exist (SQLSTATE 42P01), specifically while creating settlement_attempts_finance_read.
- Read-only live catalog queries recovered 13 columns, the PK, amount CHECK, 3 FKs, unique (obligation_id, external_reference), idx_settlement_attempts_obligation, RLS enabled/forced, and current SELECT policy. The fixture contains schema only, no policy, grants, or data. Current ACL also denies service_role direct SELECT/INSERT and authenticated/anon SELECT/INSERT; no grants were changed.
- Added supabase/tests/baselines/settlement_attempts.sql as a catalog-derived disposable-only compatibility baseline at version 20260920211715, immediately before the existing payment_provider_events baseline at 20260920211716 and policy migration 20260920211717.
- Updated the replay workflow to inject the settlement fixture only in disposable CI, verify byte-for-byte copy, verify temporary files are untracked, and include it in the no-data-import guard.
- Updated scripts/validate-historical-schema-baseline.mjs to fail closed on fixture provenance/schema/constraint/index/RLS/no-policy/no-grant/no-data drift, timestamp collisions, and historical finance-policy contract drift.
- Exact-head workflow run set for 6b481ca4ea8d1b8d8855871db49b2ca262ad1801 is still pending/in progress as of this entry; replay run 38350384105 has not yet produced a conclusion. The previous full replay remains FAIL; the new candidate replay is NOT VERIFIED.
- No production DDL, data, privileges, Auth, RLS, deployment, merge, or financial records were changed.

### Next executable actions
1. Inspect run 38350384105 after completion; if validator fails, correct the exact assertion rather than relaxing the gate.
2. If replay proceeds, diagnose the next chronological migration error and recover its source/schema evidence; do not assume this fixture closes all replay gaps.
3. Investigate the separate live payment-webhook service_role ACL mismatch only through source analysis and disposable tests; any production privilege change requires separate explicit authorization.
4. Keep release BLOCKED / NOT CERTIFIED until full exact-head replay and all P0 gates have evidence.

### SESSION-004 follow-up — validator/CI feedback loop
- Run 38350438788 failed closed on an incorrect settlement policy regex; the regex escaping was corrected, not the policy assertion.
- Run 38350541588 passed schema validator and fixture injection, then failed in the separate verification shell with `settlement_attempts_baseline: unbound variable`. Cause: each GitHub Actions `run:` block has its own shell process; the verify step lacked declarations for the new fixture paths. Added both baseline and temporary-migration declarations in commit 9291b38976dd9348c3808c039ab4027d02042a48.
- Run 38350577917 for the code candidate before documentation-only follow-up passed validator, injection, byte-for-byte copies, untracked checks, and no-data guard; it is currently in progress at "Start disposable Supabase services without replaying migrations". Docker Hub login is skipped because credentials are not configured; an earlier run showed transient `toomanyrequests: Rate exceeded`, so stack startup remains an environment dependency, not yet a migration result.
- Current source head at the time of this log addition: 02ccd4e17ecf3862c476cafb41c41bf8a60901ea. Exact-head replay run 38350675387 is pending and must be checked after it starts.
- Independent P0 audit: deployed paymob-webhook v8 directly queries/writes five tables where service_role has no DML privileges. Evidence is in docs/release/PAYMOB_WEBHOOK_PRIVILEGE_MISMATCH_20261013.md. Existing service_role-only SECURITY DEFINER RPCs are present; do not broaden table grants as a shortcut.

## 2026-10-13 — SESSION-005 — Missing historical SMM trigger function dependency

- Replay run 38350577917 (source candidate 9291b38976dd9348c3808c039ab4027d02042a48) passed baseline preflight, all fixture injection guards, and disposable Supabase startup. Chronological replay then reached 20260927033925_harden_smm_bootstrap_trigger_execute_privilege.sql and failed exactly with: `ERROR: function public.smm_bootstrap_first_admin() does not exist (SQLSTATE 42883)`, at statement 0, the `REVOKE EXECUTE` statement.
- Read-only live pg_proc query confirms `public.smm_bootstrap_first_admin()` exists as SECURITY DEFINER, RETURNS trigger, `search_path=public`, with body that inserts into `public.smm_admins` if the table is empty; live ACL is `postgres=X/postgres`. GitHub search found no tracked earlier CREATE FUNCTION migration and the later generic function fixture does not contain this function.
- Added `supabase/tests/baselines/smm_bootstrap_first_admin.sql` as a test-only, live-derived function-definition fixture, never invoked by replay and never for production. Workflow injects it only at `20260927033924`, immediately before the historical EXECUTE lockdown migration. Added validator assertions for the exact function signature/body/security/search_path, no trigger creation, no version collision, and the subsequent revoke contract.
- This is replay compatibility scaffolding, not recovered historical DDL; it does not prove original function provenance. It does not change the initial-launch SMM feature freeze or add SMM product functionality.
- Current candidate head after this implementation: ee839091a7494300a85eb094595549f136c47ac2. Exact-head replay run 38350836940 is pending; outcome NOT VERIFIED.
- No production DDL, grants, function deployment, Auth/RLS changes, or rows were changed.

### RC40 archive cross-check
- Inspected uploaded `source_RC40.zip` locally (883 entries). The only `settlement_attempts` occurrence is the historical hardening migration `20260921154500_phase18_phase19_webhook_and_rls_hardening.sql`; it conditionally creates a restrictive session policy and creates `idx_payment_provider_events_payment_intent_id`, but does not create the table. No `smm_bootstrap_first_admin` definition exists in the archive.
- Did not import the archive migration into the candidate: it bundles several unrelated policies/indexes and requires a separate source/ledger reconciliation before reuse.

## 2026-10-13 — SESSION-006 — Registration table replay order correction

- Replay run 38350881761 at source head 6ec626662d90cad8926fc129433ae73d3aa15290 passed the SMM function baseline and its historical EXECUTE lockdown, then failed at migration 20260927065247_mnty_atomic_registration_review.sql: `ERROR: relation "public.account_registration_requests" does not exist (SQLSTATE 42P01)`.
- Root cause: the existing registration fixture was injected at 20260927074155, after the first actual dependent migration 20260927065247. The prior validator incorrectly set the first dependency to the later unique-index migration 20260927134000.
- Split the owner-approved registration compatibility fixture into two ordered pieces: schema-only `account_registration_requests_schema.sql` at disposable version 20260927065246 before the first dependent RPC; policy/grant-only `account_registration_requests.sql` at version 20260927074155 after the RPC migration. The schema fixture omits the pending unique index created by 20260927134000. No production DDL, data, policies, grants, or Auth settings changed.
- Updated the workflow to inject both fixtures only into the disposable replay, verify exact byte copies and untracked status, and keep both under the no-data-import check. Updated validator provenance, schema/security separation, policies/grants, timestamp ordering and collision checks.
- Exact-head candidate after code changes: 14cae3a824dbac5e2da85ad90d05b1c303a460b4. Replay run for that exact head has not completed yet; previous run 38350881761 is a failure on the earlier code, not a result for the new split.
- RC40 archive SHA-256 was verified locally as e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e. The archive's 20260921154500 migration references settlement_attempts but does not create it; the archive contains no smm_bootstrap_first_admin function definition. Production ledger read-only query shows 20260921154500 is not applied there, so it was not inserted into the candidate migration history.

## 2026-10-13 — SESSION-007 — Missing approval policy before ALTER POLICY migration

- Replay run 38351334323 at source head 136600157e02889b36b267dfd8632542662ceec3 passed preflight, exact-copy/untracked checks, Supabase startup, SMM function fixture, and the split registration schema/security fixtures. Chronological replay then failed in 20260927140500_remove_anonymous_sensitive_policy_access_v2.sql with `ERROR: policy "approval_requests_scoped_read" for table "approval_requests" does not exist (SQLSTATE 42704)`.
- Read-only production catalog shows `approval_requests` exists with RLS and FORCE RLS, and the policy exists as SELECT TO authenticated, scoped to the requester's active tenant membership or OWNER/ADMIN/SUPER_ADMIN/MANAGER role. Repository search found only the ALTER POLICY statement, not an earlier CREATE POLICY. RC40 archive search found no creation source for this policy.
- Added `supabase/tests/baselines/approval_requests_scoped_read.sql` as a policy-only live-catalog-derived compatibility fixture, injected at temporary version 20260927140499 immediately before the ordered ALTER POLICY migration. It contains no table DDL, grants, revokes, trigger creation, or data. Validator checks provenance, policy name/command/role/scope, absence of earlier tracked creation, version collision/order, and the dependent ALTER POLICY contract.
- Candidate code head after fixture/validator/workflow changes: e7fcd20f5c9a125d2a99590cb56a688086ab95cb. Exact-head replay is NOT VERIFIED yet. Previous run 38351334323 is a FAIL for the earlier head.
- No production schema, policy, grant, data, Auth, deployment, or merge changes occurred.
## 2026-10-13 — SESSION-004 — Replay baseline gate passed; deployed webhook drift isolated

- Current PR #207 head at this inspection: eca81d7deded9051ed4e7cb7c271049cfb299390. PR remains open/draft/unmerged. PR #218 remains open/draft/unmerged at 77012649e41fe22077538c39cd8593bf696ab33e.
- The replay run 38352747923 belongs to earlier head 2b5ecf7257c794f38e401f34397e910f05c756c7 and had passed baseline preflight plus disposable fixture injection, while disposable Supabase startup was still in progress. Do not treat this as full replay success or exact-head proof.
- Earlier replay run 38349544642 failed because validator demanded both payment_provider_events indexes be created by RC256, but the migration history only creates idx_payment_provider_events_tenant_id. The read-only catalog showed idx_payment_provider_events_payment_intent_id exists. The schema-only disposable fixture now carries the latter index; validator correctly checks RC256 for tenant index and fixture for the historical-source-gap index. This avoids inventing a tracked historical migration or modifying the policy migration.
- Added a regression to scripts/validate-finance-boundaries.mjs rejecting any direct PostgREST read/write on payment_provider_events in the tracked Paymob webhook source. The tracked source uses atomic verified RPCs for payment-event handling; the rule is intended to prevent a direct-table path from returning.
- Read-only live Supabase Edge Function inspection showed deployed paymob-webhook version 8 still directly SELECTs and INSERTs public.payment_provider_events at multiple branches, whereas the current tracked source has zero direct references to that table and uses atomic RPCs. A read-only ACL query says service_role lacks table SELECT/INSERT/UPDATE/DELETE. This is a concrete deployed-code/source drift and potential payment callback failure. No function was deployed or altered. Remediation is to validate the candidate RPC parity/idempotency in isolated tests and separately authorize a controlled Edge Function rollout; do not change production grants as a shortcut.
- The deployed callback HMAC and payment processing path was inspected without reading event rows or provider payloads. No live payment callback was sent.
- No production schema, data, grants, RLS, Auth, secrets, edge functions, deployment, or PR merge was changed.
- Release remains BLOCKED / NOT CERTIFIED. Next: check current exact-head CI; capture the next replay SQL failure if present; verify RPC migration signatures and tests in parallel.

## 2026-10-13 — SESSION-003 — Refresh release TODO; S06 concurrency and SMM ACL evidence

### Verified source/CI work
- S06 concurrency candidate [PR #237](https://github.com/islamnagy2022-eng/MantiqatiX/pull/237) adds a disposable PostgreSQL two-session duplicate Paymob callback regression. Exact-head [run 38402862801](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38402862801) passed; log includes `S06 payment-integrity adversarial regressions: PASS` and `S06 concurrent payment callback idempotency: PASS`. Exactly one request returned `idempotent=false`, one `idempotent=true`, and the test asserted one successful event plus PAID order state.
- SMM RC524 least-privilege candidate [PR #236](https://github.com/islamnagy2022-eng/MantiqatiX/pull/236) passed its disposable PostgreSQL integration in [run 38400557008](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38400557008) and follow-up [run 38400580077](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38400580077). This validates candidate SQL only; it was not applied to production.
- PR #207 candidate exact head `bcc0f646304a20b3188e7bc45323b25b3e134162` passed targeted migration uniqueness/immutability, module boundary, SMM deferred/service-role, marketing/CRM, Paymob target lookup, approval audit atomicity, and module professionalization workflows. Pages validation succeeded but its deploy job was skipped.
- Latest disposable migration replay [run 38356679251](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38356679251) failed; the historical source/replay chain is still not clean. Do not treat targeted green CI as a full release pass.
- Read-only live catalog inspection of `public.marketing_project_participants` confirmed columns, constraints, RLS/FORCE RLS, policies, and grants. This is current-state evidence only and does not recover canonical creation DDL. [PR #235](https://github.com/islamnagy2022-eng/MantiqatiX/pull/235) adds a fail-closed preflight without guessed SQL.
- Live SMM service-role TRUNCATE privileges remain a production finding; candidate RC524 does not alter live ACLs. The SMM gateway remains deferred and no production change was made.

### TODO and release decision
- Updated `docs/MASTER_PRODUCTION_TODO.md` with exact run/PR references, current P0/P1 blockers, and the next executable sequence. This is an append-only update; prior status history is retained.
- No production DDL/data/ACL/Auth change, Edge Function deployment, financial test transaction, PR merge, or release approval was performed.
- **Release remains BLOCKED / NOT CERTIFIED.**

### Next action
1. Retrieve the exact failing SQL and earliest missing dependency from run 38356679251; append evidence to `docs/release/MIGRATION_REPLAY_BLOCKERS.md`.
2. Recover authoritative DDL/history or request narrow approval for a documented disposable-only baseline. Never infer schema/function definitions or skip the historical migration.
3. Continue isolated S06 conflict/mismatch/terminal-state tests; do not use real Paymob transactions without separate approval.
4. Preserve SMM feature freeze; test the deployed API's deferred/deny behavior read-only and do not deploy.
5. Re-run exact-head checks and full replay after source provenance is resolved.


### Follow-up verification — S06 conflicting-event race and live advisor
- Exact-head [S06 run 38403871421](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38403871421) passed the added conflicting-status concurrency test. It races `SUCCEEDED` and `FAILED` for one external event ID; exactly one wins, the other raises `DIGITAL_PAGE_EVENT_REPLAY_STATUS_MISMATCH`, and the stored order/event remain consistent.
- Fresh read-only Security Advisor snapshot at `2026-10-13T13:18:40.718Z`: 94 lint records / 133 counted findings — 90 anonymous-policy warnings, 40 authenticated-executable SECURITY DEFINER functions, one anon-executable SECURITY DEFINER function, one leaked-password-protection warning, and one RLS-enabled/no-policy INFO finding. These are triage findings, not 133 confirmed vulnerabilities. No blanket revocations or Auth settings were changed.
- TODO register updated with this evidence. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-17 — SESSION-RESUME-EXEC-004 — replay normalization root-cause fix

- Inspected failed run [38487272719](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38487272719), exact head `c8b6a925bcfbb8b4a50a30ba6282d0eea95667a6`. Failure occurred before Supabase replay: canonical target collision for duplicate job-application-index cleanup migration.
- Verified both tracked files exist and their SQL bodies match after removing full-line comments and whitespace normalization. The alias source is not part of the observed live ledger; the canonical target is.
- Changed only the disposable replay workflow logic to tolerate this single exact alias pair when normalized SQL bodies match; it removes the duplicate only in the runner. All other collisions remain fail-closed. This is not a production migration or source-history rewrite.
- New exact-head replay is justified because the workflow implementation changed. Record the resulting run once; do not rerun it absent code/workflow/environment change or a documented failure reason.
- Separate PASS evidence [run 39010395892](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010395892): reviewed schema snapshot checkpoint `20261008222845`, 32 forward migrations applied including RC526. This does not prove full chronological replay or recover missing historical creation DDL.
- SMM historical source remains unresolved; approved SMM provider/credentials snapshots are test-only replay aids, not recovered original migration files. Production remains untouched and release blocked.


## 2026-10-17 — SESSION-RESUME-EXEC-005 — make the replay fix executable in CI

- After commit `aec857203a67049d61b6473aec06c6cea84bf893`, queried Actions for the exact SHA and the PR branch; no new replay run was scheduled.
- Root cause of missing CI trigger: the workflow file exists only on the recovery PR branch, while its push filter only includes `main`. Added this exact test branch to the push allowlist to ensure the updated disposable-only replay workflow is exercised.
- The next run on the resulting SHA is the required verification for the alias-collision fix. No previous PASS is being rerun; this test is required because the workflow changed.


## 2026-10-17 — SESSION-RESUME-EXEC-007 — RC339 organization bootstrap source gap

- Exact run [39010790236](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010790236) completed **FAIL** after the alias-normalization fix succeeded. The first SQL failure is RC339 showcase seeding: FK `businesses_organization_id_fkey`, missing `organizations.id='MNTY-MAIN'`.
- Read-only Supabase query confirmed the organization exists in production with tenant `MNTY-PLATFORM`, name `MNTY Main Organization`, code `MNTY-ORG`, status `ACTIVE`. Ledger row `20260927131555 / bootstrap_mnty_owner_islam_nagy_v2` exists (one statement, 1,286 chars, MD5 `6eec2cb0d371be273949a444f6dc8272`) but the expected migration source has no Git history.
- The ledger SQL contains an owner email; do not copy the unredacted statement into the public repository without privacy review. Design proposal: `docs/release/ORGANIZATION_BOOTSTRAP_SOURCE_GAP_20261017.md`.
- No organization fixture was added because explicit approval for a new test-only data baseline is not established. Next action is privacy/replay-path approval, then implement and rerun only because the replay input changed.
- No production writes or deployment occurred. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-17 — SESSION-RESUME-EXEC-008 — recover missing ledger SQL sources

- Read-only inventory compared all 283 applied ledger versions against recovery-branch migrations after the 55 alias mappings. It identified 22 source-name gaps; four are already represented by alias-normalized files, leaving 22 gaps including the privacy-sensitive owner bootstrap.
- Retrieved the exact applied SQL bodies for 21 non-bootstrap gaps from `supabase_migrations.schema_migrations.statements[1]`. Automated screening found no literal email, Egyptian phone, or common key/token pattern in those statements. Version/name/length/MD5 evidence is in `docs/release/LEDGER_STATEMENT_RECOVERY_20261017.md`.
- Restored those 21 SQL bodies as canonical versioned migration source files. The owner bootstrap `20260927131555` remains excluded because its applied SQL embeds an owner email; see `docs/release/ORGANIZATION_BOOTSTRAP_SOURCE_GAP_20261017.md`.
- These source additions change replay inputs, so one new exact-head disposable replay is justified. Do not rerun unrelated PASS suites. The first failure may move earlier because previously omitted ledger migrations are now present.
- No production changes occurred.


## 2026-10-17 — SESSION-RESUME-EXEC-010 — marketing provider services source gap

- Full replay [39011424756](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39011424756) failed at `20260927132904` with SQLSTATE `42P01`: `public.marketing_provider_services` is absent in the empty replay DB.
- Read-only production inspection confirms the live table shape, constraints, owner, RLS/FORCE RLS and policies. The reviewed production schema snapshot contains its DDL, but no tracked table-creation source or applied-ledger create statement was found. The active public SELECT policy also has no ledger creation statement.
- Added `docs/release/MARKETING_PROVIDER_SERVICES_SOURCE_GAP_20261017.md` describing the evidence and a minimal test-only compatibility baseline proposal. No SQL fixture/injection was added because owner approval for this new baseline is not established.
- Next action: approve the precise test-only baseline scope or provide trusted original source; then implement and run full replay once. No rerun without changed inputs.


## 2026-10-17 — SESSION-RESUME-EXEC-011 — source recovery integrity gate

- Extended `docs/release/LEDGER_RECOVERED_MIGRATION_SOURCE_MANIFEST.json` from 11 to 32 exact ledger statement records, adding byte lengths and SHA-256 hashes for the 21 sources restored at `a474cc45...`.
- Updated `scripts/validate-ledger-recovered-migrations.mjs` to assert all 32 entries and verify file byte lengths, SHA-256, and secret patterns. The script is invoked by the disposable replay workflow; this updated 32-entry assertion has not yet been CI-verified because the latest replay is blocked at the missing `marketing_provider_services` relation.
- Full replay run `39011424756` failed at the grant migration due missing table. The source gap and proposed table+public-read test baseline are documented in `docs/release/MARKETING_PROVIDER_SERVICES_SOURCE_GAP_20261017.md`.
- Do not rerun full replay until the baseline/source decision is approved and replay inputs change. Production remains untouched.


## 2026-10-17 — SESSION-RESUME-EXEC-012 — isolated source-integrity CI gate

- Added `.github/workflows/ledger-source-integrity.yml`, a lightweight CI gate that runs only `scripts/validate-ledger-recovered-migrations.mjs` on changes to migration sources, the 32-entry manifest, or the validator.
- This gate is separate from the full replay, so the source hash/byte validator can be verified without rerunning a full migration chain that is currently blocked at the missing `marketing_provider_services` table.
- The first run on the exact workflow commit is pending; do not mark the 32-entry manifest validated until that run passes.


## 2026-10-17 — SESSION-RESUME-EXEC-013 — source-integrity validator PASS

- New lightweight workflow [run 39011843639](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39011843639), exact SHA `badb5c37ec239c7f6caf4d1a8bd2f4f998e871f5`, completed **SUCCESS**.
- Step `Validate recovered SQL statement bytes and hashes` passed against the expanded 32-entry ledger-recovered migration manifest. This verifies file byte lengths, SHA-256 hashes, unique versions, and the validator's embedded-secret guard for the 32 manifest entries.
- This does not resolve the full replay blocker. Full replay [39011424756](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39011424756) remains **FAIL** at the missing `public.marketing_provider_services` relation.
- No replay was rerun; the integrity workflow is separate and lightweight.


## 2026-10-17 — SESSION-RESUME-EXEC-015 — bundled baseline decision

- To avoid one replay per known blocker, drafted `docs/release/COMBINED_REPLAY_BASELINE_APPROVAL_20261017.md` with two minimal test-only fixtures: (A) the live-derived `marketing_provider_services` table plus its existing public-active SELECT policy, and (B) the `MNTY-MAIN` organization row without any Auth user or membership.
- The proposal includes exact candidate SQL, injection order, and fail-closed controls. It is not implemented or injected because explicit approval is still needed.
- If approved, add both fixtures and validator together, then run the full disposable replay once. Keep source-provenance blockers open even if replay passes.


## 2026-10-17 — REPLAY-ORDER-001 — fix the actual first-consumer ordering defect

- Reviewed failed replay [39011424756](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39011424756) job log. The exact first failure was SQLSTATE 42P01 in 20260927132904_restore_marketing_catalog_grants_and_owner_profile_access.sql when it granted SELECT on missing public.marketing_provider_services.
- Root cause: the existing disposable-only marketing_commission_schema.sql fixture was injected as temporary migration 20260927140494, which is later than the first consumer 20260927132904. The table fixture itself already existed and had the live-derived schema/constraints/policies; the problem was its temporary timestamp.
- Updated .github/workflows/migration-chain-replay.yml to use temporary version 20260927132903; updated scripts/validate-historical-schema-baseline.mjs to assert prerequisite and first-consumer ordering; corrected fixture header. No historical migration SQL was changed.
- Exact-head replay [39070471838](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39070471838) on 8b4dfda8ea8d1632786caad49b13b745b137a0e6 was pending/in progress when logged; awaiting its final outcome. Intermediate runs were cancelled after subsequent commits and are not passes.
- Test policy: prior failure was inspected, not rerun. The fixed replay is a new test execution because the workflow/validator ordering inputs changed. No other manual tests were intentionally rerun.
- Next: read exact-head run result/log; if it fails, capture the next first error and fix only that root cause. If it passes, record the new scope and keep historical provenance/production gate blockers open.


### Validator correction — 2026-10-17

- During code review of the first ordering fix, caught a validator design mistake before treating CI as passing: the validator runs **before** the workflow injects temporary migrations, so looking up the provider-profile baseline in the already-loaded migration list would always return absent.
- Corrected the validator to compare the known temporary baseline version directly against the prerequisite version constant 20260927074156. The existing earlier check validates the provider-profile baseline file itself. First-consumer ordering remains asserted against committed migration 20260927132904.
- Correction commit: d1eff709f01927f30a676f9bd96d20ae122f7837. A new exact-head workflow result is required because validator code changed. No manual test rerun was performed.
- At time of this note, replay runs for prior intermediate commits were queued/in progress; none is a pass for the corrected validator. The final exact-head replay must be identified by its own SHA and logged after completion.


## 2026-10-17 — REPLAY-ORDER-002 — duplicate policy candidate correction

- Exact replay at d1eff709f01927f30a676f9bd96d20ae122f7837 failed at 20260928184000_rc199_customer_cross_tenant_order_visibility.sql with SQLSTATE 42710 because order_status_history_customer_select_own already existed.
- Prior migration 20260928154411 creates the same policy; production version capture run 38993809648 records 20260928154411 but not 20260928184000. It records applied version 20260928154527 without a matching source file found in repository search. Do not claim 20260928184000 recovers 20260928154527.
- Made the unapplied candidate idempotent with fail-closed contract checks for both same-name policies; matching policy is reused, absent policy is created, mismatch raises. SELECT grants remain unchanged.
- Added a one-file immutability exception tied to original blob SHA and the exact read-only production version-list hash; manifest remains PENDING_REVIEW and deployment_approved=false.
- Latest candidate SHA cc9bb07ac7e325841a0f85d601f34cd6a41e33b0 has source-integrity CI PASS [39071093548]. Full replay [39071093587] was pending. Intermediate replay [39071044418] is pre-final and not final evidence.
- Next: inspect exact-head replay and migration immutability workflow. Keep production gate blocked; missing source for applied version 20260928154527 remains unresolved.


## 2026-10-17 — REPLAY-ORDER-003 — schema-only replay needs a synthetic tenant row

- Run 39071093587 at SHA cc9bb07ac7e325841a0f85d601f34cd6a41e33b0 failed at 20260929073244_seed_mnty_berket_test_business.sql with SQLSTATE 23503 because tenant_id MNTY-PLATFORM was not seeded in the disposable database.
- Root cause: schema-only production snapshot excludes rows, but the applied test-business seed assumes the platform tenant row exists.
- Added deterministic idempotent test-only fixture supabase/tests/baselines/mnty_platform_tenant_seed.sql and inject it as untracked temporary migration 20260929073243 immediately before the first consumer. Validator enforces exactly one synthetic public.tenants INSERT and dependency/timestamp order. No applied migration was edited for this issue.
- Replay [39071511736](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39071511736) at code SHA 1b6fc8f297d187fe070db61de90d1770d0307090 passed exact-copy/untracked verification and was starting disposable Supabase services at the last check. Await final outcome.


## 2026-10-17 — REPLAY-ORDER-004 — synthetic owner identity for disposable RC339 replay

- Run 39071819477 at SHA da37e151f3c0c0a284b88d5205aa4c41f46b73e2 failed at 20261004005819_rc339_seed_mantiqati_official_showcase.sql with SQLSTATE 23503: fixed showcase owner UUID missing from public.users, whose FK points to auth.users.
- Added disposable-only fixture mnty_showcase_owner_user_seed.sql. It creates only the fixed source UUID as a synthetic auth row with invalid.example email, empty password hash/no tokens, and a public.users profile. Injected at temporary version 20261004005817, after platform tenant seed and before organization seed 05818 and RC339 consumer 05819.
- Validator and workflow checks passed for fixture shape/copy/untracked status in run 39072088344. That full replay was still starting Supabase services at the last check.
- Migration immutability workflow [39071889905](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39071889905) passed and confirmed the narrowly scoped unapplied RC199 correction exception. Applied source version 20260928154527 remains unresolved.


## 2026-10-17 — REPLAY-ORDER-005 — fix RC215 signup ordering defect

- Run 39072088344 at SHA 31a005c3fbffe4744f9fe5c30fdc8140a472aefd failed during the disposable synthetic auth-user insert: RC215 trigger attempted to insert a CUSTOMER membership before public.users existed (FK user_memberships_user_id_fkey).
- Source confirmed root cause in 20260930100000_rc215_customer_membership_invariant.sql: the auth.users AFTER INSERT trigger calls ensure_customer_membership_for_user without first creating the public.users profile.
- Added forward-only migration 20261018010000_auth_user_profile_before_customer_membership.sql: create profile if absent, then ensure membership. Added a transaction-rolled-back behavioral test for a fresh auth user.
- Updated the test-only historical showcase owner fixture to suppress only the legacy trigger during fixture setup, restore it, and call the membership helper explicitly. Disposable-only; no production user or schema changed.
- Exact-head source integrity [39072447513] and migration immutability [39072447500] passed. Full replay [39072447514] was in progress on SHA be3cf19573595f037357c89db719c37c065755c1.
