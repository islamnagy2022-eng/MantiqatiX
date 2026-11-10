# R6 Cleanroom Import Runbook

This procedure imports **application source only** from the owner-approved archive. It does not migrate users, businesses, catalog records, subscriptions, payments, wallet balances, transactions, local database snapshots, or any other prior operational data.

## Canonical source

- Archive: `bizcatalog-manager (6).zip`
- Expected SHA-256: `c7623e2741d34ac5c58ba2c2c8f9286116e7adc6f5e214955c5c67d050c15447`
- Target: `apps/aistudio-v6`
- Preserve: `src/components/mobile/`
- Do not overwrite or merge an existing target.
- Do not deploy or switch the public site as part of this import.

## Run in the isolated Codespaces branch

Use branch `preview/bizcatalog-manager-6-isolated`. Put the exact owner-supplied archive in the repository workspace. Do not rename another archive to impersonate R6.

First run the audit-only pass:

```bash
python3 scripts/import-r6-cleanroom.py "bizcatalog-manager (6).zip" \
  --repo-root . \
  --report artifacts/r6-import-audit.json
```

Review the generated report. It must show the exact expected SHA-256, ZIP integrity PASS, an application root with `package.json` and `src/`, and at least one retained file under `src/components/mobile/`. Review every excluded path and every medical-scope candidate. Any possible embedded secret blocks staging.

Only after the audit report is reviewed, run the staging pass:

```bash
python3 scripts/import-r6-cleanroom.py "bizcatalog-manager (6).zip" \
  --repo-root . \
  --stage \
  --report artifacts/r6-import-audit.json
```

The script refuses a checksum mismatch, corrupt ZIP, unsafe archive path, symlink, duplicate path, excessive expansion/compression ratio, suspicious hard-coded secret, missing mobile source, or an existing target. It excludes local state and generated material such as `.data/`, `.aistudio/`, `.env*`, dependency/build caches, database/backup files, and the local root `server.ts`. It never writes outside the repository target. It writes an `R6_IMPORT_MANIFEST.json` and labels the result `SOURCE_STAGED_NOT_PRODUCTION_READY`.

## Required review after staging

1. Inspect the manifest and source inventory. Confirm the dedicated medical-directory UI is not part of the public site build; do not delete unrelated medical-sector business records or taxonomy.
2. Confirm `src/components/mobile/` remains present and compare the staged inventory with the R6 archive.
3. Review all local data access, localStorage role authority, auth/session flows, admin actions, payment/finance flows, backups, and external integrations before wiring any backend adapter.
4. Map UI types and workflows to the existing Supabase schema, Auth, memberships, RBAC, RLS, RPCs, and Edge Functions. Do not create duplicate production tables merely to imitate UI models.
5. Add and run the exact lockfile install, semantic TypeScript, lint, unit, build, browser, accessibility, responsive, PWA, security, and backend contract tests. Record actual command output.
6. Keep the currently deployed root and rollback route unchanged. Preview acceptance and explicit cutover approval are separate gates.

A successful archive import is **not** proof of backend integration, Preview acceptance, or Production readiness. This runbook does not deploy, migrate a database, change Auth/RLS/GRANT settings, or alter the currently published website.
