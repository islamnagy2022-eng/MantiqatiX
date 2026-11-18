# MantiqatiX — Supabase Free-tier continuity, backup and restore runbook

**Cost target:** 0 EGP additional recurring spend. This runbook uses the existing public GitHub repository, the existing Supabase project, and local tools only. It does not authorize a paid Supabase branch/project or any Production schema change.

## 1. What the hourly monitor checks

The existing workflow `.github/workflows/production-health-monitor.yml` is scheduled hourly at minute 17.

- GitHub Pages root and referenced assets.
- Supabase Edge Function `/functions/v1/health`.
- Database read-only connectivity through the health Edge Function after its DB-aware version is deployed.
- A temporary anonymous PostgREST read fallback against `marketing_provider_profiles` remains active only while the deployed health function returns its legacy runtime-only response.

The DB-aware health function uses the server-side `SUPABASE_SERVICE_ROLE_KEY` to execute a single-column, one-row read from `public.businesses`. A read-only Production privilege check confirmed `service_role` has SELECT on this table. The public endpoint returns only a fixed status and probe mode; it never returns business rows, user data, SQL errors, or credentials. It responds with HTTP 503 and a generic degraded status when the database read fails.

### RC479 rollout order — do not reorder

1. Merge the DB-aware health-function source and monitor compatibility update.
2. Deploy only the reviewed `health` Edge Function and verify its response includes `"database":{"status":"ok","mode":"service_role_read_only"}`.
3. Confirm the hourly Production Health Monitor reports `SUPABASE_DATABASE_READ_ONLY_PROBE=PASS (Edge service-role)` and no longer takes the anonymous fallback.
4. Only after those checks, and after the separate backup/restore release gate, apply RC479 to revoke anonymous SELECT on `marketing_provider_profiles`.
5. Re-run the monitor and confirm the database probe remains green with no anonymous base-table access.

Until step 2 is verified, the workflow intentionally falls back to the existing anonymous PostgREST probe so merging source does not break the currently deployed monitor. This fallback must be retired after the DB-aware Edge deployment and before RC479 is applied.

## 1.1 Monitoring limits and security boundary

- A successful probe confirms only that one minimal database read succeeded at that moment. It does not certify Auth, RLS isolation, RPC behavior, payments, financial workflows, or the full application.
- The hourly GitHub Actions schedule can be delayed and cannot guarantee that a Supabase Free project will never pause. If the project has already paused, this monitor cannot itself resume it.
- The health endpoint is public by design and returns only fixed status metadata. It must never return database rows, provider/customer identifiers, SQL text, credentials, or raw exception messages.
- Workflow failure notifications depend on repository notification settings. Check the Actions page after the first scheduled run and ensure failure notifications are enabled.
- RC479 is not an isolated one-off migration. The live migration ledger and required release manifest must first be reconciled semantically in chronological order. The current release gate remains BLOCKED until all predecessor migrations, encrypted backup, disposable restore rehearsal, rollback plan, and approval are verified.

## 2. Create a local logical backup (owner/operator action required)

The connected session does not have the Production database password or connection string, so no backup can safely be created by the assistant. Run these commands on an authorized computer with the Supabase CLI and Docker available.

1. In Supabase Dashboard, open the existing Production project's **Connect** panel and copy its database connection string. Do not paste it into chat, source files, GitHub issues, or workflow YAML.
2. Open a private terminal on the authorized computer and set the connection string in the current shell without saving it to the repository:

```bash
read -rsp "Production database URL: " SUPABASE_DB_URL
echo
export SUPABASE_DB_URL
```

3. Create a private backup directory and export roles, schema, and data separately:

```bash
umask 077
BACKUP_DIR="$HOME/MantiqatiX-private-backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

supabase db dump --db-url "$SUPABASE_DB_URL" -f "$BACKUP_DIR/roles.sql" --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$BACKUP_DIR/schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$BACKUP_DIR/data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"

sha256sum "$BACKUP_DIR"/*.sql > "$BACKUP_DIR/SHA256SUMS"
unset SUPABASE_DB_URL
```

The CLI's default schema dump excludes Supabase-managed schemas such as `auth` and `storage`; this backup is therefore not, by itself, proof of a complete Supabase project restore. Storage object files are also separate from database metadata. Review the official Supabase restore guide for the exact project's extensions, Auth/Storage customizations, encryption configuration, and migration-history requirements before claiming recoverability.

