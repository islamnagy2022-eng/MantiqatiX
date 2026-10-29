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

## 2026-10-28 — Additive professional dashboard implementation started

- **User requirement:** Add a professional dashboard as a new module alongside the current catalog and administration views; do not remove, replace, or disable existing interfaces or functionality.
- **Repository inspected:** `islamnagy2022-eng/MantiqatiX`, default branch `main`; read `README.md`, `docs/PROJECT_CONTINUITY.md`, `docs/MASTER_PRODUCTION_TODO.md`, catalog frontend package manifest, `App.tsx`, `AppContext.tsx`, `Navbar.tsx`, and current admin/merchant dashboard components.
- **Action performed on isolated branch:** `feat/professional-dashboard-additive-20261028`.
- **Implemented in source:** added `apps/catalog-frontend/src/modules/dashboard/ProfessionalDashboard.tsx`; registered `professional_dashboard` in the existing view type and URL parser; mounted it in `App.tsx` with a role guard; added a navigation entry visible to existing `admin` and `subscriber` roles. Existing dashboard links and public directory/storefront code were retained.
- **Data policy:** the initial screen uses only data already loaded in the existing application context. It does not create demo data or claim financial totals. No database migrations, production data mutations, Supabase policy changes, or deployments were performed.
- **Not verified:** TypeScript/lint, production build, automated workflows, browser rendering, role/tenant isolation E2E, mobile/accessibility behavior, deployed behavior, and regression against existing catalog links.
- **Next action:** inspect the branch diff, run CI/build checks, fix any failures, and only then consider a pull request review. No merge or production deployment authorized/performed.
- **Release status:** production remains **BLOCKED / NOT CERTIFIED**.

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

## 2026-10-21 — SESSION — PR #316 preview entry audit

