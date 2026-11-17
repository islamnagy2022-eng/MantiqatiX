# Pass 301–320 — Post-merge production parity and directory privacy audit

Date: 2026-11-18
Main commit: `ae090081015b0c3af410fb6ee114165f300b1bba`
PR: #757 — merged
Scope: post-merge GitHub/Pages verification and read-only Supabase Production parity/privacy review.

## Main and website release evidence

- PR #757 merged to `main` as `ae090081015b0c3af410fb6ee114165f300b1bba`.
- Main-commit checks passed: directory claim atomicity, forward migration replay from the captured production checkpoint, migration-version uniqueness, primary catalog frontend validation, cross-module boundary validations, production health monitor and the remaining applicable checks.
- GitHub Pages deployment completed successfully. The workflow verified the V6 public root, legacy catalog at `/legacy/`, and V6 preview alias at `/v6-preview/`; deployed-origin Playwright route checks completed successfully.
- The Pages deployment publishes the existing canonical V6 root and preserves the legacy catalog rollback path. No new UI redesign was introduced in this pass.

## Supabase Production parity — read-only

Project: `MANTIQATIX FINAL` (`moyhiluyhjsujhwlyeuu`), status `ACTIVE_HEALTHY`, PostgreSQL 17.

- Production migration ledger remains at `20261110150618` (310 migration rows); RC472 migration `20261118010000` is not applied.
- Live Edge Function `directory-listings` remains version 16. Its deployed source does not contain `review_directory_listing_claim_atomic`; therefore the transactional claim change is merged in GitHub but not active in Production.
- Live membership preflight: 10 business-wide rows with `branch_id IS NULL`; 9 use JSON object permissions and 1 legacy OWNER row uses the array `["*"]`. There are zero duplicate normalized `(user_id,business_id,coalesce(branch_id,''))` groups and zero empty-string branch IDs.
- RC472 intentionally converts that legacy wildcard grant to the explicit owner capability set when it reuses the existing claimant membership. This is least-privilege normalization, but the regression test must explicitly cover the conversion before Production rollout.
- No Production database mutation, migration, grant/RLS/Auth change, Edge deployment, payment or settlement action occurred.

## National directory public-contact disclosure finding

Read-only aggregates from `public.public_directory_listings`:

- 964 total rows: 869 published, 1 published claim-pending, 0 claimed, 964 unclaimed.
- 868 published/unclaimed rows contain a phone and 868 contain an address.
- Breakdown of published/unclaimed rows: 567 doctors, 228 businesses, 48 pharmacies, 10 laboratories, 7 clinics, 7 medical centers and 1 hospital.
- 497 of the 567 unclaimed doctor entries carry the source label `Dalil140 — دليل عام غير رسمي`; additional records have source labels explicitly indicating public-directory or confirmation-needed provenance.
- `directory_source_permission_evidence` currently contains 0 rows. No source-permission evidence can therefore be linked to the existing public-contact set through that registry.
- The public Edge Function selects and serializes phone, secondary phone and address for PUBLISHED rows, independent of CLAIMED/UNCLAIMED status. The sanitizer's current allowlist preserves those fields.
- The claim, listing and source-evidence tables have RLS enabled and no direct client policies; the service-role Edge Function is the public disclosure boundary.

**Disposition:** do not silently remove 868 contacts, because that would materially change the directory experience. Also do not certify republication rights merely from a source label. A specific contact/location disclosure policy and evidence/review workflow are required before full Production certification. Keep imported/unclaimed, source-licensed and owner-consented records distinct. The UI contract should be preserved until a tested policy is approved.

## Supabase security and backup gate

- Current organization plan: Free.
- Supabase documentation states daily automated backups are available for Pro, Team and Enterprise projects; Free-tier projects should use Supabase CLI `db dump` and maintain off-site backups.
- No current backup timestamp or verified off-site restore artifact was available through the connected tools. A successful migration replay in ephemeral CI is not a Production backup.
- Security advisor snapshot (2026-11-17): 9 tables with RLS enabled and no policies (including directory claim/evidence tables, intentionally service-role-only); 65 SECURITY DEFINER functions executable by authenticated; 1 SECURITY DEFINER function executable by anon. The anonymous advertisement function uses empty search_path and returns approved active ad projection, but the full 65-function authenticated surface still needs function-by-function review. Health advisor reported no lints.
- Do not run Production RC472 DDL or replace the live Edge Function until an off-site backup and tested restore point are confirmed. Supabase's free plan does not provide the daily-backup control expected for this release.

## Required next gates

1. Pass the added regression for converting legacy `["*"]` OWNER permissions to explicit least-privilege owner permissions.
2. Decide and document public contact/address disclosure separately for imported/unclaimed listings, source-licensed data and owner-consented records; add behavior tests before changing public output.
3. Produce an off-site logical database backup using the Supabase CLI and verify it can be restored; do not assume CI migration replay is a substitute.
4. In a controlled release, apply RC472 and deploy `directory-listings` version with the RPC consumer as one coordinated operation, then run authenticated admin, rejection, approval, concurrency and public-directory smoke tests.
5. Re-run security advisor and focused function ACL/RLS audits, with no blanket privilege changes.

**Status:** GitHub source merged and website deployed. Supabase Production RC472/Edge release remains **BLOCKED / NOT CERTIFIED** pending backup, contact-disclosure policy and coordinated backend rollout.
