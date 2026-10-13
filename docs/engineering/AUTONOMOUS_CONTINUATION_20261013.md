# MantiqatiX Autonomous Execution Continuation — 2026-10-13

## Resume point
- Repository: `islamnagy2022-eng/MantiqatiX`
- Reference PR #218 remains open and draft; observed head: `77012649e41fe22077538c39cd8593bf696ab33e`.
- PR #207 remains open and draft; it documents unresolved chronological migration replay and global authorization blockers.
- Current work branch: `security/smm-gateway-runtime-verification-20261013`
- Latest commit created in this continuation: `c0bae9312ae6c6538e1efd01355d910aa180fce2`
- Branch link: https://github.com/islamnagy2022-eng/MantiqatiX/tree/security/smm-gateway-runtime-verification-20261013
- Claimed master todo path `MANTIQATIX_MASTER_TODO_2026-10-13.md` was not found at repository root; repository code search also did not find that exact filename. Do not assume it exists. This continuation record is the durable resume note for this branch.

## Work completed in this continuation
1. Re-read PR #218 metadata and discussion evidence; confirmed it remains draft/open, and release status remains BLOCKED / NOT CERTIFIED.
2. Re-read PR #207 metadata/body; it records full chronological migration replay as unresolved, live production ledger at RC424, and missing historical function-creation dependencies that must not be bypassed with stubs.
3. Reviewed current PR #218 SMM source files:
   - `supabase/functions/smm-gateway/index.ts`
   - `launch-gate.ts`
   - `request-validation.ts`
   - `provider-transport.ts`
   - `smm-gateway.test.ts`
   - RC456 service-role migration and disposable PostgreSQL ACL integration test.
4. Created a static source-contract validator at `scripts/validate-smm-gateway-security.mjs`.
5. Added `.github/workflows/smm-gateway-security-regression.yml` to run the SMM contract validator, existing RC456 validator, Deno type check, and SMM unit tests on relevant changes.
6. Added detailed evidence and limitations in `docs/security/SMM_GATEWAY_SECURITY_VERIFICATION_20261013.md`.
7. Narrowed one static assertion in the validator to check actual wallet refund/credit RPC invocation rather than rejecting the word “refund” in safety comments/docs. The latest resulting commit is `f12f396477885f2b0a02a4a9e05ece9d565a8798`.

## Verification evidence and limitations
- GitHub branch existence was confirmed.
- Opened draft PR #225, retargeted it to PR #218's head branch so the diff is isolated (4 files, 5 commits), and confirmed the dedicated workflow started.
- Exact-head CI run `38348635011` failed at the new static validator with a JavaScript regex parse error in the admin-guard assertion. The error was fixed in commit `c0bae9312ae6c6538e1efd01355d910aa180fce2`; rerun must confirm the fix.
- The existing service-role boundary job in run `38348634984` passed its validator, Deno type check, and existing SMM unit tests; the PostgreSQL job was still in progress at last observation.
- Workflow run lookup returned no runs for commits `f12f396477885f2b0a02a4a9e05ece9d565a8798` and `0eeba66ef3a150a3b8ce75683af3067dc3da327e`. The available connector lookup filters to PR-triggered runs; therefore this result is **NOT VERIFIED**, not proof that GitHub Actions never ran.
- No local Deno/PostgreSQL/Edge Runtime execution was available in this work cycle.
- No live HTTP request was sent to SMM. No provider call or wallet operation was triggered.
- No production database writes, migrations, Auth/RLS/grant changes, Edge Function deployments, merges, or releases were performed.

## Security source findings
- The current candidate source hard-codes `SMM_INITIAL_LAUNCH_DEFERRED=true` and returns `503 SMM_DEFERRED` before auth lookup, body parsing, provider access, wallet RPCs, and order writes.
- The additional launch helper requires both `MNTY_SMM_ENABLED=true` and `MNTY_SMM_POST_LAUNCH_APPROVED=true`; these flags do not bypass the hard-coded deferred constant.
- Gateway code verifies bearer users through Supabase Auth, rejects anonymous users, scopes user order reads by user ID, uses an explicit SMM admin allowlist plus strict platform-scoped SUPER_ADMIN fallback, validates bounded JSON, and has HTTPS/host allowlist/redirect rejection/15-second provider timeout.
- Provider credentials are read through `smm_get_provider_secret`; gateway source does not directly select `api_key_ciphertext`.
- Order creation has idempotency conflict handling and ambiguous provider outcomes require reconciliation rather than automatic refund.
- These are source-inspection results. They do not prove live runtime behavior, production grant state, deployment parity, or the actual absence of side effects in HTTP execution.

## Global release blockers still open
- PR #218 states four live MantiGO platform-wide dashboard/report/settlement/expiry RPCs remain SECURITY DEFINER, authenticated-executable, `search_path=public`, without platform-admin guards.
- Production migration ledger remains reported at 283 rows ending `20261008222845 / RC424`; candidate RC449/RC462/RC522/RC523 were not present in the cited read-only ledger query.
- Full chronological migration replay, complete production E2E, tenant isolation, payment/settlement runtime, Auth/security review, and backup/restore remain incomplete.
- Keep release **BLOCKED / NOT CERTIFIED**.

## Next exact actions
1. Recheck this branch head and all new file contents after the latest commit.
2. Verify workflow YAML and validator syntax; run GitHub Actions on the exact final SHA. Do not label a missing run as a pass.
3. Add disposable Edge Runtime/HTTP tests with spies for database writes, wallet RPCs, and provider fetch; prove the deferred gate returns 503 and triggers zero downstream effects.
4. Run negative HTTP tests for missing/invalid JWT, anonymous identity, forbidden tenant admin, invalid/oversized JSON, cross-user order access, idempotency replay/conflict, provider timeout/malformed response, and persistence failures.
5. Continue P0 global RPC authorization work on a separate branch; preserve migration history and do not apply production changes.
6. Continue migration replay only in disposable infrastructure; do not create placeholder functions or skip historical migrations to force a green result.
7. Update this record after each verified step. No merge/deploy without separate explicit approval.

## Current statuses
- SMM source-contract implementation: **IN PROGRESS**
- Exact-head CI: **NOT VERIFIED**
- End-to-end HTTP negative tests: **NOT VERIFIED**
- Live production parity: **NOT VERIFIED**
- Full migration replay: **BLOCKED**
- Production release: **BLOCKED / NOT CERTIFIED**


## Append-only execution update — 2026-10-13 (verified GitHub Actions evidence)

### Repository / PR state rechecked
- PR #225 is still **OPEN / DRAFT / UNMERGED**, mergeable reported true; base is `docs/rc521-admin-operations-discovery-20261013` at `77012649e41fe22077538c39cd8593bf696ab33e`.
- Exact PR head at inspection: `acb6466afbfdadd76570ab9404aa37551e1a2b92`.
- Current head contains the corrected string-based admin assertion in `scripts/validate-smm-gateway-security.mjs`; this corrects the invalid regular expression shown by the earlier workflow log.
- The previously failing SMM workflow run #38348635011 checked out synthetic merge commit `cc16b047dd22155fcfa72f4083fb0281291672a8`, whose merge parents were from the earlier PR base (the log says merge of `69385a7606241939d99491806a06434eba21715c` into `8a56358d505d2c12878440037f7f24ba65d2ea10`). It therefore does **not** verify the corrected current PR head/base combination. Current-head CI remains **NOT VERIFIED**.
- Earlier service-role run #38348634984 was reported successful for its own tested revision; do not transfer that pass to current head without a new matching run.

