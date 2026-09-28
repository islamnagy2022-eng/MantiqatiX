# RC201 — Release / CI / Source Package Audit

## Status
- Source-package static production gate: **PASS**
- Source-package production invariant checks: **PASS**
- Source-package secret scan: **PASS**
- Current GitHub `main` CI/build convergence: **NOT VERIFIED**
- Production browser smoke: **NOT VERIFIED**
- Android release build/signing from current `main`: **NOT VERIFIED**

## Evidence

### RC40 source package
The uploaded `source_RC40.zip` was extracted and inspected.

Executed:
- `python3 tools/production_gate.py` → **PASS**
- `python3 tools/verify_production_invariants.py` → **PASS**

The production gate verified, among other checks:
- SettlementEngine routes through `settlement-financial-atomic`.
- Legacy `settlement-create` is not used by SettlementEngine.
- Atomic settlement has visible authentication/anonymous guards.
- Required settlement migration exists.
- No private-key or JWT-shaped credential material was detected by the built-in gate.

The production invariant script verified:
- authoritative payment pricing fields;
- cancelled-order rejection;
- request correlation;
- catalog settings backend RPC boundary;
- webhook request correlation/failure event path;
- financial anonymous boundary;
- business approval server wiring;
- settlement backend RPC;
- referral direct-execute revocation.

A separate source-package scan found no private-key blocks, live API-key patterns, or JWT credential material. Environment examples contain placeholders only.

## CI finding

The RC40 source package contains:
`.github/workflows/ci_cd.yml`
with:
- JDK 21 setup;
- unit tests;
- debug lint;
- debug APK build;
- release AAB build;
- keystore supplied through GitHub Secrets;
- release artifact upload.

However, the current GitHub `main` branch was checked independently and the following Android/CI paths were not present at the expected paths:
- `.github/workflows/ci_cd.yml`
- `gradlew`
- `build.gradle.kts`
- `app/build.gradle.kts`
- `settings.gradle.kts`

Therefore the RC40 CI file must **not** be assumed to be the CI of the current production source.

## Production implication

This audit closes only the static verification that was actually executed against the uploaded RC40 package. It does **not** certify that package as the current production release artifact.

The release gate remains open until current `main` has:
1. a verified build/test pipeline;
2. a reproducible release build;
3. protected signing;
4. browser production smoke;
5. Android/device regression;
6. rollback evidence.

## Security Advisor

Production Security Advisor remains open. The following were observed:
- 7 RLS-enabled tables without client policies; direct anon/authenticated table grants were not found in the verified grant inspection.
- `create_payment_intent_backend` is SECURITY DEFINER and executable by authenticated users; this is currently intentional because the payment Edge Function delegates to it, and its own authorization checks were verified.
- `find_mnty_nearby_provider_businesses` is SECURITY DEFINER and executable by anon/authenticated; its current contract returns only active-provider business IDs and distances with a radius capped at 10 km. This remains a documented security-advisor exception requiring explicit review rather than an automatic broad-policy change.
- Leaked-password protection remains a managed Auth setting and is not verified enabled.

No broad RLS policies were added merely to silence Advisor warnings.

## Source / production distinction

This document deliberately keeps:
- uploaded RC40 static evidence,
- current GitHub `main` evidence,
- and live Supabase production evidence

as separate evidence sets. No convergence claim is made without matching hashes/source.

## Current release truth

- RC198: **VERIFIED/CLOSED**
- RC199: **BLOCKED** on real provider/business/catalog/price fixture for booking E2E
- RC200: **OPEN**; authorization/idempotency verified, real payment/refund not verified
- RC201: **OPEN**; static source-package checks pass, current-main CI/release convergence and browser/device smoke remain unverified


## Build attempt — 2026-09-28

A local build attempt was made against the uploaded RC40 package:

`./gradlew test lintDebug assembleDebug --no-daemon`

Result: **NOT VERIFIED / BLOCKED BY EXECUTION ENVIRONMENT**.

The Gradle wrapper requires Gradle 9.3.1 from `services.gradle.org`, but the execution environment has no external network access and no cached Gradle distribution. The failure was a network resolution error (`UnknownHostException: services.gradle.org`), not a compiler/test failure.

Therefore:
- no claim of Android compilation success is made;
- no claim of unit-test success is made;
- no release APK/AAB was generated;
- release signing was not exercised.

RC40 static gates remain PASS, but executable build evidence remains OPEN.
