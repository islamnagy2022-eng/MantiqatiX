# Pass 1450–1459 — Anonymous-policy reconciliation and RC484 preflight verification

**Date:** 2026-11-20  
**Production project:** `moyhiluyhjsujhwlyeuu`  
**Method:** read-only `pg_policies`, table privilege and catalog metadata queries; source migration/fixture review. No application rows selected and no Production mutation.

## 1. Security Advisor reconciliation

Fresh Security Advisor reports 90 `auth_allow_anonymous_sign_ins` warnings. A separate PostgreSQL metadata aggregation found:
- 495 policies include the `authenticated` role.
- 200 of those have no explicit anonymous marker in the policy predicate.
- Within those 200: 78 use membership/scoped helper logic; 56 reference `is_platform_admin()`; 43 are user-bound with `auth.uid()`; 11 include an explicit anon role/public-read contract; 10 are hard-deny predicates; 2 require individual review.

The Advisor's count of 90 is not a one-to-one count of exposed tables or proven leaks. Policy predicates, role grants, and multiple permissive policy composition must be evaluated together.

## 2. Focused high-risk table grants

For MantiGO rides/bids/financial ledger, medical appointments, digital-page orders, notifications, push subscriptions, user memberships, businesses and tenants:
- `anon` has no direct SELECT or INSERT grants on the inspected tables.
- Authenticated direct SELECT/INSERT grants are absent on the inspected financial ledger and medical appointment tables; MantiGO ride/bid SELECT is RLS owner/captain-scoped plus platform-admin bypass; notifications are self-scoped by `user_id=auth.uid()`.
- Public SELECT policies are limited to intentionally public records such as active showcase businesses, published digital pages/products/sections, active marketing providers/services, active plans, platform brand assets, Egypt geo areas and SMM service listings.
- Tenants' authenticated policies include non-anonymous checks; the focused high-risk policy set did not reveal a broad `auth.uid() IS NOT NULL` allow-all policy.
- The principal remaining high-risk policy pattern is `is_platform_admin()` in 56 public-schema policies plus one storage policy; RC484 is the existing registry-backed repair and remains unapplied.

Do not apply blanket anonymous-deny policies: that could break intended public discovery and self-owned anonymous flows. Reconcile each policy with its table grant and public/owner contract.

## 3. RC484 preflight blast-radius exactness

A public-only policy count initially returned 56 policies across 23 public tables. The exact RC484 migration preflight counts across **all schemas**, not just public. A fresh full-schema query returns:
- **57** policies referencing `is_platform_admin()`;
- **24** distinct tables;
- **56** in public and **1** in storage.objects.

The storage policy is `mantiqatix_media_maintenance_provider_read`. The test-only overlay `supabase/tests/baselines/rc484_live_storage_policy_overlay_fixture.sql` documents that Production has this policy but the captured replay checkpoint omits it; the fixture restores it only in the isolated replay environment. It must never be applied to Production. The exact RC484 preflight thresholds (at least 57 policies / 24 tables) therefore match the live catalog and are not a deployment blocker.

## 4. Disposition

- The 90 Advisor warnings need policy-by-policy reconciliation; focused review found no direct anon SELECT/INSERT grants on the high-risk tables inspected.
- 56 public + 1 storage policies still depend on live `is_platform_admin()`; RC484 source replaces this with registry-backed authority. Keep P0 #867 open until coordinated deployment and live verification.
- P1 #924 remains open for leaked-password protection enablement if supported by the current plan.
- No table rows, identities, memberships, payment data, patient data, ride locations or customer contact details were selected.
- Production remains **BLOCKED / NOT CERTIFIED** pending full backup/restore, Vault recovery, PG17 restore/rollback, ordered migration/Edge parity, payment/privacy E2E and post-deployment verification.

No Production DDL/DML, GRANT, RLS, Auth, Storage, Edge, payment, wallet, settlement or deployment mutation occurred.
