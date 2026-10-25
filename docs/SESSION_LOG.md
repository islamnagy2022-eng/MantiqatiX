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


## 2026-10-25 — Digital Page customer self-service proposal (RC567 candidate)

- **User decision:** Make the lightweight marketing page a part of MantiqatiX but isolated from the other business modules for now. A subscribed customer should manage one page, add/edit products and prices, and set their own WhatsApp number. Public link is for self-promotion.
- **Repository baseline reviewed:** existing `digital_pages`, `digital_page_sections`, `digital_page_orders`, `digital_page_products`, `web/digital-page.html`, and authenticated `web/digital-page-editor.*` already exist. Existing publishing uses paid fulfillment and a platform-admin gate; preserve that boundary.
- **Branch created:** `feat/digital-page-self-service-20261025`, based on `main`. No merge or production deployment performed.
- **Source added:** isolated `web/digital-page-self-service.html/.js/.css`; owner can edit page details, WhatsApp number, and menu items/prices through the existing `digital_page_sections` data model. Public renderer now displays product images when HTTPS URLs are supplied and a WhatsApp CTA using the page owner's number.
- **Migration candidate added:** `supabase/migrations/20261025193000_rc567_digital_page_self_service.sql`. Adds `owner_user_id` and `whatsapp_number`, allows paid-order owners to manage their own isolated page, and extends section RLS while preserving legacy business/provider access. This is source-only and NOT applied to Supabase.
- **Validation updates:** Pages workflow checks the new self-service JS and assets; `scripts/validate-digital-pages-boundaries.mjs` checks the owner/paid-order/WhatsApp boundaries. CI result still pending.
- **Open risks / required verification:** run SQL migration replay and RLS integration tests on a disposable database; review migration ordering because RC563–RC566 are separate open candidates; verify self-service JS syntax, create/edit/list pages, product add/edit/delete, slug collision, WhatsApp rendering, and paid/unpaid cross-user isolation. Confirm how the existing fulfillment admin publishes newly created pages. No production data/configuration mutation was performed.
- **Release state:** BLOCKED / NOT CERTIFIED; no claim of live deployment or production readiness.


## 2026-10-25 — RC567 follow-up: checkout and admin publishing path

- Added subscription package cards using active `PORTFOLIO` products and integrated the existing `digital-page-order-create` and `digital-page-payment-intent` Edge Functions; payment remains server-priced and idempotency-keyed.
- Added refreshable subscription state, active-subscription checks, and the ability to create a separate page for each unused active subscription.
- Fixed editor control enablement after checkout/refresh and added a login return link for direct editor visits.
- Integrated standalone customer pages into the existing admin editor: customer owner option, WhatsApp field, and all-paid-order selection. Added a dedicated RLS select policy allowing platform admins to review customer orders while retaining the owner-only read policy for customers.
- Updated deployment smoke checks to verify the self-service assets and checkout integration, and static boundary checks for checkout and admin publishing.
- Exact-head CI was triggered for the latest branch head; migration replay, migration uniqueness/collision checks, and web validation are pending at the time of this note.
- Still required: review CI results for the exact head; test Paymob checkout/webhook reconciliation with a sandbox order; test admin fulfillment/publishing and public WhatsApp CTA; test paid/unpaid and cross-user RLS on a disposable database. No production migration or deployment performed.
- **Release state:** BLOCKED / NOT CERTIFIED.


## 2026-10-25 — RC567 customer self-service hardening continuation

- Fixed the admin digital-page editor JavaScript parse error by correcting the closing brace around the unpublish handler; current editor, self-service, public renderer, and home JavaScript sources pass source-level syntax compilation.
- Removed the duplicate create-page event listener and gave the secondary create-page button a unique ID wired to the same handler.
- Kept the checkout idempotency key/order association until payment is confirmed, preventing a second click after opening the Paymob checkout from silently creating a duplicate pending order.
- Narrowed the migration's ownership-check removal to the known legacy digital_pages_check constraint instead of dynamically dropping any check that mentions both ownership columns.
- Kept expired customer pages visible to their owner while retaining the active-subscription requirement for customer edits and public rendering.
- Updated the admin editor to preserve the PUBLISHED state when editing a published page and to offer only orders in fulfillment states accepted by the publication RPC.
- Added regression source-contract assertions for checkout idempotency, the create-page control, owner visibility after expiry, and public subscription gating.
- Latest source-level JS syntax checks passed. GitHub combined status currently returns no checks for the newest commit, so CI and isolated migration replay remain NOT VERIFIED.
- PR #374 remains DRAFT / unmerged. No production migration, payment, or deployment was performed. Reconcile RC563–RC566 candidates, then run exact-head CI, disposable migration replay, RLS multi-user tests, and browser E2E before merge.


