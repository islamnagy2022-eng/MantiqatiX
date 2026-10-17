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

## 2026-10-17 — consolidated RC449 → RC462 → RC565 exact-head CI PASS

- **Exact head:** `6e4a3bfc6399691dc77b726f53690841888ad08f` on PR #282, still draft/unmerged.
- **PASS:** MantiGO platform-admin workflow [38993296764](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296764). Its disposable PostgreSQL job completed the static contracts and applied the RC449 fixture, RC449 platform-scope migration, RC462 malformed-permission guard/test, RC449 behavioral integration, RC565 financial-report migration, and RC565 report integration in sequence.
- **PASS:** migration version uniqueness [38993296753](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296753), migration history immutability [38993296748](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296748), cross-PR migration collision guard [38993296745](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296745), module professionalization [38993296752](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296752), MantiGO open-ride privacy [38993296765](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296765), backend-only module boundary [38993296743](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296743), approval-action audit atomicity [38993296815](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296815), and web validation [38993296776](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296776).
- Web deploy step was **skipped**; no production deployment, database migration, function replacement, payment, settlement, or merge occurred.
- Full chronological replay remains blocked because authoritative creation DDL for `public.counter_offer_indrive_bid(uuid,uuid,numeric)` has not been located in the available migration history. No stub or bypass was introduced. Production remains at RC424; focused PostgreSQL tests passing does not certify the full release.


## 2026-10-17 — investigation of missing reverse-bidding function migration source

- Read-only production catalog query recovered `pg_get_functiondef` for `public.counter_offer_indrive_bid(uuid,uuid,numeric)`. The live definition returns `void`, is SECURITY DEFINER with `search_path = public`, checks authenticated non-anonymous context and non-negative price, and updates a bid only when the request belongs to the caller and is not completed/cancelled.
- Queried `supabase_migrations.schema_migrations` for any recorded migration statement containing `counter_offer_indrive_bid`; result was zero rows. GitHub source search likewise located only `20260927095000_revoke_unused_security_definer_execute.sql` plus docs, not a versioned creation migration.
- This improves our evidence but does not establish the original migration timestamp/order or prove the live definition is identical to the function at the historical replay point. We must not fabricate a migration source or silently bypass the revoke.
- Read-only checks only; no production schema, function, grants, data, or migration ledger were modified. Full chronological replay remains **BLOCKED / NOT CERTIFIED** pending authoritative provenance.


## 2026-10-17 — schema baseline audit and RC434 current-head comparison

