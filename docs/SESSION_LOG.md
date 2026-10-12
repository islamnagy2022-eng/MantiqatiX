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


## 2026-10-12 — SESSION-002 — P0 SMM deferral hardening (candidate branch only)

- **Decision basis:** issue #212 states that the separate SMM storefront, provider ordering, wallet/refunds, and provider administration are deferred until after initial core launch. The internal Marketing & Advertising module remains in scope.
- **Branch:** `fix/p0-defer-smm-before-core-launch-20261012`, based on `8a56358d505d2c12878440037f7f24ba65d2ea10`.
- **Implemented:** `supabase/functions/smm-gateway/index.ts` now rejects all non-OPTIONS requests with `SMM_DEFERRED`/503 unless `MNTY_SMM_ENABLED` is exactly `true`, before user authentication or any action routing.
- **Implemented:** `web/smm.html` is now a static holding page with no `smm.js`, Supabase browser SDK, or config script. `web/app.js` no longer embeds the SMM storefront; desktop/mobile navigation labels SMM as coming soon; internal Marketing & Advertising remains.
- **Testing:** `scripts/validate-smm-deferred-gate.mjs` added to the Pages workflow. Validator passed against current source; `web/home.js` and `web/app.js` parse checks passed. CI on the final candidate commit is still required.
- **Production impact:** none. No live Edge Function deploy, environment setting change, merge, database migration, provider call, or wallet transaction. The live production SMM gateway has NOT been verified disabled; issue #212 stays OPEN until deployment and negative tests are explicitly authorized and completed.
- **Release state:** BLOCKED / NOT CERTIFIED. Do not merge/deploy without release approval and required gates. Do not set `MNTY_SMM_ENABLED=true` for the initial launch.
- **Next action:** run CI on the completed candidate branch, inspect the exact run results, then prepare a reviewable PR. After explicit authorization, deploy only the default-deny gateway and perform anonymous/authenticated negative tests against the live endpoint.


## 2026-10-12 — SESSION-003 — Unify SMM deferred-launch flag contract

- **Verified:** PR #216 source used `SMM_LAUNCH_ENABLED`, while adjacent SMM candidate PRs #214/#215 used `MNTY_SMM_ENABLED`; this created a deployment/configuration contract mismatch across draft branches.
- **Action:** standardized the P0 deferred gateway, its source validator, and continuity/TODO/log references on the exact server-side flag `MNTY_SMM_ENABLED === "true"`, matching the existing adjacent candidate contract. Default remains disabled unless explicitly set to exact string `true`.
- **Scope:** source branch only; no production environment variable was changed, no Edge Function was deployed, no PR was merged, and no database or wallet operation occurred.
- **Verification pending:** rerun GitHub Actions on the new head, inspect the exact checks, and verify no remaining conflicting flag names in the changed source/docs. Live SMM disablement is still NOT VERIFIED.
- **Release state:** BLOCKED / NOT CERTIFIED.


## 2026-10-12 — SESSION-004 — Read-only production ACL verification

- **Query:** read-only PostgreSQL inspection using `has_table_privilege`, `pg_class.relacl`, and RLS flags for SMM tables plus `public.digital_page_payment_events`.
- **Observed:** sampled SMM tables (`smm_orders`, `smm_wallets`, `smm_wallet_transactions`, `smm_order_events`, `smm_providers`, `smm_services`) show `service_role` ACL `Dxtm` only; SELECT/INSERT/UPDATE are absent. Sampled anon/authenticated direct SELECT/INSERT privileges are absent.
- **Observed:** `digital_page_payment_events` has RLS enabled, no direct `service_role` SELECT/INSERT/UPDATE/DELETE privilege, and ACL `{postgres=arwdDxtm/postgres,service_role=Dxtm/postgres}`. This remains a verification item, not a confirmed defect, until the deployed payment Edge Function/RPC access path is traced.
- **Cross-check:** candidate RC456 migration provides narrow grants for SMM table access and keeps provider credentials/wallet ledger RPC-only, but RC456 is not present in the previously verified production migration ledger through RC424. Do not apply it separately from full migration reconciliation.
- **Not performed:** no production DDL, ACL grant/revoke, Edge Function deployment, wallet action, or PR merge.
- **Next:** inspect the deployed digital-page payment function and RPC contract; continue exact migration provenance recovery. Full release remains BLOCKED / NOT CERTIFIED.


