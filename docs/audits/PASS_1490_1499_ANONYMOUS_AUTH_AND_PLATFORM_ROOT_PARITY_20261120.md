# PASS 1490–1499 — anonymous Auth security and platform-root source/live parity — 2026-11-20

## Scope and evidence

Read-only inspection of canonical GitHub `main`, open security PRs #946–#948 and #940, GitHub Actions exact-head checks, and the connected Live Supabase project `moyhiluyhjsujhwlyeuu`.

No Production SQL, migration, RLS, GRANT, Storage, Edge deployment, payment, Auth, or customer-data mutation was performed.

## Findings

### 1. RC488–RC492 anonymous Auth guards need fail-closed JWT handling

PR #946 adds restrictive policies for Storage, finance, medical appointments, support tickets and InDrive writes. Its current predicate is:

```sql
coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
```

If the claim is absent/NULL, this evaluates TRUE. That treats an unclassified token as confirmed and is fail-open. The same pattern is present in PR #947 finance and PR #948 private CRM/notification work. Required predicate: explicitly require the claim to be non-NULL false, e.g. `(SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE`, with tests for true denied, false permitted subject to existing tenant/owner policy, and missing/NULL denied.

Comments were posted to PR #946, #947 and #948 with the required correction and test matrix.

### 2. Open-PR migration version collision is confirmed by CI

The following independent PR files allocate identical migration versions:

- #946: `20261120240000_rc489_financial_anonymous_auth_read_guard.sql`
- #947: `20261120240000_rc489_finance_anonymous_auth_select_guards.sql`
- #946: `20261120250000_rc490_medical_anonymous_auth_read_guard.sql`
- #948: `20261120250000_rc490_private_crm_notification_read_guards.sql`

The Open PR Migration Collision Guard on PR #947 failed and its job log explicitly reports the 20261120240000 conflict between #946 and #947. The #948 20261120250000 collision is also evident from the open PR file lists. Do not merge these independently. Consolidate/re-version in a single chronological chain, preserving all affected tables and tests, then rerun migration uniqueness, cross-PR collision detection, immutable history, and forward replay.

Coordination comments were posted to PRs #946, #947 and #948.

### 3. Platform-root helper source/live parity

Live read-only catalog inspection confirmed:

- `private.platform_admins` exists with `user_id uuid`, RLS enabled, and no direct anon/authenticated table grants.
- Live `public.mnty_can_platform_admin()` is SECURITY DEFINER but its body delegates to `public.mnty_can('admin',NULL,NULL,NULL)`.
- Live `public.mnty_can()` and `public.mnty_active_membership()` derive authority from active `public.user_memberships`; they do not query the registry.
- Canonical `main` already contains RC462/RC464 registry-backed `mnty_can_platform_admin()` source, including `private.platform_admins` lookup and empty search_path. RC484 separately makes `is_platform_admin()` registry-backed.

Therefore the primary defect is unapplied/missing source-to-production migration parity, not absence of a registry-backed implementation in main. Live migration ledger inspection previously showed 310 entries with latest recorded version `20261110150618`, while canonical main contains later migration files through RC487 dated 2026-11-20. The RC464 registry migration is not recorded live. Keep platform-root authorization P0 until the coordinated migration chain is rehearsed, applied under approved release controls, and re-read from live catalog.

### 4. Directory Edge PR #940

PR #940 replaces membership-only route checks with a caller-JWT call to `mnty_can_platform_admin()`, preserves anonymous GET and owner paths, and has 28 successful checks with deploy-related jobs skipped at the inspected head. Its base is five commits behind current main and compare status is diverged. It must be rebased/updated onto current main and rerun exact-head CI. Its own release notes correctly prohibit standalone deployment until RC472/RC473 schema/consent dependencies are released together. Do not deploy it independently.

## Current release posture

**PRODUCTION: BLOCKED / NOT CERTIFIED.**

No production changes were made. Remaining release prerequisites include full chronological migration reconciliation/replay, encrypted off-site backup and verified PostgreSQL 17 restore/rollback, exact Edge source/bundle parity, anonymous-vs-confirmed JWT regression matrix, payment/privacy end-to-end tests, and post-deployment live verification.

## Next execution

1. Consolidate #946–#948 into collision-free ordered migration versions.
2. Replace every permissive NULL-coalescing anonymous predicate with fail-closed logic and expand tests for missing claims.
3. Reconcile all current-main migrations from the live checkpoint in a disposable PostgreSQL 17 clone.
4. Rebase #940 on current main, rerun its source/contract/browser checks, and keep deployment skipped until RC472/RC473 coordinated release.
5. Re-read live helper definitions, RLS policies, grants, migration ledger and Edge hashes only after an approved coordinated release.


### 5. Additional PR #948 isolated-test fixture issue

The RC490 fixture defines `auth.jwt()` but its permissive owner policies invoke `auth.uid()`; the fixture does not define that function. The isolated PostgreSQL workflow is expected to fail while creating the policies before it reaches the migration assertions. A targeted comment was posted to #948 requesting a deterministic `auth.uid()` fixture derived from the JWT `sub` claim and a static assertion.

### 6. Finance overlap analysis

PR #947's nine finance/payment tables are a strict subset of the 15 tables already covered by PR #946's RC489 migration and integration inventory. PR #947 contributes no additional table coverage and creates a direct migration-version collision. Prefer consolidating its tests/contract into the broader #946 candidate and closing/superseding the duplicate only after #946 is corrected and its exact-head tests pass.
