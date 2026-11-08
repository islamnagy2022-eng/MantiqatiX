# Migration source-alias verification — 2026-11-06 15:55 UTC

## Purpose

Resolve the two migration source aliases currently listed in `docs/release/production-migration-reconciliation.json` without writing to the Production migration ledger or executing duplicate SQL.

## Results

Both duplicate source aliases are now **confirmed by exact content evidence**:

| Source version | Existing Production ledger version | Evidence | Source/effect match | Ledger repair |
|---|---|---|---|---|
| `20261009010000` RC424 | `20261008222845` | Source commit/blob SHA `49f46e3e159e6306534adbf61f626901c2d73488`; live stored statement count 1, 7,208 bytes | Exact stored statement equality — TRUE | NOT APPLIED |
| `20261027100000` marketing contact details | `20261027041411` | Both source files resolve to Git blob SHA `1b85c341c0c9329e71f4fdbf36f2f852687994aa`; live target row has 1 statement, 1,114 bytes; MD5 `d09b822bea5dfc5e3e4103dcfa02601c` | Exact live statement equality against source 20261027100000 — TRUE | NOT APPLIED |

For the second alias, Git tree inspection of `main` returned identical blob SHAs for:
- `supabase/migrations/20261027041411_mantiqatix_marketing_contact_details.sql`
- `supabase/migrations/20261027100000_mantiqatix_marketing_contact_details.sql`

A read-only SQL comparison of `supabase_migrations.schema_migrations.statements[1]` at ledger version `20261027041411` against the complete source file returned `exact_source_match=true`, with exactly 1,114 bytes on both sides. The source filename version `20261027100000` is therefore a duplicate alias of the already-recorded `20261027041411` migration, not independent work missing from the live database.

## Interpretation

- Source-alias identity/effect evidence is now confirmed for **2/2** expected aliases.
- Production migration-ledger repair remains **0/2** and was intentionally not attempted.
- Keep `resolved_aliases=0` when that field means formal ledger repair applied; use `source_confirmed_aliases=2` to represent the read-only evidence result.
- Do not insert synthetic migration history rows, change existing ledger version identities, or execute either alias as a new migration.
- Formal migration history reconciliation is a distinct Production write. It remains pending a verified current backup/restore, completed chronological rehearsal, reviewed repair plan, rollback evidence, and explicit release approval.

## Side effects

Read-only GitHub source/tree inspection and read-only Supabase catalog/ledger SELECTs only. **No production write, migration, function deployment, Auth/RLS/GRANT change, financial operation, or business-data mutation occurred.**
