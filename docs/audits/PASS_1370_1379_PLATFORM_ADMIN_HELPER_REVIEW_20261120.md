# Pass 1370–1379 — Platform-admin helper authorization review

**Date:** 2026-11-20  
**Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Method:** read-only `pg_proc` definitions, function privilege checks, and SECURITY DEFINER caller enumeration. No application rows selected. No function invoked. No Production mutation.

## Finding

The live helper `public.mnty_can_platform_admin()` is not registry-backed. Its body is:

```sql
select public.mnty_can('admin',null,null,null)
```

The live `public.mnty_can(text, character varying, uuid, character varying)` function resolves active memberships through `public.mnty_active_membership(NULL,NULL,NULL)`. Its role mapping explicitly treats tenant `OWNER` and tenant `ADMIN` as satisfying permission key `admin`. Because the helper passes NULL for tenant, business, and branch scope, the decision is not anchored to a specific tenant or the protected `private.platform_admins` registry.

The helper is `SECURITY DEFINER`, uses `search_path=public, pg_temp`, and is executable by `authenticated` (not `anon`).

## Authenticated SECURITY DEFINER callers

Read-only catalog enumeration found four authenticated-callable SECURITY DEFINER functions whose definitions call this helper:

1. `admin_create_global_ad` — creates platform-wide advertisements.
2. `fulfill_digital_page_publish` — performs paid digital-page fulfillment and also checks order payment, page ownership, page type, and business scope.
3. `review_mantigo_captain_application` — approves, rejects, or suspends MantiGO captain applications.
4. `set_mantigo_financial_config_backend` — manages MantiGO financial configuration.

Each listed caller is executable by `authenticated`; none was invoked. The exact blast radius of each operation depends on its remaining in-function validations, but the shared global-admin predicate is broader than the protected platform-root registry and can admit tenant-local OWNER/ADMIN roles.

## Existing source repair and Production deployment gap

The repository already contains the correct forward source repair; do not create a duplicate migration:

- RC464 `supabase/migrations/20261113214500_rc464_platform_admin_live_registry_hardening.sql` replaces `mnty_can_platform_admin()` with a SECURITY DEFINER lookup of `private.platform_admins.user_id = auth.uid()`, pins an empty search_path, removes PUBLIC/anon EXECUTE, and preserves authenticated EXECUTE. Its preflight verifies registry ownership/RLS/client grants and the four helper callers.
- RC464 disposable PostgreSQL coverage reproduces the weak baseline, applies the repair, then tests the protected boundary and all four direct callers.
- RC471 `supabase/migrations/20261117190000_rc471_mantigo_platform_admin_forward_hardening.sql` is the follow-forward hardening for the four other global MantiGO RPCs and the four helper-dependent callers.
- R7 integration tests explicitly deny tenant OWNER, BUSINESS_OWNER, and ADMIN across all four helper callers while allowing the registered platform admin. Static validators check the registry-only predicate, empty search_path, caller replacements, and test ordering.
- RC464 is already included in the required production migration chain.

The live Production helper still has the weak membership-derived body observed above. The current reconciliation says the Production migration ledger has 0/64 required release identifiers applied (latest live version `20261110150618`), so RC464/RC471 are source-ready but not deployed. RC484 is a separate later registry fix for `is_platform_admin()`; it does not replace RC464.

**Disposition:** no new authorization migration is needed for this specific finding. The remaining work is to finish the coordinated release prerequisites, apply the ordered migration chain through the authorized deployment process, then re-query the live helper definition, ACL, search_path, dependent RLS policies, and all eight callers. Do not hot-apply RC464 alone while the live schema and Edge bundle remain out of parity.

A comment with the additional finding and exact four callers was added to Issue #867 (comment ID 7045989396).

## Release acceptance and next actions

The implementation and adversarial tests already exist in RC464/RC471/R7. Remaining acceptance is release-focused:

- Confirm RC464 and RC471 remain in the exact ordered release migration chain and their CI jobs pass on the candidate head.
- Complete the full chronological migration replay and reconcile the complete live schema/RPC contracts before production rollout.
- Keep migration and Edge deployment coordinated; do not hot-apply RC464 alone while the live schema and Edge bundle remain out of parity.
- After authorized rollout, re-query the helper body, owner, SECURITY DEFINER flag, empty search_path, effective ACL, the four helper-dependent callers, the four MantiGO global RPCs, and all dependent RLS policies.
- Run negative authorization checks for tenant OWNER/BUSINESS_OWNER/ADMIN and positive registry-only platform-admin checks against the deployed version.
- Preserve digital-page payment, page-owner, page-type, business-scope, and tenant-local authorization invariants.

## Disposition

**Confirmed live Production drift; source repair already exists; exploit not demonstrated.** The current live definition and effective EXECUTE grants were inspected read-only. No user, membership, payment, ride, advertisement, or financial rows were queried. No function was invoked. No Production schema, data, grants, RLS, Auth, Storage, Edge Function, or deployment change was made.

Production remains **BLOCKED / NOT CERTIFIED** pending the coordinated authorization, migration, Edge, backup/restore, and payment release gates.