## 2026-10-25 — RC567 source-contract recheck

- Re-ran the digital-page boundary validator against the exact current branch sources using a controlled in-memory file shim: PASS (9 source files checked).
- Re-ran the public digital-page runtime scenarios with the current renderer and the test's controlled Supabase/document mocks: PASS for missing slug, unpublished/missing page, published MENU rendering, WhatsApp CTA, and HTML escaping.
- Re-ran syntax compilation of `web/digital-page-self-service.js`, `web/digital-page-editor.js`, `web/digital-page.js`, and `web/home.js`: PASS.
- GitHub Actions runs for forward migration replay, migration collision checks, migration-history immutability, migration-version uniqueness, and Pages validation remain queued at the latest poll. Therefore these source-level checks are not a substitute for GitHub CI or disposable PostgreSQL migration replay.
- PR #374 remains DRAFT and unmerged. Keep the production release blocked until the RC563–RC566 migration order is reconciled and CI, database replay, multi-account RLS isolation, and browser E2E are independently verified.

- Security/logic correction during continued review: both owner and public subscription-expiry predicates now use `published_at` when available, otherwise the order's stable `created_at`; editing a draft no longer resets expiry through mutable `updated_at`. Added regression assertions for both expiry gates. This is source-level evidence only until CI and isolated migration replay finish.


## 2026-10-25 — Paid-term start hardening (RC567)

- Continued review found that anchoring expiry to order creation would consume subscription days while payment checkout is pending. RC567 now adds `digital_page_orders.paid_at`, backfills existing PAID orders conservatively, and uses a trigger to set the first successful-payment timestamp and preserve it on later edits/status updates.
- Both owner authorization and public rendering now anchor expiry to `paid_at` first; legacy publication/creation timestamps remain fallback paths. This avoids draft edits or later order updates extending the subscription.
- Added regression assertions for the paid-at trigger and both expiry gates. The digital-page boundary validator passes against the latest branch source (9 files checked).
- The updated branch's forward migration replay and CI were restarted; results for the exact latest head are still pending. Do not treat the previous replay success as validation of this new `paid_at` change.

## 2026-10-25 — Temporary WhatsApp-only handoff and CI repair

- User decision: temporarily disable online card/Vodafone Cash collection for this customer self-service digital-page flow. Other MantiqatiX payment modules remain unchanged.
- Subscription package action now prepares a WhatsApp request to the support channel with package, displayed price, duration, account email, and account ID; this UI does not create a paid order or mark payment as complete.
- Public catalog product cards now include an owner-WhatsApp order link with encoded product name, listed price, page URL, and a request to confirm quantity.
- Updated the deployment smoke contract and static boundary validator to enforce the WhatsApp-only subscription UI and product-order CTA. The first exact-head web validation exposed a stale expected-copy marker; that marker was aligned and the latest Deploy MantiqatiX Web validation job then passed. Its public-only/deploy jobs were skipped for this PR, so no deployment occurred.
- Latest known head at time of this note: `f00d5921c16270e883091c5dadacf26333eb65f2`. Migration forward-chain replay and cross-PR migration collision checks were still running when last checked. Keep PR #374 draft/open; do not merge or deploy until exact-head checks, RLS integration, browser E2E, and manual activation flow are verified. Production remains BLOCKED / NOT CERTIFIED.


## 2026-10-25 — Product decision: WhatsApp-first service/menu/product modules

