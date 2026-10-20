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
