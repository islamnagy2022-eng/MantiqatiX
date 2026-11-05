# Production read-only recheck — 2026-11-05

## Scope and safety

This report records a fresh metadata-only check of the linked Supabase Production project on 2026-11-05. The checks used read-only SQL against PostgreSQL catalog/information-schema/migration-ledger metadata and the Supabase Security Advisor.

- Database reported by Supabase: PostgreSQL 17.6.1.155; project status ACTIVE_HEALTHY.
- No application rows were selected or modified.
- No DDL, DML, migration, ledger repair, grant, RLS, Auth setting, Edge Function deployment, payment, settlement, or journal posting was performed.
- Advisor messages are findings to review, not a count of confirmed exploitable vulnerabilities.

## 1. Migration ledger — still blocked

| Check | Live result |
|---|---:|
| Recorded migration rows | 309 |
| Latest recorded version | `20261101140105` |
| Required release migration IDs | 42 |
| Exact required IDs found | **0 / 42** |
| Exact required IDs missing | **42 / 42** |

The required 42-version list is defined in `scripts/production/live-reconciliation-contract.mjs`. A fresh read-only comparison of every exact version in that list against `supabase_migrations.schema_migrations` returned no matches.

Selected critical missing versions include:

| Workstream | Version | Result |
|---|---|---|
| RC435 subscription provider-intent claim | `20261009210000` | Missing |
| RC439 encrypted checkout recovery | `20261010010000` | Missing |
| RC440 exposed SECURITY DEFINER search-path hardening | `20261010020000` | Missing |
| RC449A financial-journal schema prerequisites | `20261010175000` | Missing |
| RC450 financial-journal service-role boundary | `20261010180000` | Missing |
| RC463 trigger-only SECURITY DEFINER ACL hardening | `20261031100000` | Missing |

**Interpretation:** absent exact source-version IDs do not prove that every corresponding SQL effect is absent. Existing aliases and forward bundles must be reconciled by exact SQL/source evidence; do not rerun aliases or fabricate migration-ledger rows.

## 2. Financial-journal contract — prerequisites absent

The fresh schema check confirmed all seven RC449A fields are absent:

| Table | Required field | Present |
|---|---|---|
| `journal_entries` | `entry_number` | No |
| `journal_entries` | `total_debit` | No |
| `journal_entries` | `total_credit` | No |
| `journal_entries` | `posted_at` | No |
| `journal_entries` | `updated_at` | No |
| `journal_entries` | `reversed_by_entry_id` | No |
| `journal_entry_lines` | `line_number` | No |

The live RPC catalog returned:

| RPC | SECURITY DEFINER | service_role EXECUTE | anon EXECUTE | authenticated EXECUTE |
|---|---:|---:|---:|---:|
| `post_financial_journal(jsonb,jsonb)` | Yes | No | No | No |
| `post_financial_journal_backend(uuid,jsonb,jsonb)` | Yes | No | No | No |

Both RPCs currently expose `search_path=public`. The current production RPC privilege state therefore does not satisfy the source RC450 backend-only service-role contract. The repository's current `financial-journal` Edge Function must not be deployed separately against this live database state.

**Required order:** restorable schema/role capture → isolated RC449A schema/backfill replay → isolated RC450 RPC/ACL integration → exact live preflight → separately approved migration window → post-migration read-only checks → matching Edge rollout and signed runtime tests. No step in this report authorizes Production rollout.

## 3. RC463 trigger-function ACL — still unremediated

Both trigger-only functions were found with an attached trigger:

| Function | Trigger count | search_path | anon EXECUTE | authenticated EXECUTE | service_role EXECUTE |
|---|---:|---|---:|---:|---:|
| `assign_default_owner_to_unowned_business()` | 1 | `public, auth` | Yes | Yes | Yes |
| `capture_commission_rule_audit()` | 1 | empty | Yes | Yes | Yes |

RC463 version `20261031100000` is absent from the live migration ledger. The direct execute grants should be hardened through the reviewed trigger-only migration, while preserving trigger execution. Do not revoke access ad hoc: run the exact disposable PostgreSQL fixture/integration tests and review the migration chain, rollback, and current-schema restore first.

## 4. Supabase Security Advisor — 2026-11-05 03:31 UTC

Fresh Security Advisor output observed at approximately `2026-11-05T03:31:08Z`:

| Finding category | Count | Interpretation |
|---|---:|---|
| RLS enabled, no policy | 9 | INFO-level table findings; review table grants and intended private/backend-only access |
| Anon can execute SECURITY DEFINER | 3 | Two are the trigger-only functions above; the third is `get_mnty_targeted_advertisements`, an intentional public discovery RPC that must not be blanket-revoked |
| Authenticated can execute SECURITY DEFINER | 67 | Requires function-by-function authorization/ACL review; not 67 confirmed vulnerabilities |
| Anonymous-access policy findings | 90 | Review intended public reads versus sensitive tenant data; Advisor findings are not exploit proofs |
| Leaked Password Protection disabled | 1 | Auth hardening remains open; obtain owner-dashboard configuration evidence before changing it |

The 9 no-policy findings and anonymous-policy findings must be reviewed against actual table grants and business access contracts. Do not blanket-add policies or revoke intended public discovery access to make Advisor counts smaller.

## 5. Release disposition

- `CATALOG_PILOT_GATE=PASS` remains the last separately verified scoped catalog-release status; this read-only recheck did not re-run the deployed-origin catalog suite.
- `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED` remains unchanged.
- Payment/order/finance Edge Functions remain a coordinated dependency group and must not be deployed one at a time.
- Subscription checkout RC435/RC439, signed Paymob E2E, refunds/settlements/journal reconciliation, tenant/adversarial RLS tests, managed Auth hardening, backup/restore, measured RPO/RTO, rollback, and SMM negative runtime evidence remain outstanding.
- The 100M-user, 500k-VU, 99.95% availability, and RPO/RTO claims remain unverified without reproducible raw test and restore evidence.

## Reproducibility references

- Exact required version contract: `scripts/production/live-reconciliation-contract.mjs`
- RC449A runbook: `docs/runbooks/RC449A_FINANCIAL_JOURNAL_SCHEMA_PREREQUISITES.md`
- RC450 rollout runbook: `docs/runbooks/RC450_FINANCIAL_JOURNAL_ROLLOUT.md`
- Current production recheck before this snapshot: `docs/audits/PRODUCTION_RECHECK_20261104.md`
- RC463 disposable security ACL work: PR #602 / related issue thread.

**Production effect of this report: none.**
