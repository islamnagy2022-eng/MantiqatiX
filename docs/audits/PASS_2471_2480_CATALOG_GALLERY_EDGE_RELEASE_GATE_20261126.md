# Pass 2471–2480 — Catalog gallery, live Edge parity, and release-gate recheck

**Date:** 2026-11-26  
**Source repository:** `islamnagy2022-eng/MantiqatiX`  
**Source main at review:** `211986b97b76724c043a4be020d7d29ade261185`  
**Production Supabase project:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Mode:** read-only Production inspection + source/CI review.  
**Production writes:** NONE.

## 1. Source and CI disposition

- PR #1123, “feat(storefront): single cover with atomic ten-image gallery”, merged source-only at `8cd611dbe89a9f4288ceb81ad5ac9c4c4c17f7c6` on 2026-11-26 02:30 UTC.
- Exact PR-head commit: `cff63ae577b8d22cdc8eed7f795719bedde21337`.
- On that exact head, the Primary Catalog Frontend Validation run [45741231838](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45741231838) completed successfully, and the Forward Migration Chain Replay run [45741232181](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45741232181) completed successfully.
- The exact-head check-run inventory recorded success and skipped states only; no failed conclusion was returned. The Primary Catalog workflow runs the promotional-image URL tests, single-cover/gallery wiring validator, RC928 atomic profile contract validator, production migration release-gate validator, and related frontend/catalog checks.
- Current Pages deployment run [45753994611](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45753994611), on source commit `0d771ccb9f0fd5150ae936cfa1cc40efde3bdc43`, completed successfully. Its validate and deploy jobs both passed. The deploy job verified the deployed catalog root, legacy rollback, V6 preview alias, case-insensitive catalog routes, and dashboard/mobile/QR routes.
- PR #1134 (“docs: reconcile verified Pages deployment evidence”) subsequently merged documentation-only at `211986b97b76724c043a4be020d7d29ade261185`. This does not change the frontend/Edge parity status.

**Interpretation:** the storefront/gallery source is merged and its isolated CI checks passed. That is not evidence that the dependent Production migration or Edge bundles are live.

## 2. Direct read-back of the three gallery-dependent Edge functions

Live source was retrieved through the connected Supabase project and compared with the canonical files on current `main`. These are source files and deployment metadata only; no business rows, customer data, secrets or payment records were read.

| Edge function | Live version | Live bundle SHA-256 | Live entry source bytes | Current-main source bytes | Gallery contract |
|---|---:|---|---:|---:|---|
| `catalog-admin` | 20 | `7732207160cf91176d4478d101f85be8789b9eb1ce1b9cd56499994b0cf9ea2c` | 37,862 | 42,769 | **Absent live.** Current source validates the ten-image list and writes it through `upsert_catalog_business_profile_atomic_backend`; live source contains neither `promotional_images`, `sanitizePublicPromotionalImages`, nor that RPC call. |
| `public-catalog` | 9 | `e12cb7794c4083617924ccf6fb8aae5e572985c2e111e7df7e898dd4be824800` | 13,970 | 14,143 | **Absent live.** Current source imports `sanitizePublicPromotionalImages` and projects `profile.promotional_images`; live bundle does not. |
| `public-catalog-directory` | 19 | `9eec1b65e5f85f0ac640ee44ace2e50abb7106da97bbfe52b8a2fb5ee449b9c6` | 19,804 | 19,969 | **Absent live.** Current source imports `sanitizePublicPromotionalImages` and projects the gallery; live bundle does not. |

The currently deployed file manifests for `public-catalog` and `public-catalog-directory` also do not contain the new `_shared/promotional-images.mjs` module.

### Additional catalog-admin authorization drift

The live `catalog-admin` v20 source still contains the old inline `isPlatformAdmin` membership helper. Current `main` no longer contains that helper in this Edge entrypoint. This is a confirmed source/deployment mismatch, not a completed test of exploitability. It reinforces that v20 must not be left as the active target when planning a gallery/authorization release.

### Shared-module parity

The deployed `public-price-visibility.mjs` and `public-contact-visibility.mjs` files compared byte-for-byte equal to current main in the two public catalog bundles. This does not establish whole-function parity because the new promotional-image module and its entrypoint wiring are missing.

## 3. Direct read-only Production database evidence

- Project status: `ACTIVE_HEALTHY`; PostgreSQL `17.6.1.155`.
- Migration ledger: **310 rows**, latest version `20261110150618`.
- The current `scripts/production/live-reconciliation-contract.mjs` declares **86 required release migration versions**. A direct exact-ID comparison against `supabase_migrations.schema_migrations` returned **0/86 exact version IDs found**. This is a migration-ledger identity result; by itself it does not prove every corresponding physical effect is absent.
- RC928 migration `20261126010000` and the RC117 image-provenance forward repair `20261126020000` are both absent from the live ledger.
- Direct read-back still shows the live `private.platform_admins` registry has RLS enabled but FORCE RLS disabled. Live `public.is_platform_admin()` remains SECURITY INVOKER with `search_path=public` and derives global authority from any ACTIVE tenant ADMIN/SUPER_ADMIN membership, not solely from the registry.
- The same read-back found 57 policies across 24 tables referencing `is_platform_admin()`, plus five policies across three tables referencing `mnty_can_platform_admin()`: 62 policy references over 27 tables. The latter helper remains SECURITY DEFINER with `search_path=public, pg_temp`, delegating to the legacy unscoped membership helper.
- Source RC464/RC469/RC471/RC484 and their disposable PostgreSQL tests exist in current main, but their required live migration IDs are not present. Do not hot-edit or mass-replace the policies in Production.

## 4. Release decision and sequencing

**Gallery status: SOURCE MERGED / CI PASS / PRODUCTION EDGE NOT READY.**  
**Full platform status: BLOCKED / NOT CERTIFIED.**

Do not deploy the three gallery-dependent Edge functions individually or deploy only the frontend. The required dependency slice is:

1. Resolve the ordered database source/physical-effect reconciliation, including RC928, its RPC/ACL/RLS contract, and the required prior migration dependencies.
2. Resolve and test the canonical platform-root helper and its full 62-policy / 27-table authorization blast radius without removing valid tenant-local owner/manager scope.
3. Prepare all three Edge bundles from one exact source commit, including the new shared promotional-image module, and compare every bundled file and `verify_jwt` setting.
4. Run isolated positive/negative authorization tests and owner-save → public-storefront-read deployed-origin tests against the exact resulting schema and Edge bundle set.

The user has directed that backup/restore work be deferred for now. No backup or restore action was attempted in this pass; that deferral is not recorded as a completed release gate.

## 5. Non-actions

No Production SQL DDL/DML, migration-history rewrite, Auth/RLS/GRANT mutation, Storage change, Edge deployment, payment/webhook, wallet, settlement, customer-data or business-data mutation was performed. No secret values or application rows were read.

## 6. Next source actions

- Keep the gallery code merged and its current CI tests enabled.
- Keep the release gate fail-closed while the 86-version exact-ledger and physical-effect reconciliation remains unresolved.
- Add/retain exact source-to-live Edge bundle parity evidence before any coordinated Edge release.
- Continue the 62-policy platform-root authorization correction through its existing disposable PG17 migration chain; do not weaken tenant-local scope.