- **User decision:** Expand the WhatsApp-first public page/catalog pattern beyond the digital-page slice to every applicable existing module that displays services, menus, or products.
- **First-launch behavior:** owners manage their own permitted catalog/page data; customers browse and hand off requests through WhatsApp with contextual item/service details. Reuse canonical module records and preserve existing authorization, validation, and specialized operational controls.
- **Deferred until after launch:** accounting/commissions for this new flow; sponsored-ad purchase/delivery/billing; Paymob collection for these new WhatsApp-first requests. Existing finance and Paymob flows used elsewhere in the platform are not to be removed or changed as a side effect.
- **Marketing area:** public page describing the company's marketing services, with WhatsApp service-request/inquiry CTA. Keep separate from sponsored ads and the internal agency workspace.
- **Documentation action:** recorded the scope and test/release gates in docs/MASTER_PRODUCTION_TODO.md and docs/PROJECT_CONTINUITY.md on the active feature branch.
- **Not yet done:** full module inventory, cross-module implementation, RLS/browser E2E, and regression testing. This documentation change is not proof of feature coverage.
- **Production impact:** no production migration, merge, deployment, Paymob transaction, or production data mutation. PR #374 remains draft/unmerged; release remains BLOCKED / NOT CERTIFIED.


## 2026-10-25 — Dashboard updates and subscription-expiry reminders

- User request: update role-specific dashboards to reflect the first-launch scope and add subscription-date alerts.
- Implemented in source: shared dashboard/notification-center reminder panel for digital-page subscriptions, with 30-day notice, stronger warning within 7 days, expiry state, and a WhatsApp support handoff.
- Safety: if the paid timestamp or product duration is missing, show an unknown-date notice instead of guessing. Reminder data is queried for the signed-in user only.
- Database source change: new migration 20261025203000_digital_page_subscription_expiry_reminders.sql sets paid_at on a transition to PAID; it is not applied to production.
- Validation: added scripts/validate-subscription-reminders.mjs to the web CI workflow.
- Not yet verified: exact-head CI, isolated migration replay/collision guard, browser E2E, and webhook/manual-activation regression. Dashboard reminders are on-visit only; scheduled push/email delivery remains future work.
- Production impact: no production migration/deployment or merge. PR #374 remains open; global release remains BLOCKED / NOT CERTIFIED.


## 2026-10-25 — Launch hardening: marketing services, ad deferral, subscription reminders

- Added public company marketing services page (HTML/CSS/JS) with responsive service cards and WhatsApp handoff; added desktop/mobile homepage links and source-contract validation.
- Deferred public sponsored-ad booking/plan purchase for the first launch: ad surfaces now say “تحت الإنشاء”, public purchase controls are disabled, and the section links to available company marketing services instead.
- Refreshed the PWA cache and precache list for marketing services and digital-page assets.
- Dashboard home and notification center show subscription reminders from the user's paid digital-page orders using the canonical paid_at timestamp and product duration; unknown timing is not treated as healthy.
- Fixed a stale RBAC validator marker that failed against the current dashboard routing and corrected reminder data-error handling so a failed read is not silently rendered as an empty list.
- Removed the redundant unmerged paid_at candidate migration because RC567 already provides the canonical immutable paid_at guard and conservative backfill; updated the reminder validator accordingly.
- Added/updated CI checks for marketing page assets, WhatsApp contract, deferred ads, PWA cache, and public deployment smoke.
- Latest source head before this log update: c6152b2a9514e6107982c02ae575d5c40d152811. Latest-head CI/replay remains pending; no runtime E2E or production deployment is claimed.
- No production migration, merge, or deployment occurred. Global release remains BLOCKED / NOT CERTIFIED.


## 2026-10-25 — RC570 candidate: restaurant menu to WhatsApp public catalog

