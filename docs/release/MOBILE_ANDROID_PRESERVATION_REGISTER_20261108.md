# Mobile Web and Native Android Preservation Register — 2026-11-08

## Scope distinction

MantiqatiX has two separate mobile deliverables:

1. **Mobile web UI** — responsive web routes/components within the selected BizCatalog Manager R6 source. The uploaded R6 audit reports these under `src/components/mobile/`. Preserve them as part of the canonical R6 source tree and test mobile viewport, navigation, PWA behavior and responsive layouts independently.
2. **Native Android/Kotlin application** — a separate Gradle project. It is not included in the R6 archive according to the R6 audit and is not present at the root of current `main`.

## Evidence

- `docs/RC272_ANDROID_CI_AUDIT.md` states current `main` has no `android/`, `app/`, `settings.gradle.kts`, `build.gradle.kts` or `gradlew` root path.
- The same audit records that historical `source_RC40.zip` contained a Gradle Android project (wrapper, settings/build scripts, app module and Android tests), but that source was historical and must not be copied into current main without reconciliation.
- `docs/RC201_RELEASE_CI_SOURCE_AUDIT.md` independently records that the Android files from RC40 were absent at their expected locations in current main and that no current-main Android release build/signing was verified.

## Preservation rules

- Do not remove or replace R6's `src/components/mobile/` during import.
- Do not represent responsive mobile web pages as a native Android app.
- Do not claim the native Android project is currently integrated into `main`.
- Keep separately held Android source intact. Reconcile its package identity, application ID, authentication/session behavior, API contracts, environment configuration, signing and release workflow before importing any native project.
- Never copy an old Android project wholesale or overwrite the current web application.
- No Android release can be certified until the exact current source compiles, unit/lint tests pass, signing is exercised with protected credentials and device/emulator smoke tests pass.

## R7 archive reconciliation — 2026-11-21

The newly uploaded `bizcatalog-manager (11).zip` is an R7 snapshot dated 2026-11-10. It contains two mobile web components and a minimal Android WebView wrapper. The Android source is incomplete and hardcodes the legacy `mantiqatix.com` origin/API; current deployment and app contracts differ. Its JavaScript bridge and navigation behavior require a security redesign before use. The R7 UI components depend on the older `src/context/AppContext` and `src/utils/rules` tree and are not directly compatible with current `apps/catalog-frontend`.

The R7 manifest also contains a Supabase project-ref discrepancy (`moyhiluyhjsujhwlyweuu`) against the live project used by current main and verified read-only checks (`moyhiluyhjsujhwlyeuu`). Do not use the archive value for configuration or project selection.

Evidence: `docs/audits/PASS_1576_1585_R7_SOURCE_AND_MOBILE_RECONCILIATION_20261121.md`.

## Current status

| Deliverable | Status |
|---|---|
| Current-main responsive web/mobile behavior | Preserved; must continue mobile viewport regression |
| R7 mobile web source | Preserved in uploaded archive; historical reference, requires contract adaptation |
| R7 native Android wrapper | Source found, incomplete and legacy-origin-bound; not integrated / not buildable as supplied |
| Historical RC40 Android project | Reported in archived source; not integrated / not certified |
| Android release signing | Not verified |
| Android device regression | Not verified |

This register is documentation of the verified preservation boundary, not an implementation or release approval.
