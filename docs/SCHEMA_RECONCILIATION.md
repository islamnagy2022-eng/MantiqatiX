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
