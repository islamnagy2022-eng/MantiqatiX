# PASS 701–720 — Merge reconciliation and financial SECURITY DEFINER scope audit

**Date:** 2026-11-18  
**Base main before this audit:** `8f667002b44726b8972d2cf6a73c4aea0b9f6d04`  
**Production release:** **BLOCKED / NOT CERTIFIED**.

## 1. Completed source integration

- PR #795 merged as `106ff9d65cf1c9c024e7a1cc7a07fa2358828de0`.
  - Fixes public directory address-consent pagination beyond the first 1,000 rows.
  - Uses ordered range pagination and fails closed on query errors or malformed pages.
  - Exact-head CI passed: directory consent workflow, catalog build/typecheck, employee/RBAC PostgreSQL fixture, professional dashboard Browser E2E, MantiGO privacy, Paymob atomicity, doctor import, backend boundary, module validation and PR deployment validation.
  - Browser E2E jobs, build/typecheck and PostgreSQL jobs were inspected individually and all completed successfully.
- PR #796 merged as `8f667002b44726b8972d2cf6a73c4aea0b9f6d04`.
  - Preserves the uploaded operating directive in `docs/MASTER_SOURCE_OF_TRUTH.md`.
  - Records R7 archive mismatches and keeps R7 as UI/mobile/feature reference, not a backend/schema replacement.
  - Exact-head migration/security/module/deploy validation workflows completed successfully.
- Neither merge itself applies Supabase migrations or deploys Edge Functions. Main post-merge deployment verification is tracked separately and must not be inferred from PR validation.

## 2. Read-only Production authorization review

Project: `moyhiluyhjsujhwlyeuu`. No SQL, Auth, RLS, GRANT, Edge, payment, wallet or settlement mutation was performed.

### Confirmed scope gap — `preview_commission_backend(...)`

Live function behavior:

- SECURITY DEFINER, executable by authenticated, not anon.
- Calls `assert_financial_membership(p_tenant_id)`.
- The helper validates `auth.uid()`, an ACTIVE membership in the supplied tenant, and a broad financial role. It does **not** validate `p_business_id`, business membership scope, or branch scope.
- The preview function then selects commission rules by tenant and caller-supplied business/module IDs.
- Live membership aggregates include 7 active business-scoped BUSINESS_OWNER rows and 2 active branch-scoped BUSINESS_OWNER rows.
- The live `commission_rules` table currently has no rows. Therefore this is a verified authorization-boundary defect with latent exposure, not evidence that commission data was disclosed.

Do not fix this by broadening or replacing `assert_financial_membership` without review: the helper is called by nine financial routines, including commission creation, payment obligations, settlement, wallet transactions, journal posting, commission preview, cash commission, refunds and commission-rule resolution.

### Delegation checks

- `mnty_business_employee_list` delegates to `mnty_business_employee_list_scoped`, which checks actor identity, business/tenant match, branch/business match, and business HR/platform permission.
- `mnty_can` delegates to `mnty_active_membership`, which filters memberships by `auth.uid()`, ACTIVE status and supplied tenant/business/branch scope. This delegation is not evidence of a missing actor check by itself.
- `upsert_catalog_item_and_price_backend` delegates writes to the separately guarded catalog item and price routines; retain exact branch-scope tests when reviewing the complete call chain.
- Live `mnty_can_platform_admin()` still delegates to `mnty_can('admin', null, null, null)` and retains `search_path=public, pg_temp`. RC464/RC471 source repairs remain a separate unapplied Production release item; do not claim source fixes are live.

## 3. Next exact engineering work

1. Trace all nine `assert_financial_membership` callers and record each function's business/branch parameters, intended role set, and write/read impact.
2. Define a compatibility-safe scope contract for business-specific and tenant-wide financial operations. Branch-scoped actors must not gain tenant-wide access where the RPC has no branch context.
3. Add a disposable PostgreSQL regression reproducing a business-A finance member attempting to preview business-B rules, plus valid tenant-wide and same-business cases.
4. Prefer a narrow forward migration for the affected RPC or an explicit new scoped helper; do not silently change the shared helper until all nine callers are covered.
5. Run exact-head PostgreSQL, migration-chain replay, static authorization contracts and CI. Keep Production untouched pending the independent backup/restore gate.

## 4. Release gates unchanged

- Live migration ledger last verified at 310 entries through `20261110150618`; RC472–RC478 and other required release identities remain unapplied per the prior reconciliation.
- Production `directory-listings` remains v16 while main contains the consent-aware serializer and its supporting migration source.
- No encrypted off-site backup plus isolated restore rehearsal has been evidenced. No RPO/RTO proof is recorded.
- Do not deploy Edge Functions or apply migrations to Production until backup/restore, exact migration ledger, coordinated DB/Edge order and rollback checks pass.

**Disposition:** PR #795 and #796 are MERGED. Financial scope audit is OPEN with one confirmed latent business-scope defect. Full Production release remains **BLOCKED / NOT CERTIFIED**.
