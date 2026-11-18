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

### Known Production/source parity gap — `preview_commission_backend(...)`

The read-only Production inspection confirms the currently deployed function is the older implementation:

- SECURITY DEFINER, executable by authenticated, not anon.
- Calls `assert_financial_membership(p_tenant_id)`, which validates `auth.uid()`, an ACTIVE membership in the supplied tenant, and a finance-capable role, but does not bind that actor to `p_business_id` or branch scope.
- The live `commission_rules` table currently has no rows. This means no commission-rule disclosure was observed; the concern is a latent authorization gap in the currently deployed version.

**Correction after source reconciliation:** this is not a newly discovered/unimplemented source defect. Main already contains the forward-only migration `supabase/migrations/20261115010000_rc467_commission_scope_hardening.sql`, its disposable behavioral test `supabase/tests/rc467_commission_scope_integration.sql`, and static validator `scripts/validate-rc467-commission-scope.mjs`. RC467 replaces the financial preview authorization path: platform-root access uses `mnty_can_platform_admin()`; tenant-wide or exact-business finance memberships may use the branch-less operational preview; branch-scoped finance memberships are explicitly denied because this RPC has no `branch_id` argument. Commission rule draft management, draft preview and resolution are restricted to canonical platform admins.

The RC467 test covers business-owner/branch-owner/tenant-owner denial for commission administration, cross-business finance preview denial, branch-finance preview denial, anonymous preview denial, and valid platform resolution preview. The existing repository continuity record states PR #742 merged the RC464–RC467 source hardening and that 14/14 exact-head workflows passed, including isolated migration replay. This is source/CI evidence, not proof of Production application.

Production still reports 310 migration ledger rows through `20261110150618`; RC467 version `20261115010000` is absent. The live `preview_commission_backend` therefore remains on the older helper path until the coordinated, approved release is performed.

### Delegation checks

- `mnty_business_employee_list` delegates to `mnty_business_employee_list_scoped`, which checks actor identity, business/tenant match, branch/business match, and business HR/platform permission.
- `mnty_can` delegates to `mnty_active_membership`, which filters memberships by `auth.uid()`, ACTIVE status and supplied tenant/business/branch scope. This delegation is not evidence of a missing actor check by itself.
- `upsert_catalog_item_and_price_backend` delegates writes to the separately guarded catalog item and price routines; retain exact branch-scope tests when reviewing the complete call chain.
- Live `mnty_can_platform_admin()` still delegates to `mnty_can('admin', null, null, null)` and retains `search_path=public, pg_temp`. RC464/RC471 source repairs remain a separate unapplied Production release item; do not claim source fixes are live.

## 3. Next exact engineering work

1. Keep RC467 as the intended source repair; do not create a duplicate migration or replace the shared `assert_financial_membership` helper.
2. Reconcile RC464–RC478 and the full ordered migration chain against the live ledger, checking each migration's preconditions and exact source identity.
3. Confirm the RC467 disposable test is still included in the current main forward-replay workflow and retain a fresh successful run after any migration-chain change.
4. Before release, verify encrypted off-site backup and an isolated restore rehearsal, then apply the reviewed migration stack in the approved order and verify the deployed function definition, grants, search_path and adversarial business/branch cases.
5. Keep Production read-only until all independent backup, migration, Edge parity and rollback gates pass.

## 4. Release gates unchanged

- Live migration ledger last verified at 310 entries through `20261110150618`; RC472–RC478 and other required release identities remain unapplied per the prior reconciliation.
- Production `directory-listings` remains v16 while main contains the consent-aware serializer and its supporting migration source.
- No encrypted off-site backup plus isolated restore rehearsal has been evidenced. No RPO/RTO proof is recorded.
- Do not deploy Edge Functions or apply migrations to Production until backup/restore, exact migration ledger, coordinated DB/Edge order and rollback checks pass.

**Disposition:** PR #795, #796 and this audit checkpoint PR #797 are MERGED. RC467 is already present and tested in main; its Production application is still pending. The live/source parity gap remains open, but no new source-level commission fix is required based on this review. Full Production release remains **BLOCKED / NOT CERTIFIED**.
