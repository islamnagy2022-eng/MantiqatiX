# Pass 1190–1199 — Free-plan backup and restore readiness

**Date:** 2026-11-19  
**Project:** MANTIQATIX FINAL  
**Supabase project status:** ACTIVE_HEALTHY  
**Organization plan:** Free (`tier_free`)  
**Database:** PostgreSQL 17.6.1.155  
**Production:** BLOCKED / NOT CERTIFIED. No backup or restore was executed.

## Evidence gathered

- Supabase project metadata confirms PostgreSQL 17 and ACTIVE_HEALTHY.
- Supabase organization metadata confirms the Free plan.
- Current Supabase documentation states automatic daily database backups are provided for Pro, Team and Enterprise; Free projects should export with the Supabase CLI and maintain off-site backups.
- Supabase documents PITR as an add-on for paid plans; no PITR capability is assumed for this Free project.
- Supabase database backups/dumps do not include the actual Storage object bytes. Storage metadata is in Postgres, while files must be exported separately through the Storage API or S3-compatible endpoint.
- Supabase Storage S3 compatibility does not support S3 object versioning; the off-site destination must provide independent retention/versioning.

## Work completed

- Added `docs/runbooks/PRODUCTION_BACKUP_RESTORE_RC484_20261119.md`.
- Documented the supported three-part CLI export (roles, schema, data), with Supabase-specific exclusions for vector storage metadata.
- Documented immediate encryption, SHA-256 checksums, restricted off-site storage and key separation.
- Documented a separate Storage-object export, non-database configuration inventory, isolated PostgreSQL 17 restore rehearsal, validation checks and measured RPO/RTO.
- Added an explicit rule that restore commands target only a separate disposable project; no restore or migration is authorized against Production.

Official sources:
- [Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Download Storage Objects](https://supabase.com/docs/guides/storage/management/download-objects)
- [Storage S3 Compatibility](https://supabase.com/docs/guides/storage/s3/compatibility)

## Not completed — external operator action required

No database password, connection string, S3 credentials, encryption private key or off-site storage access was available in this session. No database export, Storage object export, encrypted backup, checksum verification, off-site upload or restore rehearsal was performed.

The following release gates remain BLOCKED:
1. Execute the documented CLI dump from a trusted workstation with Docker and Supabase CLI.
2. Export all Storage buckets separately and reconcile object counts/bytes against Storage metadata.
3. Encrypt all artifacts and store them outside the Supabase organization; verify decryption and checksums from a second trusted environment.
4. Restore to a separate disposable PostgreSQL 17 project and run the complete acceptance suite.
5. Record measured RPO/RTO, rollback evidence and reviewer approval.

## Production safety

No Production migration, DDL/DML, RLS, GRANT, Auth, Storage, Edge Function, payment, wallet, settlement or user-data mutation occurred. No secrets were requested or placed in source control.

RC484 remains source-merged but not Production-applied. The live ledger remains 310 rows through `20261110150618`; RC471/RC482/RC483/RC484 remain unrecorded; registry FORCE RLS remains false; live `public.is_platform_admin()` remains SECURITY INVOKER with `search_path=public`.

**Disposition:** do not begin the ordered Production migration rollout until the external backup/restore/rollback gates above are evidenced and the release owner approves the window. P0 issue #867 remains open.
