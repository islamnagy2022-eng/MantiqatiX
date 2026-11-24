# Pass 2221–2230 — RC434–RC441 ERP, subscription, journal and platform-scope recheck

**Checkpoint:** 2026-11-24  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Mode:** Mainline migration source review and read-only Production catalog checks. No Production writes.

## Exact source migrations reviewed

- RC434 `20261009200000_rc434_atomic_erp_purchase_receiving.sql`
- RC435 `20261009210000_rc435_subscription_provider_intent_claim.sql`
- RC436 `20261009220000_rc436_atomic_financial_journal.sql`
- RC437 `20261009230000_rc437_purchase_order_lines_receiving_limits.sql`
- RC438 `20261009240000_rc438_purchase_order_creation_with_lines.sql`
- RC439 `20261010010000_rc439_encrypted_checkout_recovery.sql`
- RC440 `20261010020000_rc440_exposed_security_definer_search_path.sql`
- RC441 `20261010030000_rc441_platform_admin_scope_hardening.sql`

## Migration-to-live findings

| Migration | Required effect | Read-only Production evidence | Status |
|---|---|---|---|
| RC434 | `receive_purchase_stock_atomic_backend(varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,numeric,uuid)` | Exact signature absent | **BLOCKED** |
| RC435 | `provider_creation_state`, `provider_creation_claimed_at`, state constraint, claimable-intent and provider-creation claim RPCs | Both columns, both exact RPC signatures and state constraint contract absent | **BLOCKED** |
| RC436 | Journal entry/line columns; two unique indexes; `post_financial_journal_atomic_backend(uuid,jsonb,jsonb)` | `entry_number`, `total_debit`, `total_credit`, `posted_at`, `line_number` absent; both unique indexes absent; atomic RPC absent | **BLOCKED** |
| RC437 | Purchase-order lines table, unique/business and scope indexes, line setter/receiver RPCs, member-read RLS policy | Table, both indexes, both exact RPCs and policy target absent | **BLOCKED** |
| RC438 | Create purchase order with lines; correct order-status function contract/ACL | Creation RPC absent. Existing `update_purchase_order_status_backend(varchar,varchar)` is SECURITY DEFINER, search_path=public, and has no anon/authenticated/service_role EXECUTE in the inspected live ACL | **BLOCKED** |
| RC439 | Ciphertext, IV and encryption-key-version fields plus all-or-none consistency constraint | All three columns absent | **BLOCKED** |
| RC440 | At migration time, change exposed public SECURITY DEFINER functions whose function-level search_path is exactly `public` to `public, pg_temp` | Current snapshot: 30 public SECURITY DEFINER routines currently match the dynamic search-path/role predicate (0 anon-executable, 30 authenticated-executable). This is a current inventory, not proof all 30 existed at RC440's historical execution time. | **HISTORICAL DYNAMIC EFFECT; CURRENT SET REQUIRES PER-FUNCTION RECONCILIATION** |
| RC441 | MantiGO platform admin helper and four global administrative RPCs must require the explicit MNTY-PLATFORM SUPER_ADMIN/full-control scope; source sets empty search_path | All five named routines exist, but live functions retain search_path=public (helper is public, pg_temp). The live helper body remains the earlier unscoped `mnty_can('admin', NULL, NULL, NULL)` style boundary, not the RC441 explicit platform tenant contract. All five are SECURITY DEFINER, anon EXECUTE=false, authenticated EXECUTE=true, service_role EXECUTE=false. | **PRESENT, CONTRACT-BLOCKED** |

## Detailed notes

### ERP receiving and order lines

RC434 is an atomic receipt + stock + ledger operation, actor-bound to an active business membership. Its exact function is absent. RC437 explicitly says approved purchase orders without line records must remain blocked until reconciled/backfilled; it creates `erp_purchase_order_lines`, scoped indexes and membership-readable RLS, then caps cumulative received quantity against approved line quantities. Production lacks the table, both indexes, its policy target and both line-aware RPCs. The absence is a direct functional blocker for safe line-level receiving.

RC438 depends on RC437. Its line-creation RPC is absent. The old status-update function name/signature exists, but its live path and grants fail the expected contract; do not mistake its presence for readiness.

### Subscription checkout recovery

RC435 adds `LEGACY_UNRECONCILED` state by default and only allows fresh intents through the claimable flow. It binds the actor to an active owner/business-owner membership and a legal assertion, and uses an idempotency key. Both state fields, its check constraint and the two RPCs are absent. RC439's AES-GCM ciphertext, IV and key-version fields are also absent. Plaintext checkout-secret recovery is not an acceptable fallback.

### Financial journal

RC436 adds totals, entry numbering, posted timestamp and line numbering; backfills existing records; rejects duplicate line/entry numbering before adding unique indexes; and adds one actor-bound atomic journal-posting RPC. Five required columns, both indexes and the exact atomic RPC are missing. This is not just a missing ledger identifier; the physical schema and RPC prerequisites were queried directly and found absent.

### RC440 search_path migration

RC440 is a dynamic migration, not a fixed list of function replacements. Its source queries public SECURITY DEFINER functions with a function-level config exactly `search_path=public`, where anon or authenticated can execute, and changes those functions to `public, pg_temp`. A fresh current-state query finds 30 routines matching that current predicate, none directly executable by anon and all executable by authenticated. The count is a present-day snapshot; it must not be projected backwards onto the historical moment when RC440 ran. Each later function still needs its own expected search-path/body contract, and newer hardening sources commonly require an empty search_path rather than merely appending pg_temp.

### RC441 platform-wide MantiGO scope

RC441 source replaces the older null-scope helper path with an explicit active `MNTY-PLATFORM` SUPER_ADMIN and platform/full-control permission check, then rewrites the dashboard, financial-report, settlement and stale-ride RPCs. All five routine identities exist live but retain their older non-empty search paths and membership-derived authorization behavior. Later registry-backed Platform Admin hardening (RC464/RC471/RC484) has additional requirements and remains unapplied; do not treat RC441's source candidate as sufficient for the current platform-root contract.

## Production boundary and release decision

- Live migration ledger remains **310 rows through `20261110150618`**.
- These eight source versions are part of the 82-version release contract and remain absent by exact version identity.
- The physical read-back is independent of the ledger: RC434–RC439's missing objects/columns/RPCs were directly checked; RC441 functions exist but are not behaviorally/security equivalent.
- Do not apply these migrations one by one. RC434–RC439 depend on shared purchase, subscription, payment, journal and Edge contracts; RC441 is in the global-admin dependency chain.
- Keep ERP receiving, subscription checkout, financial journal writes and MantiGO global administration blocked until the complete dependency chain, backups, restore/rollback and deployed-origin tests pass.

**Production mutation:** NONE.
