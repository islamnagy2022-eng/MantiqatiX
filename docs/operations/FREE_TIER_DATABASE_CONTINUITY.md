# MantiqatiX — Supabase Free-tier continuity, backup and restore runbook

**Cost target:** 0 EGP additional recurring spend. This runbook uses the existing public GitHub repository, the existing Supabase project, and local tools only. It does not authorize a paid Supabase branch/project or any Production schema change.

## 1. What the hourly monitor now checks

The existing workflow `.github/workflows/production-health-monitor.yml` is scheduled hourly at minute 17.

- GitHub Pages root and referenced assets.
- Supabase Edge Function `/functions/v1/health`.
- Database read-only connectivity through the health Edge Function after its DB-aware version is deployed.
- A temporary anonymous PostgREST read fallback against `marketing_provider_profiles` remains active only while the currently deployed health function returns its legacy runtime-only response.

The DB-aware health function uses the server-side `SUPABASE_SERVICE_ROLE_KEY` to execute a single-column, one-row read from `public.businesses`. Production ACL inspection confirmed `service_role` has SELECT on this table. The endpoint returns only `database.status` and a fixed probe mode; it never returns business rows, user data, SQL errors, or credentials. It responds with HTTP 503 and a generic degraded status when the database read fails.

### RC479 rollout order — do not reorder

1. Merge the DB-aware health-function source and monitor compatibility update.
2. Deploy only the reviewed `health` Edge Function and verify its public response includes `"database":{"status":"ok","mode":"service_role_read_only"}`.
3. Confirm the hourly Production Health Monitor reports `SUPABASE_DATABASE_READ_ONLY_PROBE=PASS (Edge service-role)` and no longer takes the anonymous fallback.
4. Only after those checks, and after the separate backup/restore release gate, apply RC479 to revoke anonymous SELECT on `marketing_provider_profiles`.
5. Re-run the monitor and confirm the database probe remains green with no anonymous base-table access.

Until step 2 is verified, the workflow intentionally falls back to the existing anon PostgREST probe so merging source does not break the currently deployed monitor. This fallback must be retired after the DB-aware Edge deployment and before RC479 is applied.

## 2. Backup and restore gate

The connected session does not have the Production database password or connection string, so no backup can safely be created by the assistant. Run the documented backup/restore rehearsal on an authorized computer before any Production migration or GRANT change.

- Create an encrypted off-site logical backup.
- Complete a disposable restore rehearsal.
- Verify schema, data, Auth/Storage customizations, RLS, grants, SECURITY DEFINER, RPCs, Edge dependencies and application paths.
- Record RPO/RTO and checksums.
- Never paste Production credentials into chat or commit them to GitHub.

## 3. Limits

- A successful health probe confirms only a minimal database read at that moment. It does not certify authentication, authorization, payments, finance, all RPCs, or application workflows.
- Scheduled GitHub Actions may be delayed and cannot guarantee against a Supabase inactivity pause.
- The health endpoint is public and deliberately returns no database data.
- Production remains BLOCKED / NOT CERTIFIED until the full migration, Edge parity, backup/restore, security, finance, and mobile release gates pass.
