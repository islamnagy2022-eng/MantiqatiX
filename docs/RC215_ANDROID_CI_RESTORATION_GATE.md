# RC215 — Android CI Restoration Gate

Date: 2026-09-29

## Objective

Create an isolated CI restoration gate for the verified RC40 Android candidate without merging Android application code into the current main baseline.

## Safety boundary

This change must not:
- merge RC40 Android code into main;
- change production Supabase configuration;
- add production secrets to source;
- rename the Android package automatically;
- claim a release build before GitHub Actions produces the artifact.

## Required CI evidence

The isolated Android CI must execute, in order:

1. JDK 21 setup.
2. Gradle wrapper validation.
3. `./gradlew test`.
4. `./gradlew lint`.
5. `./gradlew assembleDebug`.
6. Release configuration validation.
7. `./gradlew bundleRelease` using repository secrets only.
8. AAB existence, file-type and checksum evidence.
9. Signature verification for the generated AAB/APK where applicable.
10. Artifact retention for audit.

## Release blockers

The gate remains OPEN until:
- the Android source is present on the CI branch;
- the wrapper can resolve Gradle 9.3.1;
- tests and lint pass;
- debug build succeeds;
- release AAB succeeds;
- signing is verified without exposing secrets;
- MNTY identity/deep-link migration is reviewed;
- device regression is completed.

## Current status

This document is a release gate specification only. It is not evidence of a successful Android build.

Production Go-Live remains OPEN.
