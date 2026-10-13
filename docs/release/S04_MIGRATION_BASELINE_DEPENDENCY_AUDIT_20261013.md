# S04 Migration Baseline Dependency Audit — 2026-10-13

## Status

IN PROGRESS. The full clean replay remains FAIL / BLOCKED. This report documents a source-only preflight and does not certify the migration chain.

## Evidence

- Workflow [#38348635052](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38348635052) failed during disposable Supabase startup at `20260927074200_harden_smm_table_api_privileges.sql` with `ERROR: relation "public.smm_provider_credentials" does not exist (SQLSTATE 42P01)`.
- The same migration references `public.smm_providers`.
- The source audit found five duplicate timestamp groups and marked RC433 as `NOT_FOUND_NOT_VERIFIED_GAP`.
- `supabase/tests/rc456_smm_service_role_fixture.sql` creates SMM tables for its focused ACL test. A fixture is not evidence that the complete chronological migration source is present.
- Read-only production migration metadata records the corresponding SMM privilege migration as version `20260927074210`; the candidate filename uses `20260927074200`. No production writes were performed.

## Change in this branch

- Add `scripts/audit-smm-migration-baseline.mjs` to check whether migration sources create `public.smm_provider_credentials` and `public.smm_providers` before privilege statements reference them.
- Include self-tests for correct ordering, missing create source, and a create source that appears too late.
- Run the check in S04 CI and preserve its JSON and stderr artifacts.
- Include the stacked review base `docs/rc521-admin-operations-discovery-20261013` in the workflow PR trigger.

## Limitations and safety

This is a narrow static preflight, not a substitute for full replay. No production schema, data, permissions, Auth, or RLS were changed. The release remains `BLOCKED / NOT CERTIFIED` until the migration history is reconciled and full replay passes in isolated infrastructure.

## Next actions

1. Run the self-test and S04 workflow on the exact PR head; inspect the audit JSON.
2. Trace the canonical origin of the SMM tables and the RC433 source gap.
3. Resolve duplicate migration timestamps in the migration-owning review without changing applied historical SQL.
4. Re-run the chronological clean replay in disposable infrastructure.
