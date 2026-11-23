# Pass 1843–1852 — Uploaded R7 source and current-main auth reconciliation — 2026-11-23

## Source integrity and identity
- [x] 1843 — Recomputed uploaded `bizcatalog-manager (11).zip` SHA-256: `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`; matches the previously reviewed R7 archive artifact.
- [x] 1844 — Recomputed uploaded `الامر-التقني.txt` SHA-256: `b51078e5aa164067c46347fd327c7230c5968f3cd36df5a354691504a3364ee2`; reopened the full directive and confirmed it supersedes old continuity notes and requires source reconciliation, P0 security-first execution, tests, least-privilege, and no false completion claims.
- [x] 1845 — ZIP integrity extraction succeeded. Archive contains 270 ZIP entries, 233 extracted files, 15 test files, one Supabase migration, and three Android wrapper files.
- [x] 1846 — Confirmed R7 manifest points at Supabase ref `moyhiluyhjsujhwlyweuu`, while the connected live Production project is `moyhiluyhjsujhwlyeuu`. This is a project-reference mismatch; do not connect/deploy the R7 archive using its manifest.
- [x] 1847 — Reconfirmed archive is not an admissible production source: local JSON is described as authoritative; `server.ts` has hard-coded fallback session/Paymob/backup secrets and insecure auth/state/wallet paths documented in the prior R7 review; `src/lib/supabaseClient.ts` selects a service-role key in a client-imported module. No claim is made that any placeholder key string is a valid live credential.
- [x] 1848 — Reconfirmed R7 frontend includes fixed demo credentials, client-held admin password, immediate local role assignment before backend result, and prefilled demo login paths. Do not ship or wholesale merge these files.
- [x] 1849 — Reconfirmed R7 Android wrapper is incomplete: no Gradle wrapper or root settings file; WebView bridge/origin restrictions and backup policy require remediation before signed reproducible APK/AAB.
- [x] 1850 — Compared current main auth source at head `3c24d840f279e0e2f5c0b66302a2ee12ddedab9c`: current LoginModal uses Google OAuth only; `loginAsAdmin` delegates to `loginWithGoogle()`; subscriber sign-in uses Supabase Auth; frontend bootstrap derives ordinary access from ACTIVE `user_memberships`; no localStorage auth-session persistence was found in current `AppContext.tsx`. Current main uses runtime Supabase URL/key and Edge Functions, not the R7 client module's service-role-key selection.
- [x] 1851 — Identified the remaining current-main platform-root dependency: `bootstrapProductionUser` calls `mnty_can_platform_admin`; live inspection already confirmed this helper delegates to the membership-based `mnty_can('admin', NULL, NULL, NULL)`. Current frontend auth improvements therefore do not close the P0 platform-admin registry gap.
- [x] 1852 — Confirmed the current Google auth contract validator explicitly rejects local admin credential entry and verifies Google identity vs membership-gated role projection. This is source-contract evidence only; no new CI pass is claimed.

## Current decision
- Preserve the uploaded R7 archive as an immutable visual/feature reference only. Do not deploy, wholesale merge, or use its manifest to connect to Production.
- Port only selected UI/feature work into the current catalog frontend against Supabase Auth, current membership/tenant/branch authorization and existing Edge contracts.
- Keep the platform-admin repair blocked until the registry-backed source of truth and all 57 policy consumers are migrated/tested together.
- No Production mutation, migration, Auth/RLS/GRANT change, Storage operation, Edge deployment, payment, wallet, settlement or website deployment occurred in this pass.
- Full Production remains **BLOCKED / NOT CERTIFIED**.

## Evidence
- Prior detailed R7 review: `docs/audits/R7_ARCHIVE_11_SECURITY_REVIEW_20261119.md`.
- Prior R7 revalidation: `docs/audits/R7_ARCHIVE_SECURITY_REVALIDATION_20261119.md`.
- Current-main auth source: `apps/catalog-frontend/src/context/AppContext.tsx`, `apps/catalog-frontend/src/lib/production.ts`, `apps/catalog-frontend/src/components/auth/LoginModal.tsx`.
- Current auth contract validator: `scripts/validate-catalog-google-auth-contract.mjs`.
