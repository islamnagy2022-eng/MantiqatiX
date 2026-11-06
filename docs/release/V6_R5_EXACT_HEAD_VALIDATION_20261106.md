# V6 r5 exact-head validation and release boundary — 2026-11-06

## Scope

- Repository: `islamnagy2022-eng/MantiqaTix`
- Branch: `feat/v6-r5-preview-foundation-20261106`
- Validated head: `8ae8dbef8d639742f67266fdb7f819932ee530ab`
- Pull request: [#685](https://github.com/islamnagy2022-eng/MantiqaTix/pull/685) — OPEN / DRAFT / NOT MERGED.
- V6 source: canonical AI Studio r5 pack, isolated under `apps/aistudio-v6/worktree` during CI.
- Preview base: `/MantiqaTix/v6-preview/`.

This record is a validation snapshot. It does not authorize a merge, deployment, production-root replacement, or production database/Auth/Edge/payment/finance change.

## Exact-head CI results

Every workflow run listed below reports the same head SHA `8ae8dbef8d639742f67266fdb7f819932ee530ab`; every executed job completed successfully.

| Workflow | Run | Result |
|---|---:|---|
| V6 Preview Source Validation | [42218706885](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42218706885) | PASS |
| Deploy MantiqaTix Web — validation only | [42218706915](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42218706915) | validate PASS; deploy SKIPPED |
| Primary Catalog Frontend Validation | [42218706895](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42218706895) | build, 32-journey browser E2E, employee/RBAC PostgreSQL PASS |
| SMM Deferred Storefront Contract | [42218706881](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42218706881) | PASS |
| Backend-only Module Boundary | [42218707047](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42218707047) | approval/audit PostgreSQL, RC450 integration and source boundary PASS |
| MantiGO Open Ride Privacy Boundary | [42218706921](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42218706921) | PASS |
| RC425 MantiGo Paymob Atomicity | [42218706957](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42218706957) | PASS |
| Module Professionalization Validation | [42218706868](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42218706868) | matrimony privacy PostgreSQL, RC451 targeted-ads search-path and source validation PASS |

### V6 browser and accessibility evidence

- Desktop and 390px mobile browser E2E: `V6_PUBLIC_PREVIEW_BROWSER_E2E=PASS`.
- Axe: `critical=0`; zero non-critical violation groups.
- Governorate select has an accessible Arabic name.
- Guest login button contrast overlay is applied.
- The composed artifact is [13502616838](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42218706915/artifacts/13502616838).
- Artifact SHA-256: `22e59a0231f1e662810c7124de303378fcd70cbb93b4e31af026d8b56174eb34`.
- The ZIP was downloaded and passed `unzip -t`; its local SHA-256 matched the recorded GitHub artifact digest.
- The V6 JS bundle did not contain the deprecated visible labels `المجموعات الوظيفية`, `المجالات الوظيفية`, or `كل المجموعات`. Specialty-filter strings are present. The full activity-to-specialty interaction still requires a visual acceptance pass.

### Primary catalog browser evidence

The primary catalog browser run ended with `PRIMARY_CATALOG_BROWSER_E2E=PASS` across 32 named journeys. Coverage included:

- 20+20+remaining pagination, server cursor pagination and geographic scoping.
- Medical directory filters and route/history behavior.
- Verified-first storefront rendering and product catalogues for Sameh Market and Burger Fakher.
- Explicit verified/unverified state and responsive layouts.
- Guest denial, owner/employee/branch authorization scope, employee view-only and unsupported-role denial.
- Admin route authorization, activity module controls, Super Admin tabs and account portal access.
- GPS consent/denial behavior, permanent store links and QR code paths.

Isolated employee/RBAC PostgreSQL behavior tests also passed. These tests do not certify every production tenant or all production RLS behavior.

## Public bundle follow-up — open

Static inspection of the V6-only built JavaScript found legacy wallet/order/admin implementation strings and hard-coded demonstration wallet/product data (including a synthetic admin wallet fixture). This code was not rendered by the tested public shell. No Supabase service-role credential was found in the V6 JavaScript.

This is recorded as a **bundle-separation and demo-data hygiene issue**, not as evidence of a live credential leak or real financial data exposure. Before public Preview publication:

1. Inspect the r5 source imports and identify the modules that pull unused administrative, wallet, order and demo-fixture code into the public entry chunk.
2. Exclude those modules from the public build using source-level separation/tree-shaking or route-level dynamic imports, without deleting the canonical source pack or weakening authorization.
3. Add a bundle-level test that inspects only `v6-preview/assets/*.js` and rejects the known demo fixtures and forbidden private-shell code.
4. Re-run source security audit, release tests, TypeScript, desktop/mobile browser E2E and axe on the new exact head.

The current source pack remains immutable; do not rewrite it. Apply reviewed overlays to the extracted worktree and preserve SHA-256 provenance.

## Production gate — separate from UI validation

The production-verification artifact attached to Pages run `42218706915` was captured in `source_contract` mode. It reported:

- 32 PASS, 0 FAIL, 0 PARTIAL, 1 BLOCKED, 0 NOT VERIFIED.
- `production_gate=BLOCKED`.
- Required release-migration ledger check: 42 expected versions, 0 recorded in the report's ledger comparison. Refresh this evidence from the current production state before taking any action; source presence is not proof of application.
- Required-object reconciliation reported multiple absent or blocked RC425–RC438 and RC113/RC117 objects.
- Payment/finance E2E and backup/restore rehearsal: NOT VERIFIED.
- Six critical live Edge Function entrypoints had source parity drift: `order-create`, `payment-intent`, `paymob-webhook`, `digital-page-payment-intent`, `subscription-payment-intent`, and `financial-journal`.
- Financial journal prerequisites RC449A/RC450 and required columns/service-role execution were not verified as applied.
- Auth leaked-password/security settings require owner-dashboard evidence.
- SMM gateway remains intentionally deferred; anonymous/authenticated negative runtime tests are unverified.
- Two migration aliases remain pending controlled resolution. The RC424 alias was compared by exact statement bytes; preserve the applied ledger version and never rewrite migration history.

The report also records a prior chronological replay and synthetic Tenant A/B isolation rehearsal as PASS. Those isolated results do not certify the live production database.

### Required safe next sequence

1. Refresh read-only production migration-ledger, physical-object and Edge Function version evidence. Do not apply migrations.
2. Build a disposable restore rehearsal from a verified backup and replay the exact forward migration sequence chronologically.
3. Resolve migration aliases only through documented, evidence-backed forward reconciliation; never edit historical migration files or ledger rows casually.
4. Run payment/finance E2E, webhook idempotency, wallet/settlement and rollback tests in the isolated environment.
5. Compare all six live Edge Function versions and contracts against main; do not deploy individual payment functions while schema/grant parity is unresolved.
6. Obtain owner-dashboard evidence for Auth security settings and complete restore/DR rehearsal.
7. Keep full production release BLOCKED until every required live check has current evidence.

## Release boundary

- Existing catalog root remains unchanged.
- V6 stays in the separate `/MantiqaTix/v6-preview/` subpath.
- Pull request #685 remains Draft and unmerged.
- Pages deploy job was skipped for the pull-request run; artifact validation is not a live deployment.
- No production Supabase migration, schema/data/Auth/RLS/GRANT, Edge Function, payment, finance, or root-cutover action was performed.
