# RC52 — Migration Ledger Reconciliation Decision

Date: 2026-10-13  
Project: `moyhiluyhjsujhwlyeuu`  
Repository: `islamnagy2022-eng/MantiqatiX`

## Observed discrepancy

- Read-only Supabase migration ledger contains version `20260927140545` with name `remove_anonymous_sensitive_policy_access_v2`.
- The tracked source path is `supabase/migrations/20260927140500_remove_anonymous_sensitive_policy_access_v2.sql`.
- Existing RC51 and RC42 evidence already records this mismatch. A matching migration name does not establish byte-identical deployed SQL or prove historical equivalence.
- The tracked SQL alters policy `Providers view assigned projects` on `public.marketing_project_participants`; clean chronological replay fails because that table is absent at that point.

## Guardrail test result

PR #240 proposed renaming the historical source file to the ledger version. Exact-head CI run [38408794930](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38408794930) failed the `Migration History Immutability` check. The validator invokes `git diff --name-status --no-renames`, so a rename is represented as deletion of the old migration plus addition of the new path. The guard correctly rejects deleting an existing migration.

PR #240 was closed unmerged. Do not bypass or weaken the immutable-history guard to force a filename reconciliation.

## Decision

1. Preserve the existing historical source file unchanged.
2. Do not add a duplicate copy under version `20260927140545`; it risks replaying the same policy alterations twice and would not resolve the missing table.
3. Do not modify the live migration ledger, apply a production migration, or infer deployed SQL contents from the migration name.
4. Recover an authoritative artifact that proves the applied version and exact SQL (for example, the original migration file/archive or a verified source commit/checksum) before choosing a repository reconciliation strategy.
5. Separately recover authoritative creation DDL and ordering for `public.marketing_project_participants`. The live catalog describes current state but is not historical schema provenance.
6. Keep clean replay and production release blocked until the source/ledger mapping is reviewed and the complete disposable chronological replay passes.

## Safety / status

- No production schema, data, grants, secrets, migration ledger, payment, or SMM provider was changed.
- No migration was applied; no merge to `main` or deployment occurred.
- **Release state: BLOCKED — NOT PRODUCTION CERTIFIED.**