## 2026-10-12 — SESSION-005 — Payment-event RPC boundary follow-up

- **Verified fact:** the live function catalog reports `public.process_verified_digital_page_payment_backend` as SECURITY DEFINER, with `search_path=public, pg_temp`; EXECUTE is granted to `service_role` only; catalog metadata indicates its definition references `digital_page_payment_events`.
- **Interpretation:** direct `service_role` table grants are not necessarily required for this event table because the backend RPC mediates access. Do not add direct grants based on the table ACL alone.
- **Limitation:** the attempt to retrieve the complete function definition was blocked by safety controls; atomicity/body review and end-to-end webhook verification remain NOT VERIFIED.
- **Production impact:** none; read-only catalog metadata only.
- **Release state:** BLOCKED / NOT CERTIFIED.


## 2026-10-13 — SESSION-006 — Verify SMM deferred-gate candidate CI

- **Candidate HEAD checked:** `152a8c24b5fa1f808f3fa7942d026cc01abe7be9` on `fix/p0-defer-smm-before-core-launch-20261012`.
- **CI:** Pages validation workflow `38308072523`, SMM service-role access boundary `38308072547`, module professionalization `38308072620`, backend-only module boundary `38308072638`, and MantiGO open-ride privacy boundary `38308072534` all completed successfully.
- **Important distinction:** the Pages workflow's deploy job was skipped because this is a pull request. Passing CI verifies candidate source contracts only; it does not mean SMM was deployed or disabled in production.
- **Action:** updated the master TODO to replace stale “CI pending” status with the exact passing run evidence.
- **Still blocked:** PR #216 remains open/draft; live `smm-gateway` was last verified as version 8 without the new gate; production migration ledger snapshot ends at RC424; RC456/RC463/RC464 remain source-only and must not be applied outside the reconciled migration chain. Live negative tests, wallet/provider end-to-end tests, and explicit release authorization remain outstanding.
- **Production impact:** documentation-only commit on candidate branch; no merge, deployment, Supabase mutation, environment change, provider request, or wallet operation.
- **Release state:** BLOCKED / NOT CERTIFIED.


## 2026-10-13 — SESSION-007 — SMM production acceptance gates

- Created `docs/release/SMM_PRODUCTION_ACCEPTANCE_GATE.md` on the candidate branch, defining six release gates: safe deferral, migration lineage/schema, least-privilege boundary, provider/catalog readiness, wallet/order correctness, abuse/operations, and exact-head release review.
- Added objective acceptance checks for duplicate/concurrent orders, ambiguous provider outcomes, idempotent refunds, price policy, timeouts, SSRF, secret handling, and post-deploy evidence.
- Recorded current read-only blockers: live gateway version 8 lacks the candidate gate; migration ledger snapshot ends at RC424; zero active providers/services/orders; missing `smm_orders.idempotency_key`; missing service_role SELECT/INSERT/UPDATE on sampled SMM tables; credit historical-baseline blocker remains unresolved.
- Updated master TODO to link this gate plan.
- Safety: candidate documentation-only changes; no production database mutation, migration, grants, edge-function deploy, provider call, wallet transaction, or PR merge.
- State remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-13 — SESSION-008 — Module completion matrix

- Added `docs/release/MODULE_COMPLETION_MATRIX_AR.md`, covering 20 modules and distinguishing estimated source-build completeness from verification/release readiness.
- Based on the existing production gate report and current SMM evidence, the documented arithmetic averages are 69% source build and 37% verification/readiness; overall launch readiness is conservatively estimated at 30% because unresolved P0 gates block release.
- These are transparent engineering estimates, approximately ±10 percentage points, not measured code coverage or a production certificate. The matrix lists blockers and an evidence policy for future updates.
- No production changes, migrations, grants, deploys, provider calls, wallet operations, or PR merge were performed.
- State remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-13 — SESSION-009 — CI confirmation and credit migration provenance

