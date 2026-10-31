# MantiqatiX — Supabase Free-tier continuity, backup and restore runbook

**Cost target:** 0 EGP additional recurring spend. This runbook uses the existing public GitHub repository, the existing Supabase project, and local tools only. It does not authorize a paid Supabase branch/project or any Production schema change.

## 1. What the hourly monitor now checks

The existing workflow `.github/workflows/production-health-monitor.yml` is scheduled hourly at minute 17.

- GitHub Pages root.
- Supabase Edge Function runtime endpoint `/functions/v1/health`.
- A separate read-only PostgREST query against `marketing_provider_profiles`, selecting only `business_id` with `limit=1`; the response body is discarded.
- Primary catalog HTML and referenced assets.

The database probe uses the public anon key already published in the frontend configuration. It does not use a service-role key, does not write data, and does not change RLS or schema. A non-200 response fails the workflow.

### Production read-path preflight (2026-10-31)

A read-only catalog query against the existing Production database confirmed:

- `public.marketing_provider_profiles` exists.
- RLS and FORCE RLS are both enabled.
- `anon` has SELECT privilege.
- An explicit `SELECT` policy applies to `anon, authenticated` for public active provider profiles.

No table rows were read during this preflight. This verifies the database-side permission contract for the probe. The deployed Production Health Monitor has since completed successful read-only PostgREST requests: run [41159666007](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41159666007) on main commit `adf0680a3c151330656b9712a03849c796aa4c09` and run [41160088237](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41160088237) on current main commit `b41c3c312e713f1975bafef6a617ad7159e1b4f8`. Both job logs emitted `SUPABASE_DATABASE_READ_ONLY_PROBE=PASS`, confirming HTTP 200 for the GET at those run timestamps.

Supabase's current inactivity guidance says a few API/database requests each day typically suffice to avoid pausing, and explicitly lists API calls as a way to generate activity. The hourly request is designed to provide that activity; it is not a guarantee against pausing or service interruptions. See [Supabase Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

**Important limits**
- A successful probe confirms that a small database-backed REST read worked at that moment. It does not certify all database functions, authentication, payments, RLS isolation, or application workflows.
- The probe may reduce the risk of an inactivity pause, but it cannot guarantee that Supabase Free will never pause. GitHub scheduled workflows can be delayed; if Supabase has already paused the project, the probe may fail and will not itself resume the project.
- The existing Edge `/health` function is a runtime ping only; it is not a database health signal.
- GitHub workflow failure notifications depend on the repository owner's GitHub notification settings. Verify that Actions failure emails/notifications are enabled and check the Actions page after the first scheduled run.

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