- **Verified:** read-only capture workflow [38993809648](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993809648) produced a schema-only baseline from PostgreSQL 17 with 283 ledger versions through `20261008222845`; no production DDL/DML or deployment occurred.
- **Action performed:** opened Draft PR [#284](https://github.com/islamnagy2022-eng/MantiqatiX/pull/284) containing the snapshot, provenance manifest, ordered ledger versions, and a fail-closed static audit script/workflow. Static audit [38995239972](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38995239972) passed: 128/128 public tables have RLS enabled, 485 policies, and 145 parsed SECURITY DEFINER functions have explicit search_path and PUBLIC revoke statements. Related module validation/privacy/backend-boundary checks passed; deploy job skipped.
- **Important limitation:** static schema checks do not prove RLS correctness, tenant isolation, full migration replay, or production readiness. Manifest remains `PENDING_REVIEW`; no replay workflow was enabled and the PR remains draft.
- **Verified RC434 correction:** the current RC434 migration blob at PR #202 head `56dc3853be48fee413cbaf551fd350fe3f1df3ed`, PR #84 head `3150c02aa6e034dff37acb815b1ef009da6d036c`, and PR #282 head `7e5bc5d71b82af4bc748fff97cce65082d33a072` is identical, SHA `a93a0a6827de15d50632e1deec015e20dd55b405`. This corrects the earlier current-head conflict statement; it does not rule out older revisions or eliminate the need to retain the collision guard.
- **Remaining blockers:** RC425–RC432 and RC434–RC441 remain absent from main; historical creation provenance for `counter_offer_indrive_bid(uuid,uuid,numeric)` is still missing. RC434 purchase-order line limits/dependencies need chronological verification. PR #282 remains Draft/unmerged.
- **Not performed:** no production writes, migration execution, function/grant changes, payment/settlement, or deployment.
- **Next:** finish baseline manual security review; then, only after explicit approval, run full disposable forward replay and runtime tenant/payment/restore tests. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-17 — RC526 claim boundary rebuilt as a clean main-based candidate

- **Branch:** `fix/rc526-mantigo-intent-claim-20261017`, based directly on main commit `f4059890c656d53d1235ba28d97f703ab35c7299`. This isolates RC526 changes from the separate RC425–RC441 restoration candidate and makes CI evidence attributable to the payment-intent patch.
- **Implementation:** service-role-only, empty-search-path claim/finalize RPCs; Edge Function claims before calling Paymob; 15-second timeout; claim retained on uncertain provider/finalization outcomes; checkout credentials returned only after token-bound finalization.
- **Schema correction:** source migration `20261006152000_mantigo_financial_ledger_v1.sql` defines ledger ID as `text`. Corrected the older RC526 candidate's UUID argument mismatch in RPCs, grants, fixture, and concurrency test. Claim refuses non-null provider state and existing provider intent/claim.
- **Tests:** disposable PostgreSQL integration test covers privilege boundary, claim exclusivity, wrong-token rejection, finalization, metadata preservation, and a two-session `dblink` race. Static contract was evaluated in memory at 16/16 assertions; exact-head Actions/SQL runtime result still pending.
- **CI wiring:** added the validator to Pages validation and added source validation, Deno type-check, and isolated RC526 SQL integration to the existing MantiGO privacy workflow, which already exists on main.
- **Safety:** no production DDL/data changes, live Paymob requests, payments, deployments, or merges. Chronological migration replay and operator reconciliation remain blockers.


## 2026-10-17 — RC526 exact-head validation and reconciliation follow-up

- Exact-head commit `2baa75a5dee7fe84cbef18d7a862ab9fcfc2f625` passed the RC526 static contract and disposable PostgreSQL integration workflow. Logs confirm `RC526 MantiGO payment-intent concurrent claim/finalize integration: PASS`, including definitive-rejection claim release tests and the two-session concurrency race.
- The same commit's MantiGO privacy workflow passed the source contract, Deno type-check, and RC446 privacy integration. Migration version uniqueness, migration-history immutability, open-PR migration collision guard, approval-action audit atomicity, backend-only module boundary, module professionalization, and Pages validation all passed; deployment was skipped and the production gate remained BLOCKED.
- Added `docs/PAYMOB_INTENT_RECONCILIATION.md` describing safe read-only triage and the evidence/authorization required for ambiguous claims. No production mutation or live Paymob request was made.
- Remaining limits: no operator-finalization/reconciliation RPC exists yet; live Paymob E2E remains unverified; full RC425–RC441 chronological replay is still blocked by missing historical creation provenance for `public.counter_offer_indrive_bid(uuid,uuid,numeric)`. Do not merge/deploy the migration chain or certify production until those blockers are resolved.


## 2026-10-17 — RC526 disposable fixture fidelity correction

- During a second schema review, compared `supabase/tests/rc526_mantigo_payment_intent_fixture.sql` with the authoritative ledger migration `20261006152000_mantigo_financial_ledger_v1.sql`. The earlier fixture omitted production-required `captain_id`, `idempotency_key`, and matching status/amount constraints; tests had therefore not exercised the full insert contract.
- Corrected the fixture and all three test records, and added a validator assertion that protects key production constraints from being dropped again. Also made the read-only reconciliation query directly runnable through `psql -v ledger_id=...`.
- Earlier RC526 integration passed, but the stronger fixture correction still requires a fresh exact-head workflow. No production schema or data changed.


## 2026-10-17 — RC526 claim-token and checkout-secret isolation

- Security review found the MantiGO ledger's existing SELECT RLS policy allows both customer and captain reads. Storing `paymob_client_secret` and the raw claim token in ledger metadata would expose those values to the captain. This was corrected before merge: added `mantigo_payment_intent_claims` and `mantigo_payment_intent_secrets`, both RLS-enabled with no client-role grants and explicit service-role access; ledger metadata now stores only a timestamp marker. Finalize atomically writes the secret row and deletes the private claim row; release deletes the private claim row only after a definitive, non-NULL allowed status.
- Extended disposable PostgreSQL tests for table grants, token/secret metadata isolation, private claim storage, and NULL status rejection. Exact-head CI for this final hardening is pending.
- Closed duplicate Draft PR #245 in favor of canonical PR #289. The collision-guard run that started before closure failed because both PRs contained RC526; rerun is required against a fresh head after the duplicate was closed.
- No production schema/data changes, live Paymob requests, deployments, or merges.


## 2026-10-17 — RC526 audited operator recovery RPC added

- Added `reconcile_mantigo_payment_intent_backend` to address abandoned/ambiguous claim recovery. It requires authenticated identity matching `p_admin_user_id`, the central platform-admin guard, an evidence reference, and a ledger still in REQUIRED state with a private claim and no provider/secret state.
- `PROVIDER_INTENT_ABSENT` clears the claim only after evidence-backed platform-admin approval and leaves the ledger REQUIRED for safe retry. `PROVIDER_INTENT_CONFIRMED` requires provider intent/order IDs, client secret, exact amount and currency match; it atomically sets PENDING, stores the client secret in the service-only table, clears the claim, and records audit evidence. The client secret is excluded from audit fields.
- Added disposable PostgreSQL coverage for non-admin denial, confirmed absence, confirmed intent, amount mismatch, audit writes, and claim/secret isolation. The latest exact-head run on `302de16b1217b2116f511d2a74bd6e9abf07a7d5` passed RC526 PostgreSQL integration, Deno type-check, and RC446 privacy integration; all eight PR workflows completed successfully. Logs include `RC526 MantiGO payment-intent concurrent claim/finalize integration: PASS`.
- Prior exact-head commit `a37cfbfda6877a828a96118bfdb05dc3210af542` passed all eight PR workflows, including the RC526 PostgreSQL job, Deno type-check, MantiGO privacy integration, migration uniqueness/history/collision gates, approval audit atomicity, backend-only boundary, module professionalization, and Pages validation. Deployment was skipped. Current head is newer, so that evidence is not a substitute for the latest rerun.
- No production migration, live Paymob request, payment, deployment, or merge occurred. Full production release remains BLOCKED / NOT CERTIFIED.


## 2026-10-17 — RC526 Paymob response-correlation hardening

- **Finding:** the MantiGO intent function accepted a successful Paymob response based on identifier presence only; amount, currency, and merchant reference were not cross-checked against the claimed ledger.
- **Changed:** `supabase/functions/mantigo-payment-intent/index.ts` now verifies `intention_detail.amount`, normalized `intention_detail.currency`, and `special_reference` before finalization. A mismatch fails closed, preserves the claim for reconciliation, and never returns checkout credentials.
- **Regression guard:** the source-contract validator checks that the correlation validation occurs before the finalize RPC.
- **Commits:** `c7a16d64f9b130e1c71948b41e581aa8a1b5eb17` (function), `c49fa93fb14eb5eb3a98eec00645b9d64059fe06` (validator). The documentation update is on the same candidate branch.
- **Evidence:** Paymob Create Intention docs describe the response fields: https://developers.paymob.com/paymob-docs/intention-apis/create-intention.
- **CI:** exact-head Deno + RC526 workflow result remains pending/not returned; no PASS is claimed.
- **Safety:** no production mutation, real provider call, payment, merge, or deploy. Release remains BLOCKED / NOT CERTIFIED.


### Follow-up correction — Paymob response amount units (2026-10-17)

- Review of the current official Paymob Create Intention response example showed `intention_detail.amount` represented in currency units (example response amount `10` for currency `EGP`), while the request's `amount` is explicitly cents. Comparing the response value to `amountCents` would risk rejecting valid intentions.
- Corrected the candidate to compare `intention_detail.amount` to the ledger's major-unit `amount`, while retaining exact currency and `special_reference` correlation. The static validator now enforces this response-unit contract.
- Source: https://developers.paymob.com/paymob-docs/intention-apis/create-intention. The documentation sample is not a live provider test; exact-head CI and sandbox E2E remain required.
- Latest code commit: `a9400f6a5a5b5d0fb049f12825d03e2ee7b8f06e`; validator commit: `3bbb563d02bd70b35327fa847df590129c77ff71`.
- No production change or provider request. Status remains pending verification.


## 2026-10-17 — RC526 Paymob response correlation: exact-head CI verified

- **Exact PR #289 head tested:** `3d200cab3bc9eb1700f28a4754ecaf23c6147523` on `fix/rc526-mantigo-intent-claim-20261017`.
- **Finding and fix:** before finalizing a Paymob intention, the MantiGO Edge Function now requires the response's `intention_detail.amount` to equal the ledger's major-unit amount, the response currency to match, and `special_reference` to equal the ledger ID. Paymob's documented request amount is cents, while its example response represents `intention_detail.amount` in currency units; the comparison was corrected accordingly. Mismatches retain the claim for reconciliation and never return the checkout secret.
- **Regression guard:** static contract now checks the amount/currency/reference comparisons and that they run before the finalize RPC. The stale order assertion was corrected to point to the actual major-unit amount check.
- **PASS on exact head:** RC526 disposable PostgreSQL claim/finalize/release/reconciliation integration; Deno type-check; RC446 privacy integration; migration version uniqueness; migration-history immutability; open-PR migration collision guard; approval-action audit atomicity; backend-only module boundary; module professionalization validation; and Pages workflow validation.
- **Run evidence:** RC526 + Deno/RC446 workflow [39008031246](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008031246); migration version uniqueness [39008031207](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008031207); migration history immutability [39008031254](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008031254); collision guard [39008031211](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008031211); approval audit [39008031200](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008031200); backend-only boundary [39008031186](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008031186); module professionalization [39008031229](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008031229); Pages validation [39008031213](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008031213).
- Pages `validate` passed; its `deploy` job was **skipped** because this is a pull request. No deployment occurred.
- **Not verified:** live Paymob sandbox E2E, production deployment parity, chronological replay from the RC424 checkpoint, historical creation provenance for `public.counter_offer_indrive_bid(uuid,uuid,numeric)`, tenant-isolation E2E, and backup/restore rehearsal.
- **Production impact:** none. No production DDL/DML, Edge Function deploy, live provider request, payment, merge, or release occurred. PR #289 remains Draft. Overall release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-17 — RC526 final hardening and exact-head CI PASS

- **Exact tested code/validator head:** `35a9da40dcca1be0448ebe3cceb7da619bafe87e` on PR #289 branch `fix/rc526-mantigo-intent-claim-20261017`.
- Added a pre-claim precision guard: fares that cannot be represented in whole minor units (cents) are rejected with `INVALID_FARE_PRECISION` before any claim or external Paymob request. This avoids creating an external intention that could later fail the amount-correlation check.
- Tightened the static regression guard to require the exact major-unit comparison expression and explicitly reject a regression to comparing `intention_detail.amount` with `amountCents`.
- **PASS on exact tested head:** RC526 disposable PostgreSQL integration (including concurrent claim exclusivity, finalize/release, duplicate provider-intent rollback, and admin reconciliation), Deno type-check, RC446 privacy integration, migration version uniqueness, migration-history immutability, cross-PR migration collision guard, approval-action audit atomicity, backend-only module boundary, module professionalization validation, and Pages validation.
- **Run evidence:** [MantiGO RC526 + Deno/RC446](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171037); [migration version uniqueness](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171079); [migration history immutability](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171167); [collision guard](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171044); [approval audit](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171097); [backend-only boundary](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171149); [module professionalization](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171062); [Pages validation](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171088).
- Pages validation passed; deploy job was skipped because the run is a pull request. No deployment occurred. These checks validate candidate code and disposable fixtures, not live Paymob behavior or production readiness.
- **Not verified / still blocked:** live Paymob sandbox E2E; full chronological migration replay from RC424; authoritative creation provenance/version for `public.counter_offer_indrive_bid(uuid,uuid,numeric)`; tenant-isolation E2E; backup/restore rehearsal; production Edge Function parity; remaining Auth/SMM launch gates.
- **Production impact:** none. No production DDL/DML, Edge Function deployment, live provider call, payment, merge, or release. PR #289 remains Draft; release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-17 — Durable continuation and test de-duplication protocol

- **User requirement:** every test run/result inspected must be documented in repository files; avoid repeating completed tests without a reason; resolve blockers at root cause; new sessions must resume from the latest checkpoint instead of restarting.
- **Implemented on this branch:** added [`docs/CONTINUATION_PROTOCOL.md`](CONTINUATION_PROTOCOL.md), including mandatory session-start sequence, exact-SHA evidence requirements, no-repeat rules, root-cause closure criteria, safety boundaries, and a copy/paste continuation prompt.
- **Implemented on this branch:** added [`docs/TEST_EXECUTION_LEDGER.md`](TEST_EXECUTION_LEDGER.md), with the previously documented RC526 test evidence, run links, evidence limits, and stable root-cause IDs for migration provenance, Paymob sandbox E2E, tenant isolation, and backup/restore.
- **Current checkpoint before this documentation batch:** branch `fix/rc526-mantigo-intent-claim-20261017`; PR #289 Draft/unmerged; code/validator SHA `35a9da40dcca1be0448ebe3cceb7da619bafe87e` has previously observed passing code tests. A later docs-only SHA `2953e1e0fb4de8896e61ce38afbdaa811a7c33a8` had CI runs observed as successful for migration immutability, Pages validation, RC526/privacy integration, migration collision guard, backend-only boundary, migration uniqueness, module validation, and approval audit. Pages deploy was skipped for PR context.
- **Test execution in this batch:** no application/test suite was intentionally rerun; repository files and current PR-triggered workflow results were inspected. The new documentation commits may trigger CI automatically; those runs must be checked and logged separately, not assumed to have passed.
- **Production impact:** none. No production database changes, deployment, payment, merge, or release.
- **Next executable action:** verify the new documentation commit(s), inspect their Actions results once, append those exact run IDs/results to the ledger, then resume RC-BLOCKER-001 by searching authoritative historical Git/release artifacts for the missing RPC creation migration. Do not repeat the prior search blindly; record searched refs/results and expand to the next authoritative source.


- **Follow-up evidence check:** queried PR-triggered Actions for documentation checkpoint `6560d2fc7a055c12b4466c1b0a7692559c9e6f13`; the connector returned no runs. Logged as INCONCLUSIVE in `docs/TEST_EXECUTION_LEDGER.md`, not treated as a pass or as proof no workflow exists. No application tests were intentionally rerun.


## 2026-10-17 — SESSION-RESUME-VERIFY-002 — branch and test evidence reconciliation

- Re-read continuation protocol, test ledger, session log, production TODO, and project continuity on working branch `fix/rc526-mantigo-intent-claim-20261017`.
- Verified PR #289 is Draft/open/unmerged; exact head is `67ff58063d616cd077ab8ac91a82acb7f805ae32`.
- Compared tested code SHA `35a9da40dcca1be0448ebe3cceb7da619bafe87e` to current HEAD. GitHub compare returned 11 commits, and the changed-file list contains documentation only (five docs paths); prior code-test evidence was reused rather than intentionally rerunning the same tests.
- Inspected 11 exact-head Actions workflow runs; all listed validations passed. Web workflow validation passed but deployment was skipped. Exact IDs and scope limits are recorded in `docs/TEST_EXECUTION_LEDGER.md`.
- Continued RC-BLOCKER-001 search: repository code search found no authoritative creation migration; the revoke migration's sole history entry adds only the revoke; seven checked refs contain the same revoke file; the later reverse-bidding migration creates different RPCs. Original creation version remains unknown, so chronological replay remains blocked.
- **Tests intentionally executed in this session:** none. **CI results inspected:** 11 runs, each logged in the ledger. **Production actions:** none.
- **Next executable action:** search historical PR/file lists and trusted release/source artifacts for the original `counter_offer_indrive_bid(uuid,uuid,numeric)` definition; if provenance cannot be recovered, prepare a reviewed forward-only repair proposal, not a historical backfill.
- Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-17 — SESSION-RESUME-EXEC-003 — counter-offer source investigation and repair design

- Continued from the exact previous checkpoint; did not restart general audits.
- Examined PR #218, #207, #198, and #193 changed-file patches. No authoritative historical creation migration for `public.counter_offer_indrive_bid(uuid,uuid,numeric)` was found.
- Located the exact live-derived definition in PR #207 test baseline (blob `ed4270f8fbfa2881fbfd6b251161ec4cbe7fd2c7`). Its own header labels it a live snapshot, not historical DDL. This improves behavioral review evidence but does not resolve source provenance.
- Created `docs/release/COUNTER_OFFER_FORWARD_REPAIR_PROPOSAL_20261017.md` at commit `b9a8946a6b0a666775c60302d1569be522219120`. It distinguishes authentic source recovery, separately approved test-only replay baseline, and a forward-only production convergence/security change. It explicitly notes that a later migration cannot resolve the earlier revoke dependency by itself.
- Security review points recorded: preserve captured ACL; prevent unintended default PUBLIC EXECUTE; test caller/ownership/state/price checks; separately decide concurrency semantics because the current snapshot does not explicitly lock the request row.
- Inspected 11 workflow runs on prior exact HEAD `f801dcee6f8d6a808af14216520cac26df186d43`; all listed checks completed successfully, and web deploy was skipped. The proposal commit `b9a8946...` is documentation-only and was not represented as CI-verified at time of this log.
- **Tests intentionally run:** none. **Production actions:** none.
- **Next exact action:** search trusted backup/source archives for original DDL; if unrecoverable, obtain explicit approval before enabling a test-only live-derived baseline for disposable replay. Do not synthesize historical migration DDL. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-17 — SESSION-RESUME-VERIFY-003

- Verified PR #289 remains Draft/open/unmerged at exact head `74f6768eba37898ef13c66fa057ecb71ebbc3e81`. Inspected 11 exact-head CI runs; all listed validation workflows passed. Web deploy was skipped. IDs and scope are recorded in `docs/TEST_EXECUTION_LEDGER.md`.
- Located and verified the latest test-only reviewed-baseline forward replay on separate branch `test/production-baseline-forward-replay-20261017`, exact SHA `a79b2caa5b883817f5c1b550d044b09780f06820`. Run [39010395892](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010395892) passed all steps, including restoring the live-derived schema snapshot into isolated local Supabase and applying forward migrations newer than the RC424 checkpoint. Exact-run artifact exists; artifact contents were not independently read, so no migration count is asserted.
- This adds forward-replay evidence only. It does not recover historical creation DDL, prove blank-database chronological replay, or clear Paymob E2E, tenant-isolation, backup/restore, or production gates.
- No tests were intentionally rerun in this session; results were inspected and documented. No production changes, deployments, payments, merges, or releases occurred.
- **Next action:** inspect the uploaded replay artifact if supported; continue provenance recovery and independently review the baseline security findings. Keep PR #284 pending review and all release candidates Draft until required gates pass.
- Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-17 — SESSION-RESUME-VERIFY-004

- Inspected PR #286 exact head `6b87b044448b5a543b163c52d1a4517d63cf1399`; 17 automatic GitHub Actions runs (including push/PR duplicates) completed successfully. Unique payment workflows RC425 atomicity, webhook failure/success, and payment-intent order correlation passed, along with migration and security guardrails. Web validation passed and deploy was skipped. Exact links and limitations are recorded in `docs/TEST_EXECUTION_LEDGER.md`.
- These targeted integrations can be reused for this exact SHA; they are not live Paymob tests and do not prove full historical replay, tenant isolation, or restore.
- No tests were intentionally rerun; no production mutation, migration application, deployment, payment, merge, or release occurred.
- **Next:** continue resolving historical migration provenance and baseline security-review gates; then run the required tenant-isolation, Paymob Sandbox, and backup/restore gates when their isolated environments and authorized credentials are available.
- Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-17 — SESSION-RESUME-VERIFY-005

- Added a pure, reusable Paymob intention-correlation guard and replaced the inline predicate in `mantigo-payment-intent/index.ts`. It compares the expected ledger amount, normalized currency, and exact `special_reference` before finalization; mismatches preserve the claim and return the existing recovery-required error.
- Added 8 Node unit tests for valid match and mismatch/malformed-response cases, and wired them into Pages validation. Updated the source-contract validator to require helper usage before finalization.
- Ran `node --test scripts/tests/mantigo-payment-intent-correlation.test.mjs` locally in Node v22.16.0: **8/8 PASS**. This is pure-unit coverage only, not a Paymob/Supabase E2E test.
- Exact code head when checking CI: `b5880a547e5097f4adbc727b5e57b695ed32b8ba`; workflows were queued/in progress at that observation. The next session/step must inspect exact-head CI; do not claim it passed until results are complete.
- No live provider calls, production mutations, migrations, deployments, payments, merges, or releases occurred.
- **Next:** verify exact-head CI (including Pages test and Deno/type checks), then continue the release blockers: historical migration provenance, tenant isolation, Paymob Sandbox, and backup/restore. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-17 — SESSION-RESUME-EXEC-006 — exact-run replay evidence

- Inspected [run 39010395892](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010395892): PASS on exact test-only SHA `a79b2caa5b883817f5c1b550d044b09780f06820`; restored reviewed schema checkpoint `20261008222845`; applied 32 forward migrations including RC526 and RC565. Artifact ID `12092113513`, SHA-256 `265fced47505213121b69883b2e2d25e267032be746792243fd8d01949032cb4`.
- Explicit limitation: this is forward-only replay from a production schema snapshot, not empty-schema chronological replay and not historical source provenance proof.
- Full replay failure [38487272719] was a runner preflight alias collision, not SQL execution. Source and canonical migration both contain the same normalized SQL; only one collision was found among 55 aliases.
- Corrected exact-pair collision handling and enabled the recovery branch's push trigger in commits `aec8572...` and `e3bf384...`. Exact run [39010790236](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010790236) was still running at the time of this entry; next action is inspect that run and record its actual outcome before any further replay attempt.
- SMM approved test-only schema baselines exist; they do not recover the original table-creation migration. The counter-offer function fixture is likewise live-derived, not historical source.
- No production migration, grant, RLS/Auth change, Edge Function deployment, payment, merge, or release occurred.


## 2026-10-17 — SESSION-RESUME-EXEC-007 — RC339 replay failure

- Full replay run [39010790236](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010790236) failed on the first SQL error after alias normalization: missing `organizations.id='MNTY-MAIN'` during RC339 showcase seed.
- Read-only production inspection confirmed the organization row exists. The migration ledger includes applied bootstrap `20260927131555` (`bootstrap_mnty_owner_islam_nagy_v2`), but no corresponding source file/commit is in repository history.
- The authoritative applied statement contains an owner email; no public source copy was created. Recovery decision is documented in `docs/release/ORGANIZATION_BOOTSTRAP_SOURCE_GAP_20261017.md` on recovery branch commit `6b57a9d...`.
- **Next action:** obtain explicit approval for privacy-reviewed exact-source handling or a minimal test-only organization baseline, then rerun full replay once after that input changes. Do not treat the baseline-assisted forward replay PASS as a full historical replay PASS.
- Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-17 — SESSION-RESUME-EXEC-008

- Verified PR #289 code head `9f140f53075a06481ba6d3c171510cdf9f98ecf6`; later head `602e27cb28204ddb39a9f2a174e9bc772dba7642` changed docs only. Exact-head RC526 claim/finalization PostgreSQL tests, Deno type-check, RC446 privacy integration, Pages validation, Node unit tests, module validation, migration guards, approval audit, and backend-only boundary passed. Exact run links are in the test ledger; Pages deploy was skipped.
- Added a pure Paymob correlation helper and 8 Node unit tests; local result 8/8 PASS and Pages validation on the same code passed.
- Added a test-only post-replay SQL privilege contract for `counter_offer_indrive_bid`. Run [39010917548](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010917548) passed the reviewed-baseline forward replay plus this assertion in isolated local Supabase. Artifact ID `12091784983`; not independently downloaded/read.
- Additional branch/PR/commit search did not recover source for the RC339 bootstrap migration. Full chronological replay [39010790236](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010790236) failed at the missing `MNTY-MAIN` organization seed after alias normalization passed. Do not add a test-only organization seed without explicit approval; the original statement contains an owner email.
- No tests were intentionally rerun on identical code/environment; the second forward replay run was justified by the new post-replay assertion being wired into the script.
- No production changes, deployments, payments, merges, or releases occurred. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-17 — SESSION-RESUME-EXEC-009 — ledger source recovery batch

- Recovery branch commit `a474cc45a4a2a3960760482976ebb79e8c9e1eed` restores 21 missing SQL statement bodies from the read-only applied ledger and adds provenance manifest `docs/release/LEDGER_STATEMENT_RECOVERY_20261017.md`.
- Exact full replay run [39011424756](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39011424756) is running on that exact SHA. It is the required verification for the new source set; do not rerun before reading its result.
- The bootstrap source `20260927131555` is deliberately excluded due hard-coded owner email in the applied statement. No public copy of that statement was created. The organization seed blocker remains until privacy review or explicit approval for a test-only baseline.


## 2026-10-17 — SESSION-RESUME-EXEC-013 — source integrity pass and next blocker

- [x] Source-integrity workflow [39011843639](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39011843639) passed on exact SHA `badb5c37ec239c7f6caf4d1a8bd2f4f998e871f5`, validating 32 ledger-recovered SQL files by byte length and SHA-256.
- [x] Read-only inventory after 21 source recoveries found 282/283 ledger migration names match source files after alias normalization; the unmatched source is `20260927131555_bootstrap_mnty_owner_islam_nagy_v2` (excluded from public source due embedded owner email).
- [ ] Full replay remains blocked at missing `public.marketing_provider_services` during grant migration (run `39011424756`). Live schema and policy evidence is documented on recovery branch in `docs/release/MARKETING_PROVIDER_SERVICES_SOURCE_GAP_20261017.md`.
- Next action is approval for the proposed test-only table + public-active-read baseline, or a trusted original source artifact. No rerun until this replay input changes.


## 2026-10-17 — SESSION-RESUME-EXEC-014 — Paymob unit-contract evidence

- Reviewed current official [Paymob Create Intention docs](https://developers.paymob.com/paymob-docs/intention-apis/create-intention). Request amount is documented in cents; the example response has `intention_detail.amount=10` with two items of 5, while the separate request example sends 2000. This is suggestive but internally mismatched example data.
- RC526's major-unit response comparison remains fail-closed and unchanged. A real merchant sandbox E2E is still required to prove the actual response amount unit, currency, `special_reference`, identifiers, and checkout-secret behavior.
- No test rerun was performed for this documentation-only evidence update.


## 2026-10-17 — PAYMOB-CORRELATION-UNIT-001 — source fix and exact-head CI

- Reviewed the current PR #289 head and discovered the correlation helper compared Paymob's `intention_detail.amount` to major currency units even though the documented API amount convention is minor units/cents. Fixed the helper contract to use integer `amountCents`, updated the Edge Function call and static validator, and replaced the unit-test fixtures with provider minor-unit values plus mismatch/malformed cases.
- **Code SHA:** `d7fc64d0759b7eac303fc1dbcc33a2322115750e`.
- **Exact-head evidence:** web validation passed and deployment was skipped ([39012428471](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39012428471)); RC526 PostgreSQL integration, payment-intent contract validation, Deno type-check, and RC446 privacy integration passed ([39012428468](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39012428468)); migration history immutability [39012428479](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39012428479), version uniqueness [39012428338](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39012428338), cross-PR collision guard [39012428342](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39012428342), backend boundary/RC450 [39012428334](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39012428334), approval audit [39012428427](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39012428427), and module professionalization [39012428420](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39012428420) passed.
- This batch used CI evidence; no manual duplicate test run. No live Paymob sandbox call or production action was performed.
- Historical replay investigation continued: the parent of the revoke migration commit, `33d7b626c75ee649a71b6ae6d3f5303d1a47901e` (2026-09-27 09:45:09 UTC), contains only `20260927074200_harden_smm_table_api_privileges.sql` in `supabase/migrations/`; the next commit `aaae0b57db23b487c9089a74421094f268b0ab00` (09:46:28 UTC) adds only the revoke migration. This confirms there was no function-creation migration in that main-line tree immediately before the revoke; it still cannot prove whether an external/archived source exists.
- **Next actions:** wait for/obtain authorized Paymob Sandbox E2E evidence; continue only if a trusted historical source/archive is found; otherwise retain the historical-provenance blocker and do not fabricate migration DDL.
- Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-17 — HISTORICAL-SOURCE-SWEEP-003 — additional repository and ledger checks

- Swept seven accessible historical/security/MantiGO branches for migration files before the revoke migration timestamp; all contained only the same SMM table privilege migration before the revoke, with no authoritative creation DDL for `counter_offer_indrive_bid`.
- Read-only production `supabase_migrations.schema_migrations` query found applied migration version `20260927131555` / `bootstrap_mnty_owner_islam_nagy_v2`. Its stored statement seeds `MNTY-PLATFORM`, `MNTY-MAIN`, and an OWNER membership by looking up an auth user via email. It contains a hard-coded owner email and elevated platform permissions; the actual email was intentionally not copied into public files.
- This ledger record can support an authoritative source recovery review for RC339, but verbatim public restoration requires privacy review and clean replay needs the corresponding auth user. Do not substitute an invented email or mislabel a test-only adaptation as historical source.
- **Tests run:** none in this source sweep. Exact-head code CI at `d7fc...` remains recorded above. Exact docs-only head `2b816...` passed migration uniqueness [39012571053](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39012571053), migration immutability [39012571082](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39012571082), collision guard [39012571062](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39012571062), web validation with deploy skipped [39012571110](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39012571110), approval audit [39012571049](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39012571049), MantiGO privacy [39012571115](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39012571115), backend boundary [39012571054](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39012571054), and module professionalization [39012571198](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39012571198).
- Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-17 — SESSION-RESUME-EXEC-015 — exact-head check review and second replay blocker

- Verified PR #289 current head `9892d8d20f4e9b378a4dd3bb567c8590ea18d43a`, Draft/open/unmerged.
- Inspected the exact-SHA check-runs API: 22 check-run records, corresponding to the logged check/workflow evidence groups. RC526 PostgreSQL claim/finalization integration, MantiGO privacy, targeted-ads search-path, matrimony privacy, financial journal, approval audit, migration immutability, migration uniqueness, cross-PR collision, and web validation passed; web deploy was skipped. Exact run links are in `docs/TEST_EXECUTION_LEDGER.md`.
- No manual tests were run. No live Paymob sandbox request or production action occurred.
- Continued source review for `counter_offer_indrive_bid`: inspected PR #84's reachable tree and relevant MantiGO migrations; none contains authoritative creation DDL. The later reverse-bidding migration creates different RPCs.
- Identified a separate clean-replay gap: `20260928010000_rc99_g5_provider_services_rls_hardening.sql` references `public.marketing_provider_services` before any table-creation source was found in repository search. Full replay failure is [39011424756](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39011424756), exact source-recovery SHA `a474cc45a4a2a3960760482976ebb79e8c9e1eed`. Live schema docs prove current existence only, not original DDL.
- **Next action:** continue trusted source/artifact recovery for the table and counter-offer RPC. If absent, request/record explicit approval for a clearly labelled test-only replay baseline; do not fabricate historical migrations and do not rerun unchanged replay.
- Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-17 — SOURCE-SWEEP-016 — archived source check and replay-baseline proposal

- Searched all 33 archived recovered-migration SQL files on PR #218's source branch; no `counter_offer_indrive_bid` creation and no `marketing_provider_services` table creation found.
- Inspected PR #218's full changed-file pagination; no patch contains either missing creation statement.
- Verified the live-derived schema snapshot on PR #284 contains the present table definition and function definition, but its manifest remains `PENDING_REVIEW` and the snapshot does not recover historical migration order.
- Created proposal-only document `docs/release/MARKETING_PROVIDER_SERVICES_REPLAY_BASELINE_PROPOSAL_20261017.md` at commit `be9c8c298986bcd4d01df62d2609147c753f46c0`. It requires explicit approval before adding any test-only fixture; no fixture was implemented.
- Tests executed: none. Existing CI results remain as recorded. No replay rerun, production mutation, deploy, payment, merge, or release.
- Next: continue source recovery if another trusted artifact exists; otherwise wait for explicit approval for the scoped test-only baseline. Keep release blocked.


## 2026-10-17 — SESSION-RESUME-EXEC-017 — exact-head CI and broad historical source scan

- Verified PR #289 remains Draft/open/unmerged; exact HEAD `dca34e89a530e0f6c998c5f405ed9fb167e40e83`.
- Compared `9892d8d20f4e9b378a4dd3bb567c8590ea18d43...dca34e89a530e0f6c998c5f405ed9fb167e40e83`: nine commits, docs-only changes (four documentation files plus one replay-baseline proposal). No executable/test/workflow/dependency inputs changed.
- Inspected 11 exact-head Actions runs. RC526 payment-intent claim integration and MantiGO privacy passed on run [39013499658](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39013499658); migration version uniqueness, immutability, collision guard, approval audit, backend-only/finance, targeted-ads/matrimony and web validation also passed. Web deployment job was skipped. All run IDs and evidence scopes are recorded in `docs/TEST_EXECUTION_LEDGER.md`.
- No manual tests were rerun.
- Scanned all 142 migration SQL files with filename timestamp <= `20260927095000` on the accessible reconciliation branch; no source text for `counter_offer_indrive_bid` and no table-creation statement for `public.marketing_provider_services` was found. Relevant candidate files and search scope are logged in the test ledger.
- Found a similar `marketing_provider_services` definition in a **different draft PR's test-only baseline** (`supabase/tests/baselines/marketing_commission_schema.sql` on PR #218). It is live-derived/test-only, not historical source; no copying or injection was done because the current proposal requires explicit approval.
- Next: pursue new trusted source artifacts or obtain explicit approval for the exact disposable-only baseline. Do not rerun unchanged replay or invent historical DDL. No production action, deployment, payment, merge, or release.
- Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-18 — SESSION-RESUME-EXEC-018 — latest-head CI and source-provenance clarification

- Verified PR #289 exact head `15ea4fdee2b7c6dac7faea22f90162fd83445e56`; it remains Draft/open/unmerged.
- Inspected 11 exact-head/associated GitHub Actions runs. RC526 PostgreSQL claim/finalization + RC446 privacy, targeted-ads, matrimony privacy, approval audit, migration uniqueness/immutability/collision guard, backend boundary, and Pages validation passed. Pages deployment was skipped. All exact run IDs and scopes are recorded in `docs/TEST_EXECUTION_LEDGER.md`.
- Job-level verification confirmed RC526 behavioral integration ran in `39049712993`; this is CI evidence, not a live Paymob request.
- Searched Library for the original counter-offer function and owner-bootstrap SQL. A large live-schema snapshot contains the current function body but no verified original migration identity/timestamp. The applied owner-bootstrap SQL has a hard-coded owner email/elevated permissions and the matching migration file is absent from the current `main` migration directory. It remains privacy-sensitive and cannot be restored verbatim to public source without review.
- Reconciled prior replay evidence: forward replay from the live-derived schema baseline passed [39010917548](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010917548), but full chronological replay candidates failed separately at missing `MNTY-MAIN` [39010790236](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010790236) and `public.marketing_provider_services` [39011424756](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39011424756). Do not conflate baseline-assisted forward replay with clean chronological replay.
- No manual tests were rerun. No replay rerun, fixture injection, production mutation, migration application, deployment, payment, merge, or release occurred.
- **Next action:** continue trusted source recovery; if no source is available, request explicit review/approval for a narrowly scoped, clearly labelled test-only baseline/bootstrap, then run the changed disposable replay once and record the next first failure.
- Production remains **BLOCKED / NOT CERTIFIED**.


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