- Confirmed all five latest relevant workflow results on `be74dd5a2b94bbd93591e97fa23e709fe5fe3f70`: Module Professionalization, SMM Service Role Access Boundary (disposable PostgreSQL included), Backend-only Module Boundary (financial journal and approval-audit PostgreSQL tests included), MantiGO Open Ride Privacy Boundary, and Pages validation workflow are green at workflow level.
- Verified Pages workflow `validate` succeeded but `deploy` was skipped for the draft PR. No production deployment is claimed.
- Added exact CI evidence to module progress matrix and created `docs/release/CREDIT_MIGRATION_LINEAGE_BLOCKER_AR.md`, documenting that the RC40 archive is not authoritative historical proof and listing the known credit schema/default differences.
- Repository-history searches did not recover a verifiable original credit-table DDL commit; the historical baseline remains unresolved.
- No production writes, migrations, grants, deploys, provider calls, wallet transactions, or merges.
- State remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-13 — SESSION-010 — SMM provider transport hardening

- Reviewed the actual candidate SMM gateway source and identified a provider HTTP helper without timeout/response bound and with raw non-JSON fallback.
- Hardened the candidate helper to require HTTPS, reject URL credentials/non-standard ports/localhost-local hostnames/IP-literal hosts, reject redirects, apply a 15-second timeout, cap response body at 1 MiB, require JSON, and avoid raw response fallback.
- Extended the SMM static source validator to check these transport controls. Updated the SMM acceptance gate and master TODO with the remaining DNS/private-target limitation and the unresolved auto-refund ambiguity in the order exception path.
- CI started for commits `2b69403c4d81919b1e5516d54006a080c7823e38` and `ef8bc68af2292620b965738fce6ee05ff15bacb9`; runs are queued/in progress and are not yet claimed as passing.
- No production change/deploy, migration, grants, provider calls, wallet transaction, or merge.
- State remains **BLOCKED / NOT CERTIFIED**; do not enable SMM until order/refund reconciliation and provider allowlisting are closed.


## 2026-10-13 — SESSION-011 — SMM provider allowlist, transport tests, and ambiguous-order quarantine

- Added `supabase/functions/smm-gateway/provider-transport.ts` with exact hostname allowlisting via `SMM_PROVIDER_HOSTS`, HTTPS-only endpoint policy, URL-credential/port/local/IP-literal rejection, bounded JSON response parsing, and size limits.
- Added `supabase/functions/smm-gateway/provider-transport.test.ts` covering missing/wrong allowlists, unsafe endpoints, accepted allowlisted HTTPS endpoints, valid/invalid JSON, and response size caps. Wired `deno test` into Pages validation and expanded the source validator.
- Updated `smm-gateway/index.ts` to use the tested transport module.
- Reworked the SMM `place_order` failure path: wallet debit RPC errors are treated as unknown; provider exceptions/missing order IDs are marked for reconciliation without automatic refunds; provider acceptance followed by failed local persistence returns a reconciliation-required response without refund.
- Updated the SMM acceptance gate and master TODO. DNS rebinding/private resolution still needs network egress enforcement; the full live schema/idempotency/terminal-state chain remains unverified.
- Latest relevant CI is running/queued for the candidate commits; do not claim PASS until the exact latest head completes.
- No production deploy, migration, grant, wallet operation, provider call, or merge. State remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-13 — SESSION-012 — CI feedback and validator correction

- The Pages validation workflow at candidate commit `68c78cc5f5a6fa57d4246967ac88849400371bcd` completed its `validate` job successfully, including the new Deno provider transport unit tests and the source syntax/contract checks. Its deploy job remains skipped for the draft PR; no production deployment is claimed.
- Earlier Pages validation at `15db395ee96294a82431f386d45afcb8c2fa0df7` failed because the source validator still expected the provider transport code inline after it had been extracted into `provider-transport.ts`. The validator was corrected in `68c78cc5f5a6fa57d4246967ac88849400371bcd`; the new exact-head Pages validation then passed.
- The provider allowlist, bounded JSON parsing, and ambiguous-order quarantine changes remain candidate source only. Other exact-head CI workflows were still queued at the latest status check.
- No production deployment, migration, grants, provider call, wallet operation, or merge.
- State remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-13 — SESSION-013 — SMM order status reconciliation hardening

