# Supabase Production Read-Only Recheck — 2026-11-27

## Scope and method

Read-only inspection of the connected Supabase project `MANTIQATIX FINAL` (`moyhiluyhjsujhwlyeuu`) using the Supabase project, migration, Edge Function, and advisor inventory APIs. The project reported `ACTIVE_HEALTHY` on PostgreSQL 17.6.1.155.

No SQL mutation, migration application, Auth setting change, grant/RLS/policy change, Edge deployment, Storage write, payment, wallet, settlement, or business/customer-data mutation was performed.

## Migration ledger

The live migration inventory contains **310 rows**, with latest version **`20261110150618`** (`revoke_public_execute_from_trigger_functions`). Current release manifest lists **87 exact source migration versions** required for the coordinated production release; a direct ID comparison found **0/87** exact IDs in the live ledger.

This is an exact migration-identity gap. It is not proof that every intended database effect is absent: legacy aliases and physical schema/function/ACL/RLS effects need their own inspection. Do not invent ledger rows or replay the source migration chain blindly against Production.

## Deployed Edge Function parity

| Function | Live version | Read-only finding |
|---|---:|---|
| `catalog-admin` | 20 | **Authorization drift.** Deployed `index.ts` uses a membership-derived `isPlatformAdmin` check (unscoped `SUPER_ADMIN` plus `permissions.scope=PLATFORM` and `full_control=true`). It does not call the current-main `mnty_can_platform_admin()` registry-backed check. It does manually validate bearer tokens with `auth.getUser` and rejects anonymous users, but global-root authorization semantics are behind source. |
| `public-catalog` | 11 | Shared `public-contact-visibility.mjs` matches current main byte-for-byte and requires owner opt-in plus a verified consent audit marker. The deployed entrypoint is not byte-identical to current main (14,140 vs 14,143 characters); this small difference still needs exact source comparison before claiming full parity. |
| `public-catalog-directory` | 20 | Shared `public-contact-visibility.mjs` and `promotional-images.mjs` match current main byte-for-byte. The entrypoint is not byte-identical to current main (19,965 vs 25,693 characters), so do not claim complete bundle parity. |
| `directory-listings` | 18 | Intentionally fail-closed pending RC472/RC473 consent and source-rights gates. GET returns an empty listings payload with `directoryDisabled=true`; POST returns HTTP 503 `DIRECTORY_LISTINGS_DISABLED_FOR_V1`. Do not reactivate this route until the coordinated consent release passes. |

All four functions were reported ACTIVE. Their deployed `verify_jwt` metadata was false; functions that require user identity perform their own bearer-token validation. This metadata alone does not establish an authorization defect, but each entrypoint's internal authentication and authorization path must remain part of parity review.


## Direct PostgreSQL authorization read-back

A separate read-only SQL snapshot on 2026-11-27 confirmed:

- `private.platform_admins`: RLS enabled, FORCE RLS disabled.
- `public.is_platform_admin()`: SECURITY INVOKER with `search_path=public`; it returns true when the caller has any ACTIVE membership whose role is `ADMIN` or `SUPER_ADMIN`. EXECUTE is denied to `anon` and granted to `authenticated`.
- `public.mnty_can_platform_admin()`: SECURITY DEFINER with `search_path=public, pg_temp`; it delegates to `public.mnty_can('admin', NULL, NULL, NULL)`. EXECUTE is denied to `anon` and granted to `authenticated`.
- The current policy inventory contains **57 references across 24 tables** to `is_platform_admin()`, plus **5 references across 3 tables** to `mnty_can_platform_admin()`. The two sets overlap; they should not be treated as 62 distinct tables.
- `orders` and `order_status_history` both have RLS and FORCE RLS enabled. The strict RC929 confirmed-Auth restrictive policy was not present in the live policy inventory at this check.
- `public.directory_listing_contact_consents` does not exist in the live schema at this check.

This read-back confirms the source/deployed authorization drift is also reflected in live database helpers and policy dependencies. Because the legacy helper is referenced by many policies, a direct helper replacement or bulk policy rewrite would have a broad authorization blast radius. The coordinated migration plan must preserve tenant/business/branch scopes and include positive and negative regression tests before any Production rollout.

## Authorization finding and already-existing source repair

The live SQL definitions establish a high-priority cross-tenant authorization risk:

