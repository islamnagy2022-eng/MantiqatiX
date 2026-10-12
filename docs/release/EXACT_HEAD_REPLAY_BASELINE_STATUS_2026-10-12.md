# Exact-head migration replay and production blocker status — 2026-10-12

## Candidate
- Repository: `islamnagy2022-eng/MantiqaTix`
- Branch: `reconcile/rc425-458-current-main-20261011`
- Candidate head inspected: `0aa7105d4568ff5b807a6272e8c969db7dac648e`
- PR #207 remains draft and unmerged: https://github.com/islamnagy2022-eng/MantiqaTix/pull/207

## Test-only historical function baseline
The branch contains `supabase/tests/baselines/legacy_security_definer_functions.sql` and workflow logic that injects it as a temporary, untracked migration into a disposable CI workspace before the existing revocation migration. CI verifies that injected files are exact copies and contain no row-data imports. The committed production migration history is not rewritten.

The ten function definitions were obtained from a read-only catalog inspection of the trusted live project. This fallback is **not proof that current live function bodies equal their original historical definitions**. Authoritative historical DDL remains preferable. The fixture preserves the observed authenticated EXECUTE exception for `mantigo_rate_ride(text,integer,text)`; the other listed functions are expected to have client execution revoked.

## CI evidence
The following checks completed successfully on candidate commit `0aa7105d4568ff5b807a6272e8c969db7dac648e`:
- Migration Version Uniqueness — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188946961
- Migration History Immutability — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188946967
- Web workflow — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188946975
- Open PR Migration Collision Guard — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188946960
- SMM Service Role Access Boundary — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188946970
- Marketing Campaign Backend — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188946999
- Marketing CRM Tenant Scope — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188947001
- Backend-only Module Boundary — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188946980
- Module Professionalization Validation — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188946977
- MantiGO Open Ride Privacy Boundary — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188946965
- Approval Action Audit Atomicity — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188946966
- SMM Deferred Module Validation — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188947063

### Migration replay result
- Run #165: https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188947005
- Preflight, test-baseline injection, and exact-copy checks passed.
- The step `Start disposable Supabase services` failed; replay, local migration ledger, and final replay verification were skipped. Therefore **no SQL migration failure has yet been observed in this run; the migration chain did not start**.
- The optional Docker Hub login step was skipped because `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` were not both configured. This may contribute to image-pull failures, but the available job summary does not expose the exact Docker error, so root cause is not yet proven.
- The failed job was rerun to test for a transient registry/service-start failure. Rerun job ID `114618899798` was queued at the last poll. No pass is claimed until its result is observed.

## Read-only production observations
- Supabase migration ledger has 283 entries; the latest recorded migration is `20261008222845 rc424_atomic_digital_page_payment_webhook`.
- Live Edge Function `smm-gateway` is ACTIVE at version 6 with source SHA `ea4de98886b739ed5ce83c7f5909671fd00481a8f488849ffe58567e58be6cd6`.
- The live function source lacks the `MNTY_SMM_ENABLED` fail-closed gate present in the candidate source. The live source includes wallet debit, provider submission, and refund paths, so this remains a production safety blocker.

## Required next actions
1. Observe rerun job `114618899798`. If it fails again during Supabase startup, configure valid repository Actions secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (Docker Hub access token) and rerun. Do not label the issue as solved until local services start and the full migration replay actually runs.
2. Once the stack starts, diagnose the first SQL migration failure without skipping migrations or weakening guards.
3. Review replayed schema and every post-RC424 migration in disposable CI.
4. Obtain explicit authorization before deploying server-side SMM containment. Then run a live negative test proving disabled SMM cannot create orders, debit/refund wallets, or call providers.
5. Complete cross-tenant and branch E2E, payment/provider/financial reconciliation, Auth hardening, backup/restore rehearsal, and exact-head release review.

## Safety boundary and decision
No production migration, Edge Function deployment, Auth/security setting change, wallet/payment mutation, or financial data write was performed during this work. Do not merge PR #207 or declare production readiness on the basis of isolated CI checks. Release status remains **BLOCKED / NOT CERTIFIED** until all required gates are evidenced.
