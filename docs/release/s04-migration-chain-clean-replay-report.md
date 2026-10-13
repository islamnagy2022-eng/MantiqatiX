# S04 — Migration Chain & Clean Replay Report

**Audit date:** 2026-10-13  
**Repository:** `islamnagy2022-eng/MantiqaTiX`  
**PR:** [#218](https://github.com/islamnagy2022-eng/MantiqaTiX/pull/218) — open, Draft, unmerged  
**Audit commit:** `11d5eb7dc0bbbc83d1ad080656a1696b723cddc8`  
**Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Status:** `BLOCKED / NOT CERTIFIED`

## 1. Production ledger — read-only verification

A fresh read-only query of `supabase_migrations.schema_migrations` returned **283 rows**, first version `20260808000000`, latest version `20261008222845`. The latest entry remains `rc424_atomic_digital_page_payment_webhook`.

The candidate RC425–RC441, RC449, RC462, RC522, and RC523 migrations are **not proven applied**. The queried target versions were absent from the live ledger. No production migration, schema, data, permission, or migration-ledger write was performed.

## 2. Source inventory and ordering

The PR branch currently contains **160 SQL files** in `supabase/migrations/`. The requested source files RC425–RC432, RC434–RC441, RC449, RC462, RC522, and RC523 are present in the branch. RC433 has no matching migration source in the inspected inventory; this is recorded as a numbering/source gap requiring confirmation, not assumed to be an applied migration.

The source audit identified five duplicate migration-version groups. Supabase migration versions are the first 14 digits of the filename, so each group is a chain-integrity blocker:

| Duplicate version | Conflicting source filenames |
|---|---|
| `20260928020000` | `20260928020000_rc101_g6_rls_permissive_policy_hardening.sql`; `20260928020000_rc102_g8_crm_notification_support_rls_hardening.sql` |
| `20260928060000` | `20260928060000_rc109_harden_order_support_tenant_boundaries.sql`; `20260928060000_restore_registration_request_dml_grants.sql` |
| `20260928190000` | `20260928190000_rc162_mantigo_trip_state_machine.sql`; `20260928190000_rc200_cross_tenant_customer_payment_authorization.sql` |
| `20260928200000` | `20260928200000_rc164_mantigo_direct_delete_lockdown.sql`; `20260928200000_rc164_retire_legacy_mantigo_mutator.sql`; `20260928200000_rc206_geographic_ad_targeting_and_nearest_fallback.sql` |
| `20260928210000` | `20260928210000_rc172_restore_medical_booking_contract.sql`; `20260928210000_rc207_official_global_mnty_cover_ads.sql` |

Do not resolve these collisions by changing production history or by arbitrarily renaming files. Establish intended ordering and reconcile source/ledger semantics first, then make a reviewed forward-compatible correction where required.

## 3. Recovered migrations and semantic dependencies

Files under `supabase/recovered-migrations/` are an archive, not an executable migration directory. Their existence is not proof of application. Preserve this separation during replay.

The existing semantic reconciliation record also documents unresolved source-versus-ledger differences for RC169, RC172, RC199, RC206, and RC207. In particular, RC199 may duplicate a policy when replayed in repository filename order, and RC207's repository source does not include a function replacement present in the recorded ledger statement. These issues must be reconciled before claiming a production-equivalent rebuild.

## 4. Clean replay execution

A new S04 CI workflow was added to run a source/uniqueness audit and attempt `supabase db reset --local` against a disposable local Supabase stack. It writes a separate evidence report and uploads logs as a workflow artifact. The workflow's result must be read from the exact tested commit; a queued run is not a pass.

**Clean replay result:** `NOT VERIFIED — awaiting exact-head workflow evidence`  
**First replay failure:** `NOT VERIFIED — no replay result may be inferred before logs are available`

The audit script is expected to fail closed on duplicate versions. The workflow still attempts the clean replay separately so its diagnostic output can identify any CLI preflight or first migration failure.

## 5. Files changed by S04

- `scripts/audit-migration-chain-s04.mjs` — source presence, filename format, globally unique version, recovered archive count, and SHA-256 inventory for the target migrations.
- `.github/workflows/s04-migration-chain-clean-replay.yml` — isolated replay attempt plus artifact evidence.
- `docs/release/s04-migration-chain-clean-replay-report.md` — this independent report.

No changes were made to `.github/workflows/mantigo-platform-admin-scope.yml` or S02 administrative-function tests.

## 6. Safety and closure

- Production writes/migrations: **NONE**
- Applied migration history rewritten: **NO**
- PR merged / deployment performed: **NO**
- Full chronological clean replay: **NOT VERIFIED**
- Release status: **BLOCKED / NOT CERTIFIED**

Closure requires unique, reconciled migration versions; resolution of source/ledger semantic discrepancies; successful full chronological replay from a disposable empty environment; and exact-head CI evidence. Do not skip a failed migration or mark this task complete based only on source presence.