- **mnty_active_membership(NULL, NULL, NULL)** returns the caller's ACTIVE membership rows without a tenant, business, or branch filter.
- **mnty_can('admin', NULL, NULL, NULL)** delegates to that list and explicitly includes 'admin' in the permission sets for both OWNER and ADMIN; it also accepts a JSON permissions.admin=true value.
- The deployed **mnty_can_platform_admin()** simply calls that generic evaluator. It does not query private.platform_admins. Consequently, an ordinary active tenant OWNER/ADMIN membership can satisfy the function named mnty_can_platform_admin() without a registry record.
- The separate **public.is_platform_admin()** helper returns true for any ACTIVE membership with role ADMIN or SUPER_ADMIN, with no tenant/business/branch predicate. Its 57 policy references across 24 tables commonly use it as an OR branch beside owner/tenant checks; this can turn a tenant-local role into a platform-wide RLS bypass on those policies. This conclusion follows from the live function body and policy predicates; no real user session was impersonated and no data was read through those policies.

**The repository already contains the forward-only repair; do not create duplicate migration IDs or hot-patch Production:**

1. **RC464 — 20261113214500_rc464_platform_admin_live_registry_hardening.sql**: verifies the private registry, table/guard ownership and BYPASSRLS prerequisites, requires the expected current callers/policies, enables FORCE RLS, replaces mnty_can_platform_admin() with a SECURITY DEFINER lookup of private.platform_admins.user_id = auth.uid(), pins an empty search path, revokes PUBLIC/anon execution, grants authenticated execution, and replaces the four global MantiGO RPCs.
2. **RC471 — 20261117190000_rc471_mantigo_platform_admin_forward_hardening.sql**: follow-forward repair for additional MantiGO SECURITY DEFINER callers and scope/authorization checks.
3. **RC484 — 20261119040000_rc484_registry_backed_is_platform_admin.sql**: replaces is_platform_admin() with a registry-only SECURITY DEFINER lookup, forces RLS on the registry, pins empty search path, and removes PUBLIC/anon/service_role function execution.
4. **RC485 — 20261120200000_rc485_catalog_rpc_registry_root.sql**: updates the seven direct catalog RPCs to use the registry-backed helper while retaining tenant-local OWNER/ADMIN/MANAGER/BUSINESS_OWNER business/branch scope checks.

The live database still has none of those exact source IDs in the current 87-version release list, and the direct SQL read-back still shows the pre-repair function bodies. Apply only as part of the complete, reviewed, backed-up chronological release after all preflights pass. RC464/RC471/RC484/RC485 are not independently deployable hot fixes.

## Supabase advisors

Security Advisor reported **94 lint categories / 166 findings**: **157 WARN** and **9 INFO**. Major counts include 65 authenticated-callable SECURITY DEFINER warnings, one anon-callable SECURITY DEFINER warning, 90 anonymous-access-policy checks, one leaked-password-protection warning, and nine RLS-enabled tables without policies.

Performance Advisor reported **4 lint categories / 600 findings**: **403 WARN** and **197 INFO**. Major counts include 375 auth/RLS init-plan warnings, 28 multiple-permissive-policy warnings, 132 unindexed-foreign-key notices, and 65 unused-index notices.

These advisor results are triage signals, not a standalone exploit determination. Review each function, policy predicate, direct GRANT, caller path, and intended public-read contract independently. Do not bulk-revoke access or drop indexes solely because a lint is present.

## Release disposition

**`FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.**

Priority work remains:
1. Reconcile the 87 exact required migration identities with aliases and physical effects; preserve chronological release order.
2. Prepare the coordinated registry-backed platform-root and catalog-admin authorization repair, with adversarial PostgreSQL positive/negative tests and exact deployed-origin checks.
3. Keep `directory-listings` disabled until RC472/RC473 owner-consent and source-rights contracts are live and verified.
4. Complete full Edge bundle parity, Auth/RLS/GRANT review, payment/finance tests, and an actual verified backup/restore/rollback rehearsal.

**Non-actions:** no Production SQL write, migration, Auth setting change, GRANT/RLS change, Edge deployment, Storage, payment, wallet, settlement, or customer/business-data mutation occurred during this check.

---
Evidence timestamp: `2026-11-27 02:42 UTC`.
