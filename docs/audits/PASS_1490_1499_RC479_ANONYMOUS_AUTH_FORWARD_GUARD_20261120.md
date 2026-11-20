# PASS 1490–1499 — RC479 anonymous Auth-session forward SELECT guard — 2026-11-20

## Scope

Close the residual provider-profile read path for anonymous Supabase Auth sessions. Such sessions use PostgreSQL role `authenticated`; revoking SELECT from raw role `anon` does not deny this path.

## Implementation

- PR #938 merged to main: `436b7a5a4aa12aa979f5ea4b52b9ce9d3971a046`.
- Added forward-only migration `20261120193000_rc479_restrict_anonymous_auth_provider_profile_select.sql`.
- The new policy is RESTRICTIVE, applies only to SELECT for `authenticated`, and requires JWT `is_anonymous` not to be true.
- Preserved the historical raw-`anon` RC479 migration unchanged.
- Added a disposable baseline test that reproduces the anonymous Auth read before the forward migration.
- Added post-migration tests for anonymous denial, confirmed-user compatibility, owner UPDATE success, wrong-owner UPDATE denial, restrictive-policy presence and owner ALL-policy preservation.

## Verification

All exact PR-head workflows completed successfully:
- RC479 Anonymous Auth Session Boundary — run 44803731818.
- RC464 Platform Admin Live Hardening — run 44803731787.
- Forward Migration Chain Replay — run 44803731771.
- Migration Version Uniqueness — run 44803731767.
- Open PR Migration Collision Guard — run 44803731827.
- Migration History Immutability — run 44803732001.
- Module Professionalization — run 44803731831.
- Backend-only Module Boundary — run 44803731811.
- MantiGO Open Ride Privacy — run 44803731854.
- Other exact-head PR workflows also completed successfully.

Pages workflow run 44803731990: `validate` succeeded; `validate_public_only` and `deploy` were skipped. Therefore this is not evidence of a website deployment.

## Production impact and limits

- No live Supabase migration, SQL mutation, DDL/DML, GRANT, RLS, Auth, Storage or Edge deployment occurred.
- The forward migration is merged source only and remains unapplied in Production.
- Confirmed authenticated users still have base-table SELECT under the legacy public-active policy. The current change does not hide `owner_user_id` or `settings` from confirmed users; a separate compatibility-reviewed projection/data-contract change is required.
- The full platform remains **BLOCKED / NOT CERTIFIED** pending operator-controlled encrypted DB + Storage backup, off-site retrieval, Vault recovery, isolated PostgreSQL 17 restore/rollback, measured RPO/RTO, chronological migration reconciliation and coordinated Edge release.

## Next action

Continue source/CI-only P0 security remediation. Do not apply this migration independently or deploy backend functions outside the approved coordinated release.
