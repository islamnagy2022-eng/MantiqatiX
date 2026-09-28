# RC214 — Android Source Convergence Audit

Date: 2026-09-29

## Purpose

Establish an evidence-based boundary between the current GitHub `main` baseline and the uploaded RC40 source package before any Android merge.

## Evidence

The uploaded package `source_RC40.zip` was verified locally.

SHA-256:

`e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e`

The supplied checksum file contains the same SHA-256 value.

## RC40 Android contents

The package contains a complete Android/Gradle tree including:

- `gradlew`
- `gradle/wrapper/gradle-wrapper.jar`
- `gradle/wrapper/gradle-wrapper.properties`
- `settings.gradle.kts`
- `build.gradle.kts`
- `app/build.gradle.kts`
- `.github/workflows/ci_cd.yml`
- `app/src/main/**`

The wrapper requests Gradle 9.3.1.

The RC40 CI workflow requests JDK 21 and includes unit tests, lint, debug APK build, and release AAB build/signing through GitHub Secrets.

## Static production-gate verification

The RC40 package was re-run through its included static production checks:

- `tools/production_gate.py`: **PASS**
- `tools/verify_production_invariants.py`: **PASS**
- Authoritative pricing, payment cancellation checks, request correlation, backend catalog/settings/settlement boundaries, referral execution boundary and business approval checks: **PASS**

These are source-package static checks only. They do not prove current-main deployment, runtime E2E, Android compilation, signing, or device behavior.

## Current-main boundary

Current GitHub `main` does not contain the RC40 Android/Gradle paths. Therefore RC40 Android CI/build evidence cannot be treated as evidence for current `main`.

No blind merge was performed.

## Identity/configuration findings

RC40's Android `applicationId` is:

`com.aistudio.manteqti.platform`

The inspected RC40 Android source also contains legacy `manteqti` identifiers in notification/auth/deep-link/database names, including the custom auth scheme `manteqti://auth-callback`.

This requires an explicit identity/package/deep-link migration review before treating RC40 as the current MNTY Android source. No automatic rename was performed.

The RC40 build script rejects placeholder Supabase configuration and demo data for Release builds and keeps payment webhook secrets out of the Android client.

The Android manifest requests network, notification, and fine/coarse location permissions. Location permission must remain operationally justified and on-demand; continuous tracking must not be introduced merely to support discovery.

## Build verification

A local Gradle execution was attempted against RC40.

Gradle 9.3.1 could not be downloaded in the current execution environment because external network access was unavailable and the distribution was not cached.

Therefore:

- Source checksum: **VERIFIED**
- Static package inspection: **VERIFIED**
- Static production gates: **PASS**
- Android build: **NOT VERIFIED**
- Unit tests: **NOT VERIFIED**
- Lint: **NOT VERIFIED**
- Release AAB: **NOT VERIFIED**
- Release signing: **NOT VERIFIED**
- Real-device regression: **NOT VERIFIED**

The build failure is an environment/network blocker, not evidence of source compilation failure.

## Decision

RC40 Android is retained as a candidate source package only.

Before merging into `main`, the following must be completed:

1. Compare RC40 Android source against the current web/backend/database contracts.
2. Resolve application identity and deep-link/package naming under MNTY/MantiqatiX.
3. Verify Supabase production configuration boundaries without committing secrets.
4. Restore Android CI on a branch and obtain a real CI build.
5. Run unit tests and lint.
6. Produce and verify a signed Release AAB.
7. Execute real-device authentication/session/network/location/push regression.
8. Only then merge the verified Android source into the production baseline.

## Release status

This audit does not close the Android release gate.

Production Go-Live remains OPEN.
