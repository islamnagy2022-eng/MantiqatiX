# MantiqatiX Production Backup, Restore and Rollback Drill

**Production:** \`MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu\`  
**Region / database:** \`us-east-2 / PostgreSQL 17.6.1.155\`  
**Status:** **BLOCKED — organization plan is Free; no automatic daily database backup is included, and no retrievable owner-created export or restore drill has been demonstrated.**  
**Rule:** This runbook prepares a safe owner-controlled drill. It does not authorize a Production write, create a paid Supabase branch, or ask anyone to paste credentials into GitHub/ChatGPT.

## A. Evidence to collect before release

1. **Plan and automated-backup evidence**
   - Connected organization read-back on 2026-11-25 confirms organization \`manteqti\` is on the **Free** plan. Supabase's current Free-plan policy does not include automatic daily database backups; owner-run CLI exports are required.
   - Record any existing owner-created export's timestamp, location, size, SHA-256 and retrieval proof. The connected tools do not expose a backup inventory, so do not infer that a manual backup exists—or that it does not—without artifact evidence.
   - Do not upgrade the plan or create billable resources as part of this runbook. Evaluate paid backup retention separately with explicit cost approval if the owner chooses that path.
   - Capture only metadata (timestamps, artifact IDs, sizes, SHA-256, retention); never place database passwords or secret values in this repository.

2. **Database export**
   - Use an owner workstation with Supabase CLI and a protected environment variable. Do not pass credentials as command-line literals or commit .env files.
   - The following is a template only; the owner must substitute the protected connection URL locally:

        umask 077
        mkdir -p "$BACKUP_DIR"
        supabase db dump --db-url "$SUPABASE_DB_URL" --role-only -f "$BACKUP_DIR/roles.sql"
        supabase db dump --db-url "$SUPABASE_DB_URL" -f "$BACKUP_DIR/schema.sql"
        supabase db dump --db-url "$SUPABASE_DB_URL" --use-copy --data-only -f "$BACKUP_DIR/data.sql"
        sha256sum "$BACKUP_DIR/roles.sql" "$BACKUP_DIR/schema.sql" "$BACKUP_DIR/data.sql" > "$BACKUP_DIR/SHA256SUMS"

   - Confirm the dump contains required application schemas, migration ledger, Auth data required by the recovery plan, Storage metadata and RLS/policy/ACL definitions. Review CLI output and object exclusions; do not infer coverage solely from the exit code.
   - Encrypt artifacts with an owner-controlled key/KMS and copy them to an off-site location with restricted, audited access. Keep a separate copy of the key under dual control.

3. **Storage object export — separate from DB**
   - Export every bucket's object bytes, not just rows in storage.objects.
   - Produce a manifest containing bucket, object key, content type, size, ETag/version (where available), object metadata and SHA-256 of downloaded bytes.
   - Verify object count, total byte size and all checksums after upload to the off-site backup location. Test retrieval of representative small, large and private objects.
   - Preserve bucket visibility and policy definitions through the database schema dump; keep actual object files in the separate encrypted export.

4. **Auth, Vault and platform configuration**
   - Record Auth users/identities coverage from the database export without exposing personal data in GitHub.
   - Separately capture provider enablement, OAuth client/secret references, redirect allow-list, Site URL, SMTP sender/configuration, email templates/hooks, MFA settings, session/security settings, JWT signing-key recovery procedure and relevant project-level configuration.
   - Enumerate required secret names for Edge Functions, webhooks, payment providers, push dispatch, SMTP, OAuth and external integrations. Store values only in the owner's secret manager; never copy values to the repository or audit report.
   - Confirm Vault data and encryption-key recovery independently. A database dump alone must not be treated as proof that external keys or encrypted application secrets are recoverable.
   - Export Edge Function source/version/verify_jwt metadata and deployment configuration. Verify every required function can be reconstructed from canonical source plus owner-held secret references.

## B. Isolated restore

1. Restore into an owner-controlled disposable PostgreSQL 17 target or local environment. Do not use the Production project as the target. Do not create a paid Supabase branch merely to satisfy this document.
2. Verify PostgreSQL major/minor compatibility, required extensions, collations, roles and permissions before replay.
3. Restore roles, schema and data in the documented order with stop-on-error behavior. Resolve restore warnings explicitly; do not ignore missing extensions, failed grants, invalid policies, triggers or functions.
4. Restore Storage buckets/metadata and upload the separately exported object bytes; verify checksums and representative private/public access behavior.
5. Reconnect Auth/Edge/Vault settings only through controlled owner credentials in the isolated environment. Confirm that no real payment provider credential points at live-money flows.
6. Run:
   - exact 82-source migration identity/effect reconciliation;
   - chronological forward replay and PostgreSQL 17 integration tests;
   - RLS/ACL/function-owner/search_path checks, including positive platform-admin and negative tenant-admin cases;
   - Paymob altered-merchant_order_id negative replay (standard, digital page and subscription), with equal-amount/currency orders A/B and zero writes to the wrong order;
   - subscription idempotency, encrypted checkout-secret recovery and failed-payment processing;
   - financial journal balance/line numbering and service-role boundary;
   - ERP purchase-line receive limits, duplicate receipt prevention and inventory accounting invariants;
   - Storage public/private visibility, consent and directory fail-closed behavior;
   - deployed-origin-equivalent browser/API E2E for catalog, directory, accounts, admin, orders and mobile layouts.

## C. Rollback proof and RPO/RTO

- Record backup start/end, artifact sizes, encrypted copy completion, restore start/end and all failed/retried steps.
- Measure RPO as the elapsed time from the last recoverable data point to the incident target. Measure RTO from restore initiation to a verified usable service.
- Test rollback of the proposed migration/Edge release in the disposable target, including database restore and Edge version rollback. Verify the prior application can operate against the restored schema and data.
- Keep pre-release and post-release smoke tests, SQL evidence, CI run IDs, checksums and approver identity in the owner-controlled release packet.

## D. Production release gate

Production approval remains blocked until:
- backup artifacts are encrypted, off-site, retrievable, checksummed and owner-controlled;
- Storage object bytes and metadata are recoverable;
- Auth identities/configuration, Vault keys, external secrets and Edge configuration have documented recovery paths;
- a disposable PostgreSQL 17 restore is clean and reproducible;
- measured RPO/RTO and rollback evidence meet the owner's recovery target;
- the exact ordered 82-source migration effects, RPC signatures, owners, search_path, ACL, RLS/policies, constraints and triggers reconcile;
- the coordinated database + Edge plan passes exact-head and deployed-origin negative/positive tests;
- the owner explicitly approves the exact Production release commit, migration list, deployment list, backup artifact and rollback steps.

**Current decision:** no Production SQL/migration, Auth, RLS/GRANT, Storage, Vault, Edge, payment, settlement or website deployment change is authorized by this runbook.
