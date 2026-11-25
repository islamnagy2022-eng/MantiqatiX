# PASS 2441–2450 — Current Platform-Root and RC926 Production Read-Back

**Date:** 2026-11-25  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Database:** PostgreSQL 17.6.1.155 / `us-east-2`  
**Method:** Connected Supabase catalog/metadata queries, live migration inventory, deployed Edge inventory and Security Advisor.  
**Production impact:** Read-only. No SQL writes, migrations, grants, policies, Auth, Storage, Edge deployments, payments, settlements or business-data changes.

## 1. Project and migration ledger

| Check | Direct read-back |
|---|---|
| Project status | `ACTIVE_HEALTHY` |
| PostgreSQL | `17.6.1.155` |
| Migration ledger rows | 310 |
| Latest ledger version | `20261110150618` |
| Required current source versions | 83 |
| Exact required version IDs present in live ledger | **0 / 83** |
| RC926 version `20261125110000` | Absent from live ledger |
| Release disposition | **BLOCKED / NOT CERTIFIED** |

The 83 exact source versions were extracted from `REQUIRED_RELEASE_MIGRATION_VERSIONS` in `scripts/production/live-reconciliation-contract.mjs` and compared to the full Production migration inventory. The zero exact-ID match is a migration-identity fact; it does not prove every physical SQL effect is absent. The three separately verified historical source/ledger aliases and five partial-baseline classifications remain governed by the existing reconciliation process. Do not synthesize ledger rows or replay aliases.

## 2. Provider-profile identity boundary — RC479 / RC926

Direct catalog read-back for `public.marketing_provider_profiles`:

| Control | Result |
|---|---|
| RLS enabled | Yes |
| FORCE RLS | Yes |
| `anon SELECT` table privilege | **Granted** |
| `authenticated SELECT` | Granted |
| `service_role SELECT` | Granted |
| RC479 restrictive confirmed-Auth policy | **Absent** |

The current live SELECT policies include:

| Policy | Mode / role | Live predicate |
|---|---|---|
| `Public can view active marketing providers` | PERMISSIVE / `anon, authenticated` | `status = 'ACTIVE'` |
| `CRM managers view marketing providers` | PERMISSIVE / `authenticated` | Active membership with one of the listed manager/admin roles |
| `Owners manage their marketing provider profile` | PERMISSIVE / `authenticated` | Owner UID plus legacy `COALESCE(is_anonymous, 'false') <> 'true'` check |

The public-active policy still permits raw anonymous base-table SELECT. The owner policy's COALESCE expression treats a missing claim as non-anonymous; it is not the strict confirmed-identity predicate required by RC926.

RC926 source migration `20261125110000_rc926_provider_profile_confirmed_identity_strict_guard.sql` has been merged into main and passed exact-head isolated tests, but is **not applied to Production**. Until the coordinated, backup-backed release is approved and deployed, the live privacy boundary remains unchanged.

## 3. Platform Admin global root

| Contract | Live state |
|---|---|
| `private.platform_admins` | Present; owner `postgres` |
| Registry RLS / FORCE RLS | ON / **OFF** |
| Registry table SELECT | `anon=false`, `authenticated=false`, `service_role=true` |
| `public.is_platform_admin()` | SECURITY INVOKER; `search_path=public`; authenticated EXECUTE; body does not reference the registry |
| `public.mnty_can_platform_admin()` | SECURITY DEFINER; owner `postgres`; `search_path=public, pg_temp`; authenticated EXECUTE; body still delegates to `mnty_can(..., NULL, NULL, NULL)` |

Policy dependency counts from `pg_policies` remain:

| Helper reference | Policies | Tables |
|---|---:|---:|
| `is_platform_admin()` | 57 | 24 |
| `mnty_can_platform_admin()` | 5 | 3 |
| **Total** | **62** | **27** |

This confirms the Platform Admin root repair is still source-side only. Do not activate individual grants or policies outside the ordered dependency chain: tenant-local ADMIN/OWNER/MANAGER access must remain separate from registered global Platform Admin access.

## 4. Catalog price-write concurrency contract — RC486

Live `public.upsert_catalog_price_backend(...)`:

- SECURITY DEFINER, owner `postgres`, `search_path=public`.
- No `pg_advisory_xact_lock` in the live function body.
- Required unique index `catalog_item_prices_item_branch_version_uidx` is absent.

The live allocator therefore still lacks both serialized version allocation and its required uniqueness invariant. The RC486 source migration and PostgreSQL integration test do not repair Production until the ordered release is applied. Keep the fail-closed source guard in PR #1103 under review; the live deployed `catalog-admin` is still v20 and the source guard has not been deployed.

## 5. Deployed Edge inventory snapshot

The connected project reports 42 ACTIVE Edge Functions. Relevant live versions/settings:

| Function | Version | `verify_jwt` |
|---|---:|---|
| `catalog-admin` | 20 | false |
| `catalog-platform-admin` | 23 | true |
| `payment-intent` | 8 | true |
| `paymob-webhook` | 10 | false |
| `digital-page-payment-intent` | 5 | true |
| `subscription-payment-intent` | 4 | true |
| `settlement-financial-atomic` | 4 | true |
| `financial-journal` | 3 | true |
| `order-create` | 8 | true |
| `erp-purchase-receive` | 3 | true |
| `directory-listings` | 18 | false |
| `public-catalog` | 9 | false |
| `public-catalog-directory` | 19 | false |

ACTIVE status and JWT gateway settings do not prove bundle parity or RPC compatibility. The previously recorded nine launch-critical source mismatches remain a deployment blocker. `directory-listings` v18 remains the intentionally fail-closed endpoint. Do not deploy individual functions without the full schema/RPC/ACL/import closure and deployed-origin positive/negative tests.

## 6. Security Advisor snapshot

The current Security Advisor returned **166 findings**, categorized as follows:

| Advisor category | Count | Interpretation |
|---|---:|---|
| RLS enabled without policies | 9 | INFO; review intended access, default-deny remains important |
| Anonymous EXECUTE on SECURITY DEFINER | 1 | WARN |
| Authenticated EXECUTE on SECURITY DEFINER | 65 | WARN; requires per-function body/ACL/scope review |
| Anonymous Auth policy warnings | 90 | WARN; policy intent and effective privilege must be examined |
| Leaked-password protection disabled | 1 | WARN; plan/owner dependency |
| **Total** | **166** | Advisor findings, **not 166 confirmed vulnerabilities** |

The health Advisor returned no lints. Advisor counts do not replace direct ACL, policy and caller review.

## 7. Required next actions and non-actions

1. Keep Production read-only. Do not apply RC926, RC464/RC471/RC484, RC485/RC925, RC486 or any other isolated migration by itself.
2. Maintain one exact chronological 83-version crosswalk and dependency plan; reconcile all aliases and physical effects before any Production migration.
3. Complete owner-controlled encrypted database and separate Storage exports, retrieval/checksum verification, Auth/Vault/configuration recovery coverage, and an independent PostgreSQL 17 restore/rollback with measured RPO/RTO.
4. Complete the exact database → RPC/ACL/RLS → Edge bundle → deployed-origin test matrix, including the signed Paymob altered-selector replay and price-write concurrency negative/positive tests.
5. Obtain explicit approval for the exact Production commit, migration sequence, Edge versions, backup artifacts and rollback instructions before any write or deployment.

**Production mutations: NONE.**  
**RC926:** source merged / exact-head CI PASS / **not deployed**.  
**Platform Admin root, provider-profile boundary and RC486 price concurrency:** live contract remains blocked.  
**FULL_PLATFORM_GATE:** **BLOCKED / NOT CERTIFIED**.
