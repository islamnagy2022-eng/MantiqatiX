# Exact-head migration replay status — 2026-10-12

## Candidate
- Repository: `islamnagy2022-eng/MantiqaTix`
- Branch: `reconcile/rc425-458-current-main-20261011`
- Candidate commit inspected: `ba21b205ce1fb877249b5988ad7e69f8d9dfc751`
- PR #207 remains draft and unmerged: https://github.com/islamnagy2022-eng/MantiqaTix/pull/207

## Change made for disposable CI only
The branch adds `supabase/tests/baselines/legacy_security_definer_functions.sql` as a clearly labeled test baseline and updates the disposable migration replay workflow to inject a temporary, untracked migration into the CI workspace before the existing revocation migration. The workflow verifies the injected files are exact copies of the test baseline and are not row-data imports. The committed chronological production migration history is not rewritten, and this does not apply anything to production.

The fixture contains the ten function signatures named in the preflight blocker. Definitions were obtained from a read-only catalog inspection of the trusted live project. This is a test-only fallback, **not proof that the captured current function bodies equal their original historical definitions**. The preferred source of truth remains authoritative historical DDL if it can be recovered. The fixture's function ACL contract preserves the observed authenticated EXECUTE exception for `mantigo_rate_ride(text,integer,text)`; other functions are expected to have client execution revoked.

## Exact-head CI evidence observed
- Migration Version Uniqueness: PASS — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188809619
- Migration History Immutability: PASS — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188809597
- Marketing Campaign Backend: PASS — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188809636
- Marketing CRM Tenant Scope: PASS — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188809659
- Open PR Migration Collision Guard: PASS — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188809680
- Backend-only Module Boundary: PASS — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188809672
- SMM Service Role Access Boundary: PASS — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188809763
- Approval Action Audit Atomicity: PASS — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188809598
- SMM Deferred Module Validation: PASS — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188809638
- MantiGO Open Ride Privacy Boundary: PASS — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188809647
- Module Professionalization Validation: PASS — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188809684
- Web validation: PASS; deploy job SKIPPED — https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188809668

## Still unresolved
The exact-head Disposable Supabase Migration Chain Replay run #164 remains pending with no jobs returned by the workflow-jobs endpoint at the time of this check: https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38188809627. Therefore the replay has **not** been certified as passing. Do not infer success from the other workflows.

Even if the disposable replay succeeds, release certification still requires, at minimum:
1. Review of the replayed schema and all post-RC424 migrations in the disposable environment.
2. Reconciliation of production migration state; the latest previously verified production ledger ended at RC424.
3. Separate authorization to deploy server-side SMM containment, followed by a live negative test proving the gateway cannot create orders, debit wallets/refund, or call providers while disabled.
4. Cross-tenant/branch end-to-end tests, real payment/provider and financial reconciliation tests, Auth hardening, and a successful backup-restore rehearsal.
5. Fresh exact-head evidence and a formal release decision.

## Safety boundary
No production migration, Edge Function deployment, Auth/security setting change, wallet/payment mutation, or financial data write was performed as part of this update. Do not merge PR #207 or declare the product production-ready on the basis of these isolated checks. Release status remains **BLOCKED / NOT CERTIFIED** until all required gates are evidenced.
