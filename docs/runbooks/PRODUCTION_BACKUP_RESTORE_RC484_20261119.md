# Production Backup, Storage Export and Restore-Rehearsal Runbook

**Created:** 2026-11-19  
**Project plan verified:** Free  
**Database engine:** PostgreSQL 17  
**Release status:** BLOCKED until an encrypted backup and isolated restore rehearsal are completed.

## 1. Why this runbook is required

The connected Supabase organization reports the `free` plan. Supabase documents automatic daily database backups for Pro, Team and Enterprise projects; Free projects should regularly export their data with the CLI and maintain off-site backups. PITR is a paid add-on and is not assumed available here.

A database dump alone is not a complete project backup. The exact coverage depends on the backup method:
- Supabase-managed database backups do not include the bytes of objects stored through the Storage API; those objects need a separate export.
- The Supabase CLI `db dump` reference says managed schemas such as `auth` and `storage` are excluded. The separate "Restore a Platform Project to Self-Hosted" guide says `auth.users` is included. These statements are not sufficiently consistent to assume Auth table coverage: inspect the actual emitted dump and prove the required Auth tables/rows are present, or record a separately approved and encrypted Auth export/recovery path.
- Do not assume `storage.objects` metadata or bucket configuration is present in the CLI dump. Capture an independent, read-only source inventory and compare it with the separately exported Storage object bytes.
- Edge Functions, Auth provider settings/API keys, Realtime settings, extensions and project configuration need separate capture/reconfiguration.
- Supabase Storage S3 compatibility does not provide S3 object versioning; an independent off-site copy is required.

**Backup coverage rule:** a successful `supabase db dump` exit code is not proof that the Auth schema, Storage metadata, or Storage object bytes are in the backup. The actual files and isolated restore must prove each required component independently.

