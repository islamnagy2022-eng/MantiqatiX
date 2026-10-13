# S04 — Migration Chain & Clean Replay Report

**Audit date:** 2026-10-13  
**Repository:** `islamnagy2022-eng/MantiqaTiX`  
**PR:** [#218](https://github.com/islamnagy2022-eng/MantiqaTiX/pull/218) — open, Draft, unmerged  
**Audit source commit:** `11d5eb7dc0bbbc83d1ad080656a1696b723cddc8`  
**Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Status:** `BLOCKED / NOT CERTIFIED`

## 1. Production ledger — read-only verification

A fresh read-only query of `supabase_migrations.schema_migrations` returned **283 rows**, first version `20260808000000`, latest version `20261008222845`. The latest entry remains `rc424_atomic_digital_page_payment_webhook`.

The candidate RC425–RC441, RC449, RC462, RC522, and RC523 migrations are **not proven applied**. The queried target versions were absent from the live ledger. No production migration, schema, data, permission, or migration-ledger write was performed.

## 2. Source inventory and ordering

The PR branch contains **160 SQL files** in `supabase/migrations/`. The requested source files RC425–RC432, RC434–RC441, RC449, RC462, RC522, and RC523 are present. RC433 has no matching migration source in the inspected inventory; this is recorded as a numbering/source gap requiring confirmation, not assumed to be an applied migration.

The source audit identified five duplicate migration-version groups. Supabase migration versions are the first 14 digits of the filename, so each group is a chain-integrity blocker:

| Duplicate version | Conflicting source filenames |
|---|---|
| `20260928020000` | `20260928020000_rc101_g6_rls_permissive_policy_hardening.sql`; `20260928020000_rc102_g8_crm_notification_support_rls_hardening.sql` |
| `20260928060000` | `20260928060000_rc109_harden_order_support_tenant_boundaries.sql`; `20260928060000_restore_registration_request_dml_grants.sql` |
| `20260928190000` | `20260928190000_rc162_mantigo_trip_state_machine.sql`; `20260928190000_rc200_cross_tenant_customer_payment_authorization.sql` |
| `20260928200000` | `20260928200000_rc164_mantigo_direct_delete_lockdown.sql`; `20260928200000_rc164_retire_legacy_mantigo_mutator.sql`; `20260928200000_rc206_geographic_ad_targeting_and_nearest_fallback.sql` |
| `20260928210000` | `20260928210000_rc172_restore_medical_booking_contract.sql`; `20260928210000_rc207_official_global_mnty_cover_ads.sql` |

Do not resolve these collisions by changing production history or arbitrarily renaming files. Establish intended ordering and reconcile source/ledger semantics first, then make a reviewed correction on the source branch.

## 3. Requested migrations — dependency and precondition review

| Migration | Source/order observation | Dependency or replay precondition |
|---|---|---|
| RC425 | Present at `20261009120000` | Uses MantiGO provider-event/financial-ledger tables, notifications, and `process_verified_mantigo_payment_backend`; those objects must exist before replay. |
| RC426 | Present at `20261009130000` | Replaces digital-page payment-intent finalization and references `digital_page_orders`; existing function/table signature must match. |
| RC427 | Present at `20261009140000` | Adds an active-intent uniqueness rule over `payment_intents`; existing duplicate active intents intentionally block application. |
| RC428 | Present at `20261009150000` | Replaces provider-payment failure RPC; depends on `payment_intents`, `orders`, and `payment_provider_events`. |
| RC429 | Present at `20261009160000` | Replaces subscription-payment failure RPC; depends on subscription intents, provider events, and businesses. |
| RC430 | Present at `20261009170000` | Replaces subscription-payment success RPC; depends on subscription intents, subscriptions, memberships, businesses, and the legal assertion contract. |
| RC431 | Present at `20261009180000` | Hardens existing digital-page payment RPC/event objects; must be compared with the preceding RC424 function definition, not treated as standalone. |
| RC432 | Present at `20261009190000` | Depends on SMM wallet tables/functions and aborts on conflicting legacy debit/refund/credit references. |
| RC434 | Present at `20261009200000` | Depends on ERP purchase, warehouse, receipt, stock, inventory, membership, business, and catalog objects. Its own header flags missing purchase-order line modeling; RC437 appears later in timestamp order. |
| RC435 | Present at `20261009210000` | Alters subscription intent state and creates claim RPCs; requires the existing subscription-intent schema and related pricing/membership objects. |
| RC436 | Present at `20261009220000` | Depends on the financial journal, chart-of-accounts, general-ledger, membership, and business schemas. |
| RC437 | Present at `20261009230000` | Adds purchase-order lines and line-aware receiving; existing purchase orders/catalog/ERP receipt contracts must match. |
| RC438 | Present at `20261009240000` | Explicitly depends on RC437's line schema and line-aware receiving wrapper; timestamp ordering is correct. |
| RC439 | Present at `20261010010000` | Adds encrypted checkout recovery columns to `subscription_payment_intents`; requires RC435-era intent table. |
| RC440 | Present at `20261010020000` | Updates search paths for matching exposed SECURITY DEFINER functions; its target-function selection must be tested against the clean schema's actual grants and function metadata. |
| RC441 | Present at `20261010030000` | Adds MantiGO platform-admin scoping and replaces several RPCs; depends on memberships, rides, ledger, audit logs, notifications, and settlement/journal contracts. |
| RC449 | Present at `20261010170000` | Substantially overlaps RC441's function set. Keep both source files immutable during audit; establish intended semantic relationship and prerequisite availability before full replay. |
| RC462 | Present at `20261012040000` | Forward correction to `mnty_can_platform_admin()`; requires RC441/RC449 to have defined the function and `user_memberships` to exist. |
| RC522 | Present at `20261013190000` | Alters privileges on `audit_logs`; table and intended owner/application-role grants must be present. |
| RC523 | Present at `20261013200000` | Replaces the MantiGO financial report RPC; requires the platform-admin guard and canonical `mantigo_financial_ledger` columns. The focused integration fixture is not proof of full-chain compatibility. |

This is a source-level dependency review, not a successful replay result. Exact dependency validity remains **NOT VERIFIED** until the disposable chronological replay executes the actual SQL.

## 4. Recovered migrations and semantic discrepancies

Files under `supabase/recovered-migrations/` are archival candidates, not an executable migration directory. Their existence is not proof of application. Preserve this separation during replay.

The existing semantic reconciliation record documents unresolved source-versus-ledger differences for RC169, RC172, RC199, RC206, and RC207. In particular, RC199 may create a policy already introduced by a later ledger statement when replayed in repository filename order, and the RC207 repository source omits a function replacement present in the recorded ledger statement. These discrepancies prevent claiming a production-equivalent rebuild.

## 5. Clean replay execution

A new S04 CI workflow was added to run the source/uniqueness audit and attempt `supabase db reset --local` against a disposable local Supabase stack. It writes a separate evidence report and uploads logs as a workflow artifact.

**Clean replay result:** `NOT VERIFIED — exact-head workflow evidence pending`  
**First replay failure:** `NOT VERIFIED — do not infer a first migration failure before the log is available`

The source audit is expected to fail closed on duplicate versions. The workflow attempts the clean replay separately to capture any CLI preflight or first migration failure.

## 6. Files changed by S04

- `scripts/audit-migration-chain-s04.mjs` — filename format, global version uniqueness, required source presence, recovered archive count, and SHA-256 inventory for target migrations.
- `.github/workflows/s04-migration-chain-clean-replay.yml` — isolated replay attempt and evidence artifact.
- `docs/release/s04-migration-chain-clean-replay-report.md` — independent report.

No changes were made to `.github/workflows/mantigo-platform-admin-scope.yml` or S02 administrative-function tests.

## 7. Safety and closure

- Production writes/migrations: **NONE**
- Applied migration history rewritten: **NO**
- PR merged / deployment performed: **NO**
- Full chronological clean replay: **NOT VERIFIED**
- Release status: **BLOCKED / NOT CERTIFIED**

Closure requires globally unique and reconciled migration versions; resolution of source/ledger semantic discrepancies; successful chronological replay from a disposable empty environment; and exact-head CI evidence. Do not skip a failed migration or mark this task complete based only on source presence.
