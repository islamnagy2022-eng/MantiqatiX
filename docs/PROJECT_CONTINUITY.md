# Latest checkpoint — 2026-11-14 — Production schema verification and security PR continuation

**Request ID:** `R-20261114-MANTIQATIX-SECURITY-CONTINUATION`  
**Status:** Active development across existing draft PRs. Production remains **BLOCKED / NOT CERTIFIED**. No candidate migration or deployment was applied to Production.

## Verified live Supabase state (read-only)

- The active project is **MANTIQATIX FINAL**. The separate demo project is inactive and was not used for this audit.
- The live migration ledger contains 310 entries and ends at `20261110150618`. The candidate PR migrations remain unapplied.
- `public.mantigo_financial_ledger` contains `gross_amount`, `commission_amount`, and `captain_net_amount`; it does not contain `amount` or `captain_amount`. The deployed financial-report RPC still references the absent legacy columns. No invocation or data write was made.
- Both candidate platform-admin migrations (#722 and #724) now use the live ledger columns. They share a disposable regression test that leaves legacy fixture columns NULL and verifies the report after the candidate migration.
- `private.platform_admins` has RLS enabled but FORCE RLS disabled; the table and helper owners are `postgres`. The live `postgres` and `service_role` roles have BYPASSRLS; `anon` and `authenticated` do not. RC464 rechecks the owner/BYPASSRLS assumptions before enabling FORCE RLS.
- `businesses`, `branches`, and `orders` currently retain broad tenant-level policies. PR #727 narrows business/branch scope; PR #725 narrows order reads.
- Security Advisor reported nine RLS-enabled tables with no policies, but those tables have no direct anon/authenticated SELECT or INSERT grants. It also reports the intentionally public targeted-ad RPC and generic authenticated SECURITY DEFINER/multiple-policy warnings; these require per-function/per-policy review, not blanket revocation. Health advisor returned no lints.

## Current PR work

| PR | Scope | Latest status at checkpoint |
|---|---|---|
| #722 | R7 platform-admin registry helper, SECURITY DEFINER search_path hardening, atomic migration, live-ledger report correction | Latest head `bb8ed67`; CI rerunning, no failures on that head |
| #724 | RC464 canonical platform registry, FORCE RLS, four global MantiGO RPCs, live-ledger report correction | Latest code head `abe65ba` before audit-doc update; branch was updated with current `main`; CI rerunning |
| #725 | Orders read scope by business/branch | 25/25 checks passed; draft, not merged |
| #726 | Public contact opt-in, signed cursor pagination, frontend “See more” integration | Latest head `a8b6d80`; CI queued/running, no failures on that head |
| #727 | Businesses and branches RLS scope | 24/24 checks passed; draft, not merged |

- Migration order: review/merge #722 before #724 where practical. #722's migration version `20261113020000` precedes RC464 `20261113214500` and hardens four existing helper-dependent SECURITY DEFINER callers.
- PR #724 is based on the current main tree as of `1b3a7c4`; its merge base is current main. After #722 merges, refresh #724 against the new main head and rerun the full chain.
- No PR has been merged, no production migration was applied, and no production Edge Function or Pages deployment occurred.

## Remaining release gates

1. Finish exact-head CI for #722, #724 and #726, including the new financial-report regression and public-contact/privacy/browser checks.
2. Review the complete diffs and preserve the draft/human-review gate; do not merge or deploy solely because CI passes.
3. Run the complete migration replay and restore rehearsal against a fresh schema checkpoint; verify backup recovery and rollback before any production change.
4. For #726, deploy the public Edge Function before the frontend that relies on 20-record cursor pages, then smoke-test page continuity, duplicate prevention, filter-bound cursors, expiry, explicit contact consent, CORS and existing catalog behavior.
5. Re-run Security Advisor and verify live RPC ACLs, helper ownership, RLS policies, function bodies and migration history after any approved rollout.

The separately uploaded R7 Google AI Studio application archive remains a distinct source baseline. Do not replace it with the GitHub production-contract repository or overwrite its retained R12 hardening artifacts.

---

# Latest checkpoint — 2026-11-14 — Public directory cursor pagination integration

**Request ID:** `R-20261114-PUBLIC-DIRECTORY-CURSOR-PAGINATION`  
**Status:** IMPLEMENTED IN DRAFT PR; targeted security and build checks PASS; browser E2E still running. Global release remains **BLOCKED / NOT CERTIFIED**.

- Updated existing draft PR #726 (base `main`) rather than creating a competing PR. Code-validation head: `70b045e06f835946a0635f65fd2d80a85f0352d8`. PR: https://github.com/islamnagy2022-eng/MantiqatiX/pull/726
- Added the missing shared `public-directory-pagination.mjs` module required by the Edge Function import. It provides a fixed page size of 20, bounded/normalized Activity, Specialty, Governorate, Markaz and Village filters, filter-scope hashing, HMAC-signed opaque cursors, tamper rejection and six-hour cursor expiry.
- Edge Function keyset scan uses stable UUID ordering, a first-page `created_at` snapshot boundary, bounded batches and a maximum scan budget. It returns `pagination.pageSize`, `hasMore` and `nextCursor`. Public contact fields remain projected only through explicit owner-consent metadata from the existing PR work.
- Extended Activity matching to include canonical activity-category identifiers in addition to existing category/group/provider values.
- Connected `fetchPublicDirectoryPage` in the frontend, retained the cursor in AppContext, appended pages by unique business/product IDs, and wired the existing “رؤية المزيد من الأنشطة” control to fetch the next actual business page. Existing UI layout was preserved.
- Added helper tests and expanded `scripts/validate-public-directory-pagination.mjs` to cover both the Edge Function contract and frontend cursor wiring. The workflow runs contact-consent tests, pagination tests, static contract validation and Deno type-checking.
- **PASS:** `Public Catalog Contact Privacy` run `43553459624` — public contact boundary, explicit contact projection tests, keyset pagination static validation, signed-cursor tests and Deno type-check of both public Edge Functions.
- **PASS:** `TypeScript, build and security contract` run `43553459555`.
- **PASS:** `Primary Catalog Frontend Validation` build job and isolated employee/RBAC PostgreSQL integration job in run `43553459548`; TypeScript, production build, taxonomy, OAuth, geographic search, public price disclosure and release-gate checks completed successfully.
- **PASS:** `Deploy MantiqaTix Web` validation job in run `43553459560`; the `deploy` job was **SKIPPED**, as required for this non-main branch.
- **PENDING:** professional-dashboard browser E2E in run `43553459548` was still running at this checkpoint. It is not a pagination-specific E2E test.
- No Supabase production migration, Edge Function deployment, Pages deployment, production data mutation or Auth/RLS/GRANT change was performed. The deployed public directory endpoint has not yet been verified with the new cursor contract.
- Release sequencing: finish exact-head CI and review; deploy the Edge Function before deploying the frontend that relies on 20-record pages; then run live tests for first/next page continuity, no duplicates, filter-bound cursor rejection, expiry, contact consent, CORS and existing public catalog behavior.
- This work is in the existing GitHub production-contract repository branch. It does not import or replace the separately uploaded R7 AI Studio application archive; that source remains governed by the R7 continuation baseline.

**Next action:** finish pending browser/CI jobs, then prepare a controlled Edge Function + frontend release with rollback and deployed-origin smoke checks.

---

# Latest verified checkpoint — 2026-11-11 — Public catalog disclosure safety

**Request ID:** `R-20261111-PUBLIC-CATALOG-PRICE-DISCLOSURE`  
**Status:** VERIFIED for the narrow public-catalog disclosure correction; global platform release remains **BLOCKED / NOT CERTIFIED**.

- PR #717 merged to `main` as `07be7028b7b79ff368c7d3dd5cd8093d04841ad9`.
- Production Pages deployment run `42930144466` succeeded. Deployed-origin root, retained legacy catalog, dashboard, mobile and QR-route checks passed.
- Active Supabase Edge Functions now report `public-catalog v8` and `public-catalog-directory v18`. Retrieved deployed entrypoint sources match the approved `main` files byte-for-byte; the existing public `verify_jwt=false` settings remain unchanged.
- Read-only live catalog audit: 12 items explicitly allow public price display, 19 explicitly deny it, 16 have missing/invalid permission, and 2 contain compare-price metadata without explicit consent. No production rows were modified.
- Added `scripts/smoke-test-public-catalog-disclosure.mjs` to check live public-directory and direct-catalog responses for strict availability, numeric prices, option deltas, compare prices, and quote-only service behavior. On commit `b5b783c8a8e27d9049ed5fe9f7dffbf2a94de0bd`, workflow `42931478532` passed the build, PostgreSQL employee/RBAC integration job, and live disclosure smoke step. Browser E2E was still running at this checkpoint; verify its final result before closing that CI run.
- No production database migration, catalog data update, Auth/RLS/GRANT change, or payment/finance mutation was performed.
- Remaining P0 security work is not closed: 9 RLS-enabled/no-policy tables (default-deny; verify intended service-only access), 1 anonymous-callable SECURITY DEFINER ad-targeting function (confirm public exposure with owner), 65 authenticated-callable SECURITY DEFINER functions (continue call-chain/ACL review), and disabled leaked-password protection (requires authorized Auth settings action). Do not mass-revoke grants or alter RLS without call-site and tenant-isolation evidence.
- The live smoke test verifies the narrow disclosure contract only. Do not mark the whole platform Production Ready; continue with the first open P0 in the master ledger: migration/object reconciliation, critical Edge Function parity, real Paymob/finance E2E, backup/restore DR, Auth and adversarial RLS/SECURITY DEFINER review.

---

# Latest checkpoint — 2026-11-09 — R6 cleanroom base-path and PWA hardening

- PR #699 merged to `main` as documentation-only commit `1beb586a3d6eb8f8d205b6a3a502ed04018ce50f`. It corrected the R6 integration map so the business/catalog feed is not confused with the national `directory-listings` keyset pagination endpoint. No runtime or production change occurred.
- The uploaded canonical R6 archive is available as a direct conversation file in the current runtime. Reverified original SHA-256: `c7623e2741d34ac5c58ba2c2c8f9286116e7adc6f5e214955c5c67d050c15447`.
- Latest local sanitized package: `MantiqaTix-R6-preview-basepath-hardened.zip`, SHA-256 `aa9066eff3f630040ff3e534a3a68b82a801fb16179cfda2b286dc968ba9de1e`. Inventory: 121 files, 85 under `src/`, 48 React components, 13 test files, 2 R6 mobile web components and 6 reference captures. No private `.data/`, `.aistudio/`, local `server.ts`, real `.env`, node_modules or backup data.
- Additional local R6 implementation for isolated Pages Preview:
  - Vite `base` reads `VITE_BASE_PATH` and validates an absolute path with leading/trailing slash.
  - App registers service worker under `import.meta.env.BASE_URL` with the same scope.
  - Manifest IDs, start URL, scope and icons are relative to manifest scope.
  - Service worker assets/notification URLs resolve against `self.registration.scope`.
  - Service worker cache uses `mantiqatix-r6-pwa-` namespace and removes only old R6-prefixed caches; it no longer deletes arbitrary same-origin caches.
  - UI brand logo references use a base-aware shared URL.
  - Added `scripts/verify-r6-pages-base.mjs`, `test`, `basepath:check` and `verify:local` package scripts. No dependency change was made; `tsx` was already a devDependency.
- Local verification rerun: 83/83 tests PASS across 13 test files; security-boundary assertions PASS; Pages base/PWA contract PASS after scanning 71 non-test TS/TSX files; service-worker runtime scope/cache isolation PASS; syntax transpilation PASS across 84 TS/TSX files with 0 syntax errors. ZIP integrity PASS.
- Test caveat: tests were executed with Node's test runner plus a local ts-node transpile-only loader and extensionless-import resolver. The newly declared `tsx --test` npm script was not invoked because dependencies were not installed in this offline runtime.
- Semantic TypeScript, dependency installation, Vite build, browser/visual E2E, accessibility, actual PWA install/update, and deployed-origin R6 Preview remain NOT VERIFIED. Do not represent this as production certification.
- Separate native Android archive `source_RC40.zip` remains preserved, SHA-256 `e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e`; ZIP integrity and presence of Gradle wrapper/build manifests plus AndroidManifest are verified. It remains outside current `main`; do not delete or mix it with R6 mobile web UI.
- **R6 source tree remains NOT IMPORTED into GitHub.** The local sanitized package is not an app repository commit or deployed code. In this runtime the GitHub connector has no bulk local-byte upload action and direct git transport is blocked by DNS resolution for `github.com`; no partial import was attempted. Next step is to place the exact tree at `apps/aistudio-v6` on a dedicated branch, preserve mobile components, then run full dependency/type/build/browser/PWA/security validation. Existing V6 root and `/legacy/` remain unchanged until an explicitly reviewed cutover.
- No Production Supabase writes, schema/Auth/RLS/GRANT change, payment/finance operation, Pages deployment or mobile/Android deletion occurred in this checkpoint. `FULL_PLATFORM_GATE = BLOCKED / NOT CERTIFIED`.

---

# Latest checkpoint — 2026-11-08 — Native Android preservation status clarification

- PR #693 merged as `076ff3251eb41b1d33f02373e07efa671ef47424`; it added the pre-import R6/Supabase contract baseline. Its six exact-head workflows succeeded; its Pages deploy job was skipped. No production change occurred.
- Correct distinction: R6's `src/components/mobile/` is the mobile web UI and must be preserved as part of R6. It is not a native Android/Kotlin Gradle project.
- Current-main audit `docs/RC272_ANDROID_CI_AUDIT.md` states that `android/`, `app/`, `settings.gradle.kts`, `build.gradle.kts` and `gradlew` are absent at the repository root. The historical `source_RC40.zip` was reported to contain a separate Android Gradle project, but that archive is legacy material and was not integrated into current main.
- Keep native Android as an open preservation/reconciliation stream. Do not claim it exists in current main, do not overwrite/delete separately retained Android source, and do not copy RC40 blindly. A native release requires an actual source tree, current backend contract mapping, Gradle build/test, protected signing and device evidence.
- R6 archive remains unavailable as raw bytes in this session; no R6 code import or app source modification occurred.

---

## Follow-on checkpoint — R6 backend integration groundwork

- Inspected current `main` source for the public directory and public catalogue Edge Functions, the public frontend mapper/types, the authenticated `api /api/v1/me` membership contract, and the `catalog-admin` / `catalog-platform-admin` authorization boundaries.
- Added `docs/release/R6_SUPABASE_CONTRACT_BASELINE_20261108.md` on branch `docs/r6-supabase-contract-baseline-20261108`. It records the existing read-only public contracts, Auth/membership, scoped admin operations, prohibited local-state shortcuts and the exact post-upload mapping sequence. It is a pre-import baseline only, not a claim that R6 source fields have already been reconciled.
- Current source-level references and Git blob SHAs are recorded in the document. Live deployed Edge version/hash and live schema/ACL were not freshly verified by this documentation pass.
- No app code, Supabase object, production data, Pages deployment, mobile UI or native Android source was changed.

---

# Latest continuity checkpoint — 2026-11-08 — R6 source import access blocker

- PR #691 was merged into `main` as documentation-only commit `41017431cfc38c0616f145f8d4a8b41110500ab1`. All six associated workflow runs and all returned jobs succeeded. The Pages run's `deploy` job was skipped; no merge-commit CI runs/statuses were returned. Production was not changed.
- R6 archive `bizcatalog-manager (6).zip` remains the canonical application source. Its Library file record is visible and reports 37,305,478 bytes with the previously recorded SHA-256 `c7623e2741d34ac5c58ba2c2c8f9286116e7adc6f5e214955c5c67d050c15447`, but the file service rejected raw-byte materialization as unauthorized for this Project file; a text read also failed. It has not been extracted, rehashed, or imported in this session.
- Do not use the earlier r5 archive / PR #685 as a replacement baseline. The earlier audit instruction treating PR #685 as the integration base is superseded by the newer R6 source-of-truth decision. r5 remains reference-only for individually verified gaps.
- Next step is to obtain a direct conversation upload of `bizcatalog-manager (6).zip`; then verify the exact SHA-256, inspect/extract safe source entries, preserve `src/components/mobile/` and the separate Android/Kotlin project, and map API/data contracts to the existing Supabase backend.
- Active R6 security blockers remain: local JSON production snapshot, unauthenticated snapshot/CRUD/backup routes, body-supplied role/session minting, localStorage-authoritative roles/state, seeded credentials/claims, predictable secret fallbacks, and Express/GitHub Pages hosting mismatch. Do not expose or deploy those surfaces.
- Live site remains the deployed V6 root; `/legacy/` remains retained. No R6 cutover, Supabase write, migration, Auth/RLS/GRANT change, Edge deployment or payment/finance operation occurred. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.

---

# CONTINUATION SOURCE OF TRUTH — 2026-11-08

**Read this before continuing any MantiqatiX work.** The newest user-approved application source is `bizcatalog-manager (6).zip`, SHA-256 `c7623e2741d34ac5c58ba2c2c8f9286116e7adc6f5e214955c5c67d050c15447`. This R6 source tree is the canonical application baseline for ongoing development and must be integrated into the MantiqatiX repository. Older archives, prompts, branches, and implementations are references only: reuse from them only to fill a confirmed R6 gap, after adapting and testing it. Never replace R6 wholesale with an older project.

**Important distinction:** R6 is the source of truth for application UI, components, workflows and mobile web UI. It does not supersede the live Supabase backend as the authority for identity, memberships, tenant/branch scope, permissions, schema, RLS, grants, RPCs, Edge Functions, payments or finance. Map R6 to existing backend contracts; do not import local JSON, demo data, browser-held roles, default credentials, or insecure endpoints into production.

The current V6 GitHub Pages root remains the live site until an R6-based integration passes isolated Preview, security, backend, desktop/mobile, PWA and rollback checks and is explicitly promoted. Keep `/legacy/`, R6 mobile UI, and the native Android/Kotlin project. Do not claim an R6 production cutover before deployed-origin verification.

For every new chat where the user says "كمل": read this policy, `TODO_PRODUCTION.md`, and the latest checkpoint; inspect current GitHub main/PRs/CI; resume the first incomplete task; do not restart or repeat completed work. Work on a branch/PR, verify tests, update the TODO and continuity notes after each meaningful result, and state whether production changed. First pending task: reproducibly import the exact R6 source tree into MantiqatiX and record its repository path/commit, preserving mobile and Android, then map its data/API contracts to existing Supabase. Full platform gate remains `BLOCKED / NOT CERTIFIED`.

---

# CURRENT HANDOFF — 2026-11-06 — V6 public launch-first plan

- الهدف: إظهار AI Studio V6 للمستخدمين بأقصر مسار آمن.
- تسلسل الإطلاق: Preview على `/MantiqatiX/v6-preview/` مع بقاء الجذر الحالي كما هو؛ قبول Preview؛ ثم نقل V6 إلى الجذر مع إبقاء الكتالوج السابق مؤقتًا في `/legacy/` وrollback.
- مصدر r5 النظيف: `/MANTIQATIX/MantiqaTix-AI-Studio-V6-CANONICAL-CANDIDATE-2026-11-05-r5.zip`; SHA-256 `0e868efefbacd5cf3ec4c07a558230ce5cdfbbbdab64416182bc9a59f3acd429`. يستبعد ملفات AI Studio المؤقتة و.data وملفات env المحلية والاعتماديات وdist. OTP والعضويات واختيار نشاط OWNER موجودة؛ SMTP/Preview/full build غير متحقق.
- Pages الحالي يبني `apps/catalog-frontend` فقط وينشر Artifact واحدًا. أضف V6 كمسار فرعي داخل نفس Artifact؛ لا تنشئ Workflow نشر Pages موازيًا.
- PR #673 شرائح جزئية وليس تطبيق V6 كاملًا. فرعه 59 ahead / 10 behind عن main وقت المراجعة؛ 23/25 check نجحت واثنتان skipped على رأس قديم. حدّث الأساس وأعد الفحوصات قبل الدمج.
- أول إصدار عام: الرئيسية والدليل والبحث والتخصصات وصفحات النشاط والكتالوج والمنتجات/الخدمات المنشورة والأسعار ووسائل الاتصال.
- أخفِ المحافظ والمالية وPaymob والدفع والطلبات غير المربوطة والرسائل ولوحات الإدارة غير المرتبطة والمخزون وSMM وأدوات التطوير.
- بوابة الإطلاق: install/type/lint/build/tests، Browser E2E على Desktop/Android، صحة بيانات Supabase العامة، deep links/reload، Accessibility، Preview وrollback. OTP الحقيقي فقط بعد إعداد SMTP والقالب واختبار العضويات.
- **لا نشر ولا تغيير إنتاج تم بهذه الخطة.** الحالة: Preview NOT DEPLOYED؛ full build وOTP الحي غير متحققين؛ Full platform BLOCKED / NOT CERTIFIED.

## المهمة التالية
1. إدخال r5 النظيف في `apps/aistudio-v6` على فرع مبني من main الحالي، مع استبعاد المؤقتات والبيانات المحلية.
2. إعداد Vite base لـ`/MantiqatiX/v6-preview/` وفصل server.ts التطويري.
3. تعديل `pages.yml` لضم V6 إلى Artifact الحالي كمسار فرعي.
4. تشغيل تثبيت نظيف/full type/lint/build/security/unit/browser/a11y، ثم إصلاح عيوب P0/P1.
5. نشر Preview، اختبار الدليل الحقيقي وOTP، ثم تجهيز Root Cutover وrollback.

## قاعدة الاستمرار
عند قول «كمل»، ابدأ بأول عنصر غير مكتمل في P0–P5 في TODO وخطة الإطلاق؛ لا تبدأ من الصفر ولا تطلب إعادة شرح المتطلبات.

---

# CURRENT HANDOFF — 2026-11-05 — V6 Auth OTP UI wired (r5)

- Canonical source remains the owner-selected AI Studio V6. Prior latest r4 baseline SHA-256: `94aa8e6912b310136b7d453e7a776d291ab4700d8619d00d8544f0d91bac3ec7`.
- Current candidate: `/MANTIQATIX/MantiqaTix-AI-Studio-V6-CANONICAL-CANDIDATE-2026-11-05-r5-auth-ui.zip`; SHA-256 `833e783119c68f31e9aa8d108caf7aa3a722fb0413627610e743df2d6dc64f3f`.
- Existing `SupabaseAuthController` is now wired into AppContext and LoginModal. New `SupabaseAuthRestClient` implements its structural Supabase Auth v2 contract through REST, avoiding an SDK install while offline.
- UI sends numeric Email OTP with `create_user:false`, verifies it, resolves Auth identity, calls existing authenticated `/api/v1/me`, and displays explicit membership choices. No role auto-selection.
- Controller preserves selected membership on periodic server recheck and revokes local role if membership disappears. REST client refreshes tokens in memory only; no localStorage/sessionStorage. Reload starts as guest.
- Tests 42/42 PASS; security audit/remediation PASS; security audit tests 2/2 PASS; isolated strict TypeScript PASS for Auth/API/controller/REST/public-directory/types; syntax scan 61 TS/TSX files, 0 errors; candidate ZIP integrity PASS.
- Not verified: full install/project-wide typecheck/lint/Vite build/browser E2E/accessibility/PWA; actual OTP delivery and Preview browser flow. Supabase SDK not installed and bun.lock unchanged. Existing API Edge CORS is restricted to the deployed GitHub Pages origin; exact Preview origin requires explicit review/deploy. No production change or deployment occurred.
- Tenant OWNER still requires server-authorized business selection. Shared writes, unsupported roles and finance/payment remain closed.
- State: `AUTH_OTP_CONTROLLER_AND_MEMBERSHIP_PICKER_WIRED_NOT_PREVIEW_VERIFIED`; `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.

## Permanent continuation rule
When the user says **«كمل»**, resume the first dependency-ordered open task here and in `docs/MASTER_PRODUCTION_TODO.md`. Preserve the AI Studio V6 baseline and all completed work; do not restart.

## Next executable task
1. Review exact Preview origin and update existing `api` Edge Function CORS allowlist for only approved origins; deploy only after validation.
2. Browser-test real OTP request/verify, membership mismatch, one/multiple memberships, session refresh, revocation and sign-out.
3. Add server-authorized business list/selection for tenant-level OWNER.
4. Run full dependency install, project-wide type/lint/build and E2E/accessibility/PWA on network-enabled CI.
5. Then map V6 profile/catalog writes to existing authorized Edge/RPC contracts one module at a time.

---

# CURRENT HANDOFF — 2026-11-05 — V6 Auth controller + sessionStorage r5

- Canonical target remains Google AI Studio V6. Original archive SHA-256 `ff5dae607ea876888068c7b66131bf12a1f1be0fd8a749f7690d311ce9cfe965`.
- Latest candidate: `/MANTIQATIX/MantiqaTix-AI-Studio-V6-CANONICAL-CANDIDATE-2026-11-05-r5.zip`; SHA-256 `635aab70497ff41f4ba8d1b2dd71f87bad6de6f9d8dfe41f537199e87d1870c6`.
- r4 Auth membership API and controller remain included. r5 adds `supabaseSessionStorage.ts`, a Supabase-compatible async storage adapter backed by namespaced tab `sessionStorage` for SDK session/PKCE keys only. Never store V6 roles or membership/business scope there.
- 35/35 service/utility tests PASS; strict isolated TypeScript check PASS; security source audit and remediation PASS; security audit tests 2/2 PASS; syntax scan 63 TS/TSX files, 0 errors; ZIP integrity PASS.
- Supabase SDK install/bun.lock update blocked by npm registry DNS EAI_AGAIN. Auth controller/storage not yet wired into LoginModal/AppContext; PKCE callback, membership picker and browser E2E remain open.
- Existing API Edge CORS only allows GitHub Pages origin. No production changes/deployment, no shared writes or payment/finance activation. Full platform remains BLOCKED / NOT CERTIFIED.

## Permanent continuation rule
When the user says **«كمل»**, continue from the first actionable dependency-ordered task below and the TODO; do not restart or repeat completed work. Keep AI Studio V6 as the canonical app baseline.

## Next task
1. Install/pin Supabase JS v2 on a network-enabled runner and update bun.lock.
2. Instantiate client with PKCE and the new sessionStorage adapter.
3. Wire Auth controller into AppContext/LoginModal and implement explicit membership choice.
4. Confirm API CORS origins for the exact approved app/preview URLs; test real browser sign-in, callback, refresh, membership mismatch, selection and logout.
5. Only then expose protected read screens; implement writes through existing server-authorized contracts one module at a time.

---

# CURRENT HANDOFF — 2026-11-06 — V6 Auth API/controller r4 checkpoint

- Canonical app is AI Studio V6; original archive SHA-256 `ff5dae607ea876888068c7b66131bf12a1f1be0fd8a749f7690d311ce9cfe965`.
- Latest candidate: `/MANTIQATIX/MantiqaTix-AI-Studio-V6-CANONICAL-CANDIDATE-2026-11-06-r4.zip`; SHA-256 `94aa8e6912b310136b7d453e7a776d291ab4700d8619d00d8544f0d91bac3ec7`.
- Added `authMembershipApi.ts` for the existing authenticated `api /api/v1/me` Edge Function and `supabaseAuthController.ts` for injected Supabase JS v2 lifecycle methods. The controller restores a session, verifies the Auth user, fetches server memberships, holds guest role until explicit membership selection, supports Magic Link, refresh events and sign-out.
- 32/32 service/utility tests PASS; strict isolated TSC for membership/API/controller/types PASS; security source audit and remediation PASS; security audit tests 2/2 PASS; syntax scan 62 TS/TSX files, 0 errors; r4 ZIP integrity PASS.
- **Not integrated into UI yet.** Supabase SDK install and bun.lock update blocked by npm DNS EAI_AGAIN. LoginModal/AppContext still do not instantiate the controller; PKCE/session storage, membership picker and real browser auth remain open.
- Existing `api` Edge Function CORS currently allows only the GitHub Pages origin; local preview origin must be approved before browser auth testing. No production Edge/CORS/database/auth change or deployment occurred.
- No shared writes or payment/finance actions were enabled. Full platform remains BLOCKED / NOT CERTIFIED.

## Permanent continuation rule
When the user says **«كمل»**, resume the first open dependency-ordered item in this handoff and `docs/MASTER_PRODUCTION_TODO.md`; do not restart, repeat completed work, or change the canonical V6 baseline.

## Next task
1. On a network-enabled runner install and pin `@supabase/supabase-js`, update `bun.lock`.
2. Create Supabase client with PKCE + sessionStorage policy and instantiate controller.
3. Wire LoginModal/AppContext, auth callback and explicit membership selector.
4. Verify the existing API Edge Function CORS for exact approved origins; then browser test OTP, session refresh, mismatch rejection, membership selection and logout.
5. Continue protected read screens and authorized writes only after server scope checks.

---

# CURRENT HANDOFF — 2026-11-05 — V6 r4 Auth API adapter

- Latest candidate: `/MANTIQATIX/MantiqaTix-AI-Studio-V6-CANONICAL-CANDIDATE-2026-11-05-r4.zip`, SHA-256 `0f283fb6f3a64858f843d14388340f1b198fdec40ed0e2a5c317a350cd9f8787`.
- Added `src/services/authMembershipApi.ts` to call the existing `api /api/v1/me` Edge Function using a user's Bearer token and public Publishable key. It validates the server user ID and uses the strict membership resolver. No token persistence or browser-derived role.
- Focused tests 21/21 PASS; security audit and remediation PASS; ZIP integrity PASS.
- Full npm test/build/type/lint not verified because `tsx` is absent and npm registry DNS failed. SDK and lockfile unchanged.
- Next: install Supabase JS SDK on a network-enabled runner; implement session lifecycle, then explicit membership/business selection. Keep app guest-only if verification fails.
- When user says «كمل», continue this sequence; do not restart.
- Full platform remains BLOCKED / NOT CERTIFIED.

---

# CURRENT HANDOFF — 2026-11-05 — V6 Auth gateway candidate r4

- Canonical source remains the user-selected AI Studio V6. Original archive hash: `ff5dae607ea876888068c7b66131bf12a1f1be0fd8a749f7690d311ce9cfe965`.
- Latest candidate archive r4 SHA-256: `2f364d597c71a60432cfe904a86998bb52a84de6d5280c03b9c16f4914a9dce6`.
- Added standalone `supabaseAuthGateway.ts`: OTP request (create_user false), Auth user verification, call to existing `/functions/v1/api/api/v1/me`, user-ID consistency check, strict membership resolution, logout and URL token cleanup.
- No SDK added and no package lock changed. No tokens persisted in browser storage.
- Tests: Auth gateway 5/5; MJS service/directory/access/security tests 26/26; source audit PASS; remediation PASS; strict isolated TypeScript check PASS; archive integrity PASS.
- Important: gateway is not yet connected to LoginModal/AppContext. No membership picker, refresh lifecycle, or real Supabase HTTP test. Login remains disabled. Full build/E2E/accessibility/PWA remain unverified. No production change/deployment.
- State: `AUTH_GATEWAY_IMPLEMENTED_NOT_UI_WIRED`; `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.

## Permanent continuation rule
When user says «كمل», continue from the first dependency-ordered open task below; do not restart.

## Next executable task
1. Wire email OTP request and callback processing into LoginModal/AppContext.
2. Add explicit membership selection UI (no first-membership auto-select); set AuthSession only after Auth identity and server membership are verified.
3. Add in-memory token refresh/expiry handling and server logout; never store access/refresh tokens in localStorage.
4. Add Preview integration tests against actual Supabase Auth + `/api/v1/me`, including mismatched user, inactive membership, multiple memberships, tenant OWNER business selection and strict platform-admin scope.
5. Run full dependency install/typecheck/lint/build/E2E/accessibility/PWA on a network-enabled runner before any release decision.

---

# CURRENT HANDOFF — 2026-11-05 — V6 Auth membership contract checkpoint

- **Canonical target:** AI Studio V6. Original archive SHA-256: `ff5dae607ea876888068c7b66131bf12a1f1be0fd8a749f7690d311ce9cfe965`.
- **Latest candidate:** `/MANTIQATIX/MantiqaTix-AI-Studio-V6-CANONICAL-CANDIDATE-2026-11-05-r3.zip`; SHA-256 `51dcc932ab4e32b67a00482b1877054294a45647f231e29e064891e0354f6553`.
- Added `src/services/authMembership.ts` for strict, explicit mapping from existing `api /api/v1/me` memberships to V6 session candidates. It checks authenticated user ID, preserves multiple candidates, and requires explicit business selection for tenant-level OWNER.
- Global platform access requires exactly the live backend predicate: SUPER_ADMIN, no business/branch, permissions.scope=PLATFORM and full_control=true. The current read-only aggregate observed 33 active memberships, exactly one strict global super admin, and one tenant owner requiring business selection.
- BUSINESS_OWNER / business-scoped OWNER / ADMIN / MANAGER map to a business-scoped subscriber candidate; CUSTOMER maps to customer; staff/provider/support roles remain unprivileged until dedicated V6 capabilities are implemented. None of this enables writes.
- `AuthSession` now has optional server-resolved user/membership/tenant/organization/business/branch/backend-role/permissions fields. No UI role is hydrated from browser storage.
- Tests 27/27 PASS; strict isolated TSC PASS for types, auth mapping and route policy; syntax transpilation 58 TS/TSX files, 0 errors; security audit and remediation checks PASS; r3 archive integrity and private-data exclusions PASS.
- Auth SDK/login, lockfile update, session refresh, membership selection UI, full project build/E2E and shared writes are still not implemented/verified. Package install cannot run in this offline execution environment. Current website and production Supabase remain unchanged.
- Release state: `V6_CANDIDATE_GATE=BLOCKED_PENDING_SDK_INSTALL_AUTH_AND_SHARED_BACKEND_INTEGRATION`; `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.

## Permanent continuation rule
When the user says **«كمل»**, resume the first actionable dependency-ordered item here and in `docs/MASTER_PRODUCTION_TODO.md`; preserve completed work and do not restart.

## Next task
Pin `@supabase/supabase-js@2.119.0` on a network-enabled runner and update the selected package lockfile; implement auth session lifecycle and compare the Auth user ID against `api /api/v1/me`; add a membership/business selector that never auto-selects an arbitrary membership. Then proceed with secure V6 profile and merchant dashboard data access.

---

# CURRENT HANDOFF — 2026-11-05 — V6 route guard and member-messaging safety checkpoint

- **Canonical app:** Google AI Studio V6. Original archive SHA-256 `ff5dae607ea876888068c7b66131bf12a1f1be0fd8a749f7690d311ce9cfe965`.
- **Latest candidate:** `/MANTIQATIX/MantiqaTix-AI-Studio-V6-CANONICAL-CANDIDATE-2026-11-05-r2.zip` — SHA-256 `80daaa3aaaf8e4912c98003f27b33628add6cd4b99613b3c821010a45adeca67`.
- Candidate r2 is the local reconstruction from the original V6 archive plus recorded security/Team 02/public-directory integration and route-hardening changes; it is not represented as byte-identical to the separately stored security-remediation ZIP. Private `.data/` and local env files are excluded.
- Central route policy now explicitly covers every AuthRole and fails closed on unclassified routes. Only platform admin roles may open `super_admin`; only a subscriber with a business scope may open `merchant_admin`; member messaging is restricted to subscriber/admin/super_admin. Guest navigation prompts login then remains on the public route.
- `MemberMessagesView` now requires an allowed role and active target, and its previously malformed JSX ternary/hook-order issue was corrected.
- Results: security audit PASS, remediation tests PASS, focused tests 17/17 PASS, isolated access-policy strict TSC PASS, syntax transpilation 57 TS/TSX files with 0 errors, ZIP integrity PASS and private-snapshot/env exclusion PASS.
- Full npm install/project-wide typecheck/lint/Vite build/browser E2E/accessibility/PWA not verified because the required dependencies are unavailable in this runner.
- Supabase Auth and `api /api/v1/me` membership integration remain the next task. No shared writes or production operations were changed. Current site remains unchanged.
- `V6_CANDIDATE_GATE=BLOCKED_PENDING_FULL_BUILD_AUTH_AND_SHARED_BACKEND_INTEGRATION`; `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.

## Permanent continuation rule
When the user says **«كمل»**, resume the next dependency-ordered open item here and in `docs/MASTER_PRODUCTION_TODO.md`; do not restart or repeat completed work.

## Next executable task
Implement Supabase Auth session handling and server-authorized membership resolution through `api /api/v1/me`, with no browser-trusted roles. Then connect the business profile and merchant dashboard screens to existing authorized read/write contracts one module at a time. First run the V6 project install/type/lint/build/E2E gates on a network-enabled runner.

---

# CURRENT HANDOFF — 2026-11-05 — V6 read-only directory integration pass

- **Canonical target:** Google AI Studio V6. Original source archive SHA-256: `ff5dae607ea876888068c7b66131bf12a1f1be0fd8a749f7690d311ce9cfe965`.
- **Local reconstructed candidate artifact:** `MantiqaTix-AI-Studio-V6-CANONICAL-CANDIDATE-2026-11-05.zip`; SHA-256 `6f9ef2ad70997255b6b6bf26aa34bb1ec93b92d48264c571359b8b96803f1a9b`. It was created by applying the supplied security-remediation patch to the exact original archive, reconciling Team 02 UI improvements and adding a public directory adapter/auth hardening.
- **Important provenance qualification:** the security patch's final hunk applied with fuzz 2; the separate stored security-remediation ZIP could not be materialized as raw bytes, so the reconstructed candidate is not claimed to be byte-identical to that ZIP. Its own archive SHA and ZIP integrity are verified. Official-candidate equivalence remains open.
- **Implemented in this candidate:** public read-only adapter from active `public-catalog-directory` v17; mappings for approved public businesses and available/priced catalog items; directory connection states; no local Seed fallback for public directory; local roles are no longer restored from Local Storage and subscriber local password login is disabled until Supabase Auth/membership verification exists; Team 02 pagination/accessibility/metadata and safe admin-summary updates merged without undoing security changes.
- **Live Supabase snapshot (read-only inspection):** 137 public tables, 42 active Edge Functions, 309 migrations. Existing `businesses`, `branches`, `user_memberships`, `catalog_items`, `catalog_item_prices`, and `public_directory_listings` contracts exist; no duplicate tables/APIs were introduced.
- **Tests:** security audit PASS; remediation tests 2/2; public adapter + pagination tests 9/9; strict isolated adapter/types type-check PASS; syntax transpilation 55 files/0 syntax errors; original and generated ZIP integrity PASS.
- **Not verified:** full npm install/typecheck/lint/build/E2E/PWA; real HTTP request to the Edge Function from this execution environment; Auth/membership integration; shared writes and modules; data reconciliation; preview or production cutover. Network DNS was unavailable and npm offline install failed due missing cache.
- **Safety:** current public website and Supabase Production remain unchanged. Full platform remains BLOCKED / NOT CERTIFIED.

## Permanent continuation rule
When the user says **«كمل»**, resume the first actionable open task in `docs/MASTER_PRODUCTION_TODO.md` from this checkpoint. Do not restart or re-ask known requirements.

## Next executable task
1. Run the candidate on a network-enabled CI/build runner and capture dependency installation, full type-check, lint, production build, browser E2E, accessibility and PWA results against one immutable revision.
2. Implement Supabase Auth sign-in/session verification and server-side `api /api/v1/me` active-membership resolution; never trust client role metadata or browser Local Storage.
3. Map V6 profile/catalog/merchant screens to current authenticated Edge Function/RPC contracts, then implement writes one bounded module at a time with tenant/business/branch tests.
4. Continue import dry-run, feature parity, rollback/backup evidence, preview and controlled cutover only after gates pass.

---

# CURRENT HANDOFF — 2026-11-05 — OWNER-APPROVED V6 CANONICAL TARGET

- **Canonical target application:** Google AI Studio V6, source archive `bizcatalog-manager (5)(1).zip`, original SHA-256 `ff5dae607ea876888068c7b66131bf12a1f1be0fd8a749f7690d311ce9cfe965` (ZIP integrity previously PASS; 150 entries).
- **Preferred candidate for next source work:** Library artifact `MantiqaTix-V6-security-remediation-candidate.zip` with `V6_SECURITY_REMEDIATION_REPORT_AR.md` and `V6_SECURITY_REMEDIATION.patch`. This is not yet an independently verified immutable baseline: verify its own digest and contents first.
- **Owner direction (2026-11-05):** Make AI Studio V6 the actual application/product and UX baseline. Treat the older deployed catalog application as a temporary stable production baseline and a source of verified backend contracts, live data, schema, security, release engineering and proven legacy capabilities to port into V6. Do not reverse this relationship.
- Team 02's additive UI patch must be reconciled with the latest security-remediated candidate, not blindly applied over it. Preserve the AppContext/security fixes and all original AI Studio/PWA assets.
- The current GitHub Pages deployment must remain unchanged until V6 is integrated into the single approved build/deploy path, feature parity and backend integration are verified, preview/E2E/security/accessibility/PWA and backup/restore/rollback gates pass, and cutover is authorized.
- Never publish private `.data/` snapshots, secrets, keys, raw personal/financial records or demo seeds as real production data.

## Permanent resume rule
When the user says **«كمل»**, resume the first actionable open item in `docs/MASTER_PRODUCTION_TODO.md` from this checkpoint. Do not restart, re-plan from zero, repeat completed tasks, or ask for requirements already recorded. Check the live repository/PR/workflow state first, preserve all previous decisions and evidence, update TODO and append the session log, then continue to the next dependency-ordered safe task.

## Current next executable task
Verify the SHA-256/ZIP integrity and exact contents of `MantiqaTix-V6-security-remediation-candidate.zip`; compare it to the original V6 archive and reconcile the Team 02 UI patch. Then execute the full dependency/type/lint/build/test/E2E gate on one immutable V6 candidate. The supplied report's PASS results are limited to static audit, independent remediation tests, and TS syntax transpilation (53 files); install, full type check, build, browser E2E and backend integration remain NOT VERIFIED. `V6_CANDIDATE_GATE=BLOCKED_PENDING_BUILD_AND_BACKEND_INTEGRATION`; `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.

---

# CURRENT HANDOFF — 2026-11-05 — Standalone V6 candidate review

- Current deployed baseline remains `apps/catalog-frontend` on repository main, not the standalone root-level AI Studio V6 candidate.
- The supplied files identify `bizcatalog-manager (5).zip` as the candidate authority and include its baseline/deployment/security/DR/capacity/load documentation plus `index.html`. The ZIP and full React source tree were not attached in this continuation.
- Candidate documentation records a read-only directory adapter and 20-row pagination, but no shared writes/Auth; client state still uses localStorage and the old Express snapshot route had been unauthenticated before it was restricted to local-only development.
- Do not import `.data/production-live-db.json` into a public repo or build. Reconcile it only in dry-run against a verified target schema.
- The supplied security/DR/load/capacity files are targets or report claims; they do not establish deployed Zero Trust, 99.95% availability, RPO<5m, RTO<30m, 500k VU or 100M-user capacity.
- Current production/main evidence remains: V4 catalog pilot deployed; full platform BLOCKED / NOT CERTIFIED.
- Detailed source review: [AI_STUDIO_V6_SOURCE_CANDIDATE_REVIEW_20261105.md](docs/release/AI_STUDIO_V6_SOURCE_CANDIDATE_REVIEW_20261105.md).

## Next executable actions
1. Inspect the actual V6 ZIP/source tree and verify its digest against the supplied baseline record.
2. Run its pinned build/type/lint/browser/PWA tests, then define the Supabase entity mapping and permissions matrix.
3. Keep production and public root unchanged until shared Auth/write contracts, security, data reconciliation, backup/restore, rollback and E2E have evidence.

---

# CURRENT HANDOFF — 2026-11-02 15:25 UTC

This checkpoint supersedes the older dated handoff below; historical entries are retained.

- Current `main`: `10b8733b5b0616ee69d2e0cf963d2e904e53fb6d` (PR #659 merged).
- Catalog PRs merged and deployed:
  - #654 — Marketplace Home is the canonical root; directory/search remains a separate reload-safe `?view=directory` route.
  - #655 — doctor batch-import source now stages unverified draft records without a per-row permission UUID; new public doctor publication and source changes require the separate current source-permission gate. **The `directory-listings` Edge Function source has not been deployed to Supabase Production.**
  - #656 — secondary screens are lazy-loaded; Marketplace Home and directory remain in the initial path.
  - #657 — accessible HTML loading shell, one shared in-flight public-directory request, and platform-admin settings load concurrent with catalog hydration.
  - #659 — three activity cards per row on mobile; compact stacked cards at phone widths and responsive desktop layout.
- Main exact-head validation: Primary Catalog Frontend Validation [41470234602](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41470234602) PASS (build, employee RBAC PostgreSQL, browser E2E). Browser result includes `canonical-activity-code-precedence-and-three-column-mobile-grid`.
- GitHub Pages deployment and deployed-origin browser E2E: [41470234652](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41470234652) PASS. The deployed browser result also includes `canonical-activity-code-precedence-and-three-column-mobile-grid`, dashboard/membership scope, mobile layout, and permanent QR-link checks.
- Production Health Monitor [41470234682](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41470234682) PASS. Supporting backend, MantiGO privacy, module professionalization and SMM contract validations passed.
- Superseded PRs closed after confirming their useful changes are present or selectively ported: #609, #619, #627, #629, #644. PR #618 remains open for separate membership-context switching; cross-membership switching must remain disabled until the exact membership-scoped backend contract is independently tested and deployed.
- Performance work is source/CI/deployed-origin verified, but no numeric LCP/INP/CLS improvement is claimed; no controlled performance measurement was run.
- Doctor source/import rules: no new doctor rows were inserted. The #655 Edge Function source change is merged in GitHub only; until a separately reviewed deployment, the Production importer remains at its existing deployed version.
- No production database migration, data insert/update, RLS/ACL/Auth change, Edge deployment, payment/finance mutation, or provider call was performed in this continuation.
- The global `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED` remains unchanged. The 2026-11-02 read-only Production evidence snapshot still records 309 migration rows through `20261101140105`, 0/42 exact release-version IDs, 32/60 selected object checks non-PASS, six critical Edge mismatches, and open RC449A/RC450, payment/finance, backup/restore, Auth and tenant-isolation evidence.
- Evidence report: [PRODUCTION_GATE_EVIDENCE_20261102.md](./audits/PRODUCTION_GATE_EVIDENCE_20261102.md).

## Next safe sequence
1. Keep the three-column mobile layout and deferred-screen behavior under normal regression monitoring; measure LCP/INP/CLS on controlled devices before making performance claims.
2. For doctor imports, rehearse the merged `directory-listings` Edge Function in an isolated environment, including draft-only batch, 20-row cap, duplicate handling, source attribution immutability for published records, and positive/negative publication-gate tests. Deploy only through a reviewed Edge release with the corresponding current backend evidence; do not insert real doctor rows until the source/owner-consent gate is satisfied.
3. Review PR #618 membership switching as a separate security task. Preserve the disabled state until exact-membership authorization is verified on a current Edge version and adversarial branch/tenant tests pass.
4. Continue the dependency-ordered production work: restorable current-schema snapshot, migration reconciliation/replay/rollback, RC463 ACL rehearsal, RC449A/RC450 journal prerequisites, Paymob/finance E2E, Auth, tenant isolation, backup/restore/RPO/RTO.
5. Keep full platform gate blocked until every independent release gate passes and the complete rollout is explicitly authorized.

---
# MantiqatiX — Project Continuity & Production Handoff

> **CURRENT HANDOFF — 2026-10-31 19:28 UTC:** Start every session at master request ledger [#599](https://github.com/islamnagy2022-eng/MantiQaTiX/issues/599) and [CROSS_SESSION_TODO_PROTOCOL.md](./CROSS_SESSION_TODO_PROTOCOL.md). Every new request must be registered in #599 and `docs/MASTER_PRODUCTION_TODO.md`; unfinished work stays open. Current main baseline for this security continuation is `cd9929e337fce58d4c20dfbb94febfd7e4f36291`. PR #617 (RC463 trigger-only SECURITY DEFINER hardening) is Draft/unmerged on branch `security/rc463-current-main-rehearsal-20261031`; code/test commit `43483d855bb08a63a37f78be564f5eb670f8a465` passed exact-head PostgreSQL 17.11 trigger integration, 75-migration historical-checkpoint replay, build, employee RBAC and Playwright, plus supporting migration/backend/payment/privacy checks. Production is PostgreSQL 17.6.1.155; RC463 has not been applied. PR #618 account portal is also Draft/unmerged; exact-head build, employee RBAC and Playwright passed, but cross-membership switching stays disabled pending backend parity. Live Supabase inventory: 308 migration rows through `20261029083845`, with 0/42 exact required release version IDs present; this is an identity mismatch, not proof all physical effects are absent. Six critical payment/order/finance Edge Functions remain drifted; RC435/RC439 and RC449A/RC450 runtime contracts, backup/restore, Auth and payment/finance E2E evidence remain open. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`. PR CI is not a production deploy; no DB/Auth/RLS/GRANT/Edge/financial mutation was performed.


> **MANDATORY START HERE FOR EVERY FUTURE SESSION**

 > **LATEST SESSION STATE — 2026-10-31 (RC463 PostgreSQL 17 continuation):** PR #617 exact-head CI passed on code/test commit `43483d855bb08a63a37f78be564f5eb670f8a465`: RC463 trigger-only PostgreSQL 17.11 integration (including commission audit INSERT/UPDATE/DELETE), 75-migration disposable forward replay, build, employee RBAC and Playwright, plus supporting backend, finance, payment, privacy, migration immutability/uniqueness/collision checks. Production Supabase is PostgreSQL 17.6.1.155. Pages validation passed; PR deployment was skipped. Live read-only catalog checks show both functions return `trigger` and are bound to enabled triggers (not ordinary RPCs); default ACL still gives PUBLIC/API-role EXECUTE, while the owner-assignment function retains `search_path=public, auth`. No Production migration/ACL/function/trigger change was applied. PR #617 remains Draft; independent review and current-schema backup/restore/rollback rehearsal are required. Live ledger remains 308 rows through `20261029083845`, 0/42 exact required versions recorded. Full platform remains **BLOCKED / NOT CERTIFIED**.
>
> Before changing code, database, Edge Functions, deployment, security, or release configuration, read this file first and then read `docs/MASTER_PRODUCTION_TODO.md`.
> Do not repeat completed work. Continue from the first still-open gate, and append every material development to both this file and the Master TODO.

## Historical session update — 2026-10-21 (superseded by Current baseline)

- Current active work is PR #316 on branch `fix/preview-starts-at-public-home-20261021`; inspected head before this documentation-only commit: `011834e5e9e2d8f8b0b189bd22976c7cc2e64b39`.
- Preview/navigation contract validator is present and invoked by `.github/workflows/pages.yml`. The production Pages deploy job is intentionally restricted to `main` push or manual dispatch on `main`; PR runs should skip deploy.
- CI run 39616462814 was still queued at job level during inspection; latest check-run snapshot had 15 checks, 0 completed, and no recorded failures. Treat this as pending, not passed.
- No live site HTTP/browser test was performed in this session. Authenticated browser flow, PWA offline behavior, tenant isolation, and production E2E remain NOT VERIFIED. Global release gate stays BLOCKED / NOT CERTIFIED.
- No merge, main push, production deployment, or production data/configuration mutation was performed. See the append-only details in `docs/SESSION_LOG.md`.

## Historical verification update — 2026-10-21 (superseded by Current baseline)

- PR #316 source CI completed successfully on head `57d9c20c71dab78a01c8ff50ccf69acb1b3c7818`; Pages `validate` passed and the related targeted privacy/financial/security integration checks passed. Run: https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39616640682
- Pages deploy was skipped on the PR event by design; post-deploy HTTP smoke checks were not executed for this PR. A direct fetch attempt for the public preview URLs returned cache-miss errors, which are inconclusive.
- `docs/MASTER_PRODUCTION_TODO.md` item 10 now distinguishes passing CI from unverified deployed preview/browser E2E.
- No merge or production deploy occurred. Authenticated browser flow, tenant isolation E2E, PWA offline behavior, and the overall production release remain NOT VERIFIED / BLOCKED.

## Historical dashboard development note — 2026-10-28 (superseded by subsequent main releases)

- An additive professional dashboard implementation has started on branch `feat/professional-dashboard-additive-20261028`.
- New component: `apps/catalog-frontend/src/modules/dashboard/ProfessionalDashboard.tsx`.
- Existing view state, URL parsing, App.tsx rendering, and Navbar navigation have been extended to add `professional_dashboard`; old directory, public storefront, merchant dashboard, and admin dashboard remain in source.
- Initial dashboard metrics use the existing in-memory AppContext only; no database/schema changes or fake financial data were added.
- **NOT VERIFIED:** build/lint, workflow CI, browser rendering, role/tenant isolation E2E, production deployment, and regressions. Do not merge/deploy until checked.
- See the dated entry in `docs/SESSION_LOG.md` and item 34 in `docs/MASTER_PRODUCTION_TODO.md`.
- Production gate remains **BLOCKED / NOT CERTIFIED**.

## Current baseline — refreshed 2026-10-31

- Repository: `islamnagy2022-eng/MantiqatiX`
- Branch: `main`
- Latest main checkpoint: `b41c3c312e713f1975bafef6a617ad7159e1b4f8` (PR #575 merge; docs-only).
- PR #567–#570 added the read-only Free-tier database continuity monitor and documented the read-path preflight/direct `SELECT 1` connectivity evidence. Current-main Production Health Monitor run [41159588678](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41159588678) completed successfully on commit `d61baeccd5444248e8d778117ab3ab4a09f2b45f`; its job log confirms the read-only PostgREST GET returned HTTP 200 (`SUPABASE_DATABASE_READ_ONLY_PROBE=PASS`). This is one successful probe, not an uptime guarantee. Failure-notification delivery remains NOT VERIFIED. PR #571 corrected the `supabase db dump` documentation URL and recorded backup/restore scope; it did not create a backup or run a restore.
- On latest main `adf0680a3c151330656b9712a03849c796aa4c09`, Health Monitor [41159666007](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41159666007), Privacy Boundary [41159666176](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41159666176), Backend-only Module Boundary [41159666031](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41159666031), and Module Professionalization [41159666122](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41159666122) passed. Health job log confirms the database REST probe passed. Pages run [41159666222](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41159666222) completed successfully, including deployed-origin Playwright E2E. Tests covered guest denial, owner mobile/desktop dashboard, employee/branch-owner/manager permission boundaries, merchant QR, stable permanent links, GPS consent/manual-search fallback, external media URLs, taxonomy navigation and mobile layout. axe found no critical or serious WCAG 2.1 violations in the tested dashboard/QR views. Failure-notification delivery remains NOT VERIFIED.
- On latest main commit `b41c3c312e713f1975bafef6a617ad7159e1b4f8`, Production Health Monitor [41160088237](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41160088237) passed and its job log confirmed `SUPABASE_DATABASE_READ_ONLY_PROBE=PASS`. The Pages deployment and other CI workflows for this documentation-only commit were still queued/in progress at the last check.
- Latest full verifier evidence from Pages run #41159666222 kept `PRODUCTION_GATE=BLOCKED` and `CATALOG_PILOT_GATE=PASS`. It reported 32/60 required physical-object checks as non-PASS, 0/41 exact required migration identifiers in the live ledger, two pending migration aliases, six critical Edge Function source mismatches, missing RC449A/RC450 journal columns/RPC ACL, and payment/finance E2E and backup/restore rehearsal NOT VERIFIED. See `docs/audits/PRODUCTION_GATE_EVIDENCE_20261031.md`.
- Supabase Production project: `moyhiluyhjsujhwlyeuu`
- Public site: `https://islamnagy2022-eng.github.io/MantiqatiX/`
- Earlier full application deployment snapshot (PR #565 baseline) passed: Web deployment [41155204293](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41155204293), Production Health Monitor [41155204266](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41155204266), Backend-only Module Boundary [41155204267](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41155204267), Module Professionalization [41155204271](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41155204271), MantiGO Privacy [41155204224](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41155204224), and SMM Deferred Storefront Contract [41155204313](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41155204313). These runs validate that tested application snapshot only; PR #567–#572 added monitoring/documentation changes. Latest-main checks now include successful build/validation and deployment/root check in Pages run [41159666222](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41159666222); deployed-origin Playwright tests were still running at last check. These checks do not close the global Production Gate.
- Live migration ledger: **308 rows**, latest `20261029083845`; **0/41** exact required release version IDs are recorded. This is a ledger-identity finding, not proof that every migration effect is absent. Reconcile the physical object manifest and known aliases; never fabricate ledger rows or rewrite historical migrations.
- Current finance contracts: RC435/RC439 subscription provider-creation claim/encrypted-recovery columns and RPCs remain absent. RC449A/RC450 journal header/line fields remain absent, and live journal `SECURITY DEFINER` / `search_path` / `service_role EXECUTE` does not match the current Edge Function contract. The fresh read-only report is `docs/audits/PRODUCTION_FINANCE_LIVE_CONTRACT_RECHECK_20261031.md`.
- Six live critical Edge entrypoints still differ from main: `order-create v8`, `payment-intent v8`, `paymob-webhook v10`, `digital-page-payment-intent v5`, `subscription-payment-intent v4`, and `financial-journal v3`. Do not batch-deploy or replace them without schema/ACL reconciliation and isolated provider E2E.
- Latest Security Advisor snapshot (2026-10-31 01:24:38 UTC): 8 RLS-enabled/no-policy tables, 3 anon-executable and 67 authenticated-executable `SECURITY DEFINER` functions; leaked-password protection remains disabled. Performance findings: 129 unindexed FKs, 375 auth/RLS init-plan findings, 73 unused indexes, 28 multiple-permissive-policy groups. Review individually; do not bulk-rewrite policies, grants, or indexes.
- Auth/subscriber path: PR #543 moved `LIST_SUBSCRIBERS` out of blocking Google session bootstrap; PR #546 preserves last-good subscriber data on refresh failures and rejects stale responses after logout/account switching. PR #547 records passing build, OAuth/session contract, role/membership tests, browser checks, Pages deployment and health-monitor evidence. Real Google-account timing/cross-account checks and a controlled failed `LIST_SUBSCRIBERS` → manual-retry browser test remain **NOT VERIFIED**. Supabase Leaked Password Protection is still disabled.
- Historical checkpoint `20261008222845` and targeted PostgreSQL fixtures are not a full restore of current Production through `20261029083845`. There is no isolated development branch. A complete credential-scrubbed current schema capture, disposable restore, rollback rehearsal and measured RPO/RTO are still required.
- The Pages workflow publishes `apps/catalog-frontend/dist`; it does not publish the legacy `web/` tree and does not deploy Supabase Edge Functions.
- Android remains a separate open release gate: the uploaded RC40 archive is a reference source, not the current main Android release baseline; no signed artifact/device evidence is verified.
- Production Gate: **BLOCKED / NOT CERTIFIED**.

## Historical verified web execution batch — 2026-10-18 (superseded by Current baseline)

- Marketing/agency workspace is merged to main in PR #292, commit `bd08e8436ba16a5a84c0c0cfd5e346591b364bb7`. It provides tabbed leads, partner directory, projects, ads, and RC453-dependent campaign actions; missing RC453 schema triggers an explicit fallback to the existing workspace. Campaign reads are scoped to the active business.
- Exact tested PR head `7b6757830907c6843eadbcec5425bbd1da8b67b4`: marketing contract, Pages validation, backend-only boundary, MantiGO privacy, and module professionalization workflows passed. The Pages deploy job was skipped on the PR event; verify main push deployment separately.
- PWA cache version is `mnty-web-v129`; exact versioned app and Supabase SDK URLs are precached.
- Security review PR #291 merged as `cf522740e9dd058c28728ba582e347661ef24122`. Expanded read-only entrypoint parity spot-check: 27/29 sampled Edge Function `index.ts` files are byte-identical; the two drifted functions are `financial-journal` and `mnty-customer-registration`. Auth Advisor also warns about anonymous sign-ins and leaked-password protection. See `docs/release/SECURITY_DEFINER_REVIEW_20261018.md` and `docs/audits/CUSTOMER_REGISTRATION_RPC_DRIFT_20261016.md`.
- Production database remains at RC424. RC453 campaign schema/RPCs and the RC450 financial-journal backend contract are not confirmed deployed. The live digital-page payment RPC also lacks RC431 provider-order/event replay hardening. Do not perform out-of-order hotfix grants or claim production certification.
- Release remains **BLOCKED / NOT CERTIFIED**.

## Historical web execution batch (superseded)
- RC314–RC315: restaurant workspace feedback was upgraded from browser alerts/prompts to platform-native accessible toast/modal flows; source verification confirms no `alert(` or `prompt(` remains in `web/restaurant-module.js`.
- Public asset versions were refreshed and the PWA cache advanced to `mnty-web-v114`.
- These changes are **IMPLEMENTED — NOT VERIFIED** until the main-branch Pages workflow completes successfully.

## Work already completed — DO NOT REPEAT

### CI / release pipeline
- Multiple production CI runs through RC247 have been verified successful.
- Latest verified successful run before this continuity record: `36986515744`.
- GitHub Pages workflow validates and deploys `apps/catalog-frontend/dist`; it excludes the legacy `web/` tree and does **not** deploy Supabase Edge Functions. PR deploy jobs are skipped by design.

### Supabase / database
- Production is healthy and active.
- 121 public base tables were verified.
- RLS is enabled on **121/121** public base tables.
- RLS presence is not equivalent to tenant-isolation E2E; real two-user/two-tenant verification remains open.
- No production financial test transactions were fabricated.

### Edge Functions source convergence
Production has 35 ACTIVE Edge Functions. The repository source tree currently contains 20 function directories.

The 16 functions originally found without matching repository source were:
`business-deactivate`, `approval-list`, `business-onboarding-status`, `financial-journal`, `settlement-financial-atomic`, `legal-consent`, `legal-cms`, `legal-gate`, `legal-center`, `subscription-start-trial`, `subscription-payment-intent`, `ai-gemini-proxy`, `erp-product-create`, `erp-purchase-receive`, `marketing-lead-create`, `mnty-provider-onboarding-review`.

**Already restored and exact-matched:**
- `mnty-provider-onboarding-review`
- Live source and GitHub source were byte-for-byte equal at 2195 bytes.
- Restore commit: `2a2b8ad1a48cb6293142ae019b920619f0188b88`.

**Still not converged:**
- `business-deactivate`
- `approval-list`
- `business-onboarding-status`
- `financial-journal`
- `settlement-financial-atomic`
- `legal-consent`
- `legal-cms`
- `legal-gate`
- `legal-center`
- `subscription-start-trial`
- `subscription-payment-intent`
- `ai-gemini-proxy`
- `erp-product-create`
- `erp-purchase-receive`
- `marketing-lead-create`

Live production source was revalidated for all of these. A GitHub source write attempt was rejected by the OpenAI/GitHub safety layer. Do **not** bypass the safety layer or invent replacement source.

### Security
- Supabase Security Advisor was re-run.
- Leaked Password Protection is still **DISABLED** and is a release security gate.
- Intentional public sanitized advertisement RPC warning remains.
- Six authenticated SECURITY DEFINER warnings remain and require per-function caller-path review; do not apply blanket revocation.
- `digital_page_payment_events` has RLS enabled with no policies; do not add broad policies merely to silence the advisor.

### Finance / payments
- Settlement journal posting order was fixed and migration applied in RC238.
- Refund backend authority was traced in RC239; no speculative refund API was added.
- Real Paymob/payment E2E is **NOT VERIFIED**.
- Real settlement transaction E2E is **NOT VERIFIED**.
- Real refund E2E is **NOT VERIFIED**.
- Do not create fake financial transactions to close these gates.

### Provider onboarding
- Submit/review flow and UI were implemented/verified to the documented extent.
- Review source is now converged in GitHub.
- Approval/rejection notification E2E remains open.

### Digital paid pages
- Pricing/order/idempotency/payment foundation exists.
- Public renderer, fulfillment/editor flow, browser payment E2E, refunds/receipts, SEO/QR/versioning and final regression remain open.

### Monitoring
- Production unified log streams are available and have been inventoried.
- Detailed severity/error aggregation and an incident drill remain open.

### Backup / recovery
- No real production restore rehearsal has been completed.
- RPO/RTO and two-tenant recovery remain open.

### Android
- No verified signed APK/AAB or device E2E release evidence exists.
- Prior build attempts were blocked by environment/network/Gradle availability.
- Do not claim Android release readiness without actual artifact/device evidence.

## Open release gates — work from here

Priority order, based on the latest verified Production state:

1. **Current-schema isolated rehearsal:** obtain an authorized, credential-scrubbed schema-only capture of current Production; restore it into a disposable environment and prove restore/rollback. Do not substitute the October 17 checkpoint or targeted fixtures.
2. **Migration/physical-object reconciliation:** reconcile the 308-row live ledger, the 41 required release IDs, the 60-object manifest, and known aliases without fabricating ledger rows or replaying historical migrations out of order.
3. **Subscription and finance contracts:** rehearse RC435/RC439 and RC449A/RC450 against the current-schema restore, including actor binding, service-role ACL, tenant/business/branch isolation, idempotency, duplicate journal protection and balanced ledger posting.
4. **Live Edge Function parity:** complete semantic diffs and dependency tests for the six critical order/payment/finance entrypoints; no blind batch deploy.
5. **Auth and subscriber runtime:** verify real Google-account sign-in, session refresh/logout, account switching, tenant/membership scopes, and controlled failed `LIST_SUBSCRIBERS` followed by authorized manual retry. Enable Leaked Password Protection only through an authorized Supabase Auth action and rerun Advisor/regression.
6. **Customer/provider/payment E2E:** verify two independent tenants, customer→provider→order→notification, Paymob sandbox/webhook replay, refunds only against a verified provider contract, settlement and journal posting.
7. **Operations and recovery:** test notification delivery, incident/alert response, backup restore, measured RPO/RTO, and rollback.
8. **Android release:** reconcile RC40 concepts with current contracts, produce a signed Android artifact, and verify install/update/auth/role/offline/device flows.
9. **Final regression and release evidence:** close every mandatory web/app/API/database/security/finance/CRM/monitoring/backup gate before any Production Ready claim.

## Continuation protocol

For every future session:
1. Read this file.
2. Read the latest tail of `docs/MASTER_PRODUCTION_TODO.md`.
3. Inspect the current Git/CI/Supabase state only for the first open gate.
4. Do not repeat any checked item above unless new evidence invalidates it.
5. Never fabricate users, payments, backups, devices, or production outcomes.
6. Never bypass a security control or create speculative production source.
7. After every material change, append an RC entry to the Master TODO and update this continuity file if the baseline changed.
8. Only mark the Final Production Gate closed after all mandatory external/runtime evidence is actually verified.

## Release status

**NOT PRODUCTION READY YET.**

This status is intentional and must remain until the open gates above are independently evidenced.


## RC249 update — Digital Page content layer
- Added production `digital_pages` and `digital_page_sections` with RLS and publication lifecycle.
- Applied migration: `20261002110000_rc248_digital_page_content_publishing`.
- Added public renderer and authenticated owner editor under `web/digital-page*` and `web/digital-page-editor*`.
- Browser E2E, media/storage integration, QR and advanced fulfillment remain open.


## RC250 update — Edge Function source convergence batch 1
- Exact-matched live Production source into GitHub for: `settlement-financial-atomic` (`index.ts` + `deno.json`), `subscription-payment-intent`, `subscription-start-trial`, `financial-journal`.
- 11 of the original 16 missing active function sources remain to be converged.


## RC251 update
- Exact-matched 4 more live Edge Functions: `business-deactivate`, `business-onboarding-status`, `approval-list`, `legal-consent`.
- Original source-convergence gap is now reduced to 7 active functions: `legal-cms`, `legal-gate`, `legal-center`, `ai-gemini-proxy`, `erp-product-create`, `erp-purchase-receive`, `marketing-lead-create`.


## RC252 update — Edge Function source convergence CLOSED
- All 35 ACTIVE Production Edge Functions now have corresponding repository source.
- The original 16-function source gap is closed with exact live-vs-GitHub comparisons.
- CI/release verification for the final convergence commits remains pending; runtime/security/recovery release gates remain open.


## RC253 update — Final convergence CI/release verification — 2026-10-02
- [x] Verified GitHub Actions run `36987846198` for the final Edge Function source-convergence commit `286c70896ccf8ba0eea91ee5a4d0dd1cdbe8027d`.
- [x] `validate` job completed successfully, including syntax checks and required web files.
- [x] `deploy` job completed successfully, including GitHub Pages deployment and the production deployed-site verification step.
- [x] The preceding run `36987837273` was cancelled because a newer commit/run superseded it; its completed validation steps had passed before cancellation.
- [x] Edge Function source convergence is therefore now CI/release-verified for the current main baseline.
- [ ] Final Production Gate remains OPEN for leaked-password protection, per-function SECURITY DEFINER review, real multi-tenant E2E, Paymob/finance/refund E2E, notifications, monitoring drill, backup/restore, Android release/device evidence, and final regression/release evidence.

## Current baseline after RC253
- Latest verified project commit: `286c70896ccf8ba0eea91ee5a4d0dd1cdbe8027d`.
- Latest release-gate record: **RC253**.
- Final Production Gate: **OPEN**.


## RC255 — Runtime authorization test design gate — 2026-10-02
- [x] Re-read the current continuity/TODO baseline before changing scope.
- [x] Confirmed source convergence and CI verification are already closed; no repeat implementation was performed.
- [x] Audited repository call-site search for direct client calls to the six reviewed SECURITY DEFINER functions; no direct `supabase.rpc(...)` call-site was found for the searched signatures. This does not prove absence because wrappers/dynamic calls may exist.
- [x] Kept production grants unchanged because authorization correctness must be demonstrated with authenticated identities, not inferred from static search alone.
- [x] Defined the next executable release gate as a controlled two-user/two-tenant authorization E2E covering: own-tenant read/write, cross-tenant denial, customer-to-provider order/payment boundary, provider/admin role separation, and anonymous denial for authenticated-only RPCs.
- [ ] Runtime E2E remains NOT VERIFIED because the available project environment does not provide safe disposable authenticated test identities/fixtures for two independent tenants.
- [ ] Final Production Gate remains OPEN.


## RC266–RC267 update — 2026-10-03
- CI traceability for the later docs-only commit remains unverified because the available commit-run connector operation is PR-filtered; an empty result is not evidence that a push run did not execute.
- Supplied RC40 archive was audited and confirmed to contain an Android/Gradle project, but the current `main` release tree is web-only and does not contain that Android project. Android is therefore still an external/unverified release gate; no blind source merge was performed.
- Final Production Gate remains OPEN.


## RC268 update — 2026-10-03
- Hardened marketing lead mutation boundary: browser-side direct inserts into `marketing_leads` were removed from normal lead creation and advertising booking; both now use the protected `marketing-lead-create` Edge Function.
- Added CI regression checks to prevent reintroducing direct browser inserts for this table.
- Runtime multi-user/multi-tenant E2E remains open.

## RC269 update — 2026-10-03
- Re-ran live Security Advisor after the RC268 marketing mutation hardening.
- Confirmed the remaining findings are not all safe candidates for blanket revocation: the public targeted-ad RPC is intentionally exposed for advertisement serving, while RBAC/admin SECURITY DEFINER functions already have explicit authenticated-only grants and internal authorization checks.
- Checked current Supabase billing state: organization plan is Free; production project creation cost is $0/month; a development branch is currently quoted at $0.01344/hour.
- No branch or other cost-incurring resource was created.
- Recorded the current cost envelope and external dependencies for Paymob, Android distribution, PITR, browser/device testing, and push delivery.
- Final Production Gate remains OPEN.

## RC270 update — 2026-10-03
- Added CI regression guards covering sensitive browser mutation boundaries: orders, payment_intents, user_memberships, notifications, marketing_projects and advertisements.
- Verified the current `web/*.js` source has no direct INSERT/UPDATE/DELETE calls for those protected tables.
- Marketing lead protection remains enforced through the dedicated Edge Function guard.
- Runtime E2E, Paymob/finance, backup/restore, Android and external device/browser gates remain open.
- Final Production Gate remains OPEN.


## RC272 — 2026-10-03
- [🟢] CI/CD VERIFIED: GitHub Actions run #1342 (run id 37129102049) succeeded for commit `e4d1d91fa0317e3d7614a40d16b2c227b20e3808`.
- [🟢] Browser mutation boundaries remain VERIFIED through the Pages validation workflow.
- [🟡] Android remains NOT VERIFIED/BLOCKED: current main has no Android Gradle project; historical RC40 Android source must be reconciled before reintroduction. Local RC40 build was blocked before compilation by unavailable Gradle network access.
- [🟡] Supabase Security Advisor rechecked 2026-10-03: RLS-enabled/no-policy finding remains limited to `digital_page_payment_events`; SECURITY DEFINER findings remain for 1 anon-callable targeted-advertisement RPC and 9 authenticated-callable operational/RBAC functions; these were previously reviewed and are not to be disabled blindly.
- [🟡] Supabase Performance Advisor remains workload-dependent: unused-index findings and 24 multiple-permissive-policy findings remain; no blanket index/policy rewrite was applied without workload/EXPLAIN evidence.
- [ ] Release remains NOT VERIFIED until authenticated multi-account E2E, finance/payment E2E, backup/restore, monitoring, external browser/device, rollback, and Android release artifact gates are closed.


## RC314 — 2026-10-04
- Continued the 1000-stage execution track with a concrete public-web UX fix.
- Replaced the three footer `href="#"` no-op links (About / Terms / Privacy) with functional in-app information dialogs.
- Added accessible dialog semantics, initial focus, Escape close and backdrop close.
- RC314 CI was triggered; production readiness remains OPEN because the independent authenticated E2E/payment/backup/device/monitoring gates are not closed.

## RC315–RC316 update — 2026-10-04
- Continued the web-only 1000-stage execution track without reopening completed UI work.
- RC315: made the public customer-support phone number an accessible `tel:` action.
- RC316: hardened the restaurant modal with focus restoration, Tab/Shift+Tab containment, Escape/backdrop close cleanup, and initial focus on the close control.
- Latest material documentation commit: `6ffac78d3af33e6ca90f3b1a909b2a2d4fbb9013`.
- These are source-level web UX/accessibility improvements; public browser E2E and final production gates remain OPEN.

## RC317 update — 2026-10-04
- Hardened the public footer information dialog with focus containment and restoration, matching the restaurant modal accessibility pattern.
- This is a source-level web accessibility improvement; deployed browser/assistive-technology E2E remains NOT VERIFIED.
- Latest material commit: `5510a060de371d83579eb463870f1bd5edbe67c8`.


## RC318 — Production security gate re-verification — 2026-10-04
- [x] Main branch verified at `7d997bf718a52c4e74a076f4f6c14014fdb34e41`.
- [x] GitHub Pages run `37164800526` for that exact commit completed SUCCESS.
- [x] Superseded run `37164793506` was CANCELLED by the newer commit and is not treated as a failure.
- [x] Live Supabase Security Advisor re-run.
- [x] Production project is ACTIVE_HEALTHY.
- [x] Current Advisor still reports `digital_page_payment_events` RLS-enabled/no-policy, 1 anonymous-callable SECURITY DEFINER function, and 9 authenticated-callable SECURITY DEFINER functions.
- [ ] Leaked Password Protection remains NOT VERIFIED/enabled and requires the Auth/Dashboard control.
- [ ] Two-user/two-tenant adversarial E2E remains NOT VERIFIED.
- [ ] Payment/refund/settlement E2E remains blocked on production credentials and safe real-payment authorization.
- [ ] Backup/restore, rollback, browser/device smoke, and Android signed/device evidence remain open.
- Final Production Gate remains OPEN; project is NOT PRODUCTION READY YET.
\n\n## RC319–RC321 — 1000-stage continuation review — 2026-10-04\n- [x] Stage 319 reviewed: notification persistence, RLS, server-generated events, push dispatcher and existing security boundary are implemented; real browser/device delivery remains NOT VERIFIED.\n- [x] Stage 320 reviewed: analytics/reporting must remain derived from authoritative operational/event sources; no parallel analytics truth is introduced. Operational/report E2E remains NOT VERIFIED and the stage is PARTIAL.\n- [x] Stage 321 reviewed: payment/pricing/webhook/settlement/journal boundaries remain server-authoritative; real payment/refund/settlement/GL lifecycle remains NOT VERIFIED.\n- [x] Live production counts rechecked without mutation: notifications=0, audit_logs=9, payment_intents=0, payment_provider_events=0, journal_entries=0, general_ledger=0, orders=0.\n- [x] No synthetic notification, payment, order or financial record was created to manufacture evidence.\n- [ ] Final Production Gate remains OPEN.\n- Next 1000-stage execution target: Stage 322 governance → 323 content → 324 PWA → 325 performance, continuing sequentially until Stage 1000, while independently recording blockers and evidence.\n\n\n## RC322–RC330 — 1000-stage continuation review — 2026-10-04\n- [x] Stages 322–325 reviewed: governance/content/PWA/performance foundations exist, but runtime governance/content consistency, real PWA behavior and workload-based performance verification remain open.\n- [x] Stages 326–330 reviewed: QA/release controls exist but final regression is not verified; final integration is partial; subscription lifecycle is not runtime-verified; Android remains blocked because current main lacks the reconciled Android project and signed/device evidence.\n- [x] No speculative migrations, mass indexes, synthetic financial transactions, fake notifications or blind Android source merge performed.\n- [ ] Continue sequentially from Stage 331 through Stage 1000.\n\n\n## RC331–RC1000 — 1000-stage full review pass — 2026-10-04\n- [x] Completed detailed Cycle 16 review for stages 331–352.\n- [x] Completed explicit stage-by-stage review matrix for stages 353–1000, including Stage 1000.\n- [x] The repeated 22-axis cycles were mapped against the latest verified source/security/runtime evidence rather than falsely re-implementing the same features.\n- [x] No synthetic production data, fake payment, fake notification, blind Android merge, destructive migration or mass performance rewrite was used to manufacture closure.\n- [ ] Many stages remain IMPLEMENTED — NOT VERIFIED or PARTIAL because external/runtime evidence is still required. Android remains BLOCKED.\n- [ ] Final Production Gate remains OPEN / NOT PRODUCTION READY YET until mandatory external gates are evidenced.\n

## RC335 — Targeted advertisement SECURITY DEFINER hardening — 2026-10-04
- [x] Re-verified `public.digital_page_payment_events`: RLS enabled, zero `anon/authenticated` table grants, zero policies; retained as fail-closed backend-only event ledger.
- [x] Re-verified `public.get_mnty_targeted_advertisements(...)`: intentional public ad-serving boundary, still `SECURITY DEFINER` and callable by `anon`/`authenticated`.
- [x] Applied production migration `20261004003742 rc335_harden_targeted_ad_security_definer_search_path` to set `search_path = public, pg_temp`.
- [x] Live SQL verification confirms the hardened function configuration.
- [ ] Security Advisor still reports the intentional public SECURITY DEFINER warning; this is not falsely marked closed because the public-serving contract remains intentional.
- [ ] Leaked-password protection, adversarial multi-tenant E2E, payment/finance E2E, backup/restore, browser/device/push, and Android release evidence remain open.
- Final Production Gate remains **OPEN / NOT PRODUCTION READY YET**.


## RC336 — Authenticated SECURITY DEFINER hardening — 2026-10-04
- [x] Re-inventoried the 9 SECURITY DEFINER functions executable by `authenticated`; none are executable by `anon`.
- [x] Reviewed the critical RBAC/payment boundaries for `auth.uid()`, active membership and centralized permission checks.
- [x] Applied production migration `20261004003820 rc336_harden_authenticated_security_definer_search_paths` to set `search_path=public, pg_temp` on all 9 authenticated-callable SECURITY DEFINER functions.
- [x] Live SQL verification confirms all 9 retain `authenticated_execute=true`, `anon_execute=false`, and the hardened search path.
- [x] Security Advisor re-run; the 9 authenticated SECURITY DEFINER warnings remain as intentional RPC boundaries and are not falsely suppressed.
- [ ] Leaked-password protection, adversarial multi-tenant E2E, payment/finance E2E, backup/restore/rollback, browser/device/PWA/push and Android release evidence remain open.
- Final Production Gate remains **OPEN / NOT PRODUCTION READY YET**.


## RC337 — Current security/release gate snapshot — 2026-10-04
- [x] Live Supabase project remains ACTIVE_HEALTHY on PostgreSQL 17.6.1.155.
- [x] Migration history rechecked; latest production migration is `20261004003842 rc336_harden_authenticated_security_definer_search_paths`.
- [x] Added read-only reusable verification contract: `scripts/verify-rc337-security-definer-hardening.sql`.
- [x] Added evidence record: `docs/RC337_CURRENT_SECURITY_RELEASE_GATE.md`.
- [x] Static web spot-check found no `eval()`/\`new Function()\` and no direct browser `service_role` exposure; inspected dynamic public-home rendering uses escaping for user/database text and public ad URLs are normalized.
- [x] Security Advisor re-run: 1 RLS/no-policy backend-only ledger, 1 intentional anon SECURITY DEFINER ad RPC, 9 intentional authenticated SECURITY DEFINER RPCs, contextual anonymous-policy warnings, and leaked-password protection disabled.
- [x] Performance Advisor re-run: 107 unindexed FK findings and 24 multiple-permissive-policy findings remain; no blanket rewrite performed without workload evidence.
- [ ] Final Production Gate remains OPEN / NOT PRODUCTION READY YET.
- [ ] External runtime gates remain: leaked-password protection, two-user/two-tenant E2E, order/notification E2E, real payment/finance/refund E2E, browser/device/PWA/push, backup/restore/rollback, Android signed/device evidence.


## RC337 CI evidence — 2026-10-04
- [x] GitHub Actions run `37165994161` for commit `053298d6975d8e2bd3398e8e005d34392c9625b1` completed **SUCCESS**.
- [x] The preceding rapid superseded runs for the intermediate RC337 commits were CANCELLED by newer pushes and are not treated as failures.
- [ ] Final Production Gate remains OPEN because CI success does not substitute for external runtime, payment, recovery, browser/device, Auth managed-setting or Android evidence.


## RC338 — Production boundary audit — 2026-10-04
- [x] Verified RLS is enabled and policy-backed for orders, payment_intents, user_memberships, support_tickets, ticket_messages, notifications, financial_obligations, settlement_transactions and general_ledger.
- [x] Verified `payment_intents` has `UNIQUE (tenant_id, idempotency_key)`.
- [x] Re-verified the server-side payment-intent RPC validates authenticated identity, tenant/order ownership boundary, payable status, authoritative pricing snapshot, amount/currency and idempotency.
- [x] Added read-only audit contract: `scripts/verify-rc338-production-boundaries.sql`.
- [x] Added evidence record: `docs/RC338_PRODUCTION_BOUNDARY_AUDIT.md`.
- [ ] Runtime adversarial two-user/two-tenant E2E remains NOT VERIFIED.


## RC339 — Mantiqati official showcase — 2026-10-04
- [x] Applied production migration `rc339_seed_mantiqati_official_showcase` successfully.
- [x] Seeded 25 official showcase sectors/activities under `MNTY-PLATFORM`.
- [x] Seeded 24 active master modules and enabled all 24 modules for each showcase business: 600 business-module bindings.
- [x] Created 25 official business profiles, 25 OWNER memberships for the existing Super Admin identity, 25 verified/featured provider profiles, 25 primary services and provider-service links.
- [x] Respected the existing legal business activation trigger; no trigger was disabled and no consent was fabricated.
- [x] Added a narrowly scoped public RLS policy for active businesses where `settings.showcase=true`.
- [x] Added 25 SVG activity identity/logo assets under `web/assets/activities/`.
- [x] Integrated the official showcase and module catalog into the public homepage in `web/app.js`.
- [x] Live SQL verification returned 25 sectors, 24 modules, 25 active showcase businesses, 25 active owner memberships, 25 active verified profiles, 25 services and 600 enabled module bindings.
- [ ] Browser/Super Admin runtime smoke verification remains to be completed.
- [ ] Domain-specific transactional E2E remains a separate release gate.
- Production Release Gate remains **OPEN / NOT PRODUCTION READY YET**.


## RC339 final CI / admin showcase evidence — 2026-10-04
- [x] Added the Super Admin official showcase management panel to `web/app.js`; it reads actual showcase businesses, provider verification, enabled module counts and service counts.
- [x] Final GitHub Actions run `37166847421` for commit `6ae605fba630ef958d4ea24c4080859a25da9f2e` completed **SUCCESS**.
- [x] The final syntax check passed after resolving the showcase admin HTML join error; previous superseded runs are not treated as failures except the earlier syntax-error run that was explicitly corrected.
- [x] Production database evidence remains: 25 active showcase businesses, 25 OWNER memberships, 25 verified/featured profiles, 25 services and 600 enabled module bindings.
- [ ] Public browser smoke verification of the deployed homepage and Super Admin runtime panel remains an external runtime check; the public-site fetch could not be completed from this environment.
- [ ] Final Production Gate remains **OPEN / NOT PRODUCTION READY YET** because the previously documented Auth, adversarial E2E, payment, recovery, device/PWA/push and Android gates remain open.


## RC340 — 2026-10-04 — Public digital-link hardening
- [x] Hardened public digital-page links in `web/home.js`: URLs are now accepted only when their resolved protocol is `http:` or `https:`.
- [x] Removed the `#` fallback for missing/invalid digital content URLs; unavailable links remain visible as non-interactive status text instead of dead anchors.
- [x] Added the corresponding unavailable-link visual state in `web/home.css`.
- [x] Refreshed public asset versions in `web/index.html` and advanced the service-worker cache from `mnty-web-v114` to `mnty-web-v115`.
- [ ] CI/deployed-site verification is still pending for the RC340 commits; do not mark this UI hardening as production-verified until the Pages workflow provides evidence.


## RC358 — Live security/performance re-verification — 2026-10-04
- [x] Production Security Advisor re-run completed against moyhiluyhjsujhwlyeuu.
- [x] digital_page_payment_events remains intentionally backend-only with RLS enabled and no direct anon/authenticated table grants.
- [x] The targeted-ad SECURITY DEFINER RPC remains intentionally public and hardened with search_path=public, pg_temp.
- [x] All 9 authenticated-callable SECURITY DEFINER RPCs retain search_path=public, pg_temp and no anonymous EXECUTE privilege.
- [x] Performance Advisor currently reports 26 multiple-permissive-policy findings; no blanket policy rewrite was performed because several findings represent legitimate alternative authorization paths.
- [ ] Leaked Password Protection still requires the Supabase Auth managed setting to be enabled by the project owner, then independently rechecked.
- [ ] Final Production Gate remains OPEN.


## RC359 — CI security boundary contract
- Added `scripts/validate-security-definer-contract.mjs` and wired it into `.github/workflows/pages.yml`.
- The release workflow now checks that all eight authenticated SECURITY DEFINER boundaries retain the RC336 `search_path=public,pg_temp` hardening and that the RC337 live-verification contract remains present.
- This is a source/CI guard, not live authorization proof; adversarial two-user/two-tenant E2E remains open.
- Production Gate remains **OPEN / NOT PRODUCTION CERTIFIED**.

## RC359 CI evidence — 2026-10-04
- [x] GitHub Actions run `37169800396` completed SUCCESS for the RC343 closure-gate commit `da5c7dda5e66eb2f6e372f4607f9842f0ce9a800`.
- [x] `validate` passed, including the RC359 SECURITY DEFINER/RBAC source contract.
- [x] `deploy` passed and deployed-site smoke verification passed.
- [ ] Runtime release blockers remain unchanged: Auth managed setting, adversarial tenant E2E, real payment/finance, recovery/rollback, browser/device/PWA/push and Android signed/device evidence.
- Final Production Gate remains **OPEN / NOT PRODUCTION READY YET**.

## RC360 — Production gate integrity contract — 2026-10-04
- [x] Added `scripts/validate-production-gate-contract.mjs` to prevent accidental certification drift in the release documentation.
- [x] Wired the validator into `.github/workflows/pages.yml`.
- [x] The validator preserves the explicit open status of critical external/runtime gates and the required CI security contracts.
- [ ] No external gate is considered closed by this source/CI guard.
- Final Production Gate remains **OPEN / NOT PRODUCTION READY YET**.

## RC361 — Public sponsored-ad accessibility hardening — 2026-10-04
- [x] Targeted-ad cards support keyboard activation with Enter/Space while retaining the in-app modal interaction.
- [x] The production-gate validator now guards this interaction contract.
- [ ] Real browser/assistive-technology/device E2E remains NOT VERIFIED.


## RC362 — Official activity asset CI boundary

- CI now validates both the legacy `web/assets/activity/*.svg` catalog and the official `web/assets/activities/*.svg` catalog used by the public sector/activity grid.
- Commit: `66a508f1a9cdfe1595e0b297b16ea77b232baeab`.
- No production database mutation was performed by RC362.
- Live Supabase read-only verification: 25 active official showcase businesses, 25 active verified/featured official providers, 110 active services, 110 active provider-service links, 600 enabled business-module bindings, and 26 active OWNER memberships.
- These counts are catalog/readiness evidence only; they do **not** close multi-user adversarial E2E, booking E2E, payment/refund/settlement E2E, backup/restore/rollback, device testing, or final production certification.


## RC363 — Full sector directory visibility

- Public homepage sector directory now explicitly presents **all 27 canonical sectors** as a permanent visible grid rather than a shortened/hidden category presentation.
- Desktop layout remains 7 activities per row; responsive layouts use 5/3/2 columns by viewport.
- Added a visible sector-count indicator and clearer Arabic heading/copy.
- The live taxonomy source was checked in `web/home.js`: exactly 27 canonical entries are present.
- RC363 changes are UI/catalog presentation only; no production business/order/financial data was modified.

## RC364 — Sector Tile Visibility Hardening
- **Status:** IMPLEMENTED — WAITING FOR CI EVIDENCE.
- Browser screenshot review identified that the 27-sector directory was technically present but visually too faint/empty.
- Updated the public sector renderer and CSS so every sector has an explicit card, persistent visual glyph fallback, eager icon loading, stronger contrast, and accessible naming.
- This is a presentation-only hardening; no production business, order, payment, or financial records were changed.


## RC365 — قطاعـات الصفحة الرئيسية: إصلاح مسار الرسم والكاش
- الحالة: IMPLEMENTED — WAITING FOR CI EVIDENCE
- السبب المعالج: كان تحديث عداد القطاعات يتم قبل تركيب البطاقات؛ أي استثناء أثناء توليد عنصر واحد كان يترك العداد ظاهرًا مع شبكة قطاعات فارغة.
- تم جعل توليد كل بطاقة دفاعيًا مع قيم افتراضية آمنة لكل icon/label/description/code.
- تحميل صورة القطاع أصبح اختياريًا مع `onerror` لإخفائها عند فشل الأصل دون إلغاء البطاقة.
- تم رفع نسخة `home.js` إلى `rc365` ونسخة Service Worker إلى `v116` لكسر الكاش القديم.
- لا توجد تغييرات على بيانات الأعمال أو الطلبات أو المدفوعات أو البيانات المالية.


## RC366 — تثبيت مصفوفة القطاعات وعقد CI
- الحالة: IMPLEMENTED — WAITING FOR CI EVIDENCE
- تم فرض المصفوفة النهائية للقطاعات على محدد `#mx-category-grid` بعد جميع قواعد CSS التاريخية، بحيث تكون 7 أعمدة على سطح المكتب و5/3/2 حسب العرض.
- تم فرض `visibility:visible` و`opacity:1` لبطاقات القطاعات، ورفع طبقة glyph الاحتياطية فوق الصورة.
- أضيف `scripts/validate-sector-rendering.mjs` ويتحقق من 27 قطاعًا، renderer دفاعي، fallback للصورة، 7 أعمدة، وتدوير الكاش.
- تم ربط العقدة داخل Pages CI.
- لا توجد أي تغييرات على بيانات الإنتاج أو الطلبات أو المدفوعات أو الحسابات المالية.


## RC367 — Module runtime test gate
- Added a CI-enforced runtime/data contract check for all 28 catalog modules.
- This advances every module from catalog-only presence toward an explicit executable runtime contract without fabricating production transactions.
- Real customer/provider/payment/device E2E remains an external evidence gate.


## RC385 update — 2026-10-07
- Homepage visual rebuild is implemented on branch `feat/homepage-rebuild-rc385` and tracked by PR #56.
- Scope is UI/CSS plus the matching rendering validator/cache contract; no database or payment behavior was changed.
- A validator mismatch was found and corrected: the check now validates `home.css?v=rc385` rather than `home.js?v=rc385`.
- Latest branch commit: `147e288617e9144b423f0ea065862e731afa0ae`.
- Production Pages workflow supports `workflow_dispatch`, but the available connector cannot dispatch it. No deployment result for the corrected RC385 commit is therefore claimed.
- RC385 remains NOT VERIFIED for production runtime. Do not merge until CI/deployment evidence exists.
- Core production blockers remain: leaked-password protection, per-function SECURITY DEFINER review, real two-user/two-tenant E2E, payment/finance E2E, notification E2E, backup/restore, Android signed/device evidence, browser smoke, and final regression/release evidence.


## RC386 update — 2026-10-07
- Revalidated Production Supabase security state before making any security change.
- 128/128 public tables have RLS enabled; anonymous Auth users = 0; one intentional anonymous SECURITY DEFINER endpoint remains for sanitized advertisements.
- Security Advisor's anonymous-policy findings were sampled at policy level and are bound to `authenticated` with explicit non-anonymous guards; no broad policy rewrite was made.
- Leaked-password protection is still disabled and requires managed Auth/dashboard action.
- No production schema/data/payment mutation was performed.


## RC387 update — 2026-10-07
- Revalidated CI evidence for the latest RC385 branch head `39bf8aa1ee0aff029f7c6a2e2b0cabb0327ac6b6`.
- Two relevant validation workflows completed successfully; no commit statuses are attached.
- Production Pages deployment/runtime is still not evidenced for this branch head, so the homepage change remains unmerged and NOT VERIFIED in production.


## RC388 update — 2026-10-07
- Verified root cause of unchanged public homepage: RC385 exists only on the feature branch; Pages deployment is main-only.
- Updated Pages workflow so validation runs on PRs while deployment remains main-only.
- No production merge/deployment claimed; waiting for CI evidence before merge.


## RC389 — 2026-10-07 — Sponsored-ad and homepage control hardening
- [x] Reworked the homepage sponsored-ad presentation to use the live targeted-ad payload for the side advertising rail instead of a permanently static placeholder.
- [x] Added explicit live/empty states for the side sponsored-ad rail; empty state routes to the governed advertising flow.
- [x] Hardened sponsored-card activation so nested CTA buttons do not double-fire the card handler.
- [x] Featured-provider sponsored cards now open the provider profile directly instead of depending on a filtered provider-grid DOM element being present.
- [x] Refreshed homepage asset cache versions to rc389.
- [x] No production business/order/payment/financial records were mutated.
- [ ] Browser/device production smoke remains required before claiming runtime verification.


## RC390 — 2026-10-07 — Sponsored-ad RPC contract correction
- [x] Live Supabase inspection confirmed `get_mnty_targeted_advertisements(...)` returns `advertisement_id`, not `id`.
- [x] Homepage sponsored-card and side-rail rendering now use `advertisement_id` for stable activation and modal lookup.
- [x] Live RPC smoke query returned four active HOME_SPONSORED global advertisements with valid creative URLs.
- [x] No database mutation was required for this correction.
- [ ] Current commit CI/browser/device evidence remains external/unverified.

## RC391 — Sponsored-ad CI contract + production deployment verification — 2026-10-07
- [x] Added `scripts/validate-home-sponsored-ads.mjs` to lock the homepage sponsored-ad contract to `advertisement_id`, `HOME_SPONSORED`, live side-rail rendering, and safe URL handling.
- [x] Added the validator to `.github/workflows/pages.yml`.
- [x] GitHub Actions Production Health Monitor for commit `00ad4b95aaecf6b5a1675d9ea008011154ace794` completed SUCCESS.
- [x] Deploy MantiqatiX Web run #1978 completed SUCCESS; validate, deploy, and deployed-site verification all completed successfully.
- [x] Live Supabase RPC smoke returned four active `HOME_SPONSORED` advertisements using `advertisement_id`; public RPC execution is intentional and hardened with `search_path=public, pg_temp`.
- [x] `digital_page_payment_events` remains fail-closed: RLS enabled and zero direct anon/authenticated table grants.
- [ ] Managed Supabase Auth Leaked Password Protection remains outside the available automation surface and is not claimed enabled.
- [ ] Full browser/device adversarial E2E, backup/restore rehearsal, rollback rehearsal, Android signed/device E2E, and independent production acceptance remain required before declaring final certification.


## RC394 — Homepage visual identity deployment checkpoint
- 2026-10-07
- Implemented the new homepage visual system against the supplied visual reference.
- Reworked header, hero, module/category presentation, sponsored area, provider grid, business-growth presentation, footer, responsive behavior, and design-token overrides.
- Preserved live search, sponsored-ad RPC contract, provider data, authentication, and existing backend boundaries.
- Cache contract advanced to RC393.
- Important: GitHub commits for RC393 exist on `main`, but no new GitHub Actions run/status was returned for the RC393 commits at verification time; therefore production Pages deployment is NOT VERIFIED yet.

- RC394: removed legacy emoji-style UI icons, added neutral CSS icon system, and advanced homepage cache to rc394. Production deployment remains NOT VERIFIED until a GitHub Pages workflow run is observed.


## Session record — 2026-10-11 — continuity system activated

**Purpose:** establish a durable, chronological record so a new ChatGPT session can resume without asking the user to repeat decisions or re-auditing completed work.

### Verified repository baseline
- Repository: `islamnagy2022-eng/MantiqaTix`
- Branch: `main`
- Main HEAD at record time: `735f0451bf6dae9ed8cf681f83c4856a4b029041` (CI: cancel stale Pages deployments; this does not close production gates).
- Supabase project: `moyhiluyhjsujhwlyeuu`
- Production status previously read as `ACTIVE_HEALTHY`; health status alone does not mean release-ready.
- Migration ledger: 283 production-applied migrations, latest `20261008222845` (RC424).
- Release status: **BLOCKED / NOT CERTIFIED**. Production deployment must remain fail-closed.

### Findings confirmed in the 2026-10-11 audit
1. GitHub Actions production gate run [38108142127](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38108142127) failed closed; deployment was skipped.
2. 16 migration source files are absent from `main` and not applied in production: RC425–RC432 and RC434–RC441. Do not apply a partial set or rewrite production migration history.
3. PR [#202](https://github.com/islamnagy2022-eng/MantiqaTix/pull/202) and PR [#84](https://github.com/islamnagy2022-eng/MantiqaTix/pull/84) contain incompatible versions of migration `20261009200000_rc434_atomic_erp_purchase_receiving.sql`. The collision guard is correct and must not be disabled. PR #202 also had CI failures for missing `scripts/validate-smm-payment-safety.mjs` and `scripts/test-checkout-secret-crypto.mjs`.
4. Live deployed Edge Function entrypoint comparison:
   - `payment-intent` v6, `paymob-webhook` v8, `digital-page-payment-intent` v3, and `subscription-payment-intent` v2 exactly match `main` and PR #202, but not PR #84.
   - `erp-purchase-receive` v1 matches neither PR #202 nor PR #84.
   - `smm-gateway` v6 matches none of the three compared sources.
   - Source equality does not prove runtime correctness.
5. Live `subscription-payment-intent` returns Paymob `clientSecret` directly and does not implement the encrypted recovery path in PR #84. RC439's ciphertext/IV/key-version columns are not present in the live table schema and RC439 is not in the production migration ledger. Table row count was 0 at audit time. Do not deploy half of this contract.
6. Live `smm-gateway` has actionable source-level risks: tenant OWNER/ADMIN/SUPER_ADMIN roles can pass the global admin fallback; provider calls have no explicit timeout; provider-response ambiguity may cause an unsafe automatic refund; persistence errors after provider acceptance are not consistently handled; provider-derived status updates lack a terminal-state guard. These are audit findings, not fixes.
7. Supabase Security Advisor reported 94 lints overall (mixed severity): Auth leaked-password protection disabled; anon/authenticated-executable SECURITY DEFINER functions requiring per-function review; `digital_page_payment_events` has RLS enabled but no policies (could be deliberate deny-all); multiple public/anonymous policies need scoped review. No blanket grants/revokes or policies were changed.
8. Comments documenting the findings were posted on PR #202 (including migration conflict/CI, SMM schema/authorization, RC439 recovery, Security Advisor, deployed Edge Function parity, and SMM gateway defects). Comments are evidence of communication only, not code fixes.
9. PR #204's stale Pages deployment cancellation was merged as commit `735f0451bf6dae9ed8cf681f83c4856a4b029041`; it improves release safety but does not resolve the above blockers.

### Work not performed
- No production schema or data mutation.
- No Edge Function deployment.
- No PR #202/#84 merge.
- No claim that the platform is production-ready.
- A previous write attempt to add a missing crypto test script was rejected; the file was **not** added by that attempt.

### Next action — continue from here, do not restart the audit
1. Inspect authoritative history and exact diffs for RC434 in PR #202 versus PR #84; map dependencies across RC425–432 and RC434–441.
2. Select a canonical migration sequence based on actual dependency/behavior evidence, then resolve the branch conflict without disabling the collision guard or rewriting production history.
3. Restore missing CI test scripts only from authoritative existing source/contract; do not create fake tests merely to turn CI green.
4. Replay the full migration sequence in an isolated disposable database and run relevant tests before any production application.
5. Reconcile SMM and payment function source with live behavior and tenant/security contracts; deploy only after tested parity and explicit release gates.
6. Re-run the production gate and record exact run IDs and outcomes.

### Session continuity rules (binding)
- Record every **material project decision, requirement, change, test, blocker, and next action** in `docs/SESSION_LOG.md` in chronological order. Do not log casual greetings; do log any decision that could change implementation.
- After each work batch, update this log and update `docs/PROJECT_CONTINUITY.md` with the latest resume point/status. Update `docs/MASTER_PRODUCTION_TODO.md` when gate status or work status changes.
- Every log item must separate **verified fact**, **inference**, **action performed**, **not performed**, and **next step**. Link commits, PRs, CI runs, migrations, and tests when available.
- At the start of every new session, read this continuity file, then the latest entries of the session log and master TODO, then verify current GitHub/Supabase state before modifying anything.
- Never treat an assistant message or a PR comment as proof of implementation. Only code, commit, successful test/runtime evidence, and deployment verification count.
- Do not repeat completed audits unless new evidence or a changed baseline justifies it. Never fabricate evidence or bypass safety/release controls.


### 2026-10-17 — latest evidence correction: RC434 current heads and schema baseline

1. **RC434 source comparison (verified now):** the exact file `supabase/migrations/20261009200000_rc434_atomic_erp_purchase_receiving.sql` at the current heads of PR #202 (`56dc3853be48fee413cbaf551fd350fe3f1df3ed`), PR #84 (`3150c02aa6e034dff37acb815b1ef009da6d036c`), and PR #282 (`7e5bc5d71b82af4bc748fff97cce65082d33a072`) resolves to the same Git blob SHA `a93a0a6827de15d50632e1deec015e20dd55b405`. This supersedes the earlier statement that the *current* heads contain incompatible RC434 files; historical branches/revisions may have differed, so retain the collision guard.
2. **RC434 behavior remains a release concern:** the identical source explicitly notes that purchase-order line-level quantity limits are not represented in the earlier schema. RC437/RC438 dependencies and the final receiving contract must be reviewed and tested in chronological order; identical bytes alone do not certify the workflow.
3. **Schema baseline captured:** [PR #284](https://github.com/islamnagy2022-eng/MantiqatiX/pull/284), current head `36971cd89e5d69ec00050dfe74c6261ec395060f`, is Draft/unmerged. It contains a schema-only production snapshot with manifest and ordered migration ledger; capture workflow [38993809648](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993809648) used read-only capture. No rows, production DDL/DML, migration application, grant change, or deployment occurred.
4. **Static audit passed:** [run 38995239972](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38995239972) reported 283 ordered versions through `20261008222845`, 128/128 public tables with RLS enabled, 485 policy declarations, and 145 parsed SECURITY DEFINER functions with explicit search_path and REVOKE ALL FROM PUBLIC. Related PR checks passed: module professionalization [38995239983](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38995239983), open-ride privacy [38995239981](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38995239981), backend-only module boundary [38995239949](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38995239949). Web deploy job was skipped. These are static checks, not runtime tenant-isolation or replay proof.
5. **Review remains pending:** the manifest is intentionally `PENDING_REVIEW`; PR #284 must not be merged or used for replay until the function bodies/grants/policies are reviewed and a disposable forward replay and runtime isolation tests pass.
6. **Main remains blocked:** RC425–RC432 and RC434–RC441 source files remain absent from `main`; PR #282 remains Draft/unmerged. The authoritative historical migration provenance for `public.counter_offer_indrive_bid(uuid,uuid,numeric)` is still missing from the migration ledger/repository search. The snapshot contains its current live definition, but that does not reconstruct its original timestamp or historical definition.

### Next executable steps
- Finish review of the schema baseline (especially SECURITY DEFINER authorization paths, grants, RLS policy predicates, and extension/dependency assumptions).
- Only after explicit review, add an isolated disposable replay job that bootstraps from the baseline and applies newer migrations in order; never apply the baseline to production.
- Keep PR #282 unmerged until full chronological replay, tenant isolation, payment/finance end-to-end, and backup/restore gates pass.
- Preserve the production gate and migration collision guard; no release certification is issued.


## 2026-10-18 — guarded marketing workspace port on current main

- Working branch: `feat/marketing-workspace-current-main-20261018`; Draft PR [#292](https://github.com/islamnagy2022-eng/MantiqatiX/pull/292).
- Added the tabbed marketing/agency workspace for leads, provider agencies, projects, and platform ads; campaign create/invite/respond/status actions call only the RC453 backend RPCs.
- Added SMM quick access to marketing-role and enterprise dashboards. The separate SMM storefront remains deferred by the server-side launch gate.
- Added a fail-safe for the known production/source gap: if the RC453 campaign tables are missing, the UI shows a clear notice and falls back to the existing marketing workspace instead of presenting a campaign form that cannot work.
- Browser mutations to `marketing_campaigns` and `marketing_campaign_participants` remain prohibited; no direct INSERT/UPDATE/DELETE calls were added.
- Dedicated Marketing Workspace Contract run [39091349054](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39091349054) **PASS**: JavaScript syntax and 22 static contract assertions passed on the PR head at that run.
- Full Pages workflow [39091349019](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39091349019) was still running when this note was written; do not mark it PASS until the final job conclusion is fetched.
- The UI is staged only in a Draft PR. RC453 has not been applied to production, no Edge Function deployment occurred, and no external ad network was contacted. No production DDL/DML, grants/RLS/Auth settings, payment, wallet, or deployment was changed.
- Next: verify final exact-head Pages and relevant security/module workflows, review campaign RPC behavior against the migration tests, and keep the release gate **BLOCKED / NOT CERTIFIED** until the migration chain, production parity, and external E2E gates are approved.


## 2026-10-21 — Preview entry audit and PR #316 status
- PR [#316](https://github.com/islamnagy2022-eng/MantiqatiX/pull/316) remains open/Draft at head `1368a1583aa42e1905e064bc9a96f181a86d1b62`; no merge or production deployment was performed.
- The branch changes only `web/preview/index.html` and `web/preview/dashboard.html`. `web/preview/index.html` redirects to `../`; the main/root redirect chain is root `index.html` → `web/`. The Pages workflow publishes only `web/` and only deploys from `main` pushes or main workflow_dispatch. PR CI `validate` passed; Pages `deploy` was correctly skipped.
- Exact-head associated checks returned successful validation, privacy, financial-journal, approval-audit, and targeted-ads integration jobs; no failing result was shown in the returned checks. This does not prove live browser behavior.
- No live-host HTTP/browser probe could be completed using the GitHub connector. Thus deployed route responses, JS/CSS load, service-worker/cache effects, Supabase initialization, login, and role-aware navigation remain NOT VERIFIED.
- TODO: live browser/HTTP smoke for `/`, `/web/`, `/preview/`, `/preview/dashboard.html`; add automated preview route and navigation tests if absent; keep PR #316 Draft until these checks are backed by evidence. Existing global production blockers in `docs/MASTER_PRODUCTION_TODO.md` remain open.
- Release state: BLOCKED / NOT CERTIFIED. No production database/auth/payment changes or releases.


## 2026-10-21 — ERP receiving changed to fail-closed atomic RPC
- Updated `supabase/functions/erp-purchase-receive/index.ts` to stop mutating receipt, balance, and inventory-ledger tables through separate REST requests.
- The function now validates request size/shape, UUIDs, finite positive quantity, finite non-negative unit cost, authenticated non-anonymous actor, and allowed origin; it delegates the complete mutation to `receive_purchase_stock_with_order_line_backend` and passes the verified actor ID.
- Unknown database errors and a missing RPC return `ATOMIC_RECEIVING_UNAVAILABLE` (503). There is intentionally no fallback to the old non-atomic mutation path.
- Source contract validator updated to require the atomic RPC call. Commit: `4ed9e962a7c85baf4c87fcf0ce172f498c3b1abf`; validator follow-up: `82a5c17e588abf0d8452397a4c0a4d055c2204bb`.
- **Important dependency:** the required RC434 + RC437 migrations are absent from `main`. This change is fail-closed and must not be deployed as a working ERP receiving feature until the full, reviewed migration chain is recovered and applied in order. RC437 notes legacy purchase orders without line items need reconciliation; do not certify receiving until that data condition is resolved.
- Current CI is queued on `82a5c17e588abf0d8452397a4c0a4d055c2204bb`; production deployment remains blocked. No production database or Edge Function was mutated.

## RC101 update — 2026-10-23 — Provider service management
- Implemented provider service add/edit/status/delete UI using `marketing_provider_services`, active `marketing_services`, and existing provider profiles only.
- Implemented service-area editing through existing `marketing_provider_profiles.service_areas`; no new generic availability model was introduced.
- Every mutation re-checks the authenticated user's ownership of the provider profile and uses normal Supabase client operations subject to existing RLS. No grants, migrations, or service-role bypasses were added.
- Added `scripts/validate-provider-services-contract.mjs` to the Pages validation workflow.
- Exact-head CI, browser behavior, cross-provider isolation with two real accounts, and order/booking regression remain **NOT VERIFIED** until results are fetched and tests are executed.
- No merge or production deployment. Release remains **BLOCKED / NOT CERTIFIED**.


## Latest continuation — 2026-10-27 — live migration ledger reconciliation

- Read-only query verified the live migration inventory has 292 rows through `20261027041549 qadam_alsaad_restore_contact_fields`.
- Exact source/body comparisons now pass for live versions `20261027010135`, `20261027041411`, and `20261027041549`; see `docs/release/production-migration-reconciliation.json` and the append-only `docs/SESSION_LOG.md` entry.
- Restored the missing exact-version Qadam catalog migration source and Qadam contact repair source; restored the live-version marketing contact source and preserved the existing future-timestamp file unchanged as an exact idempotent alias under the migration-immutability rule. The distinct Qadam follow-up migration at `20261027093000` was preserved for separate review.
- SMM frontend cleanup is already on main: `web/smm.js` and `web/smm.css` are absent, `web/smm.html` is a noindex notice, and the backend default-deny contract remains tested.
- The isolated chronological replay and migration-source reconciliation now pass, but Production remains BLOCKED: the replay does not prove RC425–RC441/post-RC424 migrations are applied to Production; payment/finance E2E, backup/restore, live Edge Function/Auth runtime parity, browser/device E2E, monitoring/alert and rollback evidence remain open. Do not bypass the deployment gate.
- No Production writes, migration execution, Auth/grant/RLS changes, Edge Function deployment, payment/wallet mutation, or deployment occurred.


## Latest continuation — 2026-10-27 — live SMM gateway parity

- Production `smm-gateway` read-back: ACTIVE version 13, `verify_jwt=true`, bundle SHA-256 `a45cee9f5c90beba2c2409ba4fe2927f5be3df4965fb3929f5b7d467b3121b72`.
- All seven deployed TypeScript files exactly match `main`; the deployed source hard gate is `SMM_INITIAL_LAUNCH_DEFERRED=true` and denies actions before processing.
- Anonymous/authenticated negative runtime tests remain NOT VERIFIED. Do not mark the SMM release gate complete from source parity alone; no function deployment or environment change was made.


## 2026-10-27 — Schema-only checkpoint replay diagnosis

- [x] Inspected Forward Migration Chain Replay run [40493639400](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40493639400): it failed at `20261027010135_add_qadam_alsaad_homewares_store_and_catalog.sql` because the restored checkpoint is schema-only (`data_included=false`) and therefore lacks `MNTY-PLATFORM`.
- [x] Read-only Production checks confirmed the platform tenant and referenced owner auth identity exist in the live database. No production data was copied or changed.
- [x] Added `supabase/tests/baselines/production_data_prerequisites_fixture.sql` with only deterministic test data for those pre-existing dependencies, guarded by the explicit disposable flag. Added a local-host URL guard to the replay workflow.
- [x] [Forward replay run 40494929976](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40494929976) passed: 52 forward migrations applied in timestamp order against an isolated disposable checkpoint; RC117 contract and synthetic tenant A/B read/write isolation tests passed.
- [ ] The Production gate remains BLOCKED / NOT CERTIFIED. Replay does not demonstrate Production application, and payment/finance E2E, backup/restore, live Edge Function/Auth settings and runtime tests, browser/device E2E, monitoring/alerts and rollback remain NOT VERIFIED. The web deploy job was skipped; no production deployment occurred.


## Latest continuation — 2026-10-27 — critical Edge Function source drift

- Read-only exact `index.ts` comparisons against `main`: `payment-intent` v8 (8,114 vs 10,366 chars), `paymob-webhook` v10 (11,538 vs 12,665), `digital-page-payment-intent` v5 (5,345 vs 6,532), `subscription-payment-intent` v4 (5,196 vs 10,896), and `financial-journal` v3 (1,591 vs 3,387) do not match current source. Relevant function-level differences are recorded in the reconciliation manifest.
- `financial-journal` live code uses wildcard CORS and calls `post_financial_journal`, while `main` uses an origin allowlist and `post_financial_journal_backend`. The live `paymob-webhook` lacks the explicit finite-amount guard present in `main`; payment intent paths omit shared Paymob correlation helpers found in `main`.
- `smm-gateway` v13 exact entrypoint match passes, but runtime negative tests remain NOT VERIFIED.
- All 34 exact migration versions required by the Production verifier are 0/34 in the live migration ledger. The 52-migration disposable replay passed, but neither that replay nor source presence proves safe application to the current Production schema.
- No code deployed; no Production writes, migration operations, grants, Auth settings, payments, or wallet changes performed. Release stays **BLOCKED / NOT CERTIFIED**.


## Latest checkpoint — 2026-10-27 — all 34 release versions

- A read-only ledger LEFT JOIN covered all 34 migration IDs enforced by `scripts/production/verify-production.mjs`; **0/34** are present in `supabase_migrations.schema_migrations`. Current source files and disposable replay do not prove Production application.
- RC451's `get_mnty_targeted_advertisements` remains SECURITY DEFINER with anon/authenticated EXECUTE and live `search_path=public, pg_temp`; RC451's required empty search_path is not applied. Public discovery is intentional; never mass-revoke its EXECUTE as a workaround.
- The verifier contract was strengthened in PR #428 and is being extended to require all exact 34 versions and RC451 live catalog evidence. Production gate remains `BLOCKED / NOT CERTIFIED`; no Production writes or deployment occurred.


## 2026-10-27 — Full required object-name inventory

- Read-only catalog inventory linked from `docs/release/production-source-object-drift.json`: 39 required function names, 21 absent; 4 required tables absent; 12/13 selected required indexes absent. Present function names are not proof of correct body, `search_path`, ACL or caller behavior.
- Highest-impact gaps: atomic MantiGo/Paymob and failure webhook RPCs absent; subscription claim RPCs absent; order-line ERP table and atomic receiving functions absent; matrimony privacy/lifecycle RPCs absent; marketing campaign tables/RPCs absent; atomic finance journal RPC and uniqueness indexes absent.
- Production remains `BLOCKED / NOT CERTIFIED`. Do not patch live objects individually; test the full reconciliation against a disposable/staging clone of the current live schema and later-dated migration ledger, with restore and rollback rehearsal.

## 2026-10-27 — Expanded production gate: RC113–RC117 and Qadam follow-up

- [x] Expanded the exact-version release gate from 34 to **41 distinct migrations**: the original payment/finance/security/order chain, six RC113–RC117 platform-feature migrations, and `20261027093000_add_qadam_alsaad_homewares_store.sql`.
- [x] Read-only live catalog checks show all six feature migrations are absent from the live ledger and their target objects are missing: 17/17 required function contracts and 11/11 selected tables/indexes are absent. These cover platform custom roles, employee hiring, control-center integration, subscriber administration, default-image triggers, and membership scope/idempotency.
- [x] Qadam data audit shows 15 active catalog items, all 12 expected price rows, three contact-for-price items with no active price, complete contact fields, one active branch, no synthetic stock tracking. Blocking defect: `MNTY-QADAM-ALSAAD-OWNER` membership is `INACTIVE`; the unrecorded follow-up migration promotes it to `ACTIVE`.
- [x] Two source-version aliases remain separate from the 41 distinct migrations: RC424 source version `20261009010000` maps to applied ledger version `20261008222845`; `20261027100000_mantiqatix_marketing_contact_details.sql` is an exact source-blob alias of live version `20261027041411`. Both require controlled ledger repair after backup/rehearsal; do not execute duplicate SQL as distinct effects.
- [ ] Overall status remains `BLOCKED / NOT CERTIFIED`: all 41 distinct required versions are still 0/41 in the live ledger; aliases are 0/2 reconciled; RC451 search_path, finance ACL/schema, five critical Edge Function source drifts, payment/finance E2E, backup/restore, Auth settings, browser/device, monitoring and rollback evidence remain open.
- Safety: no Production migration, repair, data write, grant/RLS/Auth change, Edge Function deployment, payment or wallet mutation was performed.

## 2026-10-27 — Atomic release object contract repair

- [x] Split the grouped RC435/RC436/RC437/RC441 release checks into separate function, index and table requirements. The release gate now requires **27 individual core objects + 33 feature objects = 60 object contracts**, all explicit in the manifest.
- [x] Added negative CI fixtures for absent subscription claim RPC, journal uniqueness index, ERP line receiving RPC and MantiGo admin dashboard RPC; a single row cannot stand in for multiple required objects.
- [x] Improved Production verifier diagnostics to list every non-passing object plus unresolved migration aliases and Qadam owner state.
- [ ] All 60 object contracts remain blocked or unverified; no Production migration, schema/ledger/grant change or deploy was performed.


## 2026-10-27 — Granular release object contract correction

- [x] Removed four compound object labels from the release contract. The verifier now requires 27 individually named core payment/finance/ERP/MantiGo objects plus 33 individually named RC113–RC117 feature objects: 60 total object contracts.
- [x] Read-only catalog evidence: 7/27 core objects exist by name/signature; 20 are absent. All 33 feature objects remain absent. Two existing RPCs are explicitly BLOCKED despite name presence because their live `search_path`/ACL diverges from source expectations.
- [x] Updated the reconciliation manifest to use exact object names, preventing false mismatches caused by a combined label that cannot match any catalog row.
- [ ] Keep Production blocked: 0/41 distinct required migration versions recorded; 0/2 source aliases reconciled; Qadam owner membership INACTIVE; RC451 search_path, finance schema/EXECUTE, Edge Function parity, rollback and runtime evidence still open.
- Safety: no Production writes or deployments. This change only improves the release gate's object-by-object evidence.

 
## 2026-10-28 — scoped catalog pilot live; full platform still blocked

- Main commit `e2d64f0b26ba128866fc42da23dbbab86036fd5f` passed the canonical Pages deployment workflow: the existing platform root remained at `/MantiqatiX/`, the React catalog was mounted at `/MantiqatiX/catalog-app/`, and the post-deploy root/catalog asset smoke check passed.
- Live source retrieval confirms exact byte-for-byte parity for the four catalog-scoped Edge Functions: `catalog-platform-admin` v3 (`verify_jwt=true`), `catalog-admin` v14, `public-catalog-directory` v2 and `public-catalog` v2. Public functions are read-only; admin routes retain their own authorization checks.
- Read-only production checks confirm Qadam's business and owner membership are ACTIVE, the provider profile is ACTIVE and owned by the intended owner, and 15 products are active: 12 with active prices and 3 intentionally contact-for-price.
- The live migration inventory contains 293 entries through `20261027205405_catalog_pilot_owner_profile_repair`. All 41 distinct full-platform release-required migration versions remain absent; the Qadam source seed version `20261027093000` remains missing even though its data is ready through the scoped repair. Never replay the 41 migrations blindly.
- PR #447 removes the homepage demo-tour routes and SMM placeholder link, converts the homepage section to a real catalog entrypoint, excludes `preview/` and `smm.html` from the production artifact, and changes the preview workflow to validation-only. Do not merge until its current-head checks pass.
- The full platform release remains BLOCKED by missing migration/schema contracts, six critical payment/order/finance Edge Function source drifts, missing financial-journal schema/grants, and unverified payment/finance E2E, backup/restore, Auth security, and SMM negative runtime evidence. Only the scoped catalog pilot is currently approved for real use.

 
## 2026-10-28 — RC451 targeted-ad search_path forward repair

- Read-only production inspection confirmed `public.get_mnty_targeted_advertisements` was `SECURITY DEFINER` with `search_path=public, pg_temp`; its four application-table references are schema-qualified and anon/authenticated EXECUTE is intentional.
- Added and tested the guarded forward-only repair `20261027223523_rc451_targeted_ads_search_path_forward_repair.sql`. It changes only the function search_path, checks the function/grant contract before and after, and refuses to proceed if unqualified references to the known application tables are detected.
- Applied the migration to live Supabase as version `20261027223523`; read-only post-check confirmed the live statement matches the checked-in SQL exactly, `search_path=""`, anon/authenticated EXECUTE remain enabled, PUBLIC EXECUTE remains absent, and the live RPC returns 3 rows.
- The original RC451 version `20261010200000` remains absent from the original required-version ledger list. Its effect is reconciled by the forward repair; no historical migration was edited or marked applied. The full platform gate remains BLOCKED by the other missing migration versions, critical order/payment/finance Edge Function drift, finance prerequisites, and unverified payment/finance E2E, backup/restore, Auth, and SMM runtime evidence.
- The Supabase security advisor may still count the intentionally anon-callable SECURITY DEFINER RPC; the risky search_path configuration is fixed, and the public-discovery grant was deliberately preserved.


## 2026-10-28 — electronic catalog is the primary customer entry

- Decision: the electronic catalog is the canonical customer-facing product; the legacy application is a source of reusable code/assets and compatibility only, never the intended primary UI.
- Implemented on branch `feat/catalog-primary-site`: the Vite build base, PWA `start_url`/`scope`/icons, and service-worker shell are configured for `/MantiqatiX/`.
- `.github/workflows/pages.yml` now publishes only `apps/catalog-frontend/dist` as the production artifact; the legacy `web/` application is not copied into the published site. Post-deploy checks validate the catalog title, root assets, Supabase config, and that JavaScript/CSS assets are reachable. Legacy preview/SMM routes remain required to return 404.
- Updated primary catalog CI, health monitoring, production gate contracts, and catalog pilot verification to expect a catalog-only root deployment. Legacy source files remain in GitHub for development and are not the production UI.
- Changes are still in open PR #453; not merged to main and not deployed. CI and browser Google OAuth verification remain pending.

## Dashboard follow-up — 2026-10-28

- The isolated dashboard now has a responsive RTL section menu, data-backed overview counters, category distribution and creation-date trend, stored-state alerts, and searchable/filterable activities. Admin actions route to existing `businesses`, `subscribers`, and `settings` tabs; owner shortcuts can open existing employee/profile tabs via `merchantTab`.
- A regression validator is wired into Pages CI at `scripts/validate-professional-dashboard.mjs`.
- Current branch and Draft PR: `feat/professional-dashboard-additive-20261028`, PR #483. Build/contract results for the newest exact head must be read from Actions before changing state to verified. Browser/RLS tenant-isolation E2E and deployment remain unverified; do not merge/deploy on this evidence alone.

## Dashboard verification update — 2026-10-28

- Exact source/build/static-contract head verified: `4bbf141dad21a919677e34cad60f7b677b17f9a8`.
- Primary Catalog Frontend Validation passed: [40736278224](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40736278224). Pages workflow validation including dashboard static contract passed: [40736278305](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40736278305). Module professionalization validation passed: [40736278182](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40736278182).
- These were pull-request validations; production deployment was skipped. Browser E2E, direct API/RLS tenant isolation, keyboard/mobile accessibility, and deployed dashboard behavior remain **NOT VERIFIED**. PR #483 stays draft and isolated from main pending those checks.

## Final dashboard CI update — 2026-10-28

- Exact source head with passing validation: `5690c667f312206d8bd32c001c913ac8628bb0d2`.
- Primary catalog validation PASS: [40736940379](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40736940379). Pages validation and complete syntax-validator step PASS; production deploy intentionally skipped for PR: [40736940282](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40736940282). Module professionalization validation PASS: [40736940498](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40736940498).
- Fixed a stale assertion in `scripts/validate-canonical-activity-taxonomy.mjs` to accept responsive icon-card padding variants; no catalog UI behavior was changed by that test-only fix.
- Remaining NOT VERIFIED gates: authenticated browser E2E/deep-link refresh, denial tests, API/RLS tenant isolation, manual accessibility/mobile review, and live dashboard deployment. PR #483 remains draft and unmerged; full platform production gate remains BLOCKED / NOT CERTIFIED.

## Dashboard integration rebased on current main — 2026-10-28

- Feature branch was rebuilt on current `main` baseline `b5e5b22cc4bbef93e2d184a39c00e971115af253` while preserving the intended 19 changed files; current main was not altered. PR #483 is now one integration commit ahead of main rather than a 67-commit diverged history.
- Exact rebased source head `fce2f08d92f36d6bc6830fad8f9ac29df618593d` passed Pages workflow validation and dashboard permission matrix, plus backend-only, module professionalization, MantiGO privacy and catalog-admin CORS validation: [Pages run 40773802038](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40773802038), [backend-only run 40773802088](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40773802088), [professionalization run 40773802241](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40773802241), [MantiGO run 40773802071](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40773802071), [CORS run 40773802329](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40773802329).
- The actual deployment job was skipped on the feature branch; no production deployment is claimed. Browser E2E, direct API/RLS tenant isolation, manual accessibility and live QR/share-link regression remain not verified. Keep PR #483 draft; full platform gate remains `BLOCKED / NOT CERTIFIED`.

## Membership-scope follow-up — 2026-10-28

- Selected membership precedence now prefers OWNER/BUSINESS_OWNER/ADMIN for the chosen business, then a tenant-wide OWNER only within the matching tenant, then lower-scope membership rows. This prevents a newer employee membership record from replacing the owner context in the dashboard.
- Static role/route contract plus runtime permission matrix passed on exact current source head `d243a4fdcb3449bf0b49ba6b7290c123ecd0bce2`: [Pages validation run 40774358276](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774358276). Backend-only [40774358272](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774358272), module professionalization [40774358297](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774358297), and MantiGO privacy [40774358269](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774358269) passed as well.
- PR #483 is mergeable but remains Draft pending authenticated browser E2E, direct API/RLS tenant isolation, mobile/accessibility and live share/QR verification. The Pages deploy job was skipped on feature branch; full platform release remains `BLOCKED / NOT CERTIFIED`.

## Latest validation correction — 2026-10-28

- Updated the primary catalog Google OAuth role contract to assert the centralized role/permission helpers used by the dashboard. This resolves a stale test expectation and retains the security gate rather than weakening it.
- Exact current source head `1131b669bf1ab5bf303162638f535e01f0ae043f` passed Pages validation [40774776775](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774776775), Primary Catalog Frontend [40774776818](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774776818), Legacy Catalog [40774776772](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774776772), Backend-only [40774776728](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774776728), Module Professionalization [40774776870](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774776870), MantiGO [40774776773](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774776773), RC425 atomicity [40774776799](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774776799), SMM deferred storefront [40774776883](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774776883), and flexible commission [40774777126](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40774777126).
- Current PR compare: 6 commits ahead, 0 behind, merge state clean. PR remains Draft pending live browser/RLS verification. Actual deployment has not occurred and the overall production gate remains `BLOCKED / NOT CERTIFIED`.

## Final branch-shape correction — 2026-10-28

- Earlier notes refer to the initial post-rebase snapshot. After updating the OAuth role-contract test and adding the final documentation, the current PR tree has 20 changed paths and compares cleanly to current `main` with zero commits behind; `main` was not modified directly.
- PR #483 remains a Draft/mergeable code change but is not merged. Browser E2E and direct API/RLS tenant-isolation evidence are still missing, and merging would trigger the production Pages flow. Current production remains not deployed and the platform gate remains `BLOCKED / NOT CERTIFIED`.
## Earlier professional dashboard verification — 2026-10-28 (superseded by 2026-10-29 CI)

- PR #483 remains additive and isolated on feat/professional-dashboard-additive-20261028; main has not been modified. Exact tested code head: 1b00c1afbbfd7509a00627defce1530b927d74ec.
- The missing openExistingUserManager symbol was removed from the dashboard access path and the access section now uses the permission-aware BusinessEmployeeManager. Unsupported MANAGER membership grants fail closed until the backend permission resolver is expanded.
- RC457 is forward-only and adds a scoped permission ceiling for job-position templates and employee overrides, a branch-aware roster RPC, and tenant/business/branch write guards. The UI sends the selected membership branch scope to the guarded RPCs. No historical migration was edited.
- Passing evidence: Primary Catalog Frontend Validation [40789982603](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40789982603) covers build/type-check, Google OAuth/public-directory smoke tests, isolated PostgreSQL permission/tenant/branch integration, and Chromium browser E2E. Ordered forward migration replay from the captured schema checkpoint passed on the same source head [40789976555](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40789976555). Migration immutability [40789982652](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40789982652), version uniqueness [40789982510](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40789982510), and open-PR collision guard [40789982601](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40789982601) passed.
- The Chromium suite uses mocked Supabase responses against the built app and is not a live production-account test. The PostgreSQL suite is isolated CI, not a mutation of the production database.
- Still required before considering this dashboard production-verified: manual keyboard/accessibility and real-device mobile/tablet review, deployed-origin QR/permanent-link regression, and confirmation of post-merge production behavior. The Pages deploy job was skipped on this feature branch; PR #483 remains Draft/unmerged. The overall platform production gate remains BLOCKED / NOT CERTIFIED because broader unrelated release gates remain open.

## 2026-10-29 — Current professional dashboard release status

- Feature PR #483 remains Draft/unmerged on \`feat/professional-dashboard-additive-20261028\`. Latest tested source head before this documentation update: \`83e47f39dad8480c94b5c21171ea4ace7827147d\`.
- [Primary Catalog Frontend Validation 40792920117](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40792920117) passed TypeScript/build, production smoke contracts, isolated PostgreSQL employee permission/tenant/branch integration, and Chromium E2E. Branch-owner checks verify that a branch-scoped OWNER is denied the broad legacy merchant route and that the employee roster RPC receives the matching branch ID.
- [Migration History Immutability 40792920047](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40792920047), [Migration Version Uniqueness 40792920079](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40792920079), [Open PR Migration Collision Guard 40792919994](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40792919994), [Backend-only Module Boundary 40792920038](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40792920038), and [Pages validation 40792920126](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40792920126) passed. The Pages deployment job was skipped as intended for the feature branch.
- Production Supabase was inspected read-only: the control-center/employee tables and required RPCs for RC113/RC114/RC115/RC457 are absent from project \`moyhiluyhjsujhwlyeuu\`. The 41-version platform release ledger is also still marked \`VERIFIED_NOT_APPLIED\`; full platform gate is \`BLOCKED\`.
- The new Pages guard is explicit: it allows PR and feature-branch validation while emitting the missing-live-dependencies state, but prevents a main deployment while the dashboard's backend requirements remain unverified. The production migration ledger was not rewritten and no schema change was applied.
- **Completion boundary:** feature implementation and isolated CI verification are done. Live production deployment is not done and must remain blocked until the release migrations are reviewed/reconciled, the dashboard objects are deployed in a controlled rollout, read-only live verification returns PASS, and a real production-account/mobile/share-link review is completed.

## Exact-head closeout evidence — 2026-10-29

- Source/code head `da71668e9cfce331dd1ff934882bf0914150fcda` passed [Primary Catalog Validation 40794290839](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290839): TypeScript/build, permission matrix, isolated PostgreSQL RBAC/tenant/branch tests and Chromium route/refresh E2E. It passed [Forward replay 40794290701](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290701), which restored checkpoint `20261008222845` and applied all 65 later migrations in order including RC457 in an isolated disposable instance.
- Other validations passed: [immutability 40794290678](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290678), [version uniqueness 40794290552](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290552), [collision guard 40794290983](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290983), [backend boundary 40794290752](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290752), [professionalization 40794291165](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794291165), [MantiGO privacy 40794291170](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794291170), [RC425 atomicity 40794290617](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290617), [commission 40794290801](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290801), [approval atomicity 40794290554](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290554), [legacy catalog 40794290613](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290613), [SMM contract 40794290869](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290869).
- Read-only live check: Supabase migration ledger has 303 entries and latest version `20261028112112`, while the RC113/RC114 tables and RC115/RC457 RPCs needed by the dashboard remain absent. The reconciliation manifest keeps status `BLOCKED`; no production write or deploy occurred. The main deployment dependency gate intentionally fails closed while those objects are missing.
- PR #483 remains Draft/unmerged. Outstanding manual review: real-device visual/accessibility checks, deployed QR/permanent-link regression, and authenticated testing against the deployed origin. The platform release gate is still `BLOCKED / NOT CERTIFIED` because unrelated production-schema/finance/Edge Function gaps remain.


## 2026-10-29 — Current dashboard status after merge

- PR #483 is closed/merged into `main` at `bbd8e6f5c881f3b4744d5e783bb52874406c7600`. Do not continue to describe it as a draft or unmerged.
- The latest primary catalog validation passed TypeScript, production build, Chromium browser E2E, and isolated PostgreSQL employee RBAC checks: https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40814976708.
- The main-branch deployment workflow did **not** publish the new dashboard. It stopped at the live dependency gate because required RC113/RC114/RC115/RC457 production database objects are absent/unverified: https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40814976763. The deploy job was skipped, and no production schema/data mutation occurred.
- Required next step is a controlled, reviewed database migration reconciliation and application of the exact missing migrations, followed by fresh read-only live-object verification and a new deployment attempt. Never bypass the guard or mark migrations applied without verifying their actual effects. Full platform status remains `BLOCKED / NOT CERTIFIED`.
- Remaining dashboard-specific checks after dependency readiness: authenticated production-origin smoke test, real-device mobile/tablet and keyboard/accessibility review, and deployed QR/permanent-link regression.


## 2026-10-29 — Dashboard dependency rollout after PR #483 merge

- PR #483 is merged. The production database dependency gap for the professional dashboard was addressed by additive forward migration `20261029041815_professional_dashboard_dependencies_forward_repair`.
- The migration source is tracked in `supabase/migrations/20261029041815_professional_dashboard_dependencies_forward_repair.sql`; it applies reviewed RC113/RC114/RC115/RC116/RC457 segments in order. RC117 image-field updates were intentionally left out to avoid unrelated production data mutation.
- Live verification passed for all 11 dashboard objects, four new tables with RLS + FORCE RLS, absence of direct anon/authenticated table grants, intended authenticated RPC grants, and fail-closed permission checks when no authenticated actor is present.
- `docs/release/production-migration-reconciliation.json` now reflects PASS for the dashboard dependency gate only. The overall production gate remains `BLOCKED / NOT CERTIFIED` due 41 missing full-platform migration versions and unrelated finance/payment, Edge Function parity, backup/restore, Auth, monitoring and rollback evidence.
- GitHub Pages deployment succeeded on [workflow run 40817091710](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40817091710); post-deploy catalog root/assets checks passed at https://islamnagy2022-eng.github.io/MantiqatiX/. Authenticated live-origin checks, real-device mobile/accessibility review and QR/permanent-link regression remain NOT VERIFIED.


## 2026-10-29 — Final dashboard post-deploy verification checkpoint

- PR #483 dashboard code remains merged to `main`; the latest dashboard styling and post-deploy test work is committed at `999f5bcb72a26a244bd10f990ef6ef80e4ec50e7`.
- [Primary Catalog Frontend Validation 40818177042](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40818177042) and [Deploy MantiqatiX Web 40818177045](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40818177045) passed on that exact commit.
- Current deployment URL: https://islamnagy2022-eng.github.io/MantiqatiX/. The deployment workflow verified the root/title/config/assets; retired preview/SMM routes remain unpublished.
- Post-deploy Playwright checks ran against the deployed origin and passed guest denial, owner route+refresh, read-only employee, branch-scoped RPC payload/legacy-route denial, unsupported-manager denial, mobile/desktop overflow, canonical permanent URL and QR payload checks.
- axe-core WCAG 2.1 A/AA checks found no critical or serious violations in owner mobile/desktop main content, merchant QR tab or QR modal after contrast fixes. These checks are automated viewport/browser checks, not full WCAG certification.
- Auth responses in browser E2E were mocked. Real production-account owner/employee sessions, live authenticated RLS verification, physical camera QR scan, manual device/tablet keyboard review and custom-domain verification remain NOT VERIFIED.
- Dashboard-specific dependency verification remains PASS; overall platform release remains `BLOCKED / NOT CERTIFIED` for the unrelated release migration, finance/payment, Edge Function parity, backup/restore, Auth, monitoring and rollback gaps.


## Latest directory execution note — 2026-10-29

Directory discovery has begun for **Berket El Sabaa city and its administratively affiliated villages/hamlets/dependencies only**. The code seed file currently has 18 functional groups and 221 category seed entries; that number is not a verified effective/live taxonomy count. Supabase `public.public_directory_listings` had 325 rows and RLS enabled at the time of audit. Three medical listings were added and read-after-write verified after global name/phone duplicate checks: د. هيثم البلتاجي عبد القادر, د. إيهاب محمد البلشي, and د. عادل عبد الكريم بدوي. Source: https://dalil140.com/category/ar/doctors/el-monofeya/berket-el-sabaa. Records remain PUBLISHED/UNCLAIMED with owner confirmation required and phone verification false. This is partial work only: the 50-category migration and geographic coverage audit remain open, and the previously noted classification issue for `مركز د. محمد أحمد المراكبي للأسنان` is not yet corrected.

- Additional medical discovery batch: added صيدلية إسلام داوود (0489136699) in جنزور after checking existing records. Four other pharmacy candidates from the same public directory already existed and were not duplicated. Total additions recorded for this session: three doctors and one pharmacy; work remains partial.

- Additional verified changes: inserted صيدلية سهام (0482913190) and صيدلية د. أحمد حسن (0482270049, Malig village) after duplicate checks; both remain PUBLISHED/UNCLAIMED with owner confirmation required. Corrected `مركز د. محمد أحمد المراكبي للأسنان` to the dental-centers taxonomy category without deleting/recreating it. Total new records verified this session: 6 (3 doctors, 3 pharmacies); no full taxonomy migration or deployment is claimed.

- Additional food/grocery batch added nine source-backed Berket El Sabaa listings from Egypt Yellow Pages after checking existing names: مطعم أبو رضوى, مخبز علا بركات الله, مطعم الحرمين, مطعم الملكي, مطعم السلطان, مطعم الزعيم, مطعم إيطاليا, كشري فيينا, مطعم سويت هوم. Phone numbers were not present in the source and were not guessed. Existing matches were not duplicated. Total new records verified in this session: 15 (3 doctors, 3 pharmacies, 9 food businesses); overall discovery remains partial.

- Additional verified food/grocery work: added eight supermarkets/markets from Egypt Yellow Pages after comparing names against the current directory: سوبر ماركت أبو عفيفي, سوبر ماركت الإسكندراني, سوبر ماركت الشاذلي, سوبر ماركت الزيات, سوبر ماركت فرح, حمادة ماركت, هاني ماركت, وائل ماركت. Phone fields remain empty because the source did not expose numbers. Total new listings verified in this session: 23 (3 doctors, 3 pharmacies, 17 food/market records); full discovery remains open.


---

## 2026-10-30 — Latest continuation checkpoint: owner specification traceability

- **Baseline:** verified current `main` commit `16b168b40eac01b37a94eed34b757f68a00dd6a5`.
- **Completed:** created `docs/specifications/SPECIFICATION_TODO_TRACEABILITY.md`, mapping owner specifications 00–19 to existing canonical TODO and module acceptance sections via stable `SPEC-00`–`SPEC-19` keys.
- **Registers updated:** `TODO_PRODUCTION.md`, `docs/MASTER_PRODUCTION_TODO.md`, `docs/TODO_MASTER_DEVELOPMENT.md`, and `docs/SESSION_LOG.md`. Existing checkboxes and statuses were preserved; no feature was marked VERIFIED by documentation mapping.
- **Branch:** `docs/spec-00-19-traceability-20261030`; first map-file commit `9229d76d235cabb95a1b129fca7225ed3e7ca734`. Follow-up documentation commits are on the same branch.
- **UI / platform scope:** preserve the current deployed catalog UI exactly; no redesign or replacement. Website/catalog and shared backend contracts only; Android remains deferred.
- **Unverified:** deployed-origin browser interaction for PR #500 folder-style taxonomy navigation; physical-device/mobile/tablet and accessibility review; all broader P0 production gates.
- **Production:** `BLOCKED / NOT CERTIFIED`. No production migration, data write, grant/Auth/RLS change, Edge Function deployment, secret change, payment, or financial operation was performed.
- **Next:** reconcile `docs/TODO_MASTER_DEVELOPMENT.md` acceptance criteria against the two canonical registers using the crosswalk; then add/run taxonomy folder-flow browser coverage without changing the UI. Continue only with evidence-backed, additive fixes.


---

## 2026-10-30 — Continuation after PR #524

- PR #524 merged to `main` as `51fad575eb740d61b3de5ea3a856dbf7cc68bbfd`.
- Owner specifications 00–19 now have a stable cross-reference map in `docs/specifications/SPECIFICATION_TODO_TRACEABILITY.md`; the three active TODO registers and continuity/session records link to it.
- Exact-PR Primary Catalog Frontend Validation [41005124723](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005124723) passed. This includes build/typecheck/contracts, PostgreSQL employee RBAC, and Playwright browser tests for group/category/specialty folders, breadcrumbs/back navigation, return to catalog, and responsive overflow at 390/768/1440 px.
- Backend boundary, module professionalization, SMM deferred contract, MantiGO privacy, RC425 atomicity, and flexible commission workflows also passed on the exact commit.
- Pages PR validation [41005124658](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005124658) passed, but deploy jobs were skipped for the PR event. Post-merge Pages publish/deployed-origin Playwright verification remains open.
- No production schema/data, migration, Auth/RLS/grants, Edge Functions, secrets, payment or finance changes occurred. No UI redesign or source component changes were made.
- Production release remains **BLOCKED / NOT CERTIFIED**.
- **Next resume:** check post-merge Pages deployment and deployed-origin browser outcome; then continue module acceptance/TODO reconciliation using the new SPEC crosswalk.


---

## 2026-10-30 — Latest continuation: PR #525 merged

- PR #525 merged to `main` as `3bf212793e61ad6ae47f46e6fa73b0d8b988be4c`.
- Unconfirmed directory-listing counters now have the requested red treatment; confirmed activity counters remain green. No layout, typography, hierarchy, group ordering, filter or ranking logic was changed.
- Exact-head Primary Catalog Frontend Validation [41005476492](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005476492) passed build/typecheck/contracts, isolated employee RBAC PostgreSQL and Playwright red/green indicator checks.
- Supporting exact-commit backend boundary, module professionalization, MantiGO privacy, RC425 atomicity and flexible commission workflows passed.
- Pages PR validation 41005476412 passed the validation job but skipped deployment on the PR event. Post-merge deployed-origin verification remains open.
- No production schema/data, migration, Supabase settings, Auth/RLS/grants, Edge Function, secret, payment or financial mutation occurred.
- Production Gate remains **BLOCKED / NOT CERTIFIED**.
- **Next resume:** verify post-merge Pages deployment and the deployed-origin browser suite; then continue module acceptance/TODO reconciliation from `docs/specifications/SPECIFICATION_TODO_TRACEABILITY.md`.


## 2026-10-30 — Latest continuation checkpoint: read-only security and Edge parity

- Latest read-only report: [`docs/audits/READ_ONLY_SECURITY_EDGE_PARITY_20261030.md`](audits/READ_ONLY_SECURITY_EDGE_PARITY_20261030.md).
- Supabase project ACTIVE_HEALTHY, PostgreSQL 17.6.1.155; 308 production migration records through 20261029083845.
- Security Advisor: 8 RLS-enabled/no-policy tables, 3 anon and 67 authenticated SECURITY DEFINER warnings, 90 anonymous-access table findings, Leaked Password Protection disabled.
- Policy inventory: 19 explicit anon/public policies; 483 authenticated policies, 283 with textual `is_anonymous` reference and 200 without. This is a review queue, not a proven vulnerability count. Finance examples generally rely on active membership/tenant/role checks; anonymous JWT runtime tests are still needed.
- Exact text parity absent for six critical deployed Edge Functions: order-create v8, payment-intent v8, paymob-webhook v10, digital-page-payment-intent v5, subscription-payment-intent v4, financial-journal v3. No function was deployed.
- Next: policy-by-policy anonymous JWT tests; SECURITY DEFINER ACL/search-path/caller review; semantic diff + isolated tests for six functions; live ledger/object-contract reconciliation; authorized leaked-password protection setting; verify post-merge Pages deployment for PR #525.
- No production mutation. Production remains BLOCKED / NOT CERTIFIED.


## 2026-10-30 — Latest continuation checkpoint: Pages E2E passed; deployed Edge drift confirmed

- Latest deployed commit: `fe01dce043c8c8b5821ad679b561963a23a5357a`; Pages deployment workflow [41005969738](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005969738) completed successfully.
- Deployed-origin Playwright passed with `PRIMARY_CATALOG_BROWSER_E2E=PASS`, covering dashboard route guards/scopes, mobile/desktop layout, QR/permanent URLs, GPS fallback, taxonomy folder flow, and axe critical/serious checks.
- New read-only semantic diff: [`docs/audits/DEPLOYED_EDGE_SEMANTIC_DIFF_20261030.md`](audits/DEPLOYED_EDGE_SEMANTIC_DIFF_20261030.md).
- Confirmed source drift requiring isolated verification: payment-intent v8 lacks current amount/correlation checks; digital-page-payment-intent v5 lacks current amount/correlation and fail-closed claim reconciliation; subscription-payment-intent v4 lacks current claimable/concurrency and checkout-secret encryption/recovery controls; financial-journal v3 uses older actor-unbound RPC contract and wildcard CORS.
- Webhook v10 and order-create v8 remain open for complete semantic/RPC trace. Do not deploy current source blindly.
- **Next:** verify live RPC signatures/definitions, grants, owners, SECURITY DEFINER and search_path against the current migration manifest; build a restorable isolated database; run payment/webhook/finance adversarial tests; prepare a per-function reviewed rollout and rollback plan.
- No production Supabase mutation or financial operation was performed. Production release remains **BLOCKED / NOT CERTIFIED**.


### Confirmed live schema/Edge mismatch — 2026-10-30
- Production ledger lacks RC435 20261009210000, RC436 20261009220000, and RC439 20261010010000.
- Subscription claimable RPCs and provider-creation/encrypted-checkout columns required by current main are absent in production.
- Live journal RPCs lack service-role EXECUTE. RC436 introduces post_financial_journal_atomic_backend with service-role grant, but current main Edge code still calls the older post_financial_journal_backend; do not deploy before aligning and testing this contract.
- See docs/audits/DEPLOYED_EDGE_SEMANTIC_DIFF_20261030.md.
- Next: isolated restorable DB rehearsal for RC435/436/439, integration and rollback tests, then correct Edge source. No production mutation performed; release remains BLOCKED.


### Financial journal path correction
- Use RC449A → RC450 as the canonical financial journal rollout. Do not use RC436 as a substitute.
- Current main Edge Function RPC name matches RC450; live production is blocked because RC449A/RC450 are absent and the old live RPC lacks service_role EXECUTE and RC450 actor/scope semantics.
- Follow docs/runbooks/RC450_FINANCIAL_JOURNAL_ROLLOUT.md; rehearse on an isolated restorable DB before production approval.
- Corrected audit evidence is in docs/audits/DEPLOYED_EDGE_SEMANTIC_DIFF_20261030.md.


### Latest security checkpoint — RLS and SECURITY DEFINER
- Read-only review report: docs/audits/RLS_ANONYMOUS_AND_SECURITY_DEFINER_20261030.md.
- 90 anonymous-policy warnings, 67 authenticated-executable SECURITY DEFINER functions, 3 anon-executable definer warnings, 8 RLS-enabled/no-policy INFO findings, and leaked password protection disabled.
- No-policy tables have no direct anon/authenticated grants; trigger-only definer functions and bounded public ad lookup were distinguished from ordinary RPCs. No broad ACL or RLS fix applied.
- Next: isolated anonymous JWT and tenant/business/branch adversarial tests, 67-function caller/identity/search_path review, then narrowly scoped fixes. No production security mutation; gate remains BLOCKED.


### Release manifest checkpoint — 2026-10-30
- docs/release/production-migration-reconciliation.json now records current read-only evidence: 308 live migration records; 41 exact required source-version IDs still absent; RC435/RC439 subscription contracts absent; RC449A/RC450 financial journal path absent; RLS/SECURITY DEFINER advisor counts refreshed.
- Financial journal canonical path is RC449A→RC450; current main Edge RPC name matches RC450. Do not use RC436 as a substitute.
- Overall release remains BLOCKED pending isolated migration rehearsal, payment/finance E2E, anonymous JWT tests and backup/restore.


## 2026-10-30 — Latest continuation checkpoint: PR #533 merged

- PR [#533](https://github.com/islamnagy2022-eng/MantiqatiX/pull/533) merged to `main` as `f38b609b00fd0025793b00ebf7990073dfaff4c9`.
- Production provider profile for متجر قدم السعد is confirmed ACTIVE and `is_verified=true`.
- Verified directory cards and storefront headers now show conditional external logo/cover links immediately after the verification badge when each URL exists.
- Exact-PR Primary Catalog Frontend Validation [41015206306](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41015206306) passed build/TypeScript, isolated PostgreSQL RBAC and browser jobs; supporting module/backend workflows passed.
- PR Pages validation succeeded, but the PR event's deploy job was skipped. **Do not claim the live site is updated until the post-merge main deployment and deployed-origin check are confirmed.**
- Next: verify the main Pages deployment; add focused E2E for both/one/no URLs and unverified profiles; audit URL coverage for all verified activities; preserve the existing UI and mobile layout.
- Every new owner request must be added to the canonical TODO register and linked to its parent goal; close only after applicable tests and deployment verification.
- Overall Production Gate remains **BLOCKED / NOT CERTIFIED** for unrelated security, migration, Edge Function, finance/payment and backup/restore gates.

 
## 2026-10-30 — Latest continuation checkpoint: PR #534 external URL semantics fixed

- PR #533 was deployed successfully by main Pages run [41015430795](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41015430795).
- Follow-up review identified that fallback display images could be mistaken for external URLs. PR [#534](https://github.com/islamnagy2022-eng/MantiqatiX/pull/534) merged as `9cb40af9886e5141702576a7a20f300b78fcff4e`.
- Explicit external logo/cover fields now flow through both public directory and direct public storefront APIs. Display fallback images remain separate; UI actions require verified status and a non-empty configured HTTPS URL.
- Primary Catalog Frontend Validation [41016181188](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41016181188) passed build/typecheck, browser E2E and isolated PostgreSQL RBAC. Pages PR validation [41016181132](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41016181132) passed; deploy skipped on PR by design.
- Next: verify post-merge main Pages deployment and deployed-origin browser result; audit external URL coverage for verified profiles.
- Preserve existing layout, default image display, mobile grid, verified-first ranking and public route behavior.
- Overall Production Gate remains **BLOCKED / NOT CERTIFIED** for unrelated live security, migration, Edge Function, finance/payment and backup/restore gates.


## 2026-10-30 — Final verification: external brand links deployed

- Main Pages run [41016389584](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41016389584) succeeded on 31ef40faa136f036ebd7220e682152a79deae139, including production deploy, primary-root verification and deployed-origin browser suite.
- Supabase production public-catalog-directory is version 9 and public-catalog is version 5; both have verify_jwt=false unchanged and exact source parity with main.
- Read-only production audit found 2 ACTIVE verified provider profiles; both have valid HTTPS logo and cover URLs. No invalid configured URL values were found.
- PR #534 browser E2E passed both public directory cards and direct storefront hydration, including both URLs / logo-only / cover-only / no URLs / unverified cases.
- The external logo/cover feature is now deployed in the frontend and both public read APIs. Existing default images remain for display only and are not presented as external links.
- Preserve the existing UI and verified-first ranking. Overall platform Production Gate remains BLOCKED / NOT CERTIFIED for unrelated P0 security, migration, Edge/payment/finance and backup/restore gates.


## 2026-10-31 — Current continuation after PR #565

- [x] PR #565 merged to `main` as `3247f53c561e8161075024e0436668460f55d779`; it records the fresh read-only subscription/journal contract audit. No Production database, Auth, RLS, grants, Edge Functions, secrets, payment, or financial records changed.
- [x] Main push workflows on that exact commit passed, including Pages deployment [41155204293](https://github.com/islamnagy2022-eng/MantiQatiX/actions/runs/41155204293) and Production Health Monitor [41155204266](https://github.com/islamnagy2022-eng/MantiQatiX/actions/runs/41155204266).
- [x] PR #543/#546 auth path changes are merged; PR #547 documents the current CI/deployed-origin evidence. Real Google-account timing/cross-account and failed-subscriber-request/manual-retry verification remain open.
- [x] Supabase state rechecked read-only: only `main` branch exists; 308 migration rows through `20261029083845`; latest Security Advisor is 8 RLS/no-policy, 3 anon SECDEF, 67 authenticated SECDEF; no current-schema isolated restore exists.
- [ ] Next prerequisite: user-approved, cost-reviewed isolated current-schema rehearsal environment. Do not create a paid Supabase branch or mutate Production without explicit approval and recovery plan.
- **Final Production Gate remains BLOCKED / NOT CERTIFIED.**


## 2026-10-31 — Supabase Free-tier continuity monitoring (PR in progress)

- **Verified repository head before this work:** `main` at `27c77a70bc57ad3529acb9f445c018b1b335f6b6`; this supersedes the older in-file checkpoint `3247f53c561e8161075024e0436668460f55d779`.
- **Monitoring finding:** the existing `.github/workflows/production-health-monitor.yml` runs hourly, but the deployed `/functions/v1/health` handler only returns a static JSON response and does not query PostgreSQL. A successful Edge Function health response therefore did not prove database availability or create a database read.
- **Implemented on branch `ops/supabase-free-tier-db-monitor-20261031`:** added a read-only PostgREST probe to the existing hourly monitor. It reads the already-public browser config, then requests at most one `business_id` from `public.marketing_provider_profiles` using only the public anon key; the response body is discarded. The probe performs no INSERT/UPDATE/DELETE, uses no service-role credential, and changes no schema, RLS, Auth setting, Edge Function, or UI.
- **Expected behavior after merge:** the existing hourly schedule at minute 17 checks Pages, Edge runtime, the database REST query, and catalog assets. A non-200 database response fails the workflow. This is a low-cost activity/availability probe, not a contractual guarantee against Supabase pausing; GitHub scheduled runs can be delayed and a paused project may cause the probe to fail rather than automatically resume it.
- **Backup posture:** no current Production backup was created from this session because no database password/connection string is available through the connected tools. A secure local Supabase CLI backup and restore-rehearsal runbook is added at `docs/operations/FREE_TIER_DATABASE_CONTINUITY.md`. Do not put dump files, credentials, or customer data in this public repository or GitHub Actions artifacts.
- **Verification status:** workflow source is staged on the branch; a first successful scheduled run against the live database is still pending PR review/merge. Alert delivery via GitHub notifications has not yet been tested. Restore rehearsal and measured RPO/RTO remain open.
- **Production impact:** NONE. No Production SQL, data, migration ledger, grants, policies, secrets, Auth settings, payments, or Edge Functions were changed. No paid resource was created. Overall Production Gate remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-31 — Post-merge status for Supabase Free-tier monitoring

- PR [#567](https://github.com/islamnagy2022-eng/MantiqatiX/pull/567) merged to `main` as `c8c65e7b4d8cf70e83753e9d194b25f18e5395cb`.
- Exact PR-head checks passed: Deploy MantiqatiX Web validation [41156511347](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41156511347), RC425 MantiGo Paymob Atomicity [41156511393](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41156511393), MantiGO Open Ride Privacy [41156511313](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41156511313), Backend-only Module Boundary [41156511407](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41156511407), and Module Professionalization [41156511364](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41156511364). The Pages deploy job was skipped on the PR event as intended; this PR did not change frontend assets.
- The hourly monitor is now on `main` and the push trigger should start a production health run. The connected GitHub workflow-run listing does not expose push-triggered runs, so the first post-merge live database probe is **NOT VERIFIED** in this session; do not claim it passed until the Actions run is inspected.
- No Production database mutation or paid resource was used. The local backup/restore runbook remains an owner-operated task; no backup or restore rehearsal has been completed.
- Production Gate remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-31 — Read-only database monitor permission preflight

- Confirmed via a read-only PostgreSQL catalog query that `public.marketing_provider_profiles` exists, RLS and FORCE RLS are enabled, anon has SELECT, and an explicit public SELECT policy exists for anon/authenticated.
- No business/profile rows were read and no Production data/schema/ACL/policy was changed.
- This confirms the DB-side contract for the hourly probe, not the live HTTP call. The first post-merge GitHub Actions monitor request and failure notification remain NOT VERIFIED because the connected GitHub workflow listing does not expose push-triggered run records.
- Supabase's current Free inactivity guidance says a few API/database requests per day typically suffice and recognizes API calls as activity; hourly monitor is intended to reduce inactivity-pause risk, not guarantee uptime.
- Evidence: `docs/audits/DB_MONITOR_READ_PATH_PREFLIGHT_20261031.md`. Production Gate remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-31 — Direct live database connection probe

- Supabase project status returned `ACTIVE_HEALTHY` (PostgreSQL 17.6.1.155, region us-east-2).
- A live read-only `SELECT 1` succeeded at `2026-10-31 01:57:01.957862+00 UTC`.
- This proves direct database connectivity at that timestamp only. It does not prove the GitHub Actions PostgREST monitor has run successfully or that notifications are delivered.
- No business data was selected and no schema, grants, RLS, Auth, Edge Functions, payments, or production records were changed.
- Evidence: `docs/audits/DB_CONNECTION_PROBE_20261031.md`. Production Gate remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-31 — Current-main deployment and live database monitor verified (PR #576 checkpoint)

- Current main at inspection: `0236118cd93d6e8330296da4442c2b07c93df211`.
- Current-main workflows completed successfully: Health Monitor #41160201368; Backend-only Module Boundary #41160201356; MantiGO Open Ride Privacy Boundary #41160201391; Module Professionalization #41160201354; Pages deployment #41160201369.
- Health job `124415873930` confirmed the read-only PostgREST GET returned HTTP 200 and logged `SUPABASE_DATABASE_READ_ONLY_PROBE=PASS`; site root/assets and Edge health also passed at that timestamp.
- Pages deploy job `124416013202` confirmed the deployed primary catalog root and `PRIMARY_CATALOG_BROWSER_E2E=PASS` for the tested catalog/role/QR/GPS/taxonomy journeys. axe scope was limited to the tested dashboard and QR views.
- Pages validation explicitly reported `CATALOG_PILOT_GATE=PASS` and `FULL_PLATFORM_GATE=BLOCKED`. The catalog pilot does not authorize payment, webhook, order, finance, SMM, or MantiGO backend deployment.
- Detailed live release blockers remain as in `docs/audits/PRODUCTION_GATE_EVIDENCE_20261031.md`; structural CI success does not supersede live evidence. Backup/restore, RPO/RTO, provider E2E, owner-side Auth evidence, notifications, and Android/device checks remain open.
- No Production mutation or paid-resource creation occurred. Production Gate remains **BLOCKED / NOT CERTIFIED**.

## 2026-10-31 — Live Supabase security recheck (read-only)

- Fresh Security/Performance Advisor observed at 02:51:13 UTC: 8 RLS/no-policy tables, 3 anon-executable SECURITY DEFINER, 67 authenticated-executable SECURITY DEFINER, 90 anonymous-sign-in-related findings, leaked-password warning; performance 129 unindexed FKs, 375 init-plan, 73 unused indexes, 28 permissive-policy groups.
- Direct privilege checks found no anon/authenticated SELECT/INSERT/UPDATE/DELETE on the eight no-policy tables. Seven have FORCE RLS; digital_page_payment_events does not. directory_listing_claim_requests and public_directory_listings are service_role DML-accessible; the other six are not (service_role TRUNCATE privilege was present on all eight).
- Three anon-executable SECURITY DEFINER functions were inspected. Two are trigger-returning functions with one trigger binding each. assign_default_owner_to_unowned_business() retains search_path=public, auth; the other two use empty search_path. No ACL or function changes were made.
- Evidence: docs/audits/LIVE_SUPABASE_SECURITY_RECHECK_20261031_0251.md. No business rows were read. Production Gate remains BLOCKED / NOT CERTIFIED.


## 2026-10-31 — Duplicate activity guard review and current-main verification

- Reviewed main source: AppContext uses a payload-keyed in-flight Map; identical in-flight submissions share one Promise while different payloads remain independent.
- The catalog-platform-admin Edge Function has a tenant-scoped duplicate lookup by normalized name/category and phone or fallback location; duplicate matches return HTTP 409 with the existing businessId before insert. Existing activity state is not changed.
- Dedicated source validator `scripts/validate-business-create-inflight-guard.mjs` passed in Pages validation run #41162036127. This is source-contract evidence, not a real browser/database concurrency test.
- Remaining risk: server check-then-insert is not atomic across simultaneous requests. Test concurrent submissions and network-response-loss retry behavior before claiming database-level idempotency. Draft PR #477 is stale and should not be merged as-is because main already contains a more precise client/server guard.
- Current main `b7b35378bbf5c1fd5ff54afb6be79e316e33624c`: Health Monitor #41162036080, backend boundary #41162036117, MantiGO privacy #41162036099, module professionalization #41162036130, and Pages #41162036127 all passed. Deployed-origin browser E2E passed for the tested scope.
- Full Production Gate remains BLOCKED / NOT CERTIFIED; the latest verifier artifact reports 24 PASS, 0 FAIL, 1 BLOCKED and does not certify the live migration/payment/backup blockers.


## 2026-10-31 — Direct activity modules (CAT-ACTIVITY-MODULES-20261031-01)

- User decision: visitor discovery must be **activity → specialty**, not functional groups/domains → activities → specialties. Each activity must open its own page/module with its domain-specific marketing and operating workflows.
- Request is registered in master request ledger [#599](https://github.com/islamnagy2022-eng/MantiqatiX/issues/599) and canonical `docs/MASTER_PRODUCTION_TODO.md`; architecture is documented in `docs/specifications/ACTIVITY_MODULES_ARCHITECTURE_20261031.md`.
- Current feature branch: `feat/activity-modules-current-main-20261031`, branched from latest main after the consent-first Egypt geo-discovery change. The first PR #607 was superseded because main advanced with important geographic discovery changes and the initial PR CI found a TypeScript symbol-reference failure. Do not merge the superseded PR/branch.
- Current implementation adds direct activity cards, a durable `?activity=<category-id>` route, specialty selection, reversible filters, and a module page with Overview, Specialties, Marketing guidance, and Operations capability sections.
- The current-main port preserves the latest geo-discovery dialog/consent flow, manual Egypt selectors and privacy safeguards; existing business verified-first ordering and unverified listing markers remain.
- Marketing is planning guidance only. Full campaign execution needs the reviewed current marketing workspace/RPCs, RC453 prerequisites, and tenant/business authorization. Browser direct campaign table writes are prohibited. SMM remains deferred.
- No production schema/data/grant/RLS/Auth/Edge Function/payment/advertising/financial changes were made.
- **Current status:** feature source and TODO are in progress; TypeScript/build, taxonomy + geo validators, browser E2E, and deployed-origin behavior are NOT VERIFIED on the new exact head. Production gate remains BLOCKED / NOT CERTIFIED.
- Next: run exact-head CI, fix failures without weakening checks, then implement the activity capability registry and secure Marketing & Advertising / domain operations in dependency order.


## 2026-10-31 — Exact-head CI checkpoint for Activity Modules

- Replacement PR #608 / branch `feat/activity-modules-current-main-20261031`, head `182bd1a48d4b9e43e8842eb356f12f1449e8d963`.
- TypeScript, catalog build, canonical taxonomy validator, geographic/GPS consent contract, and employee RBAC PostgreSQL job: **PASS** on the current branch head.
- Browser E2E run `41192816382`: still **IN PROGRESS** at the latest read. Two earlier runs exposed outdated selectors tied to removed functional-group navigation and non-exact specialty tab matching; both selectors were corrected and a new run started. No final browser pass is claimed yet.
- PR is Draft and not merged; production deployment is not claimed. Full campaign create/publish, budgets, external channel integrations, leads, metrics, and specialized operations remain TODO pending reviewed production server contracts.


## 2026-10-31 — Activity-specific marketing and operations registry

- Added `apps/catalog-frontend/src/modules/activities/activityModuleRegistry.ts`, with a typed resolver keyed by canonical activity ID and domain-specific profiles for the ten supported business-domain templates.
- Each activity module now renders a marketing objective, target audience, positioning, content pillars, campaign ideas, and launch asset checklist; the profile references the exact activity name/ID rather than presenting a generic global page.
- Operating capability cards now come from the module registry and are explicitly labelled **قيد التجهيز**. No capability is marked active/available before a verified server API, tenant/business/branch authorization, and negative security tests exist.
- Updated canonical taxonomy static contract and added a browser E2E scenario to compare restaurant marketing/operations against activity-specific capabilities.
- Existing production constraints remain: RC453 campaign tables/RPCs absent; RC452 manager-read policies not verified tenant/business scoped; RC102 provider-service owner write grants absent. Do not wire campaign/provider mutations until these production contracts are reconciled and authorized. SMM remains deferred.
- Current exact-head PR #608 validation is running for source/test commit `fdf81ef42ec68eacb42f9cebe76c97b45a7e2881`; run IDs: catalog `41196188567`, Pages validation `41196188571`, module professionalization `41196188606`, and additional repository security workflows `41196188583`, `41196188595`, `41196188562`, `41196188647`. At this checkpoint, TypeScript/build/taxonomy/geographic/browser results are not yet final on this new registry head.
- No production database/schema/data/grant/RLS/Auth/Edge deployment, campaign mutation, ad spend, payment, or financial operation occurred. PR #608 remains Draft; `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.


## 2026-10-31 — Activity module registry exact-head validation PASS

- Code/test head validated: `5ea3a4d4226ed43abc7addf91525607d558afe1e`.
- Catalog validation run [41196288654](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41196288654): TypeScript, primary catalog build, canonical taxonomy, geographic/GPS consent contract, employee RBAC PostgreSQL, and full Playwright browser E2E all **PASS**. Browser E2E includes direct module route/refresh/back, specialty filtering, mobile/tablet/desktop overflow, and restaurant-specific marketing/operations profile.
- Pages validation [41196288663](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41196288663) passed; Pages deployment was **SKIPPED** because this is a PR event.
- Module professionalization [41196288659], backend-only boundary [41196288717], privacy [41196288694], RC425 [41196288797], and flexible commission [41196288767] all passed.
- PR #608 remains Draft/unmerged. No deployed-origin activity module test or production deployment is claimed.
- Registry now provides 10 domain templates; all domain operations remain visibly planned until server contracts are implemented. RC453 campaigns remain absent in production; RC452 tenant/business scope and RC102 write grants remain unresolved. Do not enable campaign mutations or SMM.

## 2026-10-31 — Per-activity operational capability registry

- Added 150 reviewed operational capability definitions: exactly three for each of the 50 canonical activity IDs, covering each activity's actual catalogue, booking, stock, project, service, or request lifecycle as appropriate.
- Activity resolver now prioritizes its canonical-ID capability set; custom/unmapped activities retain a safe domain fallback.
- Every capability is forced to planned until an authorized server workflow is implemented and verified. UI state labels and accessible names reflect the actual state.
- Taxonomy validation now asserts all 50 IDs have exactly three activity-specific capability definitions. Pharmacy browser E2E checks its medicines/supplies, duty-hours, and delivery capabilities remain planned.
- Latest changes are on branch feat/activity-modules-current-main-20261031, PR #608. Exact-head CI for this capability increment must pass before merge; PR remains Draft.
- Admin-managed persistence/editor and backend actions remain open. No production schema, grants, RLS, Edge deployment, campaign execution, ad spend, or financial mutation was performed.


## CAT-ACTIVITY-MODULE-ADMIN-20261031-02 — Super Admin activity module configuration

**Date:** 2026-10-31  
**Status:** SOURCE IMPLEMENTED; exact-head CI VALIDATED on `7e0d8caa79a0b768c8320049c718d5ba581a1895`; production deployment and atomic audit durability remain open.  
**Request ledger:** Issue #599.  
**Branch / PR:** `feat/activity-modules-current-main-20261031` / Draft PR #608.

### Implemented in source
- [x] Added a visible `إعدادات وحدات الأنشطة` tab to the existing Super Admin dashboard without replacing current tabs.
- [x] Added `ActivityModulesAdmin.tsx` to select each canonical activity and edit its marketing objective, audience, positioning, content pillars, campaign ideas, and required assets.
- [x] Added per-activity editing for the existing three capability titles/descriptions. The editor cannot change capability IDs or activate an unverified workflow.
- [x] Added typed `ActivityModuleOverrides` to `AdminSettings`, persisted through the existing `SAVE_SETTINGS` server-authoritative action.
- [x] Updated `resolveActivityModuleConfig` and `ActivityModuleView` so saved admin overrides are reflected on public activity module pages.
- [x] Added server-side allowlist and validation for activity override IDs, fields, lengths, array counts, exactly three capabilities, and total payload size. The browser does not write to `bizcatalog_platform_settings` directly.
- [x] Added a server-side audit event `PLATFORM_ACTIVITY_MODULE_SETTINGS_UPDATED` containing changed activity IDs, changed sections, and the before/after values for those fields, attributed to the authenticated platform admin and a production tenant scope.
- [x] The Edge response exposes `auditLogged`; the frontend updates local state only after server-confirmed persistence and warns explicitly if persistence succeeded but audit insertion failed.
- [x] Added `scripts/validate-activity-module-admin.mjs`, `scripts/test-activity-module-overrides.mjs`, and wired the static contract and Node sanitizer tests into catalog validation workflows.
- [x] Added a sanitized public projection of only `activityModuleOverrides` to `public-catalog-directory`; the complete platform settings object is never returned. Public directory bootstrap now hydrates visitors' activity-module settings only when the public settings read is authoritative.
- [x] Read-only Supabase inspection confirmed `bizcatalog_platform_settings` exists with its singleton row, and `audit_logs` has the required `id`, `tenant_id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `old_values`, `new_values`, and `result` columns. No production data was changed.
- [x] Read-only permission inspection confirmed `bizcatalog_platform_settings` has RLS enabled with a `service_role`-only policy and no `anon`/`authenticated` table grants; `audit_logs` has RLS and FORCE RLS enabled, with service-role insert privilege. Public visitors receive the sanitized projection only through the Edge Function.
- [x] Confirmed deployed `catalog-platform-admin` and `public-catalog-directory` are still older versions (23 and 10 respectively); this PR's source changes have not been deployed.

### Safety boundary and open verification
- [x] Exact-head TypeScript check, canonical taxonomy validator, activity admin static contract, Node sanitizer tests, production catalog build, employee RBAC PostgreSQL, Browser Playwright E2E, backend-only boundary, SMM deferred contract, RC425 Paymob atomicity, flexible commissions, Open Ride privacy, Module Professionalization, and Pages validation all passed on `7e0d8caa79a0b768c8320049c718d5ba581a1895`.
- [x] Browser E2E includes `super-admin-activity-module-edit-and-save-round-trip`: a platform-admin browser fixture selects the pharmacy activity, changes its marketing objective, verifies the three capabilities remain `planned`, and verifies the authenticated `SAVE_SETTINGS` request and payload. This is a mocked browser contract, not a production database write.
- [ ] Add a real deployed-origin round-trip test after the reviewed Edge Function deployment; the current live functions are still older versions `catalog-platform-admin v23` and `public-catalog-directory v10`.
- [ ] Public visitor E2E must verify that a newly saved override is rendered after reload from the public settings projection; current E2E covers the Super Admin save request, while the public settings projection is guarded by static contracts and backend source checks.
- [ ] Make settings persistence and audit insertion atomic in one reviewed database transaction/RPC before treating the save-and-audit path as fully durable. Current behavior surfaces `auditLogged=false` if the second write fails after the settings upsert.
- [ ] Add isolated negative tests for unknown capability IDs, unauthorized platform memberships, and forced audit-write failure. Existing Node tests cover malformed IDs, length/array/payload bounds, duplicate capability IDs, and rejected capability-state elevation.
- [ ] Audit insertion currently follows the settings upsert and is not a single database transaction. A failed audit insert is surfaced as `auditLogged=false`, but the settings may already be persisted. Do not claim atomic save+audit until a reviewed transactional server contract exists.
- [ ] Verify live deployed Edge Function and real authenticated Super Admin save/read/reset behavior only after an explicitly authorized deployment. No deployment was performed by this source change.
- [ ] Verify role × platform-admin authorization, malformed payload rejection, oversized payload rejection, unknown capability IDs, and audit failure handling with isolated tests.
- [ ] All activity operations remain `planned`; editing display metadata does not enable orders, appointments, inventory, bookings, campaigns, budgets, or analytics.

### Production impact
- Source-only changes on the PR branch: frontend, Edge Function source, static validator and workflow configuration.
- No production migration, schema/data mutation, grant/RLS/Auth change, Edge deployment, campaign execution, advertising spend, payment or financial operation.
- `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.


## Request continuation — CAT-PHARMACY-DEFAULT-IMAGE-20261101

- Master request #599 comment 6550632491; detailed record in `docs/MASTER_PRODUCTION_TODO.md`.
- Branch `fix/unverified-pharmacy-default-image-20261101`: frontend mapper selects the requested shared image only for unverified pharmacy records without a selected custom image. Existing owner/admin/AI images and verified/non-pharmacy records are intended to remain unchanged.
- Static regression assertions added; exact-head CI and deployed-origin checks are still pending. No production data, schema, or Edge Function was changed; no deployment is claimed.
- Overall `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED` remains unchanged.


## Request continuation — CAT-DOCTOR-DEFAULT-IMAGE-20261101

- Added to master TODO and PR #628 alongside the unverified-pharmacy fallback.
- Refinement: doctor detection also recognizes normalized individual medical professionals (`functionalGroupId === 'medical_health'` and `classificationType === 'profession'`), in addition to explicit doctor type/name markers. This is needed because historical doctor category IDs are read-compatible-mapped into the canonical medical-practices activity while profession-vs-activity remains a preserved distinction.
- The exact supplied Google Play image is selected only for unverified doctor listings without a saved owner/admin/AI-selected image; pharmacy fallback logic is preserved.
- Exact-head CI and deployed-origin verification remain pending. No production data/schema/Edge Function changes or deployment are claimed.
- Overall `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED` remains unchanged.


## Request continuation — CAT-DIRECTORY-8COL-20261101

- Restored the requested compact eight-column layout for activity cards inside a selected group, with total/verified/unverified counts retained.
- Group-folder layout and unified search result cards are unchanged. Exact-head CI and deployed-origin checks pending; included in PR #628.


- Coverage refinement: the unverified-doctor and unverified-pharmacy images now apply to standalone public directory doctor/pharmacy listings as well as registered business records. Directory cards/detail show `metadata.profileImageUrl` when a valid HTTPS owner image exists, otherwise the matching default applies only to the relevant listing type and non-CLAIMED records. Both URLs moved to the common `defaultImages.ts` registry. CI/deployed-origin verification pending.


- Owner change path completed for standalone directory pages: the existing owner-only editor now exposes an optional HTTPS profile-image URL and persists it as metadata.profileImageUrl through the already-allowlisted UPDATE_OWNED_LISTING route. Existing owner image is shown first; clearing the field restores the doctor/pharmacy default for unclaimed records. No permission or backend policy changed.


## PR #628 browser E2E correction — 2026-11-01
- Browser E2E exposed a stale expectation for a heading named `الأنشطة` after an unsupported admin route. The current public directory is exposed as `section[aria-label="المجموعات والأنشطة"]`.
- Updated only the test selector to wait for that real public directory section; kept assertions that the admin tab is hidden and no `ADMIN_LIST` request is sent for unsupported roles.
- Rerun exact-head browser E2E. Do not merge or claim deployment until it passes. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED` remains unchanged.


### PR #628 browser E2E follow-up — 2026-11-01
- Latest browser run exposed another stale test assumption: the specialty reset control is `عرض كل أنشطة المجموعة`, not `عرض كل الأنشطة`; the directory landmark is `section[aria-label="المجموعات والأنشطة"]`, not a heading named `الأنشطة`.
- Updated both duplicated specialty-return assertions to match the real UI. This is test-only; no production UI, role, or authorization behavior was changed. Awaiting fresh CI on the new HEAD.


## PR #628 browser E2E follow-up — 2026-11-01 (parent group navigation)
- Exact-head run `41254516117` failed only in `professional_dashboard_browser_e2e` at test line 865: a duplicated specialty-filter scenario attempted to click the medical-practices activity card without first opening its parent “الطب والصحة” group.
- Corrected the test to follow the actual navigation sequence (open group → open activity → choose specialty). The source UI, routing, and authorization checks were not changed or weakened.
- Fresh CI is required on the new branch HEAD. Keep PR #628 unmerged and do not claim deployment until all required checks pass and the production release workflow actually deploys. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.


---

## Latest continuation handoff — 2026-11-06 15:55 UTC

- Active branch: `feat/v6-r5-preview-foundation-20261106`; PR #685 remains OPEN / DRAFT / NOT MERGED.
- Latest commit at handoff: `6d1b08cd8c652042563b8c0d9fc8db433936482e`. V6 application/source head remains `0de8917431d2e2ecf5e4cd833cd08d4286e682e`.
- Exact-head CI on commit 6d1b08c: **8/8 workflows completed successfully**. Primary catalog build, employee/RBAC PostgreSQL and 32-journey browser E2E passed. Pages validation and V6 public Preview E2E passed; 90 Preview/navigation assertions passed; axe critical=0 and zero non-critical violation groups. Pages deploy was skipped because this is a PR.
- The latest composed artifact is [13518406042](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42246039796/artifacts/13518406042), 65 files, ZIP SHA-256 `8c12e1980ed7e43f83212e19fbe34b33b63e1f2caf44f5712fe7369f73421305`. Existing catalog stays at root; V6 is a separate `/MantiqatiX/v6-preview/` path. Bundle scan found no wallet/admin/demo or service-role markers.
- Read-only alias reconciliation now confirms both expected duplicate source aliases by exact blob/statement evidence. Source evidence is 2/2 confirmed; formal ledger repair remains 0/2 and unapplied. See [PRODUCTION_ALIAS_RECONCILIATION_20261106_1555UTC.md](release/PRODUCTION_ALIAS_RECONCILIATION_20261106_1555UTC.md).
- Global production gate remains BLOCKED / NOT CERTIFIED: 0/42 exact required migration version IDs, missing schema/RPC prerequisites, six critical Edge Function drifts, payment/finance E2E and restore rehearsal NOT VERIFIED, Auth leaked-password protection disabled, and additional per-policy/per-function security review outstanding.
- Next: manual visual acceptance of V6 against AI Studio r5; then a genuinely isolated, cost-approved restore/replay path and controlled P0 production dependency closure. Do not create a billable Supabase branch until cost is known and approved.
- No merge, deployment, root cutover, or Production mutation.


---

## Current Production Edge Function drift — 2026-11-06

Read-only semantic comparison of all six critical live Edge Functions against current source is recorded in [PRODUCTION_EDGE_FUNCTION_CONTRACT_REVIEW_20261106.md](release/PRODUCTION_EDGE_FUNCTION_CONTRACT_REVIEW_20261106.md). Key points:
- Paymob webhook live v10 lacks current source failure processors and MantiGO payment processor; source also adds provider-order binding.
- Digital-page payment intent live v5 uses a 4-argument finalizer; source requires the 5-argument form with provider-order ID. Production only has the 4-argument RPC.
- Subscription payment intent live v4 uses the old create RPC; source requires two claimable/claim RPCs not found in Production.
- Financial journal live v3 calls the legacy RPC and wildcard CORS; source uses the backend RPC and restricted origin. Neither journal RPC currently grants EXECUTE to `service_role`, and required journal columns are missing.
- The source adds smaller hardening checks to order-create and payment-intent. All six remain mismatched and must be released only as one tested unit.
- No Production changes. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.


---

## Latest handoff — 2026-11-06 17:15 UTC

- Active branch: `feat/v6-r5-preview-foundation-20261106`; PR #685 OPEN / DRAFT / NOT MERGED.
- Current PR head: `f02c8770da26ec6cf3f50d12e2d05b0b853ff661`. Validated V6 application/source head remains `0de8917431d2e2ecf5e4cd833cd08d4286e682e8`.
- Canonical visual/replay/Production snapshot report: [`V6_R5_VISUAL_AND_MIGRATION_REPLAY_20261106_1710UTC.md`](`release/V6_R5_VISUAL_AND_MIGRATION_REPLAY_20261106_1710UTC.md`). Prior reference to the absent 1534UTC-only report path has been corrected in the continuity register.
- Screenshot capture artifact #13521016183 was inspected: 1440px desktop directory, 1440px activity profile and 390px mobile directory. No visible clipping/overlap or broken content in captures. A single activity fixture leaves substantial desktop whitespace; this remains a non-blocking review note. Pixel parity against a paired AI Studio r5 reference is NOT VERIFIED.
- Prior head `b6b7de6` CI: 9/9 workflows passed, including disposable local schema-checkpoint replay of 76 migrations and synthetic Tenant A/B isolation. This does not replace backup/restore or live Production proof.
- Current head `f02c877`: V6 source, SMM, Open Ride, Module Professionalization, RC425 and Backend Boundary completed PASS; Pages validation PASS and deploy jobs SKIPPED. Primary Catalog browser E2E and forward migration replay were IN PROGRESS at last check; recheck before claiming exact-head closure.
- Production remains BLOCKED: 309 migration records through `20261101140105`, 0/42 exact required source IDs; missing physical columns/objects; six critical Edge Function source drifts; missing five-argument digital finalizer; journal RPC service-role EXECUTE absent; Auth leaked-password protection disabled.
- Next: recheck the two current-head workflows; then continue genuine backup/restore and RPO/RTO, coupled finance/payment/Edge verification, security/Auth closure, and paired reference-image visual comparison.
- No Production write, deployment, PR merge or root cutover. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.


---

## Continuity checkpoint — 2026-11-06 17:42 UTC

- Branch `feat/v6-r5-preview-foundation-20261106`, PR #685 remains OPEN / DRAFT / NOT MERGED.
- Current PR head `5915ae0a397a088f54f48bc140e9a25b85fa6a62`; canonical V6 application source head `0de8917431d2e2ecf5e4cd833cd08d4286e682e8`.
- Exact PR-head CI: 9/9 workflows completed success. Pages validate success but public-only/deploy skipped for PR event. Primary Catalog browser E2E passed 32 journeys. V6 Preview E2E passed, axe critical/non-critical zero, mobile width 390px no horizontal overflow; all audited fixture images loaded.
- Composed Pages artifact #13525039740: 65 files; ZIP integrity PASS; SHA-256 `c417b3858ef6d9314b4bac67eb47be7d38c3930de73ef71490e862c5f4aaf0b7`. Existing catalog stays at root; V6 remains a separately bundled `/MantiqaTix/v6-preview/` Preview using shared public config. Artifact is not deployed.
- Visual review artifact #13525069690 SHA-256 `4d59d1ae7d602b673fb45ed216e24037274a0803f1eb867238096cee21c24375`; three current-head captures: desktop directory, desktop activity profile, 390px mobile directory. No clipping/overlap observed in these fixture captures.
- Isolated local schema-only replay #42261319024: from checkpoint 20261008222845, 76 ordered forward migrations applied through 20261101150000; RC117/owner profile/RC455/RC456/tenant-isolation tests passed. This is not a genuine backup/restore rehearsal and is not Production.
- Fresh Production read-only recheck 2026-11-06 17:38 UTC: 309 migration records through 20261101140105; 10 required columns and 3 required objects/indexes remain absent; journal service_role EXECUTE false; required 5-argument digital-page finalizer absent; six critical Edge Functions remain drifted; leaked-password protection disabled; advisors 94 lints.
- Pixel parity with the original AI Studio r5 enterprise screen remains NOT VERIFIED. The current V6 public Preview intentionally excludes private administration/wallet/cart; retain activity→specialty taxonomy with no functional-group layer. Review public promo/ad surface separately before calling design acceptance complete.
- Next dependencies: a genuine backup restore rehearsal with RPO/RTO/rollback, coupled payment/finance/webhook/Edge E2E, full per-function/per-table security closure, Auth owner-side evidence, SMM negative runtime tests, and approved visual reference acceptance.
- No Production writes, migration, schema/data/Auth/RLS/GRANT changes, Edge deployment, payment/finance operation, Pages deployment, PR merge or root cutover. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.


---

## PR head after evidence-only documentation commit — 2026-11-06

- Current PR/branch head: `b66d8c328d1a70171168746fd14ef4b0a6562889` (documentation-only).
- Last application/test head whose nine-workflow results are recorded above: `5915ae0a397a088f54f48bc140e9a25b85fa6a62`.
- V6 application/source head: `0de8917431d2e2ecf5e4cd833cd08d4286e682e8`.
- CI was automatically re-triggered for the documentation-only head. Do not attribute the completed 5915 test results to b66 until the new exact-head runs finish.
- PR #685 remains OPEN / DRAFT / NOT MERGED; no merge, Pages deployment, root cutover or Production change occurred.


---

## Continuity checkpoint — 2026-11-06 18:31 UTC

- Development branch: `feat/v6-r5-preview-foundation-20261106`; PR #685 OPEN / DRAFT / NOT MERGED.
- Latest fully tested code commit: `a7df3493460c77a28ef117ec9716bb369cf684a0`; canonical V6 source head remains `0de8917431d2e2ecf5e4cd833cd08d4286e682e8`.
- Exact-head CI: **9/9 workflows PASS**. Primary Catalog build/TypeScript, isolated employee/RBAC PostgreSQL and browser E2E passed across 32 named journeys. V6 source validation, Pages composition validation, backend-only module boundary, module professionalization, RC425 Paymob atomicity, MantiGO privacy and SMM deferred contract all passed.
- Isolated migration replay #42271053737 applied 76 ordered migrations through `20261101150000` from a schema-only checkpoint. RC117, owner-profile, RC455/RC456 and Tenant A/B reciprocal data-isolation checks passed. This is not a genuine backup/restore rehearsal.
- Multi-activity Preview screenshot artifact #13529541408, SHA-256 `100e45ffb0ec0a77605f11cfdf535355367238457c9ea1a8bb5d66ad5081b7d5`. Four synthetic activities are visible in the desktop directory; 390px mobile captures four readable vertical cards with no horizontal overflow. Axe critical=0 and non-critical=0.
- Composed Pages artifact #13529311825: 65 files, SHA-256 `8afbbd7ed4f429b9afaf06d9bb418705a7a07f8be606740fc4e7a7864aa3779f`. Root remains the existing catalog; V6 remains isolated under `v6-preview/`. Pages deploy job was SKIPPED for the PR event.
- Exact-head workflow links: Pages #42271053674; Primary Catalog #42271054041; migration replay #42271053737; V6 Source #42271053707; Backend Boundary #42271053695; Professionalization #42271053761; Paymob Atomicity #42271053881; MantiGO Privacy #42271053709; SMM #42271053662.
- The fresh Production blocker snapshot remains the 17:38 UTC read-only report: 309 migration rows, ten missing required columns, three missing objects/indexes, six critical Edge Function drifts, journal RPC ACL gap, four-argument rather than required five-argument digital-page finalizer, disabled leaked-password protection and 94 advisor lints.
- Next: genuine backup/restore rehearsal; coupled finance/payment/Edge E2E; RLS/SECURITY DEFINER review and negative tests; owner-side Auth security evidence; SMM negative runtime tests; paired original r5 visual reference acceptance.
- No Production mutation, merge, Pages deployment or root promotion occurred. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.


---

## Continuity checkpoint — 2026-11-06 18:33 UTC

- Latest validated application/test commit: `a7df3493460c77a28ef117ec9716bb369cf684a0`; nine exact-head workflows passed. Latest documentation-only CI checkpoint before this addendum: `37259eb60a7aa4285e9270940fe9e1e2751c7af4`, also 9/9 workflows passed.
- PR #685 remains OPEN / DRAFT / NOT MERGED. V6 is still an isolated Preview under `v6-preview/`; current catalog remains Pages root.
- Latest 4-activity Preview screenshot and CI evidence are captured in the 18:31 UTC checkpoint above.
- Current Production read-only query refresh confirms: ACTIVE_HEALTHY / PostgreSQL 17.6.1.155; 309 migrations through 20261101140105; 0/42 exact required IDs; ten columns and three objects/indexes absent; both journal RPCs deny EXECUTE to anon/authenticated/service_role; six critical Edge functions remain drifted.
- Current security Advisor produced 94 lint records. The catalog shows 19 explicit anon/public policies and zero anonymous Auth users. Two of three anon-executable SECURITY DEFINER functions are trigger-only; the third reads only active/approved ads. Do not bulk-revoke permissions or remove policies; owner-side Auth setting evidence and per-object review remain required.
- Manifest `docs/release/production-migration-reconciliation.json` now records the current isolated replay #42271053737 and 18:33 UTC read-only findings. Replay remains a schema-checkpoint rehearsal, not a genuine backup/data restore.
- Next: complete backup/data restore and RPO/RTO; test trigger ACL changes in isolation; close six-function payment/finance/Edge E2E; perform RLS/SECURITY DEFINER negative tests; obtain owner-side Auth settings proof.
- No Production write, migration, grant, Auth/RLS setting change, Edge deployment, payment/finance operation, Pages deployment, merge or root cutover occurred. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.


## Continuation handoff — 2026-11-06 20:50 UTC

- Branch `feat/v6-r5-preview-foundation-20261106`, PR #685 OPEN / DRAFT / NOT MERGED.
- Exact latest tested code/test head: `a420d355239e0d895e48a74de69a61d0f1223c7f`; exact-head CI 9/9 PASS. Full run IDs and test evidence are appended to `docs/MASTER_PRODUCTION_TODO.md` and `docs/SESSION_LOG.md`.
- V6 Preview browser E2E and axe passed, including verified-first sorting, red unverified dot, verification filters, 20+5 pagination, medical specialty filter, multi-product catalog, mobile profile/pagination and CORS. Primary catalog 32-journey E2E and employee/RBAC PostgreSQL passed.
- Isolated schema checkpoint replay passed 76 migrations through `20261101150000`, including RC117, owner-profile, RC455/RC456 and Tenant A/B isolation. Do not describe this as a genuine data backup/restore rehearsal.
- Preview remains at `/MantiqaTix/v6-preview/`; root remains current catalog. PR Pages deployment was skipped; nothing was deployed or promoted.
- Production blocker reference is the 18:33 UTC read-only snapshot: 309 migration rows, 0/42 exact required migration IDs, ten missing columns, three missing objects/indexes, two journal RPC ACL gaps and six critical Edge-function drifts. Re-read live state before any release decision; do not assume this snapshot is current beyond its timestamp.
- Next work order: (1) paired original r5 visual parity evidence; (2) genuine backup/data + Storage/Auth restore rehearsal with measured RPO/RTO/rollback; (3) six-function coupled payment/finance/webhook E2E and Edge parity; (4) per-object SECURITY DEFINER/ACL and anonymous/authenticated negative RLS tests; (5) owner-side Auth settings evidence; (6) SMM negative runtime tests. Keep the release gate blocked until all required gates and explicit approval are complete.
- No Production mutation, merge, Pages deploy, or root cutover. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.


---

## Exact-head CI + r5 parity review + fresh Production preflight — 2026-11-06

### Exact tested head: `fffe78591792147b143f804a2850d7e600643e71`
PR #685 remains OPEN / DRAFT / NOT MERGED. All nine workflows completed successfully (**9/9 PASS**):
- Primary Catalog Frontend #42291849353 — build, employee/RBAC PostgreSQL and browser E2E PASS; marker `PRIMARY_CATALOG_BROWSER_E2E=PASS` covers 32 named journeys.
- Pages / Deploy MantiqatiX Web #42291849414 — validation PASS; CORS preflights PASS for `api/api/v1/me`, `public-catalog-directory`, `directory-listings`; `PAGES_COMPOSITION=PASS`. PR-event `validate_public_only` and `deploy` jobs were SKIPPED; no deployment occurred.
- Forward Migration Chain Replay #42291849375 — PASS in disposable local Supabase/PostgreSQL; schema-only checkpoint `20261008222845`, 76 forward migrations through `20261101150000`, RC117, owner-profile persistence, RC455/RC456 and reciprocal synthetic Tenant A/B isolation passed. This is not a real customer-data backup/restore rehearsal.
- V6 Preview Source #42291849433 — PASS.
- Backend-only Module Boundary #42291849422 — PASS.
- Module Professionalization #42291849423 — PASS.
- RC425 MantiGo Paymob Atomicity #42291849347 — PASS.
- MantiGO Open Ride Privacy #42291849373 — PASS.
- SMM Deferred Storefront Contract #42291849374 — PASS.

### V6 public Preview E2E
- `V6_PUBLIC_PREVIEW_BROWSER_E2E=PASS`; axe critical=0 and non-critical=0.
- Verified-first ordering, red unverified dot, verified/unverified filters, 20 initial + 5 progressive items on desktop/mobile, search, `صحة ← صيدليات` specialty filtering, three read-only products/prices, mobile activity profile and no horizontal overflow all PASS.
- Three live CORS preflight checks PASS. Pages keeps the current catalog as root and V6 isolated under `/v6-preview/`.
- Visual evidence artifact #13541005167 contains desktop directory/profile and mobile directory/profile captures. Composed Pages artifact #13540640804 was independently downloaded and inspected: 65 files, root `index.html`, `v6-preview/index.html`, 3 V6 files including one JS bundle; no scanned private admin/wallet/checkout/service-role markers in V6 JS. Local downloaded ZIP SHA-256: `84bec10f61b21dbf38c36d4152008a7cfc08f59ba2ccb0b86e015e04d6229ecd`.

### r5 visual parity: NOT COMPLETE
- Re-verified the canonical r5 ZIP SHA-256: `0e868efefbacd5cf3ec4c07a558230ce5cdfbbbdab64416182bc9a59f3acd429`.
- Compared its `screenshot_homepage.png`, `screenshot_marquee_and_ads.png`, `screenshot_marquee_strips_close.png` with the tested Preview captures. The current public Preview is a directory/activity/profile slice; it does not yet reproduce the original homepage hero/header composition, 15-sector/three-tier plan section, interactive governorate map, product/service marquee strips or vertical sponsored-ad column.
- The current Preview README intentionally excludes these home/promotion surfaces and excludes private admin/merchant, wallet, cart/checkout and messaging surfaces. This is a documented scope gap, not a passing pixel-parity claim.
- Added `docs/release/V6_R5_VISUAL_PARITY_GAP_REGISTER_20261106.md` with safe implementation order and acceptance criteria. Public modules must use real published catalog data and active/approved ad records; no seed/fake product popularity, counts or advertiser claims. Admin/merchant and wallet/checkout remain gated behind verified Auth/membership/RBAC and finance release contracts.

### Fresh read-only Production Supabase check — this continuation pass
No writes were executed.
- Live project migration ledger remains 309 records through `20261101140105 directory_source_permission_evidence`.
- Ten required columns remain absent: `businesses.mnty_business_default_images`, `catalog_items.mnty_catalog_item_default_image`, `journal_entries.entry_number`, `journal_entries.posted_at`, `journal_entries.total_credit`, `journal_entries.total_debit`, `journal_entry_lines.line_number`, `marketing_services.image_source`, `marketing_services.image_url`, `marketing_services.mnty_marketing_service_default_image`.
- Three objects/indexes remain absent: `mantigo_payment_provider_events`, `smm_wallet_transactions_reference_type_uidx`, `uq_payment_intents_one_active_per_order`.
- Both `post_financial_journal(jsonb,jsonb)` and `post_financial_journal_backend(uuid,jsonb,jsonb)` exist but effective EXECUTE is false for anon, authenticated and service_role.
- Only the older four-argument `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)` exists; the required provider-order-bound five-argument form remains absent.
- Active critical Edge versions remain: order-create v8, payment-intent v8, paymob-webhook v10, digital-page-payment-intent v5, subscription-payment-intent v4, financial-journal v3. Version inventory does not close their known source drift.
- Security Advisor still returns 94 lints: 9 RLS-enabled/no-policy INFO, 3 public-executable SECURITY DEFINER WARN, 67 signed-in SECURITY DEFINER WARN, 90 anonymous-policy WARN, 1 leaked-password-protection WARN. Leaked-password protection remains disabled / owner-side evidence pending.

### Latest exact-head closeout — 2026-11-07 — `8a96b1cb00011892c6b03e0fdda8686ed27ea820`

- Exact PR-head CI: **9/9 workflows PASS**.
- V6 Preview r5 public cover: three slides and three public CTAs PASS.
- Live published catalog strip: 26 live fixture products from verified businesses only, availability + finite recorded price enforced; no fake popularity/order/sales metrics; no checkout/payment UI.
- Public-directory E2E: first 20 of 25, load-more to 25, verified-first order, red unverified dot, search, health→pharmacy specialty, activity profile with 3 products, desktop/mobile navigation and mobile pagination PASS.
- Accessibility: axe critical=0 and non-critical=0. Pages composition keeps the current catalog at root and V6 under `/MantiqaTix/v6-preview/`; the Pages deploy job was skipped for this PR event.
- Primary Catalog build, employee/RBAC PostgreSQL tests and 32-journey browser E2E PASS.
- Forward migration replay PASS against an isolated schema-only checkpoint. This is not a genuine Production data/Storage/Auth backup restore.
- Backend-only Module Boundary, Module Professionalization, RC425 Paymob Atomicity, MantiGO Open Ride Privacy, SMM Deferred Storefront Contract and V6 Preview Source Validation PASS.
- PR #685 remains OPEN / DRAFT / NOT MERGED. Main-branch push runs the Pages deploy job after validation; no merge-to-main or live deployment is performed as part of this candidate closeout.
- Production gate remains `BLOCKED / NOT CERTIFIED`; Preview CI does not close live schema, Edge Function, Auth/RLS, finance/payment, or backup/restore gaps.

### Next exact implementation order
1. Restore the canonical r5 **15-sector grid and quick-tabs mode**, using the canonical `functionalGroups` taxonomy and live activity counts only. Preserve the existing activity → specialty model and current directory routes; do not introduce a competing classification layer.
2. Restore the **three-tier sector spotlight/studio navigation** as a public informational/filtering surface only. Do not expose unverified admin or pricing actions.
3. Restore the **governorate map/filter** only with exact source-backed business coordinates or clearly labeled governorate/markaz aggregates; never use generated jitter/default Cairo point pins.
4. Keep marquee content limited to live published/available products and services with real active prices; extend only if actual service rows are present in the approved public adapter.
5. Add the sponsored column only from the active/approved targeted-ad contract with targeting, time-window, caps and consent enforcement.
6. Perform paired 1280×720 desktop and 390×844 mobile visual acceptance against the canonical r5 screenshots.
7. Separately close Production data/Storage/Auth restore with measured RPO/RTO/rollback; coupled payment/finance/Paymob/webhook/idempotency/wallet/settlement E2E; six critical Edge Function source parity; per-object SECURITY DEFINER/ACL and anonymous/authenticated negative RLS tests; owner-side Auth evidence; and SMM negative runtime tests.

No Production schema/data/migration/Auth/RLS/GRANT/Edge/payment/finance mutation, no Pages deployment, no root cutover, and no PR merge occurred. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.


# Latest continuation — 2026-11-09 — R6 national listings adapter

- New local cleanroom adapter: `src/services/nationalListings.ts`, separate from the business/catalog card adapter. It calls the already-existing `directory-listings` Edge Function with keyset cursor and all documented geography/taxonomy/search filters.
- Public-only GET with anon `apikey`; maps PUBLISHED records only, never marks them verified, and does not invent coordinates. Rejects malformed page contracts and missing continuation cursors.
- Added 5 tests. Total R6 test result: **88/88 PASS** across 14 files.
- Other local checks: security boundary PASS; Pages base/PWA contract PASS (72 TS/TSX scanned); service-worker runtime cache/scope isolation PASS; TS/TSX syntax transpilation PASS (86 files, zero errors).
- Latest local ZIP: `MantiqaTix-R6-national-listings-adapter.zip`, SHA-256 `e788794893db5c395a836e3d66e5805c620eb895c857f9b104a35d1386983cfa`; 123 total files, 87 source files, 14 tests, 2 mobile web components. Native Android remains separate and preserved.
- The new service is tested but **not yet wired to the R6 UI**. R6 remains local-only and not imported into GitHub; full typecheck/build/browser/PWA/deployed Preview are unverified. V6 root and `/legacy/` remain untouched; no Supabase Production writes.
- Next: connect the national listings view to this service, implement cursor-aware progressive loading and filter reset/stale-request handling, then validate in isolated Preview. Keep catalog cards separate.

- Follow-on UI integration (local only): `MedicalDirectoryView.tsx` now consumes the national listing adapter with 20-row cursor paging, healthcare/type/geography/specialty/search filters, debounced search, stale-request protection and ID dedupe. Directory-only rows are kept distinct from business catalog records.
- Removed search-triggered fake provider creation/verification and fabricated booking prices from the medical directory. Public listing rows remain unverified and do not open business storefronts.
- Safety assertion script `scripts/verify-r6-medical-directory.mjs`: PASS. All 88 unit tests still pass; security, Pages/PWA, service-worker isolation and 86-file TS/TSX syntax checks pass.
- New local package: `MantiqaTix-R6-medical-directory-integrated.zip`, SHA-256 `babba30693c0a1b7bd44b568bd283b6d04a16f643662cb06c6721e3b24c63b71`; 124 files total, 87 source, 14 test files, 2 mobile web components. Not imported or deployed.



---

## 2026-11-09 — Owner scope decision: no medical-directory integration

The owner explicitly removed the medical directory from the website scope. Do not merge, import, build, wire, expand, or work on the R6 medical-directory feature for the website. The earlier reference to `MantiqaTix-R6-medical-directory-integrated.zip` is historical only and is not an approved integration package. Exclude `MedicalDirectoryView.tsx`, medical-only routes/navigation, healthcare directory UI, medical-specific scripts/tests and booking additions from any future website import. Continue with the general activity/service directory, business profiles, public catalog/products, homepage and remaining platform work. This does not authorize deletion of existing Production records or customer data; no database records were removed. Preserve the separate mobile and native Android source. Full platform gate remains BLOCKED / NOT CERTIFIED.


---

## 2026-11-09 — V6 public UI excludes the dedicated medical directory

The owner clarified that the dedicated medical directory is to be removed from the current V6 website, not merely excluded from a future R6 import. Branch feat/remove-medical-directory-from-v6-public-site-20261109 updates the V6 build-preparation step so the generated public worktree has no MedicalDirectoryView import/route, no medical_directory public view mode, no Navbar link or homepage CTA, and no medical-only screen/specialty source files. General activity directory, business profiles, catalog/products and contact remain. This does not delete existing Production business records or customer data. Patch self-test and static source assertions are included; full CI/deployed browser validation remains pending. Keep the medical directory excluded from future work. Preserve separate mobile/native Android source. No Production backend changes are part of this patch.


---

## 2026-11-09 — V6 general-directory geographic discovery

The current V6 work adds consent-first geographic discovery to the general activity/service directory only. The standalone medical directory remains excluded by owner decision. The overlay imports the pinned Open Admin Data Egypt 2026.09 dataset (CC BY 4.0; commit `76b47b22872288c0d8b0c757975980e6986945e8`), provides 27 governorates and 365 district/center choices, and lazily fetches shiyakhas for the selected district. GPS is requested only after an explicit user click; exact coordinates are not persisted or sent to the external data host. A nearest representative-point result is only an approximate editable suggestion, not official boundary proof. Egypt-wide/manual fallback remains available. PR #706 is merged to main as `8e76971da0c60234eddbacc4c9f0059ecd85c171`. Exact-head source validation and Pages PR validation passed, including TypeScript/Vite and desktop/mobile Playwright against root and Preview. The PR-event deploy job was skipped by design; post-merge Pages HTTP/deployment confirmation remains outstanding. No Production backend changes. Preserve mobile/native Android source.


---

## 2026-11-09 — No standalone medical directory in either public website shell

The V6 root has already removed the standalone medical page. This follow-up also removes the old ?view=medical_directory route from the retained catalog served under /legacy/: the view-mode resolver, page import/render, Navbar and sitemap entries are removed, and the dedicated component is deleted. Old direct links fall back to the general activity directory. This is a UI-route removal only; no public business/customer rows, Supabase schema, Auth/RLS or Edge Function data are deleted. Keep general activity/service discovery and the 15-sector registry; preserve separate mobile/native Android source. Exact-head CI and deployed legacy browser checks are required before marking complete.


---

## Latest checkpoint — 2026-11-09 — Medical directory removal deployed; geo-boundary evidence updated

- PR #709 merged as `758f6276638f11448e990514bd671d4ba20914e5`. Dedicated medical directory route/page/nav/site-map/component removed from both V6 and retained `/legacy/`; stale `?view=medical_directory` routes fall back to general activity search. V6 root, legacy catalog and Preview URLs deployed; post-merge Pages root/legacy/preview checks and deployed-origin browser tests passed. `PRIMARY_CATALOG_BROWSER_E2E=PASS` includes `medical-directory-route-disabled-general-directory-fallback`. No production database rows or backend contracts were changed.
- Exact geoBoundaries EGY ADM2 metadata is now recorded: 365 units, represented year 2020, source OCHA ROMENA/HDX + CAPMAS, source data update 2023-01-19, CC BY 3.0 IGO; commercial reuse is permitted with attribution/change disclosure under the official deed. Simplified GeoJSON LFS object SHA-256 `abd2e419ce95e1cdd46bb18025a4eccfa6f877956494a56da3ebed4bc6a153d9`, size 1,379,010 bytes; pinned source commit `9469f09592ced973a3448cf66b6100b741b64c0d`.
- Geometry bytes were not available to this review session; polygon validity, CRS, properties and P-code crosswalk are NOT VERIFIED. OCHA ADM3 has 5,716 reported units with partial coverage; actual HDX polygon resource and its immutable manifest are still needed. Keep the current nearest-point UI explicitly approximate. Do not implement or deploy point-in-polygon until the geometry and joins are tested.
- Detailed record: `docs/GEO_BOUNDARY_VERIFIED_SOURCE_REVIEW_20261109.md`. No GPS coordinates persistence, Supabase/database/Auth/RLS/Edge, payment/finance, or mobile/Android source changes.


### Addendum — Open Admin Data IDs and OCHA ADM3 coverage (2026-11-09)

- Directly parsed 2026.09 Open Admin Data `all-governorate.json` and `all-district.json`: 27 governorates, 365 unique districts, all district `code.id` values equal `id`, all parent references resolve, all 365 district coordinates are populated. The IDs are `EG` + digits and follow the parent prefix; a sampled Giza ADM3 file uses child codes such as `EG210701`.
- OCHA's P-code standard requires an ISO-3166-1 prefix (usually two-letter) plus numeric hierarchical components, so the Open Admin Data codes fit the expected syntax, but records have no explicit `adm2_pcode` field and district `source` metadata is empty. Exact P-code identity with the current OCHA COD-AB source is not yet verified; a source-column crosswalk is still required.
- OCHA COD status dashboard reports Egypt ADM3 as partial coverage in 96.2% of ADM2 units (5,716 units). Treat missing ADM3 geometry as a coverage gap, not a point-outside result.
- No geometry files materialized or production code changed. Keep nearest-point UI explicitly approximate.


---

## 2026-11-09 16:14 Africa/Cairo — reconcile R6 raw-source access and medical-directory scope

- PR #709 is the authoritative merged implementation for removing the dedicated medical directory from both public website shells: merge commit `758f6276638f11448e990514bd671d4ba20914e5`. The root, retained `/legacy/` and `/v6-preview/` deployment plus deployed-origin browser checks are recorded as passing in Pages run `42502614593`.
- Duplicate Draft PR #711 had the same source head as PR #709 and no additional current-main application changes; it was closed as superseded, not merged. Do not reopen or replay it. Keep general activity categories and business rows; do not restore a dedicated medical directory or medical-specific page/route/navigation/booking flow.
- Current Library record for the canonical `bizcatalog-manager (6).zip` is `/MANTIQATIX/bizcatalog-manager (6).zip`, 37,305,478 bytes, with previously verified SHA-256 `c7623e2741d34ac5c58ba2c2c8f9286116e7adc6f5e214955c5c67d050c15447`. In this runtime, raw-byte materialization is explicitly denied by the Project file provider and text read fails internally. Do not claim the file is mounted here.
- The only current conversation attachment, `v6-source-tree-review.zip`, SHA-256 `bdb854f5668bc5387a7265a403d24ee3590aaa50b61aacf94bde4d270f945400`, is a limited review snapshot; it lacks `src/components/mobile/` and contains dedicated medical-directory UI. It is not canonical R6 and must not be imported or treated as a source replacement.
- The previously prepared sanitized R6 package and 83/83 test evidence are historical handoff artifacts; their files are not present in the current runtime and those tests were not rerun in this session. Exact R6 import remains the first source task once the canonical ZIP bytes are accessible. Preserve the R6 mobile UI and separate native Android source; exclude the dedicated medical directory and private/unsafe files.
- No R6 source files were imported, no production database/Auth/RLS/GRANT/Edge/payment/finance changes were made, and no new deployment or root cutover occurred in this checkpoint. The deployed V6 root and `/legacy/` rollback remain unchanged. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.


## 2026-11-10 — Current exact-head CI blocker and database security state

- Google OAuth PR #715 remains a draft on branch feat/v6-google-oauth-login-20261109, head 46f1c2e5c477d3683319f87ee45a1bc982ccef08. Current exact-head V6 validation run 42845709421 fails before install/test/typecheck/build due to a SHA-256 mismatch in the embedded OAuth ZIP overlay; deploy workflow 42845709457 consequently skips build/release/deploy. The public root and /legacy/ are unchanged.
- Expected overlay SHA-256: 4fe6566bcae43e6b7596ff5c841077e47db2c28ab91be74fc32b11663b9c29d2; current base64 payload SHA-256: 62bc772986525b048fd5a159df32acea97cd154a45d0b783dea7b88bc5e754e3. The three split parts concatenate to 12,084 characters, equal in length to the .b64 payload, but differ at offset 8610 (Krk/YWGS vs Krk/yWGS). Preserve fail-closed integrity verification; recover the intended ZIP rather than pinning the observed hash.
- Supabase Production migration history contains 310 entries and records latest migration 20261110150618_revoke_public_execute_from_trigger_functions. Its matching SQL file was not found at the conventional supabase/migrations/ path on main; find the actual repository migration location and reconcile it. The change is narrowly limited to revoking direct API EXECUTE on two trigger-only functions; corresponding triggers were previously verified enabled.
- Latest security advisor snapshot: 9 RLS-enabled tables with no policies (default-deny, intended access must be confirmed), 1 anon-callable SECURITY DEFINER function (get_mnty_targeted_advertisements), 65 authenticated-callable SECURITY DEFINER functions, and leaked-password protection disabled. There are also warnings for policies that include authenticated while anonymous Auth sessions are enabled; inspect each authorization predicate. Do not blanket-revoke SECURITY DEFINER functions or loosen RLS.
- No live application deployment, public root cutover, or broad database/Auth/RLS change occurred. Preserve the V6 root and /legacy/ rollback until exact-head CI and release gates pass. FULL_PLATFORM_GATE = BLOCKED / NOT CERTIFIED.


### 2026-11-10 — Security function call-chain findings

- The public targeted-ad RPC is SECURITY DEFINER but has an empty search_path and schema-qualified relations; it only selects active, approved, in-window advertisements and clamps limit to 1–50. Its anon grant is likely intentional for public ad rendering, subject to product-owner confirmation.
- All 65 authenticated-callable SECURITY DEFINER functions have explicit function-level search_path settings. A static scan found auth.uid() directly in 59; the remaining six include helper/delegating functions and require call-chain review. Inspected helpers mnty_active_membership, mnty_business_employee_list_scoped and assert_financial_membership enforce auth.uid()/anonymous-session/membership or finance-role checks. This is not a complete audit of all 65 functions.
- Important unresolved ownership behavior: assign_default_owner_to_unowned_business() trigger assigns an ACTIVE BUSINESS_OWNER membership to the fixed confirmed platform-owner email when a new business has no active owner. This may be intentional for imported catalog rows but could capture customer/provider-created businesses. Verify onboarding, imports and creator ownership semantics before launch; do not change without checking dependent flows. Trigger remains enabled and direct client EXECUTE is revoked.
- The nine RLS-enabled/no-policy tables grant no direct anon/authenticated DML or SELECT. Three directory tables grant service_role SELECT; other six do not. Keep default-deny until trusted server/definer access paths are validated.
