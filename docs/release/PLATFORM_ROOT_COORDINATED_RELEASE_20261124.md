# Coordinated Platform-Root Authorization Release Gate

**Prepared from:** `main @ 17329ba27effad52a316ad0aa94ef1a93ab975a`  
**Production:** `MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu`  
**Current state:** **BLOCKED / NOT CERTIFIED — read-only preparation only**

This is an execution gate and dependency map. It is not authorization to change Production. No direct hot-patches, one-off grants, partial migration runs or manual ledger edits are permitted.

## 1. Current authorization baseline

See [PASS 2361–2370](../audits/PASS_2361_2370_PLATFORM_ROOT_LIVE_RECHECK_20261124.md). The fresh live read-back confirms:

- `private.platform_admins`: RLS ON, FORCE RLS OFF; owner is `postgres`, which has BYPASSRLS. Client roles `anon` and `authenticated` have no table privileges; `service_role` has CRUD and must remain server-only.
- `public.is_platform_admin()`: SECURITY INVOKER / `search_path=public`, currently derives global authority from ACTIVE tenant ADMIN/SUPER_ADMIN membership.
- `public.mnty_can_platform_admin()`: SECURITY DEFINER / `search_path=public, pg_temp`, currently calls legacy unscoped `mnty_can('admin', NULL, NULL, NULL)`.
- Authorization dependencies: 57 policies across 24 tables use `is_platform_admin()`; five policies across three tables use the legacy helper. The combined scope is 62 policies across 27 tables.
- All seven direct catalog write RPCs remain SECURITY DEFINER with `search_path=public`. None requires the JWT claim `is_anonymous` to be explicitly false. Four use a COALESCE guard; three lack a direct claim guard.

## 2. Required ordered source slice

The following is a dependency map, not permission to cherry-pick migrations. The actual release chain must follow the exact canonical 83-version order in [REQUIRED_83_MIGRATION_SOURCE_OBJECT_CROSSWALK_20261125.md](./REQUIRED_83_MIGRATION_SOURCE_OBJECT_CROSSWALK_20261125.md) and the gate in `scripts/production/live-reconciliation-contract.mjs`.

| Stage | Source chain | Dependency / required result |
|---|---|---|
| A — tenant and global authorization | RC464 → RC464B → RC465–RC470 → RC471 | Registry owner/BYPASSRLS and eight exact function identities; correct global root without broadening tenant/branch access; order, commission and payment preflights must pass. |
| B — directory and provider privacy | RC472–RC483 (original RC479 source) | Claim atomicity, consent scopes, provider profile base-read boundary, Legal grants/admin registry and atomic CMS. Directory remains fail-closed until deployed DB + Edge checks pass. |
| C — canonical global root | RC484 | FORCE RLS on the protected registry; owner parity; SECURITY DEFINER helper with empty search_path; exact ≥57 policies / ≥24 tables preflight. |
| D — forward privacy repair and catalog/finance/order guards | RC479 forward repair (`20261120193000`) → RC485–RC496 | Apply the later restrictive provider-profile policy after RC484, then catalog/price RPCs, SMM bootstrap removal, confirmed-session guards, settlement scope, Storage policies and MantiGO bid invariant. |
| E — medical and agreement gates | RC921 → RC922 → RC923 → RC924 → RC925 | Assigned-provider and forward-only medical transitions, exact agreement participant/admin scope, then direct catalog RPC claim hardening. RC925 must reject both explicit anonymous and missing/null `is_anonymous` claims. |
| F — strict provider-profile identity | RC926 (`20261125110000`) after RC479 | Revoke raw anon base-table SELECT and replace the RC479 COALESCE-based restrictive policy with exact `is_anonymous = false` semantics; deny missing/null claims while preserving confirmed-user and owner compatibility. Source merged and PG17 replay-tested, but not applied to Production. |

The labels above are functional groups only; execute by version timestamp from the authoritative list, not by this table's presentation order. No historical migration file may be edited. New corrections require a new timestamped forward migration and a source-specific immutability test.

## 3. Mandatory pre-release gates

