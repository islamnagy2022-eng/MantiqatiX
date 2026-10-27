# Production Release Safety and Rollback Runbook — 2026-10-27

## Current protected baseline

- Production application repository: `islamnagy2022-eng/MantiqatiX`
- Baseline commit observed during review: `0274bbd3f3657838153d1c8b62ea31ce487d1c90`
- Safety branch: `safety/production-main-20261027`
- Isolated fix branch: `fix/production-launch-hardening-20261027`
- Production Supabase project ref: `moyhiluyhjsujhwlyeuu`
- Production Supabase project status observed: `ACTIVE_HEALTHY`
- Current release status: **BLOCKED pending production reconciliation and recovery evidence**.

The safety branch is a Git reference, not a database backup. Do not describe it as a backup of customer data.

## Release facts verified on 2026-10-27

1. GitHub Actions run `40433473598` successfully built and deployed the primary catalog frontend to the single GitHub Pages root.
2. GitHub Actions run `40433473513` failed its broader production verification and skipped deployment.
3. The production migration ledger showed RC107–RC112 and a catalog seed migration, but did not show RC113–RC117.
4. The broader production gate explicitly reports that migration reconciliation, payment/finance E2E, backup/restore rehearsal, Edge Function contracts, SMM parity, and Auth/security settings are not fully verified.
5. Ordered forward replay from the recorded production-schema checkpoint succeeded in an isolated CI Supabase instance. This is useful evidence but is not a production backup or a restore rehearsal.

## Non-negotiable release sequence

1. Freeze automatic production deploys until the gate is green.
2. Capture the exact current GitHub Pages artifact/commit and keep the safety branch intact.
3. Confirm Supabase point-in-time recovery/backup availability and retention for the production project. Record the actual recovery point and owner-approved recovery procedure.
4. Perform a restore rehearsal into an isolated project/branch and verify that the restored schema and representative data are usable. Do not treat a branch or source-code backup as a database backup.
5. Reconcile every source migration against the live migration ledger and schema. Preserve historical migration versions; do not edit or re-run already-applied historical migrations to make version numbers look consistent.
6. Apply pending migrations only after review of dependencies, lock duration, data changes, privileges, RLS, and explicit rollback/forward-fix steps. Never run a bulk migration sequence directly against production just because isolated replay passed.
7. Deploy the frontend only after all schema/API prerequisites it uses are present and verified.
8. Run post-deploy smoke tests: Google sign-in, existing account access, role switching (platform owner/business owner/customer), subscription states, public directory/catalog, business-scoped data, and relevant write paths. For payment flows, use provider sandbox/test instruments and verify idempotency/webhook behavior.
9. Record run IDs, commit SHA, migration versions, backup/recovery point, test results, and operator decision.

## Rollback decision tree

- **Frontend-only regression:** stop further deploys; redeploy the last known-good Pages artifact or a previously validated source revision using a controlled release workflow. Verify root HTML, config, JS/CSS assets, authentication entry point, and core navigation afterward.
- **Database migration failure before commit:** stop the release; inspect transaction/lock state and migration logs. Do not blindly retry.
- **Committed additive schema migration:** prefer a reviewed forward-fix unless a rehearsed reverse migration is demonstrably safe. Do not drop tables/columns or delete user data as a reflexive rollback.
- **Data corruption or broad outage:** invoke the documented Supabase recovery/PITR procedure to a known recovery point under the incident owner’s approval, then verify data consistency and application compatibility before reopening traffic.
- **Payments, ledger, or wallet inconsistency:** freeze affected writes and reconciliation jobs; preserve audit/webhook evidence; never edit ledger rows or issue compensating transfers without the financial incident procedure.

## Current blockers — do not claim production launch readiness

- The latest frontend deployment was successful, but that does not prove backend/schema compatibility.
- RC113–RC117 are present in source but absent from the observed production migration ledger.
- Backup/restore rehearsal and several runtime/security test suites are still marked NOT VERIFIED in the production gate.
- Do not activate new control-center, employee-management, or default-image features that require missing migrations until schema parity is verified.

## Evidence links

- Latest catalog frontend release: https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40433473598
- Broader production verification (blocked): https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40433473513
- Forward migration replay in isolated CI: https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40433473566