### S04 migration replay failure — exact evidence
- Workflow run: [#38348635052](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38348635052).
- The disposable Supabase stack failed during startup/replay at migration `20260927074200_harden_smm_table_api_privileges.sql`.
- Exact PostgreSQL error recorded in the job log: `ERROR: relation "public.smm_provider_credentials" does not exist (SQLSTATE 42P01)`.
- `scripts/audit-migration-chain-s04.mjs` also exited 1 before the replay attempt completed. Its audit covers invalid migration filenames, duplicate versions, and required migration-source presence; the uploaded artifact contains the detailed JSON evidence.
- `supabase init` exited 0; `supabase start` exited 1; clean replay was marked `FAILED_DURING_SUPABASE_START`; final job conclusion is **FAILURE**. Artifact upload success is only evidence preservation, not replay success.
- Do not patch this by skipping migrations, adding fake tables/functions, or rewriting historical migration contents without a complete chronology and explicit review. Next action: inspect the artifact's full source-audit JSON and locate the canonical creation migration (if any), then produce a minimal reproducible chronology report on an isolated branch.

### Current work / safety boundary
- No production database, migrations, grants, Auth/RLS, Edge Function, wallet, payment, provider, merge, or release action was performed.
- SMM source remains hard-disabled by `SMM_INITIAL_LAUNCH_DEFERRED=true`; this is containment, not launch readiness.
- Release remains **BLOCKED / NOT CERTIFIED**.

### Exact next actions
1. Trigger a fresh PR workflow by committing this append-only evidence update, then verify run SHA and all jobs against current PR #225 head/base. Do not count the prior invalid-regex run as the latest verdict.
2. Download/read artifact `11789859107` from run #38348635052 and extract the complete audit JSON; classify duplicate versions vs missing required sources.
3. Trace where `public.smm_provider_credentials` is created and why the 2026-09-27 privilege migration runs before that relation exists. Preserve production migration history.
4. Continue P0 platform RPC authorization review separately; keep PR #225 draft and do not merge/deploy.
5. Add isolated HTTP/Edge Runtime side-effect tests only after a runnable disposable runtime is available; until then mark NOT VERIFIED.


## Append-only update — latest verification and CI trigger correction (2026-10-13)

- Latest SMM verification branch commit: `94edc7e364efe3313eaa30c51c829b909e2fa3fd`. It includes the prior continuation-log update and a workflow trigger fix.
- Independent review identified that the new SMM workflow's `pull_request.branches` filter originally listed only `main`, while PR #225 targets `docs/rc521-admin-operations-discovery-20261013`. The workflow now includes that stacked base branch as well as `main`.
- The available workflow-run lookup returns only pull-request-triggered runs, so it does not establish whether the new push-triggered run executed. No exact-head SMM validator result is claimed yet. The prior invalid-regex failure remains a historical failure on an earlier synthetic merge SHA, not the current verdict.
- P0 candidate evidence was independently checked: workflow [#38343250142](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38343250142) checked out synthetic merge commit `10fe17516029d7c4e42f155548ee5c64eb2e3d80`, which merges PR #218 head `77012649e41fe22077538c39cd8593bf696ab33e` into `main`. Its disposable PostgreSQL job passed:
  - `MantiGO platform-admin scope contract PASS: 15/15 checks`
  - `RC462 malformed platform-admin permissions regression: PASS`
  - `RC449 platform-admin scope integration: PASS`
- This verifies the candidate SQL and integration contract on that tested merge revision only. It does **not** mean the migrations are applied in production; the read-only production ledger in PR #218 still reports RC424 and the live four-RPC authorization issue remains a production blocker.
- The matching S04 clean replay run [#38343250122](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38343250122) failed on that same synthetic merge commit with `ERROR: relation "public.smm_provider_credentials" does not exist (SQLSTATE 42P01)` at `20260927074200_harden_smm_table_api_privileges.sql`. Therefore migration replay remains **FAIL / BLOCKED** despite the focused P0 authorization tests passing.
- PR #225 remains open/draft/unmerged. No merge, deploy, production migration, live grant/RLS/Auth change, provider request, wallet/payment write, or release was performed.

### Next safe continuation point
1. Confirm a new SMM workflow run against the current PR #225 head `94edc7e364efe3313eaa30c51c829b909e2fa3fd`; if the connector cannot expose push-triggered runs, use the linked GitHub Actions run page and keep status NOT VERIFIED until its exact SHA and logs are confirmed.
2. Inspect S04 artifact `11789859107` to capture the complete source-audit JSON and migration-version/missing-source list.
3. Trace the canonical creation history for `public.smm_provider_credentials`; preserve historical migration bytes and do not synthesize production schema.
4. Continue independent P0 review of tenant isolation and payment/webhook idempotency using disposable tests; keep release **BLOCKED / NOT CERTIFIED**.


## Append-only update — S04 artifact and production migration-source reconciliation (2026-10-13)

### Full S04 artifact inspected
- Downloaded artifact `11789859107` from run #38348635052 and inspected `report.txt`, `source-audit.json`, and `source-audit.stderr` directly.
- Source audit results: 160 migration files; 0 invalid filenames; **5 duplicate-version groups**; 0 missing entries from the audit's required-source list; RC433 source not found and explicitly marked `NOT_FOUND_NOT_VERIFIED_GAP`.
- Duplicate groups reported by the audit:
  1. `20260928020000`: RC101 and RC102.
  2. `20260928060000`: RC109 and `restore_registration_request_dml_grants`.
  3. `20260928190000`: RC162 and RC200.
  4. `20260928200000`: RC164 direct-delete lockdown, RC164 legacy-mutator retirement, and RC206 geographic targeting.
  5. `20260928210000`: RC172 medical booking and RC207 global MantiGO cover ads.
- The audit process itself exited 1 with assertion `Migration versions must be globally unique within supabase/migrations` (actual 5 groups, expected 0). This is a source-history blocker, not a passing preflight.

### Read-only production migration ledger/source comparison
- Confirmed the active Supabase project is `moyhiluyhjsujhwlyeuu`; used only read-only migration-list/SELECT queries.
- Production records the same migration names under distinct applied versions, which differ from several candidate filenames:
  - `harden_smm_table_api_privileges`: source `20260927074200`, production `20260927074210`.
  - `restore_registration_request_dml_grants`: source `20260928060000`, production `20260928034100`.
  - RC101: source `20260928020000`, production `20260928101022`.
  - RC102: source `20260928020000`, production `20260928104107`.
  - RC109: source `20260928060000`, production `20260928112420`.
  - RC162: source `20260928190000`, production `20260928124303`.
  - RC164 direct-delete: source `20260928200000`, production `20260928125655`.
  - RC164 legacy-mutator retirement: source `20260928200000`, production `20260928125731`.
  - RC172: source `20260928210000`, production `20260928131753`.
  - RC200: source `20260928190000`, production `20260928154527`.
  - RC206: source `20260928200000`, production `20260928161513`.
  - RC207: source `20260928210000`, production `20260928174954`.
- Compared normalized source SQL (comments/formatting removed) with the corresponding read-only stored applied statement. Nine of these twelve normalized sources match; three have substantive drift and must not be silently renamed or treated as canonical:
  - RC172 source omits `v_status text` present in the production-applied function body.
  - RC206 source has the older `raw` query shape, while the applied statement includes a `targeted` CTE with a different projection.
  - RC207 source is substantially shorter and lacks the `get_mnty_targeted_advertisements` function present in the applied statement.
- A read-only query using `ILIKE ANY (ARRAY[...])` failed with PostgreSQL `42601 syntax error at or near ")"`; it was retried with equivalent explicit `OR name LIKE ...` predicates and returned the migration-name/version mapping. No data was changed.
- The clean replay also fails earlier at `20260927074200_harden_smm_table_api_privileges.sql` because `public.smm_provider_credentials` does not exist in the clean workspace. Production has the corresponding privilege migration under version `20260927074210`; source replay still needs an approved, historically faithful bootstrap/reconciliation approach.
- The repository's migration-history immutability gate rejects modification/deletion of existing migration files. Do not rename or rewrite these files in the stacked SMM branch. The original migration-owning PR must reconcile source names/content against production evidence without changing production or bypassing immutability.
- This is the first concrete source-to-ledger comparison for these collisions; it is not permission to apply migrations or change the live ledger.

### Updated status
- P0 RC449/RC462 candidate behavior: **PASS on tested disposable PostgreSQL revision** `10fe17516029d7c4e42f155548ee5c64eb2e3d80`; live production authorization remains **BLOCKED** until an approved release path is applied and reverified.
- P1 migration-version uniqueness/source parity: **FAIL / BLOCKED**.
- S04 clean replay: **FAIL / BLOCKED**.
- SMM exact-head CI: **NOT VERIFIED**; the workflow trigger filter has been corrected in commit `94edc7e364efe3313eaa30c51c829b909e2fa3fd`, but the available run lookup does not expose push-triggered runs.
- Release: **BLOCKED / NOT CERTIFIED**.

### Next exact actions
1. Keep the SMM PR draft and unmerged; confirm its push-triggered workflow run by its run page and exact head SHA when available.
2. Coordinate source reconciliation on the migration-owning PR: preserve all applied SQL, identify the nine byte/semantic matches and three mismatches, and resolve duplicate versions without rewriting any migration already present in the target base.
3. Resolve the earliest missing SMM schema dependency and subsequent historical bootstrap gaps only in disposable infrastructure with explicitly approved schema baselines; do not create placeholder functions or skip migrations.
4. Re-run source uniqueness/immutability checks, then a complete chronological disposable replay from a clean database. Keep the gate failed until both pass.


## Final checkpoint for this execution cycle — 2026-10-13

- PR #225 rechecked: open, draft, unmerged; base `docs/rc521-admin-operations-discovery-20261013`; current head before this checkpoint commit: `2c57b6223c1faec8109a188eb18639a9c04e8b37`. PR link: https://github.com/islamnagy2022-eng/MantiqatiX/pull/225.
- Latest source/log evidence in this cycle is recorded above; this checkpoint is documentation-only and does not modify runtime, migration SQL, production settings, or data.
- A fresh **read-only production** query against `pg_catalog.pg_proc` confirmed all four high-risk MantiGO RPCs remain in the unsafe live state:
  - `get_mantigo_admin_dashboard_backend`
  - `get_mantigo_admin_financial_report_backend`
  - `settle_mantigo_captain_backend`
  - `expire_stale_mantigo_rides_backend`
  For all four: `SECURITY DEFINER = true`, `search_path=public`, `authenticated_can_execute = true`, and `calls_platform_guard = false`.
- This is a current P0 production blocker. The RC449/RC462 candidate passed disposable integration tests, but production remains unmodified because the approved workflow requires separate authorization for production changes. Do not hot-edit production.
- No production SQL mutation was run. The only Supabase SQL queries in this cycle were SELECTs against migration metadata and `pg_catalog`.
- **Status:** P0 live authorization **BLOCKED**; P1 migration source/version parity **FAIL / BLOCKED**; S04 clean replay **FAIL / BLOCKED**; SMM exact-head CI **NOT VERIFIED**; production release **BLOCKED / NOT CERTIFIED**.
- **Resume first:** verify current SMM push-triggered CI on its exact head, then coordinate migration source reconciliation in PR #218 using the production-version/content map above. Do not merge, deploy, apply migrations, or change live grants/Auth/RLS without separate explicit approval.


## Cross-session coordination checkpoint — 2026-10-13 05:08 UTC

- Rechecked PR #207 before any edits to its owned migration/replay files. Its branch `reconcile/rc425-458-current-main-20261011` had advanced to `5221973aad1cb37ebd411e6d896c57732da111d3`; another session corrected the payment-event index validator in commit `fix(ci): validate payment event indexes at their actual sources`. Do not duplicate or overwrite that fix.
- Latest PR #207 workflow run [#38349796102](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38349796102) is in progress. The historical schema preflight, test-only baseline injection, and exact-copy/untracked guards all passed; Supabase disposable service startup is still in progress; chronological replay has not started, so full replay remains **NOT VERIFIED** on this run.
- The prior run [#38349544642](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38349544642) failed at the old payment-event index validator. That failure is superseded by the new commit and must not be used as the current verdict.
- A separate diagnostic PR #226 was opened briefly, then closed as superseded after discovering PR #207 already owns the approved SMM schema-only baselines and a more comprehensive historical schema baseline validator. PR #226 was not merged. Its branch is retained for audit traceability only.
- PR #225 remains OPEN/DRAFT/UNMERGED, head `0a323e9c3c88c2c97e433790ac3a261a4b803de2`, base PR #218 head `77012649e41fe22077538c39cd8593bf696ab33e`. Its workflow is configured for push and matching PR events, but the available workflow-run lookup only exposes PR-triggered runs and currently returns no exact-head run. SMM exact-head CI remains **NOT VERIFIED**.
- Current independent status: RC449/RC462 disposable authorization integration passed on its previously tested revision; four live MantiGO RPCs remain a confirmed P0 production blocker from read-only catalog checks. No production changes were made.
- No migrations, data, Auth/RLS/grants, live Edge Functions, wallet/payment operations, or deployment actions were performed during this coordination pass.

### Resume from here
1. Check run #38349796102 until it completes; capture the exact failure or PASS and SHA. If it fails, diagnose the next first chronological dependency rather than skipping it.
2. Keep the production MantiGO RPC issue BLOCKED until a separate approved production change process is available; candidate tests are not production evidence.
3. Keep PR #225 draft and unmerged; verify SMM on exact SHA via the actual Actions run page if the connector still cannot expose push-triggered runs.
4. Continue P0 payment/webhook and tenant-isolation review on disposable tests, without overlapping files owned by PR #207.
5. Production release remains **BLOCKED / NOT CERTIFIED**.


## Read-only live SMM deployment parity recheck — 2026-10-13 05:09 UTC

- Supabase Edge Function inventory reports `smm-gateway` **ACTIVE, version 10**, `verify_jwt=true`, entrypoint SHA-256 `80fe058973fafdee71e3c9637469077bf115dc2a29014f5f347b5a54ebe90994`.
- Retrieved the deployed Edge Function source read-only. Its `index.ts` is **byte-for-byte identical after newline normalization** to `supabase/functions/smm-gateway/index.ts` at PR #218 base head `77012649e41fe22077538c39cd8593bf696ab33e`: both are 19,650 characters in the API response and both contain `const SMM_INITIAL_LAUNCH_DEFERRED=true`.
- The live handler checks HTTP method, computes the two-flag launch decision, then returns HTTP 503 `SMM_DEFERRED` before verified-user lookup, JSON body parsing, provider calls, order writes, or wallet RPCs. This is current deployed-source evidence that the SMM storefront API is contained at the handler entrypoint; it supersedes older notes referring to live version 6 as the current version.
- This does **not** certify post-launch SMM functionality, provider safety, service-role grants, or the full release. Do not enable SMM or alter environment flags without a separately reviewed and approved post-launch release.
- Read-only production MantiGO catalog checks still confirm the four global admin/report/settlement/expiry RPCs remain callable by `authenticated`, SECURITY DEFINER, `search_path=public`, and missing `mnty_can_platform_admin()`. Those are independent P0 blockers.
- No deployment or production mutation was performed during this check.


## Latest CI and financial schema-lineage checkpoint — 2026-10-13 05:11 UTC

### SMM security regression CI
- Run [#38349997044](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38349997044) completed **SUCCESS** for the SMM code revision `b1c43c1affeffd44e7e44d4ce07b554bc59a354d`, checked out as synthetic merge commit `55974e2` with base `77012649e41fe22077538c39cd8593bf696ab33e`.
- Verified steps: SMM source-contract validator, service-role ACL boundary validator, Deno type check, and SMM unit/negative-input tests all **PASS**.
- The first run on the previous code revision failed because the static validator searched `provider-transport.ts` for `redirect:"error"`, while the actual `fetch()` call and redirect option live in `index.ts`. Corrected the assertion to inspect the actual call site; the next run passed all four steps.
- A subsequent documentation-only commit `3d9f4f8027ddc994f7b00208e94d4be63e1a2707` updated this continuation record. The SMM workflow path filter does not include this documentation file; the tested runtime/validator files did not change after the successful run. Do not describe this as a test run on the documentation commit itself.

### Latest chronological replay result
- PR #207 exact candidate head `5221973aad1cb37ebd411e6d896c57732da111d3` was tested as synthetic merge commit `5637e65` against `main`.
- Run [#38349796102](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38349796102) passed the historical-schema preflight and test-only fixture copy/untracked guards, successfully started the disposable Supabase stack, then failed during chronological replay at `20260920211717_security_definer_surface_reduction_and_finance_rls.sql`:
  `ERROR: relation "public.settlement_attempts" does not exist (SQLSTATE 42P01)`.
- This is a newly exposed financial schema-lineage dependency. The run is **FAIL**, not a replay pass.

### Read-only production evidence for settlement_attempts
- `public.settlement_attempts` exists in production, owned by `postgres`, with RLS enabled and FORCE RLS enabled.
- Read-only column/constraint/index/policy/grant queries returned schema metadata only; no settlement rows or financial values were queried.
- Columns: `id varchar NOT NULL`, `tenant_id varchar NOT NULL`, `obligation_id varchar NOT NULL`, `provider varchar NOT NULL`, `destination_id varchar NULL`, `amount numeric(14,4) NOT NULL`, `currency varchar(8) NOT NULL`, `status varchar NOT NULL DEFAULT 'PENDING'`, `external_reference varchar NULL`, `failure_code varchar NULL`, `failure_message text NULL`, `created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP`, `updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP`.
- Constraints: PK `id`; FK `tenant_id -> tenants(id) ON DELETE RESTRICT`; FK `obligation_id -> financial_obligations(id) ON DELETE RESTRICT`; nullable `destination_id -> payout_destinations(id) ON DELETE RESTRICT`; unique `(obligation_id, external_reference)`; check `amount > 0`.
- Indexes: PK index; unique index `(obligation_id, external_reference)`; `idx_settlement_attempts_obligation` on `(obligation_id, created_at DESC)`.
- RLS policy: `settlement_attempts_finance_read`, SELECT for `authenticated`, constrained through the related obligation and an ACTIVE membership with role OWNER/ADMIN/FINANCE/ACCOUNTANT/FINANCE_MANAGER. Direct table grants reported to `service_role` were REFERENCES/TRIGGER/TRUNCATE only; no SELECT/INSERT/UPDATE/DELETE grants to ordinary API roles appeared in the returned matrix.
- This catalog snapshot is evidence for a possible **disposable-only** compatibility baseline, not recovered historical creation DDL. No such baseline was created or injected in this session; the existing explicit approvals for SMM and credit fixtures do not automatically authorize a new financial settlement fixture. Next safe action is to recover authoritative historical DDL or obtain explicit approval for a clearly labeled schema-only disposable baseline.

### Current overall status
- SMM handler containment: **PASS by deployed-source inspection**; live Edge Function is ACTIVE v10, `verify_jwt=true`, SHA-256 `80fe058973fafdee71e3c9637469077bf115dc2a29014f5f347b5a54ebe90994`, and its entrypoint is byte-for-byte identical after newline normalization to PR #218 source, including `SMM_INITIAL_LAUNCH_DEFERRED=true`. It returns 503 before identity lookup/body parsing/provider/wallet/order side effects.
- SMM source/unit CI: **PASS** on the tested code revision above; no live HTTP side-effect test was run.
- PR #207 migration replay: **FAIL / BLOCKED** at `settlement_attempts` dependency.
- Live MantiGO platform authorization: **BLOCKED**; four global admin/report/settlement/expiry RPCs remain authenticated-executable SECURITY DEFINER functions with `search_path=public` and no platform-admin guard.
- Production release: **BLOCKED / NOT CERTIFIED**.


## Current release-gate snapshot — 2026-10-13 05:12 UTC

- PR #225's latest code-bearing commit `b1c43c1affeffd44e7e44d4ce07b554bc59a354d` passed SMM source contract, service-role boundary static validator, Deno type check, and SMM unit/negative-input tests in run [#38349997044](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38349997044). Later commits `3d9f4f8...` and `e10f683...` only updated verification documentation; the workflow path filter does not include those docs. Do not claim that the docs-only head itself was re-run.
- Read-only deployed Edge Function check: `smm-gateway` ACTIVE v10, `verify_jwt=true`, hash `80fe058973fafdee71e3c9637469077bf115dc2a29014f5f347b5a54ebe90994`; deployed `index.ts` exactly matches PR #218's entrypoint after newline normalization and returns 503 at the hard-disabled gate before auth/body/provider/wallet/order paths.
- Separate read-only production ACL query found zero direct SELECT/INSERT/UPDATE/DELETE grants to `anon`, `authenticated`, or `service_role` across the eight SMM tables. The secret/wallet RPCs do allow `service_role EXECUTE` and deny it to `anon/authenticated`. Thus the gate is containing the feature, but RC456's candidate direct-table grant contract is not proven applied live; do not enable SMM until an approved post-launch migration/review and tests exist.
- PR #207 replay run [#38349796102](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38349796102) now starts and reaches chronological replay but fails at `20260920211717_security_definer_surface_reduction_and_finance_rls.sql` because `public.settlement_attempts` is missing in the empty test database. A read-only query of the applied migration ledger for `CREATE TABLE/ALTER TABLE settlement_attempts` returned no rows. Production has the table with RLS and FORCE RLS, finance-read policy, constraints and indexes as recorded above. No new baseline was created: the existing explicit fixture approvals do not automatically authorize a new financial table baseline.
- Live MantiGO P0 remains unchanged: the four global admin/report/settlement/expiry RPCs remain SECURITY DEFINER, authenticated-executable, `search_path=public`, without a platform-admin guard. Candidate RC449/RC462 tests previously passed 15/15 on their tested disposable revision; this is not production proof.
- PR #226 was closed as superseded after confirming PR #207 already owns the historical schema baseline validator and approved SMM fixtures; it was not merged.
- No production mutation, migration application, grant/Auth/RLS change, provider request, wallet/payment operation, merge, or deployment was performed in this cycle.
- **Overall: BLOCKED / NOT CERTIFIED.** Resume by following the next chronological replay blocker through PR #207, verify the latest run to completion, and keep the settlement baseline behind explicit approval or recovered authoritative DDL.


## Read-only payment/webhook source parity check — 2026-10-13 05:13 UTC

- Production constraint metadata confirms these duplicate-protection contracts exist in the live schema:
  - `payment_intents`: UNIQUE `(tenant_id, idempotency_key)`.
  - `payment_events`: UNIQUE `(event_id)`.
  - `payment_provider_events`: UNIQUE `(provider, external_event_id)`.
  - `settlement_attempts`: UNIQUE `(obligation_id, external_reference)`.
- Live `payment-webhook` is ACTIVE v1, `verify_jwt=false` (expected for provider callbacks), entrypoint hash `1a415557f2fccaec6704fcc01a4b71dbaedc95b5f9c611fef23781c4b18d8642`, and its entrypoint matches the PR #207 candidate source after newline normalization. Source inspection shows signature verification and atomic RPC usage; no live webhook request was sent.
- Live `paymob-webhook` is ACTIVE v8, `verify_jwt=false`, hash `f26fe1580e66c7f8cb9b885d5bccf4a44e49aa74874b3fe28dd7f9c5ed181cca`. Its deployed entrypoint is 11,538 characters and **does not match** the PR #207 candidate source (15,041 characters). The deployed source still directly updates a pending `subscription_payment_intents` row on a failure callback after an existence check, while the candidate uses the atomic `process_verified_subscription_payment_failure` RPC and explicit retryable provider-correlation handling. This is a deployment/source-parity and webhook-race acceptance blocker; it is not proof by itself of an exploitable live incident.
- Production migration ledger remains through RC424, so RC425–RC458 candidate changes are not proven applied. Do not deploy the candidate webhook independently of the required migrations, exact-head E2E tests, and rollback plan.
- All observations were read-only metadata/source inspections; no payment, wallet, webhook, customer data, or production configuration was modified.


## Expanded live payment Edge Function parity matrix — 2026-10-13 05:14 UTC

Read-only comparison of deployed Edge Function `index.ts` against PR #207 branch `reconcile/rc425-458-current-main-20261011`:

| Function | Live version | `verify_jwt` | Live/source exact match | Key observation |
|---|---:|---|---|---|
| `payment-intent` | 6 | true | NO | Candidate adds explicit `provider_order_id` correlation not present in live source. |
| `payment-webhook` | 1 | false | YES | Provider callback uses signature checks and RPC paths; no live callback was invoked. |
| `paymob-webhook` | 8 | false | NO | Candidate adds retryable provider-correlation and atomic failure RPC paths; live source still has a direct conditional update for subscription failure. |
| `digital-page-payment-intent` | 3 | true | NO | Candidate adds explicit `provider_order_id` correlation checks. |
| `subscription-payment-intent` | 2 | true | NO | Candidate adds retryable provider-correlation handling. |
| `mantigo-payment-intent` | 3 | false | NO | Live handler manually requires a Bearer token and validates it through Supabase Auth, rejects anonymous users, and scopes subsequent actions; `verify_jwt=false` alone is not proof of a bypass. |

- Live/source equality was checked on the complete entrypoint content after newline normalization. The production Edge Function inventory reports the versions and SHA-256 values; source files were read from the PR #207 candidate branch.
- For `payment-webhook`, exact source parity is positive evidence only for the entrypoint, not proof of webhook signature correctness, DB function parity, or end-to-end duplicate delivery safety.
- The other five source mismatches align with the fact that PR #207's RC425–RC458 candidate has not been deployed. They are release-parity blockers, not automatically confirmed vulnerabilities. Review the exact diffs and tests before any staged deployment.
- Live schema metadata confirms uniqueness on `payment_intents(tenant_id,idempotency_key)`, `payment_events(event_id)`, and `payment_provider_events(provider,external_event_id)`. These database constraints support idempotency, but no live payment event or webhook request was executed.
- No production deployment, migration, grant, payment, wallet, webhook, or data mutation was performed.


## Review of new settlement_attempts replay fixture — 2026-10-13 05:16 UTC

- PR #207 advanced to head `60bb79a5010e65af05896ac2bca3de71f72a2916`, adding `supabase/tests/baselines/settlement_attempts.sql` and temporary injection at `20260920211715`. This is another session's work; I did not modify its files.
- I compared the new fixture to the earlier read-only production catalog evidence and found exact-shape drift:
  - Production `amount` is `numeric(14,4)` (`numeric_precision=14`, `numeric_scale=4)); fixture currently says unbounded `numeric`.
  - Production `currency` is `character varying(8)`; fixture currently says unbounded `character varying`.
  - The validator currently asserts those unbounded types, so it would not catch this drift.
- The fixture does correctly omit data rows, grants, and policies, and the chronological migration remains responsible for the later finance-read policy. The live catalog also has PK/FKs/check/unique constraints and `idx_settlement_attempts_obligation`.
- I added a review comment to PR #207: [comment 6138767562](https://github.com/islamnagy2022-eng/MantiqatiX/pull/207#issuecomment-6138767562), asking for exact type/length parity, validator assertions, and confirmation of approval provenance. I did not alter the other session's branch.
- Latest CI for head `60bb79a...` includes replay run [#38350353538](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38350353538), which was pending/queued at the last check; it has not yet supplied a replay result.
- Treat this fixture as **PROPOSED / NOT VERIFIED FOR SCHEMA PARITY** until the mismatch and approval boundary are resolved, even if the replay run proceeds. Full release remains **BLOCKED / NOT CERTIFIED**.


## Exact-head verification checkpoint — 2026-10-13 05:18 UTC

### SMM gateway security regression — PASS on reviewed source commit

- PR #225 exact tested head: `22ac357c8a375e4f0edf7e6de76f1435c10c46aa`.
- Run [#38350564285](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38350564285) completed **success**; job `source-and-unit` completed successfully. This covers the static SMM security contract and the Deno checks/unit tests configured by that workflow. It is not a live HTTP Edge Function runtime test.
- The redirect assertion was made literal and deterministic in `scripts/validate-smm-gateway-security.mjs` at this head. The provider request source still explicitly uses `redirect:"error"`.
- PR #225 is still **OPEN / DRAFT / UNMERGED**, based on PR #218 head `77012649e41fe22077538c39cd8593bf696ab33e`. Do not merge automatically.

### Historical migration replay — not yet passed

- PR #207 has continued to advance; latest observed head at this checkpoint is `e0cdd1f12f89dfbfdd3476ebd121a1dff09c4de1`.
- The earlier replay run [#38350541588](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38350541588) failed in the temporary-baseline verification shell because `settlement_attempts_baseline` was not declared in that shell. The latest workflow source now includes the declaration, but the next exact-head replay run is still pending/not yet verified.
- Separate schema review flagged that the test-only settlement-attempts fixture must preserve exact catalog type modifiers (`amount numeric(14,4)`, `currency varchar(8)`) and have explicit provenance/approval. Do not treat the fixture as release evidence until those checks and the next exact-head run pass.
- The previously observed replay failure at `20260920211717_security_definer_surface_reduction_and_finance_rls.sql` with missing `public.settlement_attempts` remains a valid historical failure on that older run; it is not proof that the newer head has passed.

### Live production guardrail recheck

- Read-only catalog evidence still shows `get_mantigo_admin_dashboard_backend`, `get_mantigo_admin_financial_report_backend`, `settle_mantigo_captain_backend`, and `expire_stale_mantigo_rides_backend` as SECURITY DEFINER, `search_path=public`, executable by `authenticated`, and not checking `mnty_can_platform_admin()`.
- Candidate RC449/RC462 migrations and disposable integration tests exist in repository source, and the focused MantiGO platform-admin workflow passed on the earlier PR #218 base-head run. That does not mean the fixes are live: production catalog evidence still shows the vulnerable deployed definitions.
- The deployed `smm-gateway` remains version 10, with source identical to the PR #218 base source and hard-disabled at entry with HTTP 503 `SMM_DEFERRED`. No production deployment or environment change was performed.

### Current release verdict

**BLOCKED / NOT CERTIFIED.** SMM static/unit regression is green at its exact tested SHA. Full chronological migration replay is still unresolved; live MantiGO RPC authorization is a P0 production blocker. No merge, production migration, data mutation, grants/Auth/RLS change, wallet/payment operation, or deployment was performed.


## Payment callback atomicity workstream — 2026-10-13 05:23 UTC

- Opened draft PR #227: https://github.com/islamnagy2022-eng/MantiqatiX/pull/227 (branch `security/paymob-mantigo-atomic-rpc-wiring-20261013`, based on PR #218 head).
- Read-only production catalog confirms `payment_provider_events.payment_intent_id` references `payment_intents(id)`, while the Paymob MantiGO callback was writing a `mantigo_financial_ledger.id` into that field. The old callback also split event insert, ledger update, and notification into separate REST calls.
- Corrected the candidate callback to call the existing RC425 `process_verified_mantigo_payment_backend` RPC, which uses the dedicated `mantigo_payment_provider_events` table and an atomic ledger/event/notification transaction. The callback now passes a minimized normalized binding payload and no longer writes those tables directly.
- Added static contract checks to forbid direct event/ledger/notification writes inside the MantiGO callback branch and a focused workflow that runs the existing RC425 disposable PostgreSQL integration.
- Exact-head workflow [#38351020381](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38351020381) completed **SUCCESS** for both `static-boundary` and `disposable-postgres` jobs at code head `e69b6f7e3bf3f2672835a736d61bec60f573e144`. This proves the candidate's static boundary and RC425 isolated PostgreSQL tests; it does not prove a real signed Paymob sandbox E2E or production deployment.
- PR #227 remains **OPEN / DRAFT / UNMERGED**. No production deployment or payment was performed.

## Latest migration replay failure — 2026-10-13 05:23 UTC

- PR #207 has advanced to head `6ec626662d90cad8926fc129433ae73d3aa15290` at this checkpoint.
- Exact run [#38350704904](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38350704904) now passes the temporary-baseline verification shell and proceeds farther through the chronological migrations, but fails at `20260927033925_harden_smm_bootstrap_trigger_execute_privilege.sql` with `ERROR: function public.smm_bootstrap_first_admin() does not exist (SQLSTATE 42883)`.
- This is the next missing historical function dependency in the disposable replay, not a reason to synthesize a production migration or stub a function. PR #207 remains the migration-history owner; resolve through authoritative source/ledger evidence and test-only compatibility only with explicit provenance/approval.
- The new run still concludes **FAIL**; full migration replay remains **NOT VERIFIED**.


## Historical SMM bootstrap function provenance check — 2026-10-13 05:24 UTC

- Read-only production catalog confirms `public.smm_bootstrap_first_admin()` exists as a trigger-returning `SECURITY DEFINER` function with `search_path=public`; it creates the first `smm_admins` row only when that table is empty. It is not executable by `anon`, `authenticated`, or `service_role`.
- Repository search found no tracked canonical creation migration in the current source tree; the master production TODO mentions it only as trigger-only. This supports treating the replay error as a historical source gap, not broadening its ACL or synthesizing production history.
- Added evidence/comment to PR #207: https://github.com/islamnagy2022-eng/MantiqatiX/pull/207 (comment ID `6138870917`). No files in the migration-owning PR were edited. A disposable-only function baseline still requires canonical source/provenance or explicit owner approval.
- Latest observed PR #207 head `9556b9a9dde205d30000a830be67f001704b996a`; run [#38351107774](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38351107774) is pending. Do not carry forward an old run's failure as the latest verdict, and do not report a pass until this exact-head run completes.


## Root-cause checkpoint — production MantiGO authorization drift and SMM CI — 2026-10-13 05:28 UTC

### SMM exact-head regression

- PR #225 current head: `04b6513cff0131c7dab003c7a6d9a98d8dc430b3`, draft/open/unmerged.
- Exact-head workflow [#38351175629](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38351175629) completed **SUCCESS** for the SMM static contract, service-role ACL validator, Deno type-check, and SMM unit/negative-input tests.
- This is source/isolated test evidence only. It does not certify the live provider path because the deployed gateway remains intentionally hard-disabled.

### MantiGO P0 — observed live behavior, source candidate, and root cause

- Read-only live catalog query retrieved the actual definitions of `get_mantigo_admin_dashboard_backend(uuid)`, `get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)`, `settle_mantigo_captain_backend(uuid,text,text)`, and `expire_stale_mantigo_rides_backend(uuid,integer)`.
- All four live functions are `SECURITY DEFINER`, use `search_path=public`, are executable by `authenticated`, and authorize broad tenant roles (`OWNER`, `ADMIN`, `OPERATIONS`, etc.) rather than calling `mnty_can_platform_admin()`. The dashboard/report read platform-wide ride and financial ledger totals; settlement mutates ledger/journal state; expiry changes ride state.
- Candidate migration `20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql` already replaces these guards with a strict active `SUPER_ADMIN` membership in tenant `MNTY-PLATFORM`, explicit `scope=PLATFORM` and `full_control=true`, and `search_path=''`. RC462 further hardens malformed permission JSON handling.
- **Root cause is deployment/migration-chain drift, not a missing code patch:** the hardening source and disposable integration tests exist, but the live catalog still has the pre-hardening definitions. Do not make another duplicate migration or claim the production risk is fixed by a green candidate CI.
- Existing integration test `supabase/tests/rc449_mantigo_platform_admin_integration.sql` tests rejection of tenant OWNER/ADMIN/OPERATIONS_MANAGER for all four functions and verifies authorized platform settlement/idempotency in disposable PostgreSQL.
- Required root fix is a single fully reconciled, chronological, approved migration batch after the live ledger checkpoint, replayed from a clean disposable database and then separately approved for production rollout. Do not apply RC449/RC462 alone or directly mutate production functions/grants in this session.

### Migration replay current checkpoint

- Latest observed PR #207 head: `136600157e02889b36b267dfd8632542662ceec3`.
- Exact-head run [#38351334323](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38351334323) is **IN PROGRESS** at disposable Supabase service startup. The next chronological replay step has not yet been verified; no PASS is claimed.
- Historical source gap remains: `public.smm_bootstrap_first_admin()` exists in the live catalog as trigger-only SECURITY DEFINER but no canonical tracked creation migration was found. Do not synthesize it into production history. Continue seeking canonical source/ledger provenance or explicitly approved test-only compatibility evidence.
- Financial fixture review remains open: `settlement_attempts` compatibility fixture must match observed `numeric(14,4)` and `varchar(8)` types and must not be treated as canonical historical DDL. Preserve its schema-only/test-only provenance and no-data/no-policy/no-grant constraints.

### Safety / release

- No production migration, schema, data, grant, Auth/RLS, function, wallet, settlement, payment, Edge Function, or deployment change was made.
- Release remains **BLOCKED / NOT CERTIFIED**. Exact next action: wait for run #38351334323; if startup succeeds, capture the first chronological SQL failure and reconcile from authoritative source evidence, not by skipping migrations or weakening guards.


## Latest chronological replay diagnosis — 2026-10-13 05:30 UTC

- Exact replay [#38351334323](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38351334323) completed startup and passed the temporary-baseline verifier, then failed at `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql`, statement 5: `policy "approval_requests_scoped_read" for table "approval_requests" does not exist (SQLSTATE 42704)`.
- Read-only production `pg_policies` evidence shows the missing live SELECT policy's actual semantics: active membership in the same tenant, and either requester ownership or role OWNER/ADMIN/SUPER_ADMIN/MANAGER; a separate restrictive non-anonymous guard also exists. No table rows were read.
- This failure was reported to the owner of PR #207 with exact error, source-search finding, catalog-derived predicate and safe resolution options. PR #207 subsequently added `supabase/tests/baselines/approval_requests_scoped_read.sql` and a temporary pre-`ALTER POLICY` injection at `20260927140499`, plus fail-closed provenance/shape/no-grant/no-data validation. This is test-only compatibility, not recovered historical DDL.
- The same active migration workstream also added a clearly labeled trigger-only `smm_bootstrap_first_admin()` compatibility baseline based on read-only `pg_get_functiondef` evidence. It is never invoked during replay and does not broaden EXECUTE grants. Historical provenance is still unresolved.
- Latest observed PR #207 head after those fixes: `e7fcd20f5c9a125d2a99590cb56a688086ab95cb`; its new exact-head replay [#38351708218](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38351708218) was pending when checked. Do not infer a pass from the previous run.
- Root fix principle retained: compatibility baselines are only disposable test scaffolding to discover the next dependency. They do not repair the canonical migration archive or prove production ledger consistency. Release remains **BLOCKED / NOT CERTIFIED**.


## SMM exact-head regression result — 2026-10-13 05:37 UTC

- PR #225 current head at this check: `4117a7788f2ec632269e46870dea51863fe274ef`.
- Exact-head workflow run [#38351776942](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38351776942) completed **SUCCESS**; its `source-and-unit` job passed.
- The earlier redirect assertion was corrected to use a deterministic literal string assertion, avoiding the previous invalid regex. The successful run is the evidence for that fix on the exact PR head.
- Scope of PASS: source security-contract validator and SMM unit/static checks included in that workflow only. It does not certify live post-launch functionality, migration replay, provider end-to-end behavior, wallet/payment E2E, or production readiness.
- PR #225 remains draft/open/unmerged. Production SMM remains fail-closed; no production deployment or flag change was made.
- Independent current blockers remain: PR #207 chronological replay is being repaired from one missing historical policy dependency at a time using read-only production catalog evidence and disposable-only fixtures; the live MantiGO global-admin RPC authorization issue is still P0.


## Root-cause correction — SMM trigger privilege migration (2026-10-13 06:03 UTC)

- Exact prior failure: run [#38350577917](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38350577917), migration `20260927033925_harden_smm_bootstrap_trigger_execute_privilege.sql`, SQLSTATE `42883` function does not exist.
- Production read-only catalog confirms the trigger function exists and direct EXECUTE is denied to `anon`/`authenticated`; no production changes made.
- Root source gap: the tracked archive has the revoke migration but not the historical create-function migration. The approved live-derived test fixture was being copied as a temporary migration, yet it did not appear in the reset's executed migration log before the revoke migration.
- Updated the migration-owning PR #207 workflow in commit `ae5f6f63672a0aa2947f3d20fc70cae7e99ff6d0` to reset the disposable DB through version `20260927033924`, inject the fixture via the running disposable Postgres container, apply the real lockdown migration `20260927033925`, assert PUBLIC/anon/authenticated cannot execute it, then continue the rest of the chain.
- Current exact-head replay run [#38354483080](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38354483080) is **IN PROGRESS** at disposable service startup. The ACL-specific result and subsequent chronological replay are not verified yet.
- This correction does not reconstruct canonical history; the live-derived fixture remains disposable-only. PR #207 stays unmerged; release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-13 continuation — Paymob RPC integration and migration replay progress

### Paymob webhook atomicity: aligned with the canonical candidate PR
- Read-only inspection found PR #218 already owns the stronger RC425/RC428/RC429/RC430 database-side atomic RPCs. A separate duplicate implementation was therefore closed as superseded (PR #230, closed unmerged) to avoid competing function signatures and weaker event storage.
- New stacked draft PR #231: https://github.com/islamnagy2022-eng/MantiqatiX/pull/231 — branch `security/paymob-webhook-rc425-integration-20261013`, base `docs/rc521-admin-operations-discovery-20261013`.
- The Edge Function now routes MantiGO through RC425 with flattened provider/order/amount/currency/success binding; ordinary-order failures through RC428; subscription failures through RC429; and subscription success through RC430. The Edge Function no longer separately inserts MantiGO provider events/notifications or directly updates the failure intent rows.
- Dedicated workflow [#38356125130](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38356125130) completed SUCCESS on PR #231's tested head `a0068d2f2f8fefc4f645b86a37c62b9e8c9f7f6a`: static RPC contract, Deno type-check, isolated PostgreSQL application of RC425–RC430, RC425 integration test, and new RC428/RC429/RC430 integration cases all passed.
- This is candidate evidence only; no production migration or Edge Function deployment occurred. Real Paymob E2E, settlement reconciliation, and live rollout remain NOT VERIFIED.

### Historical migration replay: next gap and harness repair
- A previous replay run failed because the workflow searched for a Docker container name that was not stable; this was replaced with a direct disposable Supabase DB URL.
- A subsequent run exposed a second harness defect: `supabase migration up --local --version ...` prints the CLI version rather than targeting a migration. The workflow now applies the target SQL directly for the isolated ACL assertion, then lets the normal migration runner reapply the idempotent statement and record it in the disposable migration ledger.
- The latest replay then reached `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql` and failed because `public.marketing_leads` has no canonical CREATE TABLE migration in the repository source, while production's read-only ledger also has no marketing-lead creation migration record.
- Added a narrowly scoped test-only live-derived `marketing_leads` baseline at temporary version `20260927140496`, before the policy migration. It creates no rows, is copied only in disposable replay, includes only the policy required by the historical `ALTER POLICY`, and is guarded by the baseline validator/workflow exact-copy and untracked-file checks. Current full replay CI is queued/pending; no PASS is claimed yet.
- Latest migration branch head at this checkpoint: `8e259abab75a83a0810b8368e6ad2cd94890f164`; workflow run [#38356432723](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38356432723) is pending at last inspection.

### Current release blockers
- Live MantiGO admin/report/settlement/expiry RPCs remain a P0 production blocker: the prior read-only catalog query confirmed SECURITY DEFINER, `search_path=public`, authenticated EXECUTE, and no `mnty_can_platform_admin()` guard.
- Migration source chronology remains FAIL/BLOCKED until duplicate versions, missing RC433 source, and all clean-replay dependencies are reconciled.
- Release remains **BLOCKED / NOT CERTIFIED**. No production data, migrations, Auth/RLS/grants, payment/ledger records, or live deployments were modified.


## SMM exact-head CI result — 2026-10-13

- Latest PR #225 head `a54e118879deae6460a3f689f1144bb7eb878a99` was verified by workflow [#38356494948](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38356494948): **SUCCESS**.
- Steps passed: SMM security-contract validator, service-role ACL boundary validator, Deno type-check, and SMM unit/negative-input tests.
- This closes the previous `NOT VERIFIED` status for the candidate SMM source/unit gate at this exact head. It does not prove post-launch provider functionality: the deployed `smm-gateway` remains intentionally fail-closed with `SMM_INITIAL_LAUNCH_DEFERRED=true`, and its live source is still the base PR #218 version.
- PR #225 remains draft/open/unmerged. Do not enable SMM or deploy without separate release approval.


## Root-cause replay work — marketing project dependencies (2026-10-13 13:36 UTC)

- Latest confirmed PR #207 clean-replay run before this change, [#38404099600](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38404099600), passed the historical-baseline preflight and temporary-baseline copy/untracked checks, started disposable Supabase, and reached `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql`. It failed on missing `public.marketing_project_participants` (SQLSTATE 42P01).
- Read-only production catalog queries inspected both `marketing_projects` and `marketing_project_participants` columns, defaults, constraints/FKs, indexes, RLS/force-RLS, policy predicates/roles, and table grants. Read-only `supabase_migrations.schema_migrations` search found no canonical CREATE TABLE DDL for either; only the policy ALTER migration refers to them. No operational rows were read or copied.
- Added the two tables to the existing owner-approved test-only `supabase/tests/baselines/marketing_leads.sql` compatibility fixture, in dependency order: marketing leads → projects → project participants. The fixture contains no data, explicitly revokes broad table grants, preserves observed least-privilege grants, and includes the current catalog policy predicates needed by the historical ALTER POLICY migration.
- Extended `scripts/validate-historical-schema-baseline.mjs` to verify both table definitions, dependencies, constraints, indexes, RLS, policy predicates, grants, and the exact chronological ALTER POLICY statements. First CI attempt failed closed because two index assertions did not account for the catalog's explicit `USING btree` clause. Fixed the validator to accept that explicit index method; this was a validator bug, not a schema change.
- Pushed to the migration-owning PR #207 branch only after checking its head was unchanged. Latest PR #207 head is `b30aa0fe1e41fe7f0216a8fa816dc17a65e71b74`. New run [#38406227251](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38406227251) has passed the historical baseline preflight, exact-copy/untracked checks, migration version uniqueness, and migration history immutability. Disposable Supabase service startup is in progress; the full replay result is **NOT VERIFIED** yet.
- The baseline remains synthetic/live-derived, not recovered historical DDL. This change only affects isolated CI fixtures and does not modify production schema, data, grants, Auth, RLS, or migration history.
- PR #225's exact-head SMM regression run [#38356801037](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38356801037) passed: static SMM contract validator, service-role boundary validator, Deno check, and 7 unit tests. This explicitly does not claim live HTTP/runtime test coverage or launch readiness.
- Production release remains **BLOCKED / NOT CERTIFIED**: four MantiGO global admin/report/settlement/expiry RPCs still have the previously verified live authorization defect; migration provenance and full clean replay remain open.

### Next exact actions
1. Poll run #38406227251 and inspect the next first chronological replay error; do not skip or rewrite historical migrations.
2. Continue only with schema/policy compatibility baselines backed by read-only catalog evidence and the project's approved disposable-only baseline process. Record all historical-source limitations.
3. Recheck PR #207's mergeability/CI and PR #218's four-RPC production blocker. Do not merge/deploy or alter production.


## Replay continuation checkpoint — marketing subscription dependencies (2026-10-13 13:39 UTC)

- Exact replay run [#38406227251](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38406227251) completed FAIL after passing preflight, disposable Supabase startup, and the earlier marketing projects/participants tables. It stopped at `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql` because `public.marketing_provider_subscriptions` was absent.
- Read-only production catalog evidence established the missing table's parent dependency `public.marketing_plans`; neither table's canonical CREATE TABLE source was found in the repository or applied migration statement ledger.
- Added catalog-derived `marketing_plans` and `marketing_provider_subscriptions` schema-only compatibility definitions to the existing disposable-only marketing baseline, in dependency order. Extended the preflight validator for their constraints, FK graph, indexes/policies, RLS and least-privilege grants; the new baseline-specific static checks passed.
- Latest PR #207 head after these changes: `4307e952d23961883b23ebfa8fda16faec00c768`. New exact-head CI is starting; replay run id `38406719880` is pending/in progress and no result is claimed yet. Migration-history immutability already passed for this head; version uniqueness, SMM boundary, tenant-scope, Paymob lookup, and remaining checks are pending/running.
- A fresh read-only production catalog query reconfirmed the four global MantiGO RPCs remain `SECURITY DEFINER`, `search_path=public`, executable by `authenticated`, and do not call `mnty_can_platform_admin()`. This P0 production issue is unchanged.
- No production migration, table/policy/grant/Auth/RLS change, row mutation, deployment, or release was performed. The temporary marketing fixtures are synthetic, current-catalog-derived CI scaffolding, not historical DDL recovery. Release remains **BLOCKED / NOT CERTIFIED**.


## Fresh production ledger and release gate — 2026-10-13 13:40 UTC

- Re-read the live Supabase migration ledger using SELECT only. The latest 25 applied versions end at `20261008222845 / rc424_atomic_digital_page_payment_webhook`; neither RC449 nor RC462 appears in the applied tail. The candidate MantiGO platform-admin fix is therefore not live.
- Re-ran the live `pg_catalog.pg_proc` authorization check. The same four RPCs remain `SECURITY DEFINER=true`, `search_path=public`, callable by `authenticated`, and do not call `mnty_can_platform_admin()`. This remains a verified P0 production blocker.
- PR #218's RC449/RC462 candidate previously passed its disposable PostgreSQL regression tests, including 15/15 platform-admin scope checks and malformed-permissions regression. That is candidate evidence only; it does not change the live ledger or production function definitions.
- Latest PR #207 head remains `4307e952d23961883b23ebfa8fda16faec00c768`; migration-history immutability and migration-version uniqueness checks passed. S04 run [#38406719880](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38406719880) is still in disposable Supabase startup; the chronological replay has not started on that run, so its result is **NOT VERIFIED**.
- No production mutation, migration, function deployment, Auth/RLS/grant change, wallet/payment action, merge, or release was performed. Final state remains **BLOCKED / NOT CERTIFIED**.


## Payment-events policy replay checkpoint — 2026-10-13 13:45 UTC

- Run [#38406719880](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38406719880) passed all temporary-baseline preflight/copy checks and advanced beyond marketing projects, participants, plans and subscriptions, then failed at `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql` because the earlier `payment_events_finance_read` policy definition is missing from tracked historical source.
- Read-only production catalog evidence confirmed the policy is a same-tenant active finance-role SELECT policy; RLS and FORCE RLS are enabled, and direct SELECT grants are absent for anon/authenticated. No operational rows were read.
- Added a policy-only, catalog-derived test fixture at `supabase/tests/baselines/payment_events_finance_read.sql`; CI temporarily injects it as `20260927140493_test_only_live_derived_payment_events_finance_read.sql` immediately before the historical ALTER POLICY migration. The validator checks the predicate/roles, provenance, no data/table/grants, and chronological placement. It does not claim original historical DDL.
- Latest PR #207 head: `af4d56ec52ebf3339c795b2ba8d5411f3336ef4b`. New exact-head CI run [#38407549932](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38407549932) is queued/pending. No result is claimed until the validator and replay logs complete.
- Latest live ledger remains at `20261008222845 / rc424_atomic_digital_page_payment_webhook`; the four global MantiGO RPCs remain confirmed unsafe in the live catalog. No production mutation, migration, deployment, merge, or release occurred. Overall status remains **BLOCKED / NOT CERTIFIED**.


## CI wiring correction — payment policy fixture (2026-10-13 13:47 UTC)

- After the new policy fixture was added, CI run #38407549932 failed in the exact-copy verification step before any database replay. Exact error: `payment_events_policy_baseline: unbound variable` under Bash `set -u`.
- Root cause was the workflow's step-local shell scope: the new fixture variables existed in the injection step but were missing from the separate verification step. Added the baseline and temporary-migration declarations to that verification step. The workflow now declares each variable once per step.
- Documented the failure and correction in `docs/release/MIGRATION_REPLAY_BLOCKERS.md`. No migration was applied or skipped; no production state was touched.
- Latest PR #207 head is `268c8bc1438e499c45487a002e8ec4f776c68011`. New replay run [#38407801526](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38407801526) is pending. The exact-copy/untracked check must pass before replay can resume; no new replay result is claimed.
- SMM regression remains PASS on its last tested exact source revision, and the four live MantiGO RPC authorization blockers remain unchanged. Release remains **BLOCKED / NOT CERTIFIED**.


## Master TODO and latest queued replay — 2026-10-13 13:49 UTC

- The requested root file `MANTIQATIX_MASTER_TODO_2026-10-13.md` is not present in the repository search results. To preserve the canonical project record without creating a competing TODO, appended the current status to the existing `docs/MASTER_PRODUCTION_TODO.md` on PR #207's working branch.
- The update records the verified SMM CI result, current production migration tail at RC424, the four live MantiGO RPC authorization defects, the catalog-derived marketing/payment policy fixtures, the replay failures and limitations, and the release decision.
- PR #207 current head is `7016250e763a4b0729fd2bb3c4553c79ea5e47ce`. Migration-history immutability passed; migration-version uniqueness is running. Replay run [#38408000724](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38408000724) is still pending without a job assigned in the available status response. Earlier run #38407801526 was cancelled after the branch advanced, so it does not verify the corrected exact-copy step.
- No further commit is being made to PR #207 while its replay run is pending, to avoid cancelling the queued replay through workflow concurrency. Resume by polling #38408000724, then inspect the exact logs before changing any code.
- Production release remains **BLOCKED / NOT CERTIFIED**; no production writes/deployment/merge occurred.


## Settlement policy baseline checkpoint — 2026-10-13 13:52 UTC

- Replay run [#38408000724](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38408000724) passed preflight and temporary-baseline copy/untracked verification, then failed at `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql` because `settlement_transactions_finance_read` was absent.
- Read-only production policy inspection confirmed the finance-read policy is same-tenant, active-membership, finance-role scoped; RLS and FORCE RLS are enabled; anon has no direct SELECT. No settlement/payment rows were read.
- Added `supabase/tests/baselines/settlement_transactions_finance_read.sql` (policy only), CI injection at `20260927140492_test_only_live_derived_settlement_transactions_finance_read.sql`, and validator checks for policy scope, provenance, ordering and no table/grant/data changes. Appended the finding to both `docs/release/MIGRATION_REPLAY_BLOCKERS.md` and `docs/MASTER_PRODUCTION_TODO.md`.
- Latest replay branch head after documentation: `33e813e87330212dc49741a545f50d15cd4dc3d4`. The next exact-head run must verify the new fixture and continue replay; no PASS is claimed.
- The production ledger remains at RC424 and the four global MantiGO RPCs remain unguarded in live catalog. No production mutation, deployment, merge, or release occurred. Status remains **BLOCKED / NOT CERTIFIED**.


## Root-cause fix checkpoint — replay cutoff enforced by filesystem (2026-10-13 17:15 UTC)

### Confirmed root cause
- Latest completed replay run before this change: [#38350577917](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38350577917), job `replay-all-migrations`.
- Exact error: `ERROR: function public.smm_bootstrap_first_admin() does not exist (SQLSTATE 42883)` while applying `20260927033925_harden_smm_bootstrap_trigger_execute_privilege.sql`.
- The workflow attempted `supabase db reset --local --version 20260927033924`, intending to stop before the lockdown migration, but the observed command proceeded to `20260927033925` and failed before the subsequent `psql` baseline injection could run. This is a control-flow defect in the replay harness, not a reason to bypass the lockdown.
- The approved test-only function baseline already exists at `supabase/tests/baselines/smm_bootstrap_first_admin.sql`; the historical source creation migration is absent. The actual lockdown migration must remain in the chronological replay and its ACL contract must be asserted.

### Implemented root-cause change
- Updated `.github/workflows/migration-chain-replay.yml` on PR #207 branch `reconcile/rc425-458-current-main-20261011`.
- New commit: `4190f3c9d3c739c841f789fb667f51d11f2a5d10`.
- The workflow now enforces the pre-lockdown cutoff by temporarily moving every migration with a 14-digit version greater than `20260927033924` out of `supabase/migrations` before `supabase db reset --local`. An EXIT trap restores every stashed file even if reset fails; the workflow asserts the test-only baseline migration is present and the real lockdown migration is absent during reset.
- After the clean reset, the workflow restores future migrations, injects the catalog-verified function definition into the disposable DB, applies the real lockdown SQL and checks its ACL, then resumes normal `supabase migration up --local`. No historical migration is edited, no placeholder function is added to production, and no production database is mutated.
- PR #207 remains open and unmerged. At the time of this checkpoint, the newly committed workflow had not yet produced a run visible through the available workflow-run lookup; therefore the fix is **IMPLEMENTED / NOT YET VERIFIED**.

### SMM exact-head CI evidence
- PR #225 head: `ec2f050a4980c2e7d7f2442a529284a140fd508f`.
- Run [#38408664832](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38408664832) checked out synthetic merge commit `8deed20` merging that exact head into base `77012649e41fe22077538c39cd8593bf696ab33e`.
- Job `source-and-unit` completed **SUCCESS**. Logs confirm `SMM gateway security contract: PASS` and `SMM service-role access boundary contract: PASS`. This is static contract/unit CI evidence, not a live HTTP test or post-launch provider certification.
- PR #225 remains draft/open/unmerged. The live SMM function remains deliberately fail-closed (deployed version 10, hard-disabled gate), so do not enable it without a separate release approval.

### Current release decision
- P0 live MantiGO RPC authorization remains **BLOCKED**; the four high-risk RPCs are still SECURITY DEFINER, have `search_path=public`, are executable by `authenticated`, and lack the platform-admin guard per read-only production catalog checks.
- P1 migration replay remains **FAIL / BLOCKED** until a new run proves the cutoff fix works and chronological replay proceeds to the next true blocker.
- Overall: **BLOCKED / NOT CERTIFIED**.

### Next exact actions
1. Inspect the new PR #207 CI run at commit `4190f3c9d3c739c841f789fb667f51d11f2a5d10`. If it fails, capture the first actual SQL error and fix that specific dependency without skipping the migration.
2. Re-run full clean replay to completion; inspect the local migration ledger and assert every source migration is accounted for.
3. Keep PR #225 draft and unmerged; add isolated HTTP-level tests for the fail-closed 503/no-side-effect behavior when an available safe harness permits it.
4. Do not merge, deploy, apply production migrations, or alter live grants/Auth/RLS without separate explicit approval.


## Root-cause execution update — staged migration replay checkpoint (2026-10-13 14:16 UTC)

- Latest verified replay run [#38408000724](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38408000724) passed disposable service startup and the exact-copy/untracked guard, then failed in migration `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql` at statement 46: `ERROR: policy "settlement_transactions_finance_read" for table "settlement_transactions" does not exist (SQLSTATE 42704)`.
- The log's chronological apply list contained the temporary policy migration at version `20260927140492` in the verification/copy guard, but did **not** contain it in the actual `Applying migration ...` output; the next applied file was `20260927140493_test_only_live_derived_payment_events_finance_read.sql`. This is now the concrete CI defect to investigate, rather than adding another guessed policy fixture.
- Implemented a staged replay checkpoint in PR #207's owning branch, commit `bfdaf276fede8fd852b08c6ed58ccfc382687381`, workflow `.github/workflows/migration-chain-replay.yml`: temporarily isolates all migrations newer than `20260927140492`, invokes `supabase migration up --local`, logs the local migration ledger and policy catalog, and hard-fails unless version `20260927140492` and the expected policy both exist before restoring later migrations and continuing. This is disposable CI only; no production state is touched.
- This patch is **IN PROGRESS / NOT VERIFIED** until the new exact-head workflow run reports the staged checkpoint and its ledger/catalog evidence. PR #207 currently reports `mergeable=false` after the workflow update; inspect and resolve its mergeability condition before any merge request (still no merge authorized).
- PR #225's SMM security contract workflow had a successful source-and-unit job on an earlier tested synthetic PR revision, but that does not establish success on its latest head `899794506ec0ceb16363998abae189d933e289ba`; exact-head SMM CI remains **NOT VERIFIED**.
- A fresh read-only production catalog query still confirms the four MantiGO dashboard/report/settlement/expiry RPCs are SECURITY DEFINER, use `search_path=public`, are executable by `authenticated`, and do not call `mnty_can_platform_admin()`. This remains a live P0 blocker. Live SMM remains deployed at version 10 with `verify_jwt=true` and the hard-deferred 503 gate; that is containment, not post-launch certification.
- No production migration, data, Auth/RLS/grant change, Edge Function deployment, wallet/payment operation, PR merge, or release was performed.

### Exact next steps
1. Inspect the new staged-checkpoint CI on PR #207's current exact head `bfdaf276fede8fd852b08c6ed58ccfc382687381`; determine why 40492 was skipped if the checkpoint fails, using the printed local ledger and policy catalog.
2. Reconcile PR #207's current `mergeable=false` state without overwriting other sessions' commits.
3. Continue clean replay one proven dependency at a time; never synthesize a historical source migration or claim historical provenance from catalog-derived fixtures.
4. Re-run SMM source/unit/security regression on PR #225's exact latest SHA and preserve the release block until P0 live RPC authorization is fixed through the separately approved release path.