- Updated SMM order status polling to preserve terminal states (`COMPLETED`, `CANCELLED`, `FAILED`, `PARTIAL`) against stale provider status responses.
- Status persistence failures now return `ORDER_STATUS_PERSISTENCE_PENDING` with a reconciliation-required response instead of silently returning success.
- Provider status responses returned to the client are reduced to the normalized status and provider status string; the raw provider response is no longer returned.
- Extended the source validator to check terminal-state preservation, persistence-failure handling, and response minimization.
- Exact-head CI for code commits `51934f98728f6f2be9602d103a1aff59a6a4110d` and `80441f12b572712e3486cee8e197f95ada6393a7` was queued/in progress at the latest inspection. The prior Pages validation at `68c78cc5f5a6fa57d4246967ac88849400371bcd` passed, including Deno transport tests; it predates the order-status change.
- No production deploy, migration, grants, provider calls, wallet operations, or merge. State remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-13 — SESSION-014 — Type-check correction and SMM CI evidence

- Exact-head SMM Service Role Access Boundary passed at `d110109fb42269d24885b41e78c9a25767003781`, including disposable PostgreSQL ACL integration and `deno check --no-lock supabase/functions/smm-gateway/index.ts`: [run 38309841178](https://github.com/islamnagy2022-eng/MantiQatiX/actions/runs/38309841178).
- Module Professionalization Validation passed at the same head: [run 38309841859](https://github.com/islamnagy2022-eng/MantiQatiX/actions/runs/38309841859).
- MantiGO Open Ride Privacy Boundary passed at the same head: [run 38309841211](https://github.com/islamnagy2022-eng/MantiQatiX/actions/runs/38309841211).
- Earlier type-check caught nested Supabase relation cardinality and unknown response typing in the new status-polling path. Fixed by normalizing the relation as object-or-array and explicitly typing the provider response; the new Deno check passed.
- Backend-only Module Boundary and Pages workflow were still in progress at the latest check. Pages deployment remains skipped for the draft PR; no production deployment is claimed.
- No production deploy, migration, grants, provider calls, wallet operations, or merge. State remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-13 — SESSION-015 — SMM progress estimate adjustment

- Updated the SMM module estimate from 75% to 80% source build and 25% to 40% verification/readiness based on the new provider allowlist/transport module, Deno tests, ambiguous-order quarantine, terminal-state protection, and successful exact-code-head source/isolated integration workflows.
- Updated overall rounded averages: source build remains 69%, module verification/readiness becomes 38%; conservative launch readiness remains 30% because production migration lineage, live schema/idempotency parity, egress policy, and production E2E/restore gates remain unresolved.
- Current branch has a documentation-only follow-up; no production changes or deployment.


## 2026-10-13 — SESSION-016 — Status transition tests, timeout coverage, and payload minimization

- Added `supabase/functions/smm-gateway/order-status.ts` to centralize provider status normalization, including completed/complete aliases, partial, cancelled/canceled, failed/error, and processing aliases; unknown provider statuses preserve the current state.
- Extended `provider-transport.test.ts` with regression tests proving terminal order states cannot be downgraded by stale provider status.
- Fixed a real timeout coverage gap: the 15-second abort timer now remains active while the response body is read and parsed, not only while waiting for response headers.
- Minimized persisted SMM order event payloads to provider order ID and normalized submission status rather than storing the full provider response.
- CI caught a mismatch in the new timeout validator assertion; fixed the assertion (the source timeout behavior itself was already inside the guarded try/finally). The corrected Pages `validate` job passed at `208621b59c0067d8637f3637fce5000f742c6aea`, including Deno unit tests, production verification engine, and syntax check. Deployment job was skipped because PR #216 is draft.
- At last check, SMM Service Role Access Boundary had passed its Deno validation and was finishing isolated PostgreSQL integration; Backend-only Module Boundary was still running.
- No production deploy, migrations, grants, provider calls, wallet operations, or merge. State remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-13 — SESSION-017 — SMM outbound response hardening

- Added provider order-status normalization unit coverage and terminal-state regression cases.
- Kept the provider request abort timer active through streamed response-body parsing, rather than clearing it after headers.
- Minimized provider submission event payloads; invalid provider catalog payloads are no longer echoed back to admin clients.
- Provider status strings are now stripped of ASCII control characters and bounded to 64 characters before persistence/response.
- Exact-head CI at `41f63a2db299d08ee9dcef9ef9b0c7822da163b3` passed: Pages validate, SMM Service Role Access Boundary (including isolated PostgreSQL ACL integration and Deno check), Module Professionalization Validation, Backend-only Module Boundary, and MantiGO privacy boundary. Pages deploy job was skipped because PR #216 is draft.
- PR #216 remains draft/source-only. No production changes, deploy, merge, migrations, grants/RLS changes, provider calls, or wallet operations.
- Release remains **BLOCKED / NOT CERTIFIED**. The migration lineage/replay gate, live schema/idempotency parity, DNS/network egress controls, financial/provider E2E, and restore rehearsal remain unresolved.


## 2026-10-13 — SESSION-018 — SMM catalog pricing safety

- Found and fixed a high-impact catalog-sync behavior: provider synchronization had set customer selling price equal to wholesale provider cost, automatically activated every imported service, and persisted the provider's full arbitrary service object as metadata.
- Added `catalog-normalization.ts` with bounded field lengths, ASCII control-character removal, positive/finite cost checks, integer quantity bounds, allowlisted metadata, and preservation of existing customer price.
- New catalog items now start with selling price 0 and inactive until an administrator reviews pricing and explicitly activates them. Existing items whose current selling price is not strictly greater than the provider's latest cost are deactivated on refresh; reviewed prices/activation are preserved only while a positive margin remains.
- Added Deno tests for new-item default-deny pricing, existing-price preservation, no-margin deactivation, invalid cost/quantity rejection, and metadata minimization.
- Exact-head CI passed on `5fb6a6fe5dc038868f2e0f5f03692094a8ea9fc8`: Pages validation (Deno tests + production verification + syntax check), SMM Service Role Access Boundary, Module Professionalization Validation, Backend-only Module Boundary, and MantiGO Open Ride Privacy Boundary. Pages deploy job was skipped because PR #216 is draft.
- No production change, deployment, merge, migration, grants, provider call, or wallet operation. Overall release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-13 — SESSION-019 — SMM pricing margin and error response safety

- Added a final correction after CI caught an undefined identifier in the catalog margin helper. The failing exact-head run was investigated from logs and the reference corrected before the green run.
- Catalog sync and the manual price-update action now disable a service whenever customer price is not strictly above current provider cost; manual price changes return a safe status rather than leaking raw database errors.
- Gateway-wide unhandled errors now return a fixed `INTERNAL_ERROR`; provider-secret update, wallet-credit, and service-price database/RPC failures use fixed error codes rather than returning internal exception text.
- Exact candidate head `1c16630ec4eb7ed6104d92b8454d0cadcc33c3d9` passed Pages validation (Deno unit tests, production verification, syntax check), SMM service-role boundary, module professionalization, backend-only module boundary, and MantiGO privacy checks. Pages deployment was skipped because PR #216 remains draft.
- The CI failure at the previous head was real and is retained in run history; do not treat that failed head as green. Only the corrected exact head above is verified.
- No production deployment, merge, migration, grant/RLS change, provider call, or wallet operation occurred. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-13 — SMM provider JSON decoding hardening

- **Source change:** `supabase/functions/smm-gateway/provider-transport.ts` now decodes provider response bytes with fatal UTF-8 validation before JSON parsing. Malformed byte sequences are rejected instead of silently replaced with U+FFFD.
- **Regression test:** added a Deno test in `supabase/functions/smm-gateway/provider-transport.test.ts` that submits malformed UTF-8 under an application/json content type and requires rejection.
- **Commits:** source `452ab6bce30566dcb90e9586c105f62521f8657b`; test `1fd8de22a017d2cb872d9a55bae5edaa644123cb`.
- **Verification:** exact-head GitHub Actions has not yet completed for this new test commit. Status is **IMPLEMENTED / NOT VERIFIED** until Deno and the relevant CI workflows finish successfully.
- **Scope/safety:** candidate branch only; no production deployment, database migration, ACL/RLS change, provider request, wallet mutation, or PR merge.
- **Remaining blockers unchanged:** migration lineage/replay, live schema and idempotency parity, DNS/egress controls, wallet/provider E2E, and backup-restore evidence. Keep SMM disabled by default.