- **Verified fact:** PR [#316](https://github.com/islamnagy2022-eng/MantiqatiX/pull/316) remains open and Draft; head branch `fix/preview-starts-at-public-home-20261021`, exact head `1368a1583aa42e1905e064bc9a96f181a86d1b62`; base `main` at `e4fcc23dc99c1d9082c4dc237ec09dde85a437ab`.
- **Verified fact:** Changed files are `web/preview/index.html` and `web/preview/dashboard.html`. The entry page redirects to `../`, and the existing public homepage bootstrap is `web/index.html`; the root `index.html` redirects to `./web/`.
- **Verified fact:** Pages workflow `.github/workflows/pages.yml` validates pull requests, uploads only `./web` to Pages, and deploys only when `github.ref == refs/heads/main` and the event is push or workflow_dispatch. PR #316's `validate` job succeeded; its `deploy` job was skipped as intended.
- **Verified fact:** Exact-head checks exposed by GitHub include successful `validate`, `matrimony-privacy-postgres`, `targeted-ads-search-path-integration`, `financial-journal-rc450-integration`, `approval-action-audit-postgres`, and `mantigo-open-ride-privacy-integration` jobs across related workflows; the Pages `deploy` job is skipped. No failing job was observed in the returned check set.
- **Verified fact:** The `main` branch has no `web/preview/dashboard.html` file; the dashboard mock is only on PR #316. The feature entry and dashboard were read from the branch content API, not from the public deployed host.
- **Inference / unresolved:** Current public routes and browser behavior for `/`, `/web/`, `/preview/`, and `/preview/dashboard.html` have **not been runtime-verified** by an HTTP/browser probe in this session. The GitHub connector cannot fetch the Pages host, so no live HTTP status, redirect, JS/CSS load, cache, Service Worker, Supabase connectivity, login, or account-role navigation result is claimed.
- **Action performed:** Read PR metadata/diff, changed paths, Pages workflow, public homepage bootstrap, service worker, TODO, session log, and continuity handoff. No repository writes were made in this audit batch.
- **Not performed:** No merge, Pages deployment, database migration, Supabase production mutation, Edge Function deployment, or authentication/authorization change.
- **Next step:** Use a real browser/HTTP probe on the four public routes and authenticated test accounts; then add focused preview-route tests in a follow-up branch if the current CI/contracts do not cover those paths. Keep PR #316 Draft until that evidence is available.
- **Release state:** **BLOCKED / NOT CERTIFIED**. The main production blockers listed in `docs/MASTER_PRODUCTION_TODO.md` remain open, including authenticated multi-tenant E2E, payment/finance E2E, leaked-password protection, security-definer review, backup/restore, Android signed/device evidence, and browser smoke.


## 2026-10-21 — SESSION — Preview routing contract and CI status follow-up

- **Scope:** PR #316, branch `fix/preview-starts-at-public-home-20261021`, latest inspected head `011834e5e9e2d8f8b0b189bd22976c7cc2e64b39`.
- **Implemented in branch:** added `scripts/validate-preview-navigation.mjs` and wired it into the Pages validation job; the deploy job includes HTTP smoke checks for the published preview entry and demo dashboard after an eligible main deployment.
- **Source review:** the validator currently defines 11 static contract checks for Arabic RTL, preview redirect/fallback, dashboard disclaimer, public homepage boot fallback, public-mode fallback when Supabase is unavailable, Pages artifact root, main-only deployment, and service-worker navigation fallback.
- **CI status at inspection:** run 39616462814 is still queued at job level; its deploy job is correctly skipped for a pull-request event. The latest check-run query returned 15 checks, with 0 completed and no recorded failures. This is pending, not a pass.
- **Not verified:** validator has not been run locally in this session; published-site HTTP smoke, browser login/session, PWA offline behavior, tenant isolation, and production E2E are not certified by these source checks.
- **Safety boundary:** no merge, no main push, no production deployment, no Supabase/database/auth/payment mutation.
- **Next:** investigate stalled queued jobs / obtain CI conclusions; fix any reproduced failures, then verify the published Pages URLs after an authorized main deployment. Keep global release gate BLOCKED until P0 evidence is complete.


## 2026-10-21 — CI completed for preview-navigation PR

- **Observed:** PR #316 head `57d9c20c71dab78a01c8ff50ccf69acb1b3c7818` had successful GitHub Actions checks, including Pages workflow `validate` (run 39616640682) and the targeted backend-only, MantiGO privacy, financial-journal, targeted-ads search-path, matrimony privacy, and approval-action audit jobs. No checks remained pending in the fetched check-run snapshot.
- **Deploy behavior:** Pages `deploy` was skipped on the `pull_request` event as intended by the main-only deployment guard. Therefore the post-deploy HTTP smoke checks for `/preview/` and `/preview/dashboard.html` were not executed for this PR.
- **Live verification limit:** attempted to retrieve both published preview URLs in this session; the fetch tool returned cache-miss errors, which are inconclusive and are not recorded as a site failure or pass.
- **Action performed:** updated item 10 in `docs/MASTER_PRODUCTION_TODO.md` to distinguish successful source CI from the still-unverified deployed-preview smoke and browser E2E.
- **Not performed:** no merge, production deploy, main update, or production data/configuration mutation. Production gate remains BLOCKED / NOT CERTIFIED.


## 2026-10-21 — ERP receiving atomic boundary and release-gate confirmation
- Updated `supabase/functions/erp-purchase-receive/index.ts` to call `receive_purchase_stock_with_order_line_backend` only. Direct REST mutations of `stock_balances`, `erp_purchase_receipts`, and `inventory_transactions` were removed from the Edge Function. If the RPC is missing or fails unexpectedly, the handler returns `ATOMIC_RECEIVING_UNAVAILABLE` (503); no non-atomic fallback exists.
- The request path validates authenticated non-anonymous users, payload size/shape, identifier format, finite positive quantity, finite non-negative unit cost, allowed origin, and passes `user.id` as the actor to the database function.
- Contract validator now asserts the atomic RPC path and finite amount validation. Static source checks confirmed no direct balance update, receipt insert, or inventory-ledger insert remains in the Edge Function.
- CI on commit `3b31c381a011f4972a68b560074ee874a1d16509`: Module Professionalization Validation, Backend-only Module Boundary, MantiGO Open Ride Privacy Boundary, and Production Health Monitor passed. Pages deployment validation failed at `npm run verify:production` with `PRODUCTION_GATE=BLOCKED` because RC425–RC432 and RC434–RC441 migration source files are missing. The deploy job was skipped; this is expected fail-closed behavior, not a code syntax failure.
- Required next: reconcile the competing RC434 migration definitions in draft PRs; recover/review the complete migration chain in order, with collision guard intact; resolve legacy purchase orders lacking lines; run Postgres integration tests for transaction rollback, concurrent duplicate receipt, over-receiving, tenant isolation, and service-role-only grants.
- No production database, Edge Function deployment, or production data was mutated. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-21 — RC434 migration provenance comparison
- Compared the RC434 migration blob in draft PR #271, #273, #282, and #286. All four branches contain the exact same blob SHA `a93a0a6827de15d50632e1deec015e20dd55b405` (6,968 bytes), so the previously noted RC434 source divergence is not present across these four reviewed heads.
- This is provenance corroboration only; it does not prove the migration can safely apply to production or that the complete migration chain is correct.
- Recorded in `docs/MASTER_PRODUCTION_TODO.md`. No migration was merged or applied. All four PRs remain drafts and overlap on source files; the collision guard remains required.
- Next: inspect the entire RC425–RC441 chain as one ordered set, validate RC434/RC437 function signature and integration test alignment, then run disposable Postgres chronological replay and rollback/concurrency/tenant-isolation tests. Keep production blocked until evidence exists.

## 2026-10-23 — RC101 — Provider services management workspace

- Implemented owner-filtered provider-service management in `web/operations-modules.js` using the existing `marketing_provider_profiles`, `marketing_services`, and `marketing_provider_services` tables.
- Added service create/edit, activate/deactivate, and remove actions; validated non-negative finite price bounds, currency/status allowlists, and server-confirmed returned rows.
- Before each mutation, the UI re-queries `marketing_provider_profiles` with both provider ID and authenticated `user.id`; writes remain subject to existing Supabase RLS. No role grant, RLS policy, migration, service-role key, or backend bypass was added.
- Added owner-scoped editing of `service_areas` on the existing provider profile field, with item/length limits. No generic availability or schedule table was introduced.
- Added `scripts/validate-provider-services-contract.mjs` and wired it into Pages validation.
- Static contract/CI result for the final commit: PENDING at the time of this log entry; do not infer pass from source edits.
- Not verified: actual browser interaction, two-account cross-provider denial, live schema compatibility under a real authenticated provider, and full orders/bookings regression.
- No merge, production deploy, or production data mutation performed. Production release remains BLOCKED / NOT CERTIFIED.

## 2026-10-23 — C3 orders/bookings source review after RC101

- Reviewed `supabase/functions/order-create/index.ts`: requires a Bearer session, rejects anonymous users, validates active business/branch and catalog/pricing, and delegates creation to `create_order_backend`; server pricing is authoritative.
- Reviewed `supabase/functions/order-status-update/index.ts`: requires authenticated non-anonymous user and delegates state changes to `update_order_status_backend` with the caller ID and tenant context.
- Reviewed the existing booking/payment contract validator and medical booking migrations: the contract checks caller identity, active provider/membership, duplicate appointment IDs, role-gated medical status changes, and status allowlisting. The validator also guards against direct browser writes to central orders/payment intents.
- No new order or booking schema/API was added; no payment or production transaction was created.
- **Still NOT VERIFIED:** browser E2E from customer discovery through order creation and provider status transition; two-tenant/cross-provider isolation; medical booking concurrency and notification delivery; Paymob payment/refund runtime E2E.
- Next C3 action: run exact-head CI once available, then browser/integration E2E with disposable authorized identities; keep release blocked meanwhile.


## 2026-10-23 — RC103 — Restaurant order branch authorization
- During source review, found that `order-create` selected an active membership by tenant/business but did not bind operational staff to the requested branch. Added exact-branch membership filtering for staff-context creation.
- Found that `update_order_status_backend` permitted operational memberships by business without checking the order branch, and treated any OWNER/ADMIN membership as tenant-wide. Added branch-only RC103 migration: operational roles and business-scoped OWNER/ADMIN must match the order's business and exact branch; only unscoped tenant-wide OWNER/ADMIN memberships retain tenant-wide access.
- Preserved customer cancellation of their own order, the existing state-transition allowlist, and paid-order cancellation protection.
- Added an isolated PostgreSQL 16 fixture and behavior tests for same-branch success, cross-branch rejection, cross-business admin rejection, tenant-wide owner compatibility, customer cancellation, invalid transition rejection, and paid-order cancellation rejection. Dedicated CI workflow passed on code head `0fb3032f3d578c651d7de0ee16bc1977518c02d6`.
- Fixed a duplicate `async` keyword found by CI, corrected a malformed contract-test regex, and aligned the modal-save assertion with keyboard-listener cleanup. Exact-head CI on `0fb3032f3d578c651d7de0ee16bc1977518c02d6` passed all 11 workflows, including Preview Demo Validation, migration uniqueness/history/collision guards, provider-service owner isolation, backend-only module boundary, module professionalization, MantiGO privacy, approval-audit atomicity, and RC103 branch-scope PostgreSQL behavior.
- No production migration execution, production data writes, payment transactions, merge, or deployment occurred. RC103 remains branch-only; PR #350 remains draft/unmerged.
- **Still NOT VERIFIED:** real browser E2E with distinct authorized staff accounts, end-to-end customer order creation and staff status transitions on the live stack, Paymob payment/refund runtime, backup/restore drill, and full release evidence. Production remains **BLOCKED / NOT CERTIFIED**.

## 2026-10-23 — RC108 — bounded order-create request contract

- Hardened `supabase/functions/order-create/index.ts` to reject request bodies larger than 256 KiB before JSON parsing, including an actual encoded-byte check rather than relying only on Content-Length.
- Added object-shape validation and explicit maximum lengths for customer name (200), phone (32), delivery address (500), and notes (2,000).
- Client-supplied metadata is now limited to the supported `source` and `catalog_authoritative` keys with type/length checks; the server still appends authoritative pricing metadata.
- Updated `scripts/validate-booking-payment-flow.mjs` to enforce these source contracts.
- CI on the preceding head passed all 12 workflows; exact-head CI for RC108 is pending/rechecking and must pass before this change is considered verified.
- No production Edge Function deployment, database migration, order creation, payment, merge, or production data mutation occurred. Production release remains **BLOCKED / NOT CERTIFIED**.

## 2026-10-23 — RC109 — Bounded streaming for order-create payloads

- Replaced whole-body `req.text()` buffering with a streaming reader that stops once the 256 KiB limit is exceeded, cancels the request stream, and decodes UTF-8 strictly before JSON parsing.
- Extended `scripts/validate-booking-payment-flow.mjs` to assert bounded streaming, early stop/cancellation, malformed UTF-8 rejection, duplicate/oversized selected-option rejection, and finite final totals.
- Prior exact head `7330fd1a7014aaed15ad0c373cf140a1c7c0ae1f` passed all 12 PR workflows. RC109 changes are on a new head and require a fresh exact-head CI run.
- No merge, production deployment, production migration, payment transaction, or production data write occurred. Release remains **BLOCKED / NOT CERTIFIED**.

## 2026-10-23 — RC110 — Controlled order-option mismatch handling

- Reviewed the selected-option pricing path after RC109 streaming hardening.
- Replaced an unhandled thrown exception for an option attached to the wrong catalog item with a controlled `OPTION_ITEM_MISMATCH` HTTP 400 response before price calculation.
- Added source-contract assertions that require the controlled error and pre-calculation validation.
- Exact-head CI for this source/test update is running on `8dfa86ba97c3af6980fa2974b745500b6ab38e88`; all 12 workflows were queued/pending at the first status poll. Do not claim the new head passes until all are completed successfully.
- No production deployment, migration, payment transaction, or production data write occurred. PR #350 remains draft/unmerged; production release remains **BLOCKED / NOT CERTIFIED**.

## 2026-10-23 — Preview 404 investigation — deployment gate is blocking publication

- Confirmed the preview source files exist on `main`: `web/preview/index.html` and `web/preview/dashboard.html`. The Pages workflow publishes `./web`, so the intended routes are `/preview/` and `/preview/dashboard.html` under the project Pages base URL.
- Read the main-branch Pages run `39742731869` for commit `c96da6959e7d66a7920164eb9e8bb6e6c5667012`. Its `validate` job failed in `npm run verify:production`; the deploy job was skipped.
- The production gate explicitly reports missing authoritative migration sources RC425–RC432 and RC434–RC441, and says chronological replay, tenant isolation, payment/finance E2E, backup/restore, Edge Function contracts, SMM parity, and Auth security settings are not verified.
- Therefore the current 404 is consistent with the preview route not being included in the currently published Pages artifact; it is not evidence that the preview HTML files are missing from source. Public-site HTTP fetch was inconclusive in this session, so live HTTP status is not independently confirmed.
- Safety decision: do not bypass the production gate or publish the entire production site from a feature branch merely to restore the preview. The correct deployment fix is to restore/review the missing migration chain and clear the release gate, or provision a separately approved preview host that cannot replace production.
- No merge, Pages deployment, production migration, or production data mutation was performed.

## 2026-10-24 — Paymob correlation helper runtime safety and checkout reconciliation

- [x] Converted `supabase/functions/_shared/paymob-intent-correlation.mjs` to valid plain JavaScript; removed TypeScript-only annotations from the `.mjs` module.
- [x] Added `scripts/test-paymob-intent-correlation.mjs` covering exact-cent validation and fail-closed amount/currency/reference/provider-ID/client-secret checks.
- [x] Added the correlation tests to the RC431 payment integration workflow so changes to the helper or its tests trigger the test job.
- [x] Local Node syntax check and correlation tests passed in the working environment.
- [x] Subscription checkout encryption failure now retains the already-correlated Paymob intention/order IDs and marks the intent `RECONCILIATION_REQUIRED`, preserving operational traceability without exposing the checkout secret.
- [x] Updated the payment migration wiring validator to assert that failure-recovery contract.
- [ ] Current-head GitHub Actions rerun is pending; do not treat previous-head green checks as proof for the latest commit.
- [ ] Production release remains `BLOCKED`: no production migrations/functions deployed; backup/restore rehearsal, payment/finance E2E, live Auth settings, Edge Function contracts and SMM gateway parity remain unverified.
## 2026-10-27 — SMM initial-launch deferral and legacy client retirement

- Confirmed the current `main` source keeps SMM explicitly deferred in `supabase/functions/smm-gateway/index.ts`; PRs #306/#307 describe SMM as post-launch and separate from core Marketing & Advertising. This is a launch-scope deferral, not approval to remove the backend or rewrite historical migrations.
- Removed the unused interactive SMM browser client assets (`web/smm.js`, `web/smm.css`) while retaining `web/smm.html` as a noindex, non-interactive unavailable notice.
- Replaced obsolete auth/workflow dependencies on `web/smm.js` with a focused CI contract that checks the placeholder and confirms the server-side default-deny gate, SMM authorization validator, and RC456 historical migration remain present.
- Corrected README deployment notes: the Pages workflow publishes the validated `apps/catalog-frontend/dist` artifact after full production verification; the legacy `web/` tree remains source/contract material and is not the deployed artifact in this workflow.
- No production schema, production data, Auth settings, Supabase grants, Edge Function deployment, payment, or wallet was changed. No historical migration was deleted or modified.
- Verification status: static contract is added and will be evaluated by exact-head CI; do not mark it verified until GitHub Actions reports the result. Production remains `BLOCKED / NOT CERTIFIED`; the live deployed SMM gateway's default-deny state still requires version/hash evidence and runtime negative tests.
- Next actionable blockers: recover/reconcile post-RC424 migration sources and ledger state; refresh the exact-head production verifier; continue isolated payment/finance E2E and backup/restore evidence. Do not bypass the full production deployment gate.


## 2026-10-27 — Exact live migration-source reconciliation

- Read-only queried the Production `supabase_migrations.schema_migrations.statements` values for live versions `20261027010135`, `20261027041411`, and `20261027041549`.
- Exact string comparison against the recovered/canonical source files passed for all three entries (5487/5487, 1114/1114, and 1106/1106 characters respectively).
- Added the exact-version Qadam catalog source from the recovery branch; replaced the future-timestamp marketing contact source with the live versioned source; restored the Qadam contact repair under its exact live ledger version.
- Removed the redundant pending marketing migration at `20261027100000` because it duplicated the already-applied `20261027041411` statement exactly. Left the distinct Qadam follow-up migration at `20261027093000` unchanged for separate review.
- Updated the reconciliation manifest to reflect the live ledger tail (292 entries through `20261027041549`) and the exact-match evidence. The overall release status remains `BLOCKED / NOT CERTIFIED` because RC425–RC441 and the broader payment/finance, restore, live Edge Function/Auth, and browser/device gates are still unresolved.
- All actions in this continuation were repository/documentation changes and read-only Production queries. No Production data/schema/function/grant/Auth changes, migration execution, payment, wallet mutation, or deployment occurred.


## 2026-10-27 — Live SMM gateway source parity read-back

- Read-only retrieved the active Production `smm-gateway` Edge Function: version 13, `verify_jwt=true`, deployed bundle SHA-256 `a45cee9f5c90beba2c2409ba4fe2927f5be3df4965fb3929f5b7d467b3121b72`.
- Exact comparison passed for all 7 deployed TypeScript files against `main`: `index.ts`, `launch-gate.ts`, `provider-transport.ts`, `order-status.ts`, `catalog-normalization.ts`, `order-validation.ts`, and `request-validation.ts`.
- Deployed source contains `SMM_INITIAL_LAUNCH_DEFERRED=true` and fails closed with `SMM_DEFERRED` before request processing. The interactive browser assets remain retired.
- Runtime negative tests for anonymous and authenticated callers remain NOT VERIFIED; the overall production release gate remains BLOCKED. No function deployment or environment/configuration mutation occurred.


## 2026-10-27 — Schema-only checkpoint replay diagnosis

- [x] Inspected Forward Migration Chain Replay run [40493639400](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40493639400): it failed at `20261027010135_add_qadam_alsaad_homewares_store_and_catalog.sql` because the restored checkpoint is schema-only (`data_included=false`) and therefore lacks `MNTY-PLATFORM`.
- [x] Read-only Production checks confirmed the platform tenant and referenced owner auth identity exist in the live database. No production data was copied or changed.
- [x] Added `supabase/tests/baselines/production_data_prerequisites_fixture.sql` with only deterministic test data for those pre-existing dependencies, guarded by the explicit disposable flag. Added a local-host URL guard to the replay workflow.
- [ ] Re-run forward replay and review the next failure or full pass. The current candidate remains NOT VERIFIED until the updated workflow completes; Production Gate stays BLOCKED.


## 2026-10-27 — Forward replay remediation verified

- [x] The initial candidate run [40493639400](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40493639400) exposed a test-fixture gap: the schema-only checkpoint does not include the pre-existing `MNTY-PLATFORM` tenant or the historical Qadam owner auth identity. No Production data was copied.
- [x] Added the guarded disposable-only prerequisite fixture `supabase/tests/baselines/production_data_prerequisites_fixture.sql` and a local DB URL guard in `.github/workflows/forward-migration-chain-replay.yml`.
- [x] The corrected replay [40494929976](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40494929976) passed: 52 post-checkpoint migrations replayed in timestamp order; RC117 default-image/activity-admin contract passed; synthetic two-tenant checks passed for own-row read and cross-tenant write denial on orders/payment intents. Migration history immutability, version uniqueness, cross-PR collision, RC425 Paymob atomicity, SMM deferred storefront, backend-only boundary, MantiGO privacy, and module validation checks passed at the recorded head.
- [x] The web deployment workflow returned success at the workflow level but both `validate_public_only` and `deploy` were skipped; no Production deployment occurred.
- [ ] Overall release remains `BLOCKED / NOT CERTIFIED`: isolated replay does not prove that the RC425–RC441/post-RC424 migrations have been applied to Production. Payment/finance provider E2E, backup/restore rehearsal, live Auth and Edge Function runtime validation (including SMM negative tests), browser/device regression, monitoring/alerts, and rollback evidence remain NOT VERIFIED.
- Safety: all test records were created only in a disposable local Supabase instance; no Production write, migration, Auth/grant/RLS edit, Edge Function deployment, payment, or wallet mutation occurred.


## 2026-10-27 — Critical Edge Function source drift recheck

- [x] Read-only retrieved current Production function entrypoints and compared each `index.ts` exactly against `main`. Drift remains in `payment-intent` v8, `paymob-webhook` v10, `digital-page-payment-intent` v5, `subscription-payment-intent` v4, and `financial-journal` v3; exact sizes, bundle SHA-256 and observed differences are stored in the release reconciliation manifest.
- [x] `financial-journal` live source uses `Access-Control-Allow-Origin: *` and calls `post_financial_journal`; current `main` uses an origin allowlist and `post_financial_journal_backend`. Live `paymob-webhook` lacks main's `Number.isFinite(amount)` guard; payment-intent sources also differ in Paymob correlation-helper integration.
- [x] `smm-gateway` v13 entrypoint exactly matches `main`; this is source evidence, not anonymous/authenticated runtime evidence.
- [ ] Keep all five drifting functions off the deployment path until their migrations/grants are reconciled and payment/webhook/finance sandbox acceptance passes. Do not deploy or change managed Auth settings as part of this source audit.
- Safety: read-only source retrieval only; no live function changes or Production writes occurred.


## 2026-10-27 — Financial journal RPC and schema preflight

- [x] Read-only live migration query confirms RC449A `20261010175000` and RC450 `20261010180000` are not recorded.
- [x] The journal schema preflight found the required post-RC449A fields absent: `journal_entries.entry_number`, `total_debit`, `total_credit`, `posted_at`, and `journal_entry_lines.line_number`. The legacy prerequisites inspected by RC449A are present.
- [x] Effective ACL and catalog inspection found both `post_financial_journal(jsonb,jsonb)` and `post_financial_journal_backend(uuid,jsonb,jsonb)` owned by postgres with ACL `{postgres=X/postgres}`; `service_role`, `authenticated` and `anon` have no EXECUTE privilege. The deployed `financial-journal` v3 calls the old RPC, while `main` calls the RC450 backend RPC.
- [x] Aggregate read-only counts for `journal_entries`, `journal_entry_lines`, `general_ledger`, `payment_intents`, `subscription_payment_intents`, `erp_purchase_orders`, `erp_purchase_receipts`, `smm_orders`, and `smm_wallet_transactions` returned zero. No RPC was invoked.
- [ ] RC449A → RC450 requires isolated/staging replay, effective privilege verification, finance posting and replay/idempotency tests, backup/restore and rollback approval before any Production change. No database change or function deployment occurred.


## 2026-10-27 — Full 34-version ledger and RC451 live catalog audit

- [x] Read-only LEFT JOIN of every exact migration version listed in `scripts/production/verify-production.mjs` returned **0/34** recorded in the 292-row live ledger, although the source files are present on `main`.
- [x] Read-only catalog inspection confirms `get_mnty_targeted_advertisements` is SECURITY DEFINER, executable by `anon` and `authenticated`, and configured with `search_path=public, pg_temp`; required RC451 (`20261010200000`) is absent from the live ledger. Its public ad-discovery EXECUTE boundary is intentional; only search_path hardening is required by RC451.
- [x] Manifest now records all 34 required versions, the missing-version list, the targeted-ad search_path drift, and advisor counts (one anon-executable SECURITY DEFINER function, 48 authenticated-executable ones, and one RLS-enabled table without policies).
- [x] The strict contract now requires exact version-list parity and an explicit RC451 live catalog PASS, in addition to RC449A/RC450 journal prerequisites, object state and six critical Edge Function source matches. Synthetic pass/fail fixtures cover the new blockers.
- [ ] Production remains BLOCKED / NOT CERTIFIED. No Production migration, data write, grant/RLS/Auth change, Edge Function deployment, payment or wallet mutation occurred.


## 2026-10-27 — Object-level live schema inventory

- [x] Parsed all 34 required migration SQL files on `main` and cross-checked 39 function names, 4 tables and 13 selected indexes against the live catalog using read-only SQL.
- [x] Results: 21 of 39 required function names absent; all 4 required tables absent; 12 of 13 selected indexes absent (one matrimony unlock index exists by name). Eighteen function names exist, but some have known wrong signatures/config/ACL, and all remaining existing functions still need body/ACL parity where applicable. Detailed entry-by-entry inventory is in `docs/release/production-source-object-drift.json`.
- [ ] No Production migration is authorized by this inventory. The live schema contains later-dated October 26–27 migrations, so the remediation must be tested against the current schema/ledger in a disposable or staging clone, with backup/restore and rollback rehearsed first.
- Safety: no Production write, migration, grant, RLS/Auth change, Edge Function deployment, payment or wallet mutation occurred.

## 2026-10-27 — Expanded gate and Qadam owner membership finding

- [x] Added six RC113–RC117 feature migration versions plus `20261027093000_add_qadam_alsaad_homewares_store.sql` to the distinct required release list; total is now **41**. Read-only query confirms 0/41 required versions in the 292-row Production ledger.
- [x] The six feature migrations' live catalog effects are absent: 17 named function contracts, four tables, seven indexes, three default-image triggers, and two `marketing_services` image columns are not present.
- [x] Qadam follow-up comparison confirms all 15 expected product names/modes/categories/source tags and all 12 prices match; three products correctly use contact-for-price and no stock tracking is enabled. The OWNER membership `MNTY-QADAM-ALSAAD-OWNER` is still `INACTIVE`, while the unrecorded migration sets it ACTIVE.
- [x] Identified two exact alias source files to reconcile through the controlled migration-history process: RC424 file version `20261009010000` matches applied ledger version `20261008222845`; `20261027100000` is the same source blob as recorded `20261027041411`. No repair commands were run.
- [ ] Keep release blocked pending current-schema rehearsal, backup/restore/rollback approval, 41 distinct migration versions, alias ledger repair, owner membership activation, live RPC/Edge Function parity and remaining runtime gates.
- Safety: read-only Supabase SQL/catalog queries only; no Production changes, migration application, ledger repair, grants, Auth/RLS, Edge Functions, payments or wallets were touched.

 
## 2026-10-28 — deployed catalog pilot verification and demo-route retirement

- Verified successful canonical Pages deployment and post-deploy smoke tests for the existing platform root and the separate catalog subpath.
- Verified exact live/main source parity for `catalog-platform-admin` v3, `catalog-admin` v14, `public-catalog-directory` v2 and `public-catalog` v2.
- Read-only database checks confirm Qadam's active owner membership/provider profile and 15 active catalog items (12 priced; 3 contact-for-price).
- Read-only Supabase migration inventory is 293 entries through `20261027205405_catalog_pilot_owner_profile_repair`; all 41 full-platform required migration versions remain absent. The broader production gate stays BLOCKED.
- PR #447 is removing demo-tour/SMM links from the public homepage, replacing the demo tour with the real catalog entrypoint, excluding demo routes from the production artifact, and preventing the preview workflow from publishing. CI failure on the first iteration exposed stale validators that required the demo link; the production-content contract was updated to require the real catalog CTA and reject demo routes. Latest-head CI is pending.
- No payment-intent, webhook, order, finance, SMM or MantiGO functions were deployed in this work. Do not certify the full platform until the remaining production gates have evidence.

 
## 2026-10-28 — RC451 targeted-ad search_path forward repair

- Read-only production inspection confirmed `public.get_mnty_targeted_advertisements` was `SECURITY DEFINER` with `search_path=public, pg_temp`; its four application-table references are schema-qualified and anon/authenticated EXECUTE is intentional.
- Added and tested the guarded forward-only repair `20261027223523_rc451_targeted_ads_search_path_forward_repair.sql`. It changes only the function search_path, checks the function/grant contract before and after, and refuses to proceed if unqualified references to the known application tables are detected.
- Applied the migration to live Supabase as version `20261027223523`; read-only post-check confirmed the live statement matches the checked-in SQL exactly, `search_path=""`, anon/authenticated EXECUTE remain enabled, PUBLIC EXECUTE remains absent, and the live RPC returns 3 rows.
- The original RC451 version `20261010200000` remains absent from the original required-version ledger list. Its effect is reconciled by the forward repair; no historical migration was edited or marked applied. The full platform gate remains BLOCKED by the other missing migration versions, critical order/payment/finance Edge Function drift, finance prerequisites, and unverified payment/finance E2E, backup/restore, Auth, and SMM runtime evidence.
- The Supabase security advisor may still count the intentionally anon-callable SECURITY DEFINER RPC; the risky search_path configuration is fixed, and the public-discovery grant was deliberately preserved.

 
## 2026-10-28 — Functional-group icon-card redesign

- Updated `apps/catalog-frontend/src/components/DirectoryView.tsx` to replace functional-group cover images with consistent Lucide SVG icons, light cards, accessible selected-state styling, and the existing responsive ten-column extra-large layout.
- Kept the group counts and selection/filter behavior in the existing directory component; removed the old functional-group cover map and unused icon imports.
- Added regression assertions in `scripts/validate-canonical-activity-taxonomy.mjs` for the 18 group-to-icon mappings, no return to cover-image cards, the responsive grid, light card styling, and selected-state accessibility.
- Source was read back from GitHub after commits `1a93658e7846a6b0917e0307bedac333077942f0`, `75148b398a95146d04b24dd67977a8b066cbce1a`, and validator fixes `287e86f65947c759466068ab0cac61cc0467a34f` / `f865cf337d3c7400aeac9f2c4a3a26498a0a0de0`.
- Exact-head CI status is not available from the current status/run query; local build and browser verification were not run in this environment. Do not mark the visual change as deployed/verified until Pages workflow and live-page checks confirm it.


### Follow-up — subscriber context scoping

- Code review found that the existing `currentBusiness` selector only applied the subscriber-specific business lookup in `merchant_admin`. Extended that same existing scope to `professional_dashboard` so the new view resolves the subscriber's assigned business instead of relying on a global/selected-business fallback.
- Commit: `f2527d23e33fbf88fc6e66a5c6a5e97ad6c48542`.
- This is source-level review only; no TypeScript build or tenant-isolation test has yet verified the behavior.


## 2026-10-28 — Professional dashboard expanded and regression guard added

- Extended the dashboard beyond the initial scaffold with a responsive RTL sidebar, live-context status counters, category distribution, a six-month chart computed only from recorded business creation dates, status-derived alerts, activity search and filters (name/status/category/governorate), and clear empty/error states.
- Administrative shortcuts route into the existing admin `businesses`, `subscribers`, and `settings` tabs. Owner shortcuts use a new optional `merchantTab` deep-link parameter for the existing `employees` and `profile` tabs. The default merchant tab remains `products`; the parameter is removed when leaving merchant administration.
- Added `scripts/validate-professional-dashboard.mjs` and a step in `.github/workflows/pages.yml` to protect the additive route, role gate, subscriber scoping, data-backed metrics, filters and owner deep links.
- No schema/migration changes, production data mutations, fake financial metrics, invented audit events, secrets, merges or production deployments were performed.
- TypeScript/build validation is being executed by the PR workflows for the current code; browser E2E, direct API authorization, RLS/tenant isolation, accessibility/manual responsive checks and deployed behavior remain unverified until evidence is collected.
- PR: [#483](https://github.com/islamnagy2022-eng/MantiqatiX/pull/483) (draft). Branch remains isolated from `main`; overall release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-28 — Exact-head dashboard build/static CI results

- **Exact tested head:** `4bbf141dad21a919677e34cad60f7b677b17f9a8` on the isolated dashboard branch.
- **PASS — Primary Catalog Frontend Validation:** [run 40736278224](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40736278224). TypeScript check, main catalog build, public root/PWA checks, Google OAuth callback relay smoke test, and public catalog API smoke test passed.
- **PASS — Deploy MantiqatiX Web validation job:** [run 40736278305](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40736278305). The build/type-check step and `Validate additive professional dashboard contract` step passed, as did subsequent validation steps. The actual production deploy job was skipped on the pull_request event.
- **PASS — Module Professionalization Validation:** [run 40736278182](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40736278182).
- An earlier attempt of the new static validator failed because of incorrect escaping in its regex for the merchant deep-link. The issue was corrected; the cited exact-head run passed the corrected validator.
- **NOT VERIFIED:** browser E2E/visual tests; direct dashboard route refresh through a real authenticated session; negative role tests; backend authorization/RLS tenant-isolation; manual keyboard/mobile accessibility; production deployment.
- No merge, production deployment, schema/data change, payment, or credential mutation occurred. Draft PR #483 remains open. Overall platform release status remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-28 — Final dashboard branch validation and unrelated CI contract correction

- **Exact tested source head:** `5690c667f312206d8bd32c001c913ac8628bb0d2` on the dashboard feature branch.
- **PASS — Primary Catalog Frontend Validation:** [run 40736940379](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40736940379). TypeScript check, catalog build, root/PWA checks, Google OAuth callback smoke test, and public catalog smoke test passed.
- **PASS — Deploy MantiqatiX Web validation job:** [run 40736940282](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40736940282). Build/type-check, additive dashboard contract, catalog API smokes, production gate reporting, and the full syntax-validator list passed. The real deploy job remained skipped on the pull_request event.
- **PASS — Module Professionalization Validation:** [run 40736940498](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40736940498), including its validation and Postgres integration jobs.
- A separate existing validator, `scripts/validate-canonical-activity-taxonomy.mjs`, failed because it required the exact text `bg-white p-3 text-center`, while the branch's functional-group card uses responsive `bg-white p-1.5 sm:p-3 text-center`. Updated the assertion to accept both responsive variants. This changed the validator only; no catalog UI or data behavior changed. The final exact-head syntax validator passed after the correction.
- **NOT VERIFIED:** authenticated browser E2E and refresh of the dashboard deep link, negative role tests, direct API/Supabase RLS tenant isolation, manual keyboard/mobile accessibility, QR/share-link regression on a real deployed dashboard, and production deployment of PR #483.
- No merge, production deploy, schema/data mutation, payment, wallet change, or credential change performed. PR #483 remains draft. Full platform gate stays **BLOCKED / NOT CERTIFIED**.


## 2026-10-28 — Dashboard integration rebased on current main and CI reverified

- Rebuilt the feature branch tree on current `main` baseline `b5e5b22cc4bbef93e2d184a39c00e971115af253`, preserving all current main changes and layering the 19 intended dashboard/docs/validation files. The feature branch is now one integration commit ahead of main; `main` itself was not changed.
- Exact source head `fce2f08d92f36d6bc6830fad8f9ac29df618593d` passed the Pages validation workflow: TypeScript/lint, catalog build, dashboard static contract, runtime permission matrix, smoke tests, production-gate reporting, full syntax validators and artifact-composition validation — [run 40773802038](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40773802038).
- Supporting workflows also passed: [Backend-only Module Boundary 40773802088](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40773802088), [Module Professionalization 40773802241](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40773802241), [MantiGO privacy 40773802071](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40773802071), and [Catalog Admin CORS 40773802329](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40773802329).
- The Pages deploy job remained skipped on the feature-branch run. No merge/deploy/production data or schema mutation occurred.
- Remaining gates: authenticated browser route refresh and denial E2E, direct API/RLS tenant isolation for dashboard/employee operations, keyboard/mobile accessibility, and deployed dashboard/share-link regression. Full production gate remains `BLOCKED / NOT CERTIFIED`; PR #483 stays draft pending those checks.


## 2026-10-28 — Final membership-selection fix and exact-head CI rerun

- Fixed selected membership resolution so business-specific OWNER/BUSINESS_OWNER/ADMIN membership takes precedence over a newer employee row; a tenant-wide OWNER is considered only for businesses in the same tenant. Lower-scope MANAGER/employee memberships remain limited.
- Updated the dashboard contract validator to guard this selected-membership precedence and tenant-wide owner scope.
- Exact current source head `d243a4fdcb3449bf0b49ba6b7290c123ecd0bce2` passed [Pages validation run 40774358276](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774358276): build/type-check, dashboard contract, permission matrix, smoke tests, production gate report, syntax validators and composed-site checks. Supporting workflow runs passed: [Backend-only 40774358272](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774358272), [Professionalization 40774358297](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774358297), [MantiGO privacy 40774358269](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774358269).
- The feature branch is based on current main and GitHub reports it as mergeable. The actual deploy job remained skipped on the feature branch; no production deployment occurred.
- Browser E2E, direct API/RLS tenant isolation, live share/QR behavior and accessibility are still not verified. PR #483 remains Draft; overall platform production gate remains `BLOCKED / NOT CERTIFIED`.


## 2026-10-28 — OAuth role-contract assertion corrected for centralized dashboard guard

- The primary catalog workflow initially failed because `scripts/validate-catalog-google-auth-contract.mjs` asserted the previous inline role condition `!['subscriber', 'admin'].includes(authSession.role)`. Replaced that literal check with assertions for both centralized guards: `canAccessMerchantDashboard(authSession)` and `canAccessProfessionalDashboard(authSession)`; the original role-gating requirement is retained.
- Exact source head `1131b669bf1ab5bf303162638f535e01f0ae043f` passed Pages validation [run 40774776775](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774776775), primary catalog [run 40774776818](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774776818), legacy catalog [run 40774776772](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774776772), backend-only [run 40774776728](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774776728), module professionalization [run 40774776870](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774776870), MantiGO privacy [run 40774776773](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774776773), RC425 atomicity [run 40774776799](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774776799), SMM deferred storefront [run 40774776883](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774776883), and flexible commission contract [run 40774777126](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774777126).
- GitHub reports the PR cleanly based on current main (6 commits ahead, 0 behind); it remains Draft because authenticated browser E2E and direct API/RLS tenant isolation have not been tested. The deployment job was skipped on the feature branch; no production deployment occurred. Production gate remains `BLOCKED / NOT CERTIFIED`.


## Branch-shape correction — final PR comparison (2026-10-28)

- The earlier entries recorded the initial rebase at its then-current 19-file/6-commit comparison. After adding the OAuth role-contract test update and its documentation, the final PR comparison has **20 changed paths** and is cleanly based on current `main` with no commits behind it. The main branch was not modified directly.
- Source/code head `1131b669bf1ab5bf303162638f535e01f0ae043f` passed all PR workflows; the final docs-only follow-up also passed Pages, backend-only, module professionalization and MantiGO workflows on `64c9160abcf44f40725d1ee0594bc6b51ab23988`.
- PR #483 remains Draft. Live browser E2E and API/RLS tenant-isolation checks remain unverified; do not merge into main because the main push would invoke the production Pages deployment path. No production deployment occurred.
## 2026-10-28 — Dashboard permission hardening and exact-head E2E verification

- Added forward-only migration supabase/migrations/20261028225000_rc457_business_employee_permission_ceiling.sql. It prevents employee/job-position permission templates from exceeding the caller's scoped permission ceiling, requires employee overrides to be subsets of the selected position template, preserves tenant-wide owner scope, and adds a branch-aware mnty_business_employee_list_scoped RPC. Historical RC113–RC115 migrations were not edited.
- Updated the professional dashboard authorization helper to fail closed for raw MANAGER memberships because the server-side permission resolver does not currently use that membership role as a grant source. The broad legacy merchant dashboard remains limited to explicit supported management roles.
- Carried the exact selected membership's branch_id through AuthSession into BusinessEmployeeManager; roster reads and create/update calls now pass that scope to guarded RPCs.
- Added disposable PostgreSQL integration coverage for direct table privileges/FORCE RLS, employee view-vs-write, permission-template escalation, employee override escalation, tenant-wide owner access, branch-only owner boundaries, branch roster filtering, cross-tenant denial, and anonymous/unassigned denial.
- Added Chromium E2E against the built catalog preview. The suite passed guest direct-route denial, owner route and refresh restoration (including owner membership precedence), scoped employee view-only behavior, read-only roster UI, and unsupported-manager denial.
- PASS — tested code head 1b00c1afbbfd7509a00627defce1530b927d74ec: [Primary Catalog Frontend Validation](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40789982603) passed TypeScript/build, production OAuth/public directory smoke checks, PostgreSQL permission integration, and Chromium browser E2E. [Forward migration checkpoint replay](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40789976555), [migration history immutability](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40789982652), [migration version uniqueness](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40789982510), and [open-PR migration collision guard](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40789982601) passed.
- Production was not changed: the feature-branch Pages deployment job was skipped. PR #483 remains Draft/unmerged until real-origin share/QR regression and manual accessibility/mobile review are completed. The broader production gate stays BLOCKED / NOT CERTIFIED due to unrelated platform release gates.

## 2026-10-29 — Professional dashboard final CI and production dependency gate

- Latest tested source head: \`83e47f39dad8480c94b5c21171ea4ace7827147d\` on \`feat/professional-dashboard-additive-20261028\`; PR #483 remains Draft and unmerged.
- Primary Catalog Frontend Validation [run 40792920117](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40792920117) passed TypeScript/lint, catalog build, OAuth/public-directory smoke checks, isolated PostgreSQL employee RBAC/tenant/branch integration, and Chromium E2E. Browser tests include branch-scoped OWNER denial of the broad legacy route and verification that employee roster RPCs carry the active branch ID.
- Migration history immutability [40792920047](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40792920047), version uniqueness [40792920079](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40792920079), open-PR migration collision guard [40792919994](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40792919994), backend-only [40792920038](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40792920038), and the Pages PR validation [40792920126](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40792920126) passed. The actual Pages deploy job was skipped because this is a feature-branch/PR validation.
- Read-only inspection of Supabase production project \`moyhiluyhjsujhwlyeuu\` confirmed that the RC113/RC114 role/employee tables and RC115/RC457 role and employee RPCs are missing. The release reconciliation manifest records 41 required full-platform migration versions missing from its live ledger and full platform gate remains \`BLOCKED\`.
- Added \`scripts/production/verify-professional-dashboard-dependencies.mjs\` plus \`scripts/validate-professional-dashboard-production-dependencies.mjs\` and wired both into the Pages validation path. The CI semantics test passes: feature/PR validation continues with an explicit BLOCKED dependency notice, while a main push/workflow dispatch fails the production validate gate until live dashboard dependencies are evidenced as present.
- No production database mutation, migration-ledger repair, merge, or production deployment occurred. Do not blindly apply the remaining release migrations or mark old versions as applied. The app/dashboard code and isolated tests are complete, but live deployment remains blocked on controlled schema/migration reconciliation and real-account/device review.


## 2026-10-29 — Membership scope, tenant/branch authorization and replay verified

- Unified the production bootstrap membership selector so the membership that determines the user's dashboard role/branch is also the membership that determines catalog read scope. A tenant-wide OWNER no longer inherits the branch from a weaker employee row returned alongside it.
- Added browser coverage for that duplicate-membership case, direct owner route refresh, employee view-only UI, branch-scoped owner denial of the legacy unscoped merchant path, and unsupported `MANAGER` membership denial. Exact-head Primary Catalog run [40794290839](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290839) passed TypeScript/build, PostgreSQL RBAC/tenant/branch integration, and Chromium; logs include `PROFESSIONAL_DASHBOARD_BROWSER_E2E=PASS` and `PROFESSIONAL_DASHBOARD_EMPLOYEE_RBAC_POSTGRES=PASS`.
- Exact-head forward replay [40794290701](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290701) passed: restored checkpoint `20261008222845`, applied 65 later migrations in timestamp order including RC457, and passed RC117, RC455/RC456 and synthetic tenant isolation tests. Replay used a disposable isolated Supabase instance only.
- Other exact-head checks passed: migration immutability [40794290678](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290678), version uniqueness [40794290552](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290552), collision guard [40794290983](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290983), backend boundary [40794290752](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290752), module professionalization [40794291165](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794291165), MantiGO privacy [40794291170](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794291170), RC425 atomicity [40794290617](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290617), flexible commission [40794290801](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290801), approval atomicity [40794290554](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290554), legacy catalog [40794290613](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290613), SMM storefront contract [40794290869](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290869).
- Refreshed the read-only live production ledger evidence: 303 migration rows, latest `20261028112112`; RC113/RC114 tables and RC115/RC457 functions remain absent. All 41 required full-platform migration source versions remain absent, and selected payment/finance effects still have live-schema drift. The dependency gate correctly keeps real Pages publishing blocked.
- No production schema change, ledger repair, merge, or deploy occurred. PR #483 stays Draft. Remaining dashboard-specific manual checks are real-device visual/accessibility review, live QR/permanent-link regression, and a real production-origin session review; broader platform release is still `BLOCKED / NOT CERTIFIED`.


## 2026-10-29 — Professional dashboard merged; production deployment intentionally blocked

- PR #483 was marked ready and squash-merged into `main`: https://github.com/islamnagy2022-eng/MantiqatiX/pull/483. Merge commit: `bbd8e6f5c881f3b4744d5e783bb52874406c7600`.
- Exact pre-merge head `81f362912de67ee6cc033a2fc0c6f7660583a4f1` passed primary catalog TypeScript/build, Chromium dashboard browser E2E, isolated PostgreSQL employee RBAC integration, dashboard permission matrix, and related contract workflows. Primary Catalog Validation: https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40814976708.
- The post-merge production workflow correctly refused to publish because the read-only live dependency manifest still reports missing RC113/RC114/RC115/RC457 dashboard tables and RPCs. Deploy workflow: https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40814976763. Its frontend build, dashboard contract, permission matrix, public-catalog smoke checks and production-gate semantics passed; the live dependency gate failed closed before the publish steps. The deploy job was skipped. No production database migration or schema/data write was performed.
- Production reconciliation remains blocked: 41 required full-platform migration versions are not recorded in the live ledger; payment/finance, Edge Function parity, backup/restore and other platform release evidence remain open. Do not bypass the guard or mark migrations applied without a controlled rollout and live verification.
- Result boundary: dashboard code is merged to `main` and automated preview/E2E checks pass; it is **not live on the production site** because production dependency checks failed closed. Manual real-device accessibility and deployed-origin QR/permanent-link verification also remain open.


## 2026-10-29 — Dashboard production dependency rollout

- Applied the forward-only migration `20261029041815_professional_dashboard_dependencies_forward_repair` through the connected Supabase project `moyhiluyhjsujhwlyeuu`.
- The migration copies the reviewed RC113, RC114, RC115, RC116 and RC457 SQL in dependency order. RC117 was excluded because its image-trigger migration would also alter existing catalog/service image fields beyond the dashboard-specific scope.
- Recorded the applied SQL under the generated live version in `supabase/migrations/20261029041815_professional_dashboard_dependencies_forward_repair.sql`. No historical migration was changed.
- Read-only post-check: 304 migration-ledger rows; latest version `20261029041815`; all 11 required dashboard objects present. Four added tables have RLS and FORCE RLS enabled; direct browser-role table grants are absent; intended authenticated RPC grants and fail-closed anonymous permission checks passed.
- Dashboard-specific dependency manifest was updated to PASS based on these live checks. This does not resolve or certify the separate 41-version full-platform release chain.
- Main-branch Pages deployment succeeded on run [40817091710](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40817091710); post-deploy root/assets verification passed at https://islamnagy2022-eng.github.io/MantiqatiX/. Real production-origin authenticated user/session tests, device/accessibility checks and QR/permanent-link regression remain NOT VERIFIED.
- No finance/payment, wallet, Edge Function, Auth configuration or historical migration-ledger repair was performed.
