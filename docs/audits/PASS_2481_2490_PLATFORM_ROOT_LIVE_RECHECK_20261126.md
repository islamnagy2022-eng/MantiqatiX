# Pass 2481–2490 — Platform-root authorization live recheck

**Date:** 2026-11-26  
**Repository main baseline:** `d695316a69426d71c65891a6bbe2cd379b77a33d`  
**Production Supabase project:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Database:** PostgreSQL 17.6.1.155; project status `ACTIVE_HEALTHY`  
**Method:** read-only PostgreSQL catalog query; no application rows or user identities selected.  
**Production writes:** NONE.

## 1. Current Production read-back

A single read-only query inspected the migration ledger, both global platform-admin helper definitions/configuration, policy references, and the canonical private registry.

| Contract | Current live result | Required source target | Disposition |
|---|---|---|---|
| Migration ledger | 310 rows; latest version `20261110150618` | Ordered, reconciled source migration chain | BLOCKED |
| RC464 `20261113214500` | Not recorded in the live ledger | Registry-backed `mnty_can_platform_admin()`, FORCE RLS and helper hardening | NOT LIVE |
| RC471 `20261117190000` | Not recorded in the live ledger | Forward hardening of shared MantiGO/global SECURITY DEFINER callers | NOT LIVE |
| RC484 `20261119040000` | Not recorded in the live ledger | Registry-backed `is_platform_admin()` | NOT LIVE |
| RC485 `20261120200000` | Not recorded in the live ledger | Registry-root authorization for seven catalog RPCs | NOT LIVE |
| RC923 `20261124121348` | Not recorded in the live ledger | Explicit Anonymous Auth denial for three catalog RPCs | NOT LIVE |
| RC928 `20261126010000` | Not recorded in the live ledger | Atomic profile/gallery write contract | NOT LIVE |
| RC117 repair `20261126020000` | Not recorded in the live ledger | Preserve existing non-empty marketing service image URLs | NOT LIVE |
| RC929 `20261126030000` | Not recorded in the live ledger | Explicit confirmed-Auth guard for order reads | NOT LIVE |

The query returned no matching migration versions for this selected set. This is an exact ledger-identity observation; it is not proof that every historical physical effect is absent.

## 1A. Full required migration ledger crosswalk

The exact current-main `REQUIRED_RELEASE_MIGRATION_VERSIONS` array was parsed from `scripts/production/live-reconciliation-contract.mjs` and compared with the live `supabase_migrations.schema_migrations` ledger using a read-only query.

- Required versions: **86**.
- Duplicate required version IDs: **0**.
- Matching source migration files in the current-main Git tree: **86/86**.
- Required IDs recorded in the live Production ledger: **0/86**.
- Live ledger rows: **310**; latest version: `20261110150618`.

The source check used the complete, non-truncated current-main Git tree. Every required ID has exactly one matching migration file; no required ID is missing or duplicated in source. This confirms source-file presence and exact ledger divergence only. It does not prove that every migration effect is physically absent or that the ledger can safely be repaired without a separately approved, effect-by-effect reconciliation.

## 2. Live helper definitions and blast radius

### `public.is_platform_admin()`

- `SECURITY INVOKER` (`prosecdef=false)).
- `search_path=public`.
- Returns true for any ACTIVE `public.user_memberships` row for `auth.uid()` with role ADMIN or SUPER_ADMIN.
- Does not consult `private.platform_admins`.

### `public.mnty_can_platform_admin()`

- `SECURITY DEFINER` (`prosecdef=true)).
- `search_path=public, pg_temp`.
- Delegates to `public.mnty_can('admin', NULL, NULL, NULL)`.
- This remains an unscoped membership-derived global authority path.

### Additional helper callers and registry ACL

A second read-only `pg_proc` / effective-privilege query identified **12 other public-schema functions** whose definitions reference one of the two helpers:

| Function | SECURITY DEFINER | Live `search_path` |
|---|---:|---|
| `admin_create_global_ad` | Yes | `public, pg_temp` |
| `create_notification_backend` | Yes | `public` |
| `deactivate_business` | Yes | `public` |
| `fashion_erp_mutate` | Yes | `public` |
| `fulfill_digital_page_publish` | Yes | `public, pg_temp` |
| `get_credit_status` | No | `public` |
| `mnty_commission_rule_drafts` | Yes | empty |
| `resolve_legacy_scope` | Yes | `public` |
| `restaurant_erp_mutate` | Yes | `public` |
| `restaurant_table_mutate` | Yes | `public` |
| `review_mantigo_captain_application` | Yes | `public` |
| `set_mantigo_financial_config_backend` | Yes | `public` |

This is a fresh name/body match inventory, not a claim that all 12 functions are directly client-callable. Their grants and callers must be reviewed individually before any privilege change.

Effective registry table privileges in the same read-only query:

- `anon`: SELECT=false, INSERT=false.
- `authenticated`: SELECT=false, INSERT=false.
- `service_role`: SELECT/INSERT/UPDATE/DELETE=true.

This confirms the registry remains client-isolated; it does not replace the missing FORCE RLS and helper-body correction.

### Policy references

The live catalog query returned:

- `is_platform_admin()`: **57 policy references across 24 tables**.
- `mnty_can_platform_admin()`: **5 policy references across 3 tables**.
- Combined: **62 policy references across 27 tables**.

### Canonical registry

- `private.platform_admins` exists.
- RLS is enabled.
- FORCE RLS is **disabled**.
- Table owner is `postgres`.

These findings reproduce the P0 authorization gap in Issue #867. They do not establish that an unauthorized user currently has access; they establish that tenant ADMIN/SUPER_ADMIN membership is still the live global authorization predicate and that the registry-only source repairs are not recorded as applied.

## 3. Source-side correction and test evidence

The repository already contains the ordered forward-only correction family:

1. RC464 — registry-backed `mnty_can_platform_admin()`, protected registry and MantiGO caller hardening.
2. RC471 — additional forward hardening for shared global SECURITY DEFINER callers.
3. RC484 — registry-backed `is_platform_admin()` for the 57-policy / 24-table blast radius.
4. RC485 — seven catalog RPC definitions use registry-backed root authorization while preserving tenant-local role/scope checks.
5. RC923/RC925/RC926/RC927 — additional explicit anonymous-session, provider-profile and public-page authorization boundaries.

Prior source/PG17 and chronological replay evidence is recorded in:

- `docs/audits/PASS_2071_2080_PLATFORM_ROOT_LIVE_RECHECK_20261124.md`
- `docs/audits/PASS_2361_2370_PLATFORM_ROOT_LIVE_RECHECK_20261124.md`
- `docs/audits/PASS_2441_2450_CURRENT_PLATFORM_ROOT_RC926_PRODUCTION_RECHECK_20261125.md`
- `docs/release/PLATFORM_ROOT_COORDINATED_RELEASE_20261124.md`

Those historical CI results remain source/fixture evidence. They do not supersede this current Production read-back and do not authorize a live rollout.

## 3A. Current source/CI evidence on the same main baseline

The source correction family was re-exercised on the adjacent RC929 security branch based directly on this audit's same main baseline `d695316a69426d71c65891a6bbe2cd379b77a33d`; tested code head was `0f1d1cb748a9f15ba85a60d7708e81772d2258f5`.

- RC464 PostgreSQL 17 platform-admin integration: **PASS**, run `45851878600`.
- RC471 PostgreSQL 17 platform-admin integration: **PASS**, run `45851878311`.
- RC484 PostgreSQL 17 registry/RLS integration: **PASS**, run `45851878700`.
- RC465 order read-scope PostgreSQL integration: **PASS**, run `45851878442`.
- Full chronological forward replay: **PASS**, run `45851878325`; 126 forward migrations applied in timestamp order from the isolated Production schema checkpoint. This replay included RC928, the RC117 image-provenance forward repair, the test-only order ACL overlay, and RC929. The overlay reported PASS immediately before RC929; RC929 committed successfully.
- The exact-head check inventory for that code head reported 28 successful checks, no failures, and two expected skips (`deploy`, `validate_public_only`).

These runs validate the source and disposable PostgreSQL contracts. They do not alter or certify Production, and they do not replace the live read-back in this report. The tested code head is not the head of this documentation-only PR.

## 4. Release disposition

**P0 Issue #867 remains OPEN. Full platform remains BLOCKED / NOT CERTIFIED.**

Do not hot-edit either helper, mass-rewrite policies, apply a subset of the migration chain, or deploy dependent Edge functions individually. The coordinated release still requires:

- exact chronological migration and physical-effect reconciliation;
- the complete PG17 adversarial actor matrix across all affected policies and RPC callers;
- exact source-to-live Edge bundle parity for dependent functions;
- the owner-controlled backup/restore and rollback gate required by the release runbook;
- explicit Production release approval followed by read-only post-release verification.

The user previously asked to defer backup work for now. That deferral is not recorded as a passed backup gate and does not make Production deployment safe.

## 5. Non-actions

No SQL DDL/DML, migration application, grant/revoke, RLS policy change, Auth configuration, Storage change, Edge deployment, payment, settlement, business/customer-data read, or website deployment was performed.

## 6. Next action

Continue the source-side coordinated release work without changing Production: reconcile the current 86-version source/physical-effect crosswalk and exact dependencies, then run the relevant current-head PG17 and full chronological replay checks. Keep all affected global-admin and gallery-dependent Edge paths behind their existing fail-closed gates until the entire dependency slice is verified.


## 7. Post-audit source checkpoint (2026-11-26)

This report's live Production observations and 86-version crosswalk are a dated snapshot taken against main baseline `d695316a69426d71c65891a6bbe2cd379b77a33d`. They are not a replacement for the later 87-version release contract.

After this read-back, RC929 (`20261126030000`) was merged source-only through PR #1137 at `476180ecd027d435558c7d435c1b2804daf2e92f`. Its exact-head RC465 PostgreSQL 17 test, static validation, and full 126-migration chronological replay passed in isolated CI. The PR's current 87-version crosswalk records 0/87 exact IDs in the 310-row Production ledger through `20261110150618`. This does not establish physical absence of effects or authorize a migration.

The source-only activity sharing change was merged separately in PR #1139. Neither merge is evidence of a Production database change. The report's global platform-root findings remain open until the complete coordinated release and a fresh post-release read-back pass.

No Production mutation was performed for this addendum.
