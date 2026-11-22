# Pass 1811–1820 — post-PR975 release and public-price opt-in correction

**Date:** 2026-11-22  
**Baseline main:** `cf21e768d0384c55ffde93ae741febcd3c738112`  
**Working branch:** `docs/continuity-pr975-pr976-release-20261122`  
**Production status:** **BLOCKED / NOT CERTIFIED**. GitHub Pages deployment is verified separately from Supabase/Edge production readiness.

## Verified work

### PR #975 — explicit price disclosure regression contract
- PR [#975](https://github.com/islamnagy2022-eng/MantiqatiX/pull/975) merged to main at `cf21e768d0384c55ffde93ae741febcd3c738112`.
- Exact tested head: `8ee1f678185459fbba86087cf4d300d0854dc540`.
- Exact-head check runs: 28 successful, 2 skipped, no failures.
- Main Production Health Monitor run [45070154362](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45070154362) passed.
- Main Pages deployment run [45070154380](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45070154380) passed, including deployed-origin route validation.
- Main Primary Catalog Frontend Validation run [45070154418](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45070154418) passed, including build, employee RBAC PostgreSQL checks and browser E2E.
- Change is test/workflow-only. No Production database, Auth/RLS/GRANT, Storage, Edge Function, payment, wallet or customer data was changed by PR #975.

### PR #976 — fail-closed public price opt-in correction
- PR [#976](https://github.com/islamnagy2022-eng/MantiqatiX/pull/976) is open and targets main.
- Current tested head: `75d0293c19825345e07ad08fbce1c2fcced0d48e`.
- `apps/catalog-frontend/src/lib/catalogPricing.ts` now treats only `metadata.show_price === true` as permission to expose a numeric public price. Missing, false and malformed values resolve as quote-only; explicit unavailability still wins.
- Added regression cases for missing and malformed permission, explicit price permission and availability overrides.
- CI initially exposed a stale static assertion in `scripts/validate-production-catalog-real-state.mjs` that expected the old condition. That assertion was updated to the new explicit-opt-in rule in commit `75d0293c19825345e07ad08fbce1c2fcced0d48e`.
- Latest exact-head status observed: **27 checks successful, 1 browser E2E in progress, 2 skipped, 0 failures**. The build, RBAC PostgreSQL job, module validation, backend boundary, MantiGO privacy, RC425 Paymob atomicity, flexible commissions and PR Pages validation passed. The final `professional_dashboard_browser_e2e` job remains the merge gate.
- Do not merge until all required exact-head checks are terminal-success and the PR remains mergeable.

## Read-only live catalog review

- Ten active public-enabled businesses have logo and cover URL values configured. This confirms stored values, not remote URL reachability.
- Available public catalog items exist for four businesses: MantiqatiX (16 services), Sameh Market (2 products), Burger Fakher (14 products), and Qadam Al-Saad (15 products).
- Earlier aggregate review found content gaps: Qadam Al-Saad's 15 public items lacked catalog image URLs; Burger Fakher had 12/14 items without descriptions; Sameh Market had one item without a description.
- Do not synthesize product records or claim an image is uploaded merely because a fallback illustration renders. Obtain owner-supplied or approved assets.
- The new public price resolver prevents a numeric price from showing unless the item explicitly opts in.

## Production blockers that remain unchanged

- The exact required release set is 76 migration versions; the latest recorded live inspection found **0/76** present. A successful disposable chronological replay is not proof that Production has received the migrations.
- Live public directory contact consent remains a P0 issue: `public.directory_listing_contact_consents` is absent; the deployed `directory-listings` Edge Function is v16 and does not include the current consent-aware sanitizer/pagination bundle. Aggregate-only inspection found 869 published rows with primary phone and address; no contact values were retrieved. Do not deploy the Edge bundle or RC473 alone.
- The live global platform-admin helper and catalog SECURITY DEFINER authorization paths still require the coordinated registry-backed repair (RC484/RC485 plus dependent release chain).
- Seven of eleven critical live Edge entrypoints were previously found byte-different from current main: `order-create`, `payment-intent`, `paymob-webhook`, `digital-page-payment-intent`, `subscription-payment-intent`, `financial-journal`, and `directory-listings`.
- Payment/finance physical contract gaps remain, including missing migration objects/RPCs and RC450 journal service-role execution. No Paymob sandbox success/failure/replay/refund/settlement E2E has been certified.
- Actual encrypted Production database + Storage export, off-site retrieval, Vault recovery, independent PostgreSQL 17 restore, measured RPO/RTO and rollback rehearsal remain **NOT VERIFIED**. The backup manifest validator verifies operator-created evidence; it does not create backups or perform the restore.
- No Production DDL/DML, migration, RLS/GRANT, Auth, Storage, Edge, payment, wallet, settlement or customer-data mutation was performed during this pass.

## Next executable sequence

1. Finish PR #976's exact-head browser E2E; fix any genuine failure and merge only after all required checks pass.
2. Re-run main Pages deployment and deployed-origin browser checks for the merged price-consent fix.
3. Keep all public directory contacts suppressed until RC472/RC473, the complete matching seven-file consent-aware Edge bundle, registry-backed authorization dependencies and anonymous/owner consent tests are released together.
4. Obtain operator-created encrypted off-site database + Storage backups and independent PostgreSQL 17 restore/rollback evidence. Do not request or paste credentials into ChatGPT or GitHub.
5. Reconcile the full 76-version migration chain and exact live object/ACL/Edge parity. Do not apply individual migrations or deploy individual functions out of order.
6. Only after the release gates and approval pass, proceed to Paymob sandbox/finance E2E, then the deferred Li2Lak business-review/media work.

**Decision:** public price disclosure is safer at source level after PR #976, but full Production remains **BLOCKED / NOT CERTIFIED**.