- Added candidate migration 20261025220000_rc570_restaurant_menu_whatsapp_catalog.sql with optional HTTPS-only restaurant_menu_items.image_url.
- Updated the restaurant/café menu editor to store/show image URLs and added a guarded sync action that takes available canonical items from the selected branch into the existing published digital MENU page. The action requires catalog update RBAC, a published business MENU page, and an active subscription; it refuses to replace a section already bound to another branch.
- Updated public digital MENU rendering to show category labels and include item/category/displayed price/page URL in WhatsApp order text, with quantity/availability confirmation requested. No Paymob collection or paid-order claim is introduced in this path.
- Added scripts/validate-restaurant-menu-whatsapp-sync.mjs to Pages CI and extended scripts/test-digital-page-runtime.mjs to cover category rendering. Updated restaurant and public page cache asset versions.
- Exact-head CI and forward migration replay have not yet been verified. Authenticated multi-user RLS, browser E2E, expiry lifecycle, and deployed preview smoke remain required.
- No merge, production migration, or deployment. PR #374 remains draft/unmerged and release remains BLOCKED / NOT CERTIFIED.


- RC570 follow-up security hardening: moved branch ownership binding out of public digital_page_sections.data into digital_page_menu_branch_bindings with RLS and no anonymous grants. Public menu JSON now contains only catalog display fields. Exact-head CI/replay still pending.


## 2026-10-25 — Shared engine bootstrap and subscription dashboard milestones

- Loaded the shared catalog experience engine before the main dashboard/module runtime and aligned the service-worker precache versions.
- Corrected the dashboard launch-scope panel to link to the existing company marketing-services page and describe its WhatsApp inquiry route as available.
- Added distinct dashboard urgency styling for subscription expiry at 7 days, 3 days, 1 day and expired, based on paid timestamp and product duration. This is in-app display only; scheduled push/email reminders are not yet verified.
- Added static assertions for engine bootstrap order, cache versions, expiry milestones and marketing page status.
- Latest head at the time of logging: 1972b3b25467de363dd7d6bbdf92a21b379907e9. CI checks were queued. Cross-sector adapter integration, multi-user RLS, browser/mobile E2E and production deployment remain open. No production migration, merge, or deployment occurred.


## 2026-10-25 — Shared catalog engine, dashboard and subscription reminder requirements

- User wants one reusable engine for all similar service/menu/product modules, with sector-specific differences, rather than repeating implementation per module. Examples include restaurants, cafés, pharmacies, doctors, hospitals, companies and stores.
- User also wants dashboard updates and subscription-date reminders. Planned reminder thresholds: 14, 7, 3 and 1 day before expiry, plus expiry notification, idempotently and using server/database truth. Initial notification channel can be in-app; email/push are not claimed without configuration and E2E verification.
- Repository inspection found web/module-blueprints.js is a workspace/blueprint UI, not proof of a complete shared catalog engine. web/sector-modules.js and web/operations-modules.js currently show different module-specific data contracts; canonical adapters and inventory are required.
- Scope recorded in docs/MASTER_PRODUCTION_TODO.md and docs/PROJECT_CONTINUITY.md. SMM remains separate.
- Planning estimate: narrow MVP 2–4 weeks if current data contracts and test environment are usable; full hardening may take longer. Estimate is not a commitment.
- Current production gate: migration replay succeeded on prior exact head 3c4d57a61db6ee2080c574de0b6e887017baab7a, but newer documentation commits advanced the branch to 0d15d65c3757da6732d8a09a53f920cc6d9b4733 and new workflows are queued. PR #374 remains draft/open/unmerged; no production deployment. Multi-user RLS and browser E2E remain NOT VERIFIED.


## 2026-10-25 — RC570 replay failure investigation

- Read the project continuity, master production TODO, session log, shared catalog engine plan, current PR #374 metadata and changed-file inventory before editing.
- Current catalog engine is a UI/helper foundation, not yet wired into every sector. PR #374 remains draft/unmerged and no production migration or deployment was performed.
- Inspected exact-head CI run 40227854710: forward migration replay failed in RC570 because a branch membership identifier (`character varying`) was compared directly with a UUID binding. Updated five comparisons in RC570 to compare text representations exactly; commit `c3a2fef8386c3c89a67c54759108ff70c947a86e`.
- The same CI snapshot showed the production security validator failing an assertion expecting a previous membership lookup pattern. This remains unresolved pending source review; do not assume it is a harmless stale assertion until its intended invariant is verified.
- Rerun evidence is not available yet for the new commit. Exact-head CI, ordered migration replay, tenant isolation and browser E2E remain required. Release stays **BLOCKED / NOT CERTIFIED**.


