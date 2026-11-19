# Production Backup, Storage Export and Restore-Rehearsal Runbook

**Created:** 2026-11-19  
**Project plan verified:** Free  
**Database engine:** PostgreSQL 17  
**Release status:** BLOCKED until an encrypted backup and isolated restore rehearsal are completed.

## 1. Why this runbook is required

The connected Supabase organization reports the `free` plan. Supabase documents automatic daily database backups for Pro, Team and Enterprise projects; Free projects should regularly export their data with the CLI and maintain off-site backups. PITR is a paid add-on and is not assumed available here.

A database dump alone is not a complete project backup:
- Supabase database backups include Storage metadata, not the actual Storage object files.
- Edge Functions, Auth provider settings/API keys, Realtime settings, extensions and project configuration need separate capture/reconfiguration.
- Supabase Storage S3 compatibility does not provide S3 object versioning; an independent off-site copy is required.

Official references:
- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Download Storage Objects](https://supabase.com/docs/guides/storage/management/download-objects)
- [Supabase Storage S3 Compatibility](https://supabase.com/docs/guides/storage/s3/compatibility)

## 2. Safety rules

1. Do not run restore commands against the Production connection string.
2. Restore rehearsals must target a separate disposable Supabase project with PostgreSQL 17.
3. Do not paste database passwords, Supabase access tokens, service-role keys, S3 secrets, OAuth secrets or JWT secrets into ChatGPT, GitHub issues, source files or terminal transcripts.
4. Do not commit dump files, encrypted backup artifacts, credentials or private encryption keys to this repository.
5. Use an encrypted workstation volume or restricted temporary directory. Encrypt each dump immediately and securely remove plaintext after verification.
6. Store encrypted artifacts outside the Supabase organization/account. Keep the decryption key separate from the backup storage account.
7. No Production migration is authorized by completion of this runbook. Production rollout still requires a separate approved release window.

## 3. Database export

Run from a trusted workstation with Docker and the Supabase CLI installed. Use the Session Pooler connection string from the Supabase **Connect** panel unless direct IPv6 connectivity is known to work. Keep shell tracing disabled (`set +x`) and load the connection string from a protected secret store or ephemeral environment variable.

The following is the documented three-part logical export. The CLI applies Supabase-specific filtering and should be used instead of raw `pg_dump` for this managed project.

```bash
umask 077
mkdir -p "$BACKUP_DIR/database"
chmod 700 "$BACKUP_DIR" "$BACKUP_DIR/database"

supabase db dump --db-url "$DATABASE_URL" \
  -f "$BACKUP_DIR/database/roles.sql" --role-only

supabase db dump --db-url "$DATABASE_URL" \
  -f "$BACKUP_DIR/database/schema.sql"

supabase db dump --db-url "$DATABASE_URL" \
  -f "$BACKUP_DIR/database/data.sql" --use-copy --data-only \
  -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

Do not run the commands with shell tracing enabled. Do not include the expanded connection string in logs.

Record a read-only source snapshot before and after the dump:
- UTC start/end timestamps.
- Git `main` commit SHA and required migration inventory version.
- PostgreSQL server version.
- Row counts for critical business tables, `auth.users`, financial journals, wallet ledgers, orders and payment intents.
- Count of schemas, tables, views, functions, triggers, RLS policies and extensions.
- Any export warnings or failures.

## 4. Encrypt and verify database artifacts

Use an approved asymmetric encryption tool such as age or GPG. The recipient/public encryption key belongs in the backup operator's secure environment; the private decryption key must be stored separately under restricted access.

Example using age and a preconfigured recipient public key:

```bash
age -r "$BACKUP_AGE_RECIPIENT" \
  -o "$BACKUP_DIR/database/roles.sql.age" "$BACKUP_DIR/database/roles.sql"
age -r "$BACKUP_AGE_RECIPIENT" \
  -o "$BACKUP_DIR/database/schema.sql.age" "$BACKUP_DIR/database/schema.sql"
age -r "$BACKUP_AGE_RECIPIENT" \
  -o "$BACKUP_DIR/database/data.sql.age" "$BACKUP_DIR/database/data.sql"

sha256sum "$BACKUP_DIR/database/"*.sql.age \
  > "$BACKUP_DIR/database/SHA256SUMS"
```

Verify each encrypted file can be decrypted into a protected temporary directory and that the resulting SQL files are non-empty. Do not upload plaintext SQL. Remove plaintext only after successful encryption, checksum verification and restore-test preparation.

## 5. Export Storage objects separately

The database dump contains Storage metadata, not the actual object bytes. Export every production bucket through the Storage S3-compatible endpoint or the Supabase Storage CLI.

1. In Supabase Dashboard, open **Storage → Configuration → S3**.
2. Enable S3 protocol if it is not already enabled, create a dedicated least-privilege access key/secret, and store the secret securely. It is shown only once.
3. Read the exact endpoint and region from Storage settings.
4. Use AWS CLI, rclone or Cyberduck to download all buckets. Do not use `--delete` for this export.

Example AWS CLI pattern (replace placeholders using values from the dashboard):

```bash
aws s3 sync "s3://$BUCKET_NAME" "$BACKUP_DIR/storage/$BUCKET_NAME" \
  --profile "$SUPABASE_S3_PROFILE" \
  --endpoint-url "$SUPABASE_S3_ENDPOINT" \
  --region "$SUPABASE_S3_REGION"
```

For multiple buckets, repeat and record each bucket's object count and total bytes. Compare the downloaded object inventory with the database's `storage.objects` metadata. Investigate missing or extra objects before marking the backup complete.

Archive and encrypt the storage export:

```bash
tar -czf "$BACKUP_DIR/storage-objects.tar.gz" -C "$BACKUP_DIR" storage
age -r "$BACKUP_AGE_RECIPIENT" \
  -o "$BACKUP_DIR/storage-objects.tar.gz.age" \
  "$BACKUP_DIR/storage-objects.tar.gz"
sha256sum "$BACKUP_DIR/storage-objects.tar.gz.age" \
  >> "$BACKUP_DIR/SHA256SUMS"
```

Do not assume Storage object versioning is available; Supabase documents that S3 versioning is not supported by its Storage endpoint.

## 6. Capture non-database configuration

Create a configuration inventory with values redacted:
- Edge Function names, deployed versions, source commit, `verify_jwt` settings and required secret *names* (never secret values).
- Auth providers enabled, OAuth redirect URLs, site URL, SMTP configuration, MFA/security settings and CAPTCHA configuration.
- Realtime publications and settings.
- Installed Postgres extensions and version.
- Storage bucket names, public/private status, size/file limits and policies.
- Webhooks, scheduled jobs, custom domains, CORS, network restrictions and project-level settings.
- API key inventory and rotation plan; do not export secrets into the manifest.

Edge Function source is preserved in the repository; the deployment configuration and secret values must be restored separately from the approved secret manager.

## 7. Create an off-site backup manifest

The manifest must contain only non-secret metadata:
- Project identifier (not database URL or credentials).
- Backup UTC start/end timestamps.
- Source PostgreSQL version and `main` commit SHA.
- Names, byte sizes and SHA-256 hashes of encrypted database and Storage artifacts.
- Storage bucket object counts and byte totals.
- Encryption algorithm and recipient/key identifier (never private key material).
- Backup destination, access-control owner and retention/expiry date.
- Operator, reviewer and restore-rehearsal reference.

Upload only encrypted artifacts, checksums and the non-secret manifest to a separate off-site storage account. Confirm download access from a second trusted environment.

## 8. Restore rehearsal — disposable project only

Create a separate temporary Supabase project running PostgreSQL 17. Configure required extensions and platform services first. Never point these commands at Production.

1. Download the encrypted artifacts from off-site storage and verify their SHA-256 hashes.
2. Decrypt into a protected temporary directory.
3. Restore roles, schema and data in order. The Supabase guide uses `psql` with `--single-transaction`, `ON_ERROR_STOP` and `session_replication_role=replica` during data import to avoid trigger side effects such as double encryption.

Example restore pattern:

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$RESTORE_DIR/roles.sql" \
  --file "$RESTORE_DIR/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$RESTORE_DIR/data.sql" \
  --dbname "$RESTORE_DATABASE_URL"
```

4. Recreate Storage buckets/configuration as required, then upload the separately backed-up objects to the disposable project's S3 endpoint.
5. Reconfigure Auth providers, redirect URLs, SMTP, API keys, Edge Functions, secrets, Realtime, webhooks and scheduled jobs using the approved configuration inventory.
6. Reset custom database-role passwords if applicable; Supabase documents that daily backups do not include custom-role passwords. Never copy Production secrets into an untrusted test environment.

## 9. Restore acceptance tests

The restore rehearsal is not complete until all of these are recorded:

- Database connection and PostgreSQL 17 version verified.
- All expected schemas, tables, views, functions, triggers, extensions and migration ledger rows restored.
- Critical table row counts match the source snapshot within documented expected drift.
- Auth user count and representative authentication records verified without exposing credentials.
- RLS enabled/forced flags, policy counts and policy expressions match the source snapshot.
- Function owners, SECURITY DEFINER flags, `search_path`, EXECUTE grants and table ACLs match the source inventory.
- Financial invariants reconcile: journal debits/credits balance; wallet balances reconcile to immutable transactions; payment intents and provider events are consistent; orders and inventory invariants hold.
- Storage object counts and total bytes match; sampled files can be read and checksums match.
- Edge Functions, Auth redirects, CORS, webhooks and Realtime smoke tests pass in the disposable environment.
- Restore duration and data recovery point are recorded. Calculate measured RTO and RPO; do not estimate them without a completed rehearsal.
- Reviewer signs off the manifest and evidence bundle.

## 10. Production release gate

RC484 and the other required migrations remain source-only until:
- encrypted database and Storage backups exist off-site;
- checksum/decryption verification passes;
- isolated restore rehearsal passes with measured RPO/RTO;
- rollback/recovery plan is approved;
- the full ordered 64-version migration chain and live schema drift are reconciled;
- payment/finance/Edge/Auth/Storage acceptance is complete;
- the release owner explicitly approves the Production window.

After the approved rollout, re-read the live migration ledger, RC484 function definition/ACL/search_path, registry FORCE-RLS state, and all 57 dependent policies. Test tenant ADMIN and tenant SUPER_ADMIN cross-tenant denial and registry-only platform-root access. Keep P0 issue #867 open until this live evidence is attached.
