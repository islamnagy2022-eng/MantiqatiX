# Production migration source inventory gap — 2026-10-13

## Observed counts

- Supabase production migration ledger: **283 recorded migration rows**.
- Repository `supabase/migrations` on PR #218 head `308676ead3cf40d29f478f0a5da99b4f380772d4`: **160 SQL migration files**.
- Source files with filename timestamps at or before the live ledger ceiling `20261008222845` (RC424): **126**.
- Source files after that ceiling: **34** (forward/release candidates, including RC522/RC523).
- The repository has no `supabase/config.toml` and no separate migration archive directory at the inspected `supabase/` root.

## Interpretation

The 283-row production ledger cannot be fully replayed from the current 160-file migration directory as-is. By filename timestamp count, at least 157 live ledger rows do not have a same-range source file available in the current directory before any historical aliases are reconciled. This is a **count-based inventory gap**, not yet a per-version definitive missing-source list: legacy aliases and bundled/renamed migrations must be reconciled against the authoritative migration ledger before assigning each row.

The existing RC424 alias is known: ledger version `20261008222845`, source filename version `20261009010000`, with exact statement comparison previously verified. Do not rewrite the applied ledger or rename historical migrations to hide the mismatch.

## Required next steps

1. Retrieve a complete read-only export of `supabase_migrations.schema_migrations` including version, name, and stored statements.
2. Reconcile every ledger row to the exact source statement/file; classify exact match, known alias, source absent, source differs, or multi-statement/bundled.
3. Recover only authentic historical sources from trusted repository history/backups. Never generate stubs or infer missing historical DDL.
4. Once the historical source chain is complete, run the complete ordered replay in a disposable Supabase/PostgreSQL environment and fix only reproducible failures.
5. Keep production blocked until full replay, required forward migrations, E2E, security, backup/restore, and rollback evidence pass.

**Current status: BLOCKED / NOT CERTIFIED.** No production mutation was made while measuring this gap.


## RC545 — Ledger-derived source recovery archive — 2026-10-13

- Read-only inspection confirmed the production migration ledger has **283/283 rows with stored statement arrays**; 272 rows have one stored statement and 11 rows have multiple statement elements.
- The current tracked migration directory has 160 files. A comparison by exact filename version or exact suffix name found 185 ledger rows with neither an exact version match nor an exact suffix-name match; some may still map to renamed/timestamp-alias source files and must be reconciled by statement comparison before declaring them missing.
- Restored the first **33/185 = 17.8%** of these candidate historical sources to `supabase/recovered-migrations/`, using only the SQL statement arrays read from the production ledger. Multi-statement arrays were reconstructed with statement terminators; these are ledger-derived archive files, not claimed byte-for-byte originals.
- All 33 recovered files passed a lightweight recognizable-secret pattern scan; no matching secret pattern was found. This is not a substitute for a full secret review or SQL execution test.
- The archive is intentionally outside `supabase/migrations/` so Supabase CLI will not execute duplicate/alias migrations automatically. No production migration or database write occurred.
- A further bulk source-write batch was denied by repository write safeguards; no alternate route was used to bypass that denial. Continue with reviewed batches only if the permitted repository write path allows them.
- Next: reconcile the 98 name-matched live rows against their stored statements, verify archive file contents, and build a disposable chronological replay only after aliases and source order are proven.
