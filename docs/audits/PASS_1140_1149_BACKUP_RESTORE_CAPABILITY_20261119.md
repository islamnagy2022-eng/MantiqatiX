# Pass 1140–1149 — Backup/restore capability and plan gate

**Date:** 2026-11-19  
**Project:** `moyhiluyhjsujhwlyeuu`  
**Production changes:** none.

## Verified environment

- Project status: `ACTIVE_HEALTHY`
- Database: PostgreSQL 17.6.1.155 (engine 17)
- Owning organization plan: **Free**
- Execution environment binaries:
  - `supabase`: unavailable
  - `pg_dump`: unavailable
  - `pg_restore`: unavailable
  - `docker`: unavailable

## Backup capability

The current Supabase Database Backups documentation states:
- Automatic daily backups are provided for Pro, Team and Enterprise projects.
- Pro daily backup retention is 7 days; Team 14 days; Enterprise up to 30 days.
- Free projects should regularly export data with Supabase CLI `db dump` and maintain off-site backups.
- Supabase database backups do not include Storage API objects.
- Restoring a database does not automatically restore Storage objects, Edge Functions, Auth settings/API keys, Realtime settings, extensions or all project configuration; these require separate handling/reconfiguration.

Official documentation: https://supabase.com/docs/guides/platform/backups

## Result

No automatic backup availability or retention has been proven for this Free-plan project. No logical export could be generated in this environment because the required CLI/database tools are absent. No isolated restore rehearsal or RPO/RTO measurement was performed.

This is a **NOT VERIFIED** release gate, not evidence of data loss. No plan upgrade, paid add-on, project/branch creation, database write, migration, restore or Storage mutation was attempted.

## Next safe actions

1. Provision an approved environment with Supabase CLI and PostgreSQL client/restore tools, plus access to an authorized Supabase Management API token or approved database connection.
2. Generate an encrypted logical export and store it off-site under controlled access; separately preserve Storage objects and relevant configuration.
3. Restore into an isolated disposable database/project, not Production.
4. Verify schema, row counts/critical invariants, Auth data, Storage objects, extensions, RLS, grants and Edge configuration.
5. Record actual restore duration, achievable RPO/RTO and rollback evidence.
6. Only then re-evaluate the Production migration/authorization release gate.

Issue #104 updated with this evidence (comment 7017966595). Full platform remains **BLOCKED / NOT CERTIFIED**.
