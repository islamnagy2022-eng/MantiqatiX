# Production Release Recheck — Pass 990–999 (2026-11-19)

**Canonical project:** `moyhiluyhjsujhwlyeuu` — MANTIQATIX FINAL  
**Project status:** ACTIVE_HEALTHY, PostgreSQL 17.6  
**Git main at checkpoint:** `80f0b021748a4af43dd9f4596644e64ddcc5b7e4`  
**Evidence mode:** read-only Supabase metadata, migration ledger, Advisor findings, and GitHub Actions run inspection  
**Production mutations:** NONE

## 1. Migration ledger — exact release contract recheck

- Live migration ledger: **310 rows**, latest `20261110150618` (`revoke_public_execute_from_trigger_functions`).
- Exact `REQUIRED_RELEASE_MIGRATION_VERSIONS` array in `scripts/production/live-reconciliation-contract.mjs`: **62 unique versions**.
- Live ledger matches: **0/62**.
- Missing required versions: **62/62**.
- No migration, alias ledger repair, SQL/DDL/DML, GRANT, Auth, RLS or Edge Function change was made.
- Do not use a naive comparison of every SQL filename against the live ledger: the repository intentionally retains pre-existing legacy filename collisions and the release gate is the explicit 62-version contract plus separately reviewed migration aliases.

## 2. Current Security Advisor snapshot

| Finding | Current count | Interpretation |
|---|---:|---|
| RLS enabled with no policy | 9 tables | Deny-by-default surface; verify intended service/RPC access before changing. |
| Anon-executable SECURITY DEFINER | 1 function | `get_mnty_targeted_advertisements(...)`; intentional public ad discovery candidate, preserve only with reviewed output contract. |
| Authenticated-executable SECURITY DEFINER | 65 functions | Review population, not 65 confirmed vulnerabilities. MantiGO root authorization remains the known P0. |
| Leaked-password protection disabled | 1 Auth configuration finding | Owner-operated Auth setting; not changed. |

The nine no-policy tables are:
- `business_employees`
- `business_job_positions`
- `commission_rule_audit`
- `digital_page_payment_events`
- `directory_listing_claim_requests`
- `directory_source_permission_evidence`
- `platform_custom_roles`
- `platform_role_assignments`
- `public_directory_listings`

The public ad RPC remains a reviewed public-read candidate; do not revoke it blindly because public sponsored-ad delivery depends on it.

## 3. Performance Advisor snapshot

| Finding | Current count |
|---|---:|
| Unindexed foreign keys | 132 |
| RLS initialization-plan findings | 375 |
| Unused indexes | 70 |
| Multiple permissive policies | 28 |

These are optimization/review signals. No mass index creation, index deletion or policy rewrite was performed.

## 4. Published catalog and browser verification

GitHub Actions Pages run `44450929982` for main SHA `80f0b021748a4af43dd9f4596644e64ddcc5b7e4` completed with **success**.

Verified job stages:
- Catalog/V6 build and validation: PASS.
- Public CORS, OAuth handshake, public sponsored-ad RPC and catalog smoke contracts: PASS.
- Composed Pages site deploy: PASS.
- Production root, legacy catalog rollback route and V6 preview alias verification: PASS.
- Deployed-origin Playwright checks for legacy catalog root and dashboard/mobile/QR routes: PASS.

The production root remains the catalog, the legacy catalog rollback copy remains under `/legacy/`, and the V6 preview remains under `/v6-preview/`. This is a scoped catalog deployment, not certification of the full Enterprise platform or R7 archive.

## 5. Release decision

- Scoped public catalog deployment: **DEPLOYED — workflow and deployed-origin browser verification passed**.
- Full MantiqatiX Enterprise: **BLOCKED / NOT CERTIFIED**.
- R7 uploaded archive: **BLOCKED / NOT DEPLOYABLE**.
- Primary blockers: 62 required migrations missing; MantiGO platform-admin authorization and financial report schema defects; 9 RLS/no-policy tables needing access-path review; 65 authenticated SECURITY DEFINER functions requiring per-function contract review; leaked-password protection disabled; backup/restore and payment/finance end-to-end evidence incomplete.

**No Production database, Auth, RLS, GRANT, Edge Function, payment, wallet, settlement, or business data was modified in this pass.**