## 2026-10-25 — Shared catalog engine and release-blocking RC570 repair

- Added shared catalog rendering APIs to `web/catalog-experience-engine.js` with escaped output, bounded rendering, explicit empty/status states, and request-mode-specific CTA rules.
- Public MENU product inquiries now use the shared FOOD adapter and include item name, displayed price, page URL, category, and quantity-confirmation detail. Generic WhatsApp helper now refuses to bypass existing booking, ride, job, and matching flows.
- Updated module dashboard labels so module cards do not equate role-based management access with release readiness. Subscription reminder panels remain in the home dashboard, notification center, and digital-page self-service view; scheduled push/email/SMS reminders are not certified.
- Found a real forward-replay failure in RC570: `operator does not exist: character varying = uuid` in branch binding policies, plus malformed `$body$1...` function delimiters in the same candidate migration. Fixed cross-type comparisons by explicit text normalization and repaired the dollar-quoted bodies; added source-level regression assertions.
- Updated stale CI contracts for the shared-engine asset versions and the shared WhatsApp adapter. Exact-head CI/replay evidence is still pending after the fixes.
- No production migration, deployment, or merge. PR #374 remains draft/open. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-25 — Catalog-first launch scope correction

- User explicitly deferred the public marketing-services page as well as sponsored ads. The first launch scope is now limited to the digital self-service product catalog and the restaurant/café menu-to-WhatsApp catalog path.
- Removed active marketing-services links from the public homepage and mobile drawer; marketing-services.html is now a static “تحت الإنشاء” placeholder with noindex/nofollow, no request form, and no WhatsApp submission script.
- Updated PWA cache key to `mnty-web-v140-catalog-first` and removed deferred marketing page HTML/CSS/JS from the precache list.
- Updated the marketing page source-contract validator and GitHub Pages deployment smoke assertions to require the deferred placeholder and reject the old request form. Updated the catalog module matrix accordingly.
- Source commits: `e76c6a12e1ed43fe7a5fb084c895a4f3d5c27ae9` (homepage), `668ea9383ecceac417d80be99764d7224257bdfc` (placeholder), `cc4f03560c40705fa5d098c31e0edf9c6f6c5cd7` (validator), `92156626c55f57cfbde859e964fbaec2236971b5` (PWA), `5d1641d0ce8fefe2662ca0460f09c63c22ca20b6` (matrix), `2992ac9621c6979030bbe00f4aa3a3d6494dddc5` (deployment smoke).
- Verification status at documentation time: exact-head Actions and forward migration replay are queued; do not infer success. No merge, production migration, or deployment occurred. PR #374 remains draft/open and release remains BLOCKED / NOT CERTIFIED.


## 2026-10-25 — Final catalog-first UI and cache alignment follow-up

- Also removed the active marketing-services link from the authenticated dashboard module card; it now says `تحت الإنشاء` and explains the deferral.
- Updated Pages deployment smoke to check that the marketing-services page is an unindexed placeholder with no request form and that neither public homepage nor authenticated dashboard links to it.
- Bumped the app script URL to `app.js?v=catalog-first-1`; bumped the service-worker registration/cache contract to `mnty-web-v140-catalog-first` and aligned the marketing workspace validator.
- Additional commits: `939ba00b2c58142a017b5bc71b04655203219e33` (dashboard), `7577cf748e35c8a92da3c564e37e1fb1328af726` (smoke), `94a6404f13ee7f8fcac50912571f22024bc8b269` / `94a7bb6ed045cfb0cff829abf90c1a54b7747963` (cache refs), `664a7e37a2b95714f6462a889f816b0e774e210c` (workspace validator), `255cb8a79b87830841675844a6c2bc4bd9be5737` (dashboard deferral assertion).
- Validation has not yet completed: latest observed PR checks are queued and the PR deployment job was cancelled as expected for a draft/PR event. This is not a production deploy. No merge or production migration occurred; release remains **BLOCKED / NOT CERTIFIED**.
