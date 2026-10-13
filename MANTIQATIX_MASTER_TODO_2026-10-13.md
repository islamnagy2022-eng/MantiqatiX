# MANTIQATIX MASTER TODO — 2026-10-13

**Release status: `BLOCKED / NOT CERTIFIED`**

This file is the dated master checkpoint requested for MantiqatiX autonomous execution. The detailed, continuously maintained task inventory remains in [`docs/MASTER_PRODUCTION_TODO.md`](docs/MASTER_PRODUCTION_TODO.md); update both records when the release decision or priority blockers change. The evidence ledger is [`docs/SESSION_LOG.md`](docs/SESSION_LOG.md) and the independent acceptance report is [`docs/release/SESSION_C_P0_SECURITY_RELEASE_ACCEPTANCE_20261013.md`](docs/release/SESSION_C_P0_SECURITY_RELEASE_ACCEPTANCE_20261013.md).

## Current checkpoint

- Repository: `islamnagy2022-eng/MantiqatiX`
- Supabase project: `moyhiluyhjsujhwlyeuu`
- Session C branch: `session-c/p0-security-release-acceptance-20261013`
- Latest verified Session C evidence commit before this checkpoint: see the branch history; documentation-only work is isolated from `main`.
- Production boundaries: no production writes, migrations, Auth/RLS/grant/secret changes, financial mutations, Edge Function deployment, merge, or release.

## Priority blockers

### P0 — authorization and financial integrity

- [ ] **Live MantiGO authorization:** four global RPCs (`expire_stale_mantigo_rides_backend`, `get_mantigo_admin_dashboard_backend`, `get_mantigo_admin_financial_report_backend`, `settle_mantigo_captain_backend`) remain SECURITY DEFINER, callable by `authenticated`, and lack the platform-admin guard. Read-only catalog evidence says `anon` cannot execute them, but authenticated tenant roles remain an unsafe global boundary. Fix only through reviewed source/migration and approved rollout.
- [ ] **Payment webhook integrity:** PR #220's focused S06 regression passed on its inspected head, but its separate migration replay failed. Webhook branches still need event-to-intent binding, atomic event/state transition, checked affected-row counts, duplicate concurrency, and injected-failure tests.
- [ ] **Production authorization proof:** no approved migration has been applied to production and no live negative authorization test has been completed.

### P1 — migration chain and CI

- [ ] **PR #207 current head `8409c52b4798415235b663ac4d5c69d2abb33a54`:** run [38349544642](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38349544642) fails closed in preflight. Its validator incorrectly requires RC256 to prove both the tenant and payment-intent indexes on `payment_provider_events`; source inspection shows RC256 creates the tenant index while the approved disposable-only baseline creates the payment-intent index absent from tracked creation history. Preserve that distinction; do not synthesize production history.
- [ ] **PR #218:** run [38343250122](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38343250122) fails at `20260927074200_harden_smm_table_api_privileges.sql` because `public.smm_provider_credentials` is missing before the ACL migration. Coordinate isolated baseline injection or recover authoritative historical creation DDL.
- [ ] **Migration ledger:** read-only Supabase inventory contains 283 versions; latest is `20261008222845 / rc424_atomic_digital_page_payment_webhook`. Selected later candidate versions RC449/RC462/RC522/RC523 are not present in the live ledger.
- [ ] **Docker/CI:** treat registry rate limits as environment errors separately from SQL replay errors; never call a preflight pass a full replay pass.

### P1 — SMM containment

- [ ] **PR #225 current head `0a323e9c3c88c2c97e433790ac3a261a4b803de2`:** run [38349321482](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38349321482) fails because the redirect assertion searches `provider-transport.ts`, while `redirect:"error"` is in `supabase/functions/smm-gateway/index.ts`. Fix the validator and add behavioral coverage, then rerun exact-head CI.
- [ ] Live `smm-gateway` is ACTIVE v10, `verify_jwt=true`, SHA-256 `80fe058973fafdee71e3c9637469077bf115dc2a29014f5f347b5a54ebe90994`. Source has `SMM_INITIAL_LAUNCH_DEFERRED=true` and an early 503 gate before `getUser(req)`; runtime HTTP denial remains NOT VERIFIED.
- [ ] Supabase Security Advisor snapshot: 94 findings (90 anonymous-policy warnings, 40 authenticated SECURITY DEFINER execute warnings, one anon-executable SECURITY DEFINER warning, one leaked-password-protection warning, one RLS-enabled/no-policy INFO item). Triage individually; no blanket changes.

### P2–P4 — remaining acceptance

- [ ] Auth, registration, membership correctness, role/scope isolation and user-facing flows.
- [ ] E2E on disposable/test environment for orders, inventory, accounting, reporting, notifications, SMM and responsive PWA.
- [ ] Backup/restore/rollback evidence with RPO/RTO and a tested restore.
- [ ] Required branch protection/reviews/checks and exact-candidate CI.
- [ ] Release manifest with final SHA, test evidence, runtime negative tests and a signed decision record.

## Next exact execution steps

1. Recheck PR heads and exact-head CI before touching any active workstream.
2. Coordinate the PR #207 validator mismatch; do not change its owned files without coordination.
3. Correct PR #225's source-file assertion in its owning workstream and add behavioral redirect coverage.
4. Resolve PR #218's missing credentials-table lineage/isolated fixture dependency.
5. Continue read-only MantiGO authorization analysis and disposable PostgreSQL tests; do not run live settlement/expiry operations.
6. Update this file, `docs/MASTER_PRODUCTION_TODO.md`, `docs/SESSION_LOG.md`, and the acceptance report with exact commit/run evidence after each meaningful step.

## Acceptance rule

Do not label the release ready until required CI on the final candidate passes, migration replay passes in a disposable environment, live authorization and SMM deny behavior are verified through approved negative tests, payment invariants are tested, backup/restore/rollback evidence exists, and all P0 blockers are closed. Until then, the only valid release state is **`BLOCKED / NOT CERTIFIED`**.


## Latest exact-head update — 2026-10-13 05:17 UTC

- [x] **SMM PR #225 exact-head CI**: current head `cbb8d541616f8fbd3abf7c3f9cecb5aaaed86ff0`, run [38350429554](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38350429554) PASS for security contract, service-role ACL boundary, Deno type check, and SMM unit/negative-input tests. Live HTTP deny test remains NOT VERIFIED; PR is draft and based on the RC521 discovery branch.
- [ ] **P1 / PR #207 replay bootstrap**: current head `56dc3375ec8cde875d886e1aa95b2329889139b0`, run [38350541588](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38350541588) fails before replay with `settlement_attempts_baseline: unbound variable`. The variable is missing from declarations in the second workflow shell step; comment [6138798133](https://github.com/islamnagy2022-eng/MantiqatiX/pull/207#issuecomment-6138798133). No workflow edit from Session C.
- [ ] **P0 / settlement fixture fidelity**: disposable-only `settlement_attempts` baseline still uses unbounded `numeric` and `character varying`, while read-only production catalog reports `numeric(14,4)` and `varchar(8)`. Preserve exact typmods and confirm approval/provenance before relying on this new financial fixture. Prior finance-policy validator failure must be rechecked after bootstrap fix because current source SQL matches the static regex on independent inspection.
- Release remains **BLOCKED / NOT CERTIFIED**.