Official references:
- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI db dump reference — managed-schema exclusions](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Restore a Platform Project to Self-Hosted — Auth coverage guidance](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
- [Supabase Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase CLI changelog / breaking changes](https://supabase.com/changelog)
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

Run from a trusted workstation with Docker and the Supabase CLI installed. This repository's forward-replay workflow currently pins Supabase CLI **v2.122.0**; use that exact tested version for this runbook until a separately reviewed CLI upgrade updates the backup and restore tests. Verify it with `supabase --version` before running any export. Do not silently switch to CLI v3: the v3 changelog records command-default changes that can alter which target is selected, and the newer CLI reference must be reviewed before changing this procedure.

Use the Session Pooler connection string from the Supabase **Connect** panel unless direct IPv6 connectivity is known to work. Keep shell tracing disabled (`set +x`) and load the connection string from a protected secret store or ephemeral environment variable.

The following is the documented three-part logical export. The CLI applies Supabase-specific filtering; use the documented Supabase CLI instead of raw `pg_dump` for this managed project. These files are only one part of the recovery set; verify their actual schema/table coverage rather than assuming all managed schemas are included.

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

### Verify dump coverage before accepting the backup

After export and before encryption, inspect only the SQL structure/metadata needed to establish which schemas and tables are actually present. Do not print or attach production row contents, personal information, tokens, passwords, or secret values to logs, issues, ChatGPT, or repository files.

Record explicit booleans and evidence for at least:
- whether `auth.users` and `auth.identities` appear in the emitted data/schema artifacts;
- whether `storage.buckets` and `storage.objects` appear in the emitted data/schema artifacts;
- whether the relevant custom application schemas, roles, grants, RLS policies, functions and triggers are covered;
- which items require a separately approved export/reconfiguration process.

If any required table is absent, mark that component **NOT INCLUDED / NOT VERIFIED** and do not claim that the CLI dump alone backs it up. Use only an approved, encrypted, separately tested export/recovery procedure for that component. Never add production Auth rows or secrets to this repository.

Record a read-only source snapshot before and after the dump:
- UTC start/end timestamps.
- Git `main` commit SHA and required migration inventory version.
- PostgreSQL server version and exact CLI version.
- Aggregate row counts for critical business tables, `auth.users`, `auth.identities`, financial journals, wallet ledgers, orders, payment intents and Storage metadata. Counts only; do not export row contents into the manifest.
- Count of schemas, tables, views, functions, triggers, RLS policies and extensions.
- Per-component inclusion status and artifact reference.
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

Supabase-managed database backups include Storage metadata but not the actual object bytes. The Supabase CLI `db dump` reference, however, says the managed `storage` schema is excluded. Therefore, do not assume the CLI dump contains `storage.buckets` or `storage.objects`; inspect the generated artifact and use an independently captured source inventory. Export every production bucket's actual bytes through the Storage S3-compatible endpoint or the Supabase Storage CLI.

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

For multiple buckets, repeat and record each bucket's object count and total bytes. Capture a separate read-only source inventory from the project's `storage.objects` metadata; do not assume this table was included in the CLI dump. Compare the downloaded object inventory with that source snapshot. If metadata itself is absent from all backup artifacts or cannot be reconciled, mark Storage restore as NOT VERIFIED. Investigate missing or extra objects before marking the backup complete.

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

## 6. Supabase Vault key recovery

The current Production inventory contains **2 rows in `vault.secrets`** and **4 public functions referencing Vault**. The `supabase_vault` extension is installed; `pgsodium` is not installed.

Supabase documents that Vault ciphertext is preserved in database dumps, but the encryption key is stored in Supabase's secured backend systems and is not stored alongside the database data. A separate API endpoint is available for authorized key retrieval.

Before any restore:
1. Determine whether the two Vault secrets must be preserved or can be recreated.
2. If preserving them, obtain the project's Vault encryption key only through the current official Supabase Vault key API procedure. Do not guess the endpoint, expose the key in logs, or store it in this repository.
3. Store the key separately from the encrypted dump and off-site backup account. Restrict access to the designated recovery operator.
4. If the key cannot be recovered, recreate the secrets in the target project and update/redeploy the dependent functions using the approved secret source; do not assume the copied ciphertext will decrypt under the target project's different key.
5. In the restore rehearsal, verify the expected two secrets and all four dependent functions without printing decrypted secret values.

Official reference: [Supabase Vault — Encryption key location](https://supabase.com/docs/guides/database/vault#encryption-key-location).

## 7. Capture non-database configuration

Create a configuration inventory with values redacted:
- Edge Function names, deployed versions, source commit, `verify_jwt` settings and required secret *names* (never secret values).
- Auth providers enabled, OAuth redirect URLs, site URL, SMTP configuration, MFA/security settings and CAPTCHA configuration.
- Realtime publications and settings.
- Installed Postgres extensions and version. The current inventory includes `pg_net`, `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault` and `uuid-ossp`.
- Vault secret recovery/key custody and the four functions that consume Vault values.
- Storage bucket names, public/private status, size/file limits and policies.
- Webhooks, scheduled jobs, custom domains, CORS, network restrictions and project-level settings.
- API key inventory and rotation plan; do not export secrets into the manifest.

Edge Function source is preserved in the repository; the deployment configuration and secret values must be restored separately from the approved secret manager.

## 8. Create an off-site backup manifest

The manifest must contain only non-secret metadata:
- Project identifier (not database URL or credentials).
- Backup UTC start/end timestamps.
- Source PostgreSQL version, exact Supabase CLI version and `main` commit SHA.
- Names, byte sizes and SHA-256 hashes of encrypted database and Storage artifacts.
- Per-component coverage status for application schemas, roles/ACLs, Auth schema data, Storage metadata and Storage object bytes; include artifact references and restore evidence, not row contents.
- Storage bucket object counts and byte totals, compared with a separately captured source metadata inventory.
- Encryption algorithm and recipient/key identifier (never private key material).
- Backup destination, access-control owner and retention/expiry date.
- Operator, reviewer and restore-rehearsal reference.

Upload only encrypted artifacts, checksums and the non-secret manifest to a separate off-site storage account. Confirm download access from a second trusted environment.

### Automated evidence verification

The repository includes a non-mutating verifier and a non-secret manifest template:

- Template: `docs/runbooks/templates/offsite-backup-manifest.template.json`
- Verifier: `scripts/backup/verify-offsite-backup-manifest.mjs`
- Test suite: `scripts/tests/backup/verify-offsite-backup-manifest.test.mjs`

After the artifacts have been copied back from the off-site destination, complete the manifest with the real encrypted-file byte counts and SHA-256 hashes, the actual Storage bucket inventory, and the completed isolated restore evidence. Then run:

```bash
chmod 600 "$AGE_IDENTITY_FILE"
AGE_IDENTITY_FILE="$AGE_IDENTITY_FILE" \\
  node scripts/backup/verify-offsite-backup-manifest.mjs "$BACKUP_DIR/manifest.json"
```

The verifier checks the four required encrypted artifacts, age headers, exact byte counts, SHA-256, decryption using the protected recovery identity (output is discarded, never written to disk), separate Production/restore project references, PostgreSQL 17, storage inventory, measured RPO/RTO and all restore acceptance checks. It refuses secret-bearing manifest fields and unsafe artifact paths. It reads files only; it does not run a restore or connect to Production.

A successful verifier result is evidence validation, not authorization to run the Production migration release.

## 9. Restore rehearsal — disposable project only

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
5. Restore/recreate Vault secrets according to Section 6, and verify all four dependent functions without printing decrypted values.

Auth coverage is a separate acceptance component: do not infer that `auth.users` or `auth.identities` were restored merely because `schema.sql` and `data.sql` exist. First confirm the actual CLI dump coverage. If Auth data was not present, keep Auth restore status NOT VERIFIED until an approved encrypted recovery path has been completed and tested on the disposable target. Never expose user rows or credentials in logs.
6. Because `pg_net` is installed, keep outbound webhooks and scheduled jobs disabled or isolated until the restored environment is explicitly approved for external calls. The current Production inventory has one enabled `public.notifications` trigger, `mnty_notifications_push_after_insert`, which calls `mnty_push_notification_hook()` and sends to the `mnty-push-dispatch` Edge Function. In the disposable restore only, keep this trigger disabled before any test inserts; re-enable it only after Vault secrets, Edge Function configuration and network isolation are verified. Never disable or alter this trigger in Production as part of the backup rehearsal.
7. Reconfigure Auth providers, redirect URLs, SMTP, API keys, Edge Functions, secrets, Realtime, webhooks and scheduled jobs using the approved configuration inventory.
8. Reset custom database-role passwords if applicable; do not assume database exports include them. Never copy Production secrets into an untrusted test environment.

## 10. Restore acceptance tests

The restore rehearsal is not complete until all of these are recorded:

- Database connection and PostgreSQL 17 version verified. Current source baseline is approximately 28 MB, 187 user tables, 11 non-system schemas and 6 extensions; use a fresh snapshot at backup time for exact comparison.
- All expected schemas, tables, views, functions, triggers, extensions and migration ledger rows restored.
- Critical table row counts match the source snapshot within documented expected drift.
- Auth user/identity count and authentication behavior verified only when the actual backup artifacts prove that the relevant Auth records were included or a separately approved recovery path was completed. If Auth records were absent from the CLI dump and no separately tested recovery path exists, this acceptance item remains NOT VERIFIED; a CLI dump alone is insufficient evidence.
- RLS enabled/forced flags, policy counts and policy expressions match the source snapshot.
- Function owners, SECURITY DEFINER flags, `search_path`, EXECUTE grants and table ACLs match the source inventory.
- Financial invariants reconcile: journal debits/credits balance; wallet balances reconcile to immutable transactions; payment intents and provider events are consistent; orders and inventory invariants hold.
- Storage bucket/object inventory matches. At the latest read-only check there were 2 buckets and 0 object rows; recheck at backup time. Sampled files can be read and checksums match.
- The 2 Vault secrets decrypt successfully with the recovered key, or have been safely recreated; all 4 Vault-dependent functions pass without exposing secret values.
- Edge Functions, Auth redirects, CORS, webhooks and Realtime smoke tests pass in the disposable environment.
- Restore duration and data recovery point are recorded. Calculate measured RTO and RPO; do not estimate them without a completed rehearsal.
- Reviewer signs off the manifest and evidence bundle.

## 11. Production release gate

RC484 and the other required migrations remain source-only until:
- encrypted database and Storage backups exist off-site;
- checksum/decryption verification passes;
- isolated restore rehearsal passes with measured RPO/RTO;
- rollback/recovery plan is approved;
- the full ordered **78-version** exact migration chain (including RC472/RC473 directory contact-consent foundation, RC479 anonymous Auth-session guard (`20261120193000`), RC485 catalog RPC registry-root, RC486 catalog price-version, RC487 SMM bootstrap hardening, RC488–RC493 anonymous-Auth guards, RC494 settlement registry/scope hardening, and RC495 Storage filename-policy repair, plus RC496 MantiGO OFFERED-only bid acceptance and RC921 medical appointment state machine (`20261123010000`). RC479 and RC921 were added to the required release contract by merged PR #1013; their presence in source is not proof they are applied in Production) and live schema drift are reconciled;
- payment/finance/Edge/Auth/Storage acceptance is complete;
- the release owner explicitly approves the Production window.

After the approved rollout, re-read the live migration ledger, RC464/RC484/RC494 function definitions, owners, ACLs and empty search_path, registry FORCE-RLS state, RC488–RC495 RLS/Storage policy boundaries, and the RC472/RC473 consent registry. Test confirmed-user and anonymous-session behavior, tenant ADMIN and tenant SUPER_ADMIN cross-tenant denial, registry-only platform-root access, settlement scope/idempotency, and Storage filename constraints. Keep the directory-contact privacy blocker and related P0 release issues open until this live evidence is attached.
