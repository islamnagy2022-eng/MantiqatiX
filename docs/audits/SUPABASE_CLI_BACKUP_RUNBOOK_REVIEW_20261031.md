# Supabase CLI backup runbook verification — 2026-10-31

## Scope

Read-only documentation review of `docs/operations/FREE_TIER_DATABASE_CONTINUITY.md`. No database, schema, data, Auth, RLS, Edge Function, or billing changes were made.

## Official documentation checked

- CLI command reference: https://supabase.com/docs/reference/cli/supabase-db-dump
- Backup and restore using the CLI: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- Restore a Platform Project to Self-Hosted: https://supabase.com/docs/guides/self-hosting/restore-from-platform

## Findings

1. The runbook's three-export pattern is consistent with the official CLI guide:
   - `supabase db dump --db-url ... -f roles.sql --role-only`
   - `supabase db dump --db-url ... -f schema.sql`
   - `supabase db dump --db-url ... -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"`
2. The official CLI reference states that `supabase db dump` runs `pg_dump` in a container and excludes Supabase-managed schemas, including `auth`, `storage`, and extension-created schemas. Docker is therefore a prerequisite.
3. The official restore guide confirms that database dumps do not transfer Storage object files, Edge Functions, OAuth provider configuration, SMTP settings, JWT/API secrets, or custom domains. Those require separate recovery procedures.
4. The runbook correctly treats the dump as insufficient evidence of a complete restorable Supabase project and keeps backup creation and restore rehearsal as operator-owned, unverified tasks.
5. Corrected the runbook's CLI reference URL from the unrelated `supabase-inspect-db-blocking` page to the exact `supabase-db-dump` command reference. No backup command was executed because the authorized Production connection string/password is not available in this session and must remain private.

## Required next evidence

- Owner/operator creates protected role/schema/data exports on an authorized computer.
- Verify checksums and protect/encrypt the backup outside the public repository.
- Restore into a disposable local PostgreSQL/Supabase target, never over Production.
- Reconcile managed-schema customizations, extensions, Auth configuration, Storage objects, Edge Functions, and secrets separately.
- Record successful restore duration and recoverable backup timestamp before assigning measured RTO/RPO.

## Status

Documentation reference correction: **included in PR #571; documentation-only change**.

Production backup: **NOT CREATED**.
Restore rehearsal: **NOT PERFORMED**.
Production gate: **BLOCKED / NOT CERTIFIED**.
