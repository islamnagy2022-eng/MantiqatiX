# Pass 321–340 — Deployed directory specialty pagination and launch gate

Date: 2026-11-18
Main commit: `18711d016a591613791e9596740b367eecb96865`
PR #760: merged

## Test failure and correction
- The browser test previously counted a stale activity-category page before the new specialty-filtered API request completed.
- The numeric fixture matcher was also overescaped.
- The test now registers `page.waitForResponse` before specialty selection, matches the exact category and specialty filters, requires HTTP 200, then asserts 20 rows.
- Numeric fixture matchers now use `[0-9]{2}`.
- The PR modified only `apps/catalog-frontend/tests/professional-dashboard.browser.e2e.mjs`; no runtime UI code changed.

## Verified main release
- PR #760 merged to main as `18711d016a591613791e9596740b367eecb96865`.
- Primary Catalog Frontend Validation run `44205131829`: PASS, including TypeScript/build, employee RBAC PostgreSQL tests and local Playwright E2E.
- Pages deployment run `44205131869`: PASS.
- GitHub Pages composed artifact deployed. V6 root, legacy rollback path `/legacy/`, and V6 Preview alias `/v6-preview/` passed.
- Deployed-origin browser checks for legacy root, dashboard/mobile/QR routes passed.
- Module Professionalization, Backend-only Module Boundary, RC425 Paymob atomicity, MantiGO Open Ride Privacy and Flexible Commission Drafts checks passed.

## Supabase Production — unchanged
- Migration history remains through `20261110150618`; RC464/RC472 are not applied.
- Live `directory-listings` Edge Function remains version 16 and lacks `review_directory_listing_claim_atomic`.
- Live `mnty_can_platform_admin()` still allows a business-scoped OWNER to evaluate as platform admin in the read-only JWT simulation. RC464 remediation exists in main but is not deployed.
- Supabase organization is on Free plan; no verified off-site backup/restore artifact is available.
- 868 published/unclaimed national-directory records expose phone/address; source-permission evidence table is empty. No contact values were extracted.
- No Production migration, data/Auth/RLS/GRANT write, Edge deployment, payment or settlement action occurred.

## Next release gates
1. Export a Supabase logical backup with `supabase db dump`, secure it off-site with restrictive permissions and checksums, then prove restore to a disposable environment. Never commit dump files.
2. Release RC464 only after backup/restore proof; verify platform admin succeeds and business OWNER/ordinary authenticated user is denied on sensitive admin operations.
3. Release RC472 and `directory-listings` Edge Function as a coordinated deployment; test approval, rejection, rollback, concurrency and public/admin smoke paths.
4. Decide and test contact/address/map visibility for imported/unclaimed, source-licensed and owner-consented records.
5. Review SECURITY DEFINER functions individually for authorization, search_path and grants; rerun Supabase advisors.

**Status:** website release verified and deployed. Full Production backend remains **BLOCKED / NOT CERTIFIED**.
