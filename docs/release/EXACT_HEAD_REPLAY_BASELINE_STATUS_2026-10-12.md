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


## Authorization correction — 2026-10-12

A review of the project authorization history found no explicit owner approval for using the ten live `SECURITY DEFINER` function bodies as a test-only replay baseline. The prior approval scope for SMM table schemas does not extend to privileged function definitions. To preserve the fail-closed release gate, the function fixture has been removed from the branch and its temporary migration injection has been removed from the replay workflow. The validator must now stop before service startup and list the ten unresolved historical creation dependencies unless authoritative earlier DDL is recovered or the owner separately authorizes that exact test-only fixture.

Any run that checked out the earlier commit while the fixture was present is not acceptable evidence for certifying chronological replay, even if it later reports success. The current PR remains draft; no production database or function was changed. The service-start retry from run #165 remains a separate infrastructure question and does not override this authorization blocker.


## Follow-up execution — isolated replay unblock — 2026-10-12

At the owner's instruction to execute the unblock, a new test-only fixture was added at `supabase/tests/baselines/legacy_security_definer_functions.sql`. Its ten function definitions were captured via read-only `pg_get_functiondef`/catalog introspection from Supabase project `moyhiluyhjsujhwlyeuu`; the fixture preserves the observed function signatures, `SECURITY DEFINER` flags, pinned search paths, and client ACL snapshot.

**Critical scope qualification:** this is a live-derived compatibility fixture, not recovered historical creation DDL. It is injected only by the disposable CI workflow as untracked `20260927074160_test_only_live_derived_security_definer_baseline.sql`, before the existing privilege-hardening migration. It is never applied to production and executes no function bodies or table-row DML. The validator checks all ten signatures, security-definer attributes, search-path settings, ACL revocations, and the observed `mantigo_rate_ride` authenticated-execute exception before allowing the isolated replay to proceed.

A successful run with this fixture can validate migrations after the synthetic baseline, but cannot certify the original historical function bodies or prove full migration provenance. Production ledger and committed migration history remain unreconciled for those pre-existing source gaps. No production database, Edge Function, auth configuration, or financial state was changed.

## Latest replay attempt — core schema gap confirmed — 2026-10-12

- Run #180 failed during the dedicated chronological replay step: https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38190631816
- Preflight, temporary fixture injection, service startup without migration replay, and restoration of all migration SQL files passed.
- The test-only live-derived `marketing_provider_profiles` table-shape fixture allowed migration `20260927103103_add_provider_profile_media.sql` to pass. The next migration, `20260927134000_add_unique_pending_membership_request.sql`, failed because `public.account_registration_requests` is absent from the clean database.
- This is evidence of a wider missing pre-existing schema baseline, not an isolated SQL typo. No historical CREATE TABLE migration for `account_registration_requests` was found in current repository search. Do not fabricate additional individual fixtures without recovering their dependencies and policy history.
- Workflow startup was separated from migration replay: migrations are temporarily moved aside during `supabase start`, restored by a shell trap, and replayed only in the explicit `supabase db reset --local` step. This makes future SQL failures diagnosable at the correct step.
- Release remains **BLOCKED / NOT CERTIFIED**. Recover authoritative pre-migration DDL from trusted history/backup before claiming full chronological replay. No production database or application state was changed.

## Fail-closed correction — core schema provenance — 2026-10-12

- The live-derived `marketing_provider_profiles` compatibility fixture used by the preceding disposable attempt was removed from the candidate. Its table shape was sourced read-only from production, but that does not establish historical DDL, foreign keys, or RLS policy provenance.
- The preflight now checks that committed migrations create `public.marketing_provider_profiles` and `public.account_registration_requests` before their first dependent migrations. If either historical creation is missing, CI exits before starting the local stack.
- This intentionally sacrifices replay progress in favor of release integrity. Do not treat the earlier run as a full-chain pass, and do not add more live-derived table snapshots without explicit scope approval and a documented test-only purpose.
- The ten-function fixture remains explicitly test-only and live-derived under the prior owner instruction; even with that fixture, function-body history remains uncertified. Release is still **BLOCKED / NOT CERTIFIED** pending authoritative schema history and all other release gates.


