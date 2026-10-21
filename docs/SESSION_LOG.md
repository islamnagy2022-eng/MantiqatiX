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


## 2026-10-18 — guarded marketing workspace port on current main

- Working branch: `feat/marketing-workspace-current-main-20261018`; Draft PR [#292](https://github.com/islamnagy2022-eng/MantiqaTiX/pull/292).
- Added the tabbed marketing/agency workspace for leads, provider agencies, projects, and platform ads; campaign create/invite/respond/status actions call only the RC453 backend RPCs.
- Added SMM quick access to marketing-role and enterprise dashboards. The separate SMM storefront remains deferred by the server-side launch gate.
- Added a fail-safe for the known production/source gap: if the RC453 campaign tables are missing, the UI shows a clear notice and falls back to the existing marketing workspace instead of presenting a campaign form that cannot work.
- Browser mutations to `marketing_campaigns` and `marketing_campaign_participants` remain prohibited; no direct INSERT/UPDATE/DELETE calls were added.
- Dedicated Marketing Workspace Contract run [39091349054](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39091349054) **PASS**: JavaScript syntax and 22 static contract assertions passed on the PR head at that run.
- Full Pages workflow [39091349019](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39091349019) was still running when this note was written; do not mark it PASS until the final job conclusion is fetched.
- The UI is staged only in a Draft PR. RC453 has not been applied to production, no Edge Function deployment occurred, and no external ad network was contacted. No production DDL/DML, grants/RLS/Auth settings, payment, wallet, or deployment was changed.
- Next: verify final exact-head Pages and relevant security/module workflows, review campaign RPC behavior against the migration tests, and keep the release gate **BLOCKED / NOT CERTIFIED** until the migration chain, production parity, and external E2E gates are approved.


## 2026-10-18 — marketing workspace merged; production parity blockers reconfirmed

- [x] Merged guarded marketing/agency workspace PR [#292](https://github.com/islamnagy2022-eng/MantiqaTiX/pull/292) as commit `bd08e8436ba16a5a84c0c0cfd5e346591b364bb7`. The main-branch app, index, service worker, and validation scripts were confirmed byte-identical to the tested branch.
- [x] Exact tested PR head `7b6757830907c6843eadbcec5425bbd1da8b67b4`: Marketing Workspace Contract [run 39091702890](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39091702890) PASS; Pages validation [run 39091702881](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39091702881) PASS; backend-only boundary [run 39091702874](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39091702874) PASS including approval-audit and RC450 financial-journal isolated PostgreSQL jobs; MantiGO privacy [run 39091702897](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39091702897) PASS; module professionalization [run 39091702887](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39091702887) PASS including matrimony privacy and targeted-ad search-path integration.
- [x] PWA cache advanced to `mnty-web-v129`; exact versioned app entrypoint and Supabase SDK are precached. Marketing campaign reads are scoped to the active business, missing business scope fails closed, and campaign mutations are disabled when campaign data sources fail.
- [ ] **Deployment verification remains pending.** The Pages workflow on the PR passed validation and skipped its deploy job as expected for a pull request. Do not claim the main-branch Pages deployment is live until the main push workflow/deployed URL is independently verified.
- [x] Merged security-review documentation PR [#291](https://github.com/islamnagy2022-eng/MantiqaTiX/pull/291), commit `cf522740e9dd058c28728ba582e347661ef24122`. Read-only live catalog review records the targeted-ad RPC RC451 mismatch and the financial-journal Edge Function drift.
- [x] Bounded live Edge Function entrypoint parity check: 24 unique active functions sampled, 23 `index.ts` files byte-identical to repository main, one mismatch (`financial-journal`). This is not full deployment certification.
- [ ] **Financial journal production blocker:** live Edge Function v3 calls legacy `post_financial_journal` without a verified actor ID; live ACL checks show `service_role` cannot EXECUTE either `post_financial_journal` or `post_financial_journal_backend`. Repository source uses actor-bound `post_financial_journal_backend`. Do not grant service-role access to the legacy RPC as a shortcut; resolve the migration chain and deploy the reviewed source/RPC contract together.
- [ ] Production Supabase remains at RC424 (283 migration versions through `20261008222845`). RC453 campaign tables/RPCs are not deployed; the live campaign UI therefore falls back to the existing marketing workspace.
- No manual production DDL/DML, grants/RLS/Auth changes, Edge Function replacement, payment, wallet write, or settlement was performed. A main-branch push workflow may run after the merge, but its deployment result was not independently observed in this session.
- Overall release: **BLOCKED / NOT CERTIFIED** until historical migration provenance, chronological release execution, live finance/payment E2E, tenant-policy parity, backup/restore, Auth settings, and deployment verification are completed.


## 2026-10-18 — expanded Edge Function parity and Auth Advisor refresh

- [x] Expanded live-versus-main Edge Function entrypoint checks to 29 unique active functions: 27 exact matches, two drifted entrypoints.
- [ ] BLOCKED: `financial-journal` live v3 calls the legacy RPC and service_role lacks EXECUTE; repository source is corrected, but RC450/RC449A and the chronological migration chain are not deployed.
- [ ] BLOCKED: `mnty-customer-registration` live v4 uses `ensure_customer_membership_for_user`, while repository source uses `activate_customer_registration_atomic`. The RPCs intentionally differ; do not deploy either source blindly. Complete the existing acceptance matrix for concurrency, pending-request cleanup, audit failure, and auth.users-trigger behavior first.
- [ ] Auth Advisor still warns that anonymous sign-ins are enabled and leaked-password protection is not enabled. Confirm the anonymous-session product contract, then enable leaked-password protection via Supabase Auth settings and verify. No Auth settings were changed because the connected tools do not expose an Auth-settings mutation operation.
- [ ] Security Advisor still reports the policy-less RLS table, public targeted-ad SECURITY DEFINER, and 40 authenticated-executable SECURITY DEFINER entries; per-function review remains open.
- Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-18 — RC431 live payment RPC mismatch

- [x] Read-only catalog comparison confirmed the live `process_verified_digital_page_payment_backend` still has RC424's `search_path=public, pg_temp` and body.
- [ ] BLOCKED: live RPC lacks RC431 provider-order binding, provider-transaction/event-ID binding, NULL-status rejection, conflicting replay-status rejection, and event-ID advisory serialization. Current code records `provider_order_id` but does not validate it against the order's existing provider-order binding.
- [x] PR #286 contains RC431 hardening and disposable PostgreSQL tests for these negative cases; comment added with exact live/source differences.
- [ ] Do not apply RC431 alone out of order. Complete the reviewed RC425–RC441 chronological chain, rehearsal, backup/restore, and payment sandbox acceptance before any production migration.
- Payment/webhook integrity remains **NOT VERIFIED**; production release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-20 — SESSION-UI-FIRST — Owner-directed module UI sequencing

- **User requirement:** finish all module interfaces/pages first, including login, search, sponsored surfaces, activity management controls, and job-function/role management; defer subscription packages/accounts and expanded accounting UI until after the first release.
- **Verified repository context:** main is `149a85c7e5c44b61421edc8391cbb82885902fae`; Draft PR #307 contains cash-only launch work and remains unmerged, while Draft PR #308 records the launch scope. PR #307 exact-head checks observed include a passing Doctor Module Release Contract and a still-running disposable migration replay at the last query. Do not infer full pass from one check.
- **Decision clarified:** sponsored public display/placement UX may be completed where existing backend contracts support it; ad billing, budget charging, paid campaign execution, SMM execution, external network publication, subscription monetization, and expanded accounting UI are deferred. Preserve existing code/data/contracts and fail closed.
- **Action performed:** created branch `feat/ui-first-module-completion-20261020` from main; added `docs/MASTER_UI_FIRST_CONTINUATION_PROMPT.md`; inserted the UI-first execution roadmap in the Master TODO; recorded continuity and next implementation gate.
- **Not performed:** no module application code changes in this batch, no production DDL/DML, migrations, Auth settings, payments, ad-network calls, merge, or deployment. Documentation is not evidence that UI journeys are implemented or verified.
- **Next:** inventory routes/modules/pages and visible actions; map each to current APIs/RPCs/permissions; implement the highest-impact UI gaps incrementally with role/tenant-aware tests. Keep release **BLOCKED / NOT CERTIFIED**.


## 2026-10-20 — SESSION-UI-INVENTORY — Initial route/module audit

- **Verified from source:** `web/index.html` + `web/home.js` provide public discovery/search UI; `web/app.js` contains authenticated shell, membership/role state and global search; separate files exist for sector registry/workspaces, provider onboarding, restaurant operations, reverse bidding, digital pages/editor and SMM storefront; `web/rbac.js` documents UI visibility as non-authoritative.
- **Action performed:** added `docs/UI_MODULE_ROUTE_INVENTORY.md` with entrypoints, initial module matrix, known deferrals and verification gaps. Linked it from the Master TODO.
- **Concrete issue found:** `web/module-blueprints.js` button handler reports “opened section” via a success toast but does not actually open a workflow. This is a source-confirmed misleading UI action; fix is next after confirming consumers and routes.
- **Limits:** route inventory remains partial; no browser E2E, Auth mutation, production query/write, migration, payment, deployment or merge was performed. Source existence is not workflow verification.
- **Next:** inspect exact blueprint consumers and module route handlers, replace false-success behavior with a real route/action or honest disabled/unavailable state, add tests, then continue activity/role-management mapping. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-20 — SESSION-UI-SLICE-001 — Remove false success from module blueprint actions

- **Verified source finding:** `web/module-blueprints.js` rendered “فتح القسم” buttons whose handler only called a success toast; no route or workflow was opened.
- **Action performed:** changed the button label to “حالة القسم”; clicking now opens an accessible `role=status` / `aria-live=polite` message explaining the section is only a preliminary UI blueprint and no action/data mutation occurred. Added `scripts/validate-module-blueprint-actions.mjs` and wired it into `.github/workflows/module-professionalization.yml`.
- **Safety:** this does not claim to complete the module workflow; it removes a misleading success state while real routes/contracts are mapped. No schema, production, Auth, payment, ad network, merge, or deployment action occurred.
- **Verification status:** source changes are committed to the working branch; CI and browser behavior remain pending/not verified until exact-head checks complete.
- **Next:** verify branch CI, inspect role/activity API contracts and exact app routes, then implement the next real module journey. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-20 — SESSION-UI-PR-309 — Draft review and CI correction

- **Action performed:** opened Draft PR [#309](https://github.com/islamnagy2022-eng/MantiqatiX/pull/309) from `feat/ui-first-module-completion-20261020` to `main`. The PR includes the master prompt, initial route/module inventory, TODO/continuity/session-log updates, the honest blueprint status behavior, and a focused source-contract test.
- **CI correction:** an intermediate workflow edit briefly inserted two `run:` keys into one GitHub Actions step; the earlier intermediate-head module-professionalization runs failed. Corrected the workflow by adding a separate named step, committed as `0baeb4e36c7a430afe7863aa5251e71d4bef01a5`. The corrected exact-head runs were queued at last check; do not treat earlier failure or pending runs as final verification.
- **Current verification:** branch head is `0baeb4e36c7a430afe7863aa5251e71d4bef01a5`; exact-head checks were queued/in progress when checked. Browser E2E and production deployment are not verified.
- **Not performed:** no merge, production deployment, production DB/Auth mutation, migration, payment, or external ad call.
- **Next:** check exact-head CI; if green, continue route/action mapping and real UI workflows. If failed, inspect job logs and fix root cause before advancing. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-20 — UI inventory source pass

- **Verified:** inspected main source at `149a85c7e5c44b61421edc8391cbb82885902fae`, including `web/app.js`, `web/home.js`, `web/rbac.js`, `web/module-blueprints.js`, `web/operations-modules.js`, `web/sector-registry.js`, `web/module-blueprints.js`, and the web file tree.
- **Findings:** 24 top-level workspace entries are declared in `app.js`; domain registry includes 16 module definitions. The auth view in this baseline offers Google OAuth. Global search has 10 configured source groups and converts per-source query errors into empty result arrays. Generic module blueprint buttons currently show a “section opened” toast but do not navigate to a real subview. RBAC defaults and a membership switcher exist, but a full scoped role/job-function assignment UI is not proven by those alone. Public add-activity request flow is not a full activity lifecycle.
- **Action performed:** added `docs/UI_MODULE_INVENTORY.md` and appended this source-based inventory/gap register to the Master TODO. All runtime journeys remain NOT VERIFIED.
- **Not performed:** no app code changes, database or production mutation, Auth setting change, deployment, merge, payment, or external ad-network action.
- **Next:** safely fix the blueprint false-success action and test it; then address global-search partial failures and implement module UI gaps against verified backend contracts only. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-20 — SESSION-UI-IMPLEMENTATION-001 — First UI behavior fixes

- **Action performed:** on `feat/ui-first-module-completion-20261020`, added Pages CI validation for the module blueprint action contract and global-search failure-state contract. The existing blueprint action is confirmed to disclose that no standalone workflow is wired and no mutation occurred instead of claiming success. Updated `web/app.js` so global search tracks source failures and distinguishes partial/unavailable sources from genuinely empty results while preserving role-based source filtering.
- **Tests added:** `scripts/validate-module-blueprint-actions.mjs`; `scripts/validate-global-search-failure-state.mjs`; both are called by `.github/workflows/pages.yml`.
- **Verified vs pending:** source edits and workflow wiring are committed to the branch. Exact-head CI and browser/E2E behavior are **PENDING**; source-contract tests do not prove deployed behavior or data/RLS correctness.
- **Not performed:** no database migration, production mutation, Auth setting change, payment, ad spend, merge, or deployment.
- **Next:** observe exact-head CI after opening the draft PR, then proceed module-by-module to real route/action flows and role-scoped activity/job-function controls. Subscription package/account expansion and expanded accounting UI remain deferred. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-20 — Verification guard

The UI/search changes are source-committed but not runtime-certified. This session has not executed the Node/Pages workflow locally and has not confirmed a successful exact-head GitHub Actions run. Do not treat validator source files as proof of a passing run. Release stays BLOCKED / NOT CERTIFIED.


## 2026-10-20 — Search validator assertion fix

- Corrected `scripts/validate-global-search-failure-state.mjs` so the accessibility assertion checks the actual rendered `aria-live="polite"` markup in `web/app.js`, rather than expecting `setAttribute(...)`.
- Manually evaluated all seven source-contract regexes against the current branch's `web/app.js`; **7/7 matched**. This was a focused source comparison, not a Node execution or GitHub Actions result.
- Latest commit: `410bca6f6eaf5e635b54cf509a06a2a0ae62ce20`. CI/browser E2E remain pending; no merge/deploy. Release stays **BLOCKED / NOT CERTIFIED**.


## 2026-10-20 — Global search zero-source state

- Updated `web/app.js` to distinguish an empty result set from the case where role/permission filtering leaves no searchable sources at all.
- Extended `scripts/validate-global-search-failure-state.mjs` with a source-contract assertion for that state.
- Source comparison: seven targeted patterns matched the fetched `web/app.js` after the change. No Node/Pages workflow or browser E2E was executed/confirmed.
- Code commits: `791907010399d94fb0f84f2b26548358d20c50e1`; validator commit: `f78b20bf7c91672dcf1bf77b59db8ab8ef36e674`. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-20 — Remove unverified security claims from blueprint UI

- Replaced generic module blueprint badges “RLS ENFORCED / RBAC ENFORCED / WRITE SERVER” with “NOT VERIFIED / CONTRACT CHECK” and Arabic explanatory copy. The generic blueprint did not itself prove those security controls had been exercised for every module.
- Extended `scripts/validate-module-blueprint-actions.mjs` to assert the caveat is present and unsupported ENFORCED badges are absent.
- Source-pattern inspection: 8/8 targeted checks matched. No local Node run or GitHub Actions pass was obtained, so the validator and runtime remain unverified.
- Commits: UI `4f49fd4497e6a79808563c108cd57f7621fb6fa4`; validator `98a002ace642a07e350925e116f61659f81f0b7f`. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-20 — Sector module query failure state

- Commit `8e5e84f1dcbc2b92c81544c4c600879a5eff7418`: sector module loader now collects query failures instead of disguising them as empty lists, and the duplicate `applyToJob(jobId)` definition was removed.
- Commit `faba79d2b71bde1d062a402e2b6122cce46ba619`: added accessible error/retry UI for failed sector queries.
- Commit `eff9d6fa58df35655151e8a69119524ad6200869`: extended the existing sector-rendering validator with source-contract checks for failure/empty distinction, accessible retry, and duplicate job handler. The Pages workflow already invokes this validator.
- No Node execution, CI result, or browser E2E was verified here. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-20 — sector job application authorization correction

- **Source finding:** `web/sector-modules.js` submitted applications with a direct `job_applications` INSERT, while the repository already defines `public.submit_job_application_backend(uuid,uuid,text,text,text,text)` in `supabase/migrations/20261006235500_job_application_backend_submit_v1.sql`. That backend binds the user to `auth.uid()`, validates required applicant fields and job existence, and handles duplicate applications idempotently.
- **Change committed on** `feat/ui-first-module-completion-20261020`: `web/sector-modules.js` now calls the existing backend RPC, requires phone/qualifications/CV summary, and distinguishes `ALREADY_APPLIED` from a new submission. Commit: `9a6526456dcc78446a208440b0a24f55bacb598b`.
- **Regression guard added:** `scripts/validate-sector-rendering.mjs` checks for RPC use, no direct application-table insert, required-field validation, and duplicate status handling. Commit: `32b848989f0b5a80749e0604814037c28c30b31f`.
- **Not yet verified:** no exact-head CI result or browser E2E has been observed for these new commits. No database change, production deployment, or merge occurred.
- **Next:** verify source and validator at current head, inspect the CI result, then continue to the next proven UI/backend contract gap. Production remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-20 — used-items sold-listing recovery

- **Finding:** `load()` filtered `used_item_ads` to `is_sold=false`, while the UI included a seller action to re-enable sold ads. The sold-state branch was therefore unreachable for ads hidden by the query.
- **Fix:** the source now selects unsold listings plus listings owned by the authenticated user, preserving the existing active membership tenant/business scope where present. Commit: `84b491799802830888665ce807034fd13818a8a7`.
- **Regression guard:** added an assertion in `scripts/validate-sector-rendering.mjs`. Commit: `e8b64c1386d28708cf049b29136c396f9d7a2846`.
- **Verification boundary:** source-level fix only; CI and browser E2E pending. RLS/update-policy behavior is not certified. No production changes or deployment occurred.


## 2026-10-20 — education request server-authority correction

- **Finding:** `web/sector-modules.js` contained a direct `education_requests` INSERT despite the established server-authority contract. Migration `20261007060000_education_request_server_authority_v1.sql` defines `create_education_request_backend` and revokes authenticated direct INSERT.
- **Fix:** switched the sector workspace to `sb.rpc('create_education_request_backend', ...)`, added subject-length validation, and avoided a success message when no row is returned. Commit: `2052a02f219746b0f9acd53763e2412c54bf99ef`.
- **Regression guard:** added validator checks for backend RPC use, absence of direct INSERT, and subject-length validation. Commit: `abcb297b6e09e8516c1baf457959e47207e6e237`.
- **Verification boundary:** implementation committed; exact-head CI and browser E2E remain pending. No production data/schema mutation, deployment, or merge occurred.


- **Education input follow-up:** added client-side student-name length validation (2–200 characters) matching the server contract, plus a regression assertion. Commits: `82fafbe1ec770c60e6d5ad49e316b090fb34bbc5` and `c6eaa0ac4a2c04b9ae456971f381ce2f2ff98b71`. CI/E2E remain pending.


## 2026-10-20 — used-items ownership-safe status actions

- **Finding:** after expanding the query to include seller-owned sold listings, the action renderer still showed status buttons for all visible ads, while the UPDATE was owner-filtered and ignored zero affected rows. This could show a false affordance for another seller's public listing.
- **Fix:** status buttons now render only for rows whose `owner_user_id` matches the signed-in user. The UPDATE selects the affected row and displays an explicit no-match message when ownership/RLS prevents a change. Commit: `edeee30e5546956020f7ccbc999c934dea2a66a3`.
- **Regression guards:** added assertions for owner-only controls and zero-row handling. Commit: `66a9bfa98276ebc78847847e5b29412b3627a2f1`.
- CI, browser E2E, and production RLS behavior remain unverified.


## 2026-10-20 — fashion product branch-scope fallback

- **Finding:** fashion product creation supplied an empty string when the active business membership had no branch. If the target column is UUID typed, this can fail validation instead of representing an absent optional branch.
- **Fix:** changed the fallback to `null`, preserving the distinction between an absent branch and an invalid identifier. Commit: `680d433e682881d0f233a4ac4e46d95b23ebee4a`.
- **Regression guard:** added a validator assertion. Commit: `6423df32f69ed4ec24eaaaf0c556771e6ff95ab7`.
- Exact-head CI and runtime verification pending.


## 2026-10-20 — live privilege evidence and fail-closed write UI

- **Read-only live DB check:** `has_table_privilege('authenticated', ...)` showed `fashion_products`: SELECT=true, INSERT/UPDATE/DELETE=false; `used_item_ads`: SELECT/INSERT/UPDATE/DELETE=false. `pg_policies` showed RLS policies, but policy presence does not confer SQL privileges.
- **Action:** removed the direct table mutation functions for fashion products and used-item ads and replaced the corresponding creation forms with explicit unavailable notices. The used-items view also states its read/status controls are unavailable under current database privileges. No grants, policies, tables, or data were changed.
- **Source commit:** `3b695a8b5eb8197b531a40bad60df9b5544c668f`. **Regression guard commit:** `e3b3ac2a6e1f7918922cf41f56f72cf15a91ad6b`.
- **Remaining blocker:** used-item reads cannot succeed for authenticated users under the observed privilege state; do not patch with an ad hoc broad GRANT. Establish the intended public/seller read contract first, then add a versioned migration and isolation tests.
- CI and browser E2E are still pending; production was not modified or deployed.


## 2026-10-20 — sector mutation boundary and CI reconciliation

- A source scan of `web/sector-modules.js` found no direct table mutation calls; current writes use `create_education_request_backend`, `submit_job_application_backend`, and `create_job_backend`.
- Added a validator guard forbidding direct client table mutations in the sector workspace and asserting the three intended RPCs. Commit `dddf3bba6dcf06174596f4ce6b11749ef0a3ef64`; corrected its regex in `2731342b75ab0b889b54d679ee520bd12f589940`.
- Reconciled GitHub Actions on source head `5098c0617477fbf494c454233dd56c7bf27ca6d7`: web validation/syntax, module professionalization (including PostgreSQL privacy/integration jobs), backend-only module boundary (including PostgreSQL tests), MantiGO privacy integration, and marketing workspace contract succeeded. Web deploy job was skipped.
- These results predate the new validator guard and latest docs commits; exact-head CI and authenticated browser E2E are still required. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-20 — used-item safe field projection

- Live read-only database inspection confirmed `used_item_ads` has no effective authenticated SELECT/INSERT/UPDATE/DELETE table privileges. The table includes `seller_phone`; granting broad SELECT would expose that field through the Data API because RLS policies do not hide individual columns.
- Updated the sector loader to request only explicit directory fields and exclude `seller_phone`. Source commit `ec6d9dbbc1170d0c7414353f19b0f301c64c9208`; validator assertion commits `0ea0564050305059324ea3d0daa97dbcdd182fcf` and `7026d7f75c59899244f57b1dde84c77e6dcb9e78`.
- No database grants or production schema were changed. Reads remain unavailable until a reviewed, versioned narrow-column privilege contract is created and verified. Do not grant full-table SELECT.


- **Projection minimization follow-up:** removed unused `description`, `image_url`, and `fee_paid` from the used-item select list while retaining only displayed fields and columns needed for filters/order. Validator now guards that minimal projection. Commits: `66fefa4ce874c1eb62962c8f476a3015378fa42e`, `a3d9744dc84b82df633e1035cc8a42d1dfccdeb1`.


## 2026-10-20 — authentication error clarity

- Fixed the sector workspace error renderer so missing authentication shows a human-readable Arabic instruction rather than `AUTH_REQUIRED`, and suppresses a retry button when retrying cannot restore a session. Source commit `b26ded4f7aa325deff7a3d4b23539167c265829d`; validator commit `8f97bbf72c6e1ab74aa6e39e17384799a83276eb`.
- Exact-head CI is pending; no browser E2E was performed.


## 2026-10-20 — live verification of sector RPC contracts

- Read-only production SQL verified the three sector RPCs used by the UI exist and have `authenticated_execute=true`, `anon_execute=false`, and `public_execute=false`: `create_education_request_backend`, `submit_job_application_backend`, and `create_job_backend`.
- The education RPC rejects anonymous sessions and validates the target/student fields; job creation binds caller identity and requires active business membership; job application binds caller identity and validates job/applicant data. Live schema confirms `jobs.id` and `job_applications.job_id` are UUID.
- No production changes were made. These are catalog/function-contract checks, not authenticated browser E2E.


## 2026-10-20 — migration drift confirmed before privilege repair

- Read-only Supabase inventory returned 150 production migration records ending at `20261008222845`. The current development branch's migration directory contains 140 tracked files and includes later migrations through `20261014230000_rc525_digital_page_product_platform_admin_scope.sql`.
- This drift means the current production privilege state cannot safely be changed by assuming all branch migrations are applied. No migration or grant was applied. A future used-item read fix must be a reviewed narrow-column privilege contract with RLS and query tests, after migration-history reconciliation.


## 2026-10-20 — narrow used-item read grant prepared (not applied)

- Added `supabase/migrations/20261020231500_used_item_ads_minimal_directory_read.sql` to restore only the authenticated directory SELECT columns after revoking table-wide SELECT from `anon` and `authenticated`. The grant deliberately omits `seller_phone`.
- Updated UI copy so directory reading and ad status mutations are described separately. Added validator checks for the SQL contract and status copy.
- Commits: migration `b79420ba8df5b997783c749d45fb9e6e7f39fc43`, UI `a8b7c110dcb9174384e53685ea0576b7b994e205`, validator `ffc9e192ba3f22323b45a77eef97ca337a7c7a71`.
- The migration was **not** applied to the live Supabase project. Existing DB still has no authenticated SELECT privilege, so live behavior is unchanged until reviewed migration application.


## 2026-10-20 — used-item read-path design correction

- **Security review:** a column-level SELECT grant would still expose `owner_user_id` through the Data API and make table reads depend on RLS. Replaced that approach with a SECURITY DEFINER listing RPC that returns only public listing fields, checks authenticated non-anonymous identity, includes sold rows only for their owner, and applies tenant/business filters server-side.
- **Migration:** consolidated into `supabase/migrations/20261020231500_used_item_ads_minimal_directory_read.sql`; deleted the duplicate migration filename/version to avoid migration-history collision. Migration/source/validator commits: `8c3a85006f1e87a9b740d209bf9656e8868a4d10`, `c5e67d49cc764c153fb9519901502e4c95de0561`, `3c7fa872158d4f7b368a9f2051be5a5d69dcee7a`, with source RPC call in `02ddd43b8c4cf80310b6b16135ef43ec965d09d5`.
- **Production boundary:** no migration was applied to the live database. This is committed source/migration code only; exact-head CI and database behavioral tests are required.


### Correction — final used-item read contract
- The column-level grant draft was superseded by the safer backend-RPC design in the current branch version of `20261020231500_used_item_ads_minimal_directory_read.sql`. The function returns only listing fields, rejects anonymous/no-auth callers, and direct table SELECT/INSERT/UPDATE/DELETE is revoked for client roles.
- `web/sector-modules.js` now calls `list_used_item_ads_backend`; it no longer selects from `used_item_ads` directly. The live database migration remains unapplied.


- **Migration immutability correction:** restored the original unmerged `20261020231500_used_item_ads_minimal_directory_read.sql` and moved the RPC implementation to the strictly later `20261020232000_used_item_ads_directory_backend_v1.sql`. This follow-up revokes table-level and column-level browser SELECT privileges, then grants authenticated EXECUTE only on the RPC. Validator updated accordingly. Commits: `861d2eb6410aa18026325f1efa8b7ccf13288e20`, `c6aaa104f2d36318f498a82b1421666e671b51e4`, `89753cf6e26be56f31ec69fb4a82797846c954dc`.


- **Behavioral test coverage added:** disposable PostgreSQL fixture + integration assertions verify owner-only sold listing visibility, active listings, optional tenant/business filters, anonymous/unauthenticated denial, and removal of direct table/column SELECT grants. Wired into the backend boundary workflow; CI result pending. Commits `36cabb5278ee83daa3287d012106e40f5b3472a2`, `88038efaf22afeeefb5e47acd2c3e603824d4b94`, `9c35ef15fc61e29982bd493009931d1454bf5783`, `cadae558830bf29505bde6c8d72e286d99262399`.


- Added `supabase/tests/used_item_directory_read_fixture.sql`, `supabase/tests/used_item_directory_read_integration.sql`, and `.github/workflows/used-item-directory-read.yml`. The integration test exercises privilege boundaries and real RPC behavior in disposable PostgreSQL. Latest “Used Item Directory Read Boundary” status is queued; no test pass is claimed yet.


- **Test consolidation:** reused the existing `Used Item Directory Read Boundary` workflow and integration file instead of keeping a duplicate workflow job. Extended the existing SQL integration to verify direct seller-phone/owner-ID SELECT is revoked; the workflow now applies both the original and follow-up migrations. Updated path filters and static guards. CI pending.


## 2026-10-20 — jobs read authorization boundary

- **Live DB finding:** `jobs` and `job_applications` have no authenticated SELECT privilege. The sector workspace queried both tables directly, which made the job listings/application tabs fail. `jobs` also stores `employer_phone`; applications store `applicant_phone` and `cv_summary_text`, none of which are needed in these list views.
- **Fix:** added `list_jobs_backend` and `list_job_applications_backend` in `20261020233000_jobs_directory_backend_v1.sql`; switched sector loader to RPC calls. Job rows are scope-filtered and omit employer contact; application rows are visible to the applicant or job owner and omit phone/CV. Job employer name is aliased to `company_name` to match the UI.
- **Tests:** disposable PostgreSQL fixture/integration and `.github/workflows/job-directory-read.yml`, plus source-contract assertions. Commits: `00e62d2700a47cb5013373b917cf6a12286ac7d1`, `ed6753fe9b1266245598354b578c3394b0c47471`, `f69e13905855a8ad75124daaa5c0bdb2e89152d0`, `ca3be7eec648b9efd6a9b2fd0ad7699f23d6e1e2`, `8cb6225fdf925c211db651fff65d57f59dc84104`, `eb097141b5f01a01e33371b97aa626a7560e6346`.
- No production migration applied; CI/browser E2E pending.


## 2026-10-21 — marketing lead form validation slice

- Improved the existing marketing lead form in `web/operations-modules.js`: explicit labels and accessible status announcements, bounded text lengths, nonnegative finite budget validation, min/max consistency validation, and duplicate-submit protection while the existing `marketing-lead-create` backend function is pending.
- Added `scripts/validate-marketing-lead-form.mjs` and wired it into `.github/workflows/pages.yml`.
- Source changes are committed on an isolated branch. Exact-head CI is pending; no test result is claimed until observed. Backend behavior, role/RLS behavior, and browser E2E remain NOT VERIFIED. No production data or backend contract changed.


### Follow-up — align marketing lead UI with server contract

- Reviewed `supabase/functions/marketing-lead-create/index.ts` directly. Found a client/server mismatch: the UI previously treated max budget `0` as omitted, while the backend rejects `budget_max < budget_min`. Fixed the client to reject every `max < min` case before sending.
- Added a requested-services field, comma parsing, de-duplication, and client limits matching the existing server contract (at most 10 values, each at most 80 characters); the resulting array is sent as `required_services` instead of always sending an empty array.
- Updated the static validator to cover budget boundary and required-services wiring. CI result is still not confirmed on this head; no test pass is claimed.

- Follow-up UX fix: map known backend errors such as `business_selection_required`, `business_not_authorized`, `unauthorized`, invalid budgets, and invalid service lists to actionable Arabic messages rather than exposing raw machine codes. The static validator now guards these mappings; exact-head CI remains unconfirmed.


## 2026-10-21 — Marketing workspace follow-up — explicit business scope

- Added a business selector to the marketing lead form when the signed-in user has multiple active business memberships; membership retrieval is bounded to 50 rows to match the existing Edge Function lookup limit.
- The selected `business_id` is submitted to the existing `marketing-lead-create` Edge Function, which remains the authority for membership authorization. No direct table write, schema change, migration, production mutation, merge, or deployment was performed.
- Added static source-contract assertions for business selection and payload propagation. CI workflow query has not returned an exact-head run; browser E2E and live authorization behavior remain NOT VERIFIED. Production remains BLOCKED / NOT CERTIFIED.

- Added client-side search to the marketing lead list across title, description, requested services, service area, status, and source. Search operates only on the already-loaded list, which remains filtered by the existing user-scoped query; no expanded backend query or permissions change was introduced.

- Marketing workspace reliability pass: provider, service, project, plan, subscription, participant, and commission tabs now preserve and render query failure states rather than making failed reads look like empty datasets. Added source-contract assertions. No API/schema changes; exact-head CI and browser E2E remain pending.

- Follow-up safety fix: marketing lead creation is blocked when active-membership lookup fails; the UI explains the issue, disables submission, and the submit handler independently guards against sending. Added static source-contract checks. No production mutation, schema change, merge, or deployment.

- Shared overview fix: module overview cards now distinguish failed table reads from true zero counts, showing an explicit Arabic load-failure state. Added source-contract assertion. Exact-head CI/browser verification remain pending; no merge or deployment.

- Shared overview retry: if an overview table read fails, show a clear warning and a retry action that reloads the current module. Added static contract assertions for the retry control and handler. Exact-head CI and browser tests remain unverified.

- Extended retry behavior to non-overview module tabs: failed table reads now expose a visible retry action, with duplicate alert suppression when a tab already renders its own alert. Added source-contract assertions. Exact-head CI and browser verification remain pending.


- Detail-tab retry correction (2026-10-21): preserved a visible retry action on tabs that already render a specific query-error alert, without duplicating the alert. Added a source-contract assertion. Exact-head CI/browser E2E remain unverified; production remains BLOCKED / NOT CERTIFIED.


- MantiGO read-state follow-up (2026-10-21): captain profile lookup and the open-rides RPC now preserve query errors instead of silently mapping failures to missing profile/empty rides. Added source-contract guards. Runtime and browser verification are pending; production remains BLOCKED / NOT CERTIFIED.


- Module-level recovery follow-up (2026-10-21): MantiGO/core module RPC failures rendered through the global error branch now expose a retry action; authentication-required state deliberately does not show a misleading retry button. Added a source-contract assertion. CI/browser verification remains pending; production stays BLOCKED / NOT CERTIFIED.


- 2026-10-21 follow-up: catalog and price reads now require a verified tenant scope before querying; marketing project reads require a verified business scope. Missing scope is shown as a load failure instead of querying without an explicit filter. Added source guards. RLS and tenant isolation still require independent verification.


- MantiGO open-rides follow-up (2026-10-21): removed a second RPC that was triggered from the render path and silently converted errors to an empty list. The tab-click loader remains the single request path and records errors for retry UI. Source-contract guards added; runtime/browser verification remains pending.


- 2026-10-21 budget-validation UX correction: clarified the Arabic validation message so it explicitly states that the minimum budget cannot exceed the maximum. Added a source-contract assertion. This is a wording/UX fix only; runtime, browser E2E, exact-head CI, backend authorization and tenant-isolation verification remain pending.


- 2026-10-21 API payload hardening: `marketing-lead-create` now checks the raw request body's actual `ArrayBuffer.byteLength` before UTF-8 decoding and JSON parsing, rather than using JavaScript string length as a proxy for bytes. Added a source-contract assertion. This closes a multibyte/Unicode size-accounting gap; runtime Edge Function tests, exact-head CI, browser E2E and authorization/isolation verification remain pending.


- 2026-10-21 API input-shape hardening: `marketing-lead-create` no longer coerces objects/numbers into text fields or stringifies invalid service entries. It rejects non-string title/description/service-area/business IDs, non-array or non-string requested services, and non-number budget values; valid omitted budgets still default to zero. Added source-contract assertions. Edge runtime tests and exact-head CI remain pending.


- 2026-10-21 payload-stream hardening: replaced full-body buffering with `readLimitedBody`, which counts incoming stream bytes, cancels the reader as soon as the configured limit is exceeded, and only concatenates chunks after the size check. This avoids allocating an arbitrarily large body before rejection when `Content-Length` is missing or misleading. Added a source-contract assertion; runtime Edge tests and exact-head CI remain pending.
