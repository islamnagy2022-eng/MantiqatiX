# Pass 868–875 — Production security-advisor and R7 archive correction

**Date:** 2026-11-19  
**Environment:** Supabase Production read-only; GitHub source-only documentation branch  
**Project:** `moyhiluyhjsujhwlyeuu`  
**Production mutations:** NONE

## Verified findings

### 1. Fresh Supabase Security Advisor snapshot

A fresh read-only Security Advisor call observed these counts:

| Finding | Count | Interpretation |
|---|---:|---|
| RLS enabled, no policy | 9 | INFO; not by itself proof of public exposure |
| Anon can execute SECURITY DEFINER | 1 | One public discovery RPC, reviewed below |
| Authenticated can execute SECURITY DEFINER | 65 | Requires per-function contract review; not 65 confirmed vulnerabilities |
| Anonymous-access policy warnings | 90 | Advisor warning records; not assumed to equal 90 unique exposed tables or policies |
| Leaked-password protection disabled | 1 | Auth project setting remains a release hardening item |

No bulk grant revocation, policy insertion, or Auth setting mutation was performed.

### 2. The single anonymous SECURITY DEFINER RPC

The only current anonymous-executable function reported is:

`public.get_mnty_targeted_advertisements(character varying, character varying, character varying, double precision, double precision, character varying, integer)`

Read-only definition review confirmed:

- `SECURITY DEFINER`, owner `postgres`, and empty `search_path`.
- Reads approved, active advertisements whose start/end windows are valid, plus approved active platform-global ads.
- Returns only ad presentation/targeting fields: identifier, title, creative URL, target URL, ad-space identifier, match level, and distance.
- Geographic matching uses the supplied country/governorate/center/location inputs.
- Result limit is clamped to 1–50, defaulting to 3.
- The current source migration `20261027223523_rc451_targeted_ads_search_path_forward_repair.sql` preserves the intentional anon/authenticated discovery boundary and validates schema-qualified references.

**Disposition:** this is an intentional public-ad discovery contract on the evidence inspected, not a reason to revoke all anonymous RPC access. Keep its output/limit/ACL regression coverage. A separate deployed-origin runtime smoke test remains useful; no live function was changed.

### 3. Nine RLS-enabled tables without policies

A direct `pg_catalog` / effective-privilege query verified these nine public tables have RLS enabled and no policy rows:

- `business_employees`
- `business_job_positions`
- `commission_rule_audit`
- `digital_page_payment_events`
- `directory_listing_claim_requests`
- `directory_source_permission_evidence`
- `platform_custom_roles`
- `platform_role_assignments`
- `public_directory_listings`

For every one of these tables, `anon` and `authenticated` have no direct SELECT, INSERT, UPDATE, or DELETE privilege. Eight tables have FORCE RLS enabled; `digital_page_payment_events` is the exception. Direct CRUD privileges for `service_role` exist on only three of the nine tables: `directory_listing_claim_requests`, `directory_source_permission_evidence`, and `public_directory_listings`. The other six showed no direct CRUD privilege for the checked roles.

**Disposition:** retain private-by-default posture. Do not add broad policies merely to clear INFO findings. Review the non-FORCE table's trusted-server access paths separately; RLS/policy inventory alone does not replace full owner, trigger, RPC, and service-role analysis.

### 4. Anonymous policy inventory

A separate `pg_policies` query returned 21 named policy rows involving `anon` or `public`. They include explicit public SELECT policies for published catalog, geo, marketing, legal, brand, profile-media, and SMM-service content, as well as explicit deny policies on sensitive ERP, SMM, platform-admin, and idempotency tables.

The 90 Advisor warning records must not be reported as 90 unique open tables. Each policy must be evaluated by command, role, predicate, exposed columns, and underlying data classification. No policy or grant was changed.

### 5. Canonical platform-admin registry and live helper drift

The private registry itself is protected in Production:

- `private.platform_admins` is owned by `postgres` and has RLS enabled.
- Its policy `mnty_deny_unexposed_platform_admins` denies `anon` and `authenticated`.
- `anon` and `authenticated` have no direct SELECT or INSERT privilege; `service_role` has the registry operations required by the service boundary.

The remaining P0 defect is the *helper*, not direct client access to the registry. Live `public.mnty_can_platform_admin()` still delegates to `public.mnty_can('admin', NULL, NULL, NULL)`, whose live body evaluates broad membership permission/role rules at null scope. Five RLS policies and four SECURITY DEFINER RPC callers currently depend on this helper.

The source migrations RC464 and RC471 already provide the registry-only replacement (`private.platform_admins.user_id = auth.uid()`), empty search_path, and authenticated-only EXECUTE; RC471 also hardens the dependent MantiGO RPCs/search paths. They remain source-only and must be released in the coordinated, preflighted DB sequence. Do not hot-edit the helper or deploy dependent Edge code independently.

### 6. Production migration and release gates

Fresh read-only ledger query: 310 rows through `20261110150618`. The current exact release manifest still requires 62 identifiers, with 0/62 recorded. This is an identity mismatch; it is not proof that all physical effects are absent. Continue object-level schema/body/ACL reconciliation. No migration ledger rows were fabricated.

Encrypted off-site backup plus isolated restore rehearsal and measured RPO/RTO remain unverified. Production release stays **BLOCKED / NOT CERTIFIED**.

### 7. Main CI visibility

The latest main documentation commit at this checkpoint is `1127d52626d6052959091bc697ceeb08a39b234b`. The available combined-status query returned no status rows, and the workflow-run wrapper returned no main-triggered runs for that commit. Therefore post-merge main CI is **not independently verified** by this connector; PR-head checks must not be represented as main CI.

### 8. R7 Android inventory correction

The exact uploaded R7 archive does contain `android-webview-wrapper/` with three files: `AndroidManifest.xml`, `build.gradle.kts`, and `MainActivity.kt`. The prior security-review statement that the directory was absent was incorrect and has been corrected in `R7_ARCHIVE_11_SECURITY_REVIEW_20261119.md` and `TODO_PRODUCTION.md`.

The three-file wrapper is still not shippable: Gradle wrapper/settings and referenced ProGuard/resources are absent; WebView navigation lacks a trusted-origin allowlist while a JavaScript bridge is enabled; manifest sets `allowBackup=true`; and no signed reproducible APK/AAB was verified. Preserve it; do not ship yet.

## Change boundary

- Updated only GitHub documentation on branch `docs/r7-android-security-audit-correction-20261119`.
- No Production SQL, DDL, DML, grants, RLS policies, Auth settings, Edge Functions, payments, wallet, settlement, or customer data changed.
- No app source, catalog UI, Android files, or website deployment changed.

## Next actions

1. Continue per-function review of authenticated-executable SECURITY DEFINER functions, prioritizing platform/admin, financial, payment, wallet, and user-data operations.
2. Reconcile and preflight the ordered RC464/RC471 and dependent migrations against physical Production schema.
3. Obtain encrypted off-site backup and complete isolated restore/RPO/RTO evidence before Production release.
4. Review `digital_page_payment_events` FORCE RLS posture and every service-role access path without widening grants.
5. Obtain owner-controlled confirmation and enablement evidence for leaked-password protection in Supabase Auth settings.
6. Keep Production read-only until coordinated rollout gates, rollback, and post-deploy adversarial tests are satisfied.