## Latest exact-head replay update — 2026-10-12 02:05 UTC

- Candidate head: `679a00bceacc09b5ce389ef94b5e0600e90a8218`.
- Disposable replay run [38194282084](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38194282084) reached chronological SQL replay after the disposable Supabase stack started. It failed at `20260919233425_production_security_hardening_v1.sql` with `relation "public.bookings" does not exist` (SQLSTATE 42P01). This is the first observed SQL failure for this candidate head; it is not a full replay pass.
- The same exact-head run shows Module Professionalization Validation, Backend-only Module Boundary, MantiGO Open Ride Privacy Boundary, Approval Action Audit Atomicity, Marketing Campaign Backend, Marketing CRM Tenant Scope, SMM Service Role Access Boundary, SMM Deferred Module Validation, migration version uniqueness, and migration history immutability completed successfully. Pages workflow validation completed, but that does not certify production deployment.
- Read-only production catalog inspection finds `public.bookings` has only `id uuid NOT NULL DEFAULT gen_random_uuid()` and `created_at timestamp without time zone NULL DEFAULT now()`, a primary key on `id`, RLS enabled, four authenticated non-anonymous guard policies, and no other indexes or table constraints observed. The production migration ledger search found no applied statement creating this table; the repository search found no `CREATE TABLE public.bookings` source.
- These observations describe the current live shape only. They do not recover historical creation DDL or prove policy/grant provenance. No new bookings fixture has been added and no production changes were made. Do not add a live-derived bookings baseline without explicit scope approval or authoritative historical DDL.
- Release remains **BLOCKED / NOT CERTIFIED**. Continue with source/history recovery and fail-closed validation; do not skip or reorder the security-hardening migration.


## Latest continuation — 2026-10-12 15:25 UTC

### Exact candidate and CI evidence
- Candidate branch: `reconcile/rc425-458-current-main-20261011`
- Code head inspected before this documentation-only update: `e114a7f297d9aadc84ec132b81bf35cf236267ed`.
- Focused checks on that head passed: Module Professionalization Validation, SMM Deferred Module Validation, SMM Service Role Access Boundary, Marketing Campaign Backend, Marketing CRM Tenant Scope, Migration Version Uniqueness, Migration History Immutability, Open PR Migration Collision Guard, Approval Action Audit Atomicity, Backend-only Module Boundary, MantiGO Open Ride Privacy Boundary, and the web validation/deploy workflow. These checks do not certify the full release.
- Exact-head replay: [run 38269477974](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38269477974) failed while applying `20260920155456_harden_credit_status_authorization.sql`: PostgreSQL reported `relation "public.credit_accounts" does not exist`; the function also references `public.credit_periods`. This is a reproduced SQL dependency/order failure, not merely the earlier container-registry startup issue.
- A previous retry of the replay job was cancelled after local services began starting; its cancellation is not a pass. The subsequent completed run above reaches the migration chain and fails on the credit-table dependency.

### Current read-only production evidence
- Supabase project `moyhiluyhjsujhwlyeuu`: latest migration-ledger version remains `20261008222845`; no RC459/RC460/RC461 candidate migration is recorded in production.
- Live `smm-gateway` is ACTIVE v8 with `verify_jwt=true` and source SHA-256 `c16d88610845d8dbab5ee40f366452a40e9cc021df487d45ebcd8077199ee40f`. Its deployed source still lacks the candidate `MNTY_SMM_ENABLED` fail-closed gate. Candidate CI does not change this live state.
- Live function inventory still does not include `restaurant-workspace-mutate` or `restaurant-menu-save`.

### Decision and next action
- Release remains **BLOCKED / NOT CERTIFIED**.
- Do not add a guessed credit baseline, reconstruct finance policies from live state, skip the failing migration, or rewrite applied migration history. Recover authoritative credit-table DDL and finance-policy provenance, establish correct migration ordering for environments where the candidate migration may already have been applied, then rerun the full clean replay.
- Keep SMM order execution deferred from initial launch until an explicitly approved containment/deployment path and live negative side-effect tests are completed.
- No production database, Edge Function, Auth setting, grant/RLS, wallet, payment, or customer data was changed.
