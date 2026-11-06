# V6 r5 exact-head validation and release boundary — 2026-11-06

## Scope and current head

- Repository: `islamnagy2022-eng/MantiqaTix`
- Branch: `feat/v6-r5-preview-foundation-20261106`
- Latest branch head at this snapshot: `9ec265cc4c27a84e1cfe9d05b37f9d2f2df5773c`
- Pull request: [#685](https://github.com/islamnagy2022-eng/MantiqaTix/pull/685) — OPEN / DRAFT / NOT MERGED.
- Canonical V6 source: AI Studio V6 r5, retained as an immutable source pack with SHA-256 provenance verification.
- Preview base: `/MantiqaTix/v6-preview/`.
- Existing catalog remains the production root.

This record is a validation snapshot. It does not authorize merge, Pages deployment, root cutover, or production database/Auth/Edge/payment/finance changes.

## Exact-head CI — 9ec265c

All eight workflow runs below report the exact same head SHA `9ec265cc4c27a84e1cfe9d05b37f9d2f2df5773c`. Every executed job completed successfully.

| Workflow | Run | Result |
|---|---:|---|
| Primary Catalog Frontend Validation | [42231328016](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42231328016) | Build/typecheck, employee/RBAC PostgreSQL, professional-dashboard browser E2E — PASS |
| V6 Preview Source Validation | [42231328658](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42231328658) | Source preparation, security audit and remediation tests — PASS |
| Pages validation | [42231328166](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42231328166) | validate PASS; public-only and deploy jobs SKIPPED for PR event |
| Backend-only Module Boundary | [42231328184](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42231328184) | Approval/audit PostgreSQL, RC450 integration and source validation — PASS |
| Module Professionalization Validation | [42231328049](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42231328049) | Matrimony privacy PostgreSQL, RC451 targeted-ads search-path and source validation — PASS |
| RC425 MantiGo Paymob Atomicity | [42231328002](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42231328002) | PASS |
| MantiGO Open Ride Privacy Boundary | [42231328262](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42231328262) | PASS |
| SMM Deferred Storefront Contract | [42231328036](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42231328036) | PASS |

The separate catalog build and professional-dashboard browser checks both passed on this exact head. This closes the earlier pending Playwright job.

## V6 browser, accessibility and composed artifact

Pages validation on exact head `9ec265c` recorded:

- `V6_PREVIEW_BUILD=PASS`.
- Desktop and mobile public-preview browser E2E: `V6_PUBLIC_PREVIEW_BROWSER_E2E=PASS`.
- Axe: `critical=0`; zero non-critical violation groups.
- The governorate selector has an accessible Arabic name.
- The guest login button contrast correction is included.
- Composed Pages artifact: [13510725102](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42231328166/artifacts/13510725102).
- Artifact SHA-256: `a900395d35738ee7ba2fc9f75bcaf33434ee61c755e9797f2297734b3e9efa9d`.
- ZIP integrity check passed locally; the artifact contains `v6-preview/index.html` and the expected JS/CSS assets.
- Pages deployment was SKIPPED for the pull-request event. This artifact is validated but is not a live public Preview.

## Public bundle separation — OPEN RELEASE BLOCKER

A new source-to-bundle ownership audit was added and run on the exact head. The audit is intentionally informational at this stage and does not claim the public bundle is clean.

Exact audit output:

- Source files inspected: 69.
- Reachable source files from `src/main.tsx`: 28.
- Suspicious reachable source modules: 2.
  - `src/context/AppContext.tsx` — legacy demo fixture marker `prod_demo_` and admin-wallet label.
  - `src/utils/rules.ts` — wallet/admin markers including `wallet_admin_main`, `wallet_biz_`, `wallet_sub_`, and `admin_root`.
- Suspicious built JS assets: 1 — `v6-preview/assets/index-BtfVEenx.js`, 523,373 bytes.
- Audit result: `V6_PUBLIC_BUNDLE_HYGIENE_STATUS=FOLLOW_UP_REQUIRED`.
- No unresolved local imports were reported by the audit.
- No Supabase service-role credential was found in the inspected V6 bundle.

The source review artifact [13508511083](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42231328166/artifacts/13508511083) was downloaded and inspected. It confirms the public `App.tsx` entry statically imports `AppProvider` from the monolithic `context/AppContext.tsx`; that provider imports broad legacy seed, wallet, admin and enterprise rule modules. The current public UI does not render those administrative screens, but their implementation and synthetic demo markers remain reachable and included in the public JavaScript.

Required source-level remediation before public Preview publication:

1. Introduce a dedicated public-shell context/provider containing only public directory reads, navigation, storefront selection, and the existing verified Supabase OTP/membership flow.
2. Move the public UI components (`DirectoryView`, `Navbar`, `MedicalDirectoryView`, `ContactUsView`, `BusinessProfileHeader`, `CatalogSection`, and `LoginModal`) to the minimal public context contract.
3. Remove public-shell imports of the monolithic legacy `AppContext.tsx` and `utils/rules.ts`. Extract only required pure formatting/filter/contact helpers into small public-safe modules; do not copy wallet/order/admin behavior.
4. Preserve the canonical r5 source archive unchanged. Apply reviewed overlays only to the extracted worktree and preserve provenance checks.
5. Add a blocking bundle regression test that fails if known wallet/admin/demo-fixture markers or private-shell modules appear in any `v6-preview/assets/*.js` file.
6. Re-run exact-head source security audit, TypeScript, release tests, desktop/mobile browser E2E and axe. Require zero forbidden bundle markers before changing the public-preview release gate.

Do not solve this by merely hiding UI routes, removing marker strings, or weakening authorization. Do not delete the canonical source archive.

## Production gate — separate from V6 UI validation

The exact-head Pages artifact includes a `source_contract` verification report generated at `2026-11-06T14:09:30Z`:

- 32 PASS, 0 FAIL, 0 PARTIAL, 1 BLOCKED, 0 NOT VERIFIED.
- `production_gate=BLOCKED`.
- The blocked item is the live production migration/schema/Edge reconciliation; source presence is not proof of application.
- The report identifies 42 required release migration versions with 0 recorded under its exact version-identity comparison. Known aliases and physical effects must be reconciled independently; do not rewrite migration history.
- Payment/finance E2E and backup/restore rehearsal remain NOT VERIFIED.
- Six critical live Edge Function entrypoints differ from `main`: `order-create`, `payment-intent`, `paymob-webhook`, `digital-page-payment-intent`, `subscription-payment-intent`, and `financial-journal`.
- Financial-journal prerequisites RC449A/RC450, required columns, RPC signature and service-role execution remain unresolved in production.
- Auth leaked-password/security settings require owner-dashboard evidence.
- SMM gateway remains intentionally deferred until anonymous/authenticated negative runtime tests are recorded.

The detailed read-only snapshot is in [PRODUCTION_READ_ONLY_RECHECK_20261106.md](PRODUCTION_READ_ONLY_RECHECK_20261106.md). No production writes were made. Do not apply migrations or deploy coupled payment/finance Edge Functions from this state.

## Required safe continuation

1. Complete the V6 public-context and bundle separation work described above, then require a clean bundle audit on the new exact head.
2. Preserve the current catalog root and keep V6 isolated under `/MantiqaTix/v6-preview/`.
3. Refresh read-only production migration-ledger, physical-object, RPC/ACL and Edge Function evidence before planning any production repair.
4. Perform a disposable restore rehearsal and chronological forward-migration replay in an isolated environment.
5. Run payment/finance, webhook idempotency, wallet/settlement and rollback tests only in that isolated environment.
6. Obtain owner-dashboard evidence for Auth security settings and complete DR/restore validation.
7. Keep full production release BLOCKED until every required live check has current evidence.

## Release boundary

- PR #685 remains Draft and unmerged.
- No Pages deployment or root cutover was performed.
- No production Supabase migration, schema/data/Auth/RLS/GRANT, Edge Function, payment or finance mutation was performed.
