# Pass 43 — RC467 commission scope hardening candidate

**Date:** 2026-11-15  
**Source integration head:** `911881ee2de51c5f68ee0a1a3b571b76f37b0a5f`  
**Combined candidate:** [PR #730](https://github.com/islamnagy2022-eng/MantiqatiX/pull/730) — Draft  
**Production status:** unchanged; `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`

## Live evidence (read-only)

- Production Supabase remains healthy; migration ledger is still 310 entries through `20261110150618`. RC464–RC467 are not applied.
- `public.commission_rules` contained **0 rows** and `public.commission_rule_audit` contained **0 rows** at inspection. Therefore no existing commission rows or audit history were disclosed or changed in this review.
- The live `mnty_commission_rule_drafts`, `preview_commission_rule_draft`, `preview_commission_rule_resolution`, and `preview_commission_backend` SECURITY DEFINER functions were callable by `authenticated` and denied to `anon`.
- The first three RPCs trusted an active tenant membership with OWNER/BUSINESS_OWNER/ADMIN/MANAGER role without checking whether that membership was business- or branch-scoped. Live membership counts showed **11** active scoped owner/business-owner memberships across **5** users (7 business-scoped BUSINESS_OWNER, 2 branch-scoped BUSINESS_OWNER, 2 business-scoped OWNER). This is an authorization contract mismatch with the global commission manager in the platform Super Admin workspace, not evidence that a user successfully accessed a row.
- `preview_commission_backend` delegated to `assert_financial_membership`, whose live implementation selected an active finance-capable role in the tenant but did not compare its business/branch scope to `p_business_id`. The preview RPC has no `branch_id` argument, so a branch-scoped membership cannot be safely evaluated by that API.
- No production RPC was invoked to test unauthorized access. No sensitive membership or registry row values were exported.

## RC467 candidate

Added `supabase/migrations/20261115010000_rc467_commission_scope_hardening.sql` after RC464–RC466:

1. `mnty_commission_rule_drafts` LIST/SAVE/DELETE/AUDIT and both draft-preview RPCs now rely only on the canonical `public.mnty_can_platform_admin()` guard backed by `private.platform_admins`. Tenant/business/branch membership alone is not platform-root authority.
2. `preview_commission_backend` now accepts the canonical platform root, tenant-wide finance membership, or finance membership for the exact requested business with `branch_id IS NULL`. It rejects anonymous JWT sessions, cross-business requests, and branch-scoped actors when the API supplies no branch identifier.
3. The preview function uses an empty `search_path` and schema-qualified table references.
4. Existing PUBLIC/anon revocations and authenticated EXECUTE grants are explicitly preserved.
5. Added `supabase/tests/rc467_commission_scope_integration.sql` for root-admin positive access; business/branch/tenant-owner denials; exact-business and tenant-wide finance positives; cross-business, branch-finance, anonymous and ACL negative cases. The test is transaction-wrapped and ends with ROLLBACK.
6. Added `scripts/validate-rc467-commission-scope.mjs` and connected static validation plus behavioral SQL execution to the disposable forward-migration replay workflow.
7. Updated existing RC455/RC456 integration fixtures to seed the canonical private registry during the test transaction and to expect the strict platform denial code. This is required after RC464 changes the authority source; it does not seed Production.

## CI status — exact-head result

- Updated exact candidate head: `911881ee2de51c5f68ee0a1a3b571b76f37b0a5f`.
- Forward migration replay run **43664038104: SUCCESS**. The disposable local Supabase instance restored the schema-only checkpoint at `20261008222845` and replayed **80** later migrations in timestamp order, including RC464, RC465, RC466 and RC467. The instance was stopped after validation.
- RC467 static authorization validator: **PASS**.
- RC455 commission draft preview integration: **PASS** after the fixture was updated to insert the synthetic test actor into `private.platform_admins`.
- RC456 commission resolution preview integration: **PASS** after the same canonical-root fixture adjustment.
- RC467 commission scope integration: **PASS** — platform-root positive access; business/branch/tenant-owner denial; exact-business and tenant-wide finance positive cases; cross-business, branch-finance and anonymous denials; and EXECUTE ACL checks.
- The same forward replay also passed owner-profile persistence and two-tenant isolation checks.
- **18/18 returned workflow runs** for the exact head completed successfully (14 pull-request runs and 4 push runs), including RC464, RC465, RC466, RC425, migration history immutability, collision guard, backend-only, MantiGO privacy, module professionalization and approval-audit workflows.
- Pages workflow validation passed. `validate_public_only` and `deploy` were **SKIPPED** for the pull-request event; no website deployment occurred.
- Important qualification: the CI replay baseline manifest is still `PENDING_REVIEW` and represents a schema-only checkpoint through `20261008222845` (283 historical entries), not a current Production backup. The 80-migration forward replay is strong candidate compatibility evidence, but it is not a current Production backup/restore or RPO/RTO rehearsal.
- Live Production was rechecked after the run: Supabase remains healthy with **310** ledger entries through `20261110150618`; RC464–RC467 remain unapplied; commission rules and commission audit tables remain empty. No Production mutation occurred.
- PR #730 remains Draft and unmerged. The release gate remains BLOCKED / NOT CERTIFIED pending human SQL review, current-schema backup/restore and rollback evidence, and authorized release approval.

## Safety and remaining work

- All changes remain in a Draft PR. No merge to `main`, Pages deployment, Production migration, Auth/RLS/GRANT change, Edge deployment, payment, settlement or user-data mutation occurred.
- No paid resources or Staging environment were created. Validation uses a disposable local Supabase instance in GitHub Actions.
- Next: complete the exact-head forward replay; correct any migration or behavioral failures; rerun all affected workflow suites; then require human SQL review and current Production backup/restore and rollback evidence.
- Release remains BLOCKED / NOT CERTIFIED.