**Data protection**
- `data.sql` contains production data and may include personal or sensitive information. Keep the directory private and encrypt the backup before copying it to removable/off-site storage.
- Never commit backup files to this public repository. Do not upload them as GitHub Actions artifacts.
- Keep at least two protected copies on separate media if available; record creation time, size, checksum, and retention/deletion date.
- A checksum detects accidental corruption; it is not encryption.

## 3. Restore rehearsal — disposable local target only

Do not restore over Production. Use a disposable local PostgreSQL/Supabase environment and an authorized local connection.

- Restore roles/schema/data following Supabase's official restore sequence and review default privileges before applying.
- Recreate required extensions and review any custom objects in managed `auth`/`storage` schemas separately.
- Validate migration history only after comparing it with the authoritative live ledger; never fabricate migration rows or replay historical migrations against Production.
- Verify RLS and FORCE RLS, policies, grants, SECURITY DEFINER search paths, critical RPC signatures, Edge Function dependencies, and the application connection path.
- Run only deterministic test data in the disposable target. Never create test payments, refunds, settlements, or journal postings in Production.
- Record elapsed restore time and the latest recoverable backup timestamp. Only then can RTO/RPO be measured.

## 4. Recovery response if the project is paused

1. Open Supabase Dashboard and inspect the project status; use the official Resume action if Supabase reports it paused.
2. Wait until the project reports healthy, then rerun the GitHub **Production Health Monitor** workflow manually.
3. Confirm the database REST probe, Edge runtime, site root, and assets all pass.
4. Test a real but non-mutating sign-in/session read and public catalog read from the deployed site.
5. Record the incident start/end time and any data gap. Do not assume that a green Pages deployment means Supabase is healthy.

## 5. Official references

- [Supabase CLI — db dump](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Supabase backup and restore with the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)

**Current status (2026-10-31):** Supabase reports the project `ACTIVE_HEALTHY`, and a direct read-only SQL `SELECT 1` succeeded at `2026-10-31 01:57:01.957862+00 UTC` (evidence: `docs/audits/DB_CONNECTION_PROBE_20261031.md`). This confirms database connectivity at that instant, not the scheduled GitHub Actions PostgREST probe. The latest run [41160088237](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41160088237) verified the PostgREST probe. Failure-notification delivery remains NOT VERIFIED. No Production backup or restore rehearsal has yet been evidenced. Production remains **BLOCKED / NOT CERTIFIED**.


## Current-main verification update — 2026-10-31 02:30 UTC

The latest current-main Production Health Monitor run [41160201368](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41160201368) completed successfully. Job `124415873930` logged `SUPABASE_DATABASE_READ_ONLY_PROBE=PASS`; the PostgREST GET returned HTTP 200. The same run verified the primary catalog root/assets and Edge health endpoint. This is point-in-time evidence, not an uptime guarantee and not proof that failure notifications are delivered.

The latest Pages deployment [41160201369](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41160201369) also completed successfully, including deployed-origin browser E2E. Its full-platform verifier still returned `FULL_PLATFORM_GATE=BLOCKED` while the scoped catalog pilot returned PASS. These results do not replace the required local Production backup and disposable restore rehearsal. No Production mutation was performed; no paid resources were created.


## Current Production release checkpoint — 2026-11-18

A fresh read-only Supabase migration-ledger query after PR #776 merged returned **310 rows**, latest version `20261110150618`. The canonical release manifest now lists 54 required source migrations through RC475; **0/54** are recorded in the current live ledger. This is an explicit release blocker, not a reason to insert migration-history rows or replay migrations against Production.

The RC475 migration and its Edge source have passed disposable PostgreSQL integration, two-session concurrent replay, and an 89-migration forward replay from the captured Production schema checkpoint. These CI results do not apply the migration or deploy the Edge Function to the live project.

**Current gate:** Production remains **BLOCKED / NOT CERTIFIED** until an authorized operator creates an encrypted off-site logical backup, completes a disposable restore rehearsal, and records RTO/RPO. The assistant still has no Production database password or connection string. Do not paste credentials into chat or commit them to GitHub. No Production migration, Edge deployment, Auth/RLS/GRANT change, payment or financial mutation was performed in this checkpoint.
