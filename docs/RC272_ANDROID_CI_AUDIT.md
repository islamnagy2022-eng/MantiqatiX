# MNTY RC272 — Android / CI / Mutation Audit
Date: 2026-10-03
Branch: main
Audited repository: islamnagy2022-eng/MantiqatiX

## Findings

### Current main source tree
The current main root contains:
- .github
- README.md
- TODO_PRODUCTION.md
- build
- docs
- index.html
- package.json
- scripts
- supabase
- web

There is no current-main `android/`, `app/`, `settings.gradle.kts`, `build.gradle.kts`, or `gradlew` path at the repository root. Therefore Android cannot be certified from current main.

### RC40 archive provenance
The supplied `source_RC40.zip` contains a complete Android Gradle project:
- gradlew / gradlew.bat
- settings.gradle.kts
- build.gradle.kts
- app/build.gradle.kts
- app/src
- Android tests

The archive is historical RC40 material and must not be copied into main without reconciliation against current web/backend contracts.

### Android release safety
The RC40 Android build script fails closed for Release if:
- ALLOW_DEMO_DATA is enabled
- SUPABASE_URL is missing/mock
- SUPABASE_ANON_KEY is missing/mock
- release keystore credentials are absent

The RC40 CI workflow has JDK 21, unit tests, lint, debug build, and a release AAB path using protected GitHub secrets.

### Local build attempt
Command:
./gradlew assembleRelease --no-daemon --stacktrace

Result:
BLOCKED BEFORE COMPILATION because Gradle wrapper attempted to download Gradle 9.3.1 and the execution environment has no outbound network/DNS access to services.gradle.org.

This is NOT evidence of a code build failure.

### Browser mutation guard
Current main Pages workflow contains explicit regression guards preventing direct browser insert/update/delete operations on:
- orders
- payment_intents
- user_memberships
- notifications
- marketing_projects
- advertisements

It also explicitly requires server-side invocation for marketing lead creation and runs:
- validate-production-security
- validate-auth-flow
- validate-finance-boundaries
- validate-digital-pages-boundaries
- validate-booking-payment-flow
- validate-release-preflight
- validate-rbac-contract
- validate-rbac-workspace
- validate-admin-workspace
- validate-android-parity-catalog

### CI association
Current Pages workflow has a successful verified run for the pre-RC271 commit:
aef43cefa95ff977f9570f112a9a1ecb1d5f2953
run 37113121948
conclusion: success

The RC271 documentation commit was created after that run; no successful run for the new RC271 commit has been observed yet.

## Gate updates

Android Build: BLOCKED — current main has no Android project; RC40 archive build blocked by unavailable Gradle download.
Android Signing: NOT VERIFIED — protected keystore is external.
Browser Mutation Boundaries: VERIFIED — current main Pages workflow contains explicit guards.
CI/CD: PARTIALLY VERIFIED — current deployed workflow has extensive validation and a successful prior run, but RC271 commit itself requires its own successful run.
Release Artifact: PARTIALLY VERIFIED — web deployment path exists; Android release artifact is absent/unverified.

## Safe next action
Do not copy RC40 Android into main blindly.
First reconcile Android source/API contracts against current main, then build in a network-enabled CI/Android environment using protected release secrets.
