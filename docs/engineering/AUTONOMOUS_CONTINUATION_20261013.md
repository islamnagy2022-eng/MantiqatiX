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