1. **Source integrity:** verify the 83 required source files, unique version IDs, collision/immutability checks, three exact aliases and five partial-baseline classifications. Keep the migration ledger unchanged until the formal ledger reconciliation gate passes.
2. **Exhaustive effect reconciliation:** expand beyond the 76-object sample. Compare every affected table, column, index, constraint, trigger, policy predicate, function overload/body, owner, SECURITY DEFINER flag, search_path, and effective ACL against the source contracts. Presence alone is not semantic parity.
3. **Backup and restore:** obtain owner-controlled encrypted off-site database and Storage-object exports; verify retrieval and checksums; account for Auth users/identities, Vault keys/secrets, configuration and Storage metadata/object bytes. Restore into disposable PostgreSQL 17 and prove rollback; measure RPO/RTO. Do not use a paid Supabase branch as an assumed prerequisite.
4. **Exact-head isolated tests:** run the full strict 83-source gate and chronological forward replay from the verified checkpoint, plus all module-specific PostgreSQL 17 integration tests. Include positive registered-platform-root access and negative tenant ADMIN/OWNER/SUPER_ADMIN, stale platform metadata, tenant-scoped SUPER_ADMIN, MNTY-PLATFORM membership without registry, anonymous Auth, missing/null JWT claim, cross-business and cross-branch cases. Preserve tenant-local owners/managers and public read projections intentionally allowed by contract.
5. **Database-to-Edge closure:** map every migration to physical schema → RPC/ACL/RLS → exact deployed Edge bundle/version → deployed-origin E2E. Nine launch-critical Edge deployments were previously found different from current main. No individual Edge deployment is allowed until its entire dependency slice passes.
6. **Release review:** prepare exact commit, ordered migration list, verified backup identifiers, rollback steps, affected services, CI run IDs, Edge versions, expected post-release SQL read-back and smoke tests. Obtain explicit Production release approval before any Production write.
7. **Post-release verification:** read back FORCE RLS, registry/helper owner and BYPASSRLS, empty search_path, helper ACL, all 62 policy references and the exact eight caller definitions; verify all seven catalog RPCs deny anonymous/missing-claim tokens and preserve confirmed-user tenant/business/branch behavior; run deployed-origin E2E. Any mismatch reverts the release and keeps affected endpoints fail-closed.

## 4. Known non-approval blockers

- Production's live migration ledger is 310 rows through `20261110150618`, with 0/83 exact required source-version IDs. Three aliases are confirmed, but formal ledger repairs remain zero. Do not treat the mismatch itself as absence of physical effects.
- The 76-object curated physical read-back is 35 present / 41 absent and is not the exhaustive release contract.
- RC464/RC471/RC484/RC485/RC925/RC926 are source-side fixes, not live Production changes.
- Current CI evidence includes run `45496742405` (full forward replay) and `45496743088` (module/RC471-related PG17 tests), plus catalog, dashboard, privacy, directory, Paymob and agreement suites on the exact PR #1086 head. CI pass is not Production certification.
- The leaked-password protection setting remains NOT AVAILABLE / NOT VERIFIED on the current plan. Do not claim it is enabled.

## 4A. Fresh read-only Production recheck — 2026-11-25

The connected project was re-read directly after RC926 merged:

- Project is `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.155. Migration ledger remains 310 rows through `20261110150618`; exact source IDs remain **0/83**.
- Provider profile table has RLS + FORCE RLS enabled, but direct `anon SELECT` is still granted. The permissive `Public can view active marketing providers` SELECT policy remains present for `anon, authenticated`; the strict RC926 restrictive policy is absent from Production.
- `private.platform_admins` still has RLS ON / FORCE RLS OFF. Registry SELECT remains server-only (`service_role` true; `anon` and `authenticated` false). `is_platform_admin()` remains SECURITY INVOKER/search_path=public and does not reference the registry; `mnty_can_platform_admin()` remains SECURITY DEFINER/search_path=public, pg_temp and delegates to the legacy null-scope helper.
- The 62-policy dependency count remains 57 references across 24 tables for `is_platform_admin()` and five references across three tables for `mnty_can_platform_admin()`.
- Live `upsert_catalog_price_backend` has no transaction advisory lock and the required unique item/branch/version index is absent.
- All 42 inventoried Edge Functions are ACTIVE; nine launch-critical functions were previously confirmed source-mismatched. `catalog-admin` is v20; `directory-listings` is v18 and intentionally fail-closed.
- Current Security Advisor returned 166 categorized findings (9 RLS/no-policy, 1 anon SECURITY DEFINER, 65 authenticated SECURITY DEFINER, 90 Anonymous Auth policy warnings, 1 leaked-password protection). These are review findings, not 166 confirmed vulnerabilities.

Full results: [PASS 2441–2450](../audits/PASS_2441_2450_CURRENT_PLATFORM_ROOT_RC926_PRODUCTION_RECHECK_20261125.md). This remains a read-only snapshot, not Production release approval.

## 5. Edge runtime dependency gate

The live Edge/RPC/ACL/schema inventory is maintained in [EDGE_RPC_PRODUCTION_DEPENDENCY_MATRIX_20261124.md](./EDGE_RPC_PRODUCTION_DEPENDENCY_MATRIX_20261124.md). No payment, financial-journal, ERP, subscription or settlement Edge function may be promoted independently of its exact migration/RPC/ACL contract and deployed-origin negative tests.

## 6. Explicit non-actions in this phase

No Production SQL write or `apply_migration`; no Auth configuration, RLS/GRANT, Storage policy, Edge deployment, payment/webhook, wallet, settlement, business-data, migration-ledger, or website deployment changes. The only permitted work before release approval is source review, isolated tests, backup/restore rehearsal in disposable infrastructure, and read-only live verification.
