# Pass 741–760 — R7 Android wrapper and Production recovery gate

Date: 2026-11-18  
Baseline: `main` at `d0a525d728037fe60d73bb9ca6861b5424af6a8d`  
Production Supabase project: `moyhiluyhjsujhwlyeuu`

## 1. Current main and deployment evidence

- PR #801 was merged as `d0a525d728037fe60d73bb9ca6861b5424af6a8d`; it removes one duplicate PWA install button from the canonical Navbar.
- Exact-head pre-merge checks on PR #801 passed: Primary Catalog Frontend Validation, MantiGO Open Ride Privacy Boundary, RC425 MantiGO Paymob Atomicity, Backend-only Module Boundary, Deploy MantiqatiX Web, Flexible commission drafts, and Module Professionalization Validation.
- Post-merge runs for the exact main SHA were still running at the time of this audit: Primary Catalog Frontend Validation and Deploy MantiqatiX Web. Production Health Monitor, Backend-only Module Boundary, Module Professionalization Validation, and MantiGO Open Ride Privacy Boundary had completed successfully.
- The successful Production Health Monitor is limited to GitHub Pages reachability, Edge `/health` runtime, a read-only PostgREST probe, and public asset availability. It does not inspect backups, restore readiness, migration parity, or full application transactions.

## 2. R7 Android wrapper inspection

The uploaded `bizcatalog-manager (11).zip` contains only these three files under `android-webview-wrapper/`:

- `build.gradle.kts`
- `src/main/java/com/mantiqatix/app/MainActivity.kt`
- `AndroidManifest.xml`

The archive does not include a Gradle wrapper, root `settings.gradle.kts`, root Gradle build file, ProGuard file, Android resources, launcher icons, or a native test project. Yet the supplied module build references `proguard-rules.pro`, and the manifest references `@mipmap/ic_launcher`, `@mipmap/ic_launcher_round`, and `@style/Theme.AppCompat.DayNight.NoActionBar`. Those referenced files are absent from the archive. Therefore this package is not a complete standalone Android Gradle project and cannot be certified as buildable from the supplied files.

### Security and integration findings

- `MainActivity.kt` enables JavaScript and DOM storage and exposes `MantiqaTixNativeBridge` through `addJavascriptInterface`.
- The WebView loads `https://mantiqatix.com/?client=android_app`.
- Navigation only intercepts WhatsApp and `tel:` URLs; other destinations are allowed to continue in the WebView. There is no explicit trusted-origin allowlist or origin-scoped bridge.
- Android's JavaScript interface is not origin-scoped by the legacy `addJavascriptInterface` API. A WebView that can navigate to arbitrary content while retaining the bridge has an avoidable native-bridge exposure.
- The manifest sets `allowBackup=true` and requests fine/coarse location and notification permissions. No backup/data-extraction rules or runtime permission flow are included in the three-file package.
- A current-main repository code search for `MantiqatiXAndroidBridge` returned no matches. The bridge contract is therefore not shown to be consumed by the current web application.
- The R7 `MobileAppBottomNav.tsx` is not imported by R7 `App.tsx`; the sponsored stories bar is imported, but its implementation depends on the R7 legacy `AppContext` and seed-data model. These components cannot be copied into the current Supabase-backed catalog as standalone files.

### Decision

Keep the uploaded R7 Android wrapper as a historical reference artifact. Do not copy it into the current production tree or label it as an integrated native Android application. The current main mobile deliverable remains the responsive web/PWA surface. A native Android project requires a separate, complete Gradle build, origin-restricted navigation/bridge design, current production URL confirmation, authentication/session contract, runtime permission handling, Android CI, and emulator/device verification.

No current Android source, mobile-web component, or application behavior was deleted or replaced in this audit.

## 3. Current Production backup capability and release gate

The connected Supabase organization reports plan `free`. Supabase's official Database Backups documentation states that automatic daily backups are provided for Pro, Team and Enterprise projects, while Free projects should regularly export their data with Supabase CLI `db dump` and maintain off-site backups:

https://supabase.com/docs/guides/platform/backups

The current repository runbook `docs/operations/FREE_TIER_DATABASE_CONTINUITY.md` already defines the owner-operated local backup procedure. It explicitly says not to commit backup files or upload production data as GitHub Actions artifacts. The connected session does not have the Production database password/connection string and cannot create the private off-site backup.

Live read-only SQL verification at this audit:
- `public.directory_listing_contact_consents`: absent.
- Applied migration count: 310.
- Latest applied migration: `20261110150618`.
- Public tables: 138.

The live Edge Function inventory still reports `directory-listings` ACTIVE version 16. Main source contains consent-aware public directory output and the ordered pagination fix, but the Production registry table and matching migration are not yet present. Do not deploy the new Edge Function before its migration chain is applied and verified.

### Release decision

`BLOCKED / NOT CERTIFIED`.

Required before a coordinated Production release:
1. Owner/operator creates encrypted off-site logical exports on an authorized computer; preserve roles, schema and data separately and checksum the files.
2. Back up Storage object files separately; database dumps do not contain the Storage object payloads.
3. Preserve/recover Edge Function source/configuration, Auth provider and SMTP settings, secrets, webhooks and other project configuration separately.
4. Restore the backup into an isolated disposable target and record measured RPO/RTO.
5. Replay the ordered migration chain RC472–RC478 on that isolated target, run integration tests, tenant isolation checks, privacy checks, financial reconciliation and application smoke tests.
6. Only after these gates pass, schedule the coordinated Production migration plus Edge Function deployment.

No Production schema, data, Auth, RLS, GRANT, Edge Function, payment, wallet or settlement mutation was performed.

## 4. Next execution items

- Close the CI path-filter gap in `.github/workflows/mantigo-platform-admin-scope.yml` so exact SECURITY DEFINER ACL/search_path validators run on pushes to main as well as pull requests.
- Complete the current main post-merge frontend E2E and Pages deployment verification.
- Keep native Android integration separate until a complete, origin-safe project is available.
- Continue the owner-operated Free-plan backup and restore gate; do not claim disaster recovery from a runbook or health monitor alone.
