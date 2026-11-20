# Pass 1380–1389 — SECURITY DEFINER delegated paths and cross-module live drift

**Date:** 2026-11-20  
**Production project:** `moyhiluyhjsujhwlyeuu`  
**Method:** read-only catalog/function-definition/ACL inspection; source migration and CI review. No application rows selected, no RPC invoked, no Production mutation.

## 1. Authenticated SECURITY DEFINER inventory — delegated paths

A fresh catalog aggregate still finds 65 public SECURITY DEFINER functions executable by `authenticated`:
- 59 definitions contain a direct `auth.uid()` reference.
- 6 do not contain a direct `auth.uid()` reference.
- Function-level search_path settings: 30 `public`, 17 `public, pg_temp`, 18 empty; none of the 65 lacks an explicit setting.

The six without a direct `auth.uid()` reference were individually inspected:

1. `get_mnty_targeted_advertisements(...)` — the single intentional anon-callable public ad-discovery RPC. It has empty search_path, schema-qualified relations, approved/active/time-window filters and bounded results; this is an intentional public read contract, not an authorization omission.
2. `mnty_business_employee_list(...)` — delegates to `mnty_business_employee_list_scoped(...)`, which binds to `auth.uid()`, rejects anonymous sessions, validates business/tenant and branch/business pairs, and checks tenant/business role or explicit HR permissions.
3. `mnty_can(...)` — delegates to `mnty_active_membership(...)`, which filters membership by `auth.uid()`, ACTIVE status and supplied tenant/business/branch scope.
4. `mnty_can_platform_admin()` — delegates to the above unscoped `mnty_can('admin',NULL,NULL,NULL)`; this is the previously recorded global-admin authorization defect. RC464 source repairs it, but Production remains on the old body.
5. `preview_commission_backend(...)` — delegates to `assert_financial_membership(p_tenant_id)`; the live helper checks tenant finance membership but does not bind the actor to the requested business or reject branch-scoped finance membership for this branch-less preview. RC467 source repairs this; Production remains on the old body.
6. `upsert_catalog_item_and_price_backend(...)` — delegates to separately guarded item and price upsert functions. Both bind authorization to `auth.uid()`, validate tenant/business scope, validate branch/business scope, and enforce role scope.

Additional helper `mnty_platform_has_permission(...)` was inspected. It binds to `auth.uid()`, rejects anonymous sessions, uses `private.platform_admins` for platform-root authority, and otherwise checks scoped EMPLOYEE/STAFF memberships or scoped active custom-role assignments.

## 2. Fresh MantiGO open-ride privacy recheck

Live `public.list_open_mantigo_rides_backend(uuid)` is SECURITY DEFINER, authenticated-executable, not anon-executable, and uses `search_path=public`. Its body only checks `p_user_id = auth.uid()`; it has no captain-profile, ACTIVE, VERIFIED, AVAILABLE, anonymous-JWT or vehicle-category check. It returns up to 100 open rides including customer names and pickup/destination locations. Therefore any authenticated user can reach this sensitive listing path; no rows were read and the RPC was not invoked.

The source repair already exists:
- RC446 `20261010060000_rc446_mantigo_open_ride_privacy_boundary.sql` adds the active/verified/available captain gate.
- RC478 `20261118070000_rc478_mantigo_open_ride_privacy_forward_repair.sql` is the forward repair: rejects anonymous Auth sessions, requires an active/verified/available captain, filters by the captain's vehicle category, sets `search_path=pg_catalog`, and preserves authenticated-only EXECUTE.
- RC478 disposable integration tests cover ordinary users, pending/unverified/offline captains, anonymous JWT, category separation, own-ride exclusion and closed-ride exclusion.

RC478 merged in PR #793 (merge commit `e348061a087bdda3d77c4e886c357c7d7af81e07`). Exact-head CI passed: privacy integration run **44239964164**, forward migration replay **44239964551**, migration history immutability **44239964080**, version uniqueness **44239964257**, collision guard **44239965053**.

Fresh live ledger: 310 rows through `20261110150618`; RC446 `20261010060000` and RC478 `20261118070000` are absent. P1 Issue **#911** opened for the live Production deployment gap.

## 3. Fresh commission scope recheck

Live definitions of:
- `mnty_commission_rule_drafts(...)`
- `preview_commission_rule_draft(...)`
- `preview_commission_rule_resolution(...)`
- `preview_commission_backend(...)`

remain the pre-RC467 versions. The first three still derive platform access from `user_memberships` role/permission rows and permit tenant management roles; the operational preview still calls `assert_financial_membership(p_tenant_id)` without business/branch binding. All four are SECURITY DEFINER, executable by authenticated, not anon. The three draft functions use empty search_path; the operational preview uses `search_path=public`.

The source repair already exists in RC467 `20261115010000_rc467_commission_scope_hardening.sql` and its disposable behavioral test. It makes commission draft management/preview/resolution registry-platform-admin-only, allows the operational preview only to platform admins or appropriately scoped tenant/business finance members, and denies branch finance actors because the RPC has no branch argument. The RC467 validator and integration test are part of the forward migration replay workflow; run **44239964551** passed the static validator, timestamp-ordered replay and RC467 behavioral SQL test.

Fresh live ledger: RC467 `20261115010000` is absent. Existing P1 Issue **#884** updated with the 2026-11-20 live recheck and CI evidence.

## 4. Disposition and remaining work

- The six delegated authorization paths are now classified; no missing direct `auth.uid()` check was inferred solely from the absence of a literal reference.
- Three known live Production source-parity gaps remain: RC464/RC471 platform-admin helper/callers (P0 #867), RC467 commission authorization (P1 #884), and RC478 MantiGO open-ride privacy (P1 #911).
- The registry-backed source repairs and isolated tests are merged/CI-green; none is applied to Production. The live migration ledger remains 310 rows through `20261110150618`, and the required release migration identifiers remain absent.
- Continue signature-by-signature full-body review of the 59 direct-`auth.uid()` functions, including transitive authorization, tenant/business/branch constraints, unqualified object references, and business logic invariants. The current pass does not claim all 65 are fully audited.
- Keep Production **BLOCKED / NOT CERTIFIED** until coordinated migration/Edge release, verified backup/restore and rollback, payment/privacy E2E, and post-deployment live verification pass.

No application rows, customer locations, financial rows, memberships or identities were selected. No function was invoked. No Production DDL/DML, grants, RLS, Auth, Storage, Edge, payment, wallet, settlement or deployment change occurred.
