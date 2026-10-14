# MantiqaTix — Schema & Migration Reconciliation
**Snapshot:** 2026-10-14  
**State:** NOT VERIFIED — reconciliation must precede production migration changes.

## Production migration ledger (read-only)
- Query source: `supabase_migrations.schema_migrations`.
- Count: **283**.
- First recorded version: `20260808000000`.
- Latest recorded version: `20261008222845`.
- Latest name: `rc424_atomic_digital_page_payment_webhook`.

## Known discrepancy requiring investigation
The session log dated 2026-10-11 records migration source gaps RC425–432 and RC434–441, plus conflicting RC434 definitions in PR #202 and PR #84. This was historical evidence and must be revalidated against the current `main`, open PRs, and live ledger before any action. Do not assume the conflict has resolved merely because the ledger remains at RC424.

## Required reconciliation table
For every migration version in the live ledger and repository:
- version and canonical filename;
- presence in `main`;
- presence in every candidate PR that touches the version;
- duplicate/conflicting definitions;
- dependency/order validity;
- replay result in a disposable database;
- resulting schema/function/policy/grant diff against production;
- whether production application is authorized.

## Hard stops
- Do not apply a migration to production when the chain has missing versions, duplicate versions, competing definitions, unverified destructive effects, or unresolved dependency order.
- Do not fabricate a replacement migration from its filename or PR summary. Use authoritative source and tests.
- Do not edit historical applied migrations to “fix” drift; create a new forward migration only after the exact discrepancy and safe remediation are established.
- Do not treat `283` as proof of schema parity or migration replayability.

## Next action
Inventory repository migration filenames and all open candidate PR migration paths; compare them with the 283-row live ledger; then run duplicate/version/dependency checks and isolated replay. Keep all database work read-only until the reconciliation report is complete.


## Addendum — current-main verification (2026-10-14)
- Direct source lookups on `main` returned NOT_FOUND for the expected RC425, RC434 and RC439 migration paths. This agrees with the current release verifier's required-migration gate.
- `scripts/production/verify-production.mjs` and `scripts/validate-production-migration-chain-gate.mjs` both enumerate 28 required release migration files and require a reconciliation manifest, immutable RC424 history, chronological disposable replay, tenant isolation, payment/finance E2E, backup/restore, Edge Function contracts, SMM parity and Auth security settings before release certification.
- The existing manifest `docs/release/production-migration-reconciliation.json` records an exact statement match for RC424: ledger statement count 1, source bytes 7208, ledger statement bytes 7208, `exact_statement_match=true`, `history_rewritten=false`. The timestamp difference is recorded as a legacy version alias. Do not reopen RC424 by renaming or rewriting the applied history.
- A byte-for-byte patch comparison of RC434 in PR #84 and PR #202 returned identical patch text (7151 characters). The historical claim of a content conflict is not supported by this pairwise comparison, but overlap across all candidate PRs and migration version uniqueness still require full review.
- Current `main` still lacks required post-RC424 source files; PRs #84/#202/#207/#218 contain overlapping candidate migrations. No production application is authorized by this evidence.
- **Next executable step:** compare all 28 required filenames against main, each open candidate PR, and live ledger; verify duplicate version definitions and timestamp ordering; inspect dependency edges; then run the complete chain only in a disposable PostgreSQL/Supabase environment.
