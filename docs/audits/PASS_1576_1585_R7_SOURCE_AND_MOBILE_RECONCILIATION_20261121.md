# Pass 1576–1585 — R7 archive and mobile source reconciliation

Date: 2026-11-21  
Repository baseline inspected: `main` at `3c41d49eda67564479a95c456d6987e3bac54e43`  
Uploaded source: `bizcatalog-manager (11).zip`  
Uploaded source manifest: `R7-v7.0.0`, build timestamp `2026-11-10T19:20:00Z`.

## Source-of-truth disposition

The uploaded R7 archive is a useful historical feature/design source, but it is not a drop-in replacement for the current repository. Its root uses `src/`, `server.ts`, a local JSON authoritative store and a dual-engine architecture. Current `main` uses `apps/catalog-frontend/` and Supabase as the authoritative identity/data platform. The uploaded archive predates current-main work by 11 days. Do not overwrite current main or replace its Supabase contracts with the R7 local JSON model.

The R7 manifest contains project ref `moyhiluyhjsujhwlyweuu`, which differs from the live project ref used by the current repository and read-only Production checks: `moyhiluyhjsujhwlyeuu`. Treat the archive's ref as a manifest discrepancy; never use it to configure or mutate a Supabase project.

## Mobile source found in R7

- Mobile web components exist at `src/components/mobile/MobileAppBottomNav.tsx` and `src/components/mobile/MobileSponsoredStoriesBar.tsx`.
- A minimal Android WebView source exists at `android-webview-wrapper/AndroidManifest.xml`, `android-webview-wrapper/build.gradle.kts`, and `android-webview-wrapper/src/main/java/com/mantiqatix/app/MainActivity.kt`.
- The Android wrapper hardcodes `https://mantiqatix.com/?client=android_app` and `https://mantiqatix.com/api`, while current web deployment is under GitHub Pages. It is not aligned with the current deployment origin.
- The wrapper directory does not include a Gradle settings file, root Gradle build, Gradle wrapper, referenced mipmap launcher resources, or the referenced ProGuard rules file. It is not a complete independently buildable Android project.
- Its WebView bridge enables JavaScript and exposes a native JavaScript interface; navigation handling only externalizes WhatsApp/telephone URLs and does not enforce an explicit first-party host allowlist. It must not be promoted to production without a security redesign and review.
- R7 mobile UI components import the old `src/context/AppContext` and `src/utils/rules` architecture and use old route names. They require contract adaptation before use in the current React app.

## Integration decision

1. Preserve the uploaded R7 archive as a source artifact; do not delete or overwrite it.
2. Keep current main's web/mobile responsive behavior and current backend contracts unchanged.
3. Preserve the R7 Android and mobile component sources as historical references. Do not copy the incomplete wrapper into the active application or claim Android build readiness.
4. Reconcile application ID, package identity, first-party domain, current OAuth/session handling, API contract, deep links, safe WebView navigation, permissions, build resources, signing and CI before any native Android integration.
5. Adapt useful mobile UI features to current `apps/catalog-frontend` only after verifying current component contracts and responsive E2E tests.

## Verification limits

This pass inspected archive metadata, source layout, R7 release manifest, package manifest, Android wrapper source and mobile component imports. It did not build the Android application, test on a device, deploy any source, change Supabase, or modify Production data.

**Disposition:** R7 archive preserved as a historical reference; current main remains the working code baseline; native Android is not yet integrated or release-certified.